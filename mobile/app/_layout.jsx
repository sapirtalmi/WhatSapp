import { Stack } from "expo-router";
import { AuthProvider } from "../src/context/AuthContext";

export default function RootLayout() {
  return (
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
      </Stack>
    </AuthProvider>
  );
}
