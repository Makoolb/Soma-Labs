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
import Colors, { OPTION_COLORS } from "@/constants/colors";
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

  function pick(arr: Question[], n: number, subject: "maths" | "english"): Question[] {
    const source = arr.length >= n ? arr : (all.filter((q) => q.subject === subject));
    return [...source].sort(() => Math.random() - 0.5).slice(0, n);
  }

  return [...pick(maths, 5, "maths"), ...pick(english, 5, "english")].sort(() => Math.random() - 0.5);
}

type Phase = "intro" | "quiz" | "done";

const LETTER = ["A", "B", "C", "D"];

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

  useEffect(() => {
    if (profile) setQuestions(pickDiagnosticQuestions(profile.grade));
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
      <View style={[styles.introContainer, { paddingTop: topPad }]}>
        <View style={styles.introHeader}>
          <View style={styles.introIconWrap}>
            <Ionicons name="clipboard" size={52} color="#fff" />
          </View>
          <Text style={styles.introTitle}>Diagnostic Test</Text>
          <Text style={styles.introSub}>
            Hi {profile?.name}! Let's find out your level with a quick 10-question quiz.
          </Text>
        </View>
        <ScrollView contentContainerStyle={[styles.introCards, { paddingBottom: bottomPad + 16 }]}>
          {[
            { icon: "help-circle", color: Colors.light.optionB, text: "10 questions — Maths & English" },
            { icon: "time", color: Colors.light.optionC, text: "Takes about 5–8 minutes" },
            { icon: "star", color: Colors.light.gold, text: "No pressure — just do your best!" },
          ].map((item) => (
            <View key={item.text} style={[styles.infoCard, { borderLeftColor: item.color }]}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
              <Text style={styles.infoText}>{item.text}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.orangeBtn} onPress={() => setPhase("quiz")}>
            <Text style={styles.orangeBtnText}>Start Test</Text>
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
      <View style={[styles.doneContainer, { paddingTop: topPad }]}>
        <View style={styles.doneHeader}>
          <View style={[styles.introIconWrap, { backgroundColor: Colors.light.sage }]}>
            <Ionicons name="checkmark-circle" size={52} color="#fff" />
          </View>
          <Text style={styles.introTitle}>Well done, {profile?.name}!</Text>
          <Text style={styles.doneScore}>{correct} / 10</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.introCards, { paddingBottom: bottomPad + 16 }]}>
          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <View style={[styles.subjectBadge, { backgroundColor: Colors.light.optionB }]}>
                <Text style={styles.subjectBadgeTxt}>Maths</Text>
              </View>
              <View style={styles.scoreBarWrap}>
                <View style={[styles.scoreBar, { width: `${mathsTotal > 0 ? (mathsCorrect / mathsTotal) * 100 : 0}%`, backgroundColor: Colors.light.optionB }]} />
              </View>
              <Text style={styles.scoreFrac}>{mathsCorrect}/{mathsTotal}</Text>
            </View>
            <View style={styles.scoreRow}>
              <View style={[styles.subjectBadge, { backgroundColor: Colors.light.rust }]}>
                <Text style={styles.subjectBadgeTxt}>English</Text>
              </View>
              <View style={styles.scoreBarWrap}>
                <View style={[styles.scoreBar, { width: `${engTotal > 0 ? (engCorrect / engTotal) * 100 : 0}%`, backgroundColor: Colors.light.rust }]} />
              </View>
              <Text style={styles.scoreFrac}>{engCorrect}/{engTotal}</Text>
            </View>
          </View>
          <Text style={styles.doneMsg}>
            {correct >= 7
              ? "Excellent! You have a strong foundation. We'll push you with higher-level challenges."
              : correct >= 4
              ? "Good start! We'll build on your strengths and strengthen your weak spots."
              : "No worries at all! SomaLabs will guide you step-by-step from the basics."}
          </Text>
          <TouchableOpacity
            style={styles.orangeBtn}
            onPress={() => router.replace("/(tabs)")}
            disabled={saving}
          >
            <Text style={styles.orangeBtnText}>Go to Dashboard</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const q = questions[current];
  if (!q) return null;
  const progress = (current + 1) / questions.length;
  const subjectColor = q.subject === "maths" ? Colors.light.optionB : Colors.light.rust;

  return (
    <View style={[styles.quizRoot, { paddingTop: topPad }]}>
      {/* Colored top strip */}
      <View style={[styles.quizTopBar, { backgroundColor: subjectColor }]}>
        <View style={styles.quizTopRow}>
          <View style={styles.qBadge}>
            <Text style={styles.qBadgeTxt}>Q{current + 1} of {questions.length}</Text>
          </View>
          <View style={[styles.subjectTag, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
            <Text style={styles.subjectTagTxt}>{q.subject === "maths" ? "Maths" : "English"}</Text>
          </View>
        </View>
        {/* Progress track */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.quizContent, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          {/* Question card */}
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{q.question}</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsList}>
            {q.options.map((opt, i) => {
              const optColor = OPTION_COLORS[i];
              const isSelected = selected === i;
              const isCorrect = i === q.correctIndex;

              let bg = Colors.light.card;
              let borderColor = Colors.light.border;
              let labelBg = optColor;
              let textColor = Colors.light.text;

              if (revealed) {
                if (isCorrect) {
                  bg = Colors.light.sageLight;
                  borderColor = Colors.light.sage;
                  labelBg = Colors.light.sage;
                  textColor = "#1A5E35";
                } else if (isSelected) {
                  bg = Colors.light.rustLight;
                  borderColor = Colors.light.rust;
                  labelBg = Colors.light.rust;
                  textColor = Colors.light.rust;
                }
              } else if (isSelected) {
                bg = optColor + "18";
                borderColor = optColor;
              }

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optionBtn, { backgroundColor: bg, borderColor }]}
                  onPress={() => handleSelect(i)}
                  disabled={revealed}
                  activeOpacity={0.78}
                >
                  <View style={[styles.optBadge, { backgroundColor: labelBg }]}>
                    <Text style={styles.optBadgeTxt}>{LETTER[i]}</Text>
                  </View>
                  <Text style={[styles.optText, { color: textColor }]}>{opt}</Text>
                  {revealed && isCorrect && <Ionicons name="checkmark-circle" size={22} color={Colors.light.sage} />}
                  {revealed && isSelected && !isCorrect && <Ionicons name="close-circle" size={22} color={Colors.light.rust} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Explanation */}
          {revealed && (
            <View style={styles.explainBox}>
              <Ionicons name="bulb" size={18} color={Colors.light.gold} />
              <Text style={styles.explainText}>{q.explanation}</Text>
            </View>
          )}

          {revealed && (
            <TouchableOpacity style={styles.orangeBtn} onPress={handleNext}>
              <Text style={styles.orangeBtnText}>
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
  introContainer: { flex: 1, backgroundColor: Colors.light.optionB },
  doneContainer: { flex: 1, backgroundColor: Colors.light.sage },
  introHeader: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 10,
  },
  introIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  introTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: "#fff",
    textAlign: "center",
  },
  introSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 22,
  },
  introCards: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 14,
    flexGrow: 1,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
  },
  infoText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.text, flex: 1 },
  orangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.gold,
    borderRadius: 18,
    paddingVertical: 18,
    marginTop: 4,
    shadowColor: Colors.light.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  orangeBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  doneHeader: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 8,
  },
  doneScore: {
    fontFamily: "Inter_700Bold",
    fontSize: 52,
    color: "#fff",
    lineHeight: 60,
  },
  doneMsg: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  scoreCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  subjectBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    width: 72,
    alignItems: "center",
  },
  subjectBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff" },
  scoreBarWrap: { flex: 1, height: 8, backgroundColor: Colors.light.border, borderRadius: 4, overflow: "hidden" },
  scoreBar: { height: "100%", borderRadius: 4 },
  scoreFrac: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.light.navy, width: 30, textAlign: "right" },
  quizRoot: { flex: 1, backgroundColor: Colors.light.background },
  quizTopBar: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 12, gap: 10 },
  quizTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  qBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  subjectTag: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  subjectTagTxt: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  progressTrack: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  quizContent: { padding: 16, gap: 14 },
  questionCard: {
    backgroundColor: Colors.light.cream,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: "#F0E8D8",
  },
  questionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.light.navy,
    lineHeight: 28,
  },
  optionsList: { gap: 10 },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    gap: 12,
  },
  optBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  optBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  optText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15, lineHeight: 22 },
  explainBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.light.goldLight,
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.gold,
    alignItems: "flex-start",
  },
  explainText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 21,
  },
});
