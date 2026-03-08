import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
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
import { useApp } from "@/context/AppContext";
import questionsData from "@/data/questions.json";

interface Question {
  id: string;
  subject: "maths" | "english";
  grade: string;
  topic: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

function pickDiagnosticQuestions(grade: string): Question[] {
  const all = questionsData as Question[];
  const gradeQs = all.filter((q) => q.grade === grade);
  const maths = gradeQs.filter((q) => q.subject === "maths");
  const english = gradeQs.filter((q) => q.subject === "english");
  const fallback = all;

  function pick(arr: Question[], n: number): Question[] {
    const source = arr.length >= n ? arr : fallback.filter((q) => q.subject === arr[0]?.subject ?? "maths");
    return [...source].sort(() => Math.random() - 0.5).slice(0, n);
  }

  return [...pick(maths, 5), ...pick(english, 5)].sort(() => Math.random() - 0.5);
}

type Phase = "intro" | "quiz" | "done";

export default function DiagnosticScreen() {
  const insets = useSafeAreaInsets();
  const { profile, saveDiagnosticResult } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<{ correct: boolean; subject: "maths" | "english" }[]>([]);
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const topPadTotal = topPad;

  useEffect(() => {
    if (profile) {
      setQuestions(pickDiagnosticQuestions(profile.grade));
    }
  }, [profile]);

  function animateNext() {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 30, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  function handleSelect(idx: number) {
    if (revealed) return;
    Haptics.selectionAsync();
    setSelected(idx);
    setRevealed(true);
    const q = questions[current];
    setAnswers((prev) => [...prev, { correct: idx === q.correctIndex, subject: q.subject }]);
  }

  function handleNext() {
    Haptics.selectionAsync();
    animateNext();
    if (current + 1 >= questions.length) {
      finishDiagnostic();
    } else {
      setTimeout(() => {
        setCurrent((c) => c + 1);
        setSelected(null);
        setRevealed(false);
      }, 120);
    }
  }

  async function finishDiagnostic() {
    setSaving(true);
    const mathsAnswers = answers.filter((a) => a.subject === "maths");
    const englishAnswers = answers.filter((a) => a.subject === "english");
    await saveDiagnosticResult({
      date: new Date().toISOString(),
      mathsScore: mathsAnswers.filter((a) => a.correct).length,
      mathsTotal: mathsAnswers.length,
      englishScore: englishAnswers.filter((a) => a.correct).length,
      englishTotal: englishAnswers.length,
    });
    setSaving(false);
    setPhase("done");
  }

  if (phase === "intro") {
    return (
      <View style={[styles.container, { paddingTop: topPadTotal + 16, paddingBottom: bottomPad }]}>
        <ScrollView contentContainerStyle={styles.introContent}>
          <View style={styles.iconRing}>
            <Ionicons name="clipboard-outline" size={48} color={Colors.light.gold} />
          </View>
          <Text style={styles.introTitle}>Quick Diagnostic</Text>
          <Text style={styles.introSub}>
            Hi {profile?.name}! Before we start, let's do a short 10-question quiz so SomaLabs can measure your current level and build the perfect practice plan for you.
          </Text>
          <View style={styles.infoCards}>
            {[
              { icon: "help-circle-outline", text: "10 questions — Maths & English" },
              { icon: "time-outline", text: "Takes about 5–8 minutes" },
              { icon: "bar-chart-outline", text: "No pressure — just do your best!" },
            ].map((item) => (
              <View key={item.text} style={styles.infoCard}>
                <Ionicons name={item.icon as any} size={20} color={Colors.light.navy} />
                <Text style={styles.infoText}>{item.text}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={() => setPhase("quiz")}>
            <Text style={styles.startBtnText}>Start Diagnostic</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (phase === "done") {
    const correct = answers.filter((a) => a.correct).length;
    const mathsCorrect = answers.filter((a) => a.correct && a.subject === "maths").length;
    const engCorrect = answers.filter((a) => a.correct && a.subject === "english").length;
    const mathsTotal = answers.filter((a) => a.subject === "maths").length;
    const engTotal = answers.filter((a) => a.subject === "english").length;

    return (
      <View style={[styles.container, { paddingTop: topPadTotal + 16, paddingBottom: bottomPad }]}>
        <ScrollView contentContainerStyle={styles.introContent}>
          <View style={[styles.iconRing, { backgroundColor: Colors.light.sageLight }]}>
            <Ionicons name="checkmark-circle" size={52} color={Colors.light.sage} />
          </View>
          <Text style={styles.introTitle}>Diagnostic Done!</Text>
          <Text style={styles.introSub}>
            Great effort, {profile?.name}! You scored {correct}/10. Here's your starting profile:
          </Text>
          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <View style={[styles.scoreDot, { backgroundColor: Colors.light.navy }]} />
              <Text style={styles.scoreLabel}>Maths</Text>
              <Text style={styles.scoreValue}>{mathsCorrect}/{mathsTotal}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.scoreRow}>
              <View style={[styles.scoreDot, { backgroundColor: Colors.light.rust }]} />
              <Text style={styles.scoreLabel}>English</Text>
              <Text style={styles.scoreValue}>{engCorrect}/{engTotal}</Text>
            </View>
          </View>
          <Text style={styles.introSub}>
            {correct >= 7
              ? "Excellent! You have a strong foundation. We'll push you with higher-level challenges."
              : correct >= 4
              ? "Good start! We'll build on your strengths and strengthen your weak spots."
              : "No worries at all! SomaLabs will guide you step-by-step from the basics."}
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => router.replace("/(tabs)")}
            disabled={saving}
          >
            <Text style={styles.startBtnText}>Go to My Dashboard</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const q = questions[current];
  if (!q) return null;

  const progress = (current + 1) / questions.length;
  const subjectColor = q.subject === "maths" ? Colors.light.navy : Colors.light.rust;

  return (
    <View style={[styles.container, { paddingTop: topPadTotal + 8, paddingBottom: bottomPad }]}>
      {/* Header */}
      <View style={styles.quizHeader}>
        <View style={styles.qCounter}>
          <Text style={styles.qNum}>Q{current + 1}</Text>
          <Text style={styles.qTotal}>of {questions.length}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={[styles.subjectPill, { backgroundColor: subjectColor + "18" }]}>
          <Text style={[styles.subjectPillText, { color: subjectColor }]}>
            {q.subject === "maths" ? "Maths" : "English"}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          {/* Question */}
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{q.question}</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsList}>
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect = i === q.correctIndex;
              let bg = Colors.light.card;
              let border = Colors.light.border;
              let textColor = Colors.light.text;

              if (revealed) {
                if (isCorrect) { bg = Colors.light.sageLight; border = Colors.light.sage; textColor = Colors.light.sage; }
                else if (isSelected && !isCorrect) { bg = Colors.light.rustLight; border = Colors.light.rust; textColor = Colors.light.rust; }
              } else if (isSelected) {
                bg = Colors.light.navyLight;
                border = Colors.light.navy;
                textColor = Colors.light.navy;
              }

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
                  onPress={() => handleSelect(i)}
                  disabled={revealed}
                  activeOpacity={0.82}
                >
                  <View style={[styles.optionLabel, { backgroundColor: border + "30" }]}>
                    <Text style={[styles.optionLabelText, { color: textColor }]}>
                      {String.fromCharCode(65 + i)}
                    </Text>
                  </View>
                  <Text style={[styles.optionText, { color: textColor }]}>{opt}</Text>
                  {revealed && isCorrect && <Ionicons name="checkmark-circle" size={20} color={Colors.light.sage} />}
                  {revealed && isSelected && !isCorrect && <Ionicons name="close-circle" size={20} color={Colors.light.rust} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Explanation */}
          {revealed && (
            <View style={[styles.explanationBox, { borderColor: selected === q.correctIndex ? Colors.light.sage : Colors.light.gold }]}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.light.gold} style={{ marginTop: 1 }} />
              <Text style={styles.explanationText}>{q.explanation}</Text>
            </View>
          )}

          {revealed && (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>
                {current + 1 >= questions.length ? "See My Results" : "Next Question"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  introContent: { flexGrow: 1, padding: 24, gap: 20, justifyContent: "center" },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.light.goldLight,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  introTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.light.navy,
    textAlign: "center",
  },
  introSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  infoCards: { gap: 10 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
  },
  infoText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.text },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.navy,
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 4,
  },
  startBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
  scoreCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 20,
    gap: 12,
    alignSelf: "stretch",
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreDot: { width: 10, height: 10, borderRadius: 5 },
  scoreLabel: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.light.text, flex: 1 },
  scoreValue: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.navy },
  divider: { height: 1, backgroundColor: Colors.light.border },
  quizHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  qCounter: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  qNum: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
  qTotal: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textTertiary },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: Colors.light.gold, borderRadius: 3 },
  subjectPill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subjectPillText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  quizContent: { padding: 16, gap: 14, paddingBottom: 32 },
  questionCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.gold,
  },
  questionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.light.navy,
    lineHeight: 26,
  },
  optionsList: { gap: 10 },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    gap: 12,
  },
  optionLabel: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  optionLabelText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  optionText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15, lineHeight: 21 },
  explanationBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.light.goldLight,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    alignItems: "flex-start",
  },
  explanationText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 21,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.navy,
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 4,
  },
  nextBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
});
