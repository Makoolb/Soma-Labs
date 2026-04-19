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
import { BADGE_DEFS, type BadgeDef, type EarnedBadge } from "@shared/badges";

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
  badges?: EarnedBadge[];
}

interface SessionSyncResponse {
  ok: boolean;
  totalXp: number;
  streakDays: number;
  lastPracticeDate: string;
  xpEarned: number;
  skillMap?: SkillMap;
  newBadges?: EarnedBadge[];
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
  pendingMigration: boolean;
  syncError: string | null;
  badges: EarnedBadge[];
  newlyEarnedBadges: BadgeDef[];
  saveProfile: (profile: StudentProfile) => Promise<void>;
  updateExamDate: (date: string | null) => Promise<void>;
  saveDiagnosticResult: (result: DiagnosticResult) => Promise<void>;
  saveSkillMap: (map: SkillMap) => Promise<void>;
  dismissSkillMapReady: () => void;
  addSession: (session: Omit<SessionResult, "id">) => Promise<void>;
  resetAll: () => Promise<void>;
  clearNewlyEarnedBadges: () => void;
  /** Called by the migration prompt: true = migrate, false = discard local data. */
  confirmMigration: (accept: boolean) => Promise<void>;
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

// practiceWeight = min(0.7, firstAttemptCount / 14); mirrors server-side blend.
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
  const [isHydrating, setIsHydrating] = useState(false);
  const [pendingMigration, setPendingMigration] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [newlyEarnedBadges, setNewlyEarnedBadges] = useState<BadgeDef[]>([]);

  const baselineRef = useRef<SkillMap | null>(null);
  // null = "signed out" so initial state never triggers clearAll on mount
  const prevUserIdRef = useRef<string | null>(null);

  const isLoading = storageLoading || !isAuthLoaded || isHydrating || pendingMigration;

  useEffect(() => {
    baselineRef.current = baselineSkillMap;
  }, [baselineSkillMap]);

  // Load local state from AsyncStorage once on mount.
  useEffect(() => {
    loadFromStorage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect user identity changes: sign-out clears state; sign-in hydrates from server.
  useEffect(() => {
    if (!isAuthLoaded || storageLoading) return;

    const newUserId = userId ?? null;
    const prevUserId = prevUserIdRef.current;

    if (prevUserId === newUserId) return;
    prevUserIdRef.current = newUserId;

    if (newUserId === null) {
      clearAll();
      return;
    }

    setIsHydrating(true);

    const doHydrate: Promise<void> =
      prevUserId !== null
        ? clearAll().then(() => hydrateFromServer(false))
        : hydrateFromServer(true);

    doHydrate.catch(() => undefined).finally(() => setIsHydrating(false));
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
    setBadges([]);
    setNewlyEarnedBadges([]);
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

  async function hydrateFromServer(shouldMigrate: boolean) {
    try {
      const base = getBase();
      const token = await getToken();
      if (!base || !token) return;

      const res = await fetch(new URL("/api/me", base).toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`/api/me returned ${res.status}`);

      setSyncError(null);
      const data = await res.json() as ServerUserData;

      if (!data.profile) {
        if (shouldMigrate) {
          const hasGuestData = sessions.length > 0 || totalXP > 0 || diagnosticResult !== null;
          if (hasGuestData) setPendingMigration(true);
        }
        return;
      }

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

      if (Array.isArray(data.badges)) {
        setBadges(data.badges);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      console.warn("hydrateFromServer failed:", e);
      setSyncError(msg);
      throw e;
    }
  }

  // Pushes local guest data to the server in order:
  //  1. parallel independent writes (profile, diagnostic, skill-map)
  //  2. sessions sequentially oldest-first
  //  3. server recompute for authoritative XP/streak
  async function migrateLocalToServer() {
    const phase1: Promise<unknown>[] = [];

    if (profile) {
      phase1.push(syncPut("/api/me/profile", profile));
    }
    if (diagnosticResult) {
      phase1.push(syncPut("/api/me/diagnostic", { diagnosticResult }));
    }
    if (baselineRef.current) {
      phase1.push(syncPut("/api/me/skillmap", {
        skillMap: skillMap ?? baselineRef.current,
        baselineSkillMap: baselineRef.current,
      }));
    }

    await Promise.all(phase1);

    const ordered = [...sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    for (const s of ordered) {
      await syncPost("/api/me/sessions", { ...s, xpEarned: s.score * 10 + 20 });
    }

    const result = await syncPostWithResponse<{
      ok: boolean;
      totalXp?: number;
      streakDays?: number;
      lastPracticeDate?: string | null;
    }>("/api/me/recompute", {});

    if (result?.ok) {
      if (result.totalXp !== undefined) {
        setTotalXP(result.totalXp);
        await AsyncStorage.setItem(KEYS.XP, String(result.totalXp)).catch(() => undefined);
      }
      if (result.streakDays !== undefined) {
        setStreakDays(result.streakDays);
        await AsyncStorage.setItem(KEYS.STREAK, String(result.streakDays)).catch(() => undefined);
      }
      if (result.lastPracticeDate) {
        await AsyncStorage.setItem(KEYS.LAST_PRACTICE, result.lastPracticeDate).catch(() => undefined);
      }
    }
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

  function clearNewlyEarnedBadges() {
    setNewlyEarnedBadges([]);
  }

  async function addSession(session: Omit<SessionResult, "id">) {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    const full: SessionResult = { ...session, id };
    const xpGained = full.score * 10 + 20;

    // Clear any stale celebration state before starting the new session sync.
    setNewlyEarnedBadges([]);

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
      }
      return updated;
    });

    // Fire-and-update: sync session, then reconcile XP/streak/skillMap/badges from server response.
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
        if (resp.skillMap && Object.keys(resp.skillMap).length > 0) {
          setSkillMap(resp.skillMap);
          AsyncStorage.setItem(KEYS.SKILL_MAP, JSON.stringify(resp.skillMap)).catch(() => undefined);
        }
        // Only apply badge awards when a new-badge response arrives for THIS session.
        // An empty newBadges array is still applied to ensure we always clear any stale defs.
        if (Array.isArray(resp.newBadges)) {
          if (resp.newBadges.length > 0) {
            setBadges((prev) => {
              const existingKeys = new Set(prev.map((b) => `${b.badgeId}::${b.context}`));
              const fresh = resp.newBadges!.filter(
                (b) => !existingKeys.has(`${b.badgeId}::${b.context}`)
              );
              return [...prev, ...fresh];
            });
            const defs = resp.newBadges
              .map((b) => BADGE_DEFS.find((d) => d.id === b.badgeId))
              .filter((d): d is NonNullable<typeof d> => d !== undefined);
            if (defs.length > 0) {
              setNewlyEarnedBadges(defs);
            }
          } else {
            // Empty awards — ensure celebration state is cleared for this session.
            setNewlyEarnedBadges([]);
          }
        }
      }
    });
  }

  async function resetAll() {
    await clearAll();
  }

  async function confirmMigration(accept: boolean) {
    setPendingMigration(false);
    if (accept) {
      await migrateLocalToServer();
    } else {
      await clearAll();
    }
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
      pendingMigration,
      syncError,
      badges,
      newlyEarnedBadges,
      saveProfile,
      updateExamDate,
      saveDiagnosticResult,
      saveSkillMap,
      dismissSkillMapReady,
      addSession,
      resetAll,
      clearNewlyEarnedBadges,
      confirmMigration,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, isSignedIn, diagnosticResult, skillMap, skillMapReady, sessions, streakDays, totalXP, isLoading, pendingMigration, syncError, badges, newlyEarnedBadges]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
