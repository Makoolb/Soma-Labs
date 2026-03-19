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
import * as Speech from "expo-speech";
import Colors from "@/constants/colors";
import { useApp, type SkillMap } from "@/context/AppContext";
import { useElapsedTime } from "@/lib/useElapsedTime";
import diagData from "@/data/diagnosticQuestions.json";

// ─── TYPES ────────────────────────────────────────────────────────────────────

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

interface QuizResult {
  questionIdx: number;
  topic: string;
  correct: boolean;
  skipped: boolean;
  selectedIndex: number | null;
}

type Phase = "intro" | "quiz" | "summary" | "corrections";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const LETTER = ["A", "B", "C", "D"];
const SESSION_SIZE = 20;

// ─── QUESTION PICKER ─────────────────────────────────────────────────────────

function pickQuestions(grade: string): DiagQuestion[] {
  const pool: DiagQuestion[] = ((diagData as Record<string, DiagQuestion[]>)[grade] ?? []);
  if (pool.length === 0) return [];

  const byTopic: Record<string, DiagQuestion[]> = {};
  for (const q of pool) {
    if (!byTopic[q.topic]) byTopic[q.topic] = [];
    byTopic[q.topic].push(q);
  }

  const selected: DiagQuestion[] = [];
  const used = new Set<string>();

  for (const topicQs of Object.values(byTopic)) {
    const shuffled = [...topicQs].sort(() => Math.random() - 0.5);
    const pick = shuffled[0];
    if (pick) { selected.push(pick); used.add(pick.id); }
  }

  const remaining = pool.filter((q) => !used.has(q.id)).sort(() => Math.random() - 0.5);
  for (const q of remaining) {
    if (selected.length >= SESSION_SIZE) break;
    selected.push(q);
    used.add(q.id);
  }

  return selected.slice(0, SESSION_SIZE).sort(() => Math.random() - 0.5);
}

// ─── SCREEN ───────────────────────────────────────────────────────────────────

export default function DiagnosticScreen() {
  const insets = useSafeAreaInsets();
  const { profile, saveDiagnosticResult, saveSkillMap } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<DiagQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [correctionIdx, setCorrectionIdx] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const { formattedTime } = useElapsedTime();

  useEffect(() => {
    if (profile) setQuestions(pickQuestions(profile.grade));
  }, [profile]);

  // Stop speech when navigating away from corrections or between corrections
  useEffect(() => {
    return () => { Speech.stop(); };
  }, [correctionIdx, phase]);

  // ─── SAVE & NAVIGATE ────────────────────────────────────────────────

  async function saveAndNavigate(finalResults: QuizResult[]) {
    const answeredResults = finalResults.filter((r) => !r.skipped);

    const topicCorrect: Record<string, number> = {};
    const topicTotal: Record<string, number> = {};
    for (const r of answeredResults) {
      topicTotal[r.topic] = (topicTotal[r.topic] ?? 0) + 1;
      if (r.correct) topicCorrect[r.topic] = (topicCorrect[r.topic] ?? 0) + 1;
    }
    const skillMap: SkillMap = {};
    for (const topic of Object.keys(topicTotal)) {
      skillMap[topic] = Math.round(((topicCorrect[topic] ?? 0) / topicTotal[topic]) * 100);
    }

    const totalCorrect = answeredResults.filter((r) => r.correct).length;
    await saveDiagnosticResult({
      date: new Date().toISOString(),
      mathsScore: totalCorrect,
      mathsTotal: answeredResults.length,
      englishScore: 0,
      englishTotal: 0,
    });

    await saveSkillMap(skillMap);
    router.replace("/(tabs)");
  }

  // ─── QUIZ LOGIC ─────────────────────────────────────────────────────

  function handleSelect(idx: number) {
    if (hasConfirmed) return;
    Haptics.selectionAsync();
    setSelected(idx);
  }

  function handleSkip() {
    Haptics.selectionAsync();
    const q = questions[current];
    const isLast = current + 1 >= questions.length;

    setResults((prev) => {
      const updated: QuizResult[] = [
        ...prev,
        { questionIdx: current, topic: q.topic, correct: false, skipped: true, selectedIndex: null },
      ];
      if (isLast) {
        setTimeout(() => setPhase("summary"), 0);
      }
      return updated;
    });

    if (!isLast) {
      setSelected(null);
      advanceQuestion();
    }
  }

  function handleNext() {
    Haptics.selectionAsync();
    if (current + 1 >= questions.length) {
      setPhase("summary");
      return;
    }
    advanceQuestion();
  }

  function advanceQuestion() {
    setHasConfirmed(false);
    setSelected(null);
    Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }).start(() => {
      slideAnim.setValue(20);
      setCurrent((c) => c + 1);
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
  }

  // ─── SPEECH ─────────────────────────────────────────────────────────

  async function speakText(text: string, onDone?: () => void) {
    try {
      await Speech.stop();

      const cleaned = text
        .replace(/✓\s*/g, "Check: ")
        .replace(/→/g, " gives ")
        .replace(/÷/g, " divided by ")
        .replace(/×/g, " times ")
        .replace(/²/g, " squared")
        .replace(/³/g, " cubed")
        .replace(/√/g, " square root of ")
        .replace(/₦/g, " naira ");

      Speech.speak(cleaned, {
        language: "en-GB",
        rate: 0.88,
        pitch: 1.0,
        onDone,
        onError: (err) => {
          console.log("Speech error:", err);
          onDone?.();
        },
      });
    } catch (e) {
      console.log("speakText failed:", e);
      onDone?.();
    }
  }

  function handleListen(text: string) {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    speakText(text, () => setIsSpeaking(false));
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
            { icon: "time" as const, color: Colors.light.gold, text: "No time limit — take as long as you need" },
            { icon: "bulb" as const, color: Colors.light.sage, text: "Answer or skip — results and corrections shown at the end" },
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

  // ─── SUMMARY ─────────────────────────────────────────────────────────

  if (phase === "summary") {
    const answeredResults = results.filter((r) => !r.skipped);
    const totalCorrect = answeredResults.filter((r) => r.correct).length;
    const totalAnswered = answeredResults.length;
    const totalWrong = answeredResults.filter((r) => !r.correct).length;
    const totalSkipped = results.filter((r) => r.skipped).length;
    const needsCorrection = results.filter((r) => !r.correct);
    const percentage = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const performanceMessage =
      percentage >= 80 ? "Excellent foundation!" :
      percentage >= 60 ? "Good grasp of the topics" :
      percentage >= 40 ? "Room for improvement" :
      "You'll benefit from focused practice";

    return (
      <View style={[styles.summaryRoot, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        <ScrollView contentContainerStyle={styles.summaryCont} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryHero}>
            <View style={[styles.scoreIcon, {
              backgroundColor: percentage >= 70 ? Colors.light.sage : percentage >= 50 ? Colors.light.gold : Colors.light.rust,
            }]}>
              <Ionicons name={percentage >= 70 ? "checkmark-circle" : "alert-circle"} size={52} color="#fff" />
            </View>
            <Text style={styles.summaryTitle}>Test Complete!</Text>
            <Text style={styles.summaryMessage}>{performanceMessage}</Text>
          </View>

          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Your Score</Text>
              <Text style={styles.scoreBig}>{totalCorrect}/{totalAnswered}</Text>
            </View>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreBarFill, {
                width: `${percentage}%`,
                backgroundColor: percentage >= 70 ? Colors.light.sage : percentage >= 50 ? Colors.light.gold : Colors.light.rust,
              }]} />
            </View>
            <Text style={styles.percentTxt}>{percentage}% correct</Text>

            <View style={styles.statRow}>
              <View style={[styles.statChip, { backgroundColor: Colors.light.sage + "18", borderColor: Colors.light.sage + "40" }]}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.light.sage} />
                <Text style={[styles.statChipTxt, { color: Colors.light.sage }]}>{totalCorrect} correct</Text>
              </View>
              {totalWrong > 0 && (
                <View style={[styles.statChip, { backgroundColor: Colors.light.rust + "18", borderColor: Colors.light.rust + "40" }]}>
                  <Ionicons name="close-circle" size={16} color={Colors.light.rust} />
                  <Text style={[styles.statChipTxt, { color: Colors.light.rust }]}>{totalWrong} wrong</Text>
                </View>
              )}
              {totalSkipped > 0 && (
                <View style={[styles.statChip, { backgroundColor: Colors.light.gold + "18", borderColor: Colors.light.gold + "40" }]}>
                  <Ionicons name="arrow-forward-circle" size={16} color={Colors.light.gold} />
                  <Text style={[styles.statChipTxt, { color: Colors.light.gold }]}>{totalSkipped} skipped</Text>
                </View>
              )}
            </View>
          </View>

          {needsCorrection.length > 0 && (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => { setCorrectionIdx(0); setPhase("corrections"); }}
            >
              <Ionicons name="school" size={20} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewBtnTitle}>Review Corrections</Text>
                <Text style={styles.reviewBtnSub}>{needsCorrection.length} question{needsCorrection.length !== 1 ? "s" : ""} to review</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={() => saveAndNavigate(results)}>
            <Text style={styles.primaryBtnText}>
              {needsCorrection.length > 0 ? "Skip to Skill Map" : "View My Skill Map"}
            </Text>
            <Ionicons name="map" size={18} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── CORRECTIONS ─────────────────────────────────────────────────────

  if (phase === "corrections") {
    const wrongItems = results.filter((r) => !r.correct);
    const item = wrongItems[correctionIdx];
    if (!item) return null;
    const q = questions[item.questionIdx];
    if (!q) return null;

    const isLast = correctionIdx + 1 >= wrongItems.length;

    function handleNextCorrection() {
      Haptics.selectionAsync();
      Speech.stop();
      setIsSpeaking(false);
      if (isLast) {
        saveAndNavigate(results);
      } else {
        setCorrectionIdx((i) => i + 1);
      }
    }

    return (
      <View style={[styles.quizRoot, { paddingTop: topPad }]}>
        {/* Header */}
        <View style={[styles.quizBar, { backgroundColor: Colors.light.rust }]}>
          <View style={styles.quizBarTop}>
            <View style={styles.qBadge}>
              <Text style={styles.qBadgeTxt}>{correctionIdx + 1} / {wrongItems.length}</Text>
            </View>
            <View style={styles.topicPill}>
              <Text style={styles.topicPillTxt}>{q.topic}</Text>
            </View>
            <View style={[styles.diffPill, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Text style={styles.diffPillTxt}>{item.skipped ? "Skipped" : "Wrong"}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${((correctionIdx + 1) / wrongItems.length) * 100}%`,
              backgroundColor: "#fff",
            }]} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.quizScroll, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 14 }}>
            {/* Question */}
            <View style={styles.questionCard}>
              <Text style={styles.subtopicLabel}>{q.subtopic}</Text>
              <Text style={styles.questionText}>{q.question}</Text>
            </View>

            {/* Options — correct green, wrong answer red */}
            <View style={styles.options}>
              {q.options.map((opt, i) => {
                const isCorrect = i === q.correctIndex;
                const isWrongPick = !item.skipped && item.selectedIndex === i && !isCorrect;

                let bg = Colors.light.card;
                let borderColor = Colors.light.border;
                let labelBg = Colors.light.optionB;
                let textColor = Colors.light.text;
                let icon: "checkmark-circle" | "close-circle" | null = null;

                if (isCorrect) {
                  bg = Colors.light.sageLight;
                  borderColor = Colors.light.sage;
                  labelBg = Colors.light.sage;
                  textColor = "#1A5E35";
                  icon = "checkmark-circle";
                } else if (isWrongPick) {
                  bg = Colors.light.rustLight;
                  borderColor = Colors.light.rust;
                  labelBg = Colors.light.rust;
                  textColor = Colors.light.rust;
                  icon = "close-circle";
                }

                return (
                  <View
                    key={i}
                    style={[styles.optBtn, { backgroundColor: bg, borderColor }]}
                  >
                    <View style={[styles.optBadge, { backgroundColor: labelBg }]}>
                      <Text style={styles.optBadgeTxt}>{LETTER[i]}</Text>
                    </View>
                    <Text style={[styles.optText, { color: textColor }]}>{opt}</Text>
                    {icon && (
                      <Ionicons
                        name={icon}
                        size={22}
                        color={isCorrect ? Colors.light.sage : Colors.light.rust}
                      />
                    )}
                  </View>
                );
              })}
            </View>

            {/* Explanation */}
            <View style={styles.explanationCard}>
              <View style={styles.explanationHeader}>
                <Ionicons name="bulb" size={20} color={Colors.light.gold} />
                <Text style={styles.explanationTitle}>Explanation</Text>
                <TouchableOpacity
                  style={[styles.listenBtn, isSpeaking && styles.listenBtnActive]}
                  onPress={() => handleListen(q.explanation)}
                >
                  <Ionicons
                    name={isSpeaking ? "stop-circle" : "volume-high"}
                    size={16}
                    color={isSpeaking ? Colors.light.rust : Colors.light.navy}
                  />
                  <Text style={[styles.listenBtnTxt, isSpeaking && { color: Colors.light.rust }]}>
                    {isSpeaking ? "Stop" : "Listen"}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.explanationText}>{q.explanation}</Text>
            </View>

            {/* Navigation buttons */}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleNextCorrection}>
              <Text style={styles.primaryBtnText}>
                {isLast ? "View My Skill Map" : "Next Correction"}
              </Text>
              <Ionicons name={isLast ? "map" : "arrow-forward"} size={18} color="#fff" />
            </TouchableOpacity>

            {!isLast && (
              <TouchableOpacity style={styles.skipBtn} onPress={() => saveAndNavigate(results)}>
                <Ionicons name="map-outline" size={16} color={Colors.light.textSecondary} />
                <Text style={styles.skipBtnText}>Skip to Skill Map</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── QUIZ ────────────────────────────────────────────────────────────

  const q = questions[current];
  if (!q) return null;

  const isSelected = selected !== null;
  const progress = (current + 1) / questions.length;

  return (
    <View style={[styles.quizRoot, { paddingTop: topPad }]}>
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
              q.difficulty === "Hard" ? Colors.light.gold + "60" :
              Colors.light.rust + "60",
          }]}>
            <Text style={styles.diffPillTxt}>{q.difficulty}</Text>
          </View>
          <View style={styles.timerBadge}>
            <Ionicons name="timer" size={14} color="#fff" />
            <Text style={styles.timerTxt}>{formattedTime}</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.quizScroll, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateY: slideAnim }], gap: 14 }}>
          {/* Question */}
          <View style={styles.questionCard}>
            <Text style={styles.subtopicLabel}>{q.subtopic}</Text>
            <Text style={styles.questionText}>{q.question}</Text>
          </View>

          {/* Options — no feedback revealed */}
          <View style={styles.options}>
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              const bg = isSelected ? Colors.light.optionB + "18" : Colors.light.card;
              const borderColor = isSelected ? Colors.light.optionB : Colors.light.border;

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optBtn, { backgroundColor: bg, borderColor }]}
                  onPress={() => { if (!hasConfirmed) handleSelect(i); }}
                  disabled={hasConfirmed}
                  activeOpacity={hasConfirmed ? 1 : 0.78}
                >
                  <View style={[styles.optBadge, { backgroundColor: Colors.light.optionB }]}>
                    <Text style={styles.optBadgeTxt}>{LETTER[i]}</Text>
                  </View>
                  <Text style={[styles.optText, { color: Colors.light.text }]}>{opt}</Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.light.optionB} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action */}
          {isSelected ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                if (selected === null) return;
                const isCorrect = selected === q.correctIndex;
                setResults((prev) => [
                  ...prev,
                  { questionIdx: current, topic: q.topic, correct: isCorrect, skipped: false, selectedIndex: selected },
                ]);
                setHasConfirmed(true);
                handleNext();
              }}
            >
              <Text style={styles.primaryBtnText}>
                {current + 1 >= questions.length ? "See My Results" : "Next Question"}
              </Text>
              <Ionicons
                name={current + 1 >= questions.length ? "bar-chart" : "arrow-forward"}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Ionicons name="arrow-forward" size={16} color={Colors.light.textSecondary} />
              <Text style={styles.skipBtnText}>Skip this question</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Intro ──
  introRoot: { flex: 1, backgroundColor: Colors.light.navy },
  introHero: {
    alignItems: "center", paddingHorizontal: 24,
    paddingTop: 24, paddingBottom: 28, gap: 10,
  },
  introIconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  introTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff", textAlign: "center" },
  introSub: {
    fontFamily: "Inter_400Regular", fontSize: 17,
    color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 25,
  },
  introBody: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, gap: 14, flexGrow: 1,
  },
  infoCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.light.card, borderRadius: 14,
    padding: 14, borderLeftWidth: 4,
  },
  infoText: { fontFamily: "Inter_500Medium", fontSize: 16, color: Colors.light.text, flex: 1 },

  // ── Buttons ──
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.light.gold, borderRadius: 18, paddingVertical: 18,
    shadowColor: Colors.light.gold,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  skipBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.light.card, borderRadius: 18, paddingVertical: 16,
    borderWidth: 2, borderColor: Colors.light.border,
  },
  skipBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.textSecondary },
  reviewBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.light.navy, borderRadius: 18, padding: 18,
  },
  reviewBtnTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  reviewBtnSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 },

  // ── Summary ──
  summaryRoot: { flex: 1, backgroundColor: Colors.light.background },
  summaryCont: { padding: 24, gap: 20, flexGrow: 1 },
  summaryHero: { alignItems: "center", gap: 16 },
  scoreIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  summaryTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.light.navy, textAlign: "center" },
  summaryMessage: { fontFamily: "Inter_500Medium", fontSize: 16, color: Colors.light.textSecondary, textAlign: "center" },
  scoreCard: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 20, gap: 12 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.textSecondary },
  scoreBig: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.light.navy },
  scoreBar: { height: 12, backgroundColor: Colors.light.border, borderRadius: 6, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 6 },
  percentTxt: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.navy, textAlign: "center" },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  statChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1,
  },
  statChipTxt: { fontFamily: "Inter_600SemiBold", fontSize: 13 },

  // ── Quiz / Corrections shared ──
  quizRoot: { flex: 1, backgroundColor: Colors.light.background },
  quizBar: {
    backgroundColor: Colors.light.navy,
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 12, gap: 10,
  },
  quizBarTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  qBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  qBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  topicPill: { flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  topicPillTxt: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  diffPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  diffPillTxt: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  timerBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  timerTxt: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  progressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.light.gold, borderRadius: 4 },
  quizScroll: { padding: 16 },
  questionCard: {
    backgroundColor: Colors.light.cream, borderRadius: 20,
    padding: 20, borderWidth: 2, borderColor: "#F0E8D8", gap: 6,
  },
  subtopicLabel: {
    fontFamily: "Inter_600SemiBold", fontSize: 13,
    color: Colors.light.gold, textTransform: "uppercase", letterSpacing: 1,
  },
  questionText: { fontFamily: "Inter_600SemiBold", fontSize: 20, color: Colors.light.navy, lineHeight: 32 },
  options: { gap: 10 },
  optBtn: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16, padding: 14, borderWidth: 2, gap: 12,
  },
  optBadge: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  optBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  optText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 18, lineHeight: 26 },

  // ── Explanation (corrections phase) ──
  explanationCard: {
    backgroundColor: Colors.light.goldLight ?? Colors.light.card,
    borderRadius: 18, padding: 18, gap: 12,
    borderWidth: 2, borderColor: Colors.light.gold + "30",
  },
  explanationHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  explanationTitle: {
    flex: 1, fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy,
  },
  explanationText: {
    fontFamily: "Inter_400Regular", fontSize: 14,
    color: Colors.light.text, lineHeight: 22,
  },
  listenBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  listenBtnActive: {
    backgroundColor: Colors.light.rust + "12",
    borderColor: Colors.light.rust + "50",
  },
  listenBtnTxt: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.light.navy },
});
