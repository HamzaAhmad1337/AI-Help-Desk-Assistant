import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, expandQuery, buildIndex, search } from "../src/lib/search.js";
import { knowledgeBase, searchKnowledgeBase } from "../src/knowledgeBase.js";

test("tokenize strips stop words and punctuation", () => {
  assert.deepEqual(tokenize("I can't connect to the VPN!"), ["connect", "vpn"]);
});

test("tokenize stems plurals and gerunds to a shared root", () => {
  const [printers] = tokenize("printers");
  const [printing] = tokenize("printing");
  assert.equal(printers, printing);
});

test("expandQuery pulls in synonyms, stemmed to match the index", () => {
  const terms = expandQuery(tokenize("wifi")).map((t) => t.term);
  // Compare against the stemmed form, since that is what documents index as.
  for (const token of tokenize("wireless")) {
    assert.ok(terms.includes(token), `expected synonym term ${token}`);
  }
});

test("expandQuery weights the user's own words above synonyms", () => {
  const terms = expandQuery(tokenize("wifi"));
  const original = terms.find((t) => t.term === "wifi");
  const synonym = terms.find((t) => t.term !== "wifi");
  assert.equal(original.weight, 1);
  assert.ok(synonym.weight < 1);
});

test("finds the password article from informal phrasing", () => {
  const [top] = searchKnowledgeBase("i forgot my login credentials");
  assert.equal(top.id, "password-reset");
});

test("finds the VPN article from a plain complaint", () => {
  const [top] = searchKnowledgeBase("vpn won't connect");
  assert.equal(top.id, "vpn-connection");
});

test("distinguishes VPN speed from VPN connectivity", () => {
  const [top] = searchKnowledgeBase("vpn is really slow and laggy");
  assert.equal(top.id, "vpn-slow");
});

test("matches printing questions through stemming", () => {
  const results = searchKnowledgeBase("printing is broken");
  assert.equal(results[0].id, "printer-issues");
});

test("returns nothing for clearly unrelated questions", () => {
  assert.deepEqual(searchKnowledgeBase("what is the capital of France"), []);
});

test("respects the result limit", () => {
  assert.ok(searchKnowledgeBase("email password network", 2).length <= 2);
});

test("scores are ordered descending", () => {
  const results = searchKnowledgeBase("email not working");
  const scores = results.map((r) => r._score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test("index covers every article", () => {
  const index = buildIndex(knowledgeBase);
  assert.equal(index.documents.length, knowledgeBase.length);
});

test("empty query returns no results", () => {
  const index = buildIndex(knowledgeBase);
  assert.deepEqual(search(index, "   "), []);
});

test("knowledge base entries all have required fields", () => {
  for (const article of knowledgeBase) {
    assert.ok(article.id, "missing id");
    assert.ok(article.category, `${article.id} missing category`);
    assert.ok(article.question, `${article.id} missing question`);
    assert.ok(article.answer, `${article.id} missing answer`);
    assert.ok(Array.isArray(article.keywords), `${article.id} missing keywords`);
  }
});

test("knowledge base ids are unique", () => {
  const ids = knowledgeBase.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});
