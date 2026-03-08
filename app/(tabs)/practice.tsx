import React, { useState, useRef, useEffect } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors, { OPTION_COLORS } from "@/constants/colors";
import { useApp, type AnswerRecord } from "@/context/AppContext";
import questionsData from "@/data/questions.json";

const LETTER = ["A", "B", "C", "D"];

// Maths topics derived from the new question bank (all grades combined)
const TOPICS_MATHS = [
  { name: "Whole Numbers", icon: "numeric" },
  { name: "Fractions", icon: "fraction-one-half" },
  { name: "Addition and subtraction", icon: "plus-minus-variant" },
  { name: "Multiplication", icon: "close" },
  { name: "Division", icon: "division" },
  { name: "Multiplication and Division", icon: "calculator-variant" },
  { name: "Algebra", icon: "alpha-x-box-outline" },
  { name: "Percentages", icon: "percent" },
  { name: "Money", icon: "currency-ngn" },
  { name: "Time", icon: "clock-outline" },
  { name: "Measurements", icon: "ruler" },
  { name: "Perimeter", icon: "vector-square" },
  { name: "Area", icon: "crop-square" },
  { name: "Geometry", icon: "shape-outline" },
  { name: "3-D Shapes", icon: "cube-outline" },
  { name: "Plane shapes", icon: "pentagon-outline" },
  { name: "Triangles", icon: "triangle-outline" },
  { name: "Angles", icon: "angle-acute" },
  { name: "Statistics", icon: "chart-bar" },
  { name: "Bar Graph", icon: "chart-timeline-variant" },
  { name: "Probability", icon: "dice-multiple" },
  { name: "Word Problems", icon: "text-box-outline" },
  { name: "Capacity", icon: "cup-water" },
];

const TOPICS_ENGLISH = [
  { name: "Grammar & Tenses", icon: "format-text" },
  { name: "Vocabulary & Spelling", icon: "alphabetical" },
  { name: "Punctuation & Capitals", icon: "format-letter-case" },
  { name: "Parts of Speech", icon: "tag-text-outline" },
  { name: "Synonyms & Antonyms", icon: "arrow-left-right" },
  { name: "Sentence Construction", icon: "format-align-left" },
  { name: "Comprehension", icon: "book-open-page-variant" },
  { name: "Idioms & Proverbs", icon: "chat-processing-outline" },
  { name: "Letter Writing", icon: "email-outline" },
];

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

const ALL_QUESTIONS = questionsData as Question[];
const SESSION_SIZE = 10;

function pickQuestions(subject: "maths" | "english", topic: string, grade: string): Question[] {
  let pool = ALL_QUESTIONS.filter((q) => q.subject === subject);
  if (topic !== "Mixed") pool = pool.filter((q) => q.topic === topic);
  const gradePool = pool.filter((q) => q.grade === grade);
  const source = gradePool.length >= 3 ? gradePool : pool;
  return [...source].sort(() => Math.random() - 0.5).slice(0, Math.min(SESSION_SIZE, source.length));
}

type Phase = "select" | "quiz";
type AnswerState = "unanswered" | "wrong" | "retry_correct" | "retry_wrong_again" | "correct_first";

function ExplanationSteps({ text }: { text: string }) {
  const steps = text.split("\n").filter((s) => s.trim().length > 0);
  return (
    <View style={explainSt.wrap}>
      {steps.map((step, i) => {
        const isCheck = step.startsWith("✓");
        return (
          <View key={i} style={[explainSt.step]}>
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

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const params = useLocalSearchParams<{ autoStart?: string; subject?: string; topic?: string }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

  const [phase, setPhase] = useState<Phase>("select");
  const [activeTab, setActiveTab] = useState<"maths" | "english">("maths");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [retrySelected, setRetrySelected] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("unanswered");
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionSubject, setSessionSubject] = useState<"maths" | "english">("maths");
  const slideAnim = useRef(new Animated.Value(0)).current;
  const explainFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (params.autoStart === "1" && params.subject && params.topic) {
      startSession(params.subject as "maths" | "english", params.topic);
    }
  }, []);

  function startSession(subject: "maths" | "english", topic: string) {
    const qs = pickQuestions(subject, topic, profile?.grade ?? "P4");
    if (qs.length === 0) return;
    setSessionSubject(subject);
    setSessionTopic(topic);
    setQuestions(qs);
    setCurrentIdx(0);
    setSelected(null);
    setRetrySelected(null);
    setAnswerState("unanswered");
    setAnswers([]);
    setPhase("quiz");
    Haptics.selectionAsync();
  }

  function animateExplain() {
    explainFade.setValue(0);
    Animated.timing(explainFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }

  function handleFirstSelect(idx: number) {
    if (answerState !== "unanswered") return;
    Haptics.selectionAsync();
    const q = questions[currentIdx];
    const isCorrect = idx === q.correctIndex;
    setSelected(idx);
    if (isCorrect) {
      setAnswerState("correct_first");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAnswers((prev) => [...prev, { questionId: q.id, correct: true, topic: q.topic, subject: q.subject }]);
    } else {
      setAnswerState("wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setAnswers((prev) => [...prev, { questionId: q.id, correct: false, topic: q.topic, subject: q.subject }]);
    }
    animateExplain();
  }

  function handleRetry(idx: number) {
    if (idx === selected) return;
    Haptics.selectionAsync();
    const q = questions[currentIdx];
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
    const allAnswers = answers;
    if (currentIdx + 1 >= questions.length) {
      router.push({
        pathname: "/results",
        params: {
          subject: sessionSubject,
          topic: sessionTopic,
          score: String(allAnswers.filter((a) => a.correct).length),
          total: String(allAnswers.length),
          answers: JSON.stringify(allAnswers),
        },
      });
      setPhase("select");
      return;
    }
    Animated.timing(slideAnim, { toValue: -20, duration: 110, useNativeDriver: true }).start(() => {
      slideAnim.setValue(20);
      setCurrentIdx((c) => c + 1);
      setSelected(null);
      setRetrySelected(null);
      setAnswerState("unanswered");
      Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    });
  }

  // ─── TOPIC SELECTION ───────────────────────────────────────────────
  if (phase === "select") {
    const topics = activeTab === "maths" ? TOPICS_MATHS : TOPICS_ENGLISH;
    const tabColor = activeTab === "maths" ? Colors.light.optionB : Colors.light.rust;

    return (
      <View style={styles.container}>
        <View style={[styles.selectHeader, { paddingTop: topPad + 12, backgroundColor: tabColor }]}>
          <Text style={styles.selectTitle}>Practice</Text>
          <Text style={styles.selectSub}>Pick a topic below</Text>
          <View style={styles.tabRow}>
            {(["maths", "english"] as const).map((s) => {
              const active = activeTab === s;
              const tc = s === "maths" ? Colors.light.optionB : Colors.light.rust;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.tab, active ? styles.tabActive : { backgroundColor: "rgba(255,255,255,0.2)" }]}
                  onPress={() => { Haptics.selectionAsync(); setActiveTab(s); }}
                >
                  <MaterialCommunityIcons
                    name={s === "maths" ? "calculator-variant" : "book-alphabet"}
                    size={18}
                    color={active ? tc : "#fff"}
                  />
                  <Text style={[styles.tabText, active && { color: tc }]}>
                    {s === "maths" ? "Maths" : "English"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.topicList, { paddingBottom: bottomPad }]}>
          {/* Mixed */}
          <TouchableOpacity
            style={[styles.mixedCard, { borderColor: tabColor }]}
            onPress={() => startSession(activeTab, "Mixed")}
            activeOpacity={0.85}
          >
            <View style={[styles.mixedIcon, { backgroundColor: tabColor }]}>
              <Ionicons name="shuffle" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mixedTitle, { color: tabColor }]}>Mixed Practice</Text>
              <Text style={styles.mixedSub}>Random questions from all topics</Text>
            </View>
            <View style={[styles.playBtn, { backgroundColor: tabColor }]}>
              <Ionicons name="play" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          {topics.map((t, i) => {
            const avail = ALL_QUESTIONS.filter((q) => q.subject === activeTab && q.topic === t.name).length;
            const cardColors = [Colors.light.optionA, Colors.light.optionB, Colors.light.optionC, Colors.light.optionD];
            const iconColor = cardColors[i % 4];
            return (
              <TouchableOpacity
                key={t.name}
                style={[styles.topicCard, avail === 0 && styles.topicCardDisabled]}
                onPress={() => avail > 0 && startSession(activeTab, t.name)}
                activeOpacity={0.85}
                disabled={avail === 0}
              >
                <View style={[styles.topicIcon, { backgroundColor: iconColor + "18" }]}>
                  <MaterialCommunityIcons name={t.icon as any} size={20} color={avail > 0 ? iconColor : Colors.light.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.topicName, avail === 0 && { color: Colors.light.textTertiary }]}>
                    {t.name}
                  </Text>
                  <Text style={styles.topicCount}>{avail} question{avail !== 1 ? "s" : ""}</Text>
                </View>
                {avail > 0 && <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ─── QUIZ ───────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  if (!q) return null;

  const isWrong = answerState === "wrong";
  const isCorrect = answerState === "correct_first";
  const retryCorrect = answerState === "retry_correct";
  const retryWrongAgain = answerState === "retry_wrong_again";
  const showRetry = isWrong;
  const showNext = isCorrect || retryCorrect || retryWrongAgain;
  const revealed = answerState !== "unanswered";
  const progress = (currentIdx + 1) / questions.length;
  const subjectColor = q.subject === "maths" ? Colors.light.optionB : Colors.light.rust;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Colored top bar */}
      <View style={[styles.quizTopBar, { backgroundColor: subjectColor }]}>
        <View style={styles.quizTopRow}>
          <TouchableOpacity style={styles.quitBtn} onPress={() => { Haptics.selectionAsync(); setPhase("select"); }}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.qBadge}>
            <Text style={styles.qBadgeTxt}>{currentIdx + 1} of {questions.length}</Text>
          </View>
          {q.difficulty ? (
            <View style={[styles.diffPill, {
              backgroundColor: q.difficulty === "Regular" ? "rgba(255,255,255,0.2)" :
                q.difficulty === "Hard" ? Colors.light.gold + "50" : Colors.light.rust + "50"
            }]}>
              <Text style={styles.diffPillTxt}>{q.difficulty}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.quizContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ transform: [{ translateY: slideAnim }], gap: 14 }}>
          {/* Topic + question */}
          <View style={styles.questionCard}>
            {q.subtopic ? (
              <Text style={styles.subtopicLabel}>{q.subtopic}</Text>
            ) : null}
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
                  style={[styles.optBtn, { backgroundColor: bg, borderColor }, touchDisabled && !showRetry && styles.optDisabled]}
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

          {/* Animated explanation section */}
          {revealed && (
            <Animated.View style={{ opacity: explainFade, gap: 14 }}>
              {/* Status banner */}
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
                  <Text style={styles.wrongBannerText}>Still incorrect — the correct answer is now highlighted above.</Text>
                </View>
              )}

              {/* Explanation card */}
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
                <View style={styles.retryCard}>
                  <Text style={styles.retryTitle}>Now you try!</Text>
                  <Text style={styles.retrySub}>Tap the correct answer above to show you understand.</Text>
                </View>
              )}

              {/* Next */}
              {showNext && (
                <TouchableOpacity style={[styles.nextBtn, { backgroundColor: subjectColor }]} onPress={handleNext}>
                  <Text style={styles.nextBtnText}>
                    {currentIdx + 1 >= questions.length ? "See Results" : "Next Question"}
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
  container: { flex: 1, backgroundColor: Colors.light.background },
  selectHeader: { paddingHorizontal: 20, paddingBottom: 16, gap: 4 },
  selectTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff" },
  selectSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 10 },
  tabRow: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 12 },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  topicList: { padding: 16, gap: 10 },
  mixedCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.card, borderRadius: 18, padding: 14, gap: 12, borderWidth: 2, marginBottom: 4 },
  mixedIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  mixedTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  mixedSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  playBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  topicCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.card, borderRadius: 16, padding: 14, gap: 12 },
  topicCardDisabled: { opacity: 0.4 },
  topicIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  topicName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  topicCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  quizTopBar: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 12, gap: 10 },
  quizTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  quitBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  qBadge: { flex: 1, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  qBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  diffPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  diffPillTxt: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#fff" },
  progressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 4 },
  quizContent: { padding: 16 },
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
    backgroundColor: Colors.light.optionB + "12",
    borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: Colors.light.optionB,
    alignItems: "center", gap: 6,
  },
  retryTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.optionB },
  retrySub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, textAlign: "center" },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderRadius: 18, paddingVertical: 18,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  nextBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
});
