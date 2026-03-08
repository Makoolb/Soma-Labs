import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, type Grade, type Subject } from "@/context/AppContext";

const { width } = Dimensions.get("window");

const GRADES: { label: string; value: Grade; desc: string }[] = [
  { label: "P4", value: "P4", desc: "Primary 4" },
  { label: "P5", value: "P5", desc: "Primary 5" },
  { label: "P6", value: "P6", desc: "Primary 6" },
];

const SUBJECTS: { label: string; value: Subject; desc: string; color: string }[] = [
  { label: "Maths", value: "Maths", desc: "Numbers, shapes & problems", color: Colors.light.navy },
  { label: "English", value: "English", desc: "Grammar, reading & writing", color: Colors.light.rust },
  { label: "Both", value: "Both", desc: "Maths + English combined", color: Colors.light.sage },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { saveProfile } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function animateStep(next: number) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(next), 120);
    Haptics.selectionAsync();
  }

  async function finish() {
    if (!grade || !subject) return;
    setSaving(true);
    await saveProfile({ name: name.trim() || "Student", grade, subject });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/diagnostic");
  }

  const totalSteps = 3;

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      {/* Progress bar */}
      <View style={styles.progressRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressBar, { flex: 1 }, step > i ? styles.progressDone : step === i ? styles.progressActive : styles.progressInactive]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim }}>
          {step === 0 && (
            <View style={styles.stepWrap}>
              <View style={styles.logoMark}>
                <Ionicons name="school" size={48} color={Colors.light.navy} />
              </View>
              <Text style={styles.headline}>Welcome to{"\n"}SomaLabs</Text>
              <Text style={styles.body}>
                Your personal Common Entrance tutor for Maths and English. Let's get you set up in just 3 steps.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => animateStep(1)}>
                <Text style={styles.primaryBtnText}>Let's Begin</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepLabel}>Your name</Text>
              <Text style={styles.headline}>What should{"\n"}we call you?</Text>
              <Text style={styles.body}>Enter the student's first name so we can personalise the experience.</Text>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor={Colors.light.textTertiary}
                value={name}
                onChangeText={setName}
                maxLength={40}
                autoCapitalize="words"
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => name.trim() && animateStep(2)}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, !name.trim() && styles.btnDisabled]}
                onPress={() => name.trim() && animateStep(2)}
                disabled={!name.trim()}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepLabel}>Class level</Text>
              <Text style={styles.headline}>What class{"\n"}are you in?</Text>
              <Text style={styles.body}>This helps us set the right difficulty level for your questions.</Text>
              <View style={styles.cardRow}>
                {GRADES.map((g) => (
                  <TouchableOpacity
                    key={g.value}
                    style={[styles.gradeCard, grade === g.value && styles.gradeCardSelected]}
                    onPress={() => { Haptics.selectionAsync(); setGrade(g.value); }}
                  >
                    <Text style={[styles.gradeLabel, grade === g.value && styles.gradeLabelSelected]}>
                      {g.label}
                    </Text>
                    <Text style={[styles.gradeDesc, grade === g.value && styles.gradeDescSelected]}>
                      {g.desc}
                    </Text>
                    {grade === g.value && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, !grade && styles.btnDisabled]}
                onPress={() => grade && animateStep(3)}
                disabled={!grade}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepLabel}>Subjects</Text>
              <Text style={styles.headline}>What would you{"\n"}like to practise?</Text>
              <Text style={styles.body}>You can change this later. We recommend 'Both' for best exam results.</Text>
              <View style={styles.subjectList}>
                {SUBJECTS.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.subjectCard, subject === s.value && { borderColor: s.color, backgroundColor: s.color + "0F" }]}
                    onPress={() => { Haptics.selectionAsync(); setSubject(s.value); }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.subjectDot, { backgroundColor: s.color }]} />
                    <View style={styles.subjectText}>
                      <Text style={[styles.subjectLabel, subject === s.value && { color: s.color }]}>{s.label}</Text>
                      <Text style={styles.subjectDesc}>{s.desc}</Text>
                    </View>
                    {subject === s.value && (
                      <Ionicons name="checkmark-circle" size={22} color={s.color} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, (!subject || saving) && styles.btnDisabled]}
                onPress={finish}
                disabled={!subject || saving}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? "Setting up..." : "Start My Journey"}
                </Text>
                {!saving && <Ionicons name="rocket-outline" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  progressInactive: { backgroundColor: Colors.light.border },
  progressActive: { backgroundColor: Colors.light.navy },
  progressDone: { backgroundColor: Colors.light.sage },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  stepWrap: {
    gap: 20,
  },
  logoMark: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: Colors.light.navyLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.light.navy,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: Colors.light.navy,
    lineHeight: 38,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.light.textSecondary,
    lineHeight: 22,
  },
  input: {
    height: 56,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    paddingHorizontal: 18,
    fontFamily: "Inter_500Medium",
    fontSize: 17,
    color: Colors.light.navy,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  cardRow: {
    flexDirection: "row",
    gap: 10,
  },
  gradeCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.light.border,
    gap: 4,
  },
  gradeCardSelected: {
    borderColor: Colors.light.navy,
    backgroundColor: Colors.light.navyLight,
  },
  gradeLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.light.textSecondary,
  },
  gradeLabelSelected: {
    color: Colors.light.navy,
  },
  gradeDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textTertiary,
    textAlign: "center",
  },
  gradeDescSelected: {
    color: Colors.light.navy,
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.light.navy,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  subjectList: {
    gap: 10,
  },
  subjectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subjectText: {
    flex: 1,
    gap: 2,
  },
  subjectLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.light.navy,
  },
  subjectDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.navy,
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
});
