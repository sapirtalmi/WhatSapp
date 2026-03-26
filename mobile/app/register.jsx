import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuth } from "../src/context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  async function handleRegister() {
    if (!username || !email || !password) return;
    setLoading(true);
    try {
      await register(username, email, password);
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Registration failed", err.response?.data?.detail ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <LinearGradient
            colors={["#2563EB", "#38BDF8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoCircle}
          >
            <Text style={styles.logoEmoji}>🗺</Text>
          </LinearGradient>
        </View>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join and explore together</Text>

        {/* Inputs */}
        <View style={styles.form}>
          <TextInput
            style={[styles.input, focusedField === "username" && styles.inputFocused]}
            placeholder="Username"
            placeholderTextColor="#b0b7c3"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            onFocus={() => setFocusedField("username")}
            onBlur={() => setFocusedField(null)}
          />
          <TextInput
            style={[styles.input, focusedField === "email" && styles.inputFocused]}
            placeholder="Email"
            placeholderTextColor="#b0b7c3"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
          />
          <TextInput
            style={[styles.input, focusedField === "password" && styles.inputFocused]}
            placeholder="Password"
            placeholderTextColor="#b0b7c3"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.88}
          >
            <Text style={styles.buttonText}>
              {loading ? "Creating…" : "Create account →"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.footerLink}>Sign in →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },

  // Logo
  logoWrap: { alignItems: "center", marginBottom: 24 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#2563EB", shadowOpacity: 0.35,
    shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  logoEmoji: { fontSize: 32 },

  // Headlines
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 40,
    fontWeight: "500",
  },

  // Form
  form: { gap: 12 },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#e8e8e8",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  inputFocused: {
    borderColor: "#0f172a",
  },

  // Button
  button: {
    height: 52,
    backgroundColor: "#0f172a",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.1,
  },

  // Footer
  footer: {
    marginTop: 36,
    alignItems: "center",
    gap: 4,
  },
  footerText: { fontSize: 14, color: "#94a3b8" },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563EB",
  },
});
