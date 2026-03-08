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
  subtopic?: string;
  difficulty?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const LETTER = ["A", "B", "C", "D"];

function pickDiagnosticQuestions(grade: string): Question[] {
  const all = questionsData as Question[];
  const gradeQs = all.filter((q) => q.grade === grade);
  const maths = gradeQs.filter((q) => q.subject === "maths");
  const english = gradeQs.filter((q) => q.subject === "english");

  function pick(arr: Question[], n: number, subject: "maths" | "english"): Question[] {
    const source = arr.length >= n ? arr : all.filter((q) => q.subject === subject);
    return [...source].sort(() => Math.random() - 0.5).slice(0, n);
  }
  return [...pick(maths, 5, "maths"), ...pick(english, 5, "english")].sort(() => Math.random() - 0.5);
}

type Phase = "intro" | "quiz" | "done";
type AnswerState = "unanswered" | "wrong" | "retry_correct" | "retry_wrong_again" | "correct_first";

function ExplanationSteps({ text }: { text: string }) {
  const steps = text.split("\n").filter((s) => s.trim().length > 0);
  return (
    <View style={explainSt.wrap}>
      {steps.map((step, i) => {
        const isCheck = step.startsWith("✓");
        return (
          <View key={i} style={[explainSt.step, isCheck && explainSt.checkStep]}>
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
  checkStep: {},
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7, flexShrink: 0 },
  stepText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.text, lineHeight: 21 },
  checkText: { color: Colors.light.sage, fontFamily: "Inter_500Medium" },
});

export default function DiagnosticScreen() {
  const insets = useSafeAreaInsets();
  const { profile, saveDiagnosticResult } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [retrySelected, setRetrySelected] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("unanswered");
  const [answers, setAnswers] = useState<{ correct: boolean; subject: "maths" | "english" }[]>([]);
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const explainFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (profile) setQuestions(pickDiagnosticQuestions(profile.grade));
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
      setAnswers((prev) => [...prev, { correct: true, subject: q.subject }]);
    } else {
      setAnswerState("wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setAnswers((prev) => [...prev, { correct: false, subject: q.subject }]);
    }
    animateExplain();
  }

  function handleRetry(idx: number) {
    const q = questions[current];
    if (idx === selected) return; // can't pick the same wrong one again
    Haptics.selectionAsync();
    setRetrySelected(idx);
    if (idx === q.correctIndex) {
      setAnswerState("retry_correct");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setAnswerState("retry_wrong_again");
    }
  }

  function handleNext() {
    Haptics.selectionAsync();
    Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }).start(() => {
      slideAnim.setValue(20);
      if (current + 1 >= questions.length) {
        finishDiagnostic();
      } else {
        setCurrent((c) => c + 1);
        setSelected(null);
        setRetrySelected(null);
        setAnswerState("unanswered");
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      }
    });
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
            { icon: "star", color: Colors.light.gold, text: "Wrong answers show a full explanation" },
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
          <View style={[styles.introIconWrap, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
            <Ionicons name="checkmark-circle" size={52} color="#fff" />
          </View>
          <Text style={styles.introTitle}>Well done, {profile?.name}!</Text>
          <Text style={styles.doneScore}>{correct} / 10</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.introCards, { paddingBottom: bottomPad + 16 }]}>
          <View style={styles.scoreCard}>
            {[
              { label: "Maths", correct: mathsCorrect, total: mathsTotal, color: Colors.light.optionB },
              { label: "English", correct: engCorrect, total: engTotal, color: Colors.light.rust },
            ].map((d) => (
              <View key={d.label} style={styles.scoreRow}>
                <View style={[styles.subjectBadge, { backgroundColor: d.color }]}>
                  <Text style={styles.subjectBadgeTxt}>{d.label}</Text>
                </View>
                <View style={styles.scoreBarWrap}>
                  <View style={[styles.scoreBar, { width: `${d.total > 0 ? (d.correct / d.total) * 100 : 0}%`, backgroundColor: d.color }]} />
                </View>
                <Text style={[styles.scoreFrac, { color: d.color }]}>{d.correct}/{d.total}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.doneMsg}>
            {correct >= 7
              ? "Excellent! You have a strong foundation. We'll give you harder challenges."
              : correct >= 4
              ? "Good start! We'll build on your strengths and strengthen weak spots."
              : "No worries! SomaLabs will guide you step-by-step from the basics."}
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

  const isWrong = answerState === "wrong";
  const isCorrect = answerState === "correct_first";
  const retryCorrect = answerState === "retry_correct";
  const retryWrongAgain = answerState === "retry_wrong_again";
  const showRetry = isWrong;
  const showNext = isCorrect || retryCorrect || retryWrongAgain;
  const revealed = answerState !== "unanswered";

  const progress = (current + 1) / questions.length;
  const subjectColor = q.subject === "maths" ? Colors.light.optionB : Colors.light.rust;

  return (
    <View style={[styles.quizRoot, { paddingTop: topPad }]}>
      <View style={[styles.quizTopBar, { backgroundColor: subjectColor }]}>
        <View style={styles.quizTopRow}>
          <View style={styles.qBadge}>
            <Text style={styles.qBadgeTxt}>Q{current + 1} of {questions.length}</Text>
          </View>
          <View style={[styles.subjectTag, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
            <Text style={styles.subjectTagTxt}>{q.subject === "maths" ? "Maths" : "English"}</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.quizContent, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateY: slideAnim }], gap: 14 }}>
          {/* Question */}
          <View style={styles.questionCard}>
            {q.subtopic ? (
              <Text style={styles.subtopicLabel}>{q.subtopic}</Text>
            ) : null}
            <Text style={styles.questionText}>{q.question}</Text>
          </View>

          {/* First-attempt options */}
          <View style={styles.optionsList}>
            {q.options.map((opt, i) => {
              const optColor = OPTION_COLORS[i];
              const isSelected = selected === i;
              const isCorrAns = i === q.correctIndex;

              let bg = Colors.light.card;
              let borderColor = Colors.light.border;
              let labelBg = optColor;
              let textColor = Colors.light.text;
              let disabled = revealed;

              // In retry phase, disable the original wrong answer
              if (showRetry) disabled = i === selected;

              if (revealed && !showRetry) {
                // Show correct/wrong after all done
                if (isCorrAns) { bg = Colors.light.sageLight; borderColor = Colors.light.sage; labelBg = Colors.light.sage; textColor = "#1A5E35"; }
                else if (isSelected && !isCorrAns) { bg = Colors.light.rustLight; borderColor = Colors.light.rust; labelBg = Colors.light.rust; textColor = Colors.light.rust; }
              } else if (revealed && showRetry) {
                // Dim the wrong answer that was selected
                if (isSelected) { bg = "#F5F5F5"; borderColor = "#DDD"; labelBg = "#BBB"; textColor = "#AAA"; }
              } else if (isSelected) {
                bg = optColor + "18"; borderColor = optColor;
              }

              // After retry
              if ((retryCorrect || retryWrongAgain) && retrySelected !== null) {
                if (isCorrAns) { bg = Colors.light.sageLight; borderColor = Colors.light.sage; labelBg = Colors.light.sage; textColor = "#1A5E35"; }
                else if (retrySelected === i && !isCorrAns) { bg = Colors.light.rustLight; borderColor = Colors.light.rust; labelBg = Colors.light.rust; textColor = Colors.light.rust; }
                else if (isSelected && retrySelected !== i) { bg = "#F5F5F5"; borderColor = "#DDD"; labelBg = "#BBB"; textColor = "#AAA"; }
              }

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optionBtn, { backgroundColor: bg, borderColor }, disabled && styles.optionDisabled]}
                  onPress={() => showRetry && !disabled ? handleRetry(i) : !revealed ? handleFirstSelect(i) : undefined}
                  disabled={disabled && !showRetry}
                  activeOpacity={disabled ? 1 : 0.78}
                >
                  <View style={[styles.optBadge, { backgroundColor: labelBg }]}>
                    <Text style={styles.optBadgeTxt}>{LETTER[i]}</Text>
                  </View>
                  <Text style={[styles.optText, { color: textColor }]}>{opt}</Text>
                  {(retryCorrect || (isCorrect && isCorrAns)) && isCorrAns && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.light.sage} />
                  )}
                  {retryWrongAgain && retrySelected === i && !isCorrAns && (
                    <Ionicons name="close-circle" size={22} color={Colors.light.rust} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Explanation + interaction — animated in */}
          {revealed && (
            <Animated.View style={{ opacity: explainFade, gap: 14 }}>
              {/* Wrong answer banner */}
              {(isWrong || retryWrongAgain) && (
                <View style={styles.wrongBanner}>
                  <Ionicons name="close-circle" size={20} color={Colors.light.rust} />
                  <Text style={styles.wrongBannerText}>
                    {isWrong ? "Not quite — let's understand why!" : "Still incorrect — the correct answer is highlighted above."}
                  </Text>
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

              {/* Explanation */}
              <View style={styles.explainCard}>
                <View style={styles.explainHeader}>
                  <Ionicons name="bulb" size={18} color={Colors.light.gold} />
                  <Text style={styles.explainTitle}>
                    {isCorrect ? "Why this is correct" : "Here's how to solve it"}
                  </Text>
                </View>
                <ExplanationSteps text={q.explanation} />
              </View>

              {/* Retry prompt */}
              {showRetry && (
                <View style={styles.retryPromptCard}>
                  <Text style={styles.retryPromptTitle}>Now you try!</Text>
                  <Text style={styles.retryPromptSub}>
                    Tap the correct answer above to show you understand.
                  </Text>
                </View>
              )}

              {/* Next button */}
              {showNext && (
                <TouchableOpacity style={[styles.orangeBtn, { marginTop: 0 }]} onPress={handleNext}>
                  <Text style={styles.orangeBtnText}>
                    {current + 1 >= questions.length ? "See My Results" : "Next Question"}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
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
  introContainer: { flex: 1, backgroundColor: Colors.light.optionB },
  doneContainer: { flex: 1, backgroundColor: Colors.light.sage },
  introHeader: { alignItems: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28, gap: 10 },
  introIconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  introTitle: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff", textAlign: "center" },
  introSub: { fontFamily: "Inter_400Regular", fontSize: 15, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 22 },
  introCards: { backgroundColor: Colors.light.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14, flexGrow: 1 },
  infoCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderLeftWidth: 4 },
  infoText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.text, flex: 1 },
  orangeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.light.gold, borderRadius: 18, paddingVertical: 18,
    shadowColor: Colors.light.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  orangeBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  doneHeader: { alignItems: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28, gap: 8 },
  doneScore: { fontFamily: "Inter_700Bold", fontSize: 52, color: "#fff", lineHeight: 60 },
  doneMsg: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.light.textSecondary, textAlign: "center", lineHeight: 22 },
  scoreCard: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 18, gap: 14 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  subjectBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, width: 72, alignItems: "center" },
  subjectBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff" },
  scoreBarWrap: { flex: 1, height: 8, backgroundColor: Colors.light.border, borderRadius: 4, overflow: "hidden" },
  scoreBar: { height: "100%", borderRadius: 4 },
  scoreFrac: { fontFamily: "Inter_700Bold", fontSize: 14, width: 30, textAlign: "right" },
  quizRoot: { flex: 1, backgroundColor: Colors.light.background },
  quizTopBar: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 12, gap: 10 },
  quizTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  qBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  subjectTag: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  subjectTagTxt: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  progressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 4 },
  quizContent: { padding: 16 },
  questionCard: { backgroundColor: Colors.light.cream, borderRadius: 20, padding: 20, borderWidth: 2, borderColor: "#F0E8D8", gap: 6 },
  subtopicLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.light.gold, textTransform: "uppercase", letterSpacing: 1 },
  questionText: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.light.navy, lineHeight: 28 },
  optionsList: { gap: 10 },
  optionBtn: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 14, borderWidth: 2, gap: 12 },
  optionDisabled: { opacity: 0.45 },
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
  explainCard: { backgroundColor: Colors.light.goldLight, borderRadius: 18, padding: 16, gap: 14, borderLeftWidth: 4, borderLeftColor: Colors.light.gold },
  explainHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  explainTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#8B5E00" },
  retryPromptCard: {
    backgroundColor: Colors.light.optionB + "12",
    borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: Colors.light.optionB,
    alignItems: "center", gap: 6,
  },
  retryPromptTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.optionB },
  retryPromptSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, textAlign: "center" },
});
