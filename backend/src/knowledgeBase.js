import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { buildIndex, search } from "./lib/search.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kbPath = path.join(__dirname, "..", "data", "knowledge-base.json");

export const knowledgeBase = JSON.parse(readFileSync(kbPath, "utf-8"));

const index = buildIndex(knowledgeBase);

export function searchKnowledgeBase(query, limit = 3) {
  return search(index, query, { limit });
}

export function getArticleById(id) {
  return knowledgeBase.find((article) => article.id === id) ?? null;
}

export const categories = [...new Set(knowledgeBase.map((a) => a.category))];
