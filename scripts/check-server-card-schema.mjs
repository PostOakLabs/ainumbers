#!/usr/bin/env node
/**
 * scripts/check-server-card-schema.mjs — MCPCARD-SCHEMA-1 (2026-09-21)
 *
 * Gate: the committed MCP server card (.well-known/mcp/server-card.json — the
 * one HAND-MAINTAINED registry card; no generator writes it) conforms to the
 * authored schema at chaingraph/standard/mcp-server-card.schema.json, and:
 *   1. every schema `required` field is present with the right type/const/
 *      enum/pattern/minLength/minimum (zero-dependency validator below — the
 *      schema deliberately uses ONLY these keywords, per SO #10 no-npm);
 *   2. tool_count equals the counts-engine `mcp.live` value (worker-served
 *      tools — live nodes + pilot widgets + utility tools — NOT the 1185-tool
 *      site catalog the card's server does not serve);
 *   3. the served schema twin at .well-known/mcp/server-card.schema.json is
 *      byte-identical to the canonical copy in chaingraph/standard/;
 *   4. openapi_url is the live apex root alias — the /docs/ path is
 *      rsync-excluded from the apex (404, measured 2026-09-21;
 *      MCPCARD-SCHEMA-1 also fixed the same dead href in
 *      gen-wellknown-catalogs.mjs).
 *
 * --self-test (SO #40b / GATE-SELFTEST-META-1): proves the checker can go RED.
 * Mutates copies of the real card in a temp dir (never writes repo files) and
 * asserts each tamper class is caught, then re-verifies the untampered card.
 *
 * Mechanism credit: server-card conformance discipline inspired by GREP AI
 * (Parcha Labs — https://grep.ai) public surface, 2026-09-21; ideas only,
 * re-authored. No copied schema bytes — no canonical server-card schema
 * existed at authoring time (mcp-server-card/v1.json 404s; SEP-1649 is draft).
 */

import { readFileSync } from 'node:fs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CARD_REL = '.well-known/mcp/server-card.json';
const SCHEMA_REL = 'chaingraph/standard/mcp-server-card.schema.json';
const TWIN_REL = '.well-known/mcp/server-card.schema.json';

// ── zero-dependency validator (keywords: type/required/const/enum/pattern/ ──
// ── minLength/minimum — exactly what the authored schema uses)            ──
export function validateCard(card, schema) {
  const findings = [];
  if (typeof card !== 'object' || card === null || Array.isArray(card)) {
    return ['card: not a JSON object'];
  }
  for (const key of schema.required || []) {
    if (!(key in card)) findings.push(`required field missing: ${key}`);
  }
  for (const [key, rule] of Object.entries(schema.properties || {})) {
    if (!(key in card)) continue;
    const v = card[key];
    if (rule.type === 'string' && typeof v !== 'string') {
      findings.push(`${key}: expected string, got ${typeof v}`);
      continue;
    }
    if (rule.type === 'integer' && (typeof v !== 'number' || !Number.isInteger(v))) {
      findings.push(`${key}: expected integer, got ${JSON.stringify(v)}`);
      continue;
    }
    if (rule.type === 'object' && (typeof v !== 'object' || v === null || Array.isArray(v))) {
      findings.push(`${key}: expected object`);
      continue;
    }
    if (typeof v === 'string') {
      if (rule.const !== undefined && v !== rule.const)
        findings.push(`${key}: const violation — expected ${JSON.stringify(rule.const)}, got ${JSON.stringify(v)}`);
      if (rule.enum && !rule.enum.includes(v))
        findings.push(`${key}: ${JSON.stringify(v)} not in enum [${rule.enum.join(', ')}]`);
      if (rule.pattern && !new RegExp(rule.pattern).test(v))
        findings.push(`${key}: ${JSON.stringify(v)} fails pattern ${rule.pattern}`);
      if (rule.minLength !== undefined && v.length < rule.minLength)
        findings.push(`${key}: shorter than minLength ${rule.minLength}`);
    }
    if (typeof v === 'number' && rule.minimum !== undefined && v < rule.minimum)
      findings.push(`${key}: ${v} below minimum ${rule.minimum}`);
  }
  return findings;
}

export function checkTwinBytes(canonicalPath, twinPath) {
  try {
    return readFileSync(canonicalPath).equals(readFileSync(twinPath));
  } catch {
    return false;
  }
}

async function mcpLiveCount() {
  const { deriveCounts } = await import('./counts.mjs');
  const counts = await deriveCounts();
  return counts['mcp.live'];
}

function runGate({ cardPath = join(ROOT, CARD_REL), schemaPath = join(ROOT, SCHEMA_REL),
                   twinPath = join(ROOT, TWIN_REL), expectedCount = null }) {
  const findings = [];
  let card, schema;
  try { card = JSON.parse(readFileSync(cardPath, 'utf8')); }
  catch (e) { return [`card does not parse as JSON: ${e.message}`]; }
  try { schema = JSON.parse(readFileSync(schemaPath, 'utf8')); }
  catch (e) { return [`schema does not parse as JSON: ${e.message}`]; }
  findings.push(...validateCard(card, schema));
  if (expectedCount !== null && card.tool_count !== expectedCount)
    findings.push(`tool_count: card says ${card.tool_count}, counts-engine mcp.live says ${expectedCount}`);
  if (!checkTwinBytes(schemaPath, twinPath))
    findings.push(`served schema twin (${TWIN_REL}) is not byte-identical to ${SCHEMA_REL}`);
  return findings;
}

async function selfTest() {
  const tmp = mkdtempSync(join(tmpdir(), 'mcpcard-selftest-'));
  const cases = [];
  try {
    const realCard = JSON.parse(readFileSync(join(ROOT, CARD_REL), 'utf8'));
    const schemaBytes = readFileSync(join(ROOT, SCHEMA_REL));
    const schema = JSON.parse(schemaBytes.toString('utf8'));
    // Raw bytes for BOTH copies — a re-serialized schema differs from the file
    // (trailing newline) and would make the byte-compare trip on serialization,
    // not content (the exact bug the first self-test run caught in itself).
    const schemaPath = join(tmp, 'schema.json');
    writeFileSync(schemaPath, schemaBytes);
    const twinPath = join(tmp, 'twin.json');
    writeFileSync(twinPath, schemaBytes);
    const base = { cardPath: join(tmp, 'card.json'), schemaPath, twinPath, expectedCount: 720 };

    const tampered = (mutate) => {
      const c = JSON.parse(JSON.stringify(realCard));
      mutate(c);
      writeFileSync(base.cardPath, JSON.stringify(c, null, 2));
      return runGate(base);
    };
    cases.push(['missing required ($schema removed)', tampered((c) => { delete c.$schema; })]);
    cases.push(['protocolVersion pattern violation', tampered((c) => { c.protocolVersion = 'latest'; })]);
    cases.push(['tool_count mismatch vs mcp.live', tampered((c) => { c.tool_count = 1185; })]);
    cases.push(['openapi_url dead /docs/ path (const)', tampered((c) => { c.openapi_url = 'https://ainumbers.co/docs/openapi.json'; })]);
    cases.push(['transport enum violation', tampered((c) => { c.transport = 'grpc'; })]);
    // Twin drift on an otherwise-clean card, so the redness is the drift itself.
    writeFileSync(base.cardPath, JSON.stringify(realCard, null, 2));
    writeFileSync(twinPath, schemaBytes);
    cases.push(['served twin byte drift', (() => {
      writeFileSync(twinPath, Buffer.concat([schemaBytes, Buffer.from('\n')]));
      return runGate(base);
    })()]);

    // Green baseline: the REAL card + REAL twin must validate clean.
    writeFileSync(base.cardPath, JSON.stringify(realCard, null, 2));
    writeFileSync(twinPath, schemaBytes);
    const realGreen = runGate(base);

    let pass = 0;
    for (const [name, findings] of cases) {
      const ok = findings.length > 0;
      console.log(`${ok ? 'RED-OK' : 'SELFTEST-FAIL'}  ${name}  (${findings.length} finding(s): ${findings[0] ?? '—'})`);
      if (ok) pass++;
    }
    const greenOk = realGreen.length === 0;
    console.log(`${greenOk ? 'GREEN-OK' : 'SELFTEST-FAIL'}  untampered real card validates clean (${realGreen.length} finding(s))`);
    console.log(`SELF-TEST: ${pass}/${cases.length} tamper classes caught; baseline ${greenOk ? 'green' : 'RED'}`);
    return pass === cases.length && greenOk ? 0 : 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv.includes('--self-test')) process.exit(await selfTest());

const expected = await mcpLiveCount();
const findings = runGate({ expectedCount: expected });
if (findings.length === 0) {
  console.log(`OK server card conforms (tool_count=${expected} == mcp.live; twin byte-identical; openapi_url=apex root)`);
  process.exit(0);
}
for (const f of findings) console.error(`RED ${CARD_REL}: ${f}`);
console.error(`FAIL server card conformance — ${findings.length} finding(s). Canonical schema: ${SCHEMA_REL}`);
process.exit(1);
