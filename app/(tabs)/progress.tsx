import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={[statStyles.card, { borderColor: color + "30" }]}>
      <View style={[statStyles.icon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  value: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.light.text,
  },
  label: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
});

function TopicBar({
  topic,
  correct,
  total,
  color,
}: {
  topic: string;
  correct: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? correct / total : 0;
  const pctLabel = Math.round(pct * 100);
  const bgColor = pct >= 0.7 ? Colors.light.success : pct >= 0.4 ? Colors.light.accent : color;

  return (
    <View style={barStyles.container}>
      <View style={barStyles.row}>
        <Text style={barStyles.topic} numberOfLines={1}>{topic}</Text>
        <Text style={[barStyles.pct, { color: bgColor }]}>{pctLabel}%</Text>
      </View>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pctLabel}%`, backgroundColor: bgColor }]} />
      </View>
      <Text style={barStyles.sub}>{correct}/{total} correct</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  topic: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
    paddingRight: 8,
  },
  pct: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  track: {
    height: 8,
    backgroundColor: Colors.light.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
});

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { topicProgress, sessions, streakDays, totalXP } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const mathsProgress = topicProgress.filter((p) => p.subject === "maths");
  const englishProgress = topicProgress.filter((p) => p.subject === "english");

  const totalCorrect = topicProgress.reduce((a, p) => a + p.correct, 0);
  const totalAnswered = topicProgress.reduce((a, p) => a + p.total, 0);
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const level = Math.floor(totalXP / 100) + 1;

  const recentSessions = useMemo(() => sessions.slice(0, 5), [sessions]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 12, paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Progress</Text>
      <Text style={styles.screenSub}>Your Common Entrance journey</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard label="Day Streak" value={String(streakDays)} color={Colors.light.accent} icon="flame" />
        <StatCard label="Accuracy" value={`${accuracy}%`} color={Colors.light.success} icon="checkmark-circle" />
        <StatCard label="Level" value={String(level)} color={Colors.light.primary} icon="trophy" />
      </View>

      {/* Overall accuracy ring */}
      <View style={styles.bigCard}>
        <View style={styles.bigCardLeft}>
          <Text style={styles.bigNum}>{totalAnswered}</Text>
          <Text style={styles.bigLabel}>Questions answered</Text>
          <View style={styles.bigSubs}>
            <View style={styles.bigSubItem}>
              <View style={[styles.dot, { backgroundColor: Colors.light.success }]} />
              <Text style={styles.bigSubText}>{totalCorrect} correct</Text>
            </View>
            <View style={styles.bigSubItem}>
              <View style={[styles.dot, { backgroundColor: Colors.light.error }]} />
              <Text style={styles.bigSubText}>{totalAnswered - totalCorrect} wrong</Text>
            </View>
          </View>
        </View>
        <View style={styles.xpBlock}>
          <Text style={styles.xpNum}>{totalXP}</Text>
          <Text style={styles.xpLabel}>Total XP</Text>
        </View>
      </View>

      {/* Maths progress */}
      {mathsProgress.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="calculator-variant" size={18} color={Colors.light.maths} />
            <Text style={styles.sectionTitle}>Maths Topics</Text>
          </View>
          <View style={styles.barCard}>
            {mathsProgress.map((p, i) => (
              <View key={p.topic}>
                {i > 0 && <View style={styles.divider} />}
                <TopicBar topic={p.topic} correct={p.correct} total={p.total} color={Colors.light.maths} />
              </View>
            ))}
          </View>
        </>
      )}

      {/* English progress */}
      {englishProgress.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="book-alphabet" size={18} color={Colors.light.english} />
            <Text style={styles.sectionTitle}>English Topics</Text>
          </View>
          <View style={styles.barCard}>
            {englishProgress.map((p, i) => (
              <View key={p.topic}>
                {i > 0 && <View style={styles.divider} />}
                <TopicBar topic={p.topic} correct={p.correct} total={p.total} color={Colors.light.english} />
              </View>
            ))}
          </View>
        </>
      )}

      {/* No data */}
      {topicProgress.length === 0 && (
        <View style={styles.emptyBlock}>
          <MaterialCommunityIcons name="chart-bar" size={48} color={Colors.light.textTertiary} />
          <Text style={styles.emptyTitle}>No progress yet</Text>
          <Text style={styles.emptyText}>Complete practice sessions to see your progress here.</Text>
        </View>
      )}

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={18} color={Colors.light.textSecondary} />
            <Text style={styles.sectionTitle}>Session History</Text>
          </View>
          <View style={styles.barCard}>
            {recentSessions.map((s, i) => {
              const pct = Math.round((s.score / s.total) * 100);
              const color = pct >= 70 ? Colors.light.success : pct >= 40 ? Colors.light.accent : Colors.light.error;
              return (
                <View key={s.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.sessionRow}>
                    <View style={[styles.sessionIcon, { backgroundColor: color + "18" }]}>
                      <Ionicons
                        name={s.subject === "maths" ? "calculator" : "book"}
                        size={16}
                        color={color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionTopic} numberOfLines={1}>{s.topic}</Text>
                      <Text style={styles.sessionDate}>{new Date(s.date).toLocaleDateString("en-NG")}</Text>
                    </View>
                    <Text style={[styles.sessionScore, { color }]}>{pct}%</Text>
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
  screenTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.light.text },
  screenSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, marginTop: -8 },
  statsRow: { flexDirection: "row", gap: 10 },
  bigCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bigCardLeft: { gap: 6 },
  bigNum: { fontFamily: "Inter_700Bold", fontSize: 40, color: Colors.light.text },
  bigLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  bigSubs: { gap: 4, marginTop: 4 },
  bigSubItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bigSubText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  xpBlock: {
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  xpNum: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.light.primary },
  xpLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.primary },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: -4,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.light.text,
  },
  barCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
  },
  emptyBlock: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.textSecondary },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sessionTopic: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.light.text,
  },
  sessionDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  sessionScore: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
});
