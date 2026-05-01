/**
 * Phase 38 — preview the commit-message rewrite WITHOUT touching git.
 *
 * Reads each commit on the current branch, applies the same trim
 * rules as cleanup-commit-messages.py, and prints a side-by-side
 * "before / after" so the maintainer can decide whether to commit
 * to the rewrite.
 *
 *   node scripts/preview-commit-cleanup.mjs        # all commits
 *   node scripts/preview-commit-cleanup.mjs --limit 20
 *   node scripts/preview-commit-cleanup.mjs --changed-only
 *
 * Run is read-only: no git mutation, no force-push, no filter-repo.
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
const changedOnly = args.includes("--changed-only");

const KEEP_AS_IS_LINES = 3;
const MAX_BODY_CHARS = 200;
const BAD_TRAILERS = [
  "co-authored-by: claude",
  "generated with",
  "🤖",
];

// Parse the Python-syntax overrides file. We don't run Python -- just
// regex-extract the {hash: body} pairs. The agent that wrote it used
// only double-quoted single-line strings, so a tight regex covers it.
const OVERRIDES = new Map();
const overridePath = "scripts/commit-overrides.py";
if (existsSync(overridePath)) {
  const src = readFileSync(overridePath, "utf8");
  const re = /^\s*"([0-9a-f]{7})"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,/gm;
  for (const m of src.matchAll(re)) {
    OVERRIDES.set(m[1], m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
}

function stripTrailers(body) {
  return body
    .split("\n")
    .filter((ln) => !BAD_TRAILERS.some((m) => ln.toLowerCase().includes(m)))
    .join("\n")
    .trim();
}

function isHeader(paragraph) {
  const stripped = paragraph.trim();
  if (!stripped) return true;
  return stripped.split("\n")[0].trimEnd().endsWith(":");
}

function isBulletPara(paragraph) {
  const lines = paragraph.split("\n").filter((ln) => ln.trim());
  if (lines.length === 0) return false;
  return lines.every((ln) => /^\s*[-*]\s/.test(ln));
}

function shortenToFirstSentence(text) {
  text = text.trim();
  if (!text) return null;
  let flat = text.split(/\s+/).join(" ").replaceAll("—", "-").replaceAll("–", "-");
  const m = flat.match(/^(.{10,}?[.?!])(?:\s|$)/);
  const candidate = m ? m[1].trim() : flat;
  if (candidate.length > MAX_BODY_CHARS) return null;
  return candidate;
}

function summariseBody(body) {
  body = body.trim();
  if (!body) return null;
  const paragraphs = body.split(/\n\s*\n/);
  for (const para of paragraphs) {
    if (isHeader(para) || isBulletPara(para)) continue;
    const summary = shortenToFirstSentence(para);
    if (summary) return summary;
  }
  return null;
}

function rewriteMessage(raw, hash) {
  const lines = raw.split("\n");
  if (lines.length === 0) return raw;
  const subject = lines[0];
  const body = lines.slice(1).join("\n").trim();

  // Hand-curated override path takes precedence.
  if (OVERRIDES.has(hash)) {
    const override = OVERRIDES.get(hash);
    if (override) return `${subject}\n\n${override}\n`;
    // Empty override + already-empty body = no-op.
    return body ? `${subject}\n` : raw;
  }

  if (!body) return raw;
  const bodyLines = body.split("\n").length;
  const hasTrailer = BAD_TRAILERS.some((m) => body.toLowerCase().includes(m));
  if (bodyLines <= KEEP_AS_IS_LINES && !hasTrailer) return raw;
  if (bodyLines > KEEP_AS_IS_LINES) {
    const summary = summariseBody(stripTrailers(body));
    return summary ? `${subject}\n\n${summary}\n` : `${subject}\n`;
  }
  const cleaned = stripTrailers(body);
  return cleaned ? `${subject}\n\n${cleaned}\n` : `${subject}\n`;
}

const hashes = execSync('git log --format=%H', { encoding: "utf8" })
  .trim()
  .split("\n");

let changed = 0;
let total = 0;
for (let i = 0; i < hashes.length && total < limit; i++) {
  const hash = hashes[i];
  const raw = execSync(`git log -1 --format=%B ${hash}`, { encoding: "utf8" });
  const rewritten = rewriteMessage(raw, hash.slice(0, 7));
  if (rewritten === raw) {
    if (!changedOnly) {
      total++;
      console.log(`\x1b[2m[${hash.slice(0, 7)}]\x1b[0m \x1b[32mUNCHANGED\x1b[0m`);
      console.log(`  ${raw.split("\n")[0]}`);
    }
    continue;
  }
  changed++;
  total++;
  console.log(`\n\x1b[1m[${hash.slice(0, 7)}]\x1b[0m \x1b[33mWILL CHANGE\x1b[0m`);
  console.log(`\x1b[2m  --- before ---\x1b[0m`);
  for (const ln of raw.trimEnd().split("\n")) {
    console.log(`  ${ln}`);
  }
  console.log(`\x1b[2m  --- after ---\x1b[0m`);
  for (const ln of rewritten.trimEnd().split("\n")) {
    console.log(`  \x1b[36m${ln}\x1b[0m`);
  }
}

console.log(`\n\x1b[1mSummary\x1b[0m: ${changed} commit(s) would be rewritten out of ${total} reviewed (total in branch: ${hashes.length}).`);
