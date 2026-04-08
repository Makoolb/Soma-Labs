import { Router } from "express";
import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import { getDb } from "./db";
import {
  studentProfiles,
  userProgress,
  practiceSessions,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.use(clerkMiddleware());
router.use(requireAuth());

// ── GET /api/me ──────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = getDb();
    const [profile, progress, sessions] = await Promise.all([
      db.select().from(studentProfiles).where(eq(studentProfiles.clerkUserId, userId)).limit(1),
      db.select().from(userProgress).where(eq(userProgress.userId, userId)).limit(1),
      db.select().from(practiceSessions).where(eq(practiceSessions.userId, userId))
        .orderBy(desc(practiceSessions.date)).limit(100),
    ]);

    const p = profile[0] ?? null;
    const prog = progress[0] ?? null;

    res.json({
      profile: p ? { name: p.name, grade: p.grade, subject: p.subject, examDate: p.examDate ?? undefined, createdAt: p.createdAt ?? undefined } : null,
      xp: prog ? { totalXp: prog.totalXp, streakDays: prog.streakDays, lastPracticeDate: prog.lastPracticeDate } : null,
      skillMap: prog?.skillMap ?? null,
      baselineSkillMap: prog?.baselineSkillMap ?? null,
      diagnosticResult: prog?.diagnosticResult ?? null,
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

// ── PUT /api/me/profile ───────────────────────────────────────────────────────
router.put("/profile", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { name, grade, subject, examDate, createdAt } = req.body;
    if (!name || !grade || !subject) return res.status(400).json({ error: "Missing fields" });

    const db = getDb();
    await db.insert(studentProfiles).values({
      clerkUserId: userId,
      name,
      grade,
      subject,
      examDate: examDate ?? null,
      createdAt: createdAt ?? new Date().toISOString(),
    }).onConflictDoUpdate({
      target: studentProfiles.clerkUserId,
      set: { name, grade, subject, examDate: examDate ?? null },
    });

    await db.insert(userProgress).values({ userId }).onConflictDoNothing();

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

    const { diagnosticResult } = req.body;
    if (!diagnosticResult) return res.status(400).json({ error: "Missing diagnosticResult" });

    const db = getDb();
    await db.insert(userProgress).values({ userId, diagnosticResult })
      .onConflictDoUpdate({
        target: userProgress.userId,
        set: { diagnosticResult },
      });

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/me/diagnostic error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/me/skillmap ──────────────────────────────────────────────────────
router.put("/skillmap", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { skillMap, baselineSkillMap } = req.body;

    const db = getDb();
    await db.insert(userProgress).values({
      userId,
      skillMap: skillMap ?? {},
      baselineSkillMap: baselineSkillMap ?? {},
    }).onConflictDoUpdate({
      target: userProgress.userId,
      set: {
        ...(skillMap !== undefined ? { skillMap } : {}),
        ...(baselineSkillMap !== undefined ? { baselineSkillMap } : {}),
      },
    });

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

    const { id, date, subject, topic, score, total, xpEarned, answers } = req.body;
    if (!id || !date || !subject) return res.status(400).json({ error: "Missing fields" });

    const db = getDb();

    await db.insert(practiceSessions).values({
      id,
      userId,
      date,
      subject,
      topic: topic ?? subject,
      score: score ?? 0,
      total: total ?? 0,
      xpEarned: xpEarned ?? 0,
      answers: answers ?? [],
    }).onConflictDoNothing();

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/me/sessions error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/me/xp ────────────────────────────────────────────────────────────
router.put("/xp", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { totalXp, streakDays, lastPracticeDate } = req.body;

    const db = getDb();
    await db.insert(userProgress).values({
      userId,
      totalXp: totalXp ?? 0,
      streakDays: streakDays ?? 0,
      lastPracticeDate: lastPracticeDate ?? null,
    }).onConflictDoUpdate({
      target: userProgress.userId,
      set: {
        ...(totalXp !== undefined ? { totalXp } : {}),
        ...(streakDays !== undefined ? { streakDays } : {}),
        ...(lastPracticeDate !== undefined ? { lastPracticeDate } : {}),
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/me/xp error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
