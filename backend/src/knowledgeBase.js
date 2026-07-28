import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kbPath = path.join(__dirname, "..", "data", "knowledge-base.json");

export const knowledgeBase = JSON.parse(readFileSync(kbPath, "utf-8"));

function score(entry, queryWords) {
  const haystack = [entry.question, entry.category, ...entry.keywords]
    .join(" ")
    .toLowerCase();
  let points = 0;
  for (const word of queryWords) {
    if (word.length < 3) continue;
    if (haystack.includes(word)) points += 1;
  }
  return points;
}

export function searchKnowledgeBase(query, limit = 3) {
  const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);
  return knowledgeBase
    .map((entry) => ({ entry, points: score(entry, queryWords) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map((r) => r.entry);
}
