import React, { useState } from "react";
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
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { MATHS_TOPICS, ENGLISH_TOPICS, type Topic } from "@/constants/topics";

function TopicCard({
  topic,
  subject,
  color,
  lightColor,
  progress,
  onPress,
}: {
  topic: Topic;
  subject: string;
  color: string;
  lightColor: string;
  progress?: { correct: number; total: number };
  onPress: () => void;
}) {
  const pct = progress && progress.total > 0 ? progress.correct / progress.total : null;

  return (
    <TouchableOpacity style={styles.topicCard} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.topicIcon, { backgroundColor: lightColor }]}>
        <MaterialCommunityIcons name={topic.icon as any} size={22} color={color} />
      </View>
      <View style={styles.topicInfo}>
        <Text style={styles.topicName}>{topic.name}</Text>
        {pct !== null ? (
          <View style={styles.topicProgress}>
            <View style={styles.miniTrack}>
              <View style={[styles.miniFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
            </View>
            <Text style={[styles.topicPct, { color }]}>{Math.round(pct * 100)}%</Text>
          </View>
        ) : (
          <Text style={styles.topicNew}>Not started yet</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
    </TouchableOpacity>
  );
}

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const { topicProgress } = useApp();
  const [activeSubject, setActiveSubject] = useState<"maths" | "english">("maths");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

  const topics = activeSubject === "maths" ? MATHS_TOPICS : ENGLISH_TOPICS;
  const color = activeSubject === "maths" ? Colors.light.maths : Colors.light.english;
  const lightColor = activeSubject === "maths" ? Colors.light.mathsLight : Colors.light.englishLight;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={styles.headerTitle}>Practice</Text>
        <Text style={styles.headerSub}>Choose a topic to begin</Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeSubject === "maths" && styles.tabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveSubject("maths");
            }}
          >
            <MaterialCommunityIcons
              name="calculator-variant"
              size={18}
              color={activeSubject === "maths" ? "#fff" : Colors.light.maths}
            />
            <Text style={[styles.tabText, activeSubject === "maths" && styles.tabTextActive]}>
              Maths
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeSubject === "english" && styles.tabActiveEng]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveSubject("english");
            }}
          >
            <MaterialCommunityIcons
              name="book-alphabet"
              size={18}
              color={activeSubject === "english" ? "#fff" : Colors.light.english}
            />
            <Text style={[styles.tabText, activeSubject === "english" && styles.tabTextActive]}>
              English
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {topics.map((topic) => {
          const p = topicProgress.find((tp) => tp.subject === activeSubject && tp.topic === topic.name);
          return (
            <TopicCard
              key={topic.name}
              topic={topic}
              subject={activeSubject}
              color={color}
              lightColor={lightColor}
              progress={p}
              onPress={() => {
                Haptics.selectionAsync();
                router.push({ pathname: "/session", params: { subject: activeSubject, topic: topic.name } });
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    backgroundColor: Colors.light.card,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 4,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.light.text,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.light.maths,
  },
  tabActiveEng: {
    backgroundColor: Colors.light.english,
  },
  tabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  tabTextActive: {
    color: "#fff",
  },
  list: {
    padding: 16,
    gap: 10,
  },
  topicCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 14,
    gap: 14,
  },
  topicIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  topicInfo: {
    flex: 1,
    gap: 6,
  },
  topicName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
  },
  topicProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  miniTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  miniFill: {
    height: "100%",
    borderRadius: 2,
  },
  topicPct: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    width: 32,
    textAlign: "right",
  },
  topicNew: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
});
