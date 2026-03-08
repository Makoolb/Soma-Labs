import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const { width } = Dimensions.get("window");

const AVATARS = ["🦁", "🐘", "🦅", "🦋", "🐬", "🦊"];
const GRADES = [4, 5, 6] as const;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { saveProfile } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<4 | 5 | 6 | null>(null);
  const [avatar, setAvatar] = useState(0);
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function goToStep(nextStep: number) {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(nextStep);
  }

  async function finish() {
    if (!grade) return;
    setSaving(true);
    await saveProfile({ name: name.trim() || "Star Student", grade, avatar: AVATARS[avatar] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)");
  }

  const steps = [
    // Step 0: Welcome
    <View key="welcome" style={styles.stepContainer}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="book-open-page-variant" size={56} color={Colors.light.primary} />
      </View>
      <Text style={styles.headline}>Welcome to{"\n"}SomaLabs</Text>
      <Text style={styles.subtext}>
        Your personal AI tutor for Common Entrance Exam success. Let's set up your learning profile!
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => goToStep(1)}>
        <Text style={styles.primaryBtnText}>Get Started</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </View>,

    // Step 1: Name
    <View key="name" style={styles.stepContainer}>
      <Text style={styles.stepLabel}>Step 1 of 3</Text>
      <Text style={styles.headline}>What's your name?</Text>
      <Text style={styles.subtext}>We'll personalise your experience just for you.</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your first name"
        placeholderTextColor={Colors.light.textTertiary}
        value={name}
        onChangeText={setName}
        maxLength={30}
        autoCapitalize="words"
        autoFocus
      />
      <TouchableOpacity
        style={[styles.primaryBtn, !name.trim() && styles.disabledBtn]}
        onPress={() => name.trim() && goToStep(2)}
        disabled={!name.trim()}
      >
        <Text style={styles.primaryBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </View>,

    // Step 2: Grade
    <View key="grade" style={styles.stepContainer}>
      <Text style={styles.stepLabel}>Step 2 of 3</Text>
      <Text style={styles.headline}>What class are you in?</Text>
      <Text style={styles.subtext}>We'll set the right difficulty level for you.</Text>
      <View style={styles.gradeRow}>
        {GRADES.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.gradeCard, grade === g && styles.gradeCardSelected]}
            onPress={() => {
              Haptics.selectionAsync();
              setGrade(g);
            }}
          >
            <Text style={[styles.gradeNum, grade === g && styles.gradeNumSelected]}>
              P{g}
            </Text>
            <Text style={[styles.gradeText, grade === g && styles.gradeTextSelected]}>
              Primary {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.primaryBtn, !grade && styles.disabledBtn]}
        onPress={() => grade && goToStep(3)}
        disabled={!grade}
      >
        <Text style={styles.primaryBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </View>,

    // Step 3: Avatar
    <View key="avatar" style={styles.stepContainer}>
      <Text style={styles.stepLabel}>Step 3 of 3</Text>
      <Text style={styles.headline}>Pick your avatar</Text>
      <Text style={styles.subtext}>Choose who will guide you on your learning journey.</Text>
      <View style={styles.avatarGrid}>
        {AVATARS.map((a, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.avatarCard, avatar === i && styles.avatarCardSelected]}
            onPress={() => {
              Haptics.selectionAsync();
              setAvatar(i);
            }}
          >
            <Text style={styles.avatarEmoji}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.primaryBtn, saving && styles.disabledBtn]}
        onPress={finish}
        disabled={saving}
      >
        <Text style={styles.primaryBtnText}>{saving ? "Setting up..." : "Start Learning!"}</Text>
        {!saving && <Ionicons name="rocket" size={20} color="#fff" />}
      </TouchableOpacity>
    </View>,
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, step >= i && styles.dotActive]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          {steps[step]}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.border,
  },
  dotActive: {
    backgroundColor: Colors.light.primary,
    width: 24,
  },
  stepContainer: {
    alignItems: "center",
    gap: 20,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  stepLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.primary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 40,
  },
  subtext: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  input: {
    width: "100%",
    height: 56,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    paddingHorizontal: 20,
    fontFamily: "Inter_500Medium",
    fontSize: 17,
    color: Colors.light.text,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  gradeRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  gradeCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    paddingVertical: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.light.border,
    gap: 6,
  },
  gradeCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryLight,
  },
  gradeNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.light.textSecondary,
  },
  gradeNumSelected: {
    color: Colors.light.primary,
  },
  gradeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  gradeTextSelected: {
    color: Colors.light.primary,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    width: "100%",
  },
  avatarCard: {
    width: (width - 48 - 36) / 3,
    aspectRatio: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  avatarCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryLight,
  },
  avatarEmoji: {
    fontSize: 40,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: "100%",
    marginTop: 8,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#fff",
  },
});
