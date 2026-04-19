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
import { TIER_COLORS, type BadgeDef } from "@shared/badges";

const WEAK_COLORS = [Colors.light.rust, Colors.light.gold, Colors.light.optionC];

function getNextSteps(pct: number, topic: string, isSmartSession: boolean, weakTopics: string[]): string {
  if (isSmartSession) {
    const focus = weakTopics.slice(0, 2).join(" and ");
    if (pct >= 80) return `Outstanding! You're making excellent progress on your weak areas. Keep going with more Smart Sessions!`;
    if (pct >= 50) return `Good progress! Review any incorrect answers, especially in ${focus || "your weak topics"}, then try another Smart Session.`;
    return `These are tough topics — that's why they need the most practice. Focus on ${focus || "your weak areas"} and try again. You'll improve!`;
  }
  if (pct >= 80) return `Brilliant work! You've mastered ${topic}. Try a harder topic next — you're ready!`;
  if (pct >= 50) return `Good effort! Review the questions you got wrong, then practise ${topic} one more time.`;
  return `Keep going — every expert was once a beginner! Focus on ${topic} basics and try again.`;
}

function BadgeCelebrationCard({ badge, index }: { badge: BadgeDef; index: number }) {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 180;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.badgeCard,
        { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
      ]}
    >
      <View style={[styles.badgeIconCircle, { backgroundColor: badge.color }]}>
        <Ionicons name={badge.icon as any} size={26} color="#fff" />
      </View>
      <View style={styles.badgeCardText}>
        <View style={styles.badgeCardNameRow}>
          <Text style={styles.badgeCardName}>{badge.name}</Text>
          <View style={[styles.tierPill, { backgroundColor: badge.color + "22", borderColor: badge.color + "55" }]}>
            <Text style={[styles.tierPillTxt, { color: badge.color }]}>{badge.tier}</Text>
          </View>
        </View>
        <Text style={styles.badgeCardTagline}>{badge.tagline}</Text>
      </View>
    </Animated.View>
  );
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, addSession, newlyEarnedBadges, clearNewlyEarnedBadges } = useApp();
  const params = useLocalSearchParams<{
    subject: string; topic: string; score: string; total: string;
    answers: string; mode?: string; weakTopics?: string;
  }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const score = parseInt(params.score ?? "0", 10);
  const total = parseInt(params.total ?? "0", 10);
  const subject = (params.subject ?? "maths") as "maths" | "english";
  const topic = params.topic ?? "Practice";
  const isSmartSession = params.mode === "smart";
  const weakTopicsPracticed = params.weakTopics ? params.weakTopics.split(",").filter(Boolean) : [];
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

  // Clear newly earned badges when navigating away
  useEffect(() => {
    return () => {
      clearNewlyEarnedBadges();
    };
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
        <Text style={styles.resultSub}>
          {isSmartSession
            ? `${profile?.name}'s Smart Practice session`
            : `${profile?.name}'s ${topic} session`}
        </Text>
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
              <Text style={[styles.breakdownNum, { color: Colors.light.gold }]}>+{score * 10 + 20}</Text>
              <Text style={styles.breakdownLbl}>XP earned</Text>
            </View>
          </View>

          {/* Badge celebration */}
          {newlyEarnedBadges.length > 0 && (
            <View style={styles.badgesSection}>
              <View style={styles.badgesSectionHeader}>
                <View style={styles.badgesSectionIcon}>
                  <Ionicons name="trophy" size={18} color={Colors.light.gold} />
                </View>
                <Text style={styles.badgesSectionTitle}>
                  {newlyEarnedBadges.length === 1 ? "Badge Earned!" : `${newlyEarnedBadges.length} Badges Earned!`}
                </Text>
              </View>
              {newlyEarnedBadges.map((badge, i) => (
                <BadgeCelebrationCard key={`${badge.id}-${i}`} badge={badge} index={i} />
              ))}
            </View>
          )}

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

          {/* Smart session: weak topics practiced */}
          {isSmartSession && weakTopicsPracticed.length > 0 && (
            <View style={styles.smartInfoCard}>
              <View style={styles.smartInfoHeader}>
                <Ionicons name="flash" size={16} color={Colors.light.gold} />
                <Text style={styles.smartInfoTitle}>Weak topics practised</Text>
              </View>
              {weakTopicsPracticed.map((t, i) => (
                <View key={t} style={styles.smartTopicRow}>
                  <View style={[styles.smartTopicDot, { backgroundColor: WEAK_COLORS[i] ?? Colors.light.textTertiary }]} />
                  <Text style={styles.smartTopicText}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Next steps */}
          <View style={[styles.nextCard, { borderLeftColor: resultColor }]}>
            <View style={[styles.nextCardHeader, { backgroundColor: resultColor + "18" }]}>
              <Ionicons name="navigate" size={16} color={resultColor} />
              <Text style={[styles.nextCardTitle, { color: resultColor }]}>What's next?</Text>
            </View>
            <Text style={styles.nextCardBody}>{getNextSteps(pct, topic, isSmartSession, weakTopicsPracticed)}</Text>
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

  // Badge celebration
  badgesSection: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: Colors.light.gold + "40",
  },
  badgesSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badgesSectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.gold + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  badgesSectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.light.navy,
  },
  badgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F8FAFF",
    borderRadius: 14,
    padding: 12,
  },
  badgeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeCardText: { flex: 1, gap: 4 },
  badgeCardNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badgeCardName: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy },
  tierPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  tierPillTxt: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  badgeCardTagline: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },

  card: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 16, gap: 12 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy },
  divider: { height: 1, backgroundColor: Colors.light.border },
  topicRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  topicName: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.text, flex: 1 },
  miniBar: { width: 60, height: 6, backgroundColor: Colors.light.border, borderRadius: 3, overflow: "hidden" },
  miniBarFill: { height: "100%", borderRadius: 3 },
  miniPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  miniPillTxt: { fontFamily: "Inter_700Bold", fontSize: 11, color: "#fff" },
  smartInfoCard: {
    backgroundColor: Colors.light.goldLight,
    borderRadius: 18, padding: 14, gap: 10,
    borderLeftWidth: 4, borderLeftColor: Colors.light.gold,
  },
  smartInfoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  smartInfoTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#8B5E00" },
  smartTopicRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  smartTopicDot: { width: 8, height: 8, borderRadius: 4 },
  smartTopicText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.text },
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
