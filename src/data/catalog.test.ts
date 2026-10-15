import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { catalog } from "./catalog";

it("derives homepage totals and every subject count from the unchanged source bank", () => {
  const questions: { id: string; subject: string; chapter: number }[] =
    JSON.parse(
      Array.from({ length: 8 }, (_, i) =>
        readFileSync(
          `public/game-center/data/bank-part-${String(i + 1).padStart(2, "0")}.txt`,
          "utf8",
        ),
      ).join("\n"),
    ).questions;
  expect(questions).toHaveLength(1091);
  expect(new Set(questions.map((q) => q.id)).size).toBe(1091);
  expect(catalog.total).toBe(questions.length);
  expect(catalog.subjects).toHaveLength(7);
  expect(catalog.chapters).toBe(49);
  for (const subject of catalog.subjects) {
    const items = questions.filter((q) => q.subject === subject.name);
    expect(subject.count).toBe(items.length);
    expect(subject.chapters).toBe(new Set(items.map((q) => q.chapter)).size);
  }
});
