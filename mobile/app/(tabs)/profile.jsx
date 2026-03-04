import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { router } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../src/context/AuthContext";
import { getCollections } from "../../src/api/collections";
import { getFriends } from "../../src/api/friends";

const AVATAR_COLORS = ["#6366f1", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

function avatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function StatBox({ value, label }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, onPress, destructive }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>{label}</Text>
      <Text style={styles.menuChevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [collectionCount, setCollectionCount] = useState(null);
  const [friendCount, setFriendCount] = useState(null);

  function loadStats() {
    getCollections().then((cols) => setCollectionCount(cols.length)).catch(() => setCollectionCount(0));
    getFriends().then((f) => setFriendCount(f.length)).catch(() => setFriendCount(0));
  }

  useEffect(() => { loadStats(); }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={loadStats} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <Text style={{ fontSize: 22, color: "#4f46e5", fontWeight: "600", marginRight: 4 }}>↻</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const color = avatarColor(user?.username);
  const letter = user?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      {/* Avatar + name */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{letter}</Text>
        </View>
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBox
          value={collectionCount == null ? "—" : collectionCount}
          label="Collections"
        />
        <View style={styles.statDivider} />
        <StatBox
          value={friendCount == null ? "—" : friendCount}
          label="Friends"
        />
      </View>

      {/* Menu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My content</Text>
        <MenuRow icon="📚" label="My collections" onPress={() => router.push("/(tabs)/collections")} />
        <MenuRow icon="👥" label="Friends" onPress={() => router.push("/(tabs)/friends")} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <MenuRow icon="🚪" label="Sign out" onPress={handleLogout} destructive />
      </View>

      <Text style={styles.versionText}>WhatSapp • v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { padding: 20, gap: 16 },

  header: { alignItems: "center", paddingVertical: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarText: { fontSize: 36, color: "#fff", fontWeight: "700" },
  username: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  email: { fontSize: 14, color: "#94a3b8" },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  statLabel: { fontSize: 12, color: "#94a3b8", marginTop: 2, fontWeight: "500" },
  statDivider: { width: 1, backgroundColor: "#f1f5f9" },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f8fafc",
    gap: 12,
  },
  menuIcon: { fontSize: 18, width: 24, textAlign: "center" },
  menuLabel: { flex: 1, fontSize: 15, color: "#0f172a", fontWeight: "500" },
  menuLabelDestructive: { color: "#ef4444" },
  menuChevron: { fontSize: 20, color: "#cbd5e1" },

  versionText: { textAlign: "center", fontSize: 11, color: "#cbd5e1", paddingVertical: 8 },
});
