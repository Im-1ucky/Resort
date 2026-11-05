import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing from .env");
}

const ai = new GoogleGenAI({ apiKey });

try {
  const response = await ai.models.generateContent({
    model,
    contents: "Reply with exactly: Gemini connection successful.",
  });

  console.log("Gemini response:", response.text);
} catch (error) {
  console.error("Gemini API test failed:", error.message);
  process.exitCode = 1;
}
