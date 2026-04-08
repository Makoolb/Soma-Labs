import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import syncRoutes from "./syncRoutes";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are SabiBot, a friendly and encouraging AI tutor helping Nigerian primary school students (Primary 4–6) prepare for the Common Entrance Exam.

Your role:
- Generate age-appropriate questions in Maths and English
- Adapt difficulty to the student's grade and performance level
- Provide clear, simple explanations when students get answers wrong
- Give encouraging hints without giving away answers
- Use simple English that Nigerian P4–P6 students understand
- Reference relatable Nigerian contexts (naira, markets, local fruits, school scenarios) where helpful

Always respond in valid JSON only.`;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/questions/generate", async (req, res) => {
    try {
      const { subject, topic, grade, difficulty, previousQuestion } = req.body;

      const gradeLabel = `Primary ${grade}`;
      const difficultyLabel = difficulty === 1 ? "easy" : difficulty === 2 ? "medium" : "hard";

      const prompt = `Generate a ${difficultyLabel} ${subject} question for a Nigerian ${gradeLabel} student preparing for Common Entrance Exam.
Topic: ${topic}
${previousQuestion ? `Do NOT repeat this previous question: "${previousQuestion}"` : ""}

Return ONLY valid JSON in this exact format:
{
  "question": "the full question text",
  "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
  "correctIndex": 0,
  "explanation": "brief explanation of why the answer is correct (2-3 sentences max)",
  "topic": "${topic}"
}

For Maths: include numbers, word problems with Nigerian contexts (naira, market, farm).
For English: grammar, comprehension, vocabulary, spelling.
correctIndex is 0-based (0=A, 1=B, 2=C, 3=D).`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No content from AI");

      const question = JSON.parse(content);
      res.json(question);
    } catch (error) {
      console.error("Error generating question:", error);
      res.status(500).json({ error: "Failed to generate question" });
    }
  });

  app.post("/api/questions/hint", async (req, res) => {
    try {
      const { question, options, subject, grade } = req.body;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Give a helpful hint for this Primary ${grade} ${subject} question WITHOUT revealing the answer.

Question: ${question}
Options: ${options.join(", ")}

Return ONLY valid JSON: {"hint": "your hint here (1-2 sentences)"}`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 150,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No content");
      res.json(JSON.parse(content));
    } catch (error) {
      console.error("Error generating hint:", error);
      res.status(500).json({ error: "Failed to generate hint" });
    }
  });

  app.post("/api/questions/encourage", async (req, res) => {
    try {
      const { studentName, subject, score, total } = req.body;

      const response = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Write a short, warm encouragement message for ${studentName} who just scored ${score}/${total} in a ${subject} practice session. Keep it under 2 sentences, upbeat, and age-appropriate for a Nigerian primary school student.

Return ONLY valid JSON: {"message": "your encouragement here"}`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 100,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No content");
      res.json(JSON.parse(content));
    } catch (error) {
      console.error("Error generating encouragement:", error);
      res.status(500).json({ error: "Failed to generate encouragement" });
    }
  });

  app.use("/api/me", syncRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
