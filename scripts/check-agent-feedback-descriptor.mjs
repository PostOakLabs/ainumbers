#!/usr/bin/env node
/**
 * scripts/check-agent-feedback-descriptor.mjs — WEBMCP-FEEDBACK-SCHEMA-1 (2026-09-24)
 *
 * Gate for the agent-feedback v0 surface (WEBMCP-FEEDBACK-LOOP-BUILD-SPEC
 * §S row C₁):
 *
 *   1. ALWAYS: structural validation of the normative schema twin
 *      `.well-known/agent-feedback.schema.json` (`schema_version:
 *      ain-agent-feedback-v0`): the v0 field set is EXACTLY as specced
 *      (schema_version + report{tool_name, doorway, failure_class, required;
 *      expected_hash, observed_hash, agent_label, occurred_at, optional}),
 *      every enum value carries a description plus one canonical example
 *      (the twin is the definitions surface agents can read, BF-4), and the
 *      pre-stability statement is present (R3: v0 is pre-stable, fields may
 *      be added or removed before v1.0, consumers MUST ignore unknown
 *      members — so additionalProperties stays true and is asserted true).
 *   2. WHEN PRESENT: validation of the descriptor
 *      `.well-known/agent-feedback.json` against the twin. The descriptor is
 *      row C₂'s (WEBMCP-FEEDBACK-DESCRIPTOR-1) and lands only after the
 *      worker route (row B) is live; until then the gate prints a named
 *      skip line, never silence (SO #34c: a skipped case must not look like
 *      a clean one). Once C₂ lands, this same gate is its drift guard.
 *   3. ALWAYS (AF-8): copy-hallmark enforcement for the JSON prose, folded
 *      INTO this gate because check-copy-hallmarks.mjs scans HTML +
 *      chaingraph.json only and cannot see `.well-known` JSON. Both the
 *      twin and (when present) the descriptor are public agent-facing
 *      prose, so their string values are scanned for the zero-tolerance
 *      AI-tell families: em-dashes (entity-encoded included), filler vocab,
 *      AI vocabulary, pivot/twotone constructions, dramatic-fragment and
 *      validation phrasings, and internal build jargon. Rules mirror
 *      scripts/check-copy-hallmarks.mjs (CONTRACT §1.4 + memory
 *      feedback-anti-ai-tell-copy-ban); they are re-declared here, not
 *      imported, because that gate executes its site-wide scan at module top
 *      level and has no import guard. No baseline: this surface is new, so
 *      there is no legacy debt to shield and the counts start at zero.
 *
 * The instance validator implements exactly the keywords the twin uses:
 * type / required / const / pattern / maxLength / oneOf(of const) with
 * additionalProperties always true (pre-stable MUST-ignore posture). Zero
 * dependencies (SO #10 no-npm).
 *
 * Modes:
 *   node scripts/check-agent-feedback-descriptor.mjs             (gate)
 *   node scripts/check-agent-feedback-descriptor.mjs --self-test
 *       (GATE-SELFTEST-META-1 mutation control, AF-12: proves the checker
 *       goes RED on each tamper class against temp-dir copies of the real
 *       twin plus synthetic descriptors — never writes repo files. Requires
 *       a pristine-green tree as its GREEN control, then mutates, then
 *       re-verifies the untouched tree, ask-agent-block precedent.)
 *
 * Exit: 0 clean; 1 on any finding (or any failed self-test control).
 */

import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TWIN_REL = '.well-known/agent-feedback.schema.json';
const DESCRIPTOR_REL = '.well-known/agent-feedback.json';
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const SCHEMA_ID = 'https://ainumbers.co/.well-known/agent-feedback.schema.json';
const VERSION_CONST = 'ain-agent-feedback-v0';

const REPORT_FIELDS = [
  'tool_name', 'doorway', 'failure_class',
  'expected_hash', 'observed_hash', 'agent_label', 'occurred_at',
];
const REPORT_REQUIRED = ['tool_name', 'doorway', 'failure_class'];
const DOORWAY_VALUES = ['page_execute', 'deep_link', 'worker', 'unknown'];
const FAILURE_CLASS_VALUES = [
  'invalid_args', 'tool_missing', 'execution_failed',
  'hash_mismatch', 'schema_unclear', 'other',
];

// ── folded copy-hallmark families (AF-8; rules mirror check-copy-hallmarks) ──
const HALLMARK_RULES = [
  [/\u2014/g, 'em-dash'], [/&#8212;|&#x2014;|&mdash;/gi, 'entity-encoded em-dash'],
  // filler vocab (check-copy-hallmarks FILLER_VOCAB, same collocation narrowings)
  [/\bdelv(?:e|es|ed|ing)\b/gi, 'filler-vocab "delve"'],
  [/\btapestr(?:y|ies)\b/gi, 'filler-vocab "tapestry"'],
  [/\btestament\s+to\b/gi, 'filler-vocab "testament to"'],
  [/\bquiet(?:ly)?\s+(?:revolution|shift|force|power|evolution)\b/gi, 'filler-vocab "quiet(ly) X"'],
  [/\bseamless(?:ly)?\b/gi, 'filler-vocab "seamless"'],
  [/\bgame[\s-]?chang(?:er|ing)\b/gi, 'filler-vocab "game-changer"'],
  [/\belevat(?:e|es|ed|ing)\s+(?:your|our|its|their)\s+\w+/gi, 'filler-vocab "elevate your/our/its X"'],
  [/\bunlock(?:s|ed|ing)?\s+(?:your\s+|the\s+full\s+|new\s+|greater\s+)?(?:potential|value|growth|opportunit(?:y|ies)|insight(?:s)?|power|possibilit(?:y|ies))\b/gi, 'filler-vocab "unlock potential/value (marketing sense)"'],
  [/\bit['’]?s\s+worth\s+noting\b/gi, 'filler-vocab "it\'s worth noting"'],
  [/\bin\s+today['’]?s\s+fast-paced\b/gi, 'filler-vocab "in today\'s fast-paced"'],
  // AI vocabulary (Wikipedia signs-of-AI-writing family, narrowed as upstream)
  [/\bcrucial(?:ly)?\b/gi, 'AI-vocab "crucial"'],
  [/\bpivotal\b/gi, 'AI-vocab "pivotal"'],
  [/\bunderscor(?:e|es|ed|ing)\b/gi, 'AI-vocab "underscore (verb)"'],
  [/\bfoster(?:s|ed|ing)?\b/gi, 'AI-vocab "foster"'],
  [/\bboast(?:s|ed|ing)?\b/gi, 'AI-vocab "boast"'],
  [/\bdive\s+into\b/gi, 'AI-vocab "dive into"'],
  [/\bin\s+the\s+realm\s+of\b/gi, 'AI-vocab "in the realm of"'],
  [/\bindelible\s+mark\b/gi, 'AI-vocab "indelible mark"'],
  [/\bspearhead(?:s|ed|ing)?\b/gi, 'AI-vocab "spearhead"'],
  [/\bmyriad\b/gi, 'AI-vocab "myriad"'],
  [/\bplethora\b/gi, 'AI-vocab "plethora"'],
  // pivots, dramatic fragments, validation phrasing (zero-tolerance upstream)
  [/\bnot\s+just\s+\w+.*\bbut\b/gi, 'pivot "not just X but"'],
  [/\bisn['’]?t\s+just\b/gi, 'pivot "isn\'t just"'],
  [/\bmore\s+than\s+just\b/gi, 'pivot "more than just"'],
  [/\bThe\s+result\s*\?/g, 'dramatic-fragment opener "The result?"'],
  [/\byou['’]?re\s+not\s+(?:alone|imagining)\b/gi, 'validation-phrasing'],
  // twotone high-precision ("It is not X. It is Y.", TWOTONE_HIGHPRECISION upstream)
  [/\b(?:is|are|was|were) not (?:a|an|the )?[\w-]+\.\s+(?:It|They|This|That) (?:is|are)\b/g, 'twotone pivot'],
  // internal build jargon in public prose (check-copy-hallmarks category 2)
  [/\bWave\s+\d+/g, 'build jargon "Wave N"'],
  [/\bW-[A-F]\b/g, 'build jargon badge code'],
  [/\bD0\b/g, 'build jargon "D0"'],
];

/** Scan every string value of `doc` (values under excluded keys are skipped:
 *  metaschema URLs, regex patterns, JSON type names and consts are not prose).
 *  Returns [{ path, rule }] for every hallmark hit. */
export function proseFindings(doc, label) {
  const hits = [];
  const EXCLUDED_KEYS = new Set(['$schema', '$id', 'pattern', 'const', 'format', 'type']);
  (function walk(node, at) {
    if (typeof node === 'string') {
      for (const [re, rule] of HALLMARK_RULES) {
        const m = node.match(re);
        if (m) hits.push({ path: at, rule, sample: m[0] });
      }
      return;
    }
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${at}[${i}]`)); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (!EXCLUDED_KEYS.has(k)) walk(v, at ? `${at}.${k}` : k);
      }
    }
  })(doc, label);
  return hits;
}

// ── zero-dependency instance validator (the keywords the twin actually uses) ──

/** Validate instance `inst` against a (subset) schema node; returns findings. */
export function validateInstance(inst, schema, at) {
  const f = [];
  if (schema === true || schema == null) return f;
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((sub) => validateInstance(inst, sub, at).length === 0);
    if (matches.length !== 1) {
      f.push(`${at}: expected exactly one oneOf match, got ${matches.length}` +
        ` (allowed: ${schema.oneOf.map((s) => JSON.stringify(s.const)).join(', ')})`);
    }
    return f;
  }
  if (schema.const !== undefined && inst !== schema.const) {
    f.push(`${at}: const violation — expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(inst)}`);
    return f;
  }
  if (schema.type === 'object') {
    if (typeof inst !== 'object' || inst === null || Array.isArray(inst)) {
      f.push(`${at}: expected object, got ${inst === null ? 'null' : typeof inst}`);
      return f;
    }
    for (const key of schema.required || []) {
      if (!(key in inst)) f.push(`${at}: required member missing: ${key}`);
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in inst) f.push(...validateInstance(inst[key], sub, at ? `${at}.${key}` : key));
    }
    return f;
  }
  if (schema.type === 'string') {
    if (typeof inst !== 'string') { f.push(`${at}: expected string, got ${typeof inst}`); return f; }
    if (schema.pattern && !new RegExp(schema.pattern).test(inst)) {
      f.push(`${at}: ${JSON.stringify(inst.length > 80 ? inst.slice(0, 77) + '...' : inst)} fails pattern ${schema.pattern}`);
    }
    if (schema.maxLength !== undefined && inst.length > schema.maxLength) {
      f.push(`${at}: length ${inst.length} exceeds maxLength ${schema.maxLength}`);
    }
  }
  return f;
}

// ── structural validation of the twin itself (always on) ─────────────────────

function isNonEmptyString(v) { return typeof v === 'string' && v.length > 0; }

/** Canonical example sanity: each examples[i] of a member carrying a pattern
 *  must itself satisfy that pattern (the twin is the definitions surface —
 *  a non-conforming canonical example would teach agents a invalid value). */
function exampleFindings(prop, at) {
  const f = [];
  const ex = prop.examples;
  if (!Array.isArray(ex) || ex.length < 1 || !ex.every((e) => typeof e === 'string' && e.length > 0)) {
    f.push(`${at}: examples must be a non-empty array of non-empty strings (one canonical example)`);
    return f;
  }
  if (prop.pattern) {
    for (const e of ex) {
      if (!new RegExp(prop.pattern).test(e)) f.push(`${at}: canonical example ${JSON.stringify(e)} does not satisfy its own pattern ${prop.pattern}`);
    }
  }
  if (prop.maxLength !== undefined) {
    for (const e of ex) {
      if (e.length > prop.maxLength) f.push(`${at}: canonical example exceeds maxLength ${prop.maxLength}`);
    }
  }
  return f;
}

/** oneOf-of-const enum member: every value carries a description + exactly one
 *  canonical example equal to the const (BF-4: the twin is the definitions
 *  surface; BF-1-style digests and row B's collector read this shape). */
function enumFindings(prop, allowed, at) {
  const f = [];
  if (!isNonEmptyString(prop.description)) f.push(`${at}: missing non-empty description`);
  if (!Array.isArray(prop.oneOf)) { f.push(`${at}: expected a oneOf enumeration`); return f; }
  const consts = prop.oneOf.map((s) => s && s.const);
  if (JSON.stringify(consts) !== JSON.stringify(allowed)) {
    f.push(`${at}: enum values must be exactly [${allowed.join(', ')}], got [${consts.join(', ')}]`);
  }
  prop.oneOf.forEach((sub, i) => {
    const hat = `${at}.oneOf[${i}]`;
    if (!sub || typeof sub !== 'object') { f.push(`${hat}: not an object`); return; }
    if (sub.type !== undefined || sub.pattern !== undefined || sub.maxLength !== undefined || sub.oneOf !== undefined) {
      f.push(`${hat}: const-carrying enum entries must constrain ONLY via const (found extra keyword)`);
    }
    if (!isNonEmptyString(sub.description)) f.push(`${hat}: enum value ${JSON.stringify(sub.const)} is missing its description (BF-4: definitions surface)`);
    if (!Array.isArray(sub.examples) || sub.examples.length !== 1 || sub.examples[0] !== sub.const) {
      f.push(`${hat}: enum value ${JSON.stringify(sub.const)} must carry exactly one canonical example equal to the value`);
    }
  });
  return f;
}

/** Structural findings for the twin document (pure function of parsed JSON). */
export function twinStructureFindings(twin) {
  const f = [];
  if (!twin || typeof twin !== 'object' || Array.isArray(twin)) return ['twin: not a JSON object'];
  if (twin.$schema !== DRAFT) f.push(`$schema: expected ${DRAFT}, got ${JSON.stringify(twin.$schema)}`);
  if (twin.$id !== SCHEMA_ID) f.push(`$id: expected ${SCHEMA_ID}, got ${JSON.stringify(twin.$id)}`);
  if (!isNonEmptyString(twin.title)) f.push('title: missing');
  if (!isNonEmptyString(twin.description)) f.push('description: missing');
  if (twin.type !== 'object') f.push('type: root must be "object"');
  if (JSON.stringify(twin.required) !== JSON.stringify(['schema_version', 'report'])) {
    f.push('required: root must require exactly ["schema_version", "report"]');
  }
  if (twin.additionalProperties !== true) {
    f.push('additionalProperties: root must be true (pre-stable v0: consumers MUST ignore unknown members)');
  }
  if (!twin.description || !twin.description.includes('PRE-STABLE') || !twin.description.includes('MUST ignore unknown members')) {
    f.push('description: pre-stability statement missing (must state PRE-STABLE and that consumers MUST ignore unknown members) [R3]');
  }

  const props = twin.properties || {};
  const sv = props.schema_version;
  if (!sv || sv.const !== VERSION_CONST) {
    f.push(`properties.schema_version: must be a const ${JSON.stringify(VERSION_CONST)}`);
  } else {
    if (!isNonEmptyString(sv.description)) f.push('properties.schema_version: missing non-empty description');
    if (!Array.isArray(sv.examples) || sv.examples[0] !== VERSION_CONST) f.push('properties.schema_version: must carry its canonical example');
  }

  const rep = props.report;
  if (!rep || rep.type !== 'object') {
    f.push('properties.report: missing object schema');
    return f;
  }
  if (!isNonEmptyString(rep.description)) f.push('properties.report: missing non-empty description');
  else if (!rep.description.includes('MUST ignore unknown members')) {
    f.push('properties.report: description must restate the pre-stable MUST-ignore-unknown-members rule [R3]');
  }
  if (rep.additionalProperties !== true) {
    f.push('properties.report: additionalProperties must be true (pre-stable v0: unknown members are ignored, never rejected)');
  }
  if (JSON.stringify(rep.required) !== JSON.stringify(REPORT_REQUIRED)) {
    f.push(`properties.report: required must be exactly [${REPORT_REQUIRED.join(', ')}]`);
  }
  const rp = rep.properties || {};
  for (const field of REPORT_FIELDS) {
    if (!rp[field]) f.push(`properties.report.properties: missing field "${field}"`);
  }
  for (const field of Object.keys(rp)) {
    if (!REPORT_FIELDS.includes(field)) f.push(`properties.report.properties: unexpected field "${field}" (v0 field set is exactly as specced)`);
  }
  if (!rp.tool_name) return f;

  // tool_name — ≤128, ^[a-z][a-z0-9_]{0,127}$
  const tn = rp.tool_name;
  if (tn.type !== 'string') f.push('report.tool_name: type must be "string"');
  if (tn.pattern !== '^[a-z][a-z0-9_]{0,127}$') f.push(`report.tool_name: pattern must be "^[a-z][a-z0-9_]{0,127}$", got ${JSON.stringify(tn.pattern)}`);
  if (tn.maxLength !== 128) f.push('report.tool_name: maxLength must be 128');
  if (!isNonEmptyString(tn.description)) f.push('report.tool_name: missing non-empty description');
  f.push(...exampleFindings(tn, 'report.tool_name'));

  // doorway — enum, oneOf-of-const with per-value description + example
  f.push(...enumFindings(rp.doorway || {}, DOORWAY_VALUES, 'report.doorway'));

  // failure_class — enum, oneOf-of-const with per-value description + example
  f.push(...enumFindings(rp.failure_class || {}, FAILURE_CLASS_VALUES, 'report.failure_class'));

  // expected_hash / observed_hash — ≤64 hex, OPTIONAL
  for (const field of ['expected_hash', 'observed_hash']) {
    const p = rp[field];
    if (!p) continue;
    if (REPORT_REQUIRED.includes(field)) f.push(`report.${field}: must remain OPTIONAL`);
    if (p.type !== 'string') f.push(`report.${field}: type must be "string"`);
    if (p.pattern !== '^[0-9a-f]{1,64}$') f.push(`report.${field}: pattern must be "^[0-9a-f]{1,64}$", got ${JSON.stringify(p.pattern)}`);
    if (!isNonEmptyString(p.description)) f.push(`report.${field}: missing non-empty description`);
    f.push(...exampleFindings(p, `report.${field}`));
  }

  // agent_label — ≤64 printable-ASCII, OPTIONAL
  const al = rp.agent_label;
  if (al) {
    if (al.type !== 'string') f.push('report.agent_label: type must be "string"');
    if (al.pattern !== '^[\\x20-\\x7E]{0,64}$') f.push(`report.agent_label: pattern must be "^[\\\\x20-\\\\x7E]{0,64}$" (printable ASCII), got ${JSON.stringify(al.pattern)}`);
    if (al.maxLength !== 64) f.push('report.agent_label: maxLength must be 64');
    if (!isNonEmptyString(al.description)) f.push('report.agent_label: missing non-empty description');
    f.push(...exampleFindings(al, 'report.agent_label'));
  }

  // occurred_at — ISO-8601/RFC 3339 date-time, OPTIONAL
  const oa = rp.occurred_at;
  if (oa) {
    if (oa.type !== 'string') f.push('report.occurred_at: type must be "string"');
    if (oa.pattern !== '^\\d{4}-\\d{2}-\\d{2}[Tt]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:[Zz]|[+-]\\d{2}:\\d{2})$') {
      f.push('report.occurred_at: pattern must be the RFC 3339 date-time shape, got ' + JSON.stringify(oa.pattern));
    }
    if (!isNonEmptyString(oa.description)) f.push('report.occurred_at: missing non-empty description');
    f.push(...exampleFindings(oa, 'report.occurred_at'));
  }
  return f;
}

// ── the gate ──────────────────────────────────────────────────────────────────

/** Full gate over one twin path + optional descriptor path (injectable for
 *  the self-test's temp-dir mutations). Returns { findings, descriptorPresent }. */
export function runGate({ twinPath, descriptorPath, descriptorExpected = false }) {
  const findings = [];
  let twin;
  try { twin = JSON.parse(readFileSync(twinPath, 'utf8')); }
  catch (e) { return { findings: [`twin (${twinPath}) does not parse as JSON: ${e.message}`], descriptorPresent: false }; }
  findings.push(...twinStructureFindings(twin).map((m) => `${TWIN_REL}: ${m}`));
  findings.push(...proseFindings(twin, TWIN_REL).map((h) => `${h.path}: copy hallmark ${h.rule} (${JSON.stringify(h.sample)})`));

  let descriptorPresent = false;
  if (existsSync(descriptorPath)) {
    descriptorPresent = true;
    let desc;
    try { desc = JSON.parse(readFileSync(descriptorPath, 'utf8')); }
    catch (e) { findings.push(`${DESCRIPTOR_REL}: does not parse as JSON: ${e.message}`); return { findings, descriptorPresent }; }
    // Descriptor must itself be a JSON object document before validation.
    if (!desc || typeof desc !== 'object' || Array.isArray(desc)) {
      findings.push(`${DESCRIPTOR_REL}: not a JSON object`);
      return { findings, descriptorPresent };
    }
    // Drift-guard leg: the descriptor validates against the twin (the twin's
    // root requires schema_version + report; the descriptor IS such a doc).
    findings.push(...validateInstance(desc, twin, DESCRIPTOR_REL));
    // AF-8 leg: descriptor prose is public agent-facing copy.
    findings.push(...proseFindings(desc, DESCRIPTOR_REL).map((h) => `${h.path}: copy hallmark ${h.rule} (${JSON.stringify(h.sample)})`));
  } else if (descriptorExpected) {
    findings.push(`${DESCRIPTOR_REL}: expected present but missing`);
  }
  return { findings, descriptorPresent };
}

function printAndExit(findings, descriptorPresent) {
  if (findings.length) {
    console.error(`✗ agent-feedback descriptor/twin gate FAILED (${findings.length}):`);
    findings.forEach((m) => console.error('    ' + m));
    process.exit(1);
  }
  if (descriptorPresent) {
    console.log(`✓ agent-feedback twin + descriptor clean — twin conforms to the specced v0 field set, descriptor validates against the twin, prose carries zero copy hallmarks.`);
  } else {
    console.log(`✓ agent-feedback twin clean — v0 field set, per-enum-value descriptions + canonical examples and the pre-stability statement all present; descriptor not present (named skip, not silence: ${DESCRIPTOR_REL} is row WEBMCP-FEEDBACK-DESCRIPTOR-1's, lands after the worker route).`);
  }
}

// ── self-test (GATE-SELFTEST-META-1 mutation control, AF-12) ──────────────────

function assert(cond, what) {
  if (!cond) throw new Error('self-test assertion failed: ' + what);
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

async function selfTest() {
  const tmp = mkdtempSync(join(tmpdir(), 'agent-feedback-selftest-'));
  const twinReal = join(ROOT, TWIN_REL);
  const descReal = join(ROOT, DESCRIPTOR_REL);
  const twinTmp = join(tmp, 'agent-feedback.schema.json');
  const descTmp = join(tmp, 'agent-feedback.json');
  const cases = [];
  let reds = 0;
  try {
    // GREEN control: the pristine twin is clean, and its structure findings
    // on a temp copy are empty (ask-agent-block RED/GREEN discipline).
    const pristine = runGate({ twinPath: twinReal, descriptorPath: descTmp });
    assert(pristine.findings.length === 0, 'pristine tree must be green before the mutation proof (run the main gate first): ' + pristine.findings.join(' | '));
    const real = JSON.parse(readFileSync(twinReal, 'utf8'));

    // T* — twin tamper classes, each must red the structural check.
    const tampers = [
      ['T1 schema_version const', (t) => { t.properties.schema_version.const = 'ain-agent-feedback-v1'; }, 'schema_version'],
      ['T2 required member dropped', (t) => { t.properties.report.required = ['tool_name', 'doorway']; }, 'required'],
      ['T3 extra report field', (t) => { t.properties.report.properties.note = { type: 'string' }; }, 'unexpected field'],
      ['T4 field removed', (t) => { delete t.properties.report.properties.agent_label; }, 'missing field'],
      ['T5 enum value renamed', (t) => { t.properties.report.properties.doorway.oneOf[1].const = 'deepLink'; }, 'doorway'],
      ['T6 enum description stripped', (t) => { delete t.properties.report.properties.failure_class.oneOf[3].description; }, 'description'],
      ['T7 enum example stripped', (t) => { t.properties.report.properties.doorway.oneOf[0].examples = []; }, 'canonical example'],
      ['T8 pattern loosened', (t) => { t.properties.report.properties.tool_name.pattern = '^[a-z][a-z0-9_]{0,127}'; }, 'pattern'],
      ['T9 additionalProperties false', (t) => { t.properties.report.additionalProperties = false; }, 'additionalProperties'],
      ['T10 pre-stability statement stripped', (t) => { t.description = 'A schema for feedback reports.'; }, 'PRE-STABLE'],
      ['T11 maxLength dropped', (t) => { delete t.properties.report.properties.tool_name.maxLength; }, 'maxLength'],
      ['T12 em-dash smuggled into prose', (t) => { t.properties.report.properties.tool_name.description = 'Tool name — lowercase only.'; }, 'em-dash'],
    ];
    for (const [name, mutate, expect] of tampers) {
      const t = clone(real);
      mutate(t);
      writeFileSync(twinTmp, JSON.stringify(t, null, 2), 'utf8');
      const out = runGate({ twinPath: twinTmp, descriptorPath: descTmp });
      const hit = out.findings.some((m) => m.includes(expect));
      assert(hit, `${name}: mutated twin did NOT red the gate on "${expect}" — the checker is deaf. Findings: ${out.findings.join(' | ') || '(none)'}`);
      reds += 1;
      cases.push(`${name} → RED`);
    }

    // D* — descriptor validation classes against the REAL twin (pure functions).
    const good = {
      schema_version: 'ain-agent-feedback-v0',
      report: { tool_name: 'nav_summary', doorway: 'worker', failure_class: 'execution_failed' },
    };
    assert(validateInstance(good, real, 'd').length === 0, 'D0 valid minimal descriptor must validate GREEN');
    // Pre-stable MUST-ignore posture: unknown members are GREEN by design.
    const withUnknown = clone(good);
    withUnknown.report.totally_unknown_member = { anything: true };
    withUnknown.some_future_field = 7;
    assert(validateInstance(withUnknown, real, 'd').length === 0, 'D9 unknown members MUST be ignored (pre-stable posture) — a rejection here would break R3');
    const descTampers = [
      ['D2 unknown doorway value', { schema_version: 'ain-agent-feedback-v0', report: { tool_name: 'nav_summary', doorway: 'portal', failure_class: 'other' } }, 'oneOf'],
      ['D3 tool_name wrong shape', { schema_version: 'ain-agent-feedback-v0', report: { tool_name: 'Nav-Summary', doorway: 'worker', failure_class: 'other' } }, 'pattern'],
      ['D4 required member missing', { schema_version: 'ain-agent-feedback-v0', report: { doorway: 'worker', failure_class: 'other' } }, 'required member missing'],
      ['D5 wrong schema_version', { schema_version: 'other-v9', report: { tool_name: 'nav_summary', doorway: 'worker', failure_class: 'other' } }, 'const violation'],
      ['D6 65-char hash', { schema_version: 'ain-agent-feedback-v0', report: { tool_name: 'nav_summary', doorway: 'worker', failure_class: 'hash_mismatch', expected_hash: 'a'.repeat(65) } }, 'pattern'],
      ['D7 non-printable agent_label', { schema_version: 'ain-agent-feedback-v0', report: { tool_name: 'nav_summary', doorway: 'worker', failure_class: 'other', agent_label: 'bad\nlabel' } }, 'pattern'],
      ['D8 malformed occurred_at', { schema_version: 'ain-agent-feedback-v0', report: { tool_name: 'nav_summary', doorway: 'worker', failure_class: 'other', occurred_at: 'not-a-time' } }, 'pattern'],
      ['D10 em-dash in descriptor prose', { schema_version: 'ain-agent-feedback-v0', description: 'Report guidance — really.', report: { tool_name: 'nav_summary', doorway: 'worker', failure_class: 'other' } }, 'em-dash'],
      ['D11 AI-vocab in descriptor prose', { schema_version: 'ain-agent-feedback-v0', description: 'This crucial report channel.', report: { tool_name: 'nav_summary', doorway: 'worker', failure_class: 'other' } }, 'crucial'],
    ];
    for (const [name, doc, expect] of descTampers) {
      const out = validateInstance(doc, real, DESCRIPTOR_REL)
        .concat(proseFindings(doc, DESCRIPTOR_REL).map((h) => `${h.path}: ${h.rule}`));
      assert(out.some((m) => m.includes(expect)), `${name}: tampered descriptor did NOT red on "${expect}" — findings: ${out.join(' | ') || '(none)'}`);
      reds += 1;
      cases.push(`${name} → RED`);
    }

    // Restore proof: the untouched real twin is still clean after all mutations.
    const after = runGate({ twinPath: twinReal, descriptorPath: descTmp });
    assert(after.findings.length === 0, 'tree still red after restore: ' + after.findings.join(' | '));
    if (existsSync(descReal)) {
      const live = runGate({ twinPath: twinReal, descriptorPath: descReal });
      assert(live.findings.length === 0, 'live descriptor leg red: ' + live.findings.join(' | '));
    }
    console.log(`RED-GREEN OK: ${reds} mutation class(es) each redded the checker (first: ${cases[0]}); pristine tree green before, untouched tree green after.`);
    console.log('SELF-TEST PASS (twin structure tamper classes, descriptor validation classes, pre-stable unknown-member MUST-ignore positive control, folded prose-hallmark classes).');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ── dispatch ──────────────────────────────────────────────────────────────────

if (process.argv.includes('--self-test')) {
  selfTest().catch((e) => {
    console.error('✗ agent-feedback gate SELF-TEST FAILED: ' + e.message);
    process.exit(1);
  });
} else {
  const out = runGate({ twinPath: join(ROOT, TWIN_REL), descriptorPath: join(ROOT, DESCRIPTOR_REL) });
  printAndExit(out.findings, out.descriptorPresent);
}
