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
import { useApp, type SkillMap } from "@/context/AppContext";
import diagData from "@/data/diagnosticQuestions.json";

interface DiagQuestion {
  id: string;
  grade: string;
  subtopic: string;
  topic: string;
  difficulty: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const LETTER = ["A", "B", "C", "D"];
const SESSION_SIZE = 20;

// Pick 20 questions with balanced topic coverage
function pickQuestions(grade: string): DiagQuestion[] {
  const pool: DiagQuestion[] = ((diagData as Record<string, DiagQuestion[]>)[grade] ?? []);
  if (pool.length === 0) return [];

  // Group by topic
  const byTopic: Record<string, DiagQuestion[]> = {};
  for (const q of pool) {
    if (!byTopic[q.topic]) byTopic[q.topic] = [];
    byTopic[q.topic].push(q);
  }

  const selected: DiagQuestion[] = [];
  const used = new Set<string>();

  // 1. Pick 1 from each topic first (shuffle within topic)
  for (const topicQs of Object.values(byTopic)) {
    const shuffled = [...topicQs].sort(() => Math.random() - 0.5);
    const pick = shuffled[0];
    if (pick) { selected.push(pick); used.add(pick.id); }
  }

  // 2. Fill remaining slots from the full pool (not yet used)
  const remaining = pool.filter((q) => !used.has(q.id)).sort(() => Math.random() - 0.5);
  for (const q of remaining) {
    if (selected.length >= SESSION_SIZE) break;
    selected.push(q);
    used.add(q.id);
  }

  // Shuffle final order
  return selected.slice(0, SESSION_SIZE).sort(() => Math.random() - 0.5);
}

type Phase = "intro" | "quiz" | "calculating";
type AnswerState = "unanswered" | "wrong" | "retry_correct" | "retry_wrong_again" | "correct_first";

function ExplanationSteps({ text }: { text: string }) {
  const steps = text.split("\n").filter((s) => s.trim().length > 0);
  return (
    <View style={explainSt.wrap}>
      {steps.map((step, i) => {
        const isCheck = step.startsWith("✓");
        return (
          <View key={i} style={explainSt.step}>
            {isCheck ? (
              <Ionicons name="checkmark-circle" size={16} color={Colors.light.sage} style={{ marginTop: 2 }} />
            ) : (
              <View style={[explainSt.dot, { backgroundColor: OPTION_COLORS[i % 4] }]} />
            )}
            <Text style={[explainSt.stepText, isCheck && explainSt.checkText]}>
              {step.replace(/^✓\s*/, "")}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const explainSt = StyleSheet.create({
  wrap: { gap: 10 },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7, flexShrink: 0 },
  stepText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.text, lineHeight: 21 },
  checkText: { color: Colors.light.sage, fontFamily: "Inter_500Medium" },
});

interface QuizResult {
  topic: string;
  correct: boolean;
}

export default function DiagnosticScreen() {
  const insets = useSafeAreaInsets();
  const { profile, saveDiagnosticResult, saveSkillMap } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<DiagQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [retrySelected, setRetrySelected] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("unanswered");
  const [results, setResults] = useState<QuizResult[]>([]);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const explainFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (profile) setQuestions(pickQuestions(profile.grade));
  }, [profile]);

  function animateExplain() {
    explainFade.setValue(0);
    Animated.timing(explainFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }

  function handleFirstSelect(idx: number) {
    if (answerState !== "unanswered") return;
    Haptics.selectionAsync();
    const q = questions[current];
    const isCorrect = idx === q.correctIndex;
    setSelected(idx);
    if (isCorrect) {
      setAnswerState("correct_first");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResults((prev) => [...prev, { topic: q.topic, correct: true }]);
    } else {
      setAnswerState("wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setResults((prev) => [...prev, { topic: q.topic, correct: false }]);
    }
    animateExplain();
  }

  function handleRetry(idx: number) {
    const q = questions[current];
    if (idx === selected) return;
    Haptics.selectionAsync();
    setRetrySelected(idx);
    if (idx === q.correctIndex) {
      setAnswerState("retry_correct");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setAnswerState("retry_wrong_again");
    }
  }

  async function handleNext() {
    Haptics.selectionAsync();
    if (current + 1 >= questions.length) {
      await finishDiagnostic();
      return;
    }
    Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }).start(() => {
      slideAnim.setValue(20);
      setCurrent((c) => c + 1);
      setSelected(null);
      setRetrySelected(null);
      setAnswerState("unanswered");
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
  }

  async function finishDiagnostic() {
    setPhase("calculating");

    // Build skillMap: topic → percentage (0–100)
    const topicCorrect: Record<string, number> = {};
    const topicTotal: Record<string, number> = {};
    for (const r of results) {
      topicTotal[r.topic] = (topicTotal[r.topic] ?? 0) + 1;
      if (r.correct) topicCorrect[r.topic] = (topicCorrect[r.topic] ?? 0) + 1;
    }
    const skillMap: SkillMap = {};
    for (const topic of Object.keys(topicTotal)) {
      skillMap[topic] = Math.round(((topicCorrect[topic] ?? 0) / topicTotal[topic]) * 100);
    }

    // Save diagnostic result (for legacy home screen baseline display)
    const totalCorrect = results.filter((r) => r.correct).length;
    await saveDiagnosticResult({
      date: new Date().toISOString(),
      mathsScore: totalCorrect,
      mathsTotal: results.length,
      englishScore: 0,
      englishTotal: 0,
    });

    // Save skillMap — this triggers home screen notification
    await saveSkillMap(skillMap);

    router.replace("/(tabs)");
  }

  // ─── INTRO ──────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <View style={[styles.introRoot, { paddingTop: topPad }]}>
        <View style={styles.introHero}>
          <View style={styles.introIconWrap}>
            <Ionicons name="clipboard" size={52} color="#fff" />
          </View>
          <Text style={styles.introTitle}>Diagnostic Test</Text>
          <Text style={styles.introSub}>
            Hi {profile?.name}! Let's map your strengths and weaknesses with a 20-question quiz across all core topics.
          </Text>
        </View>
        <ScrollView contentContainerStyle={[styles.introBody, { paddingBottom: bottomPad + 16 }]}>
          {[
            { icon: "help-circle" as const, color: Colors.light.optionB, text: "20 questions across all major topics" },
            { icon: "map" as const, color: Colors.light.optionC, text: "Creates your personal Skill Map after the test" },
            { icon: "time" as const, color: Colors.light.gold, text: "Takes about 15–20 minutes" },
            { icon: "bulb" as const, color: Colors.light.sage, text: "Wrong answers show a step-by-step explanation — then you try again!" },
          ].map((item) => (
            <View key={item.text} style={[styles.infoCard, { borderLeftColor: item.color }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
              <Text style={styles.infoText}>{item.text}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setPhase("quiz")}>
            <Text style={styles.primaryBtnText}>Start Diagnostic Test</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── CALCULATING ────────────────────────────────────────────────────
  if (phase === "calculating") {
    return (
      <View style={[styles.calcRoot, { paddingTop: topPad }]}>
        <View style={styles.calcIcon}>
          <Ionicons name="map" size={52} color="#fff" />
        </View>
        <Text style={styles.calcTitle}>Building your Skill Map...</Text>
        <Text style={styles.calcSub}>Analysing {results.length} answers across all topics</Text>
      </View>
    );
  }

  // ─── QUIZ ────────────────────────────────────────────────────────────
  const q = questions[current];
  if (!q) return null;

  const isWrong = answerState === "wrong";
  const isCorrect = answerState === "correct_first";
  const retryCorrect = answerState === "retry_correct";
  const retryWrongAgain = answerState === "retry_wrong_again";
  const showRetry = isWrong;
  const showNext = isCorrect || retryCorrect || retryWrongAgain;
  const revealed = answerState !== "unanswered";
  const progress = (current + 1) / questions.length;

  return (
    <View style={[styles.quizRoot, { paddingTop: topPad }]}>
      {/* Header bar */}
      <View style={styles.quizBar}>
        <View style={styles.quizBarTop}>
          <View style={styles.qBadge}>
            <Text style={styles.qBadgeTxt}>{current + 1} / {questions.length}</Text>
          </View>
          <View style={styles.topicPill}>
            <Text style={styles.topicPillTxt}>{q.topic}</Text>
          </View>
          <View style={[styles.diffPill, {
            backgroundColor:
              q.difficulty === "Regular" ? "rgba(255,255,255,0.18)" :
                q.difficulty === "Hard" ? Colors.light.gold + "60" : Colors.light.rust + "60",
          }]}>
            <Text style={styles.diffPillTxt}>{q.difficulty}</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.quizScroll, { paddingBottom: bottomPad + 20 }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ transform: [{ translateY: slideAnim }], gap: 14 }}>
          {/* Question card */}
          <View style={styles.questionCard}>
            <Text style={styles.subtopicLabel}>{q.subtopic}</Text>
            <Text style={styles.questionText}>{q.question}</Text>
          </View>

          {/* Options */}
          <View style={styles.options}>
            {q.options.map((opt, i) => {
              const optColor = OPTION_COLORS[i];
              const isSelected = selected === i;
              const isCorrAns = i === q.correctIndex;

              let bg = Colors.light.card;
              let borderColor = Colors.light.border;
              let labelBg = optColor;
              let textColor = Colors.light.text;
              let touchDisabled = revealed;

              if (showRetry) touchDisabled = i === selected;

              if (!revealed) {
                if (isSelected) { bg = optColor + "18"; borderColor = optColor; }
              } else if (showRetry) {
                if (isSelected) { bg = "#F5F5F5"; borderColor = "#CCC"; labelBg = "#AAA"; textColor = "#999"; }
              } else {
                if (isCorrAns) { bg = Colors.light.sageLight; borderColor = Colors.light.sage; labelBg = Colors.light.sage; textColor = "#1A5E35"; }
                else if (isSelected && !isCorrAns) { bg = Colors.light.rustLight; borderColor = Colors.light.rust; labelBg = Colors.light.rust; textColor = Colors.light.rust; }
              }

              if ((retryCorrect || retryWrongAgain) && retrySelected !== null) {
                if (isCorrAns) { bg = Colors.light.sageLight; borderColor = Colors.light.sage; labelBg = Colors.light.sage; textColor = "#1A5E35"; }
                else if (retrySelected === i && !isCorrAns) { bg = Colors.light.rustLight; borderColor = Colors.light.rust; labelBg = Colors.light.rust; textColor = Colors.light.rust; }
                else if (isSelected) { bg = "#F5F5F5"; borderColor = "#CCC"; labelBg = "#AAA"; textColor = "#999"; }
              }

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optBtn, { backgroundColor: bg, borderColor },
                    touchDisabled && !showRetry && styles.optDisabled]}
                  onPress={() => {
                    if (!revealed) handleFirstSelect(i);
                    else if (showRetry && i !== selected) handleRetry(i);
                  }}
                  disabled={touchDisabled && !showRetry}
                  activeOpacity={touchDisabled && !showRetry ? 1 : 0.78}
                >
                  <View style={[styles.optBadge, { backgroundColor: labelBg }]}>
                    <Text style={styles.optBadgeTxt}>{LETTER[i]}</Text>
                  </View>
                  <Text style={[styles.optText, { color: textColor }]}>{opt}</Text>
                  {(retryCorrect || isCorrect) && isCorrAns && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.light.sage} />
                  )}
                  {retryWrongAgain && retrySelected === i && (
                    <Ionicons name="close-circle" size={22} color={Colors.light.rust} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Explanation section */}
          {revealed && (
            <Animated.View style={{ opacity: explainFade, gap: 14 }}>
              {isWrong && (
                <View style={styles.wrongBanner}>
                  <Ionicons name="close-circle" size={20} color={Colors.light.rust} />
                  <Text style={styles.wrongBannerText}>Not quite — let's understand why!</Text>
                </View>
              )}
              {isCorrect && (
                <View style={styles.correctBanner}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.light.sage} />
                  <Text style={styles.correctBannerText}>Correct! Well done!</Text>
                </View>
              )}
              {retryCorrect && (
                <View style={styles.correctBanner}>
                  <Ionicons name="star" size={20} color={Colors.light.gold} />
                  <Text style={styles.correctBannerText}>You've got it now! Great recovery!</Text>
                </View>
              )}
              {retryWrongAgain && (
                <View style={styles.wrongBanner}>
                  <Ionicons name="alert-circle" size={20} color={Colors.light.rust} />
                  <Text style={styles.wrongBannerText}>Still incorrect — the correct answer is highlighted above.</Text>
                </View>
              )}

              <View style={styles.explainCard}>
                <View style={styles.explainHeader}>
                  <Ionicons name="bulb" size={18} color={Colors.light.gold} />
                  <Text style={styles.explainTitle}>
                    {isCorrect ? "Why this is correct" : "Here's how to solve it"}
                  </Text>
                </View>
                <ExplanationSteps text={q.explanation} />
              </View>

              {showRetry && (
                <View style={styles.retryCard}>
                  <Text style={styles.retryTitle}>Now you try!</Text>
                  <Text style={styles.retrySub}>Tap the correct answer above to show you understand.</Text>
                </View>
              )}

              {showNext && (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
                  <Text style={styles.primaryBtnText}>
                    {current + 1 >= questions.length ? "Build My Skill Map" : "Next Question"}
                  </Text>
                  <Ionicons name={current + 1 >= questions.length ? "map" : "arrow-forward"} size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Intro
  introRoot: { flex: 1, backgroundColor: Colors.light.navy },
  introHero: { alignItems: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28, gap: 10 },
  introIconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  introTitle: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff", textAlign: "center" },
  introSub: { fontFamily: "Inter_400Regular", fontSize: 15, color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 22 },
  introBody: {
    backgroundColor: Colors.light.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, gap: 14, flexGrow: 1,
  },
  infoCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderLeftWidth: 4,
  },
  infoText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.text, flex: 1 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.light.gold, borderRadius: 18, paddingVertical: 18,
    shadowColor: Colors.light.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },

  // Calculating
  calcRoot: {
    flex: 1, backgroundColor: Colors.light.navy,
    justifyContent: "center", alignItems: "center", gap: 16, padding: 32,
  },
  calcIcon: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
  },
  calcTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff", textAlign: "center" },
  calcSub: { fontFamily: "Inter_400Regular", fontSize: 15, color: "rgba(255,255,255,0.75)", textAlign: "center" },

  // Quiz
  quizRoot: { flex: 1, backgroundColor: Colors.light.background },
  quizBar: { backgroundColor: Colors.light.navy, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 12, gap: 10 },
  quizBarTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  qBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  qBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  topicPill: { flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  topicPillTxt: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#fff" },
  diffPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  diffPillTxt: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#fff" },
  progressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.light.gold, borderRadius: 4 },
  quizScroll: { padding: 16 },
  questionCard: { backgroundColor: Colors.light.cream, borderRadius: 20, padding: 20, borderWidth: 2, borderColor: "#F0E8D8", gap: 6 },
  subtopicLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.light.gold, textTransform: "uppercase", letterSpacing: 1 },
  questionText: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: Colors.light.navy, lineHeight: 27 },
  options: { gap: 10 },
  optBtn: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 14, borderWidth: 2, gap: 12 },
  optDisabled: {},
  optBadge: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  optBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  optText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15, lineHeight: 22 },
  wrongBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.light.rustLight, borderRadius: 14, padding: 14,
    borderLeftWidth: 4, borderLeftColor: Colors.light.rust,
  },
  wrongBannerText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.rust },
  correctBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.light.sageLight, borderRadius: 14, padding: 14,
    borderLeftWidth: 4, borderLeftColor: Colors.light.sage,
  },
  correctBannerText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.sage },
  explainCard: {
    backgroundColor: Colors.light.goldLight, borderRadius: 18, padding: 16, gap: 14,
    borderLeftWidth: 4, borderLeftColor: Colors.light.gold,
  },
  explainHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  explainTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#8B5E00" },
  retryCard: {
    backgroundColor: Colors.light.optionB + "14",
    borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: Colors.light.optionB,
    alignItems: "center", gap: 6,
  },
  retryTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.optionB },
  retrySub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, textAlign: "center" },
});
