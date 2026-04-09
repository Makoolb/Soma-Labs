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
import { useApp } from "@/context/AppContext";

type AuthMethod = "phone" | "google" | "apple";
type PhoneStep = "enter" | "verify" | "profile";

type ClerkError = { code?: string; longMessage?: string; message?: string };
type ClerkErrorResponse = { errors?: ClerkError[] };

type PhoneCodeFactor = { strategy: "phone_code"; phoneNumberId: string };

const GRADES = ["P4", "P5", "P6"] as const;
type Grade = typeof GRADES[number];

function extractErrorMessage(err: unknown): string {
  const e = err as ClerkErrorResponse;
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

function extractErrorCode(err: unknown): string {
  const e = err as ClerkErrorResponse;
  return e?.errors?.[0]?.code ?? "";
}

const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+1", label: "United States (+1)" },
];

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { signIn, isLoaded: signInLoaded, setActive: setSignInActive } = useSignIn();
  const { signUp, isLoaded: signUpLoaded, setActive: setSignUpActive } = useSignUp();
  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startApple } = useOAuth({ strategy: "oauth_apple" });
  const { saveProfile } = useApp();

  const [method, setMethod] = useState<AuthMethod>("phone");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("enter");
  const [countryIdx, setCountryIdx] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  // Profile collection (sign-up only)
  const [newUserName, setNewUserName] = useState("");
  const [newUserGrade, setNewUserGrade] = useState<Grade | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<"signIn" | "signUp" | null>(null);

  const country = COUNTRY_CODES[countryIdx] ?? COUNTRY_CODES[0];
  const fullPhone = country.code + phone.trim().replace(/^0+/, "");

  function switchMethod(m: AuthMethod) {
    Haptics.selectionAsync();
    setMethod(m);
    setError(null);
    setPhoneStep("enter");
    setCode("");
  }

  async function handleSendCode() {
    if (!phone.trim() || !signInLoaded || !signUpLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const attempt = await signIn!.create({ identifier: fullPhone });
      const factor = attempt.supportedFirstFactors?.find(
        (f) => f.strategy === "phone_code"
      ) as PhoneCodeFactor | undefined;
      if (factor) {
        await signIn!.prepareFirstFactor({ strategy: "phone_code", phoneNumberId: factor.phoneNumberId });
        setPendingVerification("signIn");
        setPhoneStep("verify");
      } else {
        setError("Phone sign-in is not available. Please use Google or Apple.");
      }
    } catch (signInErr: unknown) {
      const errCode = extractErrorCode(signInErr);
      if (errCode === "form_identifier_not_found" || errCode === "form_identifier_exists") {
        try {
          await signUp!.create({ phoneNumber: fullPhone });
          await signUp!.preparePhoneNumberVerification({ strategy: "phone_code" });
          setPendingVerification("signUp");
          setPhoneStep("verify");
        } catch (signUpErr: unknown) {
          setError(extractErrorMessage(signUpErr));
        }
      } else {
        setError(extractErrorMessage(signInErr));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (code.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      if (pendingVerification === "signIn") {
        const result = await signIn!.attemptFirstFactor({ strategy: "phone_code", code });
        if (result.status === "complete") {
          await setSignInActive!({ session: result.createdSessionId });
          router.replace("/");
        }
      } else {
        // Sign-up: collect name + grade before activating session
        const result = await signUp!.attemptPhoneNumberVerification({ code });
        if (result.status === "complete" && result.createdSessionId) {
          setPendingSessionId(result.createdSessionId);
          setPhoneStep("profile");
        }
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteProfile() {
    if (!newUserName.trim() || !newUserGrade || !pendingSessionId) return;
    setLoading(true);
    setError(null);
    try {
      await saveProfile({
        name: newUserName.trim(),
        grade: newUserGrade,
        subject: "Both",
        createdAt: new Date().toISOString(),
      });
      await setSignUpActive!({ session: pendingSessionId });
      router.replace("/");
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startGoogle();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
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
        router.replace("/");
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
          {phoneStep === "profile"
            ? "One last step — set up your profile"
            : "Sign in to save your progress across devices"}
        </Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        {/* Method Tabs — hidden during profile step */}
        {phoneStep !== "profile" && (
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

        {/* Error banner */}
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={16} color={Colors.light.rust} />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        ) : null}

        {/* ── Phone: enter number ── */}
        {method === "phone" && phoneStep === "enter" && (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <TouchableOpacity
                style={styles.countryBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setCountryIdx((i) => (i + 1) % COUNTRY_CODES.length);
                }}
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
              />
            </View>
            <Text style={styles.hint}>{country.label} — we'll send a 6-digit code</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, (!phone.trim() || loading) && styles.btnDisabled]}
              onPress={handleSendCode}
              disabled={!phone.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <><Text style={styles.primaryBtnTxt}>Send Code</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phone: verify code ── */}
        {method === "phone" && phoneStep === "verify" && (
          <View style={styles.form}>
            <TouchableOpacity style={styles.backRow} onPress={() => { setPhoneStep("enter"); setCode(""); setError(null); }}>
              <Ionicons name="arrow-back" size={18} color={Colors.light.navy} />
              <Text style={styles.backTxt}>Back</Text>
            </TouchableOpacity>
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
            />
            <TouchableOpacity
              style={[styles.primaryBtn, (code.length < 6 || loading) && styles.btnDisabled]}
              onPress={handleVerifyCode}
              disabled={code.length < 6 || loading}
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

        {/* ── Phone sign-up: profile step ── */}
        {method === "phone" && phoneStep === "profile" && (
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
            />
            <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Your Class</Text>
            <View style={styles.gradeRow}>
              {GRADES.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.gradeBtn, newUserGrade === g && styles.gradeBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setNewUserGrade(g); }}
                >
                  <Text style={[styles.gradeBtnTxt, newUserGrade === g && styles.gradeBtnTxtActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>You can change these later in your profile</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, (!newUserName.trim() || !newUserGrade || loading) && styles.btnDisabled]}
              onPress={handleCompleteProfile}
              disabled={!newUserName.trim() || !newUserGrade || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <><Text style={styles.primaryBtnTxt}>Start Learning</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── Google ── */}
        {method === "google" && phoneStep !== "profile" && (
          <View style={styles.form}>
            <Text style={styles.hint}>Use your Google account to sign in or create a SabiLab account</Text>
            <TouchableOpacity
              style={[styles.socialBtn, loading && styles.btnDisabled]}
              onPress={handleGoogleAuth}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.light.navy} />
                : <><Ionicons name="logo-google" size={20} color="#EA4335" /><Text style={styles.socialBtnTxt}>Continue with Google</Text></>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── Apple (iOS only) ── */}
        {method === "apple" && Platform.OS === "ios" && phoneStep !== "profile" && (
          <View style={styles.form}>
            <Text style={styles.hint}>Use your Apple ID to sign in or create a SabiLab account</Text>
            <TouchableOpacity
              style={[styles.appleBtn, loading && styles.btnDisabled]}
              onPress={handleAppleAuth}
              disabled={loading}
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

  backRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  backTxt: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.navy },

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
