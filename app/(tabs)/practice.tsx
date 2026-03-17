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
import { useApp, type AnswerRecord, type SkillMap } from "@/context/AppContext";
import { useTimer } from "@/lib/useTimer";
import { useElapsedTime } from "@/lib/useElapsedTime";
import questionsData from "@/data/questions.json";

const LETTER = ["A", "B", "C", "D"];
const SESSION_SIZE = 10;

// ─── DIAGNOSTIC TOPIC → PRACTICE QUESTION TOPIC MAPPING ──────────────────────
// Diagnostic uses broad curriculum labels; practice bank uses specific topic names.
const DIAG_TO_PRACTICE_TOPICS: Record<string, string[]> = {
  "Whole Numbers":        ["Whole Numbers", "Addition and subtraction", "Multiplication", "Division", "Multiplication and Division"],
  "Factors & Multiples":  ["Whole Numbers", "Algebra"],
  "Fractions & Decimals": ["Fractions"],
  "Percentages & Ratios": ["Money", "Fractions", "Word Problems"],
  "Algebra":              ["Algebra", "Word Problems"],
  "Numbers & Powers":     ["Whole Numbers", "Algebra"],
  "Measurement & Time":   ["Time", "Measurements", "Capacity"],
  "Geometry & Angles":    ["Area", "Perimeter", "Geometry", "Triangles", "Angles", "3-D Shapes", "Plane shapes"],
  "Statistics & Probability": ["Statistics", "Probability", "Bar Graph"],
};

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

// ─── TOPIC SELECTOR DATA ──────────────────────────────────────────────────────
const TOPICS_MATHS = [
  { name: "Whole Numbers",           icon: "numeric" },
  { name: "Fractions",               icon: "fraction-one-half" },
  { name: "Addition and subtraction",icon: "plus-minus-variant" },
  { name: "Multiplication",          icon: "close" },
  { name: "Division",                icon: "division" },
  { name: "Multiplication and Division", icon: "calculator-variant" },
  { name: "Algebra",                 icon: "alpha-x-box-outline" },
  { name: "Money",                   icon: "currency-ngn" },
  { name: "Time",                    icon: "clock-outline" },
  { name: "Measurements",            icon: "ruler" },
  { name: "Perimeter",               icon: "vector-square" },
  { name: "Area",                    icon: "crop-square" },
  { name: "Geometry",                icon: "shape-outline" },
  { name: "3-D Shapes",              icon: "cube-outline" },
  { name: "Plane shapes",            icon: "pentagon-outline" },
  { name: "Triangles",               icon: "triangle-outline" },
  { name: "Angles",                  icon: "angle-acute" },
  { name: "Statistics",              icon: "chart-bar" },
  { name: "Bar Graph",               icon: "chart-timeline-variant" },
  { name: "Probability",             icon: "dice-multiple" },
  { name: "Word Problems",           icon: "text-box-outline" },
  { name: "Capacity",                icon: "cup-water" },
];

const TOPICS_ENGLISH = [
  { name: "Grammar & Tenses",        icon: "format-text" },
  { name: "Vocabulary & Spelling",   icon: "alphabetical" },
  { name: "Punctuation & Capitals",  icon: "format-letter-case" },
  { name: "Parts of Speech",         icon: "tag-text-outline" },
  { name: "Synonyms & Antonyms",     icon: "arrow-left-right" },
  { name: "Sentence Construction",   icon: "format-align-left" },
  { name: "Comprehension",           icon: "book-open-page-variant" },
  { name: "Idioms & Proverbs",       icon: "chat-processing-outline" },
  { name: "Letter Writing",          icon: "email-outline" },
];

// ─── QUESTION PICKERS ─────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function pickSmartQuestions(grade: string, skillMap: SkillMap): { questions: Question[]; weakTopics: string[] } {
  // 1. Find the 3 weakest diagnostic topics
  const weakDiagTopics = Object.entries(skillMap)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([t]) => t);

  // 2. Expand to practice topic names using the mapping
  const practiceTopics = new Set<string>();
  for (const dt of weakDiagTopics) {
    const mapped = DIAG_TO_PRACTICE_TOPICS[dt] ?? [];
    mapped.forEach((t) => practiceTopics.add(t));
  }

  // 3. Pool: grade + mapped practice topics (maths only)
  let pool = ALL_QUESTIONS.filter(
    (q) => q.subject === "maths" && q.grade === grade && practiceTopics.has(q.topic)
  );

  // Fallback: if pool too small, include any maths questions for this grade
  if (pool.length < SESSION_SIZE) {
    const gradePool = ALL_QUESTIONS.filter((q) => q.subject === "maths" && q.grade === grade);
    pool = pool.length > 0 ? [...new Map([...pool, ...gradePool].map((q) => [q.id, q])).values()] : gradePool;
  }

  // 4. Split by difficulty and pick with target distribution: 4 Regular, 3 Hard, 3 Extra Hard
  const regular   = shuffle(pool.filter((q) => q.difficulty === "Regular"));
  const hard      = shuffle(pool.filter((q) => q.difficulty === "Hard"));
  const extraHard = shuffle(pool.filter((q) => q.difficulty === "Extra Hard"));

  const picked: Question[] = [
    ...regular.slice(0, 4),
    ...hard.slice(0, 3),
    ...extraHard.slice(0, 3),
  ];

  // 5. Top up from remaining if we have fewer than 10
  if (picked.length < SESSION_SIZE) {
    const usedIds = new Set(picked.map((q) => q.id));
    const remaining = shuffle(pool.filter((q) => !usedIds.has(q.id)));
    for (const q of remaining) {
      if (picked.length >= SESSION_SIZE) break;
      picked.push(q);
    }
  }

  return { questions: shuffle(picked).slice(0, SESSION_SIZE), weakTopics: weakDiagTopics };
}

function pickTopicQuestions(subject: "maths" | "english", topic: string, grade: string): Question[] {
  let pool = ALL_QUESTIONS.filter((q) => q.subject === subject);
  if (topic !== "Mixed") pool = pool.filter((q) => q.topic === topic);
  const gradePool = pool.filter((q) => q.grade === grade);
  const source = gradePool.length >= 3 ? gradePool : pool;
  return shuffle(source).slice(0, Math.min(SESSION_SIZE, source.length));
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

type Phase = "select" | "quiz";
type AnswerState = "unanswered" | "wrong" | "retry_correct" | "retry_wrong_again" | "correct_first";
type SessionMode = "smart" | "topic";

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

const WEAK_COLORS = [Colors.light.rust, Colors.light.gold, Colors.light.optionC];

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, skillMap } = useApp();
  const params = useLocalSearchParams<{ autoStart?: string; subject?: string; topic?: string }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

  // ── Session state ──
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
  const [sessionMode, setSessionMode] = useState<SessionMode>("topic");
  const [weakTopicsUsed, setWeakTopicsUsed] = useState<string[]>([]);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const explainFade = useRef(new Animated.Value(0)).current;
  
  // For smart practice: use elapsed time (indefinite). For regular: use countdown timer.
  const { formattedTime: countdownTime, isLowTime } = useTimer(questions.length > 0 ? Math.max(300, questions.length * 30) : 300);
  const { formattedTime: elapsedTime } = useElapsedTime();

  useEffect(() => {
    if (params.autoStart === "1" && params.subject && params.topic) {
      startTopicSession(params.subject as "maths" | "english", params.topic);
    }
  }, []);

  // ── Session starters ──
  function startSmartSession() {
    if (!skillMap || !profile) return;
    const { questions: qs, weakTopics } = pickSmartQuestions(profile.grade, skillMap);
    if (qs.length === 0) return;
    Haptics.selectionAsync();
    setWeakTopicsUsed(weakTopics);
    setSessionMode("smart");
    setSessionSubject("maths");
    setSessionTopic("Smart Practice");
    setQuestions(qs);
    resetQuizState([]);
    setPhase("quiz");
  }

  function startTopicSession(subject: "maths" | "english", topic: string) {
    const qs = pickTopicQuestions(subject, topic, profile?.grade ?? "P4");
    if (qs.length === 0) return;
    Haptics.selectionAsync();
    setSessionMode("topic");
    setSessionSubject(subject);
    setSessionTopic(topic);
    setQuestions(qs);
    resetQuizState([]);
    setPhase("quiz");
  }

  function resetQuizState(clearedAnswers: AnswerRecord[]) {
    setCurrentIdx(0);
    setSelected(null);
    setRetrySelected(null);
    setAnswerState("unanswered");
    setAnswers(clearedAnswers);
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
    const record: AnswerRecord = { questionId: q.id, correct: isCorrect, topic: q.topic, subject: q.subject };
    setAnswers((prev) => [...prev, record]);
    if (isCorrect) {
      setAnswerState("correct_first");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setAnswerState("wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
    if (currentIdx + 1 >= questions.length) {
      // Navigate to results — addSession is called there
      const finalAnswers = answers;
      router.push({
        pathname: "/results",
        params: {
          subject: sessionSubject,
          topic: sessionTopic,
          score: String(finalAnswers.filter((a) => a.correct).length),
          total: String(finalAnswers.length),
          answers: JSON.stringify(finalAnswers),
          mode: sessionMode,
          weakTopics: weakTopicsUsed.join(","),
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

  // ─── TOPIC SELECTION PHASE ────────────────────────────────────────────────
  if (phase === "select") {
    const topics = activeTab === "maths" ? TOPICS_MATHS : TOPICS_ENGLISH;
    const tabColor = activeTab === "maths" ? Colors.light.optionB : Colors.light.rust;
    const hasSkillMap = !!skillMap && Object.keys(skillMap).length > 0;
    const weakTopics = hasSkillMap
      ? Object.entries(skillMap).sort(([, a], [, b]) => a - b).slice(0, 3)
      : [];

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.selectHeader, { paddingTop: topPad + 12, backgroundColor: tabColor }]}>
          <Text style={styles.selectTitle}>Practice</Text>
          <Text style={styles.selectSub}>Choose how to practise</Text>
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
          {/* ── Smart Practice card (Maths only) ── */}
          {activeTab === "maths" && (
            <View style={styles.smartCard}>
              <View style={styles.smartCardHeader}>
                <View style={styles.smartIconWrap}>
                  <Ionicons name="flash" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smartTitle}>Smart Practice</Text>
                  <Text style={styles.smartSub}>
                    {hasSkillMap
                      ? "10 questions focused on your weak areas"
                      : "Complete the Diagnostic Test first to unlock this"}
                  </Text>
                </View>
              </View>

              {hasSkillMap && weakTopics.length > 0 && (
                <View style={styles.weakChipRow}>
                  {weakTopics.map(([topic, pct], i) => (
                    <View key={topic} style={[styles.weakChip, { borderColor: WEAK_COLORS[i] }]}>
                      <View style={[styles.weakDot, { backgroundColor: WEAK_COLORS[i] }]} />
                      <Text style={[styles.weakChipText, { color: WEAK_COLORS[i] }]} numberOfLines={1}>
                        {topic}
                      </Text>
                      <Text style={[styles.weakChipPct, { color: WEAK_COLORS[i] }]}>{pct}%</Text>
                    </View>
                  ))}
                </View>
              )}

              {hasSkillMap ? (
                <TouchableOpacity style={styles.smartBtn} onPress={startSmartSession} activeOpacity={0.85}>
                  <Ionicons name="flash" size={18} color="#fff" />
                  <Text style={styles.smartBtnText}>Start Smart Session</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.smartBtn, { backgroundColor: Colors.light.textSecondary }]}
                  onPress={() => { Haptics.selectionAsync(); router.push("/diagnostic"); }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="clipboard" size={18} color="#fff" />
                  <Text style={styles.smartBtnText}>Take Diagnostic Test</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={styles.orDividerText}>— or choose a topic —</Text>

          {/* Mixed */}
          <TouchableOpacity
            style={[styles.mixedCard, { borderColor: tabColor }]}
            onPress={() => startTopicSession(activeTab, "Mixed")}
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

          {/* Topic list */}
          {topics.map((t, i) => {
            const avail = ALL_QUESTIONS.filter((q) => q.subject === activeTab && q.topic === t.name).length;
            const cardColors = [Colors.light.optionA, Colors.light.optionB, Colors.light.optionC, Colors.light.optionD];
            const iconColor = cardColors[i % 4];
            return (
              <TouchableOpacity
                key={t.name}
                style={[styles.topicCard, avail === 0 && styles.topicCardDisabled]}
                onPress={() => avail > 0 && startTopicSession(activeTab, t.name)}
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

  // ─── QUIZ PHASE ────────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  if (!q) return null;

  const isWrong        = answerState === "wrong";
  const isCorrect      = answerState === "correct_first";
  const retryCorrect   = answerState === "retry_correct";
  const retryWrongAgain = answerState === "retry_wrong_again";
  const showRetry      = isWrong;
  const showNext       = isCorrect || retryCorrect || retryWrongAgain;
  const revealed       = answerState !== "unanswered";
  const progress       = (currentIdx + 1) / questions.length;
  const subjectColor   = sessionSubject === "maths" ? Colors.light.optionB : Colors.light.rust;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Quiz top bar */}
      <View style={[styles.quizTopBar, { backgroundColor: subjectColor }]}>
        <View style={styles.quizTopRow}>
          <TouchableOpacity
            style={styles.quitBtn}
            onPress={() => { Haptics.selectionAsync(); setPhase("select"); }}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.qBadgeWrap}>
            {sessionMode === "smart" && (
              <View style={styles.smartModePill}>
                <Ionicons name="flash" size={12} color={Colors.light.gold} />
                <Text style={styles.smartModePillTxt}>Smart</Text>
              </View>
            )}
            <Text style={styles.qBadgeTxt}>{currentIdx + 1} / {questions.length}</Text>
          </View>
          {q.difficulty ? (
            <View style={[styles.diffPill, {
              backgroundColor:
                q.difficulty === "Regular"    ? "rgba(255,255,255,0.2)" :
                q.difficulty === "Hard"       ? Colors.light.gold + "50" :
                                                Colors.light.rust + "50",
            }]}>
              <Text style={styles.diffPillTxt}>{q.difficulty}</Text>
            </View>
          ) : null}
          <View style={[styles.timerBadge, { backgroundColor: sessionMode === "smart" ? "rgba(255,255,255,0.2)" : (isLowTime ? Colors.light.rust + "20" : "rgba(255,255,255,0.2)") }]}>
            <Ionicons name="timer" size={14} color={sessionMode === "smart" ? "#fff" : (isLowTime ? Colors.light.rust : "#fff")} />
            <Text style={[styles.timerTxt, { color: sessionMode === "smart" ? "#fff" : (isLowTime ? Colors.light.rust : "#fff") }]}>
              {sessionMode === "smart" ? elapsedTime : countdownTime}
            </Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.quizContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ transform: [{ translateY: slideAnim }], gap: 14 }}>
          {/* Question */}
          <View style={styles.questionCard}>
            {q.subtopic ? <Text style={styles.subtopicLabel}>{q.subtopic}</Text> : null}
            <Text style={styles.questionText}>{q.question}</Text>
          </View>

          {/* Options */}
          <View style={styles.options}>
            {q.options.map((opt, i) => {
              const optColor = OPTION_COLORS[i];
              const isSelected = selected === i;
              const isCorrAns  = i === q.correctIndex;

              let bg          = Colors.light.card;
              let borderColor = Colors.light.border;
              let labelBg     = optColor;
              let textColor   = Colors.light.text;
              let touchDisabled = revealed;

              if (showRetry) touchDisabled = i === selected;

              if (!revealed) {
                if (isSelected) { bg = optColor + "18"; borderColor = optColor; }
              } else if (showRetry) {
                if (isSelected) { bg = "#F5F5F5"; borderColor = "#CCC"; labelBg = "#AAA"; textColor = "#999"; }
              } else {
                if (isCorrAns)           { bg = Colors.light.sageLight;  borderColor = Colors.light.sage; labelBg = Colors.light.sage; textColor = "#1A5E35"; }
                else if (isSelected)     { bg = Colors.light.rustLight;  borderColor = Colors.light.rust; labelBg = Colors.light.rust; textColor = Colors.light.rust; }
              }

              if ((retryCorrect || retryWrongAgain) && retrySelected !== null) {
                if (isCorrAns)               { bg = Colors.light.sageLight;  borderColor = Colors.light.sage; labelBg = Colors.light.sage; textColor = "#1A5E35"; }
                else if (retrySelected === i) { bg = Colors.light.rustLight;  borderColor = Colors.light.rust; labelBg = Colors.light.rust; textColor = Colors.light.rust; }
                else if (isSelected)         { bg = "#F5F5F5"; borderColor = "#CCC"; labelBg = "#AAA"; textColor = "#999"; }
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
                  <Text style={styles.wrongBannerText}>Still incorrect — the correct answer is highlighted above.</Text>
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
                <View style={styles.retryCard}>
                  <Text style={styles.retryTitle}>Now you try!</Text>
                  <Text style={styles.retrySub}>Tap the correct answer above to show you understand.</Text>
                </View>
              )}

              {/* Next button */}
              {showNext && (
                <TouchableOpacity
                  style={[styles.nextBtn, { backgroundColor: subjectColor }]}
                  onPress={handleNext}
                >
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

// ─── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  // Selector header
  selectHeader: { paddingHorizontal: 20, paddingBottom: 16, gap: 4 },
  selectTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff" },
  selectSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 10 },
  tabRow: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 12 },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },

  topicList: { padding: 16, gap: 10 },

  // Smart Practice card
  smartCard: {
    backgroundColor: Colors.light.navy,
    borderRadius: 22, padding: 16, gap: 14,
    shadowColor: Colors.light.navy, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  smartCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  smartIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: Colors.light.gold,
    justifyContent: "center", alignItems: "center",
  },
  smartTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: "#fff" },
  smartSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 3, lineHeight: 19 },
  weakChipRow: { gap: 8 },
  weakChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1.5,
  },
  weakDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  weakChipText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  weakChipPct: { fontFamily: "Inter_700Bold", fontSize: 13 },
  smartBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.light.gold,
    borderRadius: 14, paddingVertical: 14,
  },
  smartBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },

  orDividerText: {
    fontFamily: "Inter_500Medium", fontSize: 13,
    color: Colors.light.textTertiary, textAlign: "center",
    marginVertical: 4,
  },

  // Mixed card
  mixedCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.card, borderRadius: 18, padding: 14, gap: 12, borderWidth: 2 },
  mixedIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  mixedTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  mixedSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  playBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },

  // Topic cards
  topicCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.card, borderRadius: 16, padding: 14, gap: 12 },
  topicCardDisabled: { opacity: 0.4 },
  topicIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  topicName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  topicCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },

  // Quiz bar
  quizTopBar: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 12, gap: 10 },
  quizTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  quitBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  qBadgeWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  smartModePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  smartModePillTxt: { fontFamily: "Inter_700Bold", fontSize: 11, color: Colors.light.gold },
  qBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  diffPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  diffPillTxt: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#fff" },
  timerBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  timerTxt: { fontFamily: "Inter_700Bold", fontSize: 11 },
  progressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 4 },

  // Quiz content
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

  // Feedback banners
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

  // Explanation
  explainCard: {
    backgroundColor: Colors.light.goldLight, borderRadius: 18, padding: 16, gap: 14,
    borderLeftWidth: 4, borderLeftColor: Colors.light.gold,
  },
  explainHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  explainTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#8B5E00" },

  // Retry
  retryCard: {
    backgroundColor: Colors.light.optionB + "14",
    borderRadius: 16, padding: 16, borderWidth: 2, borderColor: Colors.light.optionB,
    alignItems: "center", gap: 6,
  },
  retryTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.optionB },
  retrySub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, textAlign: "center" },

  // Next button
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderRadius: 18, paddingVertical: 18,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  nextBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
});
