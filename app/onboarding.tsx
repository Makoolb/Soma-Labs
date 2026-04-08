import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, type Grade, type Subject } from "@/context/AppContext";

const GRADES: { label: string; value: Grade; desc: string; color: string }[] = [
  { label: "P4", value: "P4", desc: "Primary 4", color: Colors.light.optionB },
  { label: "P5", value: "P5", desc: "Primary 5", color: Colors.light.optionC },
  { label: "P6", value: "P6", desc: "Primary 6", color: Colors.light.rust },
];

const SUBJECTS: { label: string; value: Subject; desc: string; color: string; icon: string }[] = [
  { label: "Maths", value: "Maths", desc: "Numbers, shapes & problems", color: Colors.light.optionB, icon: "calculator" },
  { label: "English", value: "English", desc: "Grammar, reading & writing", color: Colors.light.rust, icon: "book" },
  { label: "Both", value: "Both", desc: "Maths + English combined", color: Colors.light.sage, icon: "school" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STEP_COLORS = [
  Colors.light.navy,
  Colors.light.optionB,
  Colors.light.optionC,
  Colors.light.rust,
  Colors.light.sage,
];

function defaultExamYear() {
  const now = new Date();
  return now.getMonth() < 3 ? now.getFullYear() : now.getFullYear() + 1;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { saveProfile } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [examMonth, setExamMonth] = useState<number | null>(3);
  const [examYear, setExamYear] = useState(defaultExamYear);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const headerColor = STEP_COLORS[step] ?? Colors.light.navy;

  function animateStep(next: number) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(next), 100);
    Haptics.selectionAsync();
  }

  async function finish(withDate: boolean) {
    if (!grade || !subject) return;
    setSaving(true);
    const examDate =
      withDate && examMonth !== null
        ? new Date(examYear, examMonth, 1).toISOString()
        : undefined;
    await saveProfile({ name: name.trim() || "Student", grade, subject, examDate });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/diagnostic");
  }

  const headerIcon =
    step === 0 ? "school"
    : step === 1 ? "person"
    : step === 2 ? "library"
    : step === 3 ? "book"
    : "calendar";

  const headerTitle =
    step === 0 ? "SabiLab"
    : step === 1 ? "Your Name"
    : step === 2 ? "Your Class"
    : step === 3 ? "Your Subject"
    : "Exam Date";

  const headerSub =
    step === 0 ? "Your Common Entrance tutor"
    : step === 1 ? "What should we call you?"
    : step === 2 ? "Which class are you in?"
    : step === 3 ? "What do you want to practise?"
    : "When is your Common Entrance exam?";

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Colored header band */}
      <View style={[styles.headerBand, { backgroundColor: headerColor }]}>
        <View style={styles.progressDots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                step === i ? styles.dotActive : step > i ? styles.dotDone : styles.dotInactive,
              ]}
            />
          ))}
        </View>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => animateStep(step - 1)}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={styles.headerIconWrap}>
          <Ionicons name={headerIcon as any} size={52} color="rgba(255,255,255,0.9)" />
        </View>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <Text style={styles.headerSub}>{headerSub}</Text>
      </View>

      {/* White sheet */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: bottomPad + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim, gap: 16 }}>
          {step === 0 && (
            <>
              <Text style={styles.bodyText}>
                SabiLab gives Nigerian Primary 4–6 students daily Maths and English practice tailored to the Common Entrance Exam. Set up in just 4 steps!
              </Text>
              <View style={styles.featureList}>
                {[
                  { icon: "checkmark-circle", color: Colors.light.sage, text: "Questions matched to your class level" },
                  { icon: "star", color: Colors.light.gold, text: "Earn XP and build streaks every day" },
                  { icon: "bar-chart", color: Colors.light.optionB, text: "Track your progress topic by topic" },
                  { icon: "calendar", color: Colors.light.rust, text: "Countdown tailored to your exam date" },
                ].map((f) => (
                  <View key={f.text} style={[styles.featureRow, { borderLeftColor: f.color }]}>
                    <Ionicons name={f.icon as any} size={20} color={f.color} />
                    <Text style={styles.featureText}>{f.text}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={[styles.bigBtn, { backgroundColor: headerColor }]} onPress={() => animateStep(1)}>
                <Text style={styles.bigBtnTxt}>Let's Begin</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}

          {step === 1 && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Enter first name"
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
                style={[styles.bigBtn, { backgroundColor: headerColor }, !name.trim() && styles.btnDisabled]}
                onPress={() => name.trim() && animateStep(2)}
                disabled={!name.trim()}
              >
                <Text style={styles.bigBtnTxt}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.gradeRow}>
                {GRADES.map((g) => {
                  const selected = grade === g.value;
                  return (
                    <TouchableOpacity
                      key={g.value}
                      style={[styles.gradeCard, selected && { borderColor: g.color, backgroundColor: g.color }]}
                      onPress={() => { Haptics.selectionAsync(); setGrade(g.value); }}
                    >
                      {selected && (
                        <View style={styles.gradeCheck}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                      <Text style={[styles.gradeLbl, selected && { color: "#fff" }]}>{g.label}</Text>
                      <Text style={[styles.gradeDesc, selected && { color: "rgba(255,255,255,0.85)" }]}>{g.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: headerColor }, !grade && styles.btnDisabled]}
                onPress={() => grade && animateStep(3)}
                disabled={!grade}
              >
                <Text style={styles.bigBtnTxt}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
            <>
              <View style={styles.subjectList}>
                {SUBJECTS.map((s) => {
                  const sel = subject === s.value;
                  return (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.subjectCard, sel && { borderColor: s.color, backgroundColor: s.color + "10" }]}
                      onPress={() => { Haptics.selectionAsync(); setSubject(s.value); }}
                    >
                      <View style={[styles.subjectIcon, { backgroundColor: sel ? s.color : s.color + "20" }]}>
                        <Ionicons name={s.icon as any} size={22} color={sel ? "#fff" : s.color} />
                      </View>
                      <View style={styles.subjectTxt}>
                        <Text style={[styles.subjectLbl, sel && { color: s.color }]}>{s.label}</Text>
                        <Text style={styles.subjectDesc}>{s.desc}</Text>
                      </View>
                      {sel && <Ionicons name="checkmark-circle" size={24} color={s.color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: headerColor }, !subject && styles.btnDisabled]}
                onPress={() => subject && animateStep(4)}
                disabled={!subject}
              >
                <Text style={styles.bigBtnTxt}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.examHint}>
                We'll use this to track your countdown and adjust your practice pace.
              </Text>

              {/* Year selector */}
              <View style={styles.yearRow}>
                <TouchableOpacity
                  style={styles.yearArrow}
                  onPress={() => { Haptics.selectionAsync(); setExamYear((y) => y - 1); }}
                >
                  <Ionicons name="chevron-back" size={20} color={Colors.light.navy} />
                </TouchableOpacity>
                <Text style={styles.yearTxt}>{examYear}</Text>
                <TouchableOpacity
                  style={styles.yearArrow}
                  onPress={() => { Haptics.selectionAsync(); setExamYear((y) => y + 1); }}
                >
                  <Ionicons name="chevron-forward" size={20} color={Colors.light.navy} />
                </TouchableOpacity>
              </View>

              {/* Month grid */}
              <View style={styles.monthGrid}>
                {MONTHS.map((m, i) => {
                  const sel = examMonth === i;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.monthCell, sel && { backgroundColor: Colors.light.sage, borderColor: Colors.light.sage }]}
                      onPress={() => { Haptics.selectionAsync(); setExamMonth(i); }}
                    >
                      <Text style={[styles.monthTxt, sel && { color: "#fff", fontFamily: "Inter_700Bold" }]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: Colors.light.sage }, saving && styles.btnDisabled]}
                onPress={() => finish(true)}
                disabled={saving}
              >
                <Text style={styles.bigBtnTxt}>{saving ? "Setting up..." : "Start My Journey"}</Text>
                {!saving && <Ionicons name="rocket-outline" size={18} color="#fff" />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={() => finish(false)} disabled={saving}>
                <Text style={styles.skipTxt}>Skip for now</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  headerBand: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    alignItems: "center",
    gap: 6,
  },
  progressDots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    alignSelf: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.3)" },
  dotActive: { backgroundColor: "#fff", width: 24 },
  dotDone: { backgroundColor: "rgba(255,255,255,0.7)" },
  backBtn: {
    position: "absolute",
    left: 16,
    top: 40,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff" },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center" },
  sheet: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -16,
  },
  sheetContent: { padding: 24 },
  bodyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.light.textSecondary,
    lineHeight: 24,
  },
  featureList: { gap: 10 },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
  },
  featureText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.text, flex: 1 },
  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.35 },
  bigBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  input: {
    height: 60,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    paddingHorizontal: 18,
    fontFamily: "Inter_500Medium",
    fontSize: 18,
    color: Colors.light.navy,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  gradeRow: { flexDirection: "row", gap: 10 },
  gradeCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: Colors.light.border,
    gap: 4,
  },
  gradeCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 8,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  gradeLbl: { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.light.textSecondary },
  gradeDesc: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textTertiary, textAlign: "center" },
  subjectList: { gap: 12 },
  subjectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 2.5,
    borderColor: Colors.light.border,
  },
  subjectIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  subjectTxt: { flex: 1, gap: 2 },
  subjectLbl: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
  subjectDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  // Exam date step
  examHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    paddingVertical: 14,
  },
  yearArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.background,
    justifyContent: "center",
    alignItems: "center",
  },
  yearTxt: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.light.navy, minWidth: 70, textAlign: "center" },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  monthCell: {
    width: "22%",
    flexGrow: 1,
    paddingVertical: 14,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  monthTxt: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.text },
  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipTxt: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary },
});
