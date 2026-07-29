/**
 * Lightweight retrieval for the help desk knowledge base.
 *
 * Uses BM25 ranking over tokenized article text, with a synonym layer so that
 * everyday phrasing ("can't log in", "wifi is down") reaches articles written
 * in more formal language.
 */

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "cant", "do",
  "does", "for", "from", "get", "has", "have", "how", "i", "if", "in", "is",
  "it", "its", "me", "my", "not", "of", "on", "or", "please", "so", "that",
  "the", "then", "there", "this", "to", "up", "was", "what", "when", "why",
  "will", "with", "you", "your",
]);

/** Maps everyday phrasing onto knowledge base vocabulary. */
const SYNONYMS = {
  login: ["log", "signin", "sign", "authenticate", "access"],
  // "log in" tokenizes to a bare "log" once the stop word "in" is dropped.
  log: ["login", "signin", "access", "authenticate", "password"],
  signin: ["login", "log", "access"],
  phish: ["scam", "suspicious", "fraud", "spam", "malicious"],
  suspicious: ["phishing", "scam", "strange", "weird", "unexpected"],
  weird: ["suspicious", "phishing", "strange", "scam"],
  strange: ["suspicious", "phishing", "weird", "scam"],
  password: ["passwd", "pwd", "credentials", "passphrase"],
  reset: ["change", "recover", "forgot", "forgotten"],
  locked: ["lockout", "disabled", "blocked", "suspended"],
  wifi: ["wireless", "wlan", "network", "internet"],
  internet: ["wifi", "network", "online", "connection"],
  vpn: ["remote", "tunnel", "connection"],
  broken: ["failing", "failed", "error", "issue", "problem", "wrong"],
  slow: ["lagging", "laggy", "sluggish", "freezing", "hanging", "performance"],
  print: ["printer", "printing", "printout"],
  printer: ["print", "printing"],
  email: ["mail", "outlook", "inbox", "smtp", "exchange"],
  install: ["installation", "download", "setup", "deploy"],
  mfa: ["2fa", "otp", "authenticator", "twofactor", "verification"],
  delete: ["deleted", "removed", "lost", "gone", "missing"],
  recover: ["restore", "undelete", "retrieve", "recovery"],
  computer: ["laptop", "machine", "pc", "desktop", "device"],
  crash: ["crashing", "crashed", "freeze", "frozen", "hang"],
};

const SUFFIXES = ["ingly", "edly", "ing", "ies", "er", "ed", "es", "s"];

function stripSuffix(word) {
  if (word.length <= 4) return word;
  for (const suffix of SUFFIXES) {
    if (word.length - suffix.length >= 3 && word.endsWith(suffix)) {
      const base = word.slice(0, -suffix.length);
      return suffix === "ies" ? `${base}y` : base;
    }
  }
  return word;
}

/**
 * Trims common English suffixes so "printing"/"printers" reduce to one root.
 * Applied repeatedly, since "printers" needs two passes (-s, then -er).
 * Accuracy matters less than consistency: queries and documents run through
 * the identical function, so both sides always agree.
 */
function stem(word) {
  let current = word;
  for (let pass = 0; pass < 3; pass++) {
    const next = stripSuffix(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && word.length > 1 && !STOP_WORDS.has(word))
    .map(stem);
}

/** Weight applied to synonym-derived terms; the user's own words count for more. */
const SYNONYM_WEIGHT = 0.4;

/**
 * Expands a query with synonym variants, returning weighted terms.
 *
 * Synonyms are deliberately down-weighted. A word the user actually typed is
 * stronger evidence than one we inferred, and without this a single query word
 * with many synonyms (e.g. "slow") can outvote a rare, highly specific term
 * like "vpn".
 */
export function expandQuery(tokens) {
  const weights = new Map();

  for (const token of tokens) {
    weights.set(token, 1);
  }

  for (const token of tokens) {
    for (const variant of SYNONYMS[token] ?? []) {
      const stemmed = stem(variant);
      if (!weights.has(stemmed)) {
        weights.set(stemmed, SYNONYM_WEIGHT);
      }
    }
  }

  return [...weights].map(([term, weight]) => ({ term, weight }));
}

const K1 = 1.5; // term-frequency saturation
const B = 0.75; // length normalization

/**
 * Builds a reusable BM25 index. Articles are indexed across their question,
 * keywords, category and answer, with the shorter high-signal fields repeated
 * so a keyword hit outweighs an incidental mention in the answer body.
 */
export function buildIndex(articles) {
  const documents = articles.map((article) => {
    const text = [
      article.question,
      article.question,
      (article.keywords ?? []).join(" "),
      (article.keywords ?? []).join(" "),
      article.category,
      article.answer,
    ].join(" ");

    const tokens = tokenize(text);
    const frequencies = new Map();
    for (const token of tokens) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }
    return { article, frequencies, length: tokens.length };
  });

  const averageLength =
    documents.reduce((sum, doc) => sum + doc.length, 0) / (documents.length || 1);

  const documentFrequency = new Map();
  for (const doc of documents) {
    for (const token of doc.frequencies.keys()) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  return { documents, averageLength, documentFrequency, total: documents.length };
}

/**
 * Returns articles ranked by BM25 relevance.
 * `minScore` filters out weak incidental matches so unrelated questions
 * correctly return nothing rather than a spurious article.
 */
export function search(index, query, { limit = 3, minScore = 1.0 } = {}) {
  const queryTokens = tokenize(query);
  const terms = expandQuery(queryTokens);
  if (terms.length === 0) return [];

  // Coverage is measured over the user's own words that actually appear in the
  // corpus. Terms nothing indexes (typos, filler) would otherwise make every
  // document look equally incomplete.
  const indexed = (term) => (index.documentFrequency.get(term) ?? 0) > 0;

  let anchorTerms = [...new Set(queryTokens)].filter(indexed);

  // If none of the user's literal words are indexed ("can't log in" reduces to
  // just "log"), anchor on their synonyms instead of returning nothing.
  if (anchorTerms.length === 0) {
    anchorTerms = terms.map((t) => t.term).filter(indexed);
  }
  if (anchorTerms.length === 0) return [];

  const scored = index.documents.map((doc) => {
    let score = 0;
    let matchedAnchors = 0;

    for (const term of anchorTerms) {
      if (doc.frequencies.has(term)) matchedAnchors += 1;
    }

    for (const { term, weight } of terms) {
      const frequency = doc.frequencies.get(term);
      if (!frequency) continue;

      const df = index.documentFrequency.get(term) ?? 0;
      // BM25 idf, floored at a small positive value so terms common to every
      // article still contribute slightly instead of going negative.
      const idf = Math.max(
        0.01,
        Math.log(1 + (index.total - df + 0.5) / (df + 0.5))
      );

      const normalized =
        (frequency * (K1 + 1)) /
        (frequency + K1 * (1 - B + (B * doc.length) / index.averageLength));

      score += weight * idf * normalized;
    }

    // Coordination factor: a document matching more of the query's distinct
    // terms beats one that scores highly by repeating a single term. This is
    // what separates "vpn is slow" (VPN + slow) from a generic slowness article.
    const coverage = matchedAnchors / anchorTerms.length;
    return { article: doc.article, score: score * (0.5 + 0.5 * coverage) };
  });

  return scored
    .filter((result) => result.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((result) => ({ ...result.article, _score: Number(result.score.toFixed(3)) }));
}
