import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Grade = "P4" | "P5" | "P6";
export type Subject = "English" | "Maths" | "Both";

export interface StudentProfile {
  name: string;
  grade: Grade;
  subject: Subject;
}

export interface AnswerRecord {
  questionId: string;
  correct: boolean;
  topic: string;
  subject: "maths" | "english";
}

export interface SessionResult {
  id: string;
  date: string;
  subject: "maths" | "english" | "both";
  topic: string;
  score: number;
  total: number;
  answers: AnswerRecord[];
}

export interface DiagnosticResult {
  date: string;
  mathsScore: number;
  mathsTotal: number;
  englishScore: number;
  englishTotal: number;
}

interface AppContextValue {
  profile: StudentProfile | null;
  isOnboarded: boolean;
  diagnosticDone: boolean;
  diagnosticResult: DiagnosticResult | null;
  sessions: SessionResult[];
  streakDays: number;
  totalXP: number;
  isLoading: boolean;
  saveProfile: (profile: StudentProfile) => Promise<void>;
  saveDiagnosticResult: (result: DiagnosticResult) => Promise<void>;
  addSession: (session: Omit<SessionResult, "id">) => Promise<void>;
  resetAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const KEYS = {
  PROFILE: "@somalabs/profile",
  DIAGNOSTIC: "@somalabs/diagnostic",
  SESSIONS: "@somalabs/sessions",
  STREAK: "@somalabs/streak",
  XP: "@somalabs/xp",
  LAST_PRACTICE: "@somalabs/lastPractice",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [pStr, dStr, sStr, xpStr, streakStr, lastStr] = await Promise.all([
        AsyncStorage.getItem(KEYS.PROFILE),
        AsyncStorage.getItem(KEYS.DIAGNOSTIC),
        AsyncStorage.getItem(KEYS.SESSIONS),
        AsyncStorage.getItem(KEYS.XP),
        AsyncStorage.getItem(KEYS.STREAK),
        AsyncStorage.getItem(KEYS.LAST_PRACTICE),
      ]);
      if (pStr) setProfile(JSON.parse(pStr));
      if (dStr) setDiagnosticResult(JSON.parse(dStr));
      if (sStr) setSessions(JSON.parse(sStr));
      if (xpStr) setTotalXP(parseInt(xpStr, 10));

      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (streakStr && lastStr) {
        const lastDate = new Date(lastStr).toDateString();
        if (lastDate === today || lastDate === yesterday) {
          setStreakDays(parseInt(streakStr, 10));
        }
      }
    } catch (e) {
      console.error("Load failed:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveProfile(p: StudentProfile) {
    setProfile(p);
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(p));
  }

  async function saveDiagnosticResult(result: DiagnosticResult) {
    setDiagnosticResult(result);
    await AsyncStorage.setItem(KEYS.DIAGNOSTIC, JSON.stringify(result));
  }

  async function addSession(session: Omit<SessionResult, "id">) {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    const full: SessionResult = { ...session, id };

    const xpGained = full.score * 10;
    setTotalXP((prev) => {
      const next = prev + xpGained;
      AsyncStorage.setItem(KEYS.XP, String(next));
      return next;
    });

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const last = await AsyncStorage.getItem(KEYS.LAST_PRACTICE);
    const lastDate = last ? new Date(last).toDateString() : null;

    if (lastDate !== today) {
      const newStreak = lastDate === yesterday ? streakDays + 1 : 1;
      setStreakDays(newStreak);
      await AsyncStorage.setItem(KEYS.STREAK, String(newStreak));
      await AsyncStorage.setItem(KEYS.LAST_PRACTICE, new Date().toISOString());
    }

    setSessions((prev) => {
      const updated = [full, ...prev].slice(0, 100);
      AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(updated));
      return updated;
    });
  }

  async function resetAll() {
    await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
    setProfile(null);
    setDiagnosticResult(null);
    setSessions([]);
    setStreakDays(0);
    setTotalXP(0);
  }

  const value = useMemo(
    () => ({
      profile,
      isOnboarded: !!profile,
      diagnosticDone: !!diagnosticResult,
      diagnosticResult,
      sessions,
      streakDays,
      totalXP,
      isLoading,
      saveProfile,
      saveDiagnosticResult,
      addSession,
      resetAll,
    }),
    [profile, diagnosticResult, sessions, streakDays, totalXP, isLoading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
