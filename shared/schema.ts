import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, serial, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const studentProfiles = pgTable("student_profiles", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").notNull(),
  grade: text("grade").notNull(),
  subject: text("subject").notNull(),
  examDate: text("exam_date"),
  createdAt: text("created_at"),
});

/**
 * skill_maps stores one row per (user, topic) — the per-topic structure
 * enables topic-level analytics and clean upserts from practice sessions.
 *
 * - score:         blended score (diagnostic baseline weighted with practice accuracy)
 * - baseline_score: raw diagnostic score for this topic (set once after diagnostic,
 *                   never overwritten by practice syncs)
 */
export const skillMaps = pgTable("skill_maps", {
  userId: text("user_id").notNull(),
  topic: text("topic").notNull(),
  score: integer("score").notNull().default(0),
  baselineScore: integer("baseline_score").notNull().default(0),
  updatedAt: text("updated_at"),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.topic] }),
}));

/**
 * diagnostic_results stores the raw diagnostic outcome per user.
 * Separate from skill_maps so it can be retrieved independently.
 */
export const diagnosticResults = pgTable("diagnostic_results", {
  userId: text("user_id").primaryKey(),
  result: jsonb("result").notNull(),
  updatedAt: text("updated_at"),
});

export const userXp = pgTable("user_xp", {
  userId: text("user_id").primaryKey(),
  totalXp: integer("total_xp").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  lastPracticeDate: text("last_practice_date"),
  updatedAt: text("updated_at"),
});

export const practiceSessions = pgTable("practice_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  subject: text("subject").notNull(),
  topic: text("topic").notNull(),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  xpEarned: integer("xp_earned").notNull().default(0),
  answers: jsonb("answers").default(sql`'[]'::jsonb`),
});

/**
 * user_badges stores one row per badge earned.
 * context allows re-earning with different state (e.g. "level:3" for Better Beta).
 * Primary key is (userId, badgeId, context) to prevent duplicate awards.
 */
export const userBadges = pgTable("user_badges", {
  userId: text("user_id").notNull(),
  badgeId: text("badge_id").notNull(),
  context: text("context").notNull().default(""),
  earnedAt: text("earned_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.badgeId, table.context] }),
}));
