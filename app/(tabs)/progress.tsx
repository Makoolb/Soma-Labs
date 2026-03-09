import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

function SkillBar({ topic, correct, total }: { topic: string; correct: number; total: number }) {
  const pct = total > 0 ? correct / total : 0;
  const barColor = pct >= 0.7 ? Colors.light.sage : pct >= 0.4 ? Colors.light.gold : Colors.light.rust;
  return (
    <View style={barSt.row}>
      <Text style={barSt.topic} numberOfLines={1}>{topic}</Text>
      <View style={barSt.track}>
        <View style={[barSt.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
      <View style={[barSt.pill, { backgroundColor: barColor }]}>
        <Text style={barSt.pillTxt}>{Math.round(pct * 100)}%</Text>
      </View>
    </View>
  );
}

const barSt = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  topic: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.text, width: 112 },
  track: { flex: 1, height: 8, backgroundColor: Colors.light.border, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, minWidth: 40, alignItems: "center" },
  pillTxt: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff" },
});

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { sessions, streakDays, totalXP, diagnosticResult, skillMap: diagSkillMap, profile } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

  const totalCorrect = useMemo(() => sessions.reduce((a, s) => a + s.score, 0), [sessions]);
  const totalAnswered = useMemo(() => sessions.reduce((a, s) => a + s.total, 0), [sessions]);
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const level = Math.floor(totalXP / 100) + 1;

  const skillMap = useMemo(() => {
    const map: Record<string, { correct: number; total: number; subject: string }> = {};
    sessions.forEach((s) => {
      s.answers.forEach((a) => {
        if (!map[a.topic]) map[a.topic] = { correct: 0, total: 0, subject: a.subject };
        map[a.topic].total++;
        if (a.correct) map[a.topic].correct++;
      });
    });
    return map;
  }, [sessions]);

  const mathsSkills = Object.entries(skillMap).filter(([, v]) => v.subject === "maths");
  const englishSkills = Object.entries(skillMap).filter(([, v]) => v.subject === "english");

  const STAT_CARDS = [
    { label: "Streak", value: `${streakDays}d`, icon: "flame", color: Colors.light.gold, bg: Colors.light.goldLight },
    { label: "Accuracy", value: `${accuracy}%`, icon: "checkmark-circle", color: Colors.light.sage, bg: Colors.light.sageLight },
    { label: "Level", value: String(level), icon: "trophy", color: Colors.light.optionB, bg: Colors.light.navyLight },
    { label: "Sessions", value: String(sessions.length), icon: "calendar", color: Colors.light.rust, bg: Colors.light.rustLight },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.titleBlock}>
        <Text style={styles.screenTitle}>Progress</Text>
        <Text style={styles.screenSub}>{profile?.name}'s exam journey</Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {STAT_CARDS.map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg, borderColor: s.color + "40" }]}>
            <View style={[styles.statIconWrap, { backgroundColor: s.color }]}>
              <Ionicons name={s.icon as any} size={18} color="#fff" />
            </View>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* XP level bar */}
      <View style={styles.xpCard}>
        <View style={styles.xpTop}>
          <View>
            <Text style={styles.xpTitle}>Level {level}</Text>
            <Text style={styles.xpSub}>{totalXP} XP total</Text>
          </View>
          <View style={[styles.xpBadge, { backgroundColor: Colors.light.gold }]}>
            <Ionicons name="star" size={14} color="#fff" />
            <Text style={styles.xpBadgeTxt}>{100 - (totalXP % 100)} to next</Text>
          </View>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${totalXP % 100}%` }]} />
        </View>
      </View>

      {/* Diagnostic Skill Map */}
      {diagSkillMap && Object.keys(diagSkillMap).length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: Colors.light.navy }]} />
            <Text style={styles.sectionTitle}>Diagnostic Skill Map</Text>
          </View>
          <View style={styles.card}>
            {Object.entries(diagSkillMap)
              .sort(([, a], [, b]) => a - b)
              .map(([topic, pct], i) => {
                const barColor = pct >= 70 ? Colors.light.sage : pct >= 40 ? Colors.light.gold : Colors.light.rust;
                return (
                  <View key={topic}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.diagRow}>
                      <Text style={styles.diagTopic} numberOfLines={1}>{topic}</Text>
                      <View style={styles.diagBarWrap}>
                        <View style={[styles.diagBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                      </View>
                      <View style={[styles.diagPill, { backgroundColor: barColor }]}>
                        <Text style={styles.diagPillTxt}>{pct}%</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            <Text style={styles.diagHint}>Sorted by weakest first — focus on red and orange topics.</Text>
          </View>
        </>
      )}

      {/* Maths skills */}
      {mathsSkills.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: Colors.light.optionB }]} />
            <Text style={styles.sectionTitle}>Maths Skills</Text>
          </View>
          <View style={styles.card}>
            {mathsSkills.map(([topic, data], i) => (
              <View key={topic}>
                {i > 0 && <View style={styles.divider} />}
                <SkillBar topic={topic} correct={data.correct} total={data.total} />
              </View>
            ))}
          </View>
        </>
      )}

      {/* English skills */}
      {englishSkills.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: Colors.light.rust }]} />
            <Text style={styles.sectionTitle}>English Skills</Text>
          </View>
          <View style={styles.card}>
            {englishSkills.map(([topic, data], i) => (
              <View key={topic}>
                {i > 0 && <View style={styles.divider} />}
                <SkillBar topic={topic} correct={data.correct} total={data.total} />
              </View>
            ))}
          </View>
        </>
      )}

      {/* Session history */}
      {sessions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Session History</Text>
          <View style={styles.card}>
            {sessions.slice(0, 20).map((s, i) => {
              const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
              const pctColor = pct >= 70 ? Colors.light.sage : pct >= 40 ? Colors.light.gold : Colors.light.rust;
              const subjectColor = s.subject === "maths" ? Colors.light.optionB : Colors.light.rust;
              return (
                <View key={s.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.histRow}>
                    <View style={[styles.histIcon, { backgroundColor: subjectColor }]}>
                      <Ionicons name={s.subject === "maths" ? "calculator" : "book"} size={16} color="#fff" />
                    </View>
                    <View style={styles.histInfo}>
                      <Text style={styles.histTopic} numberOfLines={1}>{s.topic}</Text>
                      <Text style={styles.histDate}>
                        {new Date(s.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                      </Text>
                    </View>
                    <View style={[styles.histPill, { backgroundColor: pctColor }]}>
                      <Text style={styles.histPillTxt}>{pct}%</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Empty state */}
      {sessions.length === 0 && (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: Colors.light.navyLight }]}>
            <Ionicons name="bar-chart-outline" size={44} color={Colors.light.navy} />
          </View>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyBody}>Complete your first practice session to see your progress here.</Text>
          <TouchableOpacity
            style={[styles.goBtn, { backgroundColor: Colors.light.optionB }]}
            onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/practice"); }}
          >
            <Text style={styles.goBtnTxt}>Start Practising</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 16, gap: 14 },
  titleBlock: { gap: 2 },
  screenTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.light.navy },
  screenSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "47.5%",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 26 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textSecondary },
  xpCard: {
    backgroundColor: Colors.light.navy,
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  xpTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  xpTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff" },
  xpSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  xpBadgeTxt: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  xpTrack: { height: 10, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 5, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: Colors.light.gold, borderRadius: 5 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  card: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 16, gap: 12 },
  divider: { height: 1, backgroundColor: Colors.light.border },
  diagRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  diagTopic: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.text, width: 108 },
  diagBarWrap: { flex: 1, height: 8, backgroundColor: Colors.light.border, borderRadius: 4, overflow: "hidden" },
  diagBarFill: { height: "100%", borderRadius: 4 },
  diagPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, minWidth: 40, alignItems: "center" },
  diagPillTxt: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff" },
  diagHint: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  histRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  histIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  histInfo: { flex: 1 },
  histTopic: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text },
  histDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, marginTop: 2 },
  histPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  histPillTxt: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  emptyWrap: { alignItems: "center", paddingVertical: 32, gap: 14 },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, justifyContent: "center", alignItems: "center" },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.textSecondary },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  goBtn: { borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 4 },
  goBtnTxt: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
});
