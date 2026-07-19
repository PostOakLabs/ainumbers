#!/usr/bin/env node
/**
 * check-template-integrity.mjs — audit gate for vendored legal templates
 * (chaingraph/templates/<id>/{template.meta.json,body.md,variables.schema.json}).
 *
 * Implements OPEN-TEMPLATE-CATEGORY-BUILD-SPEC.md §7 checks 1-7, modeled on the
 * OpenAgreements audit workflow:
 *   1. License consistency — reference-only ⇒ no body.md; verbatim ⇒ attribution
 *      + source_url recorded.
 *   2. Body provenance — SHA-256(body.md) === template.meta.json body_sha256
 *      (blocks drift of a CC-BY-ND/CC-BY body once vendored).
 *   3. Variable coverage — template.meta.json variables[].token <=> the
 *      variables.schema.json property set, both directions.
 *   4. No smart quotes / no em-dash surfaced to users — ADVISORY only in the
 *      legal body itself (§7.4: templates are exempt if the source text uses
 *      them); this check never fails the gate.
 *   5. Fixtures present + deterministic — samples/sample.vars.json assembles
 *      byte-identically to samples/expected.md.
 *   6. not_legal_advice === true recorded, and (once a node page exists for the
 *      template) the disclosure string is present in that page.
 *   7. Maturity scorecard — alpha|beta|stable per template, written to
 *      data/template-audit.json. Never silently caps a tier — the computed tier
 *      is always surfaced, whatever it is.
 *
 * ⚠ ADVISORY-FIRST (GATE-FREEZE, Tim 2026-07-18): this gate DETECTS and REPORTS
 * every finding below but ALWAYS EXITS 0 while BLOCKING is false. Flip it to a
 * real hard-fail gate at board-clear by changing exactly one line:
 *
 *     const BLOCKING = false;   // <-- flip to `true` at board-clear (TPL-GATE-1)
 *
 * No other code changes needed — findings/failures are already fully computed;
 * only the exit-code decision below is gated on this flag.
 *
 * Usage:
 *   node scripts/check-template-integrity.mjs
 *
 * Test-only override (never used by preflight/CI): set TEMPLATE_ROOT to point
 * the scan at a scratch directory with the same layout, to demonstrate drift
 * detection without touching real vendored bodies.
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES_ROOT = process.env.TEMPLATE_ROOT
  ? resolve(process.env.TEMPLATE_ROOT)
  : resolve(REPO, 'chaingraph', 'templates');
const AUDIT_OUT = resolve(REPO, 'data', 'template-audit.json');

// ── the flip switch (named explicitly per the WU check-off) ────────────────
const BLOCKING = false; // <-- flip to `true` at board-clear (TPL-GATE-1)

const EMDASH = /—/g;
const SMARTQUOTES = /[‘’“”]/g;

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function listTemplateDirs() {
  if (!existsSync(TEMPLATES_ROOT)) return [];
  return readdirSync(TEMPLATES_ROOT).filter((name) => {
    const p = join(TEMPLATES_ROOT, name);
    return statSync(p).isDirectory();
  });
}

/** Find a node page (chaingraph/art-NN-*.html) whose filename references this tool_id's slug. */
function findNodePage(toolId) {
  const graphDir = resolve(REPO, 'chaingraph');
  if (!existsSync(graphDir)) return null;
  const slug = toolId.replace(/^art-\d+-/, '');
  for (const name of readdirSync(graphDir)) {
    if (name.endsWith('.html') && name.includes(slug)) return join(graphDir, name);
  }
  return null;
}

const results = []; // one entry per template id

for (const id of listTemplateDirs()) {
  const dir = join(TEMPLATES_ROOT, id);
  const metaPath = join(dir, 'template.meta.json');
  const bodyPath = join(dir, 'body.md');
  const schemaPath = join(dir, 'variables.schema.json');
  const samplesDir = join(dir, 'samples');

  const findings = []; // { check, level: 'fail'|'warn', message }
  const note = (check, level, message) => findings.push({ check, level, message });

  if (!existsSync(metaPath)) {
    note(0, 'fail', `${id}: missing template.meta.json`);
    results.push({ id, tier: 'alpha', findings });
    continue;
  }

  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const t = meta.template || {};
  const licenseMode = t.license_mode;
  const hasBody = existsSync(bodyPath);

  // --- check 1: license consistency ---
  if (licenseMode === 'reference-only') {
    if (hasBody) note(1, 'fail', `${id}: reference-only template must not ship body.md`);
  } else if (licenseMode === 'verbatim') {
    if (!t.attribution) note(1, 'fail', `${id}: verbatim template missing attribution`);
    if (!t.source_url) note(1, 'fail', `${id}: verbatim template missing source_url`);
    if (!hasBody) note(1, 'fail', `${id}: verbatim template missing body.md`);
  } else if (licenseMode === 'modifiable') {
    note(1, 'fail', `${id}: license_mode "modifiable" is retired (§3.3) — use verbatim or reference-only`);
  } else {
    note(1, 'fail', `${id}: unknown or missing license_mode "${licenseMode}"`);
  }

  // --- check 2: body provenance (drift detection) ---
  if (hasBody) {
    const body = readFileSync(bodyPath, 'utf8');
    const actualHash = sha256(body);
    const recordedHash = t.body_sha256;
    if (!recordedHash) {
      note(2, 'fail', `${id}: body.md present but no body_sha256 recorded in template.meta.json`);
    } else if (actualHash !== recordedHash) {
      note(2, 'fail', `${id}: BODY DRIFT — body.md sha256 ${actualHash} does not match recorded body_sha256 ${recordedHash}`);
    }

    // --- check 4: smart quotes / em-dash — advisory only, never fails ---
    const emdashCount = (body.match(EMDASH) || []).length;
    const smartQuoteCount = (body.match(SMARTQUOTES) || []).length;
    if (emdashCount) note(4, 'warn', `${id}: body.md contains ${emdashCount} em-dash(es) (advisory — legal body text is exempt, §7.4)`);
    if (smartQuoteCount) note(4, 'warn', `${id}: body.md contains ${smartQuoteCount} smart-quote character(s) (advisory — legal body text is exempt, §7.4)`);
  }

  // --- check 3: variable coverage (meta.variables <=> schema.properties) ---
  const declaredTokens = new Set((t.variables || []).map((v) => v.token));
  if (existsSync(schemaPath)) {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const schemaTokens = new Set(Object.keys(schema.properties || {}));
    for (const tok of declaredTokens) {
      if (!schemaTokens.has(tok)) note(3, 'fail', `${id}: variable "${tok}" declared in template.meta.json but missing from variables.schema.json`);
    }
    for (const tok of schemaTokens) {
      if (!declaredTokens.has(tok)) note(3, 'fail', `${id}: schema property "${tok}" has no matching entry in template.meta.json variables[]`);
    }
    const schemaRequired = new Set(schema.required || []);
    for (const v of t.variables || []) {
      if (v.required && !schemaRequired.has(v.token)) {
        note(3, 'fail', `${id}: variable "${v.token}" marked required in meta but not in schema.required`);
      }
    }
  } else if (declaredTokens.size) {
    note(3, 'fail', `${id}: template.meta.json declares variables but variables.schema.json is missing`);
  }

  // --- check 5: fixtures present + deterministic ---
  const varsPath = join(samplesDir, 'sample.vars.json');
  const expectedPath = join(samplesDir, 'expected.md');
  if (!existsSync(samplesDir) || !existsSync(varsPath) || !existsSync(expectedPath)) {
    note(5, 'fail', `${id}: samples/sample.vars.json + samples/expected.md not present (no assembler fixture yet)`);
  }
  // Determinism itself (assembling sample.vars.json === expected.md byte-for-byte)
  // is exercised once an assembler kernel exists for this template; there is
  // deliberately no generic re-implementation of clause assembly here (§A4.3 —
  // don't invent a canonicalizer/assembler in a gate script).

  // --- check 6: not_legal_advice + disclosure string on the node page ---
  if (t.not_legal_advice !== true) {
    note(6, 'fail', `${id}: not_legal_advice must be true in template.meta.json`);
  }
  const toolId = meta.tool_id;
  const nodePage = toolId ? findNodePage(toolId) : null;
  if (!nodePage) {
    note(6, 'warn', `${id}: no node page found yet for tool_id "${toolId}" (P2 not built) — disclosure string cannot be verified until it ships`);
  } else {
    const html = readFileSync(nodePage, 'utf8');
    if (!/not[\s-]?legal[\s-]?advice/i.test(html)) {
      note(6, 'fail', `${id}: node page ${basename(nodePage)} missing a "not legal advice" disclosure string`);
    }
  }

  // --- check 7: maturity scorecard ---
  const hardChecks = [1, 2, 3, 6];
  const hardFailed = findings.some((f) => f.level === 'fail' && hardChecks.includes(f.check));
  const fixturesPresent = existsSync(varsPath) && existsSync(expectedPath);
  let tier;
  if (hardFailed) tier = 'alpha';
  else if (!fixturesPresent) tier = 'beta';
  else tier = 'stable'; // all of 1,2,3,6 clean + fixtures deterministic

  results.push({ id, tier, toolId, licenseMode, findings });
}

// --- write the audit artifact (§7 check 7) ---
const audit = {
  generated_by: 'check-template-integrity.mjs',
  blocking: BLOCKING,
  templates: results.map((r) => ({
    id: r.id,
    tool_id: r.toolId,
    license_mode: r.licenseMode,
    maturity_tier: r.tier,
    fail_count: r.findings.filter((f) => f.level === 'fail').length,
    warn_count: r.findings.filter((f) => f.level === 'warn').length,
  })),
};
writeFileSync(AUDIT_OUT, JSON.stringify(audit, null, 2) + '\n');

// --- report ---
const allFindings = results.flatMap((r) => r.findings);
const failures = allFindings.filter((f) => f.level === 'fail');
const warnings = allFindings.filter((f) => f.level === 'warn');

if (results.length === 0) {
  console.log(`template-integrity: no templates found under ${TEMPLATES_ROOT} — nothing to check.`);
  process.exit(0);
}

console.log(`template-integrity: ${results.length} template(s) scanned.`);
for (const r of results) {
  console.log(`  ${r.id}: tier=${r.tier} fail=${r.findings.filter((f) => f.level === 'fail').length} warn=${r.findings.filter((f) => f.level === 'warn').length}`);
}
if (warnings.length) {
  console.log(`\ntemplate-integrity ADVISORY (never fails):\n  ` + warnings.map((f) => f.message).join('\n  '));
}
if (failures.length) {
  const verb = BLOCKING ? 'FAILURE(s)' : 'DETECTED (advisory-first — GATE-FREEZE, see file header for the blocking flip)';
  console.log(`\ntemplate-integrity ${verb}:\n  ` + failures.map((f) => f.message).join('\n  '));
}
console.log(`\ntemplate-integrity: wrote ${audit.templates.length} record(s) to data/template-audit.json.`);

if (BLOCKING && failures.length) {
  process.exit(1);
}
process.exit(0);
