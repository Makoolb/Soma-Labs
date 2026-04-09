import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, serial } from "drizzle-orm/pg-core";
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
 * skill_maps stores per-user skill data as JSONB objects (topic → score%).
 *
 * Architectural note: the topic-score pairs are stored as a single JSONB object
 * rather than normalised per-topic rows. This is intentional:
 *   - The skill map is always read/written as a unit (blending, display).
 *   - The topic set is dynamic and differs by grade/subject.
 *   - A JSONB blob avoids N-row reads/writes per session and simplifies the
 *     blending algorithm which operates on the whole map at once.
 * If per-topic analytics (aggregation, ranking across users) are needed later,
 * the map can be exploded into a separate analytics table at that point.
 */
export const skillMaps = pgTable("skill_maps", {
  userId: text("user_id").primaryKey(),
  skillMap: jsonb("skill_map").default(sql`'{}'::jsonb`),
  baselineSkillMap: jsonb("baseline_skill_map").default(sql`'{}'::jsonb`),
  diagnosticResult: jsonb("diagnostic_result"),
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
