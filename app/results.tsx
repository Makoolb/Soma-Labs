import React, { useEffect, useRef } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, type AnswerRecord } from "@/context/AppContext";

function getNextSteps(subject: string, pct: number, topic: string): string {
  if (pct >= 80) {
    return `Brilliant work! You've mastered ${topic}. Try a harder topic next — you're ready for the challenge!`;
  } else if (pct >= 50) {
    return `Good effort! Review the questions you got wrong, then practise ${topic} one more time to lock in your understanding.`;
  } else {
    return `Keep going — every expert was once a beginner! Focus on ${topic} basics and try again. SomaLabs believes in you!`;
  }
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, addSession } = useApp();
  const params = useLocalSearchParams<{
    subject: string;
    topic: string;
    score: string;
    total: string;
    answers: string;
  }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const score = parseInt(params.score ?? "0", 10);
  const total = parseInt(params.total ?? "0", 10);
  const subject = (params.subject ?? "maths") as "maths" | "english";
  const topic = params.topic ?? "Practice";
  const answers: AnswerRecord[] = params.answers ? JSON.parse(params.answers) : [];

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const sessionSaved = useRef(false);
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    if (!sessionSaved.current) {
      sessionSaved.current = true;
      addSession({
        date: new Date().toISOString(),
        subject,
        topic,
        score,
        total,
        answers,
      });
      if (pct >= 70) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const resultColor = pct >= 70 ? Colors.light.sage : pct >= 40 ? Colors.light.gold : Colors.light.rust;
  const resultIcon: any = pct >= 70 ? "trophy" : pct >= 40 ? "thumbs-up" : "refresh-circle";
  const resultLabel = pct >= 70 ? "Excellent!" : pct >= 40 ? "Good effort!" : "Keep practising!";

  const correct = answers.filter((a) => a.correct);
  const wrong = answers.filter((a) => !a.correct);

  const topicBreakdown = answers.reduce<Record<string, { correct: number; total: number }>>((acc, a) => {
    if (!acc[a.topic]) acc[a.topic] = { correct: 0, total: 0 };
    acc[a.topic].total++;
    if (a.correct) acc[a.topic].correct++;
    return acc;
  }, {});

  return (
    <View style={[styles.container, { paddingTop: topPad + 8, paddingBottom: bottomPad }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Score ring */}
          <View style={styles.center}>
            <Animated.View style={[styles.scoreRing, { borderColor: resultColor, transform: [{ scale: scaleAnim }] }]}>
              <Ionicons name={resultIcon} size={32} color={resultColor} />
              <Text style={[styles.scorePct, { color: resultColor }]}>{pct}%</Text>
              <Text style={styles.scoreRaw}>{score}/{total}</Text>
            </Animated.View>
            <Text style={[styles.resultLabel, { color: resultColor }]}>{resultLabel}</Text>
            <Text style={styles.resultName}>{profile?.name}'s {topic} results</Text>
          </View>

          {/* Breakdown cards */}
          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownCard, { borderColor: Colors.light.sage }]}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.light.sage} />
              <Text style={[styles.breakdownNum, { color: Colors.light.sage }]}>{correct.length}</Text>
              <Text style={styles.breakdownLabel}>Correct</Text>
            </View>
            <View style={[styles.breakdownCard, { borderColor: Colors.light.rust }]}>
              <Ionicons name="close-circle" size={24} color={Colors.light.rust} />
              <Text style={[styles.breakdownNum, { color: Colors.light.rust }]}>{wrong.length}</Text>
              <Text style={styles.breakdownLabel}>Incorrect</Text>
            </View>
            <View style={[styles.breakdownCard, { borderColor: Colors.light.gold }]}>
              <Ionicons name="star" size={24} color={Colors.light.gold} />
              <Text style={[styles.breakdownNum, { color: Colors.light.gold }]}>+{score * 10}</Text>
              <Text style={styles.breakdownLabel}>XP earned</Text>
            </View>
          </View>

          {/* Topic breakdown */}
          {Object.entries(topicBreakdown).length > 1 && (
            <View style={styles.topicCard}>
              <Text style={styles.topicCardTitle}>Topic Breakdown</Text>
              {Object.entries(topicBreakdown).map(([t, data], i) => {
                const tPct = data.total > 0 ? data.correct / data.total : 0;
                const tColor = tPct >= 0.7 ? Colors.light.sage : tPct >= 0.4 ? Colors.light.gold : Colors.light.rust;
                return (
                  <View key={t}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.topicRow}>
                      <Text style={styles.topicName} numberOfLines={1}>{t}</Text>
                      <View style={styles.miniBar}>
                        <View style={[styles.miniBarFill, { width: `${tPct * 100}%`, backgroundColor: tColor }]} />
                      </View>
                      <Text style={[styles.topicPct, { color: tColor }]}>{Math.round(tPct * 100)}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Next steps */}
          <View style={[styles.nextStepsCard, { borderColor: resultColor + "50" }]}>
            <View style={styles.nextStepsHeader}>
              <Ionicons name="navigate-outline" size={18} color={resultColor} />
              <Text style={[styles.nextStepsTitle, { color: resultColor }]}>What's next?</Text>
            </View>
            <Text style={styles.nextStepsBody}>{getNextSteps(subject, pct, topic)}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.practiceAgainBtn}
              onPress={() => {
                Haptics.selectionAsync();
                router.dismiss();
              }}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.practiceAgainText}>Practice Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => {
                Haptics.selectionAsync();
                router.replace("/(tabs)");
              }}
            >
              <Ionicons name="home-outline" size={18} color={Colors.light.navy} />
              <Text style={styles.homeBtnText}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, gap: 20, paddingBottom: 32 },
  center: { alignItems: "center", gap: 10, paddingVertical: 8 },
  scoreRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    gap: 2,
  },
  scorePct: { fontFamily: "Inter_700Bold", fontSize: 28 },
  scoreRaw: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  resultLabel: { fontFamily: "Inter_700Bold", fontSize: 22 },
  resultName: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  breakdownRow: { flexDirection: "row", gap: 10 },
  breakdownCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
  },
  breakdownNum: { fontFamily: "Inter_700Bold", fontSize: 22 },
  breakdownLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  topicCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  topicCardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.light.navy,
    marginBottom: 4,
  },
  divider: { height: 1, backgroundColor: Colors.light.border },
  topicRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  topicName: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
  },
  miniBar: {
    width: 70,
    height: 5,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  miniBarFill: { height: "100%", borderRadius: 3 },
  topicPct: { fontFamily: "Inter_600SemiBold", fontSize: 12, width: 32, textAlign: "right" },
  nextStepsCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1.5,
  },
  nextStepsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  nextStepsTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  nextStepsBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 22,
  },
  actions: { gap: 10 },
  practiceAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.navy,
    borderRadius: 16,
    paddingVertical: 18,
  },
  practiceAgainText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  homeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.light.navy,
  },
});
