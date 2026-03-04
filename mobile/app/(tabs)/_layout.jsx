import { Tabs, router } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../../src/context/AuthContext";

export default function TabsLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading]);

  if (loading || !user) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4f46e5",
        tabBarInactiveTintColor: "#9ca3af",
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Feed", tabBarLabel: "Feed" }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Explore", tabBarLabel: "Explore" }}
      />
      <Tabs.Screen
        name="collections"
        options={{ title: "Collections", tabBarLabel: "Collections" }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: "Friends", tabBarLabel: "Friends" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarLabel: "Profile" }}
      />
    </Tabs>
  );
}
