import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/auth/context";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      Alert.alert("Login Failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.inner}>
        <Text style={s.logo}>Got Dirt?</Text>
        <Text style={s.subtitle}>Find dirt pits near your job site</Text>

        <View style={s.card}>
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={[s.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={s.linkRow}>
            <Text style={s.linkText}>Don&apos;t have an account? <Text style={s.link}>Sign up →</Text></Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  inner:     { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 40 },
  logo:      { fontSize: 36, fontWeight: "900", color: "#000", textAlign: "center", marginBottom: 6 },
  subtitle:  { fontSize: 15, color: "#6b7280", textAlign: "center", marginBottom: 32 },
  card:      { backgroundColor: "#fff", borderRadius: 20, padding: 24, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  label:     { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input:     { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: "#111827", backgroundColor: "#f9fafb" },
  btn:       { backgroundColor: "#d97706", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  btnDisabled: { opacity: 0.6 },
  btnText:   { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkRow:   { alignItems: "center", marginTop: 24 },
  linkText:  { color: "#6b7280", fontSize: 14 },
  link:      { color: "#d97706", fontWeight: "600" },
});
