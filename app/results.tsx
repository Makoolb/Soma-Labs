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

function getNextSteps(pct: number, topic: string): string {
  if (pct >= 80) return `Brilliant work! You've mastered ${topic}. Try a harder topic next — you're ready!`;
  if (pct >= 50) return `Good effort! Review the questions you got wrong, then practise ${topic} one more time.`;
  return `Keep going — every expert was once a beginner! Focus on ${topic} basics and try again.`;
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, addSession } = useApp();
  const params = useLocalSearchParams<{
    subject: string; topic: string; score: string; total: string; answers: string;
  }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const score = parseInt(params.score ?? "0", 10);
  const total = parseInt(params.total ?? "0", 10);
  const subject = (params.subject ?? "maths") as "maths" | "english";
  const topic = params.topic ?? "Practice";
  const answers: AnswerRecord[] = params.answers ? JSON.parse(params.answers) : [];

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sessionSaved = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 70, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    if (!sessionSaved.current) {
      sessionSaved.current = true;
      addSession({ date: new Date().toISOString(), subject, topic, score, total, answers });
      if (pct >= 70) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const isExcellent = pct >= 70;
  const isGood = pct >= 40;
  const resultColor = isExcellent ? Colors.light.sage : isGood ? Colors.light.gold : Colors.light.rust;
  const headerBg = isExcellent ? Colors.light.sage : isGood ? Colors.light.gold : Colors.light.rust;
  const resultIcon: any = isExcellent ? "trophy" : isGood ? "thumbs-up" : "refresh-circle";
  const resultLabel = isExcellent ? "Excellent!" : isGood ? "Good effort!" : "Keep going!";

  const correct = answers.filter((a) => a.correct);
  const wrong = answers.filter((a) => !a.correct);

  const topicBreakdown = answers.reduce<Record<string, { correct: number; total: number }>>((acc, a) => {
    if (!acc[a.topic]) acc[a.topic] = { correct: 0, total: 0 };
    acc[a.topic].total++;
    if (a.correct) acc[a.topic].correct++;
    return acc;
  }, {});

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Colored header */}
      <View style={[styles.resultHeader, { backgroundColor: headerBg }]}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: "center", gap: 6 }}>
          <View style={styles.trophyRing}>
            <Ionicons name={resultIcon} size={44} color={headerBg} />
          </View>
          <Text style={styles.resultLabel}>{resultLabel}</Text>
          <Text style={styles.resultScore}>{score}/{total}</Text>
          <View style={styles.pctPill}>
            <Text style={[styles.pctPillTxt, { color: headerBg }]}>{pct}%</Text>
          </View>
        </Animated.View>
        <Text style={styles.resultSub}>{profile?.name}'s {topic} session</Text>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]} showsVerticalScrollIndicator={false}>
          {/* Breakdown cards */}
          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownCard, { backgroundColor: Colors.light.sageLight, borderColor: Colors.light.sage }]}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.light.sage} />
              <Text style={[styles.breakdownNum, { color: Colors.light.sage }]}>{correct.length}</Text>
              <Text style={styles.breakdownLbl}>Correct</Text>
            </View>
            <View style={[styles.breakdownCard, { backgroundColor: Colors.light.rustLight, borderColor: Colors.light.rust }]}>
              <Ionicons name="close-circle" size={28} color={Colors.light.rust} />
              <Text style={[styles.breakdownNum, { color: Colors.light.rust }]}>{wrong.length}</Text>
              <Text style={styles.breakdownLbl}>Incorrect</Text>
            </View>
            <View style={[styles.breakdownCard, { backgroundColor: Colors.light.goldLight, borderColor: Colors.light.gold }]}>
              <Ionicons name="star" size={28} color={Colors.light.gold} />
              <Text style={[styles.breakdownNum, { color: Colors.light.gold }]}>+{score * 10}</Text>
              <Text style={styles.breakdownLbl}>XP earned</Text>
            </View>
          </View>

          {/* Topic breakdown */}
          {Object.entries(topicBreakdown).length > 1 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Topic Breakdown</Text>
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
                      <View style={[styles.miniPill, { backgroundColor: tColor }]}>
                        <Text style={styles.miniPillTxt}>{Math.round(tPct * 100)}%</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Next steps */}
          <View style={[styles.nextCard, { borderLeftColor: resultColor }]}>
            <View style={[styles.nextCardHeader, { backgroundColor: resultColor + "18" }]}>
              <Ionicons name="navigate" size={16} color={resultColor} />
              <Text style={[styles.nextCardTitle, { color: resultColor }]}>What's next?</Text>
            </View>
            <Text style={styles.nextCardBody}>{getNextSteps(pct, topic)}</Text>
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: subject === "maths" ? Colors.light.optionB : Colors.light.rust }]}
            onPress={() => { Haptics.selectionAsync(); router.dismiss(); }}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.primaryBtnTxt}>Practice Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => { Haptics.selectionAsync(); router.replace("/(tabs)"); }}
          >
            <Ionicons name="home-outline" size={18} color={Colors.light.navy} />
            <Text style={styles.secondaryBtnTxt}>Go to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  resultHeader: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 8,
  },
  trophyRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  resultLabel: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff" },
  resultScore: { fontFamily: "Inter_700Bold", fontSize: 42, color: "#fff", lineHeight: 48 },
  pctPill: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  pctPillTxt: { fontFamily: "Inter_700Bold", fontSize: 18 },
  resultSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.8)" },
  content: { padding: 16, gap: 14 },
  breakdownRow: { flexDirection: "row", gap: 10 },
  breakdownCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
  },
  breakdownNum: { fontFamily: "Inter_700Bold", fontSize: 26 },
  breakdownLbl: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, textAlign: "center" },
  card: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 16, gap: 12 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy },
  divider: { height: 1, backgroundColor: Colors.light.border },
  topicRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  topicName: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.text, flex: 1 },
  miniBar: { width: 60, height: 6, backgroundColor: Colors.light.border, borderRadius: 3, overflow: "hidden" },
  miniBarFill: { height: "100%", borderRadius: 3 },
  miniPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  miniPillTxt: { fontFamily: "Inter_700Bold", fontSize: 11, color: "#fff" },
  nextCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    overflow: "hidden",
    borderLeftWidth: 5,
  },
  nextCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    paddingLeft: 14,
  },
  nextCardTitle: { fontFamily: "Inter_700Bold", fontSize: 14 },
  nextCardBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 22,
    padding: 14,
    paddingTop: 0,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 18,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  secondaryBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
});
