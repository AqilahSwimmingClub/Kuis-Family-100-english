import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";

// Derive homepage metadata from the same bank served by Game Center.
// Only this small summary is shipped in the homepage bundle.
const questions: { subject: string; chapter: number }[] = JSON.parse(
  Array.from({ length: 8 }, (_, i) =>
    readFileSync(
      new URL(
        `./public/game-center/data/bank-part-${String(i + 1).padStart(2, "0")}.txt`,
        import.meta.url,
      ),
      "utf8",
    ),
  ).join("\n"),
).questions;
const catalog = {
  total: questions.length,
  chapters: new Set(questions.map((q) => `${q.subject}|${q.chapter}`)).size,
  subjects: [...new Set(questions.map((q) => q.subject))].map((name) => ({
    name,
    count: questions.filter((q) => q.subject === name).length,
    chapters: new Set(
      questions.filter((q) => q.subject === name).map((q) => q.chapter),
    ).size,
  })),
};
export default defineConfig({
  define: { __GAME_CENTER_CATALOG__: JSON.stringify(catalog) },
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
