import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors, { OPTION_COLORS } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import questionsData from "@/data/questions.json";

const QUICK_TOPICS = [
  { subject: "maths" as const, topic: "Basic Operations", icon: "plus-minus-variant", color: Colors.light.optionB },
  { subject: "english" as const, topic: "Grammar & Tenses", icon: "format-text", color: Colors.light.rust },
  { subject: "maths" as const, topic: "Fractions & Decimals", icon: "fraction-one-half", color: Colors.light.optionC },
  { subject: "english" as const, topic: "Vocabulary & Spelling", icon: "alphabetical", color: Colors.light.optionD },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, diagnosticResult, sessions, streakDays, totalXP } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const recentSessions = sessions.slice(0, 4);
  const today = new Date().toDateString();
  const todaySessions = sessions.filter((s) => new Date(s.date).toDateString() === today);
  const todayScore = todaySessions.reduce((a, s) => a + s.score, 0);
  const todayTotal = todaySessions.reduce((a, s) => a + s.total, 0);
  const level = Math.floor(totalXP / 100) + 1;
  const xpInLevel = totalXP % 100;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 12, paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text style={styles.heroGreet}>Good day,</Text>
            <Text style={styles.heroName}>{profile?.name}</Text>
            <View style={styles.heroBadgeRow}>
              <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
                <Text style={styles.badgeTxt}>{profile?.grade}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
                <Text style={styles.badgeTxt}>{profile?.subject}</Text>
              </View>
            </View>
          </View>
          <View style={styles.streakCircle}>
            <Ionicons name="flame" size={20} color={Colors.light.gold} />
            <Text style={styles.streakNum}>{streakDays}</Text>
            <Text style={styles.streakLbl}>streak</Text>
          </View>
        </View>
        {/* XP bar */}
        <View style={styles.xpWrap}>
          <View style={styles.xpLabelRow}>
            <Text style={styles.xpLbl}>Level {level}</Text>
            <Text style={styles.xpVal}>{totalXP} XP</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${xpInLevel}%` }]} />
          </View>
        </View>
      </View>

      {/* Today's session */}
      <Text style={styles.sectionTitle}>Today's Session</Text>
      {todaySessions.length > 0 ? (
        <View style={styles.todayCard}>
          <View style={styles.todayRow}>
            <View style={styles.todayLeft}>
              <Text style={styles.todayLabel}>Sessions today: {todaySessions.length}</Text>
              <Text style={styles.todaySub}>Keep the momentum going!</Text>
            </View>
            <View style={[styles.scoreCircle, { borderColor: todayTotal > 0 && todayScore / todayTotal >= 0.7 ? Colors.light.sage : Colors.light.gold }]}>
              <Text style={[styles.scorePct, { color: todayTotal > 0 && todayScore / todayTotal >= 0.7 ? Colors.light.sage : Colors.light.gold }]}>
                {todayTotal > 0 ? Math.round((todayScore / todayTotal) * 100) : 0}%
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/practice"); }}
          >
            <Text style={styles.continueBtnText}>Practice More</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.startCard}
          onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/practice"); }}
          activeOpacity={0.88}
        >
          <View style={styles.startCardInner}>
            <View style={[styles.startIcon, { backgroundColor: Colors.light.gold }]}>
              <Ionicons name="play" size={28} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.startTitle}>Start today's practice</Text>
              <Text style={styles.startSub}>Keep your streak going!</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Colors.light.gold} />
          </View>
        </TouchableOpacity>
      )}

      {/* Diagnostic baseline */}
      {diagnosticResult && (
        <>
          <Text style={styles.sectionTitle}>Your Starting Level</Text>
          <View style={styles.diagCard}>
            {[
              { label: "Maths", score: diagnosticResult.mathsScore, total: diagnosticResult.mathsTotal, color: Colors.light.optionB },
              { label: "English", score: diagnosticResult.englishScore, total: diagnosticResult.englishTotal, color: Colors.light.rust },
            ].map((d) => (
              <View key={d.label} style={styles.diagRow}>
                <View style={[styles.diagBadge, { backgroundColor: d.color }]}>
                  <Text style={styles.diagBadgeTxt}>{d.label}</Text>
                </View>
                <View style={styles.diagBarWrap}>
                  <View style={[styles.diagBarFill, { width: `${d.total > 0 ? (d.score / d.total) * 100 : 0}%`, backgroundColor: d.color }]} />
                </View>
                <Text style={[styles.diagScore, { color: d.color }]}>{d.score}/{d.total}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Quick practice */}
      <Text style={styles.sectionTitle}>Quick Practice</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
        {QUICK_TOPICS.map((qt, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.quickCard, { borderTopColor: qt.color, borderTopWidth: 4 }]}
            onPress={() => {
              Haptics.selectionAsync();
              router.push({ pathname: "/(tabs)/practice", params: { autoStart: "1", subject: qt.subject, topic: qt.topic } });
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: qt.color }]}>
              <MaterialCommunityIcons name={qt.icon as any} size={22} color="#fff" />
            </View>
            <Text style={styles.quickTopic} numberOfLines={2}>{qt.topic}</Text>
            <Text style={[styles.quickSub, { color: qt.color }]}>{qt.subject === "maths" ? "Maths" : "English"}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recent activity */}
      {recentSessions.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/progress")}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.recentCard}>
            {recentSessions.map((s, i) => {
              const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
              const pctColor = pct >= 70 ? Colors.light.sage : pct >= 40 ? Colors.light.gold : Colors.light.rust;
              const subjectColor = s.subject === "maths" ? Colors.light.optionB : Colors.light.rust;
              return (
                <View key={s.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.recentRow}>
                    <View style={[styles.recentIcon, { backgroundColor: subjectColor }]}>
                      <Ionicons name={s.subject === "maths" ? "calculator" : "book"} size={16} color="#fff" />
                    </View>
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentTopic} numberOfLines={1}>{s.topic}</Text>
                      <Text style={styles.recentDate}>{new Date(s.date).toLocaleDateString("en-NG")}</Text>
                    </View>
                    <View style={[styles.pctBadge, { backgroundColor: pctColor }]}>
                      <Text style={styles.pctBadgeTxt}>{pct}%</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 16, gap: 14 },
  hero: {
    backgroundColor: Colors.light.navy,
    borderRadius: 26,
    padding: 20,
    gap: 16,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroText: { gap: 3 },
  heroGreet: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.65)" },
  heroName: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff" },
  heroBadgeRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  streakCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: Colors.light.gold,
    justifyContent: "center",
    alignItems: "center",
    gap: 1,
  },
  streakNum: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff", lineHeight: 24 },
  streakLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.gold },
  xpWrap: { gap: 6 },
  xpLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  xpLbl: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.gold },
  xpVal: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)" },
  xpTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: Colors.light.gold, borderRadius: 4 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.navy, marginBottom: -6 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: -6 },
  seeAll: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.optionB },
  todayCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 22,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  todayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  todayLeft: { gap: 2 },
  todayLabel: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy },
  todaySub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  scoreCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  scorePct: { fontFamily: "Inter_700Bold", fontSize: 16 },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.optionB,
    borderRadius: 14,
    paddingVertical: 12,
  },
  continueBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  startCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  startCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  startIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  startTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
  startSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  diagCard: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 16, gap: 12 },
  diagRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  diagBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, width: 68, alignItems: "center" },
  diagBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff" },
  diagBarWrap: { flex: 1, height: 8, backgroundColor: Colors.light.border, borderRadius: 4, overflow: "hidden" },
  diagBarFill: { height: "100%", borderRadius: 4 },
  diagScore: { fontFamily: "Inter_700Bold", fontSize: 13, width: 32, textAlign: "right" },
  quickRow: { gap: 12, paddingBottom: 4 },
  quickCard: {
    width: 148,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 14,
    gap: 8,
    overflow: "hidden",
  },
  quickIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  quickTopic: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text, lineHeight: 18 },
  quickSub: { fontFamily: "Inter_700Bold", fontSize: 12 },
  recentCard: { backgroundColor: Colors.light.card, borderRadius: 20, overflow: "hidden" },
  recentRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  recentIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  recentInfo: { flex: 1 },
  recentTopic: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  recentDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  pctBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  pctBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  divider: { height: 1, backgroundColor: Colors.light.border, marginLeft: 62 },
});
