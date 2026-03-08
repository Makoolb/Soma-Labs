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
import Colors from "@/constants/colors";
import { useApp, type AnswerRecord } from "@/context/AppContext";
import questionsData from "@/data/questions.json";

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
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(SESSION_SIZE, shuffled.length));
}

type Phase = "select" | "quiz" | "reviewing";

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
    setAnswers((prev) => [
      ...prev,
      { questionId: q.id, correct, topic: q.topic, subject: q.subject },
    ]);
  }

  function handleNext() {
    Haptics.selectionAsync();
    if (currentIdx + 1 >= questions.length) {
      const score = answers.filter((a) => a.correct).length + (selected !== null && selected === questions[currentIdx].correctIndex ? 1 : 0);
      const allAnswers = [...answers];
      // push results
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

  // Selection phase
  if (phase === "select") {
    const topics = activeTab === "maths" ? TOPICS_MATHS : TOPICS_ENGLISH;
    const color = activeTab === "maths" ? Colors.light.navy : Colors.light.rust;
    const light = activeTab === "maths" ? Colors.light.navyLight : Colors.light.rustLight;

    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Text style={styles.headerTitle}>Practice</Text>
          <Text style={styles.headerSub}>Choose a topic to begin</Text>
          <View style={styles.tabRow}>
            {(["maths", "english"] as const).map((s) => {
              const active = activeTab === s;
              const tc = s === "maths" ? Colors.light.navy : Colors.light.rust;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.tab, active && { backgroundColor: tc }]}
                  onPress={() => { Haptics.selectionAsync(); setActiveTab(s); }}
                >
                  <MaterialCommunityIcons
                    name={s === "maths" ? "calculator-variant" : "book-alphabet"}
                    size={18}
                    color={active ? "#fff" : tc}
                  />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {s === "maths" ? "Maths" : "English"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.topicList, { paddingBottom: bottomPad }]}>
          {/* Mixed practice card */}
          <TouchableOpacity
            style={[styles.mixedCard, { borderColor: color }]}
            onPress={() => startSession(activeTab, "Mixed")}
            activeOpacity={0.85}
          >
            <View style={[styles.mixedIcon, { backgroundColor: light }]}>
              <Ionicons name="shuffle" size={22} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mixedTitle, { color }]}>Mixed Practice</Text>
              <Text style={styles.mixedSub}>Random questions from all topics</Text>
            </View>
            <Ionicons name="play-circle" size={28} color={color} />
          </TouchableOpacity>

          {topics.map((t) => {
            const avail = ALL_QUESTIONS.filter((q) => q.subject === activeTab && q.topic === t.name).length;
            return (
              <TouchableOpacity
                key={t.name}
                style={[styles.topicCard, avail === 0 && styles.topicCardDisabled]}
                onPress={() => avail > 0 && startSession(activeTab, t.name)}
                activeOpacity={0.85}
                disabled={avail === 0}
              >
                <View style={[styles.topicIcon, { backgroundColor: light }]}>
                  <MaterialCommunityIcons name={t.icon as any} size={20} color={avail > 0 ? color : Colors.light.textTertiary} />
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

  // Quiz phase
  const q = questions[currentIdx];
  if (!q) return null;

  const progress = (currentIdx + 1) / questions.length;
  const subjectColor = q.subject === "maths" ? Colors.light.navy : Colors.light.rust;

  return (
    <View style={[styles.container, { paddingTop: topPad + 8 }]}>
      {/* Header */}
      <View style={styles.quizHeader}>
        <TouchableOpacity
          style={styles.quitBtn}
          onPress={() => { Haptics.selectionAsync(); setPhase("select"); }}
        >
          <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
        </TouchableOpacity>
        <View style={styles.quizProgressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: subjectColor }]} />
          </View>
          <Text style={styles.qCountTxt}>{currentIdx + 1}/{questions.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.quizBody, { transform: [{ translateY: slideAnim }] }]}>
          {/* Topic pill */}
          <View style={[styles.topicPill, { backgroundColor: subjectColor + "15" }]}>
            <Text style={[styles.topicPillText, { color: subjectColor }]}>{q.topic}</Text>
          </View>

          {/* Question */}
          <View style={styles.qCard}>
            <Text style={styles.qText}>{q.question}</Text>
          </View>

          {/* Options */}
          <View style={styles.options}>
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect = i === q.correctIndex;
              let bg = Colors.light.card;
              let border = Colors.light.border;
              let textColor = Colors.light.text;
              let labelBg = Colors.light.background;

              if (revealed) {
                if (isCorrect) {
                  bg = Colors.light.sageLight;
                  border = Colors.light.sage;
                  textColor = Colors.light.sage;
                  labelBg = Colors.light.sage + "30";
                } else if (isSelected) {
                  bg = Colors.light.rustLight;
                  border = Colors.light.rust;
                  textColor = Colors.light.rust;
                  labelBg = Colors.light.rust + "30";
                }
              } else if (isSelected) {
                bg = Colors.light.navyLight;
                border = Colors.light.navy;
                textColor = Colors.light.navy;
                labelBg = Colors.light.navy + "30";
              }

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optBtn, { backgroundColor: bg, borderColor: border }]}
                  onPress={() => handleSelect(i)}
                  disabled={revealed}
                  activeOpacity={0.82}
                >
                  <View style={[styles.optLabelBox, { backgroundColor: labelBg }]}>
                    <Text style={[styles.optLabelTxt, { color: textColor }]}>
                      {String.fromCharCode(65 + i)}
                    </Text>
                  </View>
                  <Text style={[styles.optText, { color: textColor }]}>{opt}</Text>
                  {revealed && isCorrect && <Ionicons name="checkmark-circle" size={20} color={Colors.light.sage} />}
                  {revealed && isSelected && !isCorrect && <Ionicons name="close-circle" size={20} color={Colors.light.rust} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Explanation */}
          {revealed && (
            <View style={styles.explainBox}>
              <Ionicons name="bulb-outline" size={18} color={Colors.light.gold} style={{ marginTop: 2 }} />
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
  header: {
    backgroundColor: Colors.light.card,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 4,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.light.navy },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, marginBottom: 8 },
  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.textSecondary },
  tabTextActive: { color: "#fff" },
  topicList: { padding: 16, gap: 10 },
  mixedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 2,
    marginBottom: 4,
  },
  mixedIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  mixedTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  mixedSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  topicCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },
  topicCardDisabled: { opacity: 0.45 },
  topicIcon: { width: 42, height: 42, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  topicName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  topicCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  quizHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  quitBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.light.card,
    justifyContent: "center",
    alignItems: "center",
  },
  quizProgressWrap: { flex: 1, gap: 6 },
  progressTrack: { height: 6, backgroundColor: Colors.light.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  qCountTxt: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  quizContent: { padding: 16, gap: 14, paddingBottom: 32 },
  quizBody: { gap: 14 },
  topicPill: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  topicPillText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  qCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.gold,
  },
  qText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.light.navy,
    lineHeight: 27,
  },
  options: { gap: 10 },
  optBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    gap: 12,
  },
  optLabelBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  optLabelTxt: { fontFamily: "Inter_700Bold", fontSize: 13 },
  optText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15, lineHeight: 22 },
  explainBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.light.goldLight,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
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
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 4,
  },
  nextBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
});
