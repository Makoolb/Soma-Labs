# SomaLabs — Common Entrance AI Tutor

An adaptive AI mobile tutor (Expo React Native app) for Nigerian Primary 4–6 students preparing for the Common Entrance Exam. Delivers daily Maths and English practice with AI-generated questions, tracks progress, and provides parents real-time visibility.

## Color Palette
- Navy:  `#1A2F5E`
- Rust:  `#C0392B`
- Gold:  `#E67E22`
- Sage:  `#27AE60`

## Tech Stack
- **Frontend**: Expo (SDK 54), Expo Router, React Native, TypeScript
- **State**: React Context + AsyncStorage (AppContext)
- **Server state**: @tanstack/react-query
- **Backend**: Express + TypeScript (port 5000)
- **AI**: OpenAI integration via Replit AI Integration (no user key needed)
- **Icons**: @expo/vector-icons (Ionicons + MaterialCommunityIcons)
- **Fonts**: Inter (400, 500, 600, 700)

## App Structure

```
app/
  _layout.tsx          # Root layout — fonts, providers, Stack navigator
  index.tsx            # Redirect: onboarding → diagnostic → tabs
  onboarding.tsx       # 5-step onboarding: intro → name → grade → subject → exam date
  diagnostic.tsx       # 20-question diagnostic from data/diagnosticQuestions.json — builds SkillMap
  results.tsx          # Session results modal — score, breakdown, XP, next steps
  (tabs)/
    _layout.tsx        # Tab bar layout (NativeTabs + liquid glass fallback)
    index.tsx          # Home — hero card, streak, XP, today's practice, quick topics
    practice.tsx       # Practice — topic selector + full question-by-question quiz
    progress.tsx       # Progress — skill bars, session history, XP level, accuracy
    parent.tsx         # Redirect → index (legacy file kept for route safety)

context/
  AppContext.tsx        # Global app state: profile, sessions, XP, streak, diagnostic

data/
  questions.json        # Local question bank (~43 questions, Maths+English, P4–P6)

constants/
  colors.ts             # Design tokens (navy, rust, gold, sage palettes)

server/
  index.ts              # Express server
  routes.ts             # API routes + OpenAI integration endpoints
```

## Navigation Flow
1. First launch → `/onboarding` → `/diagnostic` → `/(tabs)`
2. Repeat launches → `/(tabs)` (persisted via AsyncStorage)
3. Practice session → `/results` (modal, slide from bottom)
4. Tabs: Home / Practice / Progress

## Key Types (AppContext)
- `StudentProfile`: `{ name, grade: 'P4'|'P5'|'P6', subject: 'English'|'Maths'|'Both', examDate?: string }` — examDate is ISO string of first day of exam month
- `SessionResult`: `{ id, date, subject, topic, score, total, answers: AnswerRecord[] }`
- `DiagnosticResult`: `{ date, mathsScore, mathsTotal, englishScore, englishTotal }`
- `AnswerRecord`: `{ questionId, correct, topic, subject }`
- `SkillMap`: `Record<string, number>` — topic name → percentage 0–100
- `skillMapReady`: boolean — true just after diagnostic completes; triggers Home banner; cleared by `dismissSkillMapReady()`

## Question Banks
### data/questions.json — Practice questions (206 total)
- 186 Maths (P4/P5/P6) — from SomaLabs_Question_Bank_v4 — includes `subtopic`, `difficulty`, Socratic `explanation`
- 20 English (mixed grades)
- Fields: `id`, `subject`, `grade`, `theme`, `topic`, `subtopic`, `difficulty`, `question`, `options[]`, `correctIndex`, `explanation`

### data/diagnosticQuestions.json — Diagnostic test questions (P4: 28, P5: 27, P6: 27)
- Sourced from official diagnostic test sheets, mapped to 8 curriculum topic categories
- Topics: Whole Numbers, Factors & Multiples, Fractions & Decimals, Percentages & Ratios, Algebra, Numbers & Powers, Measurement & Time, Geometry & Angles, Statistics & Probability
- Fields: `id`, `grade`, `subtopic`, `topic`, `difficulty`, `question`, `options[]`, `correctIndex`, `explanation`
- 20 questions picked per session with guaranteed topic coverage (≥1 from each topic)

## Design Rules
- NEVER use emojis — use @expo/vector-icons only
- Always follow the fixed color palette above
- Use `useSafeAreaInsets()` for all insets — no hardcoded padding
- Web: 67px top inset, 34px bottom inset (or 84px tab bar height)
- Fonts: Inter family only (loaded via @expo-google-fonts/inter)

## Server Endpoints
- `POST /api/generate-question` — AI-generated question (OpenAI)
- `POST /api/hint` — Get a hint for a question
- `POST /api/encourage` — Motivational message from AI
- `GET /` — Landing page (serves static HTML)

## Workflows
- **Start Backend**: `npm run server:dev` (port 5000)
- **Start Frontend**: `npm run expo:dev` (port 8081, Metro bundler)
