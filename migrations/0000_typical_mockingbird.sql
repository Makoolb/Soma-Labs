CREATE TABLE "practice_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"score" integer NOT NULL,
	"total" integer NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "skill_maps" (
	"user_id" text PRIMARY KEY NOT NULL,
	"skill_map" jsonb DEFAULT '{}'::jsonb,
	"baseline_skill_map" jsonb DEFAULT '{}'::jsonb,
	"diagnostic_result" jsonb,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" text NOT NULL,
	"grade" text NOT NULL,
	"subject" text NOT NULL,
	"exam_date" text,
	"created_at" text,
	CONSTRAINT "student_profiles_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "user_xp" (
	"user_id" text PRIMARY KEY NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"last_practice_date" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
