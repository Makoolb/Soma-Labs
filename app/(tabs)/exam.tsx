import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

interface TieredExam {
  id: string;
  name: string;
  tier: "P4" | "P5" | "P6";
  subject: "maths" | "english" | "both";
  duration: number; // minutes
  questionCount: number;
  description: string;
}

// Placeholder for exams to be populated by the user
const EXAMS: TieredExam[] = [];

export default function ExamScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

  const availableExams = EXAMS.filter((e) => e.tier === profile?.grade);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Timed Exams</Text>
        <Text style={styles.subtitle}>Practice under exam conditions</Text>
      </View>

      {availableExams.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: Colors.light.navyLight }]}>
            <Ionicons name="clipboard-outline" size={44} color={Colors.light.navy} />
          </View>
          <Text style={styles.emptyTitle}>No exams available yet</Text>
          <Text style={styles.emptyBody}>
            Your teacher will add timed practice exams here. Check back soon!
          </Text>
          <TouchableOpacity
            style={[styles.practiceBtn, { backgroundColor: Colors.light.optionB }]}
            onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/practice"); }}
          >
            <Text style={styles.practiceBtnText}>Go to Practice</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.examsList}>
          {availableExams.map((exam, i) => (
            <View key={exam.id} style={styles.examCard}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.examHeader}>
                <View style={[styles.examIcon, { backgroundColor: Colors.light.optionB + "18" }]}>
                  <Ionicons name="clipboard" size={20} color={Colors.light.optionB} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.examName}>{exam.name}</Text>
                  <Text style={styles.examDesc}>{exam.description}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.startBtn, { backgroundColor: Colors.light.optionB }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    // TODO: Navigate to exam screen with exam ID
                    // router.push({ pathname: "/exam/[id]", params: { id: exam.id } });
                  }}
                >
                  <Ionicons name="play" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.examMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="timer" size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.metaText}>{exam.duration} minutes</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="help-circle-outline" size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.metaText}>{exam.questionCount} questions</Text>
                </View>
                <View style={[styles.subjectBadge, {
                  backgroundColor: exam.subject === "maths" ? Colors.light.optionB + "20" : Colors.light.rust + "20"
                }]}>
                  <Text style={[styles.subjectText, {
                    color: exam.subject === "maths" ? Colors.light.optionB : Colors.light.rust
                  }]}>
                    {exam.subject === "both" ? "Maths & English" : exam.subject === "maths" ? "Maths" : "English"}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 16, gap: 20 },
  header: { gap: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.light.navy },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary },
  
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 14 },
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
  practiceBtn: { borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  practiceBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },

  examsList: { gap: 14 },
  examCard: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 16, gap: 12 },
  divider: { height: 1, backgroundColor: Colors.light.border },
  examHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  examIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  examName: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.light.navy },
  examDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  startBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  
  examMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textSecondary },
  subjectBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  subjectText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});
