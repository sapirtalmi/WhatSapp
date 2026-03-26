import { Stack } from "expo-router";
import { AuthProvider } from "../src/context/AuthContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AuthProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen
          name="collection/[id]"
          options={{
            headerTintColor: "#4f46e5",
            headerTitleStyle: { fontWeight: "700", color: "#0f172a" },
            headerStyle: { backgroundColor: "#fff" },
          }}
        />
        <Stack.Screen
          name="create-broadcast"
          options={{
            title: "Create Broadcast",
            presentation: "modal",
            headerStyle: { backgroundColor: "#fff" },
            headerTitleStyle: { fontWeight: "700", color: "#1C1C1E" },
            headerTintColor: "#F5A623",
          }}
        />
        <Stack.Screen
          name="broadcast-requests"
          options={{
            title: "Join Requests",
            headerStyle: { backgroundColor: "#fff" },
            headerTitleStyle: { fontWeight: "700", color: "#1C1C1E" },
            headerTintColor: "#F5A623",
          }}
        />
        <Stack.Screen
          name="chats"
          options={{
            title: "Chats",
            headerStyle: { backgroundColor: "#fff" },
            headerTitleStyle: { fontWeight: "700", color: "#1C1C1E" },
            headerTintColor: "#F5A623",
          }}
        />
        <Stack.Screen
          name="chat/[id]"
          options={{ title: "Chat", headerShown: false }}
        />
      </Stack>
    </AuthProvider>
    </GestureHandlerRootView>
  );
}
