#!/usr/bin/env node
/**
 * scripts/verify-proposals.mjs — AGENTPR-1 CI gate for proposals/*.json.
 *
 * A PR under the AGENTPR-1 route (see proposals/SCHEMA.md, CONTRIBUTING.md,
 * AGENTS.md) adds exactly one `proposals/<slug>.json` file and touches
 * nothing else. This script does the mechanical validation:
 *
 *   1. schema-validate      — required fields present, right shape, slug
 *                              matches filename.
 *   2. slug-collision       — proposed slug not already a live tool_id /
 *                              mcp_name (chaingraph.json) or tools/*.html
 *                              filename.
 *   3. copy-gates           — prose fields (name/what_it_computes/
 *                              why_it_belongs) pass the same em-dash /
 *                              anti-AI-tell checks as check-copy-hallmarks.mjs
 *                              (patterns duplicated narrowly here, not
 *                              imported — that script executes a whole-repo
 *                              HTML sweep at import time).
 *   4. out-of-dir           — (CI only, via --changed-files) rejects a PR
 *                              that touches any path outside proposals/.
 *   5. receipt fast-track   — if `sample_artifact` is present, recompute
 *                              execution_hash via the CANONICAL lineage
 *                              (chaingraph/kernels/_hash.mjs — single-lineage
 *                              rule, no new verifier) and report match/mismatch
 *                              so CI can apply the `receipt-verified` label.
 *
 * Usage:
 *   node scripts/verify-proposals.mjs                       # validate every proposals/*.json
 *   node scripts/verify-proposals.mjs proposals/foo.json     # validate one file
 *   node scripts/verify-proposals.mjs --changed-files a.json,b.txt   # also gate #4
 *
 * Exit 0 = all checks pass. Exit 1 = at least one failure, printed.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROPOSALS_DIR = resolve(REPO, 'proposals');

const args = process.argv.slice(2);
const changedFilesArg = args.find((a) => a.startsWith('--changed-files='));
const changedFiles = changedFilesArg
  ? changedFilesArg.slice('--changed-files='.length).split(',').filter(Boolean)
  : null;
const explicitFiles = args.filter((a) => !a.startsWith('--changed-files='));

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const REQUIRED_STRING_FIELDS = ['slug', 'name', 'category', 'what_it_computes', 'why_it_belongs'];
const REQUIRED_ARRAY_FIELDS = ['inputs', 'outputs'];
const VALID_CATEGORIES = new Set(['tool', 'node', 'chain', 'guide', 'dataset', 'other']);

// --- copy gates: narrow duplicate of check-copy-hallmarks.mjs's zero-tolerance
// ANTI-AI-TELL patterns, scoped to short prose fields (not whole-page HTML). ---
const EMDASH = /—/g;
const NOTJUSTBUT = [
  [/\bnot\s+just\b(?:(?!\bbut\b)[^.?!]){0,80}\bbut\b/gi, '"not just X but" construction'],
  [/\bisn['’]?t\s+just\b/gi, '"isn\'t just"'],
  [/\bmore\s+than\s+just\b/gi, '"more than just"'],
];
const DRAMATIC_FRAGMENT = /\bThe (?:result|catch|takeaway|verdict|kicker|bottom line)\?/gi;
const FILLER_VOCAB = [
  [/\bdelv(?:e|es|ed|ing)\b/gi, 'delve'],
  [/\btapestr(?:y|ies)\b/gi, 'tapestry'],
  [/\btestament\s+to\b/gi, 'testament to'],
  [/\bseamless(?:ly)?\b/gi, 'seamless'],
  [/\bgame[\s-]?chang(?:er|ing)\b/gi, 'game-changer'],
  [/\bit['’]?s\s+worth\s+noting\b/gi, "it's worth noting"],
  [/\bin\s+today['’]?s\s+fast-paced\b/gi, "in today's fast-paced"],
];

function copyGateFindings(field, text) {
  const hits = [];
  const emdash = (text.match(EMDASH) || []).length;
  if (emdash) hits.push(`em-dash x${emdash}`);
  for (const [re, label] of NOTJUSTBUT) if (re.test(text)) hits.push(label);
  if (DRAMATIC_FRAGMENT.test(text)) hits.push('dramatic-fragment opener');
  for (const [re, label] of FILLER_VOCAB) if (re.test(text)) hits.push(`filler-vocab "${label}"`);
  return hits.map((h) => `${field}: ${h}`);
}

function loadLiveRegistry() {
  const slugs = new Set();
  const cgPath = resolve(REPO, 'chaingraph', 'chaingraph.json');
  if (existsSync(cgPath)) {
    const cg = JSON.parse(readFileSync(cgPath, 'utf8'));
    for (const n of cg.nodes || []) {
      if (n.tool_id) slugs.add(n.tool_id);
      if (n.mcp_name) slugs.add(n.mcp_name);
    }
  }
  for (const dir of ['tools', 'guides']) {
    const p = resolve(REPO, dir);
    if (!existsSync(p)) continue;
    for (const f of readdirSync(p)) {
      if (f.endsWith('.html')) slugs.add(f.replace(/\.html$/, ''));
    }
  }
  return slugs;
}

function validateProposal(path) {
  const errors = [];
  const rel = path.replace(REPO + '\\', '').replace(REPO + '/', '').replace(/\\/g, '/');
  const filenameSlug = path.split(/[\\/]/).pop().replace(/\.json$/, '');

  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    return [`${rel}: cannot read file (${e.message})`];
  }
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    return [`${rel}: invalid JSON (${e.message})`];
  }

  if (!SLUG_RE.test(filenameSlug)) {
    errors.push(`${rel}: filename must be kebab-case (matched against ${SLUG_RE})`);
  }
  for (const f of REQUIRED_STRING_FIELDS) {
    if (typeof obj[f] !== 'string' || !obj[f].trim()) errors.push(`${rel}: missing/empty required string field "${f}"`);
  }
  for (const f of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(obj[f]) || obj[f].length === 0) errors.push(`${rel}: missing/empty required array field "${f}"`);
  }
  if (typeof obj.slug === 'string' && obj.slug !== filenameSlug) {
    errors.push(`${rel}: "slug" field ("${obj.slug}") must match the filename ("${filenameSlug}")`);
  }
  if (typeof obj.category === 'string' && !VALID_CATEGORIES.has(obj.category)) {
    errors.push(`${rel}: "category" must be one of ${[...VALID_CATEGORIES].join(', ')}, got "${obj.category}"`);
  }

  const registry = loadLiveRegistry();
  if (registry.has(filenameSlug)) {
    errors.push(`${rel}: slug "${filenameSlug}" collides with a live tool_id/mcp_name/page — rename the proposal`);
  }

  for (const f of ['name', 'what_it_computes', 'why_it_belongs']) {
    if (typeof obj[f] === 'string') errors.push(...copyGateFindings(f, obj[f]).map((m) => `${rel}: ${m}`));
  }

  const allowedTop = new Set([...REQUIRED_STRING_FIELDS, ...REQUIRED_ARRAY_FIELDS, 'links', 'sample_artifact']);
  for (const k of Object.keys(obj)) {
    if (!allowedTop.has(k)) errors.push(`${rel}: unrecognized top-level field "${k}" (see proposals/SCHEMA.md)`);
  }

  return errors;
}

async function receiptFastTrack(path, obj) {
  if (!obj || typeof obj !== 'object' || !obj.sample_artifact) return null;
  const sa = obj.sample_artifact;
  if (!sa || typeof sa !== 'object' || !('policy_parameters' in sa) || !('output_payload' in sa) || !sa.execution_hash) {
    return { path, verified: false, reason: 'sample_artifact present but missing policy_parameters/output_payload/execution_hash' };
  }
  const { executionHash } = await import(pathToFileURL(resolve(REPO, 'chaingraph', 'kernels', '_hash.mjs')).href);
  try {
    const recomputed = await executionHash(sa.policy_parameters, sa.output_payload);
    const verified = recomputed === sa.execution_hash;
    return { path, verified, recomputed, claimed: sa.execution_hash };
  } catch (e) {
    return { path, verified: false, reason: `hash recompute threw: ${e.message}` };
  }
}

function outOfDirFindings(files) {
  if (!files) return [];
  return files.filter((f) => !f.startsWith('proposals/') || !f.endsWith('.json'))
    .map((f) => `out-of-dir: PR touches "${f}" — a proposals PR may add ONLY proposals/<slug>.json`);
}

async function main() {
  const targets = explicitFiles.length
    ? explicitFiles.map((f) => resolve(REPO, f))
    : (existsSync(PROPOSALS_DIR)
        ? readdirSync(PROPOSALS_DIR).filter((f) => f.endsWith('.json')).map((f) => join(PROPOSALS_DIR, f))
        : []);

  let allErrors = [...outOfDirFindings(changedFiles)];
  const receipts = [];

  for (const path of targets) {
    allErrors.push(...validateProposal(path));
    try {
      const obj = JSON.parse(readFileSync(path, 'utf8'));
      const r = await receiptFastTrack(path, obj);
      if (r) receipts.push(r);
    } catch (e) {
      if (e instanceof SyntaxError) { /* invalid JSON already reported by validateProposal above */ }
      else throw e;
    }
  }

  for (const r of receipts) {
    if (r.verified) {
      console.log(`verify-proposals: receipt-verified — ${r.path} (execution_hash recomputes: ${r.recomputed})`);
    } else {
      console.log(`verify-proposals: sample_artifact NOT receipt-verified — ${r.path} (${r.reason || `recomputed ${r.recomputed} != claimed ${r.claimed}`})`);
    }
  }

  if (allErrors.length) {
    console.error(`verify-proposals: FAILED — ${allErrors.length} issue(s):`);
    for (const e of allErrors) console.error(`  ${e}`);
    process.exit(1);
  }

  console.log(`verify-proposals: OK — ${targets.length} proposal(s) validated${changedFiles ? ', out-of-dir check passed' : ''}.`);
  // Machine-readable line for CI to grep when deciding whether to apply receipt-verified.
  if (receipts.some((r) => r.verified)) console.log('RECEIPT_VERIFIED=true');
}

main();
