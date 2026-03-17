import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Grade = "P4" | "P5" | "P6";
export type Subject = "English" | "Maths" | "Both";

export interface StudentProfile {
  name: string;
  grade: Grade;
  subject: Subject;
  examDate?: string;
  createdAt?: string;
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

export type SkillMap = Record<string, number>;

interface AppContextValue {
  profile: StudentProfile | null;
  isOnboarded: boolean;
  diagnosticDone: boolean;
  diagnosticResult: DiagnosticResult | null;
  skillMap: SkillMap | null;
  skillMapReady: boolean;
  sessions: SessionResult[];
  streakDays: number;
  totalXP: number;
  isLoading: boolean;
  saveProfile: (profile: StudentProfile) => Promise<void>;
  updateExamDate: (date: string | null) => Promise<void>;
  saveDiagnosticResult: (result: DiagnosticResult) => Promise<void>;
  saveSkillMap: (map: SkillMap) => Promise<void>;
  dismissSkillMapReady: () => void;
  addSession: (session: Omit<SessionResult, "id">) => Promise<void>;
  resetAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const KEYS = {
  PROFILE: "@somalabs/profile",
  DIAGNOSTIC: "@somalabs/diagnostic",
  SKILL_MAP: "@somalabs/skillMap",
  BASELINE_SKILL_MAP: "@somalabs/baselineSkillMap",
  SESSIONS: "@somalabs/sessions",
  STREAK: "@somalabs/streak",
  XP: "@somalabs/xp",
  LAST_PRACTICE: "@somalabs/lastPractice",
};

/**
 * Blends diagnostic baseline scores with first-attempt practice accuracy.
 * practiceWeight = min(0.7, firstAttemptCount / 14)  — caps at 70% influence
 * Topics not in the baseline are added at their raw practice accuracy.
 */
function blendSkillMap(baseline: SkillMap, sessions: SessionResult[]): SkillMap {
  const sorted = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const seen = new Set<string>();
  const practiceMap: Record<string, { correct: number; total: number }> = {};

  for (const s of sorted) {
    for (const a of s.answers) {
      const key = a.questionId || `${a.topic}__${a.subject}__noid__${s.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!practiceMap[a.topic]) practiceMap[a.topic] = { correct: 0, total: 0 };
      practiceMap[a.topic].total++;
      if (a.correct) practiceMap[a.topic].correct++;
    }
  }

  const blended: SkillMap = { ...baseline };

  for (const [topic, data] of Object.entries(practiceMap)) {
    const practiceScore = Math.round((data.correct / data.total) * 100);
    if (data.total < 1) continue;

    const weight = Math.min(0.7, data.total / 14);

    if (baseline[topic] !== undefined) {
      blended[topic] = Math.round(baseline[topic] * (1 - weight) + practiceScore * weight);
    } else {
      blended[topic] = practiceScore;
    }
  }

  return blended;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [skillMap, setSkillMap] = useState<SkillMap | null>(null);
  const [baselineSkillMap, setBaselineSkillMap] = useState<SkillMap | null>(null);
  const [skillMapReady, setSkillMapReady] = useState(false);
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const baselineRef = useRef<SkillMap | null>(null);

  useEffect(() => {
    baselineRef.current = baselineSkillMap;
  }, [baselineSkillMap]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [pStr, dStr, smStr, bsmStr, sStr, xpStr, streakStr, lastStr] = await Promise.all([
        AsyncStorage.getItem(KEYS.PROFILE),
        AsyncStorage.getItem(KEYS.DIAGNOSTIC),
        AsyncStorage.getItem(KEYS.SKILL_MAP),
        AsyncStorage.getItem(KEYS.BASELINE_SKILL_MAP),
        AsyncStorage.getItem(KEYS.SESSIONS),
        AsyncStorage.getItem(KEYS.XP),
        AsyncStorage.getItem(KEYS.STREAK),
        AsyncStorage.getItem(KEYS.LAST_PRACTICE),
      ]);
      if (pStr) setProfile(JSON.parse(pStr));
      if (dStr) setDiagnosticResult(JSON.parse(dStr));
      if (smStr) setSkillMap(JSON.parse(smStr));
      if (bsmStr) {
        const bsm = JSON.parse(bsmStr);
        setBaselineSkillMap(bsm);
        baselineRef.current = bsm;
      } else if (smStr) {
        // Migrate: if no baseline stored yet but skillMap exists, treat it as the baseline
        const sm = JSON.parse(smStr);
        setBaselineSkillMap(sm);
        baselineRef.current = sm;
        AsyncStorage.setItem(KEYS.BASELINE_SKILL_MAP, smStr);
      }
      if (sStr) setSessions(JSON.parse(sStr));
      if (xpStr) setTotalXP(parseInt(xpStr, 10));

      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (streakStr && lastStr) {
        const lastDate = new Date(lastStr).toDateString();
        const today = new Date().toDateString();
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
    const withDate: StudentProfile = { ...p, createdAt: p.createdAt ?? new Date().toISOString() };
    setProfile(withDate);
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(withDate));
  }

  async function updateExamDate(date: string | null) {
    if (!profile) return;
    const updated: StudentProfile = date
      ? { ...profile, examDate: date }
      : { name: profile.name, grade: profile.grade, subject: profile.subject };
    setProfile(updated);
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(updated));
  }

  async function saveDiagnosticResult(result: DiagnosticResult) {
    setDiagnosticResult(result);
    await AsyncStorage.setItem(KEYS.DIAGNOSTIC, JSON.stringify(result));
  }

  /**
   * Called once at diagnostic completion. Stores the map both as the live skillMap
   * and as the immutable baseline.
   */
  async function saveSkillMap(map: SkillMap) {
    setSkillMap(map);
    setBaselineSkillMap(map);
    baselineRef.current = map;
    setSkillMapReady(true);
    await Promise.all([
      AsyncStorage.setItem(KEYS.SKILL_MAP, JSON.stringify(map)),
      AsyncStorage.setItem(KEYS.BASELINE_SKILL_MAP, JSON.stringify(map)),
    ]);
  }

  function dismissSkillMapReady() {
    setSkillMapReady(false);
  }

  async function addSession(session: Omit<SessionResult, "id">) {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    const full: SessionResult = { ...session, id };

    const xpGained = full.score * 10 + 20;
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

      // Blend the live skillMap with the new session data (no skillMapReady ping)
      const baseline = baselineRef.current;
      if (baseline) {
        const blended = blendSkillMap(baseline, updated);
        setSkillMap(blended);
        AsyncStorage.setItem(KEYS.SKILL_MAP, JSON.stringify(blended));
      }

      return updated;
    });
  }

  async function resetAll() {
    await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
    setProfile(null);
    setDiagnosticResult(null);
    setSkillMap(null);
    setBaselineSkillMap(null);
    baselineRef.current = null;
    setSkillMapReady(false);
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
      skillMap,
      skillMapReady,
      sessions,
      streakDays,
      totalXP,
      isLoading,
      saveProfile,
      updateExamDate,
      saveDiagnosticResult,
      saveSkillMap,
      dismissSkillMapReady,
      addSession,
      resetAll,
    }),
    [profile, diagnosticResult, skillMap, skillMapReady, sessions, streakDays, totalXP, isLoading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
