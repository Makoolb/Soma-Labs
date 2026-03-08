import React, { useMemo } from "react";
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
import { MATHS_TOPICS, ENGLISH_TOPICS } from "@/constants/topics";

function XPBar({ xp }: { xp: number }) {
  const level = Math.floor(xp / 100) + 1;
  const progress = (xp % 100) / 100;
  return (
    <View style={xpStyles.container}>
      <View style={xpStyles.row}>
        <Text style={xpStyles.label}>Level {level}</Text>
        <Text style={xpStyles.xpText}>{xp} XP</Text>
      </View>
      <View style={xpStyles.track}>
        <View style={[xpStyles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const xpStyles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  xpText: { fontFamily: "Inter_500Medium", fontSize: 13, color: "rgba(255,255,255,0.8)" },
  track: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: Colors.light.accent, borderRadius: 3 },
});

function SubjectCard({
  subject,
  color,
  lightColor,
  icon,
  topics,
  progress,
  onPress,
}: {
  subject: string;
  color: string;
  lightColor: string;
  icon: string;
  topics: string[];
  progress: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[cardStyles.card, { borderColor: color }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[cardStyles.iconBg, { backgroundColor: lightColor }]}>
        <MaterialCommunityIcons name={icon as any} size={28} color={color} />
      </View>
      <Text style={cardStyles.title}>{subject}</Text>
      <Text style={cardStyles.topics}>{topics.length} topics</Text>
      <View style={cardStyles.track}>
        <View style={[cardStyles.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[cardStyles.pct, { color }]}>{Math.round(progress * 100)}% mastery</Text>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1.5,
  },
  iconBg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.text },
  topics: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  track: {
    height: 5,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
  },
  fill: { height: "100%", borderRadius: 3 },
  pct: { fontFamily: "Inter_500Medium", fontSize: 12 },
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, streakDays, totalXP, topicProgress, sessions } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const mathsMastery = useMemo(() => {
    const mathsP = topicProgress.filter((p) => p.subject === "maths");
    if (!mathsP.length) return 0;
    return mathsP.reduce((acc, p) => acc + (p.total > 0 ? p.correct / p.total : 0), 0) / mathsP.length;
  }, [topicProgress]);

  const englishMastery = useMemo(() => {
    const engP = topicProgress.filter((p) => p.subject === "english");
    if (!engP.length) return 0;
    return engP.reduce((acc, p) => acc + (p.total > 0 ? p.correct / p.total : 0), 0) / engP.length;
  }, [topicProgress]);

  const recentSessions = sessions.slice(0, 3);

  const quickTopics = [
    { subject: "maths" as const, topic: MATHS_TOPICS[0].name, color: Colors.light.maths },
    { subject: "english" as const, topic: ENGLISH_TOPICS[0].name, color: Colors.light.english },
    { subject: "maths" as const, topic: MATHS_TOPICS[1].name, color: Colors.light.maths },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 8, paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.heroName}>{profile?.name} {profile?.avatar}</Text>
            <Text style={styles.heroGrade}>Primary {profile?.grade} • Common Entrance</Text>
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={18} color={Colors.light.accent} />
            <Text style={styles.streakNum}>{streakDays}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
        </View>
        <XPBar xp={totalXP} />
      </View>

      {/* Subject cards */}
      <Text style={styles.sectionTitle}>Your Subjects</Text>
      <View style={styles.row}>
        <SubjectCard
          subject="Maths"
          color={Colors.light.maths}
          lightColor={Colors.light.mathsLight}
          icon="calculator-variant"
          topics={MATHS_TOPICS}
          progress={mathsMastery}
          onPress={() => {
            Haptics.selectionAsync();
            router.push({ pathname: "/session", params: { subject: "maths", topic: MATHS_TOPICS[0].name } });
          }}
        />
        <SubjectCard
          subject="English"
          color={Colors.light.english}
          lightColor={Colors.light.englishLight}
          icon="book-alphabet"
          topics={ENGLISH_TOPICS}
          progress={englishMastery}
          onPress={() => {
            Haptics.selectionAsync();
            router.push({ pathname: "/session", params: { subject: "english", topic: ENGLISH_TOPICS[0].name } });
          }}
        />
      </View>

      {/* Quick Practice */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Practice</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/practice")}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
        {quickTopics.map((qt, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.quickCard, { borderColor: qt.color + "40" }]}
            onPress={() => {
              Haptics.selectionAsync();
              router.push({ pathname: "/session", params: { subject: qt.subject, topic: qt.topic } });
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: qt.color + "18" }]}>
              <MaterialCommunityIcons
                name={qt.subject === "maths" ? "calculator-variant" : "book-alphabet"}
                size={20}
                color={qt.color}
              />
            </View>
            <Text style={styles.quickTopic} numberOfLines={2}>{qt.topic}</Text>
            <Text style={[styles.quickSubject, { color: qt.color }]}>
              {qt.subject === "maths" ? "Maths" : "English"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.sessionsCard}>
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
                        size={18}
                        color={color}
                      />
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionTopic} numberOfLines={1}>{s.topic}</Text>
                      <Text style={styles.sessionDate}>{new Date(s.date).toLocaleDateString()}</Text>
                    </View>
                    <Text style={[styles.sessionScore, { color }]}>{pct}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {recentSessions.length === 0 && (
        <View style={styles.emptySession}>
          <MaterialCommunityIcons name="pencil-box-outline" size={40} color={Colors.light.textTertiary} />
          <Text style={styles.emptyText}>No sessions yet. Start practising!</Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(tabs)/practice");
            }}
          >
            <Text style={styles.startBtnText}>Practice Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  heroCard: {
    backgroundColor: Colors.light.primary,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
  },
  heroName: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: "#fff",
    marginTop: 2,
  },
  heroGrade: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  streakBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 2,
  },
  streakNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#fff",
  },
  streakLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.light.text,
    marginBottom: -4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: -4,
  },
  seeAll: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.light.primary,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  quickRow: {
    gap: 12,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  quickCard: {
    width: 140,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1.5,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  quickTopic: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 18,
  },
  quickSubject: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  sessionsCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    overflow: "hidden",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTopic: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
  },
  sessionDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sessionScore: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginLeft: 66,
  },
  emptySession: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  startBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 4,
  },
  startBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
});
