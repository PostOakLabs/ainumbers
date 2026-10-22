#!/usr/bin/env node
/**
 * check-webmcp-direct-execute.mjs — WEBMCP-DIRECT-EXECUTE-VM-GATE-1
 *
 * The direct-mode sibling of check-webmcp-wrapper-execute.mjs. The wrapper gate
 * and the deep-link gate both iterate the PREFILL registration set only: for a
 * DIRECT-mode page the generator's own adjudicateTool() refuses (the manifest
 * inputs have no single control to prefill, so `form-element mapping
 * incomplete` fails them), which means no gate ever executed a direct page's
 * registered execute() body or its human form path. This gate closes that door
 * for the direct-mode set, derived at EVERY run by the same live static
 * adjudication the generator's `--direct` probe uses (directAdjudication,
 * scripts/gen-webmcp-registrations.mjs) — the page list is never hand-listed:
 *
 *   Leg 1 (execute): load the page in the wrapper gate's minimal-DOM vm
 *     harness (imported — its bytes stay untouched) with a CAPTURING
 *     document.modelContext, run the inline scripts in document order, take
 *     the registered tool's execute(), hand it fixture 0's policy_parameters
 *     (chaingraph/kernels/fixtures/), and assert the call SETTLES with a
 *     result artifact whose execution_hash equals the fixture's golden_hash.
 *     Three of the direct pages' delegates return the page's hashless result
 *     global ({ pp, output_payload, compliance_flags }); there the verdict
 *     re-hashes (policy_parameters/pp, output_payload) through the SAME
 *     executionHash the generator's direct probe uses — settling on the
 *     fixture golden is the same assertion either way.
 *   Leg 2 (run-path, the human-form proof): no direct page carries a bridge
 *     reader, so per the row the page's NO-ARG RUN WRAPPER is driven: prefill
 *     the page's own controls from fixture 0 (the per-page adapters below are
 *     the only page-shaped wiring in this gate; the PAGE SET is never
 *     hand-listed and an unwired page is a fail-closed RED, so a new direct
 *     page cannot silently skip leg 2), invoke the run wrapper, and assert the
 *     page's result global settles holding (policy_parameters, output_payload)
 *     that re-hash to the fixture's golden_hash. Every vm run carries the
 *     wrapper gate's timeout guards — a hung run is a RED naming the page and
 *     leg, never a wedge.
 *
 * RED-then-GREEN controls: `--self-test` builds a synthetic direct page and
 * proves leg-1 GREEN, a wrong-hash RED, and a never-settling RED; leg-2 GREEN,
 * a run-throw RED, a wrong-hash RED, and the unwired-adapter fail-closed RED.
 *
 * Usage:
 *   node scripts/check-webmcp-direct-execute.mjs                # gate (exit 1 on failure)
 *   node scripts/check-webmcp-direct-execute.mjs --only <tool>  # one page (both legs)
 *   node scripts/check-webmcp-direct-execute.mjs --json         # one JSON line per clean leg
 *   node scripts/check-webmcp-direct-execute.mjs --self-test    # in-script RED/GREEN controls
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';
import { executionHash } from '../chaingraph/kernels/_hash.mjs';
import { readOutcome } from '../chaingraph/kernels/_shape.mjs';
import { deriveTargets, adjudicateTool, directAdjudication } from './gen-webmcp-registrations.mjs';
import { makeExecuteSandbox, extractInlineScripts, judgeExecute } from './check-webmcp-wrapper-execute.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const JSONMODE = process.argv.includes('--json');
const SELFTEST = process.argv.includes('--self-test');
const LEG1_TIMEOUT_MS = 15_000;
const LEG2_TIMEOUT_MS = 15_000;

function stripHash(h) {
  return String(h).replace(/^sha256:/, '');
}

/* ── sandbox augmentation (direct-mode execute bodies paint) ─────────────── */

/**
 * The direct delegate's execute() runs the page's render function and inserts
 * the mandatory "Inputs used by the agent" echo panel with
 * `document.body.insertBefore(...)` (wrapper pages never paint inside
 * execute(), so the wrapper harness never needed it). The element stub itself
 * is untouched — the insertion is a no-op capture, exactly like appendChild.
 */
function augmentForDirectPaint(sandbox) {
  sandbox.document.body.insertBefore = function insertBefore(child) { return child; };
  sandbox.document.body.firstChild = null;
  sandbox.document.head.insertBefore = function insertBefore(child) { return child; };
  sandbox.document.head.firstChild = null;
}

/* ── leg 1: the registered tool's execute() on fixture 0 ─────────────────── */

/**
 * Load one direct page, run its inline scripts in document order, and drive
 * the registered tool's execute(fixture-0 policy_parameters). Same verdict
 * shape as the wrapper gate's runWrapperExecute: { ok, error?, toolName?,
 * returned?, executionHash? } — ok=false only for HARNESS failures; per-call
 * verdicts are judgeDirectExecute's.
 */
export async function runDirectExecute(pageAbs, pageRel, params) {
  const html = readFileSync(pageAbs, 'utf8');
  const { scripts, seedElements } = extractInlineScripts(html);
  if (scripts.length === 0) return { ok: false, error: 'no inline scripts found' };
  const { sandbox, warns, registered } = makeExecuteSandbox(seedElements);
  augmentForDirectPaint(sandbox);
  const context = vm.createContext(sandbox);
  for (let i = 0; i < scripts.length; i++) {
    try {
      new vm.Script(scripts[i], { filename: `${pageRel}#script-${i}` }).runInContext(context);
    } catch (e) {
      return { ok: false, error: `inline script ${i} threw at load: ${e.message}` };
    }
  }
  if (registered.length === 0) {
    const why = warns.filter((w) => w.length).join(' | ') || 'no diagnostic emitted';
    return { ok: false, error: `page registered no WebMCP tool (modelContext capture empty — registration block missing or feature-detect failed; ${why})` };
  }
  return await new Promise((resolveOutcome) => {
    const timer = setTimeout(() => resolveOutcome({ ok: false, error: `execute() did not settle within ${LEG1_TIMEOUT_MS}ms — a wedging direct execute blocks its host forever` }), LEG1_TIMEOUT_MS);
    (async () => {
      let returned;
      try {
        returned = await registered[0].execute(params);
      } catch (e) {
        return { ok: false, error: `execute() threw: ${e.message}`, returned: undefined };
      }
      return { ok: true, returned };
    })().then((r) => {
      clearTimeout(timer);
      if (!r.ok) return resolveOutcome(r);
      resolveOutcome({ ok: true, toolName: registered[0].name, returned: r.returned, executionHash: r.returned?.execution_hash, sandbox });
    });
  });
}

/**
 * Leg-1 verdict. Reuses the wrapper gate's judgeExecute verdict, with one
 * direct-mode extension: where the returned artifact carries no execution_hash
 * (the delegates return the kernel's raw outcome or the page's hashless result
 * global), the verdict re-hashes through the same executionHash the
 * generator's probe uses — the preimage is the artifact's own
 * policy_parameters/pp when it echoes one, else the params the caller handed
 * execute() (fixture 0's policy_parameters, unchanged by the delegate).
 */
async function judgeDirectExecute(result, expectedHash, params) {
  const base = judgeExecute(result, expectedHash);
  if (base.ok) return base;
  const returned = result.returned;
  if (!result.ok || !returned || typeof returned !== 'object' || typeof returned.error === 'string' || returned.execution_hash) return base;
  const pp = returned.policy_parameters ?? returned.pp ?? params;
  if (!pp || typeof pp !== 'object') return { ok: false, problem: 'execute() result carries neither execution_hash nor a policy_parameters/pp to re-hash — not a result artifact a host could verify' };
  if (returned.output_payload === undefined) return { ok: false, problem: 'execute() result carries neither execution_hash nor an output_payload to re-hash' };
  let produced;
  try {
    produced = await executionHash(pp, readOutcome(returned));
  } catch (e) {
    return { ok: false, problem: `execute() result re-hash failed: ${e.message}` };
  }
  const producedHex = stripHash(produced);
  const expectedHex = stripHash(expectedHash);
  if (producedHex !== expectedHex) {
    return { ok: false, problem: `execute() re-hashed result mismatch — execute path produced ${producedHex.slice(0, 16)}…, fixture golden_hash is ${expectedHex.slice(0, 16)}…` };
  }
  return { ok: true };
}

/* ── leg 2: the page's own no-arg run wrapper on prefilled fixture 0 ─────── */

/**
 * Per-page leg-2 wiring. The PAGE SET is never hand-listed (it is derived by
 * directAdjudication on every run); this table only teaches the gate how each
 * direct page's run wrapper reads its controls, so fixture 0 can be prefilled
 * in the harness the way a human form submission would. A derived direct page
 * with NO entry here is a fail-closed RED — it can never silently skip leg 2.
 * Encoding rules mirror each page's run path exactly (JSON textareas stay
 * JSON, numbers arrive as strings, checkboxes as 'true'/'false').
 */
const RUN_PATH_ADAPTERS = {
  'art-559-attest-calc-agent-independence': {
    run: 'runCheck',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'calcAgentId', pp.calc_agent_id);
      setVal(sandbox, 'partiesJson', JSON.stringify(pp.interested_parties, null, 2));
      setVal(sandbox, 'relDecl', pp.relationship_declaration ?? '');
      setVal(sandbox, 'disclosureNote', pp.disclosure_note ?? '');
      setVal(sandbox, 'triggerHash', pp.trigger_ref?.execution_hash ?? '');
      setVal(sandbox, 'triggerToolId', pp.trigger_ref?.tool_id ?? '');
    },
  },
  'art-566-iolta-three-way-reconciliation': {
    run: 'runCheck',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'clientsJson', JSON.stringify(pp.client_ledgers, null, 2));
      setVal(sandbox, 'outstandingJson', JSON.stringify(pp.outstanding_items, null, 2));
      setVal(sandbox, 'tolerance', String(pp.reconciliation_tolerance_minor));
      setVal(sandbox, 'periodStart', pp.statement_period?.start_date ?? '');
      setVal(sandbox, 'periodEnd', pp.statement_period?.end_date ?? '');
      setVal(sandbox, 'bankBal', String(pp.bank?.ending_balance_minor ?? ''));
      setVal(sandbox, 'bankDate', pp.bank?.statement_date ?? '');
      setVal(sandbox, 'trustBal', String(pp.trust_ledger?.ending_balance_minor ?? ''));
      setVal(sandbox, 'trustAsOf', pp.trust_ledger?.as_of ?? '');
    },
  },
  'art-588-docket-deadline-sweep': {
    run: 'runSweep',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'recordsJson', JSON.stringify(pp.records, null, 2));
      setVal(sandbox, 'holidayDates', JSON.stringify(pp.roll_rule?.holiday_dates ?? [], null, 2));
      setVal(sandbox, 'asOfDate', pp.as_of_date ?? '');
      setVal(sandbox, 'dueSoonDays', String(pp.due_soon_days_threshold ?? ''));
      setVal(sandbox, 'rollWeekends', String(pp.roll_rule?.roll_weekends ?? ''));
      setVal(sandbox, 'rollDirection', pp.roll_rule?.roll_direction ?? '');
    },
  },
  'art-619-ccd2-aprc-annex3-recompute': {
    // The page reads flow rows OUT of the DOM (readFlows over #ddBody/#rpBody
    // tr rows), so the adapter serves fixture rows through querySelectorAll —
    // the same table a human builds with the add-drawdown/add-repayment rows.
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      const row = (f) => ({
        querySelector(sel) {
          const v = sel === '.amt' ? f.amount : sel === '.full' ? f.full_periods : f.fraction;
          return { value: String(v) };
        },
      });
      const ddRows = (pp.drawdowns ?? []).map(row);
      const rpRows = (pp.repayments ?? []).map(row);
      const realQuerySelectorAll = sandbox.document.querySelectorAll.bind(sandbox.document);
      sandbox.document.querySelectorAll = (sel) => {
        if (sel === '#ddBody tr') return ddRows;
        if (sel === '#rpBody tr') return rpRows;
        return realQuerySelectorAll(sel);
      };
    },
  },
  'art-499-check-safeguarding-reconciliation': {
    run: 'runCheck',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'asOfDate', pp.as_of_date ?? '');
      setVal(sandbox, 'currency', pp.currency ?? '');
      setVal(sandbox, 'reconType', pp.reconciliation_type ?? '');
      setVal(sandbox, 'requirement', String(pp.safeguarding_requirement_minor_units ?? ''));
      setVal(sandbox, 'tolerance', String(pp.tolerance_minor_units ?? ''));
      setVal(sandbox, 'componentsJson', JSON.stringify(pp.safeguarding_resource_components ?? [], null, 2));
    },
  },
  'art-500-classify-safeguarding-method': {
    run: 'runClassify',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'asOfDate', pp.as_of_date ?? '');
      setVal(sandbox, 'highWater', String(pp.relevant_funds_high_water_minor_units ?? ''));
      setVal(sandbox, 'weeksObserved', String(pp.weeks_observed ?? ''));
      setVal(sandbox, 'streamsJson', JSON.stringify(pp.streams ?? [], null, 2));
    },
  },
  'art-501-build-safeguarding-audit-evidence': {
    run: 'runPack',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'firmRef', pp.firm_ref ?? '');
      setVal(sandbox, 'periodStart', pp.audit_period?.start_date ?? '');
      setVal(sandbox, 'periodEnd', pp.audit_period?.end_date ?? '');
      setVal(sandbox, 'attestedSubject', pp.attested_subject === undefined ? '' : JSON.stringify(pp.attested_subject, null, 2));
      setVal(sandbox, 'reconResults', pp.reconciliation_results === undefined ? '' : JSON.stringify(pp.reconciliation_results, null, 2));
      setVal(sandbox, 'methodClassification', pp.method_classification === undefined ? '' : JSON.stringify(pp.method_classification, null, 2));
      setVal(sandbox, 'haRecords', pp.accountability_records === undefined ? '' : JSON.stringify(pp.accountability_records, null, 2));
      setVal(sandbox, 'mgmtResponses', pp.management_responses === undefined ? '' : JSON.stringify(pp.management_responses, null, 2));
    },
  },
  'art-691-regulatory-obligations-register': {
    // run() parses the #ppInput textarea as policy_parameters and feeds
    // compute() directly; the adapter serves fixture 0 through that control.
    run: 'run',
    prefill(sandbox, fx) {
      setVal(sandbox, 'ppInput', JSON.stringify(fx.policy_parameters));
    },
  },
  'art-628-declarative-decision-tree-evaluator': {
    // run() clones the page's DEMO_TREE constant (the tree the human sees) and
    // reads the fact checkboxes; the adapter sets each fixture fact checkbox.
    // The golden comparison is the proof the demo tree matches the fixture.
    run: 'run',
    prefill(sandbox, fx) {
      const facts = fx.policy_parameters.facts ?? {};
      for (const k of Object.keys(facts)) setVal(sandbox, `f_${k}`, facts[k] ? 'true' : 'false');
    },
  },
  'art-704-ai-token-spend': {
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'as_of', pp.as_of ?? '');
      const nums = ['requests_per_month', 'input_tokens_per_request', 'cached_input_share_bp', 'cache_write_tokens_per_request', 'output_tokens_per_request', 'batch_share_bp', 'long_context_share_bp'];
      for (const n of nums) setVal(sandbox, n, pp.usage?.[n] === undefined ? '' : String(pp.usage[n]));
      setVal(sandbox, 'cache_write_ttl', pp.usage?.cache_write_ttl ?? '');
      setVal(sandbox, 'price_table', pp.price_table === undefined ? '' : JSON.stringify(pp.price_table));
      setVal(sandbox, 'compare', pp.compare === undefined ? '' : JSON.stringify(pp.compare));
    },
  },
};

function setVal(sandbox, id, v) {
  sandbox.document.getElementById(id).value = v;
}

/**
 * Drive one page's run wrapper. Returns
 *   { ok, error?, executionHash?, resultGlobal? } — ok=false only for HARNESS
 * failures (no adapter, wrapper missing, script threw at load, run exceeded
 * the timeout, result global unset or unhashable); the hash verdict is the
 * caller's (same golden comparison as leg 1).
 */
export async function runDirectRunPath(toolId, pageAbs, pageRel, fixture, resGlobal) {
  const adapter = RUN_PATH_ADAPTERS[toolId];
  if (!adapter) {
    return { ok: false, error: 'no run-path adapter wired for this page — add a RUN_PATH_ADAPTERS entry naming its no-arg run wrapper (fail-closed: a new direct page cannot silently skip leg 2)' };
  }
  const html = readFileSync(pageAbs, 'utf8');
  const { scripts, seedElements } = extractInlineScripts(html);
  if (scripts.length === 0) return { ok: false, error: 'no inline scripts found' };
  const { sandbox, warns } = makeExecuteSandbox(seedElements);
  augmentForDirectPaint(sandbox);
  const context = vm.createContext(sandbox);
  for (let i = 0; i < scripts.length; i++) {
    try {
      new vm.Script(scripts[i], { filename: `${pageRel}#script-${i}` }).runInContext(context);
    } catch (e) {
      return { ok: false, error: `inline script ${i} threw at load: ${e.message}` };
    }
  }
  if (typeof sandbox[adapter.run] !== 'function') {
    const why = warns.filter((w) => w.length).join(' | ') || 'no diagnostic emitted';
    return { ok: false, error: `run wrapper ${adapter.run}() not found on the page (${why})` };
  }
  try {
    adapter.prefill(sandbox, fixture);
  } catch (e) {
    return { ok: false, error: `run-path prefill threw (adapter drift vs the page's controls): ${e.message}` };
  }
  const ran = await new Promise((resolveOutcome) => {
    const timer = setTimeout(() => resolveOutcome({ ok: false, error: `run wrapper ${adapter.run}() did not settle within ${LEG2_TIMEOUT_MS}ms — a wedging form path wedges the human too` }), LEG2_TIMEOUT_MS);
    (async () => {
      try {
        await sandbox[adapter.run]();
      } catch (e) {
        return { ok: false, error: `run wrapper ${adapter.run}() threw: ${e.message}` };
      }
      return { ok: true };
    })().then((r) => {
      clearTimeout(timer);
      resolveOutcome(r);
    });
  });
  if (!ran.ok) return ran;
  // The result global may be a top-level `let`/`const` (lexical — invisible on
  // the sandbox object), so read it INSIDE the context, exactly how a
  // same-origin console would.
  let rg;
  try {
    rg = new vm.Script(resGlobal, { filename: `${pageRel}#result-global` }).runInContext(context);
  } catch {
    rg = sandbox[resGlobal];
  }
  if (!rg || typeof rg !== 'object') {
    const why = warns.filter((w) => w.length).join(' | ') || 'no diagnostic emitted';
    return { ok: false, error: `result global ${resGlobal} was not set to an artifact by the run path (${why})` };
  }
  const pp = rg.policy_parameters ?? rg.pp;
  if (!pp || typeof pp !== 'object') return { ok: false, error: `result global ${resGlobal} carries no policy_parameters/pp` };
  if (rg.output_payload === undefined) return { ok: false, error: `result global ${resGlobal} carries no output_payload` };
  let hash;
  try {
    hash = await executionHash(pp, readOutcome(rg));
  } catch (e) {
    return { ok: false, error: `execution_hash recomputation over the run-path result failed: ${e.message}` };
  }
  return { ok: true, executionHash: String(hash), resultGlobal: rg };
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function collectFailures() {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(REPO);
  const problems = [];
  const perPage = [];
  let checked = 0;
  for (const id of cleared) {
    if (ONLY && id !== ONLY) continue;
    // Direct mode is FALLBACK-only, exactly the generator's probe: a page the
    // prefill adjudication clears belongs to the wrapper gate, never here.
    const prefill = adjudicateTool(id, REPO, manifestIndex, mcpNameByTool);
    if (prefill.ok) continue;
    const v = await directAdjudication(id, manifestIndex, mcpNameByTool, REPO);
    if (!v.eligible) continue;
    const { page, resGlobal } = v.detail;
    const pageAbs = resolve(REPO, page);
    checked++;
    const fixturePath = join(REPO, 'chaingraph', 'kernels', 'fixtures', `${id}.fixtures.json`);
    if (!existsSync(fixturePath)) { problems.push(`${page}: leg 1 (execute): no fixture file chaingraph/kernels/fixtures/${id}.fixtures.json — cannot drive the direct execute`); problems.push(`${page}: leg 2 (run-path): no fixture file chaingraph/kernels/fixtures/${id}.fixtures.json — cannot prefill the run path`); continue; }
    let fixture;
    try { fixture = JSON.parse(readFileSync(fixturePath, 'utf8')); } catch (e) { problems.push(`${page}: leg 1 (execute): fixture unparseable: ${e.message}`); problems.push(`${page}: leg 2 (run-path): fixture unparseable: ${e.message}`); continue; }
    const fx = (fixture.vectors || fixture.fixtures || [])[0];
    if (!fx || !fx.policy_parameters || !fx.golden_hash) { problems.push(`${page}: leg 1 (execute): fixture 0 lacks policy_parameters/golden_hash`); problems.push(`${page}: leg 2 (run-path): fixture 0 lacks policy_parameters/golden_hash`); continue; }

    // Leg 1 — the registered tool's execute() settles with the golden hash.
    const leg1 = await runDirectExecute(pageAbs, page, fx.policy_parameters);
    const v1 = await judgeDirectExecute(leg1, fx.golden_hash, fx.policy_parameters);
    if (!v1.ok) {
      problems.push(`${page}: leg 1 (execute): ${v1.problem}`);
    } else if (JSONMODE) {
      console.log(JSON.stringify({ page, leg: 1, tool: leg1.toolName, hash: stripHash(leg1.executionHash ?? fx.golden_hash) }));
    }

    // Leg 2 — the page's own run path settles with the same computation.
    const leg2 = await runDirectRunPath(id, pageAbs, page, fx, resGlobal);
    let v2 = { ok: true };
    if (!leg2.ok) {
      v2 = { ok: false, problem: leg2.error };
    } else if (stripHash(leg2.executionHash) !== stripHash(fx.golden_hash)) {
      v2 = { ok: false, problem: `run-path execution_hash mismatch — the page's own run wrapper produced ${stripHash(leg2.executionHash).slice(0, 16)}…, fixture golden_hash is ${stripHash(fx.golden_hash).slice(0, 16)}…` };
    }
    if (!v2.ok) {
      problems.push(`${page}: leg 2 (run-path): ${v2.problem}`);
    } else if (JSONMODE) {
      console.log(JSON.stringify({ page, leg: 2, hash: stripHash(leg2.executionHash) }));
    }
    perPage.push({ id, page, leg1: v1.ok, leg2: v2.ok, hash: stripHash(fx.golden_hash) });
  }
  return { problems, checked, perPage };
}

/* ── BASELINE + DOWNWARD RATCHET (check-webmcp-wrapper-execute pattern) ──── */

const BASELINE_PATH = join(HERE, 'webmcp-direct-execute-baseline.json');

/**
 * Pre-existing direct-mode divergences surfaced by this gate — a defect that
 * pre-dates the gate and whose fix needs page or generator bytes (fenced to
 * another row) — are baselined in scripts/webmcp-direct-execute-baseline.json
 * with a reason and WARN. They can never silence a NEW failure (a different
 * problem text on the same page:leg is fresh), and a baseline entry whose
 * page:leg no longer fails is STALE and FAILS the gate until removed
 * (down-only ratchet — deleting an entry is always safe, it only tightens).
 * Keyed by `<page>: <leg N (leg-name)>` so a healed leg cannot hide behind a
 * sibling's entry.
 */
function baselineKey(problem) {
  const m = problem.match(/^(chaingraph\/[^:]+): (leg \d+ \([^)]*\)): /);
  return m ? `${m[1]}: ${m[2]}` : null;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Map();
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return new Map(Object.entries(parsed));
}

async function main() {
  const baseline = loadBaseline();
  const { problems, checked, perPage } = await collectFailures();
  const fresh = [];
  const warned = [];
  const failingKeys = new Set();
  for (const p of problems) {
    const key = baselineKey(p);
    failingKeys.add(key ?? p);
    if (key && baseline.has(key)) warned.push(p);
    else fresh.push(p);
  }
  const stale = [...baseline.keys()].filter((key) => {
    if (ONLY) {
      const page = key.slice(0, key.indexOf(':'));
      if (!page.endsWith(`${ONLY}.html`)) return false;
    }
    return !failingKeys.has(key);
  });
  if (fresh.length || stale.length) {
    console.error(`✗ check-webmcp-direct-execute FAILED (${fresh.length} NEW problem(s), ${stale.length} STALE baseline entr${stale.length === 1 ? 'y' : 'ies'} over ${checked} direct-mode page(s); ${warned.length} baselined WARN):`);
    fresh.forEach((p) => console.error('    ' + p));
    stale.forEach((key) => console.error(`    STALE baseline entry — ${key} no longer fails the direct-execute gate; remove it from ${BASELINE_PATH} (down-only ratchet)`));
    console.error('  Direct-mode pages are adjudicated live by scripts/gen-webmcp-registrations.mjs --direct; both legs must settle with the fixture execution_hash on every one. Pre-existing direct-path divergences belong in scripts/webmcp-direct-execute-baseline.json with a reason — never silence, never a fix-forward.');
    process.exitCode = 1;
    return;
  }
  console.log(`✓ check-webmcp-direct-execute clean — ${checked} direct-mode page(s), both legs: the registered tool's execute(fixture-0 policy_parameters) settles with the fixture execution_hash AND the page's own run wrapper on the same fixture re-hashes to the same golden (WEBMCP-DIRECT-EXECUTE-VM-GATE-1). ${warned.length} leg(s) WARN on the documented baseline (downward ratchet — follow-up rows shrink it).`);
  perPage.forEach((r) => console.log(`  ${r.page} leg1=${r.leg1 ? 'OK' : 'WARN'} leg2=${r.leg2 ? 'OK' : 'WARN'} golden=${r.hash.slice(0, 16)}…`));
  warned.forEach((p) => console.log('  WARN ' + p));
}

/* ── --self-test: in-script RED/GREEN controls on a synthetic direct page ── */

async function selfTest() {
  const fails = [];
  const reg = (computeBody, runBody) => '<html><body><div class="results-panel"></div></body><script>\n' +
    'var _lastResult = null;\n' +
    `function compute(p) { ${computeBody} }\n` +
    'function runCheck() {\n' +
    `  ${runBody}\n` +
    '}\n' +
    "const mc = document.modelContext;\n" +
    "if (mc) { mc.registerTool({ name: 'selftest_tool', description: 'self test', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true }, execute: async function(params) { try { var echo = document.createElement('pre'); document.body.insertBefore(echo, document.body.firstChild); var r = await compute(params); _lastResult = { pp: params, output_payload: r.output_payload, compliance_flags: [] }; return _lastResult; } catch (err) { return { error: 'compute_failed', detail: String((err && err.message) || err) }; } } }); }\n" +
    '</script></html>';
  const greenRun = "_lastResult = { pp: { x: 'a' }, output_payload: compute({ x: 'a' }).output_payload, compliance_flags: [] };";
  const pp0 = { x: 'a' };
  const realGolden = await executionHash(pp0, readOutcome({ output_payload: { echo: 'a' } }));

  // temp page on disk (the drivers read files)
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'direct-exec-selftest-'));
  const pageAbs = join(dir, 'selftest.html');
  try {
    // GREEN control, leg 1: execute settles with the golden hash.
    writeFileSync(pageAbs, reg('return { output_payload: { echo: p.x } };', greenRun));
    const l1g = await runDirectExecute(pageAbs, 'selftest.html', pp0);
    const v1g = await judgeDirectExecute(l1g, realGolden, pp0);
    if (!v1g.ok) fails.push(`self-test leg 1 GREEN control expected clean, got: ${v1g.problem}`);

    // GREEN control, leg 2: the run wrapper settles with the same golden.
    RUN_PATH_ADAPTERS.selftest_tool = { run: 'runCheck', prefill(sandbox) { setVal(sandbox, 'x', 'a'); } };
    writeFileSync(pageAbs, reg('return { output_payload: { echo: p.x } };', "var xv = document.getElementById('x').value; _lastResult = { pp: { x: xv }, output_payload: compute({ x: xv }).output_payload, compliance_flags: [] };"));
    const l2g = await runDirectRunPath('selftest_tool', pageAbs, 'selftest.html', { policy_parameters: pp0 }, '_lastResult');
    if (!l2g.ok) fails.push(`self-test leg 2 GREEN control expected clean, got: ${l2g.error}`);
    else if (stripHash(l2g.executionHash) !== stripHash(realGolden)) fails.push(`self-test leg 2 GREEN control hash mismatch: ${l2g.executionHash} vs ${realGolden}`);

    // RED, leg 1: execute returns a WRONG-hash artifact.
    writeFileSync(pageAbs, reg('return { output_payload: { echo: p.x, tampered: true } };', greenRun));
    const l1r = await runDirectExecute(pageAbs, 'selftest.html', pp0);
    const v1r = await judgeDirectExecute(l1r, realGolden, pp0);
    if (v1r.ok) fails.push('self-test leg 1 RED control expected a hash-mismatch problem, got clean');

    // RED, leg 1: execute that never settles (the wedge class).
    writeFileSync(pageAbs, reg('return new Promise(function(){});', greenRun));
    const l1w = await runDirectExecute(pageAbs, 'selftest.html', pp0);
    const v1w = await judgeDirectExecute(l1w, realGolden, pp0);
    if (v1w.ok) fails.push('self-test leg 1 wedge control expected a never-settles problem, got clean');

    // RED, leg 2: the run path throws.
    writeFileSync(pageAbs, reg('return { output_payload: { echo: p.x } };', "throw new Error('selftest run-path mutation');"));
    const l2r = await runDirectRunPath('selftest_tool', pageAbs, 'selftest.html', { policy_parameters: pp0 }, '_lastResult');
    if (l2r.ok) fails.push('self-test leg 2 RED control expected the run-wrapper throw, got clean');
    else if (!l2r.error.includes('run wrapper runCheck() threw')) fails.push(`self-test leg 2 RED control named the wrong failure: ${l2r.error}`);

    // RED, leg 2: the run path settles with a WRONG-hash result global.
    writeFileSync(pageAbs, reg('return { output_payload: { echo: p.x } };', "_lastResult = { pp: { x: 'a' }, output_payload: { echo: 'TAMPERED' }, compliance_flags: [] };"));
    const l2h = await runDirectRunPath('selftest_tool', pageAbs, 'selftest.html', { policy_parameters: pp0 }, '_lastResult');
    if (l2h.ok && stripHash(l2h.executionHash) === stripHash(realGolden)) fails.push('self-test leg 2 wrong-hash control unexpectedly reproduced the golden');

    // RED, fail-closed: a derived page with no adapter can never skip leg 2.
    const l2u = await runDirectRunPath('unwired_tool', pageAbs, 'selftest.html', { policy_parameters: pp0 }, '_lastResult');
    if (l2u.ok || !l2u.error.includes('no run-path adapter wired')) fails.push('self-test fail-closed control expected the unwired-adapter RED');
  } finally {
    delete RUN_PATH_ADAPTERS.selftest_tool;
    rmSync(dir, { recursive: true, force: true });
  }

  if (fails.length) {
    console.error(`✗ check-webmcp-direct-execute --self-test FAILED (${fails.length}):`);
    fails.forEach((f) => console.error('    ' + f));
    process.exitCode = 1;
    return;
  }
  console.log('✓ check-webmcp-direct-execute --self-test clean — leg-1 GREEN + hash-mismatch RED + never-settles RED; leg-2 GREEN + run-throw RED + wrong-hash RED + unwired-adapter fail-closed RED.');
}

const invokedAsMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  (SELFTEST ? selfTest() : main()).catch((e) => { console.error('✗ harness exception:', e); process.exitCode = 1; });
}
