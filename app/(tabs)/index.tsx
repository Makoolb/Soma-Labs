import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  Modal,
  Pressable,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getWeakTopics(skillMap: Record<string, number>, n: number) {
  return Object.entries(skillMap)
    .sort(([, a], [, b]) => a - b)
    .slice(0, n);
}

function computeCountdown(examDate: string) {
  const exam = new Date(examDate);
  const now = new Date();
  const msPerDay = 86400000;
  const daysRemaining = Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / msPerDay));
  const isPast = exam.getTime() < now.getTime() && daysRemaining === 0;
  const barFill = Math.min(1, Math.max(0, daysRemaining / 365));

  let barColor: string;
  let urgencyMsg: string;
  let urgencyColor: string;

  if (isPast) {
    barColor = Colors.light.textSecondary;
    urgencyMsg = "Good luck with your exam!";
    urgencyColor = Colors.light.textSecondary;
  } else if (daysRemaining > 180) {
    barColor = Colors.light.sage;
    urgencyMsg = "Plenty of time — build strong foundations";
    urgencyColor = Colors.light.sage;
  } else if (daysRemaining > 90) {
    barColor = Colors.light.sage;
    urgencyMsg = "Keep building daily habits";
    urgencyColor = Colors.light.sage;
  } else if (daysRemaining > 30) {
    barColor = Colors.light.gold;
    urgencyMsg = "Ramp up your practice now";
    urgencyColor = Colors.light.gold;
  } else {
    barColor = Colors.light.rust;
    urgencyMsg = "Exam sprint — focus hard!";
    urgencyColor = Colors.light.rust;
  }

  const examLabel = `${MONTHS_FULL[exam.getMonth()]} ${exam.getFullYear()}`;
  return { daysRemaining, barFill, barColor, urgencyMsg, urgencyColor, examLabel, isPast };
}

function defaultPickerYear() {
  const now = new Date();
  return now.getMonth() < 3 ? now.getFullYear() : now.getFullYear() + 1;
}

const TOPIC_COLORS = [Colors.light.rust, Colors.light.gold, Colors.light.optionC];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, diagnosticResult, skillMap, skillMapReady, dismissSkillMapReady, sessions, streakDays, totalXP, updateExamDate } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const bannerAnim = useRef(new Animated.Value(0)).current;

  // Exam date editor modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMonth, setModalMonth] = useState<number>(3);
  const [modalYear, setModalYear] = useState(defaultPickerYear);

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

  function openModal() {
    if (profile?.examDate) {
      const d = new Date(profile.examDate);
      setModalMonth(d.getMonth());
      setModalYear(d.getFullYear());
    } else {
      setModalMonth(3);
      setModalYear(defaultPickerYear());
    }
    setShowModal(true);
  }

  async function saveExamDate() {
    const date = new Date(modalYear, modalMonth, 1).toISOString();
    await updateExamDate(date);
    setShowModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function removeExamDate() {
    await updateExamDate(null);
    setShowModal(false);
  }

  const recentSessions = sessions.slice(0, 4);
  const today = new Date().toDateString();
  const todaySessions = sessions.filter((s) => new Date(s.date).toDateString() === today);
  const todayScore = todaySessions.reduce((a, s) => a + s.score, 0);
  const todayTotal = todaySessions.reduce((a, s) => a + s.total, 0);
  const level = Math.floor(totalXP / 500) + 1;
  const xpInLevel = totalXP % 500;

  const weakTopics = skillMap ? getWeakTopics(skillMap, 3) : [];
  const countdown = profile?.examDate ? computeCountdown(profile.examDate) : null;

  // Urgency-adjusted messaging for today's practice
  const practiceSubtitle =
    countdown && countdown.daysRemaining <= 30
      ? "Exam sprint — every session counts!"
      : countdown && countdown.daysRemaining <= 90
      ? "Getting closer — keep the pressure on"
      : "Keep your streak going!";

  return (
    <>
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
          <LinearGradient
            colors={["#3460E8", "#1A2F5E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Decorative bubbles */}
          <View style={[styles.heroBubble, { top: -28, right: 90, width: 90, height: 90 }]} />
          <View style={[styles.heroBubble, { bottom: -30, left: -20, width: 110, height: 110, backgroundColor: "rgba(255,255,255,0.04)" }]} />
          <View style={[styles.heroBubble, { top: 10, left: "40%", width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.06)" }]} />

          {/* School kids illustration */}
          <Image
            source={require("@/assets/school-kids-portrait.png")}
            style={styles.heroChars}
            resizeMode="contain"
          />

          {/* Text content — confined to left ~63% */}
          <View style={styles.heroContent}>
            <Text style={styles.heroGreet}>Good day,</Text>
            <Text style={styles.heroName}>{profile?.name}</Text>
            <View style={styles.heroBadgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{profile?.grade}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{profile?.subject}</Text>
              </View>
              <View style={[styles.badge, styles.streakBadge]}>
                <Ionicons name="flame" size={12} color={Colors.light.gold} />
                <Text style={styles.streakBadgeTxt}>{streakDays}</Text>
              </View>
            </View>

            {/* XP bar */}
            <View style={styles.xpWrap}>
              <View style={styles.xpLabelRow}>
                <Text style={styles.xpLbl}>Level {level}</Text>
                <Text style={styles.xpVal}>{500 - xpInLevel} XP to next</Text>
              </View>
              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${(xpInLevel / 500) * 100}%` }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Exam Countdown */}
        {countdown ? (
          <View style={[styles.countdownCard, { borderLeftColor: countdown.barColor }]}>
            <View style={styles.countdownHeader}>
              <View style={[styles.countdownIconWrap, { backgroundColor: countdown.barColor + "20" }]}>
                <Ionicons name="calendar" size={18} color={countdown.barColor} />
              </View>
              <Text style={styles.countdownTitle}>Common Entrance</Text>
              <TouchableOpacity
                style={styles.editDateBtn}
                onPress={() => { Haptics.selectionAsync(); openModal(); }}
              >
                <Ionicons name="pencil" size={14} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.countdownBody}>
              <View style={styles.countdownDaysWrap}>
                <Text style={[styles.countdownDays, { color: countdown.barColor }]}>
                  {countdown.isPast ? "—" : countdown.daysRemaining}
                </Text>
                <Text style={styles.countdownDaysLbl}>
                  {countdown.isPast ? "exam passed" : "days to go"}
                </Text>
              </View>
              <View style={styles.countdownRight}>
                <Text style={styles.countdownExamLbl}>{countdown.examLabel}</Text>
                <View style={styles.countdownBarTrack}>
                  <View
                    style={[
                      styles.countdownBarFill,
                      { width: `${countdown.barFill * 100}%`, backgroundColor: countdown.barColor },
                    ]}
                  />
                </View>
                <Text style={[styles.countdownUrgency, { color: countdown.urgencyColor }]}>
                  {countdown.urgencyMsg}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.setDateCard}
            onPress={() => { Haptics.selectionAsync(); openModal(); }}
            activeOpacity={0.88}
          >
            <View style={[styles.countdownIconWrap, { backgroundColor: Colors.light.optionB + "20" }]}>
              <Ionicons name="calendar-outline" size={18} color={Colors.light.optionB} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.setDateTitle}>Set your exam date</Text>
              <Text style={styles.setDateSub}>We'll tailor your practice pace to your countdown</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.light.optionB} />
          </TouchableOpacity>
        )}

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
                  onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/progress"); }}
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
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionAccent, { backgroundColor: Colors.light.rust }]} />
          <Text style={styles.sectionTitle}>Today's Session</Text>
        </View>
        {todaySessions.length > 0 ? (
          <View style={styles.todayCard}>
            <View style={styles.todayRow}>
              <View style={styles.todayLeft}>
                <Text style={styles.todayLabel}>Sessions today: {todaySessions.length}</Text>
                <Text style={styles.todaySub}>{practiceSubtitle}</Text>
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
                <Text style={styles.startSub}>{practiceSubtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={Colors.light.gold} />
            </View>
          </TouchableOpacity>
        )}

        {/* Skill Map summary (persistent, after notification dismissed) */}
        {skillMap && !skillMapReady && (
          <>
            <View style={styles.sectionRow}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionAccent, { backgroundColor: Colors.light.sage }]} />
                <Text style={styles.sectionTitle}>Skill Map</Text>
              </View>
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
        <View style={styles.sectionRow}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccent, { backgroundColor: Colors.light.gold }]} />
            <Text style={styles.sectionTitle}>Quick Practice</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {QUICK_TOPICS.map((qt, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.quickCard, { backgroundColor: qt.color + "1A", borderColor: qt.color + "40" }]}
              onPress={() => {
                Haptics.selectionAsync();
                router.push({ pathname: "/(tabs)/practice", params: { autoStart: "1", subject: qt.subject, topic: qt.topic } });
              }}
              activeOpacity={0.82}
            >
              <View style={[styles.quickIcon, { backgroundColor: qt.color }]}>
                <MaterialCommunityIcons name={qt.icon as any} size={22} color="#fff" />
              </View>
              <Text style={[styles.quickTopic, { color: Colors.light.navy }]} numberOfLines={2}>{qt.topic}</Text>
              <View style={[styles.quickSubBadge, { backgroundColor: qt.color }]}>
                <Text style={styles.quickSubTxt}>Maths</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Recent activity */}
        {recentSessions.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionAccent, { backgroundColor: Colors.light.optionB }]} />
                <Text style={styles.sectionTitle}>Recent Activity</Text>
              </View>
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

      {/* Exam Date Edit Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Ionicons name="calendar" size={22} color={Colors.light.navy} />
              <Text style={styles.modalTitle}>Set Exam Date</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              When is your Common Entrance exam? We'll track your countdown and adjust your practice pace.
            </Text>

            {/* Year selector */}
            <View style={styles.yearRow}>
              <TouchableOpacity
                style={styles.yearArrow}
                onPress={() => { Haptics.selectionAsync(); setModalYear((y) => y - 1); }}
              >
                <Ionicons name="chevron-back" size={20} color={Colors.light.navy} />
              </TouchableOpacity>
              <Text style={styles.yearTxt}>{modalYear}</Text>
              <TouchableOpacity
                style={styles.yearArrow}
                onPress={() => { Haptics.selectionAsync(); setModalYear((y) => y + 1); }}
              >
                <Ionicons name="chevron-forward" size={20} color={Colors.light.navy} />
              </TouchableOpacity>
            </View>

            {/* Month grid */}
            <View style={styles.monthGrid}>
              {MONTHS.map((m, i) => {
                const sel = modalMonth === i;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthCell, sel && { backgroundColor: Colors.light.navy, borderColor: Colors.light.navy }]}
                    onPress={() => { Haptics.selectionAsync(); setModalMonth(i); }}
                  >
                    <Text style={[styles.monthTxt, sel && { color: "#fff", fontFamily: "Inter_700Bold" }]}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveExamDate}>
              <Text style={styles.modalSaveTxt}>Save</Text>
            </TouchableOpacity>

            {profile?.examDate && (
              <TouchableOpacity style={styles.modalRemoveBtn} onPress={removeExamDate}>
                <Text style={styles.modalRemoveTxt}>Remove exam date</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F7FF" },
  content: { paddingHorizontal: 16, gap: 14 },

  // Hero
  hero: { borderRadius: 26, overflow: "hidden", height: 218 },
  heroBubble: { position: "absolute", borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.07)" },
  heroChars: { position: "absolute", right: -4, bottom: 0, width: 122, height: 218 },
  heroContent: { padding: 20, gap: 10, maxWidth: "65%", flex: 1, justifyContent: "center" },
  heroGreet: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.72)" },
  heroName: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff", lineHeight: 34 },
  heroBadgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: "rgba(255,255,255,0.20)" },
  badgeTxt: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  streakBadge: { backgroundColor: Colors.light.gold + "35", flexDirection: "row", alignItems: "center", gap: 4 },
  streakBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.light.gold },
  xpWrap: { gap: 5, marginTop: 4 },
  xpLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  xpLbl: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.light.gold },
  xpVal: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.62)" },
  xpTrack: { height: 7, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 4, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: Colors.light.gold, borderRadius: 4 },

  // Section titles
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionAccent: { width: 5, height: 20, borderRadius: 3 },

  // Exam Countdown Card
  countdownCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 22,
    padding: 16,
    gap: 12,
    borderLeftWidth: 5,
  },
  countdownHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  countdownIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  countdownTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy, flex: 1 },
  editDateBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.light.border,
    justifyContent: "center", alignItems: "center",
  },
  countdownBody: { flexDirection: "row", alignItems: "center", gap: 16 },
  countdownDaysWrap: { alignItems: "center", minWidth: 60 },
  countdownDays: { fontFamily: "Inter_700Bold", fontSize: 40, lineHeight: 44 },
  countdownDaysLbl: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, textAlign: "center" },
  countdownRight: { flex: 1, gap: 6 },
  countdownExamLbl: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  countdownBarTrack: { height: 10, backgroundColor: Colors.light.border, borderRadius: 5, overflow: "hidden" },
  countdownBarFill: { height: "100%", borderRadius: 5 },
  countdownUrgency: { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  // Set date CTA card
  setDateCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderStyle: "dashed",
  },
  setDateTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.light.navy },
  setDateSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },

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

  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.navy },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: -6 },
  seeAll: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.optionB },
  todayCard: { backgroundColor: "#fff", borderRadius: 22, padding: 16, gap: 12, borderWidth: 2, borderColor: Colors.light.rust + "30" },
  todayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  todayLeft: { gap: 2 },
  todayLabel: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.navy },
  todaySub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  scoreCircle: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, justifyContent: "center", alignItems: "center" },
  scorePct: { fontFamily: "Inter_700Bold", fontSize: 16 },
  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.light.optionB, borderRadius: 14, paddingVertical: 13,
  },
  continueBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  startCard: { backgroundColor: "#fff", borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: Colors.light.gold + "50" },
  startCardInner: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  startIcon: { width: 58, height: 58, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  startTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.navy },
  startSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  quickRow: { gap: 12, paddingBottom: 4 },
  quickCard: { width: 150, borderRadius: 20, padding: 14, gap: 10, overflow: "hidden", borderWidth: 1.5 },
  quickIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  quickTopic: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 18 },
  quickSubBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  quickSubTxt: { fontFamily: "Inter_700Bold", fontSize: 11, color: "#fff" },
  recentCard: { backgroundColor: Colors.light.card, borderRadius: 20, overflow: "hidden" },
  recentRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  recentIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  recentInfo: { flex: 1 },
  recentTopic: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  recentDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  pctBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  pctBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  divider: { height: 1, backgroundColor: Colors.light.border, marginLeft: 62 },

  // Exam date modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === "web" ? 34 : 40,
    gap: 16,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.navy, flex: 1 },
  modalClose: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.light.border, justifyContent: "center", alignItems: "center" },
  modalHint: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 20 },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    paddingVertical: 12,
  },
  yearArrow: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.light.background,
    justifyContent: "center", alignItems: "center",
  },
  yearTxt: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.light.navy, minWidth: 70, textAlign: "center" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthCell: {
    width: "22%",
    flexGrow: 1,
    paddingVertical: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  monthTxt: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.text },
  modalSaveBtn: {
    backgroundColor: Colors.light.navy,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalSaveTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  modalRemoveBtn: { alignItems: "center", paddingVertical: 4 },
  modalRemoveTxt: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.rust },
});
