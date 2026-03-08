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

function SkillBar({ topic, correct, total, color }: { topic: string; correct: number; total: number; color: string }) {
  const pct = total > 0 ? correct / total : 0;
  const barColor = pct >= 0.7 ? Colors.light.sage : pct >= 0.4 ? Colors.light.gold : Colors.light.rust;
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.topic} numberOfLines={1}>{topic}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[barStyles.pct, { color: barColor }]}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  topic: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.text, width: 120 },
  track: { flex: 1, height: 7, backgroundColor: Colors.light.border, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  pct: { fontFamily: "Inter_700Bold", fontSize: 13, width: 36, textAlign: "right" },
});

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { sessions, streakDays, totalXP, diagnosticResult, profile } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

  const totalCorrect = useMemo(() => sessions.reduce((a, s) => a + s.score, 0), [sessions]);
  const totalAnswered = useMemo(() => sessions.reduce((a, s) => a + s.total, 0), [sessions]);
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const level = Math.floor(totalXP / 100) + 1;

  // Skill scores per topic from all sessions
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Progress</Text>
      <Text style={styles.screenSub}>{profile?.name}'s Common Entrance journey</Text>

      {/* Summary stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Streak", value: `${streakDays}d`, icon: "flame", color: Colors.light.gold },
          { label: "Accuracy", value: `${accuracy}%`, icon: "checkmark-circle", color: Colors.light.sage },
          { label: "Level", value: String(level), icon: "trophy", color: Colors.light.navy },
          { label: "Sessions", value: String(sessions.length), icon: "calendar", color: Colors.light.rust },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { borderColor: s.color + "35" }]}>
            <Ionicons name={s.icon as any} size={18} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* XP progress */}
      <View style={styles.xpCard}>
        <View style={styles.xpRow}>
          <Text style={styles.xpTitle}>Total XP: {totalXP}</Text>
          <Text style={styles.xpLevel}>Level {level}</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${(totalXP % 100)}%` }]} />
        </View>
        <Text style={styles.xpSub}>{100 - (totalXP % 100)} XP to Level {level + 1}</Text>
      </View>

      {/* Diagnostic baseline */}
      {diagnosticResult && (
        <>
          <Text style={styles.sectionTitle}>Starting Baseline (Diagnostic)</Text>
          <View style={styles.sectionCard}>
            <View style={styles.diagRow}>
              <View style={[styles.diagDot, { backgroundColor: Colors.light.navy }]} />
              <Text style={styles.diagLabel}>Maths</Text>
              <View style={styles.diagTrack}>
                <View
                  style={[styles.diagFill, {
                    width: `${diagnosticResult.mathsTotal > 0 ? (diagnosticResult.mathsScore / diagnosticResult.mathsTotal) * 100 : 0}%`,
                    backgroundColor: Colors.light.navy,
                  }]}
                />
              </View>
              <Text style={styles.diagPct}>{diagnosticResult.mathsScore}/{diagnosticResult.mathsTotal}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.diagRow}>
              <View style={[styles.diagDot, { backgroundColor: Colors.light.rust }]} />
              <Text style={styles.diagLabel}>English</Text>
              <View style={styles.diagTrack}>
                <View
                  style={[styles.diagFill, {
                    width: `${diagnosticResult.englishTotal > 0 ? (diagnosticResult.englishScore / diagnosticResult.englishTotal) * 100 : 0}%`,
                    backgroundColor: Colors.light.rust,
                  }]}
                />
              </View>
              <Text style={styles.diagPct}>{diagnosticResult.englishScore}/{diagnosticResult.englishTotal}</Text>
            </View>
          </View>
        </>
      )}

      {/* Maths skills */}
      {mathsSkills.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: Colors.light.navy }]} />
            <Text style={styles.sectionTitle}>Maths Skills</Text>
          </View>
          <View style={styles.sectionCard}>
            {mathsSkills.map(([topic, data], i) => (
              <View key={topic}>
                {i > 0 && <View style={styles.divider} />}
                <SkillBar topic={topic} correct={data.correct} total={data.total} color={Colors.light.navy} />
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
          <View style={styles.sectionCard}>
            {englishSkills.map(([topic, data], i) => (
              <View key={topic}>
                {i > 0 && <View style={styles.divider} />}
                <SkillBar topic={topic} correct={data.correct} total={data.total} color={Colors.light.rust} />
              </View>
            ))}
          </View>
        </>
      )}

      {/* Session history */}
      {sessions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Session History</Text>
          <View style={styles.sectionCard}>
            {sessions.slice(0, 20).map((s, i) => {
              const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
              const color = pct >= 70 ? Colors.light.sage : pct >= 40 ? Colors.light.gold : Colors.light.rust;
              const subjectColor = s.subject === "maths" ? Colors.light.navy : Colors.light.rust;
              return (
                <View key={s.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.histRow}>
                    <View style={[styles.histIcon, { backgroundColor: subjectColor + "15" }]}>
                      <Ionicons name={s.subject === "maths" ? "calculator" : "book"} size={16} color={subjectColor} />
                    </View>
                    <View style={styles.histInfo}>
                      <Text style={styles.histTopic} numberOfLines={1}>{s.topic}</Text>
                      <Text style={styles.histDate}>{new Date(s.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</Text>
                    </View>
                    <View style={styles.histRight}>
                      <Text style={[styles.histPct, { color }]}>{pct}%</Text>
                      <Text style={styles.histRaw}>{s.score}/{s.total}</Text>
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
        <View style={styles.emptyBlock}>
          <Ionicons name="bar-chart-outline" size={52} color={Colors.light.textTertiary} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyBody}>Complete your first practice session to see your progress here.</Text>
          <TouchableOpacity
            style={styles.goBtn}
            onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/practice"); }}
          >
            <Text style={styles.goBtnText}>Start Practising</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 20, gap: 16 },
  screenTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.light.navy },
  screenSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, marginTop: -10 },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1.5,
  },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textSecondary },
  xpCard: {
    backgroundColor: Colors.light.navy,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  xpRow: { flexDirection: "row", justifyContent: "space-between" },
  xpTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  xpLevel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.gold },
  xpTrack: { height: 7, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: Colors.light.gold, borderRadius: 4 },
  xpSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)" },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: -4 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionCard: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 16, gap: 12 },
  divider: { height: 1, backgroundColor: Colors.light.border },
  diagRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  diagDot: { width: 8, height: 8, borderRadius: 4 },
  diagLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.text, width: 60 },
  diagTrack: { flex: 1, height: 7, backgroundColor: Colors.light.border, borderRadius: 4, overflow: "hidden" },
  diagFill: { height: "100%", borderRadius: 4 },
  diagPct: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.light.textSecondary, width: 32, textAlign: "right" },
  histRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  histIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  histInfo: { flex: 1 },
  histTopic: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text },
  histDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, marginTop: 2 },
  histRight: { alignItems: "flex-end", gap: 2 },
  histPct: { fontFamily: "Inter_700Bold", fontSize: 16 },
  histRaw: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary },
  emptyBlock: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.textSecondary },
  emptyBody: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textTertiary, textAlign: "center", paddingHorizontal: 20, lineHeight: 20 },
  goBtn: { backgroundColor: Colors.light.navy, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 4 },
  goBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
});
