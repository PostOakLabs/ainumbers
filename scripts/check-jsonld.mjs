#!/usr/bin/env node
// scripts/check-jsonld.mjs — JSONLD-1 (GATES-SHIFTLEFT-BUILD-SPEC.md §4).
// Structural validator for every <script type="application/ld+json"> block
// across the estate. Zero-dep, offline (CONTRACT §0.5 / spec §0.6 — no
// network calls to schema.org, no Rich Results API). Checks: well-formed
// JSON, top-level @context + @type present, and required fields for the
// @type values actually in use on this site (surveyed 2026-07-16 across
// tools/guides/chaingraph/root: Organization, SoftwareApplication,
// WebApplication, Offer, WebPage, HowTo, HowToStep, Article, ListItem,
// BreadcrumbList, DataCatalog, CollectionPage, Thing, SearchAction).
// Structural only — does not assert a page HAS a block (no presence gate;
// out of scope per spec §4, which only asks for validation of what exists).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['tools', 'guides', 'chaingraph', 'ledger'];
const SKIP_DIRS = new Set(['.git', 'node_modules', 'worktrees']);

// Required fields per @type actually used on this site. Loose by design —
// this is a structural sanity check, not a full schema.org conformance
// suite (that needs a network-fetched vocabulary, forbidden by §0.6).
const REQUIRED_FIELDS = {
  Organization: ['name'],
  SoftwareApplication: ['name', 'url'],
  WebApplication: ['name', 'url'],
  Offer: ['price', 'priceCurrency'],
  WebPage: ['name'],
  HowTo: ['name', 'step'],
  HowToStep: [], // 'name' or 'text' — checked specially below
  Article: [], // 'headline' or 'name' — checked specially below
  ListItem: ['position'],
  BreadcrumbList: ['itemListElement'],
  DataCatalog: ['name'],
  CollectionPage: ['name'],
  SearchAction: ['target'],
  // Thing is schema.org's root type, used generically here (e.g. as a
  // diagnostic subject) — only require @type, not a fixed field set.
  Thing: [],
};

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), out); }
    else if (e.isFile() && e.name.endsWith('.html')) out.push(join(dir, e.name));
  }
  return out;
}

function rootHtmlFiles() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.html'))
    .map(e => join(ROOT, e.name));
}

function extractBlocks(html) {
  const blocks = [];
  const re = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1].trim());
  return blocks;
}

// Recursively walk a parsed JSON-LD value; yield every object carrying an
// @type so nested types (author, offers, step, etc.) get checked too.
function* typedNodes(value) {
  if (Array.isArray(value)) {
    for (const v of value) yield* typedNodes(v);
  } else if (value && typeof value === 'object') {
    if (value['@type']) yield value;
    for (const k of Object.keys(value)) {
      if (k === '@type' || k === '@context') continue;
      yield* typedNodes(value[k]);
    }
  }
}

function validateBlock(json) {
  const errors = [];
  const roots = Array.isArray(json) ? json : [json];
  for (const root of roots) {
    if (!root || typeof root !== 'object') { errors.push('top-level value is not an object'); continue; }
    const ctx = root['@context'];
    if (!ctx || (typeof ctx === 'string' && !/^https?:\/\/schema\.org\/?$/.test(ctx))) {
      errors.push(`missing/unexpected @context: ${JSON.stringify(ctx)}`);
    }
    // A named-graph root (`@graph: [...]`) legitimately has no @type of its
    // own — the graph's member nodes carry @type and are checked below via
    // typedNodes(). Only a non-@graph root is required to self-declare a type.
    if (!root['@type'] && !root['@graph']) errors.push('top-level node missing @type');
  }
  for (const node of typedNodes(json)) {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    for (const t of types) {
      if (t === 'HowToStep') {
        if (!node.name && !node.text) errors.push('HowToStep missing both "name" and "text"');
        continue;
      }
      if (t === 'Article') {
        if (!node.headline && !node.name) errors.push('Article missing both "headline" and "name"');
        continue;
      }
      const req = REQUIRED_FIELDS[t];
      if (!req) continue; // unknown/unsurveyed type — not this gate's job to invent a schema
      for (const field of req) {
        if (node[field] === undefined || node[field] === null || node[field] === '') {
          errors.push(`${t} missing required field "${field}"`);
        }
      }
    }
  }
  return errors;
}

const files = [...SCAN_DIRS.flatMap(d => walk(join(ROOT, d))), ...rootHtmlFiles()];
let blockCount = 0;
const failures = []; // [file, error]

for (const file of files) {
  const html = readFileSync(file, 'utf-8');
  const blocks = extractBlocks(html);
  for (const raw of blocks) {
    blockCount++;
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      failures.push([rel, `malformed JSON: ${e.message}`]);
      continue;
    }
    for (const err of validateBlock(json)) failures.push([rel, err]);
  }
}

if (failures.length) {
  console.log(`✗ check-jsonld: ${failures.length} issue(s) across ${blockCount} JSON-LD block(s) in ${files.length} files\n`);
  for (const [file, err] of failures) console.log(`  ${file}: ${err}`);
  process.exit(1);
}

console.log(`✓ check-jsonld: ${blockCount} JSON-LD block(s) across ${files.length} files, all well-formed and structurally valid`);
