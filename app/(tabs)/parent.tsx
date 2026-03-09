import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, type SessionResult } from "@/context/AppContext";

// Total questions available per grade in the practice bank
const QUESTIONS_BY_GRADE: Record<string, number> = { P4: 81, P5: 74, P6: 51 };

// ---- computation helpers ----

function getTopicAccuracy(sessions: SessionResult[]) {
  const map: Record<string, { correct: number; total: number }> = {};
  for (const s of sessions) {
    for (const a of s.answers) {
      if (!map[a.topic]) map[a.topic] = { correct: 0, total: 0 };
      map[a.topic].total++;
      if (a.correct) map[a.topic].correct++;
    }
  }
  return Object.entries(map)
    .filter(([, d]) => d.total >= 3)
    .map(([topic, d]) => ({ topic, pct: Math.round((d.correct / d.total) * 100), total: d.total }))
    .sort((a, b) => b.pct - a.pct);
}

function uniqueQuestionsAttempted(sessions: SessionResult[]): number {
  const ids = new Set<string>();
  for (const s of sessions) {
    for (const a of s.answers) {
      if (a.questionId) ids.add(a.questionId);
    }
  }
  return ids.size;
}

function calcStatus(
  sessions: SessionResult[],
  examDate: string | undefined,
  grade: string,
  startDate: string | undefined,
) {
  if (!examDate || !startDate) return null;
  const now = new Date();
  const exam = new Date(examDate);
  const start = new Date(startDate);
  if (exam <= start) return null;

  const totalPrepDays = (exam.getTime() - start.getTime()) / 86400000;
  const elapsedDays = Math.max(0, (now.getTime() - start.getTime()) / 86400000);
  const expectedPct = Math.min(100, (elapsedDays / totalPrepDays) * 100);

  const totalAvailable = QUESTIONS_BY_GRADE[grade] ?? 74;
  const attempted = uniqueQuestionsAttempted(sessions);
  const actualPct = Math.min(100, (attempted / totalAvailable) * 100);

  const gap = expectedPct - actualPct;
  const label: "on_track" | "slightly_behind" | "at_risk" =
    actualPct >= expectedPct ? "on_track" : gap < 10 ? "slightly_behind" : "at_risk";

  return {
    label,
    actualPct: Math.round(actualPct),
    expectedPct: Math.round(expectedPct),
    attempted,
    totalAvailable,
  };
}

function weekSessions(sessions: SessionResult[]) {
  const cutoff = Date.now() - 7 * 86400000;
  return sessions.filter((s) => new Date(s.date).getTime() >= cutoff);
}

const STATUS_META = {
  on_track: { color: Colors.light.sage, icon: "checkmark-circle" as const, label: "On Track" },
  slightly_behind: { color: Colors.light.gold, icon: "alert-circle" as const, label: "Slightly Behind" },
  at_risk: { color: Colors.light.rust, icon: "warning" as const, label: "At Risk" },
};

export default function ParentDashboard() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { profile, sessions, streakDays, totalXP } = useApp();
  const [copied, setCopied] = useState(false);

  const level = Math.floor(totalXP / 500) + 1;

  const topicAccuracy = useMemo(() => getTopicAccuracy(sessions), [sessions]);
  const strengthAreas = topicAccuracy.slice(0, 3);
  const focusAreas = [...topicAccuracy].reverse().slice(0, 3);

  const thisWeek = useMemo(() => weekSessions(sessions), [sessions]);
  const weekProblems = thisWeek.reduce((s, r) => s + r.total, 0);
  const totalProblems = sessions.reduce((s, r) => s + r.total, 0);

  const startDate = profile?.createdAt ?? sessions[sessions.length - 1]?.date;
  const status = useMemo(
    () => calcStatus(sessions, profile?.examDate, profile?.grade ?? "P5", startDate),
    [sessions, profile, startDate],
  );

  const examLabel = profile?.examDate
    ? (() => {
        const d = new Date(profile.examDate);
        return d.toLocaleString("en-NG", { month: "long", year: "numeric" });
      })()
    : null;

  // ---- WhatsApp report text ----
  function buildReportText(): string {
    const name = profile?.name ?? "Your child";
    const grade = profile?.grade ?? "";
    const lines: string[] = [
      `📊 *SomaLabs Weekly Report*`,
      `${name} — Primary ${grade.replace("P", "")}`,
      ``,
      `🎯 Level: ${level} (${totalXP} XP)`,
      `🔥 Streak: ${streakDays} day${streakDays !== 1 ? "s" : ""}`,
      `✅ Problems solved this week: ${weekProblems}`,
      `📚 Total problems solved: ${totalProblems}`,
    ];

    if (strengthAreas.length > 0) {
      lines.push(``, `💪 *Strength Areas*`);
      strengthAreas.forEach((a) => lines.push(`• ${a.topic} — ${a.pct}%`));
    }

    if (focusAreas.length > 0) {
      lines.push(``, `📌 *Focus Areas*`);
      focusAreas.forEach((a) => lines.push(`• ${a.topic} — ${a.pct}%`));
    }

    if (status) {
      const meta = STATUS_META[status.label];
      lines.push(``, `📈 *Status: ${meta.label}*`);
      lines.push(`Progress: ${status.actualPct}% done · Expected: ${status.expectedPct}%`);
      if (examLabel) lines.push(`Exam: ${examLabel}`);
    }

    lines.push(``, `Keep encouraging ${name}'s daily practice! 🌟`);
    return lines.join("\n");
  }

  async function handleShare() {
    const text = buildReportText();
    Haptics.selectionAsync();
    if (Platform.OS === "web") {
      try {
        await (navigator as any).clipboard?.writeText(text);
      } catch (_) {}
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      await Share.share({ message: text });
    }
  }

  const noData = sessions.length === 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 12, paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Parent Dashboard</Text>
          <Text style={styles.headerSub}>{profile?.name}'s weekly report</Text>
        </View>
        <View style={styles.gradeBadge}>
          <Text style={styles.gradeBadgeTxt}>{profile?.grade}</Text>
        </View>
      </View>

      {noData ? (
        <View style={styles.emptyCard}>
          <Ionicons name="time-outline" size={40} color={Colors.light.textSecondary} />
          <Text style={styles.emptyTitle}>No practice yet</Text>
          <Text style={styles.emptySub}>
            Once {profile?.name} completes their first session, the weekly report will appear here.
          </Text>
        </View>
      ) : (
        <>
          {/* ── Summary Stats Row ── */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderTopColor: Colors.light.gold }]}>
              <Ionicons name="star" size={20} color={Colors.light.gold} />
              <Text style={styles.statNum}>Level {level}</Text>
              <Text style={styles.statLbl}>{totalXP} XP</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: Colors.light.rust }]}>
              <Ionicons name="flame" size={20} color={Colors.light.rust} />
              <Text style={styles.statNum}>{streakDays}</Text>
              <Text style={styles.statLbl}>day streak</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: Colors.light.optionB }]}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.light.optionB} />
              <Text style={styles.statNum}>{weekProblems}</Text>
              <Text style={styles.statLbl}>this week</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: Colors.light.sage }]}>
              <Ionicons name="library" size={20} color={Colors.light.sage} />
              <Text style={styles.statNum}>{totalProblems}</Text>
              <Text style={styles.statLbl}>all time</Text>
            </View>
          </View>

          {/* ── Status Card ── */}
          {status ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Progress Status</Text>
              <View style={[styles.statusCard, { borderLeftColor: STATUS_META[status.label].color }]}>
                <View style={styles.statusHeader}>
                  <Ionicons
                    name={STATUS_META[status.label].icon}
                    size={22}
                    color={STATUS_META[status.label].color}
                  />
                  <Text style={[styles.statusLabel, { color: STATUS_META[status.label].color }]}>
                    {STATUS_META[status.label].label}
                  </Text>
                  {examLabel && (
                    <Text style={styles.statusExam}>Exam: {examLabel}</Text>
                  )}
                </View>

                {/* Progress comparison bars */}
                <View style={styles.progressCompareWrap}>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLbl}>Actual</Text>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${status.actualPct}%` as any,
                            backgroundColor: STATUS_META[status.label].color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressPct, { color: STATUS_META[status.label].color }]}>
                      {status.actualPct}%
                    </Text>
                  </View>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLbl}>Expected</Text>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${status.expectedPct}%` as any,
                            backgroundColor: Colors.light.border,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressPct, { color: Colors.light.textSecondary }]}>
                      {status.expectedPct}%
                    </Text>
                  </View>
                </View>

                <Text style={styles.statusDetail}>
                  {status.attempted} of {status.totalAvailable} questions attempted for {profile?.grade}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noStatusCard}>
              <Ionicons name="calendar-outline" size={22} color={Colors.light.textSecondary} />
              <Text style={styles.noStatusTxt}>
                Set an exam date on the Home tab to see progress status
              </Text>
            </View>
          )}

          {/* ── Strength Areas ── */}
          {strengthAreas.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Strength Areas</Text>
              <View style={styles.areaCard}>
                {strengthAreas.map((a, i) => (
                  <View key={a.topic}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.areaRow}>
                      <View style={[styles.areaRank, { backgroundColor: Colors.light.sage }]}>
                        <Text style={styles.areaRankTxt}>{i + 1}</Text>
                      </View>
                      <View style={styles.areaInfo}>
                        <Text style={styles.areaTopic} numberOfLines={1}>{a.topic}</Text>
                        <View style={styles.areaBarTrack}>
                          <View
                            style={[
                              styles.areaBarFill,
                              { width: `${a.pct}%` as any, backgroundColor: Colors.light.sage },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={[styles.areaPct, { color: Colors.light.sage }]}>{a.pct}%</Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.areaHint}>First-attempt accuracy across all sessions</Text>
              </View>
            </View>
          )}

          {/* ── Focus Areas ── */}
          {focusAreas.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Focus Areas</Text>
              <View style={styles.areaCard}>
                {focusAreas.map((a, i) => (
                  <View key={a.topic}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.areaRow}>
                      <View style={[styles.areaRank, { backgroundColor: Colors.light.rust }]}>
                        <Text style={styles.areaRankTxt}>{i + 1}</Text>
                      </View>
                      <View style={styles.areaInfo}>
                        <Text style={styles.areaTopic} numberOfLines={1}>{a.topic}</Text>
                        <View style={styles.areaBarTrack}>
                          <View
                            style={[
                              styles.areaBarFill,
                              { width: `${a.pct}%` as any, backgroundColor: Colors.light.rust },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={[styles.areaPct, { color: Colors.light.rust }]}>{a.pct}%</Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.areaHint}>Topics that need the most practice time</Text>
              </View>
            </View>
          )}

          {topicAccuracy.length === 0 && (
            <View style={styles.noAccuracyCard}>
              <Text style={styles.noAccuracyTxt}>
                Strength and focus areas will appear once {profile?.name} has answered at least 3 questions per topic.
              </Text>
            </View>
          )}

          {/* ── Encouragement footer ── */}
          <View style={styles.encourageCard}>
            <Ionicons name="heart" size={20} color={Colors.light.rust} />
            <Text style={styles.encourageTxt}>
              Keep encouraging{" "}
              <Text style={styles.encourageName}>{profile?.name}</Text>
              's daily practice
            </Text>
          </View>

          {/* ── Share button ── */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.88}>
            <Ionicons name={copied ? "checkmark" : "share-social"} size={20} color="#fff" />
            <Text style={styles.shareBtnTxt}>
              {copied ? "Copied to clipboard!" : "Share Weekly Report"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.shareNote}>
            Copies a formatted summary ready to paste into WhatsApp
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 16, gap: 16 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.light.navy },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, marginTop: 2 },
  gradeBadge: {
    backgroundColor: Colors.light.navy, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  gradeBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },

  emptyCard: {
    backgroundColor: Colors.light.card, borderRadius: 22, padding: 32,
    alignItems: "center", gap: 12,
  },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.navy },
  emptySub: {
    fontFamily: "Inter_400Regular", fontSize: 14,
    color: Colors.light.textSecondary, textAlign: "center", lineHeight: 22,
  },

  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1, backgroundColor: Colors.light.card, borderRadius: 16, padding: 10,
    alignItems: "center", gap: 4, borderTopWidth: 3,
  },
  statNum: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy, textAlign: "center" },
  statLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textSecondary, textAlign: "center" },

  section: { gap: 10 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.navy },

  statusCard: {
    backgroundColor: Colors.light.card, borderRadius: 20, padding: 16, gap: 14, borderLeftWidth: 5,
  },
  statusHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusLabel: { fontFamily: "Inter_700Bold", fontSize: 18, flex: 1 },
  statusExam: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },

  progressCompareWrap: { gap: 10 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressLbl: {
    fontFamily: "Inter_600SemiBold", fontSize: 12,
    color: Colors.light.textSecondary, width: 58,
  },
  progressTrack: {
    flex: 1, height: 12, backgroundColor: Colors.light.border, borderRadius: 6, overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 6 },
  progressPct: { fontFamily: "Inter_700Bold", fontSize: 13, width: 38, textAlign: "right" },
  statusDetail: {
    fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary,
  },

  noStatusCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.light.card, borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: Colors.light.border, borderStyle: "dashed",
  },
  noStatusTxt: {
    fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, flex: 1,
  },

  areaCard: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 16, gap: 12 },
  areaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  areaRank: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  areaRankTxt: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  areaInfo: { flex: 1, gap: 4 },
  areaTopic: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.navy },
  areaBarTrack: { height: 8, backgroundColor: Colors.light.border, borderRadius: 4, overflow: "hidden" },
  areaBarFill: { height: "100%", borderRadius: 4 },
  areaPct: { fontFamily: "Inter_700Bold", fontSize: 14, width: 42, textAlign: "right" },
  areaHint: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  divider: { height: 1, backgroundColor: Colors.light.border },

  noAccuracyCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16 },
  noAccuracyTxt: {
    fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 20,
  },

  encourageCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.light.card, borderRadius: 18, padding: 16,
    borderWidth: 2, borderColor: Colors.light.border,
  },
  encourageTxt: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.light.text, flex: 1 },
  encourageName: { fontFamily: "Inter_700Bold", color: Colors.light.navy },

  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: Colors.light.navy, borderRadius: 18, paddingVertical: 18,
  },
  shareBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  shareNote: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: Colors.light.textSecondary, textAlign: "center", marginTop: -8,
  },
});
