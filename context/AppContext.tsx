import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";

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

interface ServerXp {
  totalXp: number;
  streakDays: number;
  lastPracticeDate: string | null;
}

interface ServerUserData {
  profile: StudentProfile | null;
  xp: ServerXp | null;
  skillMap: SkillMap | null;
  baselineSkillMap: SkillMap | null;
  diagnosticResult: DiagnosticResult | null;
  sessions: SessionResult[];
}

interface SessionSyncResponse {
  ok: boolean;
  totalXp: number;
  streakDays: number;
  lastPracticeDate: string;
  xpEarned: number;
  skillMap?: SkillMap;
}

interface AppContextValue {
  profile: StudentProfile | null;
  isOnboarded: boolean;
  isSignedIn: boolean;
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
} as const;

/**
 * Blends diagnostic baseline scores with first-attempt practice accuracy.
 * practiceWeight = min(0.7, firstAttemptCount / 14)  — caps at 70% influence.
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
    if (data.total < 1) continue;
    const practiceScore = Math.round((data.correct / data.total) * 100);
    const weight = Math.min(0.7, data.total / 14);
    if (baseline[topic] !== undefined) {
      blended[topic] = Math.round(baseline[topic] * (1 - weight) + practiceScore * weight);
    } else {
      blended[topic] = practiceScore;
    }
  }

  return blended;
}

interface AppProviderProps {
  children: ReactNode;
  getToken: () => Promise<string | null>;
  isSignedIn: boolean;
  isAuthLoaded?: boolean;
  userId?: string | null;
}

export function AppProvider({
  children,
  getToken,
  isSignedIn,
  isAuthLoaded = true,
  userId = null,
}: AppProviderProps) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [skillMap, setSkillMap] = useState<SkillMap | null>(null);
  const [baselineSkillMap, setBaselineSkillMap] = useState<SkillMap | null>(null);
  const [skillMapReady, setSkillMapReady] = useState(false);
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [storageLoading, setStorageLoading] = useState(true);

  const baselineRef = useRef<SkillMap | null>(null);

  // Tracks the userId from the previous effect run to detect user changes.
  // Starts as undefined so first run can distinguish "initial" from "no user".
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  const isLoading = storageLoading || !isAuthLoaded;

  useEffect(() => {
    baselineRef.current = baselineSkillMap;
  }, [baselineSkillMap]);

  // Load local state from AsyncStorage once on mount.
  useEffect(() => {
    loadFromStorage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Detect user identity changes and react:
   *  - Signed out (userId null): clear all state + storage.
   *  - User switched: clear all state + storage, then hydrate from server (no migration).
   *  - Fresh sign-in (prevUser was null): hydrate + migrate local data if server is empty.
   * Runs only after both auth and storage are fully loaded.
   */
  useEffect(() => {
    if (!isAuthLoaded || storageLoading) return;

    const newUserId = userId ?? null;
    const prevUserId = prevUserIdRef.current;

    // No change — skip.
    if (prevUserId === newUserId) return;
    prevUserIdRef.current = newUserId;

    if (newUserId === null) {
      // User signed out — wipe everything.
      clearAll();
      return;
    }

    if (prevUserId !== null && prevUserId !== undefined) {
      // Different user on same device — clear old data, then hydrate fresh.
      // Do NOT migrate local data (it belongs to the previous user).
      clearAll().then(() => hydrateFromServer(false));
    } else {
      // Fresh sign-in (prev was null or undefined) — hydrate + offer migration.
      hydrateFromServer(true);
    }
  }, [userId, isAuthLoaded, storageLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Storage helpers ─────────────────────────────────────────────────────────

  async function loadFromStorage() {
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

      if (pStr) setProfile(JSON.parse(pStr) as StudentProfile);
      if (dStr) setDiagnosticResult(JSON.parse(dStr) as DiagnosticResult);
      if (smStr) setSkillMap(JSON.parse(smStr) as SkillMap);
      if (bsmStr) {
        const bsm = JSON.parse(bsmStr) as SkillMap;
        setBaselineSkillMap(bsm);
        baselineRef.current = bsm;
      } else if (smStr) {
        const sm = JSON.parse(smStr) as SkillMap;
        setBaselineSkillMap(sm);
        baselineRef.current = sm;
        AsyncStorage.setItem(KEYS.BASELINE_SKILL_MAP, smStr).catch(() => undefined);
      }
      if (sStr) setSessions(JSON.parse(sStr) as SessionResult[]);
      if (xpStr) setTotalXP(parseInt(xpStr, 10));

      if (streakStr && lastStr) {
        const lastDate = new Date(lastStr).toDateString();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86_400_000).toDateString();
        if (lastDate === today || lastDate === yesterday) {
          setStreakDays(parseInt(streakStr, 10));
        }
      }
    } catch (e) {
      console.error("loadFromStorage failed:", e);
    } finally {
      setStorageLoading(false);
    }
  }

  /** Clears all in-memory state AND AsyncStorage. Returns a promise. */
  async function clearAll() {
    setProfile(null);
    setDiagnosticResult(null);
    setSkillMap(null);
    setBaselineSkillMap(null);
    baselineRef.current = null;
    setSkillMapReady(false);
    setSessions([]);
    setStreakDays(0);
    setTotalXP(0);
    await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
  }

  // ── Network helpers ─────────────────────────────────────────────────────────

  async function buildHeaders(): Promise<Record<string, string> | null> {
    try {
      const token = await getToken();
      if (!token) return null;
      return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    } catch {
      return null;
    }
  }

  function getBase(): string | null {
    try { return getApiUrl(); } catch { return null; }
  }

  async function syncPut(path: string, body: object): Promise<void> {
    try {
      const base = getBase();
      const headers = await buildHeaders();
      if (!base || !headers) return;
      await fetch(new URL(path, base).toString(), {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.log(`Sync PUT ${path} failed:`, e);
    }
  }

  async function syncPost(path: string, body: object): Promise<void> {
    try {
      const base = getBase();
      const headers = await buildHeaders();
      if (!base || !headers) return;
      await fetch(new URL(path, base).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.log(`Sync POST ${path} failed:`, e);
    }
  }

  /** POST and return parsed JSON response, or null on failure. */
  async function syncPostWithResponse<T>(path: string, body: object): Promise<T | null> {
    try {
      const base = getBase();
      const headers = await buildHeaders();
      if (!base || !headers) return null;
      const res = await fetch(new URL(path, base).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return await res.json() as T;
    } catch (e) {
      console.log(`Sync POST (with response) ${path} failed:`, e);
      return null;
    }
  }

  // ── Server hydration ────────────────────────────────────────────────────────

  /**
   * Hydrates app state from the server for the currently signed-in user.
   *
   * @param shouldMigrate  When true and the server has no data, push all local
   *                       state to the server (first-time sign-in migration).
   *                       When false (user switch), skip migration entirely.
   */
  async function hydrateFromServer(shouldMigrate: boolean) {
    try {
      const base = getBase();
      const token = await getToken();
      if (!base || !token) return;

      const res = await fetch(new URL("/api/me", base).toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json() as ServerUserData;

      if (!data.profile) {
        // Server has no data for this account.
        if (shouldMigrate) {
          // Migrate ALL local data to server (first sign-in with prior guest progress).
          // Capture local state values here — they're valid for fresh sign-in.
          await migrateLocalToServer();
        }
        // For user switch (shouldMigrate=false) server had no data — state was
        // already cleared by clearAll(); nothing more to do.
        return;
      }

      // Server has data — overwrite local state entirely.
      const serverProfile: StudentProfile = data.profile;
      setProfile(serverProfile);
      await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(serverProfile));

      const dr = data.diagnosticResult ?? null;
      setDiagnosticResult(dr);
      if (dr) {
        await AsyncStorage.setItem(KEYS.DIAGNOSTIC, JSON.stringify(dr));
      } else {
        await AsyncStorage.removeItem(KEYS.DIAGNOSTIC);
      }

      const sm = data.skillMap && Object.keys(data.skillMap).length > 0 ? data.skillMap : null;
      setSkillMap(sm);
      if (sm) {
        await AsyncStorage.setItem(KEYS.SKILL_MAP, JSON.stringify(sm));
      } else {
        await AsyncStorage.removeItem(KEYS.SKILL_MAP);
      }

      const bsm = data.baselineSkillMap && Object.keys(data.baselineSkillMap).length > 0
        ? data.baselineSkillMap
        : null;
      setBaselineSkillMap(bsm);
      baselineRef.current = bsm;
      if (bsm) {
        await AsyncStorage.setItem(KEYS.BASELINE_SKILL_MAP, JSON.stringify(bsm));
      } else {
        await AsyncStorage.removeItem(KEYS.BASELINE_SKILL_MAP);
      }

      const serverSessions = Array.isArray(data.sessions) ? data.sessions : [];
      setSessions(serverSessions);
      await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(serverSessions));

      const xp = data.xp;
      const newXp = xp?.totalXp ?? 0;
      const newStreak = xp?.streakDays ?? 0;
      setTotalXP(newXp);
      setStreakDays(newStreak);
      await AsyncStorage.setItem(KEYS.XP, String(newXp));
      await AsyncStorage.setItem(KEYS.STREAK, String(newStreak));
      if (xp?.lastPracticeDate) {
        await AsyncStorage.setItem(KEYS.LAST_PRACTICE, xp.lastPracticeDate);
      } else {
        await AsyncStorage.removeItem(KEYS.LAST_PRACTICE);
      }
    } catch (e) {
      console.log("hydrateFromServer failed:", e);
    }
  }

  /**
   * Pushes all local data to the server.
   * Called only on first sign-in when the server account is empty.
   * Does NOT modify local state.
   */
  async function migrateLocalToServer() {
    const tasks: Promise<unknown>[] = [];

    if (profile) {
      tasks.push(syncPut("/api/me/profile", profile));
    }
    if (diagnosticResult) {
      tasks.push(syncPut("/api/me/diagnostic", { diagnosticResult }));
    }
    if (baselineRef.current) {
      tasks.push(syncPut("/api/me/skillmap", {
        skillMap: skillMap ?? baselineRef.current,
        baselineSkillMap: baselineRef.current,
      }));
    }
    if (totalXP > 0 || streakDays > 0) {
      tasks.push(syncPut("/api/me/xp", {
        totalXp: totalXP,
        streakDays,
        lastPracticeDate: null,
      }));
    }
    // Push sessions individually (server de-dupes via onConflictDoNothing).
    for (const s of sessions.slice(0, 50)) {
      tasks.push(syncPost("/api/me/sessions", { ...s, xpEarned: s.score * 10 + 20 }));
    }

    await Promise.all(tasks);
  }

  // ── Public actions ───────────────────────────────────────────────────────────

  async function saveProfile(p: StudentProfile) {
    const withDate: StudentProfile = { ...p, createdAt: p.createdAt ?? new Date().toISOString() };
    setProfile(withDate);
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(withDate));
    syncPut("/api/me/profile", withDate);
  }

  async function updateExamDate(date: string | null) {
    if (!profile) return;
    const updated: StudentProfile = date
      ? { ...profile, examDate: date }
      : { name: profile.name, grade: profile.grade, subject: profile.subject };
    setProfile(updated);
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(updated));
    syncPut("/api/me/profile", updated);
  }

  async function saveDiagnosticResult(result: DiagnosticResult) {
    setDiagnosticResult(result);
    await AsyncStorage.setItem(KEYS.DIAGNOSTIC, JSON.stringify(result));
    syncPut("/api/me/diagnostic", { diagnosticResult: result });
  }

  async function saveSkillMap(map: SkillMap) {
    setSkillMap(map);
    setBaselineSkillMap(map);
    baselineRef.current = map;
    setSkillMapReady(true);
    await Promise.all([
      AsyncStorage.setItem(KEYS.SKILL_MAP, JSON.stringify(map)),
      AsyncStorage.setItem(KEYS.BASELINE_SKILL_MAP, JSON.stringify(map)),
    ]);
    syncPut("/api/me/skillmap", { skillMap: map, baselineSkillMap: map });
  }

  function dismissSkillMapReady() {
    setSkillMapReady(false);
  }

  async function addSession(session: Omit<SessionResult, "id">) {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    const full: SessionResult = { ...session, id };
    const xpGained = full.score * 10 + 20;

    // Optimistic XP update.
    const optimisticXp = totalXP + xpGained;
    setTotalXP(optimisticXp);
    AsyncStorage.setItem(KEYS.XP, String(optimisticXp)).catch(() => undefined);

    // Optimistic streak update.
    const now = new Date().toISOString();
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    const last = await AsyncStorage.getItem(KEYS.LAST_PRACTICE).catch(() => null);
    const lastDate = last ? new Date(last).toDateString() : null;

    let newStreak = streakDays;
    if (lastDate !== today) {
      newStreak = lastDate === yesterday ? streakDays + 1 : 1;
      setStreakDays(newStreak);
      await AsyncStorage.setItem(KEYS.STREAK, String(newStreak)).catch(() => undefined);
      await AsyncStorage.setItem(KEYS.LAST_PRACTICE, now).catch(() => undefined);
    }

    // Persist session + update blended skill map + sync to server.
    setSessions((prev) => {
      const updated = [full, ...prev].slice(0, 100);
      AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(updated)).catch(() => undefined);
      const baseline = baselineRef.current;
      if (baseline) {
        const blended = blendSkillMap(baseline, updated);
        setSkillMap(blended);
        AsyncStorage.setItem(KEYS.SKILL_MAP, JSON.stringify(blended)).catch(() => undefined);
        // Sync updated skill map to server (fire-and-forget).
        syncPut("/api/me/skillmap", { skillMap: blended });
      }
      return updated;
    });

    // Server-authoritative XP/streak/skillMap: reconcile from server response.
    // (Fire-and-update — does not block the UI.)
    syncPostWithResponse<SessionSyncResponse>("/api/me/sessions", {
      ...full,
      xpEarned: xpGained,
    }).then((resp) => {
      if (resp?.ok) {
        setTotalXP(resp.totalXp);
        setStreakDays(resp.streakDays);
        AsyncStorage.setItem(KEYS.XP, String(resp.totalXp)).catch(() => undefined);
        AsyncStorage.setItem(KEYS.STREAK, String(resp.streakDays)).catch(() => undefined);
        if (resp.lastPracticeDate) {
          AsyncStorage.setItem(KEYS.LAST_PRACTICE, resp.lastPracticeDate).catch(() => undefined);
        }
        // Reconcile skill map with server's authoritative blend.
        if (resp.skillMap && Object.keys(resp.skillMap).length > 0) {
          setSkillMap(resp.skillMap);
          AsyncStorage.setItem(KEYS.SKILL_MAP, JSON.stringify(resp.skillMap)).catch(() => undefined);
        }
      }
    });
  }

  async function resetAll() {
    await clearAll();
  }

  const value = useMemo(
    () => ({
      profile,
      isOnboarded: !!profile,
      isSignedIn,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, isSignedIn, diagnosticResult, skillMap, skillMapReady, sessions, streakDays, totalXP, isLoading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
