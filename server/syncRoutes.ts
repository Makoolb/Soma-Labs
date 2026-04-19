import { Router } from "express";
import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import { getDb } from "./db";
import {
  studentProfiles,
  skillMaps,
  diagnosticResults,
  userXp,
  practiceSessions,
  userBadges,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { BADGE_DEFS, type EarnedBadge } from "@shared/badges";

const router = Router();

router.use(clerkMiddleware());
router.use(requireAuth());

// ── Shared types ─────────────────────────────────────────────────────────────

type SkillMap = Record<string, number>;

interface AnswerRecord {
  questionId?: string;
  correct: boolean;
  topic: string;
  subject: string;
}

interface SessionForBlend {
  id: string;
  date: string;
  answers: AnswerRecord[];
}

// Mirrors the client-side blendSkillMap — practiceWeight = min(0.7, firstAttemptCount / 14).
function blendSkillMap(baseline: SkillMap, sessions: SessionForBlend[]): SkillMap {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const seen = new Set<string>();
  const practiceMap: Record<string, { correct: number; total: number }> = {};

  for (const s of sorted) {
    for (const a of s.answers) {
      const key = a.questionId ?? `${a.topic}__${a.subject}__noid__${s.id}`;
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

async function readSkillMapForUser(
  db: ReturnType<typeof getDb>,
  userId: string
): Promise<{ skillMap: SkillMap; baselineSkillMap: SkillMap }> {
  const rows = await db.select().from(skillMaps).where(eq(skillMaps.userId, userId));
  const skillMap: SkillMap = {};
  const baselineSkillMap: SkillMap = {};
  for (const row of rows) {
    skillMap[row.topic] = row.score;
    if (row.baselineScore > 0) {
      baselineSkillMap[row.topic] = row.baselineScore;
    }
  }
  return { skillMap, baselineSkillMap };
}

async function upsertSkillTopics(
  db: ReturnType<typeof getDb>,
  userId: string,
  scores: SkillMap,
  baselineScores: SkillMap,
  updatingBaseline: boolean
): Promise<void> {
  const now = new Date().toISOString();
  const topics = new Set([...Object.keys(scores), ...Object.keys(baselineScores)]);

  await Promise.all(
    Array.from(topics).map((topic) => {
      const score = scores[topic] ?? 0;
      const baselineScore = baselineScores[topic] ?? 0;
      if (updatingBaseline) {
        return db
          .insert(skillMaps)
          .values({ userId, topic, score, baselineScore, updatedAt: now })
          .onConflictDoUpdate({
            target: [skillMaps.userId, skillMaps.topic],
            set: { score, baselineScore, updatedAt: now },
          });
      } else {
        return db
          .insert(skillMaps)
          .values({ userId, topic, score, baselineScore: 0, updatedAt: now })
          .onConflictDoUpdate({
            target: [skillMaps.userId, skillMaps.topic],
            set: { score, updatedAt: now },
          });
      }
    })
  );
}

// ── Badge evaluation ──────────────────────────────────────────────────────────

interface BadgeCandidate {
  badgeId: string;
  context: string;
}

async function computeNewBadges(
  db: ReturnType<typeof getDb>,
  userId: string,
  opts: {
    prevXp: number;
    newXp: number;
    prevStreak: number;
    newStreak: number;
    sessionScore: number;
    sessionTotal: number;
    allSessionCount: number;
    prevSessions: Array<{ score: number; total: number }>;
  }
): Promise<EarnedBadge[]> {
  const { prevXp, newXp, prevStreak, newStreak, sessionScore, sessionTotal, allSessionCount, prevSessions } = opts;

  const prevLevel = Math.floor(prevXp / 500) + 1;
  const newLevel = Math.floor(newXp / 500) + 1;

  const candidates: BadgeCandidate[] = [];

  // boldface — first session ever
  if (allSessionCount === 1) {
    candidates.push({ badgeId: "boldface", context: "" });
  }

  // steady_steady — streak first hits 5
  if (newStreak >= 5 && prevStreak < 5) {
    candidates.push({ badgeId: "steady_steady", context: "" });
  }

  // double_steady — streak first hits 10
  if (newStreak >= 10 && prevStreak < 10) {
    candidates.push({ badgeId: "double_steady", context: "" });
  }

  // iron_naija — streak first hits 30
  if (newStreak >= 30 && prevStreak < 30) {
    candidates.push({ badgeId: "iron_naija", context: "" });
  }

  // better_beta — per-level award
  if (newLevel > prevLevel) {
    for (let lvl = prevLevel + 1; lvl <= newLevel; lvl++) {
      candidates.push({ badgeId: "better_beta", context: `level:${lvl}` });
    }
  }

  // sharp_brain — session accuracy >= 80% AND better than previous avg
  if (sessionTotal >= 3) {
    const sessionAcc = sessionScore / sessionTotal;
    if (sessionAcc >= 0.8) {
      const prevAvgAcc =
        prevSessions.length > 0
          ? prevSessions.reduce((sum, s) => sum + (s.total > 0 ? s.score / s.total : 0), 0) /
            prevSessions.length
          : 0;
      if (sessionAcc > prevAvgAcc) {
        candidates.push({ badgeId: "sharp_brain", context: new Date().toISOString().slice(0, 10) });
      }
    }
  }

  // full_marks — 100% with at least 5 questions
  if (sessionTotal >= 5 && sessionScore === sessionTotal) {
    candidates.push({ badgeId: "full_marks", context: new Date().toISOString().slice(0, 10) });
  }

  if (candidates.length === 0) return [];

  // Filter out already-earned once-only badges
  const onceOnlyIds = ["boldface", "steady_steady", "double_steady", "iron_naija"];
  const onceOnlyCandidates = candidates.filter((c) => onceOnlyIds.includes(c.badgeId));
  const reEarnableCandidates = candidates.filter((c) => !onceOnlyIds.includes(c.badgeId));

  let alreadyEarned: Array<{ badgeId: string; context: string }> = [];
  if (onceOnlyCandidates.length > 0) {
    const rows = await db
      .select({ badgeId: userBadges.badgeId, context: userBadges.context })
      .from(userBadges)
      .where(eq(userBadges.userId, userId));
    alreadyEarned = rows;
  }

  // For better_beta, also check per-context
  const earnedKeys = new Set(alreadyEarned.map((r) => `${r.badgeId}::${r.context}`));

  const toAward: BadgeCandidate[] = [
    ...onceOnlyCandidates.filter((c) => !earnedKeys.has(`${c.badgeId}::${c.context}`)),
    ...reEarnableCandidates.filter((c) => {
      if (c.badgeId === "better_beta") return !earnedKeys.has(`${c.badgeId}::${c.context}`);
      return true;
    }),
  ];

  if (toAward.length === 0) return [];

  const now = new Date().toISOString();
  const earned: EarnedBadge[] = toAward.map((c) => ({
    badgeId: c.badgeId,
    context: c.context,
    earnedAt: now,
  }));

  await Promise.all(
    earned.map((b) =>
      db
        .insert(userBadges)
        .values({ userId, badgeId: b.badgeId, context: b.context, earnedAt: b.earnedAt })
        .onConflictDoNothing()
    )
  );

  return earned;
}

// ── GET /api/me ──────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    const [profile, diagRow, xpRow, sessions, badgeRows] = await Promise.all([
      db.select().from(studentProfiles).where(eq(studentProfiles.clerkUserId, userId)).limit(1),
      db.select().from(diagnosticResults).where(eq(diagnosticResults.userId, userId)).limit(1),
      db.select().from(userXp).where(eq(userXp.userId, userId)).limit(1),
      db
        .select()
        .from(practiceSessions)
        .where(eq(practiceSessions.userId, userId))
        .orderBy(desc(practiceSessions.date))
        .limit(100),
      db.select().from(userBadges).where(eq(userBadges.userId, userId)),
    ]);

    const { skillMap, baselineSkillMap } = await readSkillMapForUser(db, userId);

    const p = profile[0] ?? null;
    const xp = xpRow[0] ?? null;

    const badges: EarnedBadge[] = badgeRows.map((r) => ({
      badgeId: r.badgeId,
      context: r.context,
      earnedAt: r.earnedAt,
    }));

    res.json({
      profile: p
        ? { name: p.name, grade: p.grade, subject: p.subject, examDate: p.examDate ?? undefined, createdAt: p.createdAt ?? undefined }
        : null,
      xp: xp
        ? { totalXp: xp.totalXp, streakDays: xp.streakDays, lastPracticeDate: xp.lastPracticeDate }
        : null,
      skillMap: Object.keys(skillMap).length > 0 ? skillMap : null,
      baselineSkillMap: Object.keys(baselineSkillMap).length > 0 ? baselineSkillMap : null,
      diagnosticResult: diagRow[0]?.result ?? null,
      sessions: sessions.map((s) => ({
        id: s.id,
        date: s.date,
        subject: s.subject,
        topic: s.topic,
        score: s.score,
        total: s.total,
        xpEarned: s.xpEarned,
        answers: s.answers ?? [],
      })),
      badges,
    });
  } catch (e) {
    console.error("GET /api/me error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/me/sessions ─────────────────────────────────────────────────────
router.get("/sessions", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    const sessions = await db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.userId, userId))
      .orderBy(desc(practiceSessions.date))
      .limit(100);

    res.json(
      sessions.map((s) => ({
        id: s.id,
        date: s.date,
        subject: s.subject,
        topic: s.topic,
        score: s.score,
        total: s.total,
        xpEarned: s.xpEarned,
        answers: s.answers ?? [],
      }))
    );
  } catch (e) {
    console.error("GET /api/me/sessions error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/me/profile ───────────────────────────────────────────────────────
router.put("/profile", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { name, grade, subject, examDate } = req.body as {
      name?: string;
      grade?: string;
      subject?: string;
      examDate?: string | null;
    };
    if (!name || !grade || !subject) return res.status(400).json({ error: "Missing fields" });

    const db = getDb();
    await db
      .insert(studentProfiles)
      .values({ clerkUserId: userId, name, grade, subject, examDate: examDate ?? null, createdAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: studentProfiles.clerkUserId,
        set: { name, grade, subject, examDate: examDate ?? null },
      });

    // Ensure user_xp row exists for this user
    await db.insert(userXp).values({ userId, updatedAt: new Date().toISOString() }).onConflictDoNothing();

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/me/profile error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/me/diagnostic ────────────────────────────────────────────────────
router.put("/diagnostic", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { diagnosticResult } = req.body as { diagnosticResult?: unknown };
    if (!diagnosticResult) return res.status(400).json({ error: "Missing diagnosticResult" });

    const db = getDb();
    await db
      .insert(diagnosticResults)
      .values({ userId, result: diagnosticResult, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: diagnosticResults.userId,
        set: { result: diagnosticResult, updatedAt: new Date().toISOString() },
      });

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/me/diagnostic error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/me/skillmap ──────────────────────────────────────────────────────
// Called after diagnostic: sets both score and baseline_score for each topic.
router.put("/skillmap", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { skillMap, baselineSkillMap } = req.body as {
      skillMap?: SkillMap;
      baselineSkillMap?: SkillMap;
    };

    const db = getDb();
    const scores = skillMap ?? {};

    // updatingBaseline=true ONLY when the caller explicitly supplies baselineSkillMap
    const hasExplicitBaseline = baselineSkillMap !== undefined && baselineSkillMap !== null;
    const baseline = hasExplicitBaseline ? (baselineSkillMap as SkillMap) : scores;

    await upsertSkillTopics(db, userId, scores, baseline, hasExplicitBaseline);

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/me/skillmap error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/me/sessions ─────────────────────────────────────────────────────
router.post("/sessions", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id, date, subject, topic, score, total, answers } = req.body as {
      id?: string;
      date?: string;
      subject?: string;
      topic?: string;
      score?: number;
      total?: number;
      answers?: unknown;
    };
    if (!id || !date || !subject) return res.status(400).json({ error: "Missing fields" });

    const safeScore = Math.max(0, score ?? 0);
    const safeTotal = Math.max(0, total ?? 0);
    const xpEarned = safeScore * 10 + 20;

    const db = getDb();

    // ── Idempotency check ──────────────────────────────────────────────────────
    const existing = await db
      .select({ id: practiceSessions.id })
      .from(practiceSessions)
      .where(eq(practiceSessions.id, id))
      .limit(1);

    const isNewSession = existing.length === 0;

    if (isNewSession) {
      await db.insert(practiceSessions).values({
        id,
        userId,
        date,
        subject,
        topic: topic ?? subject,
        score: safeScore,
        total: safeTotal,
        xpEarned,
        answers: answers ?? [],
      });
    }

    // ── Read current XP + skill-map rows ──────────────────────────────────────
    const [xpRow, { baselineSkillMap }] = await Promise.all([
      db.select().from(userXp).where(eq(userXp.userId, userId)).limit(1).then((r) => r[0]),
      readSkillMapForUser(db, userId),
    ]);

    const currentXp = xpRow?.totalXp ?? 0;
    const currentStreak = xpRow?.streakDays ?? 0;
    const lastPracticeDate = xpRow?.lastPracticeDate ?? null;

    // ── Compute XP + streak (only for new sessions) ────────────────────────────
    let newTotalXp = currentXp;
    let newStreakDays = currentStreak;
    let newLastPracticeDate = lastPracticeDate;

    if (isNewSession) {
      const todayStr = new Date().toDateString();
      const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();
      const lastDateStr = lastPracticeDate ? new Date(lastPracticeDate).toDateString() : null;

      newTotalXp = currentXp + xpEarned;
      newStreakDays =
        lastDateStr === todayStr
          ? currentStreak
          : lastDateStr === yesterdayStr
            ? currentStreak + 1
            : 1;
      newLastPracticeDate = new Date().toISOString();
    }

    const allSessionRows = await db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.userId, userId));

    const sessions: SessionForBlend[] = allSessionRows.map((s) => ({
      id: s.id,
      date: s.date,
      answers: (s.answers ?? []) as AnswerRecord[],
    }));

    const newSkillMap = blendSkillMap(baselineSkillMap, sessions);
    const now = new Date().toISOString();

    // ── Badge evaluation (only for new sessions) ───────────────────────────────
    let newBadges: EarnedBadge[] = [];
    if (isNewSession) {
      const prevSessions = allSessionRows
        .filter((s) => s.id !== id)
        .map((s) => ({ score: s.score, total: s.total }));

      newBadges = await computeNewBadges(db, userId, {
        prevXp: currentXp,
        newXp: newTotalXp,
        prevStreak: currentStreak,
        newStreak: newStreakDays,
        sessionScore: safeScore,
        sessionTotal: safeTotal,
        allSessionCount: allSessionRows.length,
        prevSessions,
      });
    }

    await Promise.all([
      db
        .insert(userXp)
        .values({
          userId,
          totalXp: newTotalXp,
          streakDays: newStreakDays,
          lastPracticeDate: newLastPracticeDate,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userXp.userId,
          set: {
            totalXp: newTotalXp,
            streakDays: newStreakDays,
            lastPracticeDate: newLastPracticeDate,
            updatedAt: now,
          },
        }),
      upsertSkillTopics(db, userId, newSkillMap, {}, false),
    ]);

    res.json({
      ok: true,
      xpEarned: isNewSession ? xpEarned : 0,
      totalXp: newTotalXp,
      streakDays: newStreakDays,
      lastPracticeDate: newLastPracticeDate,
      skillMap: newSkillMap,
      newBadges,
    });
  } catch (e) {
    console.error("POST /api/me/sessions error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/me/recompute ────────────────────────────────────────────────────
// Recomputes XP, streak, and skill-map from stored server data — no client values accepted.
router.post("/recompute", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    const allSessions = await db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.userId, userId));

    if (allSessions.length === 0) return res.json({ ok: true, totalXp: 0, streakDays: 0 });

    const totalXp = allSessions.reduce((acc, s) => acc + (s.xpEarned ?? 0), 0);

    const daySet = new Set(allSessions.map((s) => new Date(s.date).toDateString()));
    const days = Array.from(daySet).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();

    let streakDays = 0;
    if (days[0] === today || days[0] === yesterday) {
      streakDays = 1;
      for (let i = 1; i < days.length; i++) {
        const prev = new Date(days[i - 1]);
        const curr = new Date(days[i]);
        const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86_400_000);
        if (diffDays === 1) {
          streakDays++;
        } else {
          break;
        }
      }
    }

    const lastPracticeDate = new Date(
      allSessions.reduce(
        (latest, s) => (new Date(s.date) > new Date(latest) ? s.date : latest),
        allSessions[0].date
      )
    ).toISOString();

    const { baselineSkillMap } = await readSkillMapForUser(db, userId);
    const sessionData: SessionForBlend[] = allSessions.map((s) => ({
      id: s.id,
      date: s.date,
      answers: (s.answers ?? []) as AnswerRecord[],
    }));
    const newSkillMap = blendSkillMap(baselineSkillMap, sessionData);

    const now = new Date().toISOString();

    await Promise.all([
      db
        .insert(userXp)
        .values({ userId, totalXp, streakDays, lastPracticeDate, updatedAt: now })
        .onConflictDoUpdate({
          target: userXp.userId,
          set: { totalXp, streakDays, lastPracticeDate, updatedAt: now },
        }),
      upsertSkillTopics(db, userId, newSkillMap, {}, false),
    ]);

    res.json({ ok: true, totalXp, streakDays, lastPracticeDate });
  } catch (e) {
    console.error("POST /api/me/recompute error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
