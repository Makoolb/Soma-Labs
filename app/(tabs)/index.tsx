import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors, { OPTION_COLORS } from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const QUICK_TOPICS = [
  { subject: "maths" as const, topic: "Whole Numbers", icon: "numeric", color: Colors.light.optionB },
  { subject: "maths" as const, topic: "Fractions & Decimals", icon: "fraction-one-half", color: Colors.light.optionC },
  { subject: "maths" as const, topic: "Algebra", icon: "alpha-x-box-outline", color: Colors.light.optionA },
  { subject: "maths" as const, topic: "Geometry & Angles", icon: "triangle-outline", color: Colors.light.optionD },
];

// Sort skillMap entries by score ascending (weakest first)
function getWeakTopics(skillMap: Record<string, number>, n: number) {
  return Object.entries(skillMap)
    .sort(([, a], [, b]) => a - b)
    .slice(0, n);
}

const TOPIC_COLORS = [Colors.light.rust, Colors.light.gold, Colors.light.optionC];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, diagnosticResult, skillMap, skillMapReady, dismissSkillMapReady, sessions, streakDays, totalXP } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const bannerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (skillMapReady) {
      bannerAnim.setValue(0);
      Animated.spring(bannerAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();
    }
  }, [skillMapReady]);

  function handleDismissBanner() {
    Haptics.selectionAsync();
    Animated.timing(bannerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      dismissSkillMapReady();
    });
  }

  const recentSessions = sessions.slice(0, 4);
  const today = new Date().toDateString();
  const todaySessions = sessions.filter((s) => new Date(s.date).toDateString() === today);
  const todayScore = todaySessions.reduce((a, s) => a + s.score, 0);
  const todayTotal = todaySessions.reduce((a, s) => a + s.total, 0);
  const level = Math.floor(totalXP / 500) + 1;
  const xpInLevel = totalXP % 500;

  const weakTopics = skillMap ? getWeakTopics(skillMap, 3) : [];

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
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{profile?.grade}</Text>
              </View>
              <View style={styles.badge}>
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
        <View style={styles.xpWrap}>
          <View style={styles.xpLabelRow}>
            <Text style={styles.xpLbl}>Level {level}</Text>
            <Text style={styles.xpVal}>{500 - xpInLevel} XP to next</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${(xpInLevel / 500) * 100}%` }]} />
          </View>
          <Text style={styles.xpTotalLbl}>{totalXP} XP total</Text>
        </View>
      </View>

      {/* Skill Map Ready Banner */}
      {skillMapReady && weakTopics.length > 0 && (
        <Animated.View style={[
          styles.skillBanner,
          {
            opacity: bannerAnim,
            transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          }
        ]}>
          <View style={styles.skillBannerHeader}>
            <View style={styles.skillBannerIcon}>
              <Ionicons name="map" size={22} color={Colors.light.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.skillBannerTitle}>Your Skill Map is ready!</Text>
              <Text style={styles.skillBannerSub}>Top 3 areas to focus on:</Text>
            </View>
            <TouchableOpacity onPress={handleDismissBanner} style={styles.bannerClose}>
              <Ionicons name="close" size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.weakTopicsRow}>
            {weakTopics.map(([topic, pct], i) => (
              <TouchableOpacity
                key={topic}
                style={[styles.weakChip, { borderColor: TOPIC_COLORS[i] }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push("/(tabs)/progress");
                }}
              >
                <View style={[styles.weakDot, { backgroundColor: TOPIC_COLORS[i] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.weakChipTopic, { color: TOPIC_COLORS[i] }]} numberOfLines={1}>{topic}</Text>
                  <Text style={styles.weakChipPct}>{pct}%</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.viewMapBtn}
            onPress={() => { Haptics.selectionAsync(); handleDismissBanner(); router.push("/(tabs)/progress"); }}
          >
            <Text style={styles.viewMapBtnText}>View Full Skill Map</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.light.navy} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Today's session */}
      <Text style={styles.sectionTitle}>Today's Session</Text>
      {todaySessions.length > 0 ? (
        <View style={styles.todayCard}>
          <View style={styles.todayRow}>
            <View style={styles.todayLeft}>
              <Text style={styles.todayLabel}>Sessions today: {todaySessions.length}</Text>
              <Text style={styles.todaySub}>Keep the momentum going!</Text>
            </View>
            <View style={[styles.scoreCircle, {
              borderColor: todayTotal > 0 && todayScore / todayTotal >= 0.7
                ? Colors.light.sage : Colors.light.gold
            }]}>
              <Text style={[styles.scorePct, {
                color: todayTotal > 0 && todayScore / todayTotal >= 0.7
                  ? Colors.light.sage : Colors.light.gold
              }]}>
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

      {/* Skill Map summary (persistent, after notification dismissed) */}
      {skillMap && !skillMapReady && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Skill Map</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/progress")}>
              <Text style={styles.seeAll}>Full report</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.skillCard}>
            {getWeakTopics(skillMap, 3).map(([topic, pct], i) => {
              const barColor = pct < 40 ? Colors.light.rust : pct < 70 ? Colors.light.gold : Colors.light.sage;
              return (
                <View key={topic} style={styles.skillRow}>
                  <Text style={styles.skillTopic} numberOfLines={1}>{topic}</Text>
                  <View style={styles.skillBarWrap}>
                    <View style={[styles.skillBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.skillPct, { color: barColor }]}>{pct}%</Text>
                </View>
              );
            })}
            <Text style={styles.skillHint}>These are your 3 weakest areas — focus on these first.</Text>
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
            <Text style={[styles.quickSub, { color: qt.color }]}>Maths</Text>
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
  hero: { backgroundColor: Colors.light.navy, borderRadius: 26, padding: 20, gap: 16 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroText: { gap: 3 },
  heroGreet: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.65)" },
  heroName: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff" },
  heroBadgeRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(255,255,255,0.22)" },
  badgeTxt: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  streakCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2, borderColor: Colors.light.gold,
    justifyContent: "center", alignItems: "center", gap: 1,
  },
  streakNum: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff", lineHeight: 24 },
  streakLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.gold },
  xpWrap: { gap: 6 },
  xpLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  xpLbl: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.gold },
  xpVal: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)" },
  xpTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: Colors.light.gold, borderRadius: 4 },
  xpTotalLbl: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "right" },

  // Skill Map Banner
  skillBanner: {
    backgroundColor: Colors.light.goldLight,
    borderRadius: 22, padding: 16,
    borderWidth: 2, borderColor: Colors.light.gold,
    gap: 14,
  },
  skillBannerHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  skillBannerIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.light.gold + "30",
    justifyContent: "center", alignItems: "center",
  },
  skillBannerTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
  skillBannerSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  bannerClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.light.border, justifyContent: "center", alignItems: "center" },
  weakTopicsRow: { gap: 8 },
  weakChip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, padding: 12, borderWidth: 2,
  },
  weakDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  weakChipTopic: { fontFamily: "Inter_700Bold", fontSize: 13 },
  weakChipPct: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  viewMapBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: Colors.light.gold + "22",
    borderRadius: 12, paddingVertical: 10,
  },
  viewMapBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.light.navy },

  // Skill Map compact summary
  skillCard: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 16, gap: 10 },
  skillRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  skillTopic: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text, width: 120 },
  skillBarWrap: { flex: 1, height: 8, backgroundColor: Colors.light.border, borderRadius: 4, overflow: "hidden" },
  skillBarFill: { height: "100%", borderRadius: 4 },
  skillPct: { fontFamily: "Inter_700Bold", fontSize: 13, width: 38, textAlign: "right" },
  skillHint: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },

  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.navy, marginBottom: -6 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: -6 },
  seeAll: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.optionB },
  todayCard: { backgroundColor: Colors.light.card, borderRadius: 22, padding: 16, gap: 12, borderWidth: 2, borderColor: Colors.light.border },
  todayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  todayLeft: { gap: 2 },
  todayLabel: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy },
  todaySub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  scoreCircle: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, justifyContent: "center", alignItems: "center" },
  scorePct: { fontFamily: "Inter_700Bold", fontSize: 16 },
  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.light.optionB, borderRadius: 14, paddingVertical: 12,
  },
  continueBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  startCard: { backgroundColor: Colors.light.card, borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: Colors.light.border },
  startCardInner: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  startIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  startTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
  startSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  quickRow: { gap: 12, paddingBottom: 4 },
  quickCard: { width: 148, backgroundColor: Colors.light.card, borderRadius: 18, padding: 14, gap: 8, overflow: "hidden" },
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
