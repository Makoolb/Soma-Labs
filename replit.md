# SabiLab — Common Entrance AI Tutor

An adaptive AI mobile tutor (Expo React Native app) for Nigerian Primary 4–6 students preparing for the Common Entrance Exam. Delivers daily Maths and English practice with AI-generated questions, tracks progress, and provides parents real-time visibility.

## Color Palette
- Navy:  `#1A2F5E`
- Rust:  `#C0392B`
- Gold:  `#E67E22`
- Sage:  `#27AE60`

## Tech Stack
- **Frontend**: Expo (SDK 54), Expo Router, React Native, TypeScript
- **Auth**: Clerk (`@clerk/clerk-expo`) — phone OTP (+234/+1), Google OAuth, Apple Sign In
- **State**: React Context + AsyncStorage (AppContext) with Clerk-gated cloud sync
- **Server state**: @tanstack/react-query
- **Backend**: Express + TypeScript (port 5000)
- **Database**: Replit PostgreSQL (Drizzle ORM + `pg` driver)
- **AI**: OpenAI integration via Replit AI Integration (no user key needed)
- **Icons**: @expo/vector-icons (Ionicons + MaterialCommunityIcons)
- **Fonts**: Inter (400, 500, 600, 700)

## App Structure

```
app/
  _layout.tsx          # Root layout — ClerkProvider (conditional), AppProvider, Stack nav
  index.tsx            # Redirect: auth → onboarding → diagnostic → tabs
  auth.tsx             # Auth screen: phone OTP (+234/+1), Google SSO, Apple Sign In
  onboarding.tsx       # 5-step onboarding: intro → name → grade → subject → exam date
  diagnostic.tsx       # 20-question diagnostic — builds SkillMap (max 5 skips)
  results.tsx          # Session results modal — score, breakdown, XP, next steps
  (tabs)/
    _layout.tsx        # Tab bar layout (NativeTabs + liquid glass fallback)
    index.tsx          # Home — hero card, streak, XP, today's practice, quick topics
    practice.tsx       # Practice — topic selector + full question-by-question quiz
    progress.tsx       # Progress — skill bars, session history, XP level, accuracy
    parent.tsx         # Redirect → index (legacy file kept for route safety)

context/
  AppContext.tsx        # Global app state: profile, sessions, XP, streak, diagnostic
                        # — accepts getToken/isSignedIn from Clerk for cloud sync
                        # — syncs to server after each mutation (fire-and-forget)
                        # — hydrates from server on sign-in

server/
  index.ts              # Express server (port 5000) + CORS with Authorization header
  routes.ts             # API routes + OpenAI endpoints + mounts sync routes at /api/me
  syncRoutes.ts         # Protected sync endpoints (Clerk JWT auth)
  db.ts                 # Drizzle ORM + pg connection

shared/
  schema.ts             # DB schema: users, student_profiles, user_progress, practice_sessions

data/
  questions.json        # Local question bank (186 Maths + 20 English questions)
  diagnosticQuestions.json  # Diagnostic test questions (P4/P5/P6)

constants/
  colors.ts             # Design tokens (navy, rust, gold, sage palettes)
```

## Navigation Flow
1. First launch → `/auth` (if signed out) → `/onboarding` → `/diagnostic` → `/(tabs)`
2. Returning user → `/auth` → `/(tabs)` (hydrates from server)
3. Guest mode (no Clerk key set) → `/onboarding` → `/diagnostic` → `/(tabs)`
4. Practice session → `/results` (modal, slide from bottom)
5. Tabs: Home / Practice / Progress

## Authentication Flow
- Powered by Clerk (`@clerk/clerk-expo`)
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` required in Replit Secrets
- App scheme: `somalabs://` (set in app.json) — used for OAuth redirects
- Phone OTP: Nigerian (+234) and US (+1) country codes
- Google OAuth: requires "Social Connections" → Google setup in Clerk dashboard
- Apple Sign In: requires Apple Developer account setup in Clerk dashboard
- Guest mode: if no publishable key set, auth is bypassed (local-only mode)

## Cloud Sync Endpoints (all require Clerk JWT in Authorization header)
- `GET /api/me` — Full user data (profile, xp, skillMap, sessions)
- `PUT /api/me/profile` — Upsert student profile
- `PUT /api/me/diagnostic` — Save diagnostic result
- `PUT /api/me/skillmap` — Save skill map + baseline
- `PUT /api/me/xp` — Update XP + streak
- `POST /api/me/sessions` — Save a practice session

## Database Schema (Drizzle + PostgreSQL)
- `users` — legacy auth table (unused with Clerk)
- `student_profiles` — clerk_user_id, name, grade, subject, exam_date
- `user_progress` — userId, totalXp, streakDays, lastPracticeDate, skillMap (JSONB), baselineSkillMap (JSONB), diagnosticResult (JSONB)
- `practice_sessions` — id, userId, date, subject, topic, score, total, xpEarned, answers (JSONB)

## Key Types (AppContext)
- `StudentProfile`: `{ name, grade: 'P4'|'P5'|'P6', subject: 'English'|'Maths'|'Both', examDate?: string }` — examDate is ISO string of first day of exam month
- `SessionResult`: `{ id, date, subject, topic, score, total, answers: AnswerRecord[] }`
- `DiagnosticResult`: `{ date, mathsScore, mathsTotal, englishScore, englishTotal }`
- `AnswerRecord`: `{ questionId, correct, topic, subject }`
- `SkillMap`: `Record<string, number>` — topic name → percentage 0–100
- `skillMapReady`: boolean — true just after diagnostic completes; triggers Home banner; cleared by `dismissSkillMapReady()`

## Question Banks
### data/questions.json — Practice questions (206 total)
- 186 Maths (P4/P5/P6) — includes `subtopic`, `difficulty`, Socratic `explanation`
- 20 English (mixed grades)
- Fields: `id`, `subject`, `grade`, `theme`, `topic`, `subtopic`, `difficulty`, `question`, `options[]`, `correctIndex`, `explanation`

### data/diagnosticQuestions.json — Diagnostic test questions (P4: 28, P5: 27, P6: 27)
- Sourced from official diagnostic test sheets, mapped to 8 curriculum topic categories
- 20 questions picked per session with guaranteed topic coverage (≥1 from each topic)

## Design Rules
- NEVER use emojis — use @expo/vector-icons only
- Always follow the fixed color palette above
- Use `useSafeAreaInsets()` for all insets — no hardcoded padding
- Web: 67px top inset, 34px bottom inset (or 84px tab bar height)
- Fonts: Inter family only (loaded via @expo-google-fonts/inter)

## Server Endpoints
- `POST /api/questions/generate` — AI-generated question (OpenAI)
- `POST /api/questions/hint` — Get a hint for a question
- `POST /api/questions/encourage` — Motivational message from AI
- `GET /` — Landing page (serves static HTML)

## Workflows
- **Start Backend**: `npm run server:dev` (port 5000)
- **Start Frontend**: `npm run expo:dev` (port 8081, Metro bundler)

## Environment Variables Required
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (pk_test_... or pk_live_...)
- `CLERK_SECRET_KEY` — Clerk secret key (sk_test_... or sk_live_...)
- `DATABASE_URL` — Replit PostgreSQL connection string (auto-set)
- `SESSION_SECRET` — Session secret (auto-set)
