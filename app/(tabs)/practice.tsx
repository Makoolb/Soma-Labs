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

const TOPICS_MATHS = [
  { name: "Basic Operations", icon: "plus-minus-variant" },
  { name: "Number & Numeration", icon: "numeric" },
  { name: "Fractions & Decimals", icon: "fraction-one-half" },
  { name: "Percentages", icon: "percent" },
  { name: "Measurement", icon: "ruler" },
  { name: "Time & Calendar", icon: "clock-outline" },
  { name: "Money", icon: "currency-ngn" },
  { name: "Geometry & Shapes", icon: "shape-outline" },
  { name: "Word Problems", icon: "text-box-outline" },
  { name: "Data & Charts", icon: "chart-bar" },
  { name: "Multiplication Tables", icon: "table" },
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
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionSubject, setSessionSubject] = useState<"maths" | "english">("maths");
  const slideAnim = useRef(new Animated.Value(0)).current;

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
    setRevealed(false);
    setAnswers([]);
    setPhase("quiz");
    Haptics.selectionAsync();
  }

  function animateNext() {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 20, duration: 110, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }

  function handleSelect(idx: number) {
    if (revealed) return;
    Haptics.selectionAsync();
    const q = questions[currentIdx];
    const correct = idx === q.correctIndex;
    setSelected(idx);
    setRevealed(true);
    if (correct) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAnswers((prev) => [...prev, { questionId: q.id, correct, topic: q.topic, subject: q.subject }]);
  }

  function handleNext() {
    Haptics.selectionAsync();
    const allAnswers = answers; // already includes current answer
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
    animateNext();
    setTimeout(() => {
      setCurrentIdx((c) => c + 1);
      setSelected(null);
      setRevealed(false);
    }, 110);
  }

  // --- TOPIC SELECTION ---
  if (phase === "select") {
    const topics = activeTab === "maths" ? TOPICS_MATHS : TOPICS_ENGLISH;
    const tabColor = activeTab === "maths" ? Colors.light.optionB : Colors.light.rust;
    const tabLight = activeTab === "maths" ? Colors.light.navyLight : Colors.light.rustLight;

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

  // --- QUIZ ---
  const q = questions[currentIdx];
  if (!q) return null;
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
          <View style={[styles.subjectTag, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
            <Text style={styles.subjectTagTxt}>{q.subject === "maths" ? "Maths" : "English"}</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.quizContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ transform: [{ translateY: slideAnim }], gap: 14 }}>
          {/* Topic pill */}
          <View style={[styles.topicPill, { backgroundColor: subjectColor + "18" }]}>
            <Text style={[styles.topicPillText, { color: subjectColor }]}>{q.topic}</Text>
          </View>

          {/* Question */}
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{q.question}</Text>
          </View>

          {/* Options */}
          <View style={styles.options}>
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
                  style={[styles.optBtn, { backgroundColor: bg, borderColor }]}
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
            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: subjectColor }]} onPress={handleNext}>
              <Text style={styles.nextBtnText}>
                {currentIdx + 1 >= questions.length ? "See Results" : "Next Question"}
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
  selectHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 4,
  },
  selectTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff" },
  selectSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 10 },
  tabRow: {
    flexDirection: "row",
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: "#fff",
  },
  tabText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  topicList: { padding: 16, gap: 10 },
  mixedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 2,
    marginBottom: 4,
  },
  mixedIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  mixedTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  mixedSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  playBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  topicCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  topicCardDisabled: { opacity: 0.4 },
  topicIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  topicName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  topicCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  quizTopBar: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 12, gap: 10 },
  quizTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  quitBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  qBadge: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  qBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  subjectTag: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  subjectTagTxt: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  progressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 4 },
  quizContent: { padding: 16 },
  topicPill: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  topicPillText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  questionCard: {
    backgroundColor: Colors.light.cream,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: "#F0E8D8",
  },
  questionText: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.light.navy, lineHeight: 28 },
  options: { gap: 10 },
  optBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    gap: 12,
  },
  optBadge: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
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
  explainText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.text, lineHeight: 21 },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 18,
    marginTop: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  nextBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
});
