import { Router } from "express";
import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import { getDb } from "./db";
import {
  studentProfiles,
  skillMaps,
  diagnosticResults,
  userXp,
  practiceSessions,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

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

/**
 * Blends a baseline skill map with first-attempt practice accuracy across all sessions.
 * Identical algorithm to the client-side blendSkillMap in context/AppContext.tsx.
 * practiceWeight = min(0.7, firstAttemptCount / 14) — caps at 70% influence.
 */
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

/**
 * Reads skill_maps rows for a user and returns {skillMap, baselineSkillMap} objects.
 */
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

/**
 * Upserts per-topic skill_map rows. When updatingBaseline=true, both score and
 * baseline_score are written (used after diagnostic). When false, only score is
 * written (used after practice sessions — baseline never changes).
 */
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

// ── GET /api/me ──────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    const [profile, diagRow, xpRow, sessions] = await Promise.all([
      db.select().from(studentProfiles).where(eq(studentProfiles.clerkUserId, userId)).limit(1),
      db.select().from(diagnosticResults).where(eq(diagnosticResults.userId, userId)).limit(1),
      db.select().from(userXp).where(eq(userXp.userId, userId)).limit(1),
      db
        .select()
        .from(practiceSessions)
        .where(eq(practiceSessions.userId, userId))
        .orderBy(desc(practiceSessions.date))
        .limit(100),
    ]);

    const { skillMap, baselineSkillMap } = await readSkillMapForUser(db, userId);

    const p = profile[0] ?? null;
    const xp = xpRow[0] ?? null;

    res.json({
      profile: p
        ? { name: p.name, grade: p.grade, subject: p.subject, examDate: p.examDate ?? undefined }
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
    // (i.e. immediately after a diagnostic). A caller that supplies only skillMap
    // (e.g. a blended-score update) must go through POST /api/me/sessions, which
    // uses updatingBaseline=false and never touches baseline_score.
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
// Idempotent: skips XP/streak/skill-map update if session already exists.
// Server-authoritative: computes XP, streak, and full skill-map blend.
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
        total: total ?? 0,
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

    // ── Recompute full skill-map blend from all sessions ───────────────────────
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

    // ── Persist updates (score only, baseline unchanged) ──────────────────────
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
    });
  } catch (e) {
    console.error("POST /api/me/sessions error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/me/xp ─────────────────────────────────────────────────────────────
// Used ONLY during initial data migration (first sign-in with existing local data).
//
// When force=false (default): rejected if server already has XP, preventing
// client-side tampering after normal use.
// When force=true: always overwrites — used as the final step of migration to
// restore the authoritative local streak/XP after sequential session uploads,
// which use today's date and produce an approximated streak.
router.put("/xp", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { totalXp, streakDays, lastPracticeDate, force } = req.body as {
      totalXp?: number;
      streakDays?: number;
      lastPracticeDate?: string | null;
      force?: boolean;
    };

    const db = getDb();

    if (!force) {
      // Non-force path: only write if server has no XP (first-time account setup).
      const [current] = await db
        .select()
        .from(userXp)
        .where(eq(userXp.userId, userId))
        .limit(1);

      if (current && current.totalXp > 0) {
        // Server already has XP — reject to prevent accidental or malicious override.
        return res.json({ ok: false, reason: "server_has_data" });
      }
    }

    const now = new Date().toISOString();
    await db
      .insert(userXp)
      .values({
        userId,
        totalXp: totalXp ?? 0,
        streakDays: streakDays ?? 0,
        lastPracticeDate: lastPracticeDate ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userXp.userId,
        set: {
          totalXp: totalXp ?? 0,
          streakDays: streakDays ?? 0,
          lastPracticeDate: lastPracticeDate ?? null,
          updatedAt: now,
        },
      });

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/me/xp error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
