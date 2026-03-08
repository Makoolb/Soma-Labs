import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StudentProfile {
  name: string;
  grade: 4 | 5 | 6;
  avatar: string;
}

export interface TopicProgress {
  subject: "maths" | "english";
  topic: string;
  correct: number;
  total: number;
  lastPracticed: string;
}

export interface SessionResult {
  id: string;
  subject: "maths" | "english";
  topic: string;
  score: number;
  total: number;
  date: string;
}

interface AppContextValue {
  profile: StudentProfile | null;
  isOnboarded: boolean;
  topicProgress: TopicProgress[];
  sessions: SessionResult[];
  streakDays: number;
  totalXP: number;
  isLoading: boolean;
  saveProfile: (profile: StudentProfile) => Promise<void>;
  updateTopicProgress: (subject: "maths" | "english", topic: string, correct: number, total: number) => Promise<void>;
  addSession: (session: Omit<SessionResult, "id">) => Promise<void>;
  resetProgress: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEYS = {
  PROFILE: "@somalabs/profile",
  PROGRESS: "@somalabs/progress",
  SESSIONS: "@somalabs/sessions",
  STREAK: "@somalabs/streak",
  XP: "@somalabs/xp",
  LAST_PRACTICE: "@somalabs/lastPractice",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([]);
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [profileStr, progressStr, sessionsStr, streakStr, xpStr, lastPracticeStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.PROGRESS),
        AsyncStorage.getItem(STORAGE_KEYS.SESSIONS),
        AsyncStorage.getItem(STORAGE_KEYS.STREAK),
        AsyncStorage.getItem(STORAGE_KEYS.XP),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_PRACTICE),
      ]);

      if (profileStr) setProfile(JSON.parse(profileStr));
      if (progressStr) setTopicProgress(JSON.parse(progressStr));
      if (sessionsStr) setSessions(JSON.parse(sessionsStr));
      if (xpStr) setTotalXP(parseInt(xpStr));

      const today = new Date().toDateString();
      if (streakStr && lastPracticeStr) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const lastDate = new Date(lastPracticeStr).toDateString();
        if (lastDate === today || lastDate === yesterday) {
          setStreakDays(parseInt(streakStr));
        } else {
          setStreakDays(0);
        }
      }
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveProfile(newProfile: StudentProfile) {
    setProfile(newProfile);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(newProfile));
  }

  async function updateTopicProgress(subject: "maths" | "english", topic: string, correct: number, total: number) {
    const now = new Date().toISOString();
    const today = new Date().toDateString();

    setTopicProgress((prev) => {
      const existing = prev.find((p) => p.subject === subject && p.topic === topic);
      let updated: TopicProgress[];
      if (existing) {
        updated = prev.map((p) =>
          p.subject === subject && p.topic === topic
            ? { ...p, correct: p.correct + correct, total: p.total + total, lastPracticed: now }
            : p
        );
      } else {
        updated = [...prev, { subject, topic, correct, total, lastPracticed: now }];
      }
      AsyncStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(updated));
      return updated;
    });

    const xpGained = correct * 10;
    setTotalXP((prev) => {
      const newXP = prev + xpGained;
      AsyncStorage.setItem(STORAGE_KEYS.XP, String(newXP));
      return newXP;
    });

    const lastPractice = await AsyncStorage.getItem(STORAGE_KEYS.LAST_PRACTICE);
    const lastDate = lastPractice ? new Date(lastPractice).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (lastDate !== today) {
      setStreakDays((prev) => {
        const newStreak = lastDate === yesterday ? prev + 1 : 1;
        AsyncStorage.setItem(STORAGE_KEYS.STREAK, String(newStreak));
        return newStreak;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_PRACTICE, now);
    }
  }

  async function addSession(session: Omit<SessionResult, "id">) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newSession: SessionResult = { ...session, id };
    setSessions((prev) => {
      const updated = [newSession, ...prev].slice(0, 50);
      AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));
      return updated;
    });
  }

  async function resetProgress() {
    await Promise.all(Object.values(STORAGE_KEYS).map((k) => AsyncStorage.removeItem(k)));
    setProfile(null);
    setTopicProgress([]);
    setSessions([]);
    setStreakDays(0);
    setTotalXP(0);
  }

  const value = useMemo(
    () => ({
      profile,
      isOnboarded: !!profile,
      topicProgress,
      sessions,
      streakDays,
      totalXP,
      isLoading,
      saveProfile,
      updateTopicProgress,
      addSession,
      resetProgress,
    }),
    [profile, topicProgress, sessions, streakDays, totalXP, isLoading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
