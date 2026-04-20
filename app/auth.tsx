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
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

type AuthMode = "select" | "signup" | "signin";
type SignupStep = "profile" | "credentials";
type CredStep = "form" | "verify";

const GRADES = ["P4", "P5", "P6"] as const;
type Grade = typeof GRADES[number];

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return (err as { message: string }).message;
  }
  return "Something went wrong. Please try again.";
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [authMode, setAuthMode] = useState<AuthMode>("select");
  const [signupStep, setSignupStep] = useState<SignupStep>("profile");
  const [credStep, setCredStep] = useState<CredStep>("form");

  const [newUserName, setNewUserName] = useState("");
  const [newUserGrade, setNewUserGrade] = useState<Grade | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProfileComplete = newUserName.trim().length > 0 && newUserGrade !== null;
  const isSignUpCredComplete = email.trim().length > 0 && password.length >= 8;
  const isSignInCredComplete = email.trim().length > 0 && password.length > 0;
  const isCredComplete = authMode === "signin" ? isSignInCredComplete : isSignUpCredComplete;

  function goBack() {
    Haptics.selectionAsync();
    setError(null);
    if (credStep === "verify") {
      setCredStep("form");
    } else if (authMode === "signup" && signupStep === "credentials") {
      setSignupStep("profile");
    } else {
      setAuthMode("select");
      setSignupStep("profile");
      setCredStep("form");
      setEmail("");
      setPassword("");
      setVerifyCode("");
    }
  }

  function selectMode(mode: "signup" | "signin") {
    Haptics.selectionAsync();
    setAuthMode(mode);
    setError(null);
    setCredStep("form");
  }

  async function handleSignUp() {
    if (!isCredComplete) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: newUserName.trim(), grade: newUserGrade },
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        router.replace({
          pathname: "/onboarding",
          params: { name: newUserName.trim(), grade: newUserGrade! },
        });
      } else {
        setCredStep("verify");
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail() {
    if (verifyCode.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: verifyCode,
        type: "signup",
      });
      if (verifyError) throw verifyError;
      if (data.session) {
        router.replace({
          pathname: "/onboarding",
          params: { name: newUserName.trim(), grade: newUserGrade! },
        });
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    try {
      await supabase.auth.resend({ type: "signup", email: email.trim() });
    } catch {}
  }

  async function handleSignIn() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      router.replace("/");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const showBack = authMode !== "select";
  const backLabel =
    credStep === "verify"
      ? "Back"
      : authMode === "signup" && signupStep === "credentials"
        ? "Your Details"
        : "Back";

  const isVerifyScreen = credStep === "verify";
  const isCredScreen =
    authMode === "signin" ||
    (authMode === "signup" && signupStep === "credentials" && !isVerifyScreen);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 16, paddingBottom: bottomPad + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
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
              : isVerifyScreen
                ? "Check your email for a 6-digit code"
                : authMode === "signup"
                  ? "Create your account"
                  : "Welcome back — sign in to continue"}
        </Text>
      </View>

      <View style={styles.card}>
        {showBack && (
          <TouchableOpacity style={styles.backRow} onPress={goBack} testID="auth-back">
            <Ionicons name="arrow-back" size={18} color={Colors.light.navy} />
            <Text style={styles.backTxt}>{backLabel}</Text>
          </TouchableOpacity>
        )}

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={16} color={Colors.light.rust} />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        ) : null}

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
                  <Text style={[styles.gradeBtnTxt, newUserGrade === g && styles.gradeBtnTxtActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>You can update these later from the Parent Dashboard</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, !isProfileComplete && styles.btnDisabled]}
              onPress={() => { Haptics.selectionAsync(); setSignupStep("credentials"); setError(null); }}
              disabled={!isProfileComplete}
              testID="auth-profile-continue"
            >
              <Text style={styles.primaryBtnTxt}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {isCredScreen && (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={styles.textInput}
              placeholder="student@example.com"
              placeholderTextColor={Colors.light.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              testID="auth-email-input"
            />
            <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.textInput, styles.passwordInput]}
                placeholder={authMode === "signup" ? "At least 8 characters" : "Your password"}
                placeholderTextColor={Colors.light.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                testID="auth-password-input"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            {authMode === "signup" && <Text style={styles.hint}>Minimum 8 characters</Text>}
            <TouchableOpacity
              style={[styles.primaryBtn, (!isCredComplete || loading) && styles.btnDisabled]}
              onPress={authMode === "signup" ? handleSignUp : handleSignIn}
              disabled={!isCredComplete || loading}
              testID={authMode === "signup" ? "auth-signup-submit" : "auth-signin-submit"}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.primaryBtnTxt}>{authMode === "signup" ? "Create Account" : "Sign In"}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {authMode === "signup" && isVerifyScreen && (
          <View style={styles.form}>
            <Text style={styles.hint}>
              We sent a 6-digit code to <Text style={styles.emailHighlight}>{email}</Text>
            </Text>
            <Text style={styles.fieldLabel}>Verification Code</Text>
            <TextInput
              style={[styles.textInput, styles.codeInput]}
              placeholder="123456"
              placeholderTextColor={Colors.light.textTertiary}
              value={verifyCode}
              onChangeText={setVerifyCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              testID="auth-verify-input"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, (verifyCode.length < 6 || loading) && styles.btnDisabled]}
              onPress={handleVerifyEmail}
              disabled={verifyCode.length < 6 || loading}
              testID="auth-verify-submit"
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnTxt}>Verify Email</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleResendCode}>
              <Text style={styles.resendTxt}>Resend code</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.footer}>Progress saved securely — accessible on any device</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.light.navy, flexGrow: 1, paddingHorizontal: 20 },
  hero: { alignItems: "center", paddingBottom: 28, gap: 10 },
  logoWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  appName: { fontFamily: "Inter_700Bold", fontSize: 30, color: "#fff" },
  tagline: { fontFamily: "Inter_400Regular", fontSize: 15, color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 22 },
  card: { backgroundColor: Colors.light.background, borderRadius: 28, padding: 20, gap: 16 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  backTxt: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.navy },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.light.card, borderRadius: 18, padding: 18, borderWidth: 2, borderColor: Colors.light.border },
  modeBtnIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.light.navy + "12", justifyContent: "center", alignItems: "center" },
  modeBtnText: { flex: 1, gap: 2 },
  modeBtnTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
  modeBtnSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },
  errorCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.light.rust + "12", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.light.rust + "30" },
  errorTxt: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.rust, lineHeight: 20 },
  form: { gap: 12 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.navy },
  hint: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 20 },
  emailHighlight: { fontFamily: "Inter_600SemiBold", color: Colors.light.navy },
  gradeRow: { flexDirection: "row", gap: 10 },
  gradeBtn: { flex: 1, height: 52, borderRadius: 14, backgroundColor: Colors.light.card, borderWidth: 2, borderColor: Colors.light.border, justifyContent: "center", alignItems: "center" },
  gradeBtnActive: { backgroundColor: Colors.light.navy, borderColor: Colors.light.navy },
  gradeBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.textSecondary },
  gradeBtnTxtActive: { color: "#fff" },
  textInput: { borderWidth: 1.5, borderColor: Colors.light.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.light.text, backgroundColor: Colors.light.card },
  passwordRow: { position: "relative" },
  passwordInput: { paddingRight: 52 },
  eyeBtn: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
  codeInput: { textAlign: "center", fontSize: 28, letterSpacing: 8, fontFamily: "Inter_700Bold" },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.navy, borderRadius: 16, paddingVertical: 16 },
  primaryBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  btnDisabled: { opacity: 0.45 },
  resendTxt: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.navy, textAlign: "center" },
  footer: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.55)", textAlign: "center", marginTop: 20 },
});
