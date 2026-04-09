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
import { useSignIn, useSignUp, useOAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

type AuthMode = "select" | "signup" | "signin";
type SignupStep = "profile" | "method";
type PhoneStep = "enter" | "verify";

type ClerkError = { code?: string; longMessage?: string; message?: string };
type ClerkErrorResponse = { errors?: ClerkError[] };
type PhoneCodeFactor = { strategy: "phone_code"; phoneNumberId: string };

const GRADES = ["P4", "P5", "P6"] as const;
type Grade = typeof GRADES[number];

function extractErrorMessage(err: unknown): string {
  const e = err as ClerkErrorResponse;
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+1", label: "United States (+1)" },
];

type AuthMethod = "phone" | "google" | "apple";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { signIn, isLoaded: signInLoaded, setActive: setSignInActive } = useSignIn();
  const { signUp, isLoaded: signUpLoaded, setActive: setSignUpActive } = useSignUp();
  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startApple } = useOAuth({ strategy: "oauth_apple" });

  // ── Navigation state ───────────────────────────────────────────────────────
  const [authMode, setAuthMode] = useState<AuthMode>("select");
  // Signup flows through "profile" (name + grade) THEN "method" (auth choice)
  const [signupStep, setSignupStep] = useState<SignupStep>("profile");
  const [method, setMethod] = useState<AuthMethod>("phone");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("enter");

  // ── Sign-up profile fields (collected BEFORE auth) ─────────────────────────
  const [newUserName, setNewUserName] = useState("");
  const [newUserGrade, setNewUserGrade] = useState<Grade | null>(null);

  // ── Phone auth ─────────────────────────────────────────────────────────────
  const [countryIdx, setCountryIdx] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const country = COUNTRY_CODES[countryIdx] ?? COUNTRY_CODES[0];
  const fullPhone = country.code + phone.trim().replace(/^0+/, "");

  // ── Navigation helpers ─────────────────────────────────────────────────────
  function goBack() {
    Haptics.selectionAsync();
    setError(null);
    if (phoneStep === "verify") {
      setPhoneStep("enter");
      setCode("");
    } else if (authMode === "signup" && signupStep === "method") {
      setSignupStep("profile");
      setPhoneStep("enter");
    } else {
      setAuthMode("select");
      setSignupStep("profile");
      setPhoneStep("enter");
    }
  }

  function selectMode(mode: "signup" | "signin") {
    Haptics.selectionAsync();
    setAuthMode(mode);
    setError(null);
  }

  function switchMethod(m: AuthMethod) {
    Haptics.selectionAsync();
    setMethod(m);
    setError(null);
    setPhoneStep("enter");
    setCode("");
  }

  // ── Phone send code ────────────────────────────────────────────────────────
  async function handleSendCode() {
    if (!phone.trim() || !signInLoaded || !signUpLoaded) return;
    setLoading(true);
    setError(null);
    try {
      if (authMode === "signin") {
        const attempt = await signIn!.create({ identifier: fullPhone });
        const factor = attempt.supportedFirstFactors?.find(
          (f) => f.strategy === "phone_code"
        ) as PhoneCodeFactor | undefined;
        if (factor) {
          await signIn!.prepareFirstFactor({ strategy: "phone_code", phoneNumberId: factor.phoneNumberId });
          setPhoneStep("verify");
        } else {
          setError("Phone sign-in is not available. Please use Google or Apple.");
        }
      } else {
        await signUp!.create({ phoneNumber: fullPhone });
        await signUp!.preparePhoneNumberVerification({ strategy: "phone_code" });
        setPhoneStep("verify");
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Phone verify code ──────────────────────────────────────────────────────
  async function handleVerifyCode() {
    if (code.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      if (authMode === "signin") {
        const result = await signIn!.attemptFirstFactor({ strategy: "phone_code", code });
        if (result.status === "complete") {
          await setSignInActive!({ session: result.createdSessionId });
          router.replace("/");
        }
      } else {
        const result = await signUp!.attemptPhoneNumberVerification({ code });
        if (result.status === "complete" && result.createdSessionId) {
          // Activate session FIRST — profile is NOT saved here.
          // Onboarding receives name+grade via URL params and calls saveProfile()
          // so that isOnboarded only becomes true after the onboarding screen runs.
          await setSignUpActive!({ session: result.createdSessionId });
          router.replace({
            pathname: "/onboarding",
            params: { name: newUserName.trim(), grade: newUserGrade! },
          });
        }
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
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
          // New sign-up: route through onboarding so profile is saved there.
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
          // New sign-up: route through onboarding so profile is saved there.
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

  const tabs: { id: AuthMethod; label: string; icon: string }[] = [
    { id: "phone", label: "Phone", icon: "call-outline" },
    { id: "google", label: "Google", icon: "logo-google" },
    ...(Platform.OS === "ios" ? [{ id: "apple" as AuthMethod, label: "Apple", icon: "logo-apple" }] : []),
  ];

  const isProfileComplete = newUserName.trim().length > 0 && newUserGrade !== null;

  // ── Shared card header (back button) ──────────────────────────────────────
  const showBack = authMode !== "select";
  const backLabel =
    authMode === "signup" && signupStep === "method" && phoneStep === "verify"
      ? "Back"
      : authMode === "signup" && signupStep === "method"
        ? "Your Details"
        : authMode === "signup"
          ? "Back"
          : "Back";

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
              style={styles.phoneInput}
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
              onPress={() => { Haptics.selectionAsync(); setSignupStep("method"); setError(null); }}
              disabled={!isProfileComplete}
              testID="auth-profile-continue"
            >
              <Text style={styles.primaryBtnTxt}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Auth method tabs (signup method step OR signin) ── */}
        {(authMode === "signin" || (authMode === "signup" && signupStep === "method")) && (
          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, method === tab.id && styles.tabActive]}
                onPress={() => switchMethod(tab.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon as React.ComponentProps<typeof Ionicons>["name"]}
                  size={15}
                  color={method === tab.id ? "#fff" : Colors.light.textSecondary}
                />
                <Text style={[styles.tabTxt, method === tab.id && styles.tabTxtActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Phone: enter number ── */}
        {(authMode === "signin" || (authMode === "signup" && signupStep === "method")) &&
          method === "phone" && phoneStep === "enter" && (
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity
                  style={styles.countryBtn}
                  onPress={() => { Haptics.selectionAsync(); setCountryIdx((i) => (i + 1) % COUNTRY_CODES.length); }}
                >
                  <Text style={styles.countryCode}>{country.code}</Text>
                  <Ionicons name="chevron-down" size={12} color={Colors.light.textSecondary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="8012345678"
                  placeholderTextColor={Colors.light.textTertiary}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={15}
                  autoFocus
                  testID="auth-phone-input"
                />
              </View>
              <Text style={styles.hint}>{country.label} — we'll send a 6-digit code</Text>
              <TouchableOpacity
                style={[styles.primaryBtn, (!phone.trim() || loading) && styles.btnDisabled]}
                onPress={handleSendCode}
                disabled={!phone.trim() || loading}
                testID="auth-send-code-btn"
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <><Text style={styles.primaryBtnTxt}>Send Code</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>
                }
              </TouchableOpacity>
            </View>
          )}

        {/* ── Phone: verify code ── */}
        {(authMode === "signin" || (authMode === "signup" && signupStep === "method")) &&
          method === "phone" && phoneStep === "verify" && (
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>Enter the 6-digit code</Text>
              <Text style={styles.hint}>Sent to {fullPhone}</Text>
              <TextInput
                style={[styles.phoneInput, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor={Colors.light.textTertiary}
                keyboardType="number-pad"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                autoFocus
                testID="auth-code-input"
              />
              <TouchableOpacity
                style={[styles.primaryBtn, (code.length < 6 || loading) && styles.btnDisabled]}
                onPress={handleVerifyCode}
                disabled={code.length < 6 || loading}
                testID="auth-verify-btn"
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <><Text style={styles.primaryBtnTxt}>Verify Code</Text><Ionicons name="checkmark" size={18} color="#fff" /></>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendBtn} onPress={handleSendCode} disabled={loading}>
                <Text style={styles.resendTxt}>Resend code</Text>
              </TouchableOpacity>
            </View>
          )}

        {/* ── Google ── */}
        {(authMode === "signin" || (authMode === "signup" && signupStep === "method")) &&
          method === "google" && (
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
            </View>
          )}

        {/* ── Apple (iOS only) ── */}
        {(authMode === "signin" || (authMode === "signup" && signupStep === "method")) &&
          method === "apple" && Platform.OS === "ios" && (
            <View style={styles.form}>
              <Text style={styles.hint}>
                {authMode === "signup"
                  ? "Use your Apple ID to create a SabiLab account"
                  : "Use your Apple ID to sign in"}
              </Text>
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

  // Mode selection
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

  tabs: { flexDirection: "row", backgroundColor: Colors.light.card, borderRadius: 14, padding: 4, gap: 4 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderRadius: 10, paddingVertical: 10,
  },
  tabActive: { backgroundColor: Colors.light.navy },
  tabTxt: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.textSecondary },
  tabTxtActive: { color: "#fff" },

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
  gradeBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.textSecondary },
  gradeBtnTxtActive: { color: "#fff" },

  phoneRow: { flexDirection: "row", gap: 8 },
  countryBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.light.card, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 16,
    borderWidth: 2, borderColor: Colors.light.border,
  },
  countryCode: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy },
  phoneInput: {
    flex: 1, height: 56,
    backgroundColor: Colors.light.card,
    borderRadius: 14, paddingHorizontal: 16,
    fontFamily: "Inter_500Medium", fontSize: 17,
    color: Colors.light.navy,
    borderWidth: 2, borderColor: Colors.light.border,
  },
  codeInput: { flex: 0, textAlign: "center", letterSpacing: 10, fontSize: 22 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.light.gold, borderRadius: 16, paddingVertical: 18,
    shadowColor: Colors.light.gold,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  primaryBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  btnDisabled: { opacity: 0.45 },

  socialBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    backgroundColor: Colors.light.card, borderRadius: 16, paddingVertical: 18,
    borderWidth: 2, borderColor: Colors.light.border,
  },
  socialBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },

  appleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    backgroundColor: "#000", borderRadius: 16, paddingVertical: 18,
  },
  appleBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },

  resendBtn: { alignItems: "center", paddingVertical: 4 },
  resendTxt: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary },

  footer: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: "rgba(255,255,255,0.55)", textAlign: "center",
    marginTop: 20, lineHeight: 18,
  },
});
