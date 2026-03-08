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
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import questionsData from "@/data/questions.json";

const QUICK_TOPICS = [
  { subject: "maths" as const, topic: "Basic Operations", icon: "plus-minus-variant" },
  { subject: "english" as const, topic: "Grammar & Tenses", icon: "format-text" },
  { subject: "maths" as const, topic: "Fractions & Decimals", icon: "fraction-one-half" },
  { subject: "english" as const, topic: "Vocabulary & Spelling", icon: "alphabetical" },
];

function XPBar({ xp }: { xp: number }) {
  const level = Math.floor(xp / 100) + 1;
  const progress = (xp % 100) / 100;
  return (
    <View style={xp_styles.wrap}>
      <View style={xp_styles.row}>
        <Text style={xp_styles.levelTxt}>Level {level}</Text>
        <Text style={xp_styles.xpTxt}>{xp} XP total</Text>
      </View>
      <View style={xp_styles.track}>
        <View style={[xp_styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={xp_styles.sub}>{100 - (xp % 100)} XP to next level</Text>
    </View>
  );
}
const xp_styles = StyleSheet.create({
  wrap: { gap: 5 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  levelTxt: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  xpTxt: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.75)" },
  track: { height: 7, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: Colors.light.gold, borderRadius: 4 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.65)" },
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, diagnosticResult, sessions, streakDays, totalXP } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const recentSessions = sessions.slice(0, 4);

  const today = new Date().toDateString();
  const todaySessions = sessions.filter((s) => new Date(s.date).toDateString() === today);
  const todayScore = todaySessions.reduce((a, s) => a + s.score, 0);
  const todayTotal = todaySessions.reduce((a, s) => a + s.total, 0);

  const totalQuestions = (questionsData as any[]).filter(
    (q) => profile?.grade && (q.grade === profile.grade)
  ).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad + 12,
          paddingBottom: Platform.OS === "web" ? 34 + 84 : 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero card */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroGreet}>Good day,</Text>
            <Text style={styles.heroName}>{profile?.name}</Text>
            <Text style={styles.heroBadge}>{profile?.grade} • {profile?.subject}</Text>
          </View>
          <View style={styles.streakBox}>
            <Ionicons name="flame" size={22} color={Colors.light.gold} />
            <Text style={styles.streakNum}>{streakDays}</Text>
            <Text style={styles.streakLbl}>day{streakDays !== 1 ? "s" : ""}</Text>
          </View>
        </View>
        <XPBar xp={totalXP} />
      </View>

      {/* Today's session */}
      <Text style={styles.sectionTitle}>Today's Session</Text>
      {todaySessions.length > 0 ? (
        <View style={styles.todayCard}>
          <View style={styles.todayRow}>
            <View style={styles.todayInfo}>
              <Text style={styles.todayLabel}>Practice complete</Text>
              <Text style={styles.todaySub}>{todaySessions.length} session{todaySessions.length > 1 ? "s" : ""} done today</Text>
            </View>
            <Text style={[styles.todayScore, { color: todayTotal > 0 && todayScore / todayTotal >= 0.7 ? Colors.light.sage : Colors.light.gold }]}>
              {todayTotal > 0 ? Math.round((todayScore / todayTotal) * 100) : 0}%
            </Text>
          </View>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/practice"); }}
          >
            <Text style={styles.continueBtnText}>Practice More</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.light.navy} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.startPracticeCard}
          onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/practice"); }}
          activeOpacity={0.88}
        >
          <View style={[styles.startIcon, { backgroundColor: Colors.light.navyLight }]}>
            <Ionicons name="play-circle" size={32} color={Colors.light.navy} />
          </View>
          <View style={styles.startInfo}>
            <Text style={styles.startTitle}>Start today's practice</Text>
            <Text style={styles.startSub}>Keep your streak going!</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.light.textTertiary} />
        </TouchableOpacity>
      )}

      {/* Diagnostic summary */}
      {diagnosticResult && (
        <>
          <Text style={styles.sectionTitle}>Starting Level</Text>
          <View style={styles.diagCard}>
            <View style={styles.diagRow}>
              <View style={[styles.diagDot, { backgroundColor: Colors.light.navy }]} />
              <Text style={styles.diagLabel}>Maths</Text>
              <View style={styles.diagBar}>
                <View
                  style={[styles.diagFill, {
                    width: `${diagnosticResult.mathsTotal > 0 ? (diagnosticResult.mathsScore / diagnosticResult.mathsTotal) * 100 : 0}%`,
                    backgroundColor: Colors.light.navy,
                  }]}
                />
              </View>
              <Text style={styles.diagPct}>
                {diagnosticResult.mathsScore}/{diagnosticResult.mathsTotal}
              </Text>
            </View>
            <View style={styles.diagRow}>
              <View style={[styles.diagDot, { backgroundColor: Colors.light.rust }]} />
              <Text style={styles.diagLabel}>English</Text>
              <View style={styles.diagBar}>
                <View
                  style={[styles.diagFill, {
                    width: `${diagnosticResult.englishTotal > 0 ? (diagnosticResult.englishScore / diagnosticResult.englishTotal) * 100 : 0}%`,
                    backgroundColor: Colors.light.rust,
                  }]}
                />
              </View>
              <Text style={styles.diagPct}>
                {diagnosticResult.englishScore}/{diagnosticResult.englishTotal}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Quick practice */}
      <Text style={styles.sectionTitle}>Quick Practice</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
        {QUICK_TOPICS.map((qt, i) => {
          const color = qt.subject === "maths" ? Colors.light.navy : Colors.light.rust;
          const light = qt.subject === "maths" ? Colors.light.navyLight : Colors.light.rustLight;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.quickCard, { borderColor: color + "30" }]}
              onPress={() => {
                Haptics.selectionAsync();
                router.push({ pathname: "/(tabs)/practice", params: { autoStart: "1", subject: qt.subject, topic: qt.topic } });
              }}
              activeOpacity={0.85}
            >
              <View style={[styles.quickIcon, { backgroundColor: light }]}>
                <MaterialCommunityIcons name={qt.icon as any} size={22} color={color} />
              </View>
              <Text style={styles.quickTopic} numberOfLines={2}>{qt.topic}</Text>
              <Text style={[styles.quickSub, { color }]}>{qt.subject === "maths" ? "Maths" : "English"}</Text>
            </TouchableOpacity>
          );
        })}
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
              const color = pct >= 70 ? Colors.light.sage : pct >= 40 ? Colors.light.gold : Colors.light.rust;
              return (
                <View key={s.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.recentRow}>
                    <View style={[styles.recentIcon, { backgroundColor: color + "18" }]}>
                      <Ionicons name={s.subject === "maths" ? "calculator" : "book"} size={16} color={color} />
                    </View>
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentTopic} numberOfLines={1}>{s.topic}</Text>
                      <Text style={styles.recentDate}>{new Date(s.date).toLocaleDateString("en-NG")}</Text>
                    </View>
                    <Text style={[styles.recentScore, { color }]}>{pct}%</Text>
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
  content: { paddingHorizontal: 20, gap: 16 },
  heroCard: {
    backgroundColor: Colors.light.navy,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroLeft: { gap: 2 },
  heroGreet: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)" },
  heroName: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff" },
  heroBadge: { fontFamily: "Inter_500Medium", fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  streakBox: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 2,
    minWidth: 64,
  },
  streakNum: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" },
  streakLbl: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.75)" },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.navy, marginBottom: -4 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: -4 },
  seeAll: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.navy },
  todayCard: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 16, gap: 12 },
  todayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  todayInfo: { gap: 2 },
  todayLabel: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy },
  todaySub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  todayScore: { fontFamily: "Inter_700Bold", fontSize: 36 },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.navyLight,
    borderRadius: 12,
    paddingVertical: 12,
  },
  continueBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.navy },
  startPracticeCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  startIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  startInfo: { flex: 1, gap: 2 },
  startTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy },
  startSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  diagCard: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 16, gap: 12 },
  diagRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  diagDot: { width: 8, height: 8, borderRadius: 4 },
  diagLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.text, width: 54 },
  diagBar: { flex: 1, height: 6, backgroundColor: Colors.light.border, borderRadius: 3, overflow: "hidden" },
  diagFill: { height: "100%", borderRadius: 3 },
  diagPct: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.textSecondary, width: 30, textAlign: "right" },
  quickRow: { gap: 12, paddingBottom: 4, paddingHorizontal: 2 },
  quickCard: {
    width: 140,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1.5,
  },
  quickIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  quickTopic: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text, lineHeight: 18 },
  quickSub: { fontFamily: "Inter_500Medium", fontSize: 12 },
  recentCard: { backgroundColor: Colors.light.card, borderRadius: 20, overflow: "hidden" },
  recentRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  recentIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  recentInfo: { flex: 1 },
  recentTopic: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  recentDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  recentScore: { fontFamily: "Inter_700Bold", fontSize: 16 },
  divider: { height: 1, backgroundColor: Colors.light.border, marginLeft: 64 },
});
