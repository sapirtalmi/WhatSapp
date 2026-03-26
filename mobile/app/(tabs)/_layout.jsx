import { Tabs, router } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { getChats } from "../../src/api/chats";
import { getPendingRequests } from "../../src/api/friends";

const TABS = [
  { name: "index",       label: "Explore",     icon: "compass",   iconOutline: "compass-outline" },
  { name: "collections", label: "Collections", icon: "bookmark",  iconOutline: "bookmark-outline" },
  { name: "friends",     label: "Friends",     icon: "people",    iconOutline: "people-outline" },
  { name: "profile",     label: "Profile",     icon: "person",    iconOutline: "person-outline" },
];

function FloatingTabBar({ state, navigation, hasSocialBadge }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarWrapper, { bottom: insets.bottom + 12 }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const isFocused = state.index === index;
          const showBadge = tab.name === "friends" && hasSocialBadge;

          function onPress() {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          if (isFocused) {
            return (
              <LinearGradient
                key={route.key}
                colors={["#34d399", "#2dd4bf"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.activeTab}
              >
                <TouchableOpacity style={styles.activeTabInner} onPress={onPress} activeOpacity={0.85}>
                  <Ionicons name={tab.icon} size={18} color="#fff" />
                  <Text style={styles.activeLabel}>{tab.label}</Text>
                </TouchableOpacity>
              </LinearGradient>
            );
          }

          return (
            <TouchableOpacity key={route.key} style={styles.inactiveTab} onPress={onPress} activeOpacity={0.7}>
              <View style={{ position: "relative" }}>
                <Ionicons name={tab.iconOutline} size={22} color="#94a3b8" />
                {showBadge && <View style={styles.badgeDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const [hasSocialBadge, setHasSocialBadge] = useState(false);

  const checkBadge = useCallback(async () => {
    if (!user) return;
    try {
      const [chats, pending] = await Promise.all([
        getChats().catch(() => []),
        getPendingRequests().catch(() => []),
      ]);
      const hasUnreadChat = (chats ?? []).some((c) => (c.unread_count ?? 0) > 0);
      const hasPendingFriend = (pending ?? []).length > 0;
      setHasSocialBadge(hasUnreadChat || hasPendingFriend);
    } catch {
      // silently ignore — badge is best-effort
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading]);

  // Poll every 30s for badge updates
  useEffect(() => {
    if (!user) return;
    checkBadge();
    const interval = setInterval(checkBadge, 30000);
    return () => clearInterval(interval);
  }, [checkBadge, user]);

  if (loading || !user) return null;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} hasSocialBadge={hasSocialBadge} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Explore" }} />
      <Tabs.Screen name="collections" options={{ title: "Collections", headerShown: true }} />
      <Tabs.Screen name="friends" options={{ title: "Social Hub", headerShown: true }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 32,
    height: 60,
    paddingHorizontal: 8,
    gap: 4,
    shadowColor: "#2dd4bf",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
    borderWidth: Platform.OS === "android" ? 0 : 1,
    borderColor: "rgba(229,231,235,0.8)",
  },
  activeTab: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    height: 44,
  },
  activeTabInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  activeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.1,
  },
  inactiveTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
  },
  badgeDot: {
    position: "absolute",
    top: -1,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.96)",
  },
});
