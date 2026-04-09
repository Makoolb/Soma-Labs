import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

type AuthMode = "select" | "signup" | "signin";

type ClerkError = { code?: string; longMessage?: string; message?: string };
type ClerkErrorResponse = { errors?: ClerkError[] };

const GRADES = ["P4", "P5", "P6"] as const;
type Grade = typeof GRADES[number];

function extractErrorMessage(err: unknown): string {
  const e = err as ClerkErrorResponse;
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startApple } = useOAuth({ strategy: "oauth_apple" });

  // ── Navigation state ───────────────────────────────────────────────────────
  const [authMode, setAuthMode] = useState<AuthMode>("select");
  // Signup flows through "profile" (name + grade) THEN oauth buttons
  const [signupStep, setSignupStep] = useState<"profile" | "oauth">("profile");

  // ── Sign-up profile fields (collected BEFORE auth) ─────────────────────────
  const [newUserName, setNewUserName] = useState("");
  const [newUserGrade, setNewUserGrade] = useState<Grade | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Navigation helpers ─────────────────────────────────────────────────────
  function goBack() {
    Haptics.selectionAsync();
    setError(null);
    if (authMode === "signup" && signupStep === "oauth") {
      setSignupStep("profile");
    } else {
      setAuthMode("select");
      setSignupStep("profile");
    }
  }

  function selectMode(mode: "signup" | "signin") {
    Haptics.selectionAsync();
    setAuthMode(mode);
    setError(null);
  }

  // ── OAuth ──────────────────────────────────────────────────────────────────
  async function handleGoogleAuth() {
    setLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startGoogle();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        if (authMode === "signup") {
          router.replace({
            pathname: "/onboarding",
            params: { name: newUserName.trim(), grade: newUserGrade! },
          });
        } else {
          router.replace("/");
        }
      }
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleAuth() {
    setLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startApple();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        if (authMode === "signup") {
          router.replace({
            pathname: "/onboarding",
            params: { name: newUserName.trim(), grade: newUserGrade! },
          });
        } else {
          router.replace("/");
        }
      }
    } catch {
      setError("Apple sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isProfileComplete = newUserName.trim().length > 0 && newUserGrade !== null;

  // ── Shared card header (back button) ──────────────────────────────────────
  const showBack = authMode !== "select";
  const backLabel =
    authMode === "signup" && signupStep === "oauth" ? "Your Details" : "Back";

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: topPad + 16, paddingBottom: bottomPad + 32 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Ionicons name="school" size={44} color="#fff" />
        </View>
        <Text style={styles.appName}>SabiLab</Text>
        <Text style={styles.tagline}>
          {authMode === "select"
            ? "Save your progress and access it on any device"
            : authMode === "signup" && signupStep === "profile"
              ? "Tell us about yourself to get started"
              : authMode === "signup"
                ? "Verify your identity to create your account"
                : "Welcome back — sign in to continue"}
        </Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        {/* Back button */}
        {showBack && (
          <TouchableOpacity style={styles.backRow} onPress={goBack} testID="auth-back">
            <Ionicons name="arrow-back" size={18} color={Colors.light.navy} />
            <Text style={styles.backTxt}>{backLabel}</Text>
          </TouchableOpacity>
        )}

        {/* Error banner */}
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={16} color={Colors.light.rust} />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        ) : null}

        {/* ── Mode selection ── */}
        {authMode === "select" && (
          <View style={styles.form}>
            <TouchableOpacity style={styles.modeBtn} onPress={() => selectMode("signup")} activeOpacity={0.85} testID="auth-signup-btn">
              <View style={styles.modeBtnIcon}>
                <Ionicons name="person-add-outline" size={22} color={Colors.light.navy} />
              </View>
              <View style={styles.modeBtnText}>
                <Text style={styles.modeBtnTitle}>New Student</Text>
                <Text style={styles.modeBtnSub}>Create an account to save your progress</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeBtn} onPress={() => selectMode("signin")} activeOpacity={0.85} testID="auth-signin-btn">
              <View style={styles.modeBtnIcon}>
                <Ionicons name="log-in-outline" size={22} color={Colors.light.navy} />
              </View>
              <View style={styles.modeBtnText}>
                <Text style={styles.modeBtnTitle}>Returning Student</Text>
                <Text style={styles.modeBtnSub}>Sign in to continue where you left off</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Sign-up: profile step (name + grade BEFORE auth) ── */}
        {authMode === "signup" && signupStep === "profile" && (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Your Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Emeka Chukwu"
              placeholderTextColor={Colors.light.textTertiary}
              value={newUserName}
              onChangeText={setNewUserName}
              autoFocus
              autoCapitalize="words"
              testID="auth-name-input"
            />
            <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Your Class</Text>
            <View style={styles.gradeRow}>
              {GRADES.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.gradeBtn, newUserGrade === g && styles.gradeBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setNewUserGrade(g); }}
                  testID={`auth-grade-${g}`}
                >
                  <Text style={[styles.gradeBtnTxt, newUserGrade === g && styles.gradeBtnTxtActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>You can update these later from the Parent Dashboard</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, !isProfileComplete && styles.btnDisabled]}
              onPress={() => { Haptics.selectionAsync(); setSignupStep("oauth"); setError(null); }}
              disabled={!isProfileComplete}
              testID="auth-profile-continue"
            >
              <Text style={styles.primaryBtnTxt}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── OAuth buttons (signup oauth step OR signin) ── */}
        {(authMode === "signin" || (authMode === "signup" && signupStep === "oauth")) && (
          <View style={styles.form}>
            <Text style={styles.hint}>
              {authMode === "signup"
                ? "Use your Google account to create a SabiLab account"
                : "Use your Google account to sign in"}
            </Text>
            <TouchableOpacity
              style={[styles.socialBtn, loading && styles.btnDisabled]}
              onPress={handleGoogleAuth}
              disabled={loading}
              testID="auth-google-btn"
            >
              {loading
                ? <ActivityIndicator color={Colors.light.navy} />
                : <><Ionicons name="logo-google" size={20} color="#EA4335" /><Text style={styles.socialBtnTxt}>Continue with Google</Text></>
              }
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={[styles.appleBtn, loading && styles.btnDisabled]}
                onPress={handleAppleAuth}
                disabled={loading}
                testID="auth-apple-btn"
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="logo-apple" size={20} color="#fff" /><Text style={styles.appleBtnTxt}>Sign in with Apple</Text></>
                }
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Text style={styles.footer}>
        Progress saved securely — accessible on any device
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.light.navy, flexGrow: 1, paddingHorizontal: 20 },

  hero: { alignItems: "center", paddingBottom: 28, gap: 10 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  appName: { fontFamily: "Inter_700Bold", fontSize: 30, color: "#fff" },
  tagline: { fontFamily: "Inter_400Regular", fontSize: 15, color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 22 },

  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 28, padding: 20, gap: 16,
  },

  backRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  backTxt: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.navy },

  modeBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 18, padding: 18,
    borderWidth: 2, borderColor: Colors.light.border,
  },
  modeBtnIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.light.navy + "12",
    justifyContent: "center", alignItems: "center",
  },
  modeBtnText: { flex: 1, gap: 2 },
  modeBtnTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
  modeBtnSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },

  errorCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.light.rust + "12", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.light.rust + "30",
  },
  errorTxt: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.rust, lineHeight: 20 },

  form: { gap: 12 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.navy },
  hint: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 20 },

  gradeRow: { flexDirection: "row", gap: 10 },
  gradeBtn: {
    flex: 1, height: 52, borderRadius: 14,
    backgroundColor: Colors.light.card,
    borderWidth: 2, borderColor: Colors.light.border,
    justifyContent: "center", alignItems: "center",
  },
  gradeBtnActive: { backgroundColor: Colors.light.navy, borderColor: Colors.light.navy },
  gradeBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.textSecondary },
  gradeBtnTxtActive: { color: "#fff" },

  textInput: {
    borderWidth: 1.5, borderColor: Colors.light.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.light.text,
    backgroundColor: Colors.light.card,
  },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.light.navy, borderRadius: 16, paddingVertical: 16,
  },
  primaryBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  btnDisabled: { opacity: 0.45 },

  socialBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderWidth: 1.5, borderColor: Colors.light.border,
    borderRadius: 16, paddingVertical: 16,
    backgroundColor: Colors.light.card,
  },
  socialBtnTxt: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.light.navy },

  appleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#000", borderRadius: 16, paddingVertical: 16,
  },
  appleBtnTxt: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },

  footer: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: "rgba(255,255,255,0.55)", textAlign: "center", marginTop: 20,
  },
});
