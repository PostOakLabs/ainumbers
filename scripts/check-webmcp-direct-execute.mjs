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
import { deriveTargets, adjudicateTool, directAdjudication, probeFunctionExecutes } from './gen-webmcp-registrations.mjs';
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
  sandbox.document.body.removeChild = function removeChild(child) { return child; };
  sandbox.document.head.insertBefore = function insertBefore(child) { return child; };
  sandbox.document.head.firstChild = null;
  sandbox.document.head.removeChild = function removeChild(child) { return child; };
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
// art-616's charge controls (#c_<type>) — the page's own CHARGE_ORDER list.
const ART616_CHARGE_TYPES = ['credit_insurance_premium', 'single_premium_credit_insurance_charge', 'debt_cancellation_fee', 'debt_suspension_fee', 'credit_related_ancillary_product_fee', 'finance_charge', 'application_fee', 'participation_fee', 'other_credit_card_fee'];

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
  'art-151-agent-obo-mandate-validator': {
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'mandate_subject', pp.mandate?.subject ?? '');
      setVal(sandbox, 'mandate_intent', pp.mandate?.intent ?? '');
      setVal(sandbox, 'mandate_scope', (pp.mandate?.scope ?? []).join('\n'));
      setVal(sandbox, 'mandate_valid_until', pp.mandate?.valid_until_unix === undefined || pp.mandate?.valid_until_unix === null ? '' : String(pp.mandate.valid_until_unix));
      setVal(sandbox, 'now_unix', pp.now_unix === undefined || pp.now_unix === null ? '' : String(pp.now_unix));
    },
  },
  'art-237-validate-agent-audit-trail': {
    // runValidate() reads the #agentIdentity/#actionClass/#outcome/#trustLevel
    // selects-inputs, #sha256Prev, #ecdsaSig (presence = non-empty), #reason
    // (action_detail) and #recordId; optional fields are cleared when the
    // fixture does not exercise them so the run-path pp matches fixture 0.
    run: 'runValidate',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'agentIdentity', pp.agent_identity ?? '');
      setVal(sandbox, 'actionClass', pp.action_class ?? '');
      setVal(sandbox, 'outcome', pp.outcome ?? '');
      setVal(sandbox, 'trustLevel', pp.trust_level ?? '');
      setVal(sandbox, 'sha256Prev', pp.sha256_prev_record ?? '');
      setVal(sandbox, 'ecdsaSig', pp.ecdsa_present ? 'fixture-signature-present' : '');
      setVal(sandbox, 'reason', pp.action_detail ?? '');
      setVal(sandbox, 'recordId', pp.record_id ?? '');
    },
  },
  'art-691-regulatory-obligations-register': {
    // run() parses the #input_parameters textarea (the input_parameters value)
    // and wraps it into the policy_parameters preimage before compute(); the
    // adapter serves fixture 0's input_parameters through that control.
    run: 'run',
    prefill(sandbox, fx) {
      setVal(sandbox, 'input_parameters', JSON.stringify(fx.policy_parameters.input_parameters));
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
  'art-616-mla-mapr-actuarial-recompute': {
    run: 'runMapr',
    prefill(sandbox, fx) {
      // The form path assembles the scalar shorthand (loan_amount/payment_amount/
      // num_payments); fixture 0's advances/payments arrays are not form-
      // expressible, so leg 2 settles on the equivalent shorthand schedule and
      // its hash divergence is documented in the baseline.
      const pp = fx.policy_parameters;
      const singleAdvance = Array.isArray(pp.advances) && pp.advances.length === 1 ? pp.advances[0] : null;
      const firstPayment = Array.isArray(pp.payments) && pp.payments.length ? pp.payments[0] : null;
      setVal(sandbox, 'loanAmount', singleAdvance ? String(singleAdvance.amount) : '');
      setVal(sandbox, 'paymentAmount', firstPayment ? String(firstPayment.amount) : '');
      setVal(sandbox, 'numPayments', String(Array.isArray(pp.payments) ? pp.payments.length : 1));
      setVal(sandbox, 'periodsPerYear', String(pp.periods_per_year ?? 12));
      setVal(sandbox, 'oddDays', '0');
      setVal(sandbox, 'unitPeriodDays', '30');
      setVal(sandbox, 'isCreditCard', 'no');
      setVal(sandbox, 'shortTermClaimed', 'no');
      for (const t of ART616_CHARGE_TYPES) setVal(sandbox, `c_${t}`, '0');
    },
  },
  // PR-2734-WEBMCP-CURE-1: the agent-payment-compliance-trail chain's six
  // direct-mode pages (art-01 is wrapper/prefill-bound, so it never appears
  // here). Adapters name each page's no-arg run wrapper and prefill fixture 0
  // into the page's own controls; where fixture 0's policy_parameters is {}
  // (art-10/art-62/art-104) the run path cannot reproduce the kernel golden's
  // empty-pp preimage and the leg-2 mismatch is baselined with a reason.
  'art-565-kya-x402-scope-verifier': {
    run: 'runCheck',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'credInput', JSON.stringify(pp.kya_credential ?? {}, null, 2));
      setVal(sandbox, 'payInput', JSON.stringify(pp.x402_payload ?? {}, null, 2));
    },
  },
  'art-585-sanctions-screening-evidence-pack': {
    run: 'runBindingCheck',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'ppQuery', pp.screening?.query ?? '');
      setVal(sandbox, 'ppDecision', pp.screening?.decision ?? '');
      setVal(sandbox, 'ppMatchCount', pp.screening?.match_count == null ? '' : String(pp.screening.match_count));
      setVal(sandbox, 'ppDatasetId', pp.dataset_ref?.dataset_id ?? '');
      setVal(sandbox, 'ppDatasetVersion', pp.dataset_ref?.version ?? '');
      setVal(sandbox, 'ppDigestAlgo', pp.dataset_ref?.digest_algo ?? '');
      setVal(sandbox, 'ppPublishedDigest', pp.dataset_ref?.published_digest ?? '');
      setVal(sandbox, 'ppCallerDigest', pp.caller_computed_digest ?? '');
    },
  },
  'art-699-x402-permit2-evidence-recomputer': {
    run: 'run',
    prefill(sandbox, fx) {
      setVal(sandbox, 'ppInput', JSON.stringify(fx.policy_parameters, null, 2));
    },
  },
  'art-10-amla-transaction-typology-risk-scorer': {
    run: 'runScoring',
    prefill(sandbox, fx) {
      // fixture 0 carries {} (the kernel's default-scenario path); load the
      // page's own structuring scenario so the form path still runs end-to-end.
      if (typeof sandbox.loadScenario === 'function') sandbox.loadScenario('structuring');
      // the six weight sliders carry their defaults only as HTML value
      // attributes, which the element stubs do not reproduce — set them so
      // runScoring's bare parseFloat() calls never see NaN.
      setVal(sandbox, 'wStructuring', '1.0');
      setVal(sandbox, 'wLayering', '1.0');
      setVal(sandbox, 'wFunnel', '1.0');
      setVal(sandbox, 'wRoundtrip', '1.0');
      setVal(sandbox, 'wVelocity', '1.0');
      setVal(sandbox, 'wTravelRule', '1.2');
    },
  },
  'art-104-tfr-travel-rule-batch-validator': {
    run: 'run',
    prefill(sandbox, fx) {
      setVal(sandbox, 'transfer_batch', '[]');
      setVal(sandbox, 'tfr_threshold', '1000');
    },
  },
  // WEBMCP-LEG1-TODO-ART100-105-1: the five leg-1 carryover repoints. Every
  // fixture 0 carries {} (each kernel's default-inputs path); the pages' empty
  // forms exercise that same path through their own controls, so the prefills
  // stay empty like art-62's. Each getPP() always emits the full control shape,
  // so the leg-2 form preimage cannot equal the golden {} preimage; every
  // mismatch is baselined with a measured reason.
  'art-100-mica-casp-authorization-readiness': {
    run: 'run',
    prefill(sandbox) {
      // fixture 0 carries {} (the grade-F all-missing default-scenario path);
      // no services checked + selects at 'none' is the same path through the
      // page's own controls.
    },
  },
  'art-101-mica-art67-own-funds-calculator': {
    run: 'run',
    prefill(sandbox) {
      // fixture 0 carries {} (the permanent-minimum binding-basis path); the
      // empty form is that same path through the page's own controls.
    },
  },
  'art-102-crypto-asset-whitepaper-linter': {
    run: 'run',
    prefill(sandbox) {
      // fixture 0 carries {}; the empty form is the kernel's default path
      // through the page's own controls.
    },
  },
  'art-103-mar-crypto-surveillance-readiness': {
    run: 'run',
    prefill(sandbox) {
      // fixture 0 carries {}; the empty form is the kernel's default path
      // through the page's own controls.
    },
  },
  'art-105-mica-token-service-scoper': {
    run: 'run',
    prefill(sandbox) {
      // fixture 0 carries {}; the empty form is the kernel's default path
      // through the page's own controls.
    },
  },
  'art-62-ap2-payment-receipt-verifier': {
    run: 'run',
    prefill(sandbox) {
      // fixture 0 carries {} (the kernel's rejected-inputs path); the form's
      // empty fields exercise that same path through the page's own controls.
    },
  },
  // PR-3262-DIRECT-REG-CURE-1: the two manifest-repointed FIX-MANIFEST pages
  // (WEBMCP-FN-SHAPE-LEG-2). Their adapters map fixture policy_parameters onto
  // the pages' own controls; with fixture 0's empty pp both run the pages'
  // default tier / rejected-inputs paths through the real controls.
  'art-203-embedded-license-selector': {
    run: 'runSelector',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      // the selects drive booleans via value === 'yes'; 'no' is the page's
      // explicit all-false tier (fixture 0's empty-input default).
      setVal(sandbox, 'commercialSel', pp.commercial_use ? 'yes' : 'no');
      setVal(sandbox, 'displaySel', pp.public_display ? 'yes' : 'no');
      setVal(sandbox, 'sharingSel', pp.allow_sharing ? 'yes' : 'no');
    },
  },
  'art-204-license-compatibility-checker': {
    run: 'runChecker',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      // '' (not undefined) so runChecker's .trim() sees the page's empty-form
      // rejected-inputs path, matching fixture 0's {} default.
      setVal(sandbox, 'parentIn', pp.parent_license ?? '');
      setVal(sandbox, 'childIn', pp.child_license ?? '');
    },
  },
  // PR-3348-DIRECT-REG-CURE-1: the three manifest-repointed FIX-MANIFEST pages
  // (WEBMCP-FN-SHAPE-LEG-3). Adapters map fixture policy_parameters onto the
  // pages' own controls; where fixture 0's pp is {} or omits a key the form
  // path always emits (collectPP/getPP defaults), the run-path pp cannot
  // reproduce the kernel golden's raw-pp preimage and the leg-2 mismatch is
  // baselined with a reason.
  'art-206-rights-record-builder': {
    run: 'runBuilder',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      // collectPP() always returns the full row shape (territory/renewal
      // defaults, rights_vector from rvState), so fixture 0's {} preimage is
      // not form-reproducible; empty controls exercise the page's own
      // empty-input path.
      setVal(sandbox, 'assetRef', pp.asset_ref ?? '');
      setVal(sandbox, 'licensor', pp.licensor ?? '');
      setVal(sandbox, 'licensee', pp.licensee ?? '');
      setVal(sandbox, 'licenseId', pp.license_id ?? '');
      setVal(sandbox, 'territory', pp.territory ?? '');
      setVal(sandbox, 'termYears', pp.term_years === undefined ? '' : String(pp.term_years));
      setVal(sandbox, 'renewal', pp.renewal ?? '');
    },
  },
  'art-280-reserve-proof-verifier': {
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      // getPP() always returns {exchange, merkle_proof, storage_proof_composition}
      // (por_round only when its controls are filled), so fixture 0's {}
      // preimage is not form-reproducible; empty controls run the page's
      // empty-form path.
      setVal(sandbox, 'exchange', pp.exchange ?? '');
      setVal(sandbox, 'merkle_proof', pp.merkle_proof === undefined ? '' : JSON.stringify(pp.merkle_proof, null, 2));
    },
  },
  'art-284-did-webvh-log-verifier': {
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      // getPP() always adds max_entries (control default 100), which fixture
      // 0's pp omits, so the golden preimage is not form-reproducible; the
      // fixture's did/did_log are served through the page's real controls.
      setVal(sandbox, 'did', pp.did ?? '');
      setVal(sandbox, 'logInput', JSON.stringify(pp.did_log ?? [], null, 2));
      setVal(sandbox, 'max_entries', pp.max_entries === undefined ? '' : String(pp.max_entries));
    },
  },
  // PR-3349-DIRECT-REG-CURE-1: the four manifest-repointed FIX-MANIFEST pages
  // (WEBMCP-FN-SHAPE-LEG-4). Adapters map fixture policy_parameters onto the
  // pages' own controls; where fixture 0's pp is {} and the form path always
  // emits a full row shape (getPP defaults), the run-path pp cannot reproduce
  // the kernel golden's raw-pp preimage and the leg-2 mismatch is baselined
  // with a reason.
  'art-286-anchored-extract-verifier': {
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      // getPP() always returns the full row shape (extract with parsed
      // merkle_path, claimed_root, source_class, anchor_evidence), so fixture
      // 0's {} preimage is not form-reproducible; empty controls run the
      // page's own empty-input path (the fixture's REFUSED_UNANCHORED
      // no-anchor default).
      setVal(sandbox, 'leaf_content_hash', pp.extract?.leaf_content_hash ?? '');
      setVal(sandbox, 'merkle_path', pp.extract?.merkle_path === undefined ? '' : JSON.stringify(pp.extract.merkle_path));
      setVal(sandbox, 'claimed_root', pp.claimed_root ?? '');
      setVal(sandbox, 'source_class', pp.source_class ?? '');
    },
  },
  'art-287-revocation-status-verifier': {
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      // getPP() returns {} verbatim when has_status is 'no', so fixture 0's
      // absent-credential_status no-signal preimage IS form-reproducible;
      // with a credential_status present the four controls carry the fixture
      // values through the page's real form path.
      if (!pp.credential_status) { setVal(sandbox, 'has_status', 'no'); return; }
      setVal(sandbox, 'has_status', 'yes');
      setVal(sandbox, 'status_list_credential_url', pp.credential_status.statusListCredential ?? '');
      setVal(sandbox, 'status_list_index', pp.credential_status.statusListIndex === undefined || pp.credential_status.statusListIndex === null ? '' : String(pp.credential_status.statusListIndex));
      setVal(sandbox, 'status_type', pp.credential_status.type ?? '');
      setVal(sandbox, 'encoded_list', pp.status_list_credential?.encodedList ?? '');
    },
  },
  'art-291-screen-onledger-transfer-batch': {
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      // getPP() parses the transfers JSON textarea, splits flagged_names on
      // commas and reads the profile control; fixture 0's three members
      // round-trip through those controls, so the golden preimage is
      // form-reproducible.
      setVal(sandbox, 'transfers', JSON.stringify(pp.transfers ?? []));
      setVal(sandbox, 'flagged_names', ((pp.screening_lists_meta ?? {}).flagged_names ?? []).join(', '));
      setVal(sandbox, 'profile', pp.profile ?? '');
    },
  },
  'art-292-attest-settlement-orchestrator': {
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      // getPP() reads the orchestrator_manifest trio, the decision_policy_ref,
      // the kernel_bindings JSON textarea and the transport control; fixture
      // 0's pp round-trips through all of them, so the golden preimage is
      // form-reproducible.
      setVal(sandbox, 'orch_name', (pp.orchestrator_manifest ?? {}).name ?? '');
      setVal(sandbox, 'orch_version', (pp.orchestrator_manifest ?? {}).version ?? '');
      setVal(sandbox, 'orch_description', (pp.orchestrator_manifest ?? {}).description ?? '');
      setVal(sandbox, 'decision_policy_ref', pp.decision_policy_ref ?? '');
      setVal(sandbox, 'kernel_bindings', JSON.stringify(pp.kernel_bindings ?? [], null, 2));
      setVal(sandbox, 'transport', pp.transport ?? '');
    },
  },
  // ── leg 5 (WEBMCP-FN-SHAPE-LEG-5-1) pages: fixture-0 prefills for the 13
  // repointed manifests. run-wrapper names and control ids read straight from
  // each page's own pp-collection code; JSON textareas stay JSON, numbers
  // arrive as strings, checkboxes flip .checked.
  'art-317-rhc-multiplier-reconciler': {
    run: 'runReconciler',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'eventLog', JSON.stringify(pp.event_log, null, 2));
      setVal(sandbox, 'actionType', pp.declared_action?.type ?? '');
      setVal(sandbox, 'declaredRatio', String(pp.declared_action?.ratio ?? ''));
      setVal(sandbox, 'exDate', pp.declared_action?.ex_date ?? '');
      setVal(sandbox, 'priorMult', String(pp.prior_multiplier));
      setVal(sandbox, 'currentMult', String(pp.current_multiplier));
      setVal(sandbox, 'rawBefore', String(pp.raw_balance_before));
      setVal(sandbox, 'rawAfter', String(pp.raw_balance_after));
    },
  },
  'art-320-rhc-collateral-haircut': {
    run: 'runHaircut',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'positionValue', String(pp.position_value));
      setVal(sandbox, 'baseHaircut', String(pp.base_haircut));
      setVal(sandbox, 'feedTimestamp', String(pp.feed_round?.timestamp ?? ''));
      setVal(sandbox, 'heartbeatSeconds', String(pp.feed_round?.heartbeat_seconds ?? ''));
      setVal(sandbox, 'currentTime', String(pp.current_time));
      sandbox.document.getElementById('sequencerUp').checked = pp.sequencer_uptime?.is_up ?? false;
      setVal(sandbox, 'sequencerSince', String(pp.sequencer_uptime?.since_timestamp ?? ''));
      setVal(sandbox, 'graceSeconds', String(pp.sequencer_uptime?.grace_period_seconds ?? ''));
      sandbox.document.getElementById('underlyingHalted').checked = pp.underlying_market_state?.is_halted ?? false;
    },
  },
  'art-321-rhc-bold-finality-classifier': {
    run: 'runClassifier',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'l2Inclusion', String(pp.l2_inclusion_timestamp));
      sandbox.document.getElementById('batchPosted').checked = pp.batch_posted_to_l1 ?? false;
      sandbox.document.getElementById('assertionCreated').checked = pp.assertion_created ?? false;
      setVal(sandbox, 'assertionTimestamp', String(pp.assertion_created_timestamp));
      setVal(sandbox, 'challengeWindow', String(pp.challenge_window_seconds ?? ''));
      setVal(sandbox, 'currentTime', String(pp.current_time));
      setVal(sandbox, 'finalityClaim', pp.finality_claim ?? '');
    },
  },
  'art-322-rhc-ap-redemption-stress': {
    // runStress hardcodes issuer_credit.rating_available to false — the page's
    // own shape; fixture 0 also carries rating_available false, so the form pp
    // round-trips everything the form can express.
    run: 'runStress',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'apList', JSON.stringify(pp.authorised_participants, null, 2));
      setVal(sandbox, 'dailyVolume', String(pp.secondary_market_depth?.daily_volume_usd ?? ''));
      setVal(sandbox, 'spreadBps', String(pp.secondary_market_depth?.bid_ask_spread_bps ?? ''));
      setVal(sandbox, 'obligor', pp.issuer_credit?.obligor ?? '');
    },
  },
  'art-324-tvm-npv': {
    run: 'runCompute',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'mode', pp.mode ?? 'periods');
      setVal(sandbox, 'discountRate', String(pp.discount_rate_pct ?? ''));
      setVal(sandbox, 'dayCount', pp.day_count_convention ?? '');
      setVal(sandbox, 'valuationDate', pp.valuation_date ?? '');
      setVal(sandbox, 'cashFlows', (pp.cash_flows ?? []).map((cf) => cf.t === undefined ? String(cf.amount) : String(cf.amount) + ', ' + String(cf.t)).join('\n'));
    },
  },
  'art-325-tvm-irr': {
    // readInputs always emits bracket_lo/bracket_hi/tolerance/max_iterations
    // (page defaults); the controls stay at their HTML defaults so the leg
    // runs the page's own solver controls end-to-end.
    run: 'runCompute',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'cashFlows', (pp.cash_flows ?? []).map((cf) => String(cf.amount)).join('\n'));
    },
  },
  'art-326-tvm-xirr': {
    // Dates-mode rows ("amount, date"); the solver controls stay at their HTML
    // defaults for the same reason as art-325.
    run: 'runCompute',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'cashFlows', (pp.cash_flows ?? []).map((cf) => String(cf.amount) + ', ' + String(cf.date ?? '')).join('\n'));
    },
  },
  'art-328-tvm-breakeven': {
    run: 'runCompute',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'fixedCosts', String(pp.fixed_costs ?? ''));
      setVal(sandbox, 'pricePerUnit', String(pp.price_per_unit ?? ''));
      setVal(sandbox, 'varCostPerUnit', String(pp.variable_cost_per_unit ?? ''));
      setVal(sandbox, 'currentUnits', pp.current_units === undefined ? '' : String(pp.current_units));
    },
  },
  'art-329-tvm-bond-duration': {
    run: 'runCompute',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'faceValue', String(pp.face_value ?? ''));
      setVal(sandbox, 'couponRatePct', String(pp.coupon_rate_pct ?? ''));
      setVal(sandbox, 'ytmPct', String(pp.ytm_pct ?? ''));
      setVal(sandbox, 'yearsToMaturity', String(pp.years_to_maturity ?? ''));
      setVal(sandbox, 'periodsPerYear', String(pp.periods_per_year ?? ''));
      setVal(sandbox, 'dayCount', pp.day_count_convention ?? '');
    },
  },
  'art-348-score-credit-model-quantized': {
    // The quantized scorer's input surface is the 10-element int8-normalized
    // vector; the page reads one #feat<i> control per element.
    run: 'runCompute',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      (pp.normalized_fixp16 ?? []).forEach((v, i) => {
        setVal(sandbox, 'feat' + i, String(v));
      });
    },
  },
  'art-361-camera-provenance-check': {
    // readPp rebuilds assertions in ITS own order (hash.data first, actions
    // second) from the two boolean selects plus digital_source_type; fixture 0
    // stores actions-first, which the form order cannot express.
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'manifest_digest', pp.manifest_digest ?? '');
      setVal(sandbox, 'claim_generator', pp.claim_generator ?? '');
      setVal(sandbox, 'claim_format', pp.claim?.format ?? '');
      setVal(sandbox, 'claim_instance_id', pp.claim?.instanceID ?? '');
      const labels = (pp.assertions ?? []).map((a) => a.label);
      setVal(sandbox, 'has_hard_binding', labels.includes('c2pa.hash.data') ? 'true' : 'false');
      setVal(sandbox, 'has_actions', labels.includes('c2pa.actions') ? 'true' : 'false');
      const action = (pp.assertions ?? []).find((a) => a.label === 'c2pa.actions');
      setVal(sandbox, 'digital_source_type', ((action?.actions ?? [])[0] ?? {}).digitalSourceType ?? '');
      setVal(sandbox, 'sig_present', String(pp.signature?.present ?? false));
      setVal(sandbox, 'sig_alg', pp.signature?.alg ?? '');
    },
  },
  'art-374-test-nav-error-materiality': {
    // getPP builds materiality_policy/affected_period only from non-blank
    // controls (fixture 0 carries neither) and reads the two NAV-per-share
    // controls as raw strings; the threshold/policy/period/shares controls
    // stay blank so those optional members stay absent.
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'fund_id', pp.fund_id ?? '');
      setVal(sandbox, 'valuation_date', pp.valuation_date ?? '');
      setVal(sandbox, 'erroneous_nav_per_share', pp.erroneous_nav_per_share === undefined || pp.erroneous_nav_per_share === null ? '' : String(pp.erroneous_nav_per_share));
      setVal(sandbox, 'corrected_nav_per_share', pp.corrected_nav_per_share === undefined || pp.corrected_nav_per_share === null ? '' : String(pp.corrected_nav_per_share));
    },
  },
  'art-373-recompute-fund-nav': {
    // getPP always emits the accruals member ({income,expense} parsed from the
    // two accruals textareas, [] each on blank) and reads shares_outstanding
    // as a raw control string; fixture 0 omits accruals and carries
    // shares_outstanding as a number, so the run-path preimage cannot equal
    // the golden (baselined). The two optional lineage-ref controls stay
    // blank: blank parses to null and contributes no pp member at all
    // (NAV-LIN-WIRE-1), byte-identical to the pre-lineage form shape.
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'fund_id', pp.fund_id ?? '');
      setVal(sandbox, 'valuation_date', pp.valuation_date ?? '');
      setVal(sandbox, 'base_currency', pp.base_currency ?? '');
      setVal(sandbox, 'holdings', pp.holdings === undefined ? '' : JSON.stringify(pp.holdings, null, 2));
      setVal(sandbox, 'liabilities', pp.liabilities === undefined ? '' : JSON.stringify(pp.liabilities, null, 2));
      setVal(sandbox, 'shares_outstanding', pp.shares_outstanding === undefined || pp.shares_outstanding === null ? '' : String(pp.shares_outstanding));
      setVal(sandbox, 'decimal_places', pp.rounding?.decimal_places === undefined || pp.rounding?.decimal_places === null ? '' : String(pp.rounding.decimal_places));
      setVal(sandbox, 'rounding_mode', pp.rounding?.mode ?? '');
    },
  },
  'art-375-compute-fund-expense-ratios': {
    // getPP emits average_net_assets as the raw control string while fixture 0
    // carries a number, so the run-path pp cannot equal the golden (baselined);
    // blank optional ids fold to null exactly as getPP does on an empty form.
    run: 'run',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'fund_id', pp.fund_id ?? '');
      setVal(sandbox, 'period_start', pp.period_start ?? '');
      setVal(sandbox, 'period_end', pp.period_end ?? '');
      setVal(sandbox, 'average_net_assets', pp.average_net_assets === undefined || pp.average_net_assets === null ? '' : String(pp.average_net_assets));
      setVal(sandbox, 'gross_expense_components', pp.gross_expense_components === undefined ? '' : JSON.stringify(pp.gross_expense_components, null, 2));
      setVal(sandbox, 'waivers', pp.waivers === undefined ? '' : JSON.stringify(pp.waivers, null, 2));
      setVal(sandbox, 'decimal_places', pp.rounding?.decimal_places === undefined || pp.rounding?.decimal_places === null ? '' : String(pp.rounding.decimal_places));
      setVal(sandbox, 'rounding_mode', pp.rounding?.mode ?? '');
    },
  },
  'art-380-build-ai-workpaper-record': {
    // runWorkpaperRecord appends reviewer_identity_id/reviewer_ha_role as ''
    // (empty controls) and stamps result.generated_at from the wall clock
    // after computeWorkpaperRecord returns; fixture 0 omits both reviewer
    // keys, so the run-path pp cannot equal the golden (baselined).
    run: 'runWorkpaperRecord',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'receiptToolId', pp.receipt_tool_id ?? '');
      setVal(sandbox, 'receiptToolVersion', pp.receipt_tool_version ?? '');
      setVal(sandbox, 'receiptExecHash', pp.receipt_execution_hash ?? '');
      setVal(sandbox, 'receiptKernelDigest', pp.receipt_kernel_digest ?? '');
      setVal(sandbox, 'receiptGeneratedAt', pp.receipt_generated_at ?? '');
      setVal(sandbox, 'determinismClass', pp.determinism_class ?? '');
      setVal(sandbox, 'declaredConventions', pp.declared_conventions ?? '');
      setVal(sandbox, 'standardRef', pp.documentation_standard_ref ?? '');
      setVal(sandbox, 'engagementId', pp.engagement_id ?? '');
      setVal(sandbox, 'reportingPeriod', pp.reporting_period ?? '');
      setVal(sandbox, 'reviewerRole', pp.reviewer_role ?? '');
      setVal(sandbox, 'reviewerStatement', pp.reviewer_statement ?? '');
      setVal(sandbox, 'previousHash', pp.previous_workpaper_hash ?? '');
      setVal(sandbox, 'reviewerIdentityId', pp.reviewer_identity_id ?? '');
      setVal(sandbox, 'reviewerHaRole', pp.reviewer_ha_role ?? '');
    },
  },
  'art-397-lint-trace-cat-reports': {
    // runCompute builds one DEMO cat_event (event_type NEW_ORDER, firm
    // FIRM-1, symbol DEMO, side BUY) and hardcodes calendar_version and the
    // weekend days; fixture 0's event carries different members, so the
    // run-path pp cannot equal the golden (baselined). Holidays are a
    // comma-separated control; blank folds to [].
    run: 'runCompute',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'execTs', pp.execution_timestamp ?? '');
      setVal(sandbox, 'repTs', pp.report_timestamp ?? '');
      setVal(sandbox, 'holidays', Array.isArray(pp.calendar?.holidays) ? pp.calendar.holidays.join(',') : '');
      setVal(sandbox, 'hStart', pp.trading_hours?.start_minutes_utc === undefined ? '' : String(pp.trading_hours.start_minutes_utc));
      setVal(sandbox, 'hEnd', pp.trading_hours?.end_minutes_utc === undefined ? '' : String(pp.trading_hours.end_minutes_utc));
      setVal(sandbox, 'winMin', pp.report_window_minutes === undefined ? '' : String(pp.report_window_minutes));
      const ev = Array.isArray(pp.cat_events) ? pp.cat_events[0] : undefined;
      setVal(sandbox, 'catCat', ev?.event_category ?? '');
      setVal(sandbox, 'catTs', ev?.event_timestamp ?? '');
      setVal(sandbox, 'catQty', ev?.quantity === undefined ? '' : String(ev.quantity));
      setVal(sandbox, 'catStrike', ev?.strike_price === undefined ? '' : String(ev.strike_price));
    },
  },
  'art-398-lint-metro2-record': {
    // Checkboxes flip .checked (house rule); blank optional dofd folds to
    // undefined exactly as the wrapper's `value || undefined` does.
    run: 'runLint',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'accountType', pp.account_type ?? '');
      setVal(sandbox, 'dateOpened', pp.date_opened ?? '');
      setVal(sandbox, 'dateReported', pp.date_reported ?? '');
      setVal(sandbox, 'currentBalance', pp.current_balance === undefined || pp.current_balance === null ? '' : String(pp.current_balance));
      setVal(sandbox, 'amountPastDue', pp.amount_past_due === undefined || pp.amount_past_due === null ? '' : String(pp.amount_past_due));
      setVal(sandbox, 'accountStatus', pp.account_status ?? '');
      setVal(sandbox, 'paymentRating', pp.payment_rating ?? '');
      setVal(sandbox, 'dofd', pp.date_of_first_delinquency ?? '');
      sandbox.document.getElementById('hasJ1').checked = pp.has_j1_segment ?? false;
      sandbox.document.getElementById('hasJ2').checked = pp.has_j2_segment ?? false;
      sandbox.document.getElementById('hasK').checked = pp.has_k_segment ?? false;
    },
  },
  'art-402-validate-regf-call-frequency': {
    // The wrapper nests the calls JSON and the tz offset under pp.inputs;
    // JSON.parse(JSON.stringify(...)) round-trips fixture arrays exactly.
    run: 'runCheck',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'tzOffset', pp.inputs?.timezone_offset_minutes === undefined ? '' : String(pp.inputs.timezone_offset_minutes));
      setVal(sandbox, 'callsJson', pp.inputs?.calls === undefined ? '' : JSON.stringify(pp.inputs.calls, null, 2));
    },
  },
  'art-426-cecl-ecl-calculator': {
    // JSON textareas stay JSON; the three balance controls run through the
    // page's safe(value, 0) numeric parse, so they arrive as Strings.
    run: 'runCecl',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'methodSel', pp.method ?? '');
      setVal(sandbox, 'constantsVersion', pp.constants_version ?? '');
      setVal(sandbox, 'priorAllowance', pp.prior_allowance_balance_usd === undefined || pp.prior_allowance_balance_usd === null ? '' : String(pp.prior_allowance_balance_usd));
      setVal(sandbox, 'chargeOffs', pp.charge_offs_usd === undefined || pp.charge_offs_usd === null ? '' : String(pp.charge_offs_usd));
      setVal(sandbox, 'recoveries', pp.recoveries_usd === undefined || pp.recoveries_usd === null ? '' : String(pp.recoveries_usd));
      setVal(sandbox, 'forecastWeightsJson', pp.forecast_weights === undefined ? '' : JSON.stringify(pp.forecast_weights, null, 2));
      setVal(sandbox, 'segmentsJson', pp.segments === undefined ? '' : JSON.stringify(pp.segments, null, 2));
    },
  },
  'art-429-var-backtest-traffic-light': {
    // The page reads observation rows OUT of the DOM (readObservations over
    // #obsRows children, .obs-date/.obs-pnl/.obs-var cells), so the adapter
    // serves fixture rows through a getElementById override — the same list
    // a human builds with the add-row button.
    run: 'runBacktest',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      const rows = (pp.observations ?? []).map((o) => ({
        querySelector(sel) {
          const v = sel === '.obs-date' ? o.date : sel === '.obs-pnl' ? o.pnl : o.var_estimate;
          return { value: String(v) };
        },
      }));
      const realGet = sandbox.document.getElementById.bind(sandbox.document);
      sandbox.document.getElementById = (sel) => (sel === 'obsRows' ? { children: rows } : realGet(sel));
    },
  },
  'art-431-fdic-assessment-rate-calculator': {
    // The page reads bracket rows OUT of the DOM (readBrackets over
    // #bracketRows children, .bkt-max/.bkt-rate cells), so the adapter serves
    // fixture rows through a getElementById override; '' max folds to null.
    run: 'runCalc',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'scheduleVersion', pp.rate_schedule_version ?? '');
      setVal(sandbox, 'totalScore', pp.total_score === undefined || pp.total_score === null ? '' : String(pp.total_score));
      setVal(sandbox, 'unsecuredAdj', pp.unsecured_debt_adjustment_bp === undefined || pp.unsecured_debt_adjustment_bp === null ? '' : String(pp.unsecured_debt_adjustment_bp));
      setVal(sandbox, 'brokeredAdj', pp.brokered_deposit_adjustment_bp === undefined || pp.brokered_deposit_adjustment_bp === null ? '' : String(pp.brokered_deposit_adjustment_bp));
      setVal(sandbox, 'rateFloor', pp.rate_floor_bp === undefined || pp.rate_floor_bp === null ? '' : String(pp.rate_floor_bp));
      setVal(sandbox, 'rateCap', pp.rate_cap_bp === undefined || pp.rate_cap_bp === null ? '' : String(pp.rate_cap_bp));
      setVal(sandbox, 'assessmentBase', pp.assessment_base_musd === undefined || pp.assessment_base_musd === null ? '' : String(pp.assessment_base_musd));
      const rows = (pp.rate_brackets ?? []).map((b) => ({
        querySelector(sel) {
          const v = sel === '.bkt-max' ? b.max_score : b.base_rate_bp;
          return { value: v === null || v === undefined ? '' : String(v) };
        },
      }));
      const realGet = sandbox.document.getElementById.bind(sandbox.document);
      sandbox.document.getElementById = (sel) => (sel === 'bracketRows' ? { children: rows } : realGet(sel));
    },
  },
  'art-432-call-report-rc-balance-sheet': {
    // readField runs every amount through safeNum, so String(...)-fed controls
    // arrive as the fixture's numbers; entity/period are raw control strings.
    run: 'runMapper',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'entityIdInput', pp.entity_id ?? '');
      setVal(sandbox, 'periodInput', pp.reporting_period ?? '');
      setVal(sandbox, 'tolInput', pp.rounding_tolerance_usd === undefined || pp.rounding_tolerance_usd === null ? '' : String(pp.rounding_tolerance_usd));
      for (const k of ['cash_and_due_from_usd', 'securities_htm_usd', 'securities_afs_usd', 'loans_and_leases_net_usd', 'bank_premises_usd', 'other_assets_usd', 'total_deposits_usd', 'borrowings_usd', 'other_liabilities_usd', 'common_stock_usd', 'surplus_usd', 'retained_earnings_usd', 'aoci_usd']) {
        setVal(sandbox, k, pp[k] === undefined || pp[k] === null ? '' : String(pp[k]));
      }
    },
  },
  'art-433-call-report-rcr-capital': {
    // tier1_capital_usd is read as a raw control string and the five
    // min/buffer pct readField defaults always emit; fixture-0 pp omits all
    // six members, so the run-path pp cannot equal the golden (baselined).
    run: 'runMapper',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'entityIdInput', pp.entity_id ?? '');
      setVal(sandbox, 'periodInput', pp.reporting_period ?? '');
      setVal(sandbox, 'constVerInput', pp.constants_version ?? '');
      sandbox.document.getElementById('isGsibInput').checked = pp.is_gsib ?? false;
      for (const k of ['cet1_capital_usd', 'additional_tier1_capital_usd', 'tier2_capital_usd', 'total_rwa_usd', 'total_leverage_exposure_usd']) {
        setVal(sandbox, k, pp[k] === undefined || pp[k] === null ? '' : String(pp[k]));
      }
    },
  },
  'art-434-call-report-edit-check-gate': {
    // The two schedule payloads stay JSON textareas; parseJsonSafe round-trips
    // the fixture objects exactly (canon is key-order-insensitive), tolerance
    // via safeNum.
    run: 'runGate',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'rcInput', pp.rc_output_payload === undefined ? '' : JSON.stringify(pp.rc_output_payload, null, 2));
      setVal(sandbox, 'rcrInput', pp.rcr_output_payload === undefined ? '' : JSON.stringify(pp.rcr_output_payload, null, 2));
      setVal(sandbox, 'tolInput', pp.rounding_tolerance_usd === undefined || pp.rounding_tolerance_usd === null ? '' : String(pp.rounding_tolerance_usd));
    },
  },
  'art-435-bhc-schedule-hc-balance-sheet': {
    // Same shape as the RC sibling: readField runs every amount through
    // safeNum, entity/period are raw control strings.
    run: 'runMapper',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'entityIdInput', pp.entity_id ?? '');
      setVal(sandbox, 'periodInput', pp.reporting_period ?? '');
      setVal(sandbox, 'tolInput', pp.rounding_tolerance_usd === undefined || pp.rounding_tolerance_usd === null ? '' : String(pp.rounding_tolerance_usd));
      for (const k of ['cash_and_due_from_usd', 'securities_htm_usd', 'securities_afs_usd', 'loans_and_leases_net_usd', 'bank_premises_usd', 'other_assets_usd', 'total_deposits_usd', 'borrowings_usd', 'other_liabilities_usd', 'common_stock_usd', 'surplus_usd', 'retained_earnings_usd', 'aoci_usd']) {
        setVal(sandbox, k, pp[k] === undefined || pp[k] === null ? '' : String(pp[k]));
      }
    },
  },
  'art-436-bhc-schedule-hcr-capital': {
    // All amounts run through readField's numeric parse; is_gsib flips
    // .checked; constants_version is a raw control string.
    run: 'runCalc',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'entityIdInput', pp.entity_id ?? '');
      setVal(sandbox, 'periodInput', pp.reporting_period ?? '');
      setVal(sandbox, 'constantsVersionInput', pp.constants_version ?? '');
      sandbox.document.getElementById('isGsibInput').checked = pp.is_gsib ?? false;
      for (const k of ['cet1_capital_usd', 'additional_tier1_capital_usd', 'tier2_capital_usd', 'total_rwa_usd', 'total_leverage_exposure_usd', 'eslr_buffer_pct']) {
        setVal(sandbox, k, pp[k] === undefined || pp[k] === null ? '' : String(pp[k]));
      }
    },
  },
  'art-439-y14-capital-worksheet-rollforward': {
    // Nested pp groups (beginning_balances/additions/deductions/
    // published_scenario/cross_check) map one-to-one onto scalar controls;
    // every fixture member has a control, so the preimage can equal golden.
    run: 'runRollforward',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      const num = (v) => (v === undefined || v === null ? '' : String(v));
      setVal(sandbox, 'entityIdInput', pp.entity_id ?? '');
      setVal(sandbox, 'periodInput', pp.reporting_period ?? '');
      setVal(sandbox, 'constVerInput', pp.constants_version ?? '');
      setVal(sandbox, 'beg_cet1', num(pp.beginning_balances?.cet1));
      setVal(sandbox, 'beg_at1', num(pp.beginning_balances?.at1));
      setVal(sandbox, 'beg_t2', num(pp.beginning_balances?.t2));
      setVal(sandbox, 'add_cet1', num(pp.additions?.cet1));
      setVal(sandbox, 'add_at1', num(pp.additions?.at1));
      setVal(sandbox, 'add_t2', num(pp.additions?.t2));
      setVal(sandbox, 'ded_cet1', num(pp.deductions?.cet1));
      setVal(sandbox, 'ded_at1', num(pp.deductions?.at1));
      setVal(sandbox, 'ded_t2', num(pp.deductions?.t2));
      setVal(sandbox, 'scenarioName', pp.published_scenario?.name ?? '');
      setVal(sandbox, 'scenarioCitation', pp.published_scenario?.citation ?? '');
      setVal(sandbox, 'scen_cet1', num(pp.published_scenario?.cet1_adjustment_usd));
      setVal(sandbox, 'scen_at1', num(pp.published_scenario?.at1_adjustment_usd));
      setVal(sandbox, 'scen_t2', num(pp.published_scenario?.t2_adjustment_usd));
      setVal(sandbox, 'ref_total_capital', num(pp.cross_check?.reported_total_capital_usd));
      setVal(sandbox, 'tolerance', num(pp.cross_check?.tolerance_usd));
    },
  },
  'art-446-counterparty-internal-limit-check': {
    // The page reads counterparty rows OUT of the DOM (#cpRows children: one
    // text input, one select, three number inputs), so the adapter serves
    // fixture rows through a getElementById override. The fixture rows'
    // counterparty_name has no row control and stays out of the run-path pp
    // (baselined).
    run: 'runCheck',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      const rows = (pp.counterparties ?? []).map((c) => ({
        querySelector(sel) {
          if (sel === 'input[type="text"]') return { value: c.counterparty_id ?? '' };
          return { value: c.limit_type ?? '' };
        },
        querySelectorAll(sel) {
          const vals = sel === 'input[type="number"]'
            ? [c.approved_limit_musd, c.current_exposure_musd, c.warning_threshold_pct]
            : [];
          return vals.map((v) => ({ value: v === null || v === undefined ? '' : String(v) }));
        },
      }));
      const realGet = sandbox.document.getElementById.bind(sandbox.document);
      sandbox.document.getElementById = (sel) => (sel === 'cpRows' ? { children: rows } : realGet(sel));
    },
  },
  'art-447-securitization-risk-retention-check': {
    // Amounts run through safe(..., 0); the three attestation flags flip
    // .checked; jurisdiction/method are raw control strings.
    run: 'runCheck',
    prefill(sandbox, fx) {
      const pp = fx.policy_parameters;
      setVal(sandbox, 'jurisdiction', pp.jurisdiction ?? '');
      setVal(sandbox, 'method', pp.retention_method ?? '');
      setVal(sandbox, 'totalExposure', pp.total_securitized_exposure_musd === undefined || pp.total_securitized_exposure_musd === null ? '' : String(pp.total_securitized_exposure_musd));
      setVal(sandbox, 'retained', pp.retained_amount_musd === undefined || pp.retained_amount_musd === null ? '' : String(pp.retained_amount_musd));
      sandbox.document.getElementById('qrm').checked = pp.all_exposures_qrm_qualified ?? false;
      sandbox.document.getElementById('solePurpose').checked = pp.retainer_is_sole_purpose_entity ?? false;
      sandbox.document.getElementById('hedged').checked = pp.retained_interest_hedged_or_sold ?? false;
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

/* ── same-change rule: the pieces a direct-eligible page must ship together ── */

/**
 * The pieces a direct-eligible page lacks. `leg1` is runDirectExecute's result:
 * an empty modelContext capture means the page carries no direct block; a missing
 * RUN_PATH_ADAPTERS entry is read straight from the table.
 */
export function missingDirectPieces(toolId, leg1, adapters = RUN_PATH_ADAPTERS) {
  const missing = [];
  if (!leg1.ok && /^page registered no WebMCP tool/.test(leg1.error || '')) {
    missing.push('the direct registration block on the page (generator: node scripts/gen-webmcp-registrations.mjs --direct)');
  }
  if (!adapters[toolId]) {
    missing.push(`a RUN_PATH_ADAPTERS entry for '${toolId}' in scripts/check-webmcp-direct-execute.mjs naming the page's no-arg run wrapper`);
  }
  return missing;
}

export function sameChangeFinding(manifestFile, missing) {
  return `manifest ${manifestFile} makes this page direct-eligible, but the same change must also ship: ${missing.join('; and ')}`;
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

    // Same-change rule: a page that is direct-eligible must carry its direct
    // block AND its RUN_PATH_ADAPTERS entry. One finding names the manifest and
    // every missing piece, instead of two leg messages a repointer must decode.
    const missing = missingDirectPieces(id, leg1);
    if (missing.length) {
      problems.push(`${page}: leg 1 (execute): ${sameChangeFinding(v.detail.manifest, missing)}`);
      continue;
    }
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

    // Same-change rule. RED: no direct block and no adapter => ONE finding naming
    // the manifest and both pieces. GREEN: block + adapter present => nothing.
    const noBlock = { ok: false, error: 'page registered no WebMCP tool (modelContext capture empty)' };
    const redMissing = missingDirectPieces('unwired_tool', noBlock);
    const redText = sameChangeFinding('manifests/unwired_tool.manifest.json', redMissing);
    if (redMissing.length !== 2 || !redText.includes('manifests/unwired_tool.manifest.json') || !redText.includes('direct registration block') || !redText.includes('RUN_PATH_ADAPTERS')) {
      fails.push(`same-change RED control expected one finding naming the manifest and both missing pieces, got: ${redText}`);
    }
    if (missingDirectPieces('selftest_tool', { ok: true })[0]) fails.push('same-change GREEN control (block + adapter present) expected no missing piece');

    // fn-exec probe. GREEN: returns a hashable object. RED: sync helper that returns nothing.
    const execGreen = await probeFunctionExecutes('<script>function compute(p) { return { output_payload: { echo: p.x } }; }</script>', 'compute', pp0, 2000);
    if (execGreen !== null) fails.push(`fn-exec GREEN control expected null, got: ${execGreen}`);
    const execRed = await probeFunctionExecutes('<script>function exportIt(p) { document.body.appendChild({}); }</script>', 'exportIt', pp0, 2000);
    if (execRed === null || !execRed.includes('returned undefined')) fails.push(`fn-exec RED control (returns nothing) expected a returned-undefined reason, got: ${execRed}`);

    // removeChild stub, leg 1: an execute path that removes a created node (the
    // export-helper pattern) must settle GREEN with the golden hash, not throw.
    writeFileSync(pageAbs, reg("var a = document.createElement('span'); document.body.removeChild(a); return { output_payload: { echo: p.x } };", greenRun));
    const l1rc = await runDirectExecute(pageAbs, 'selftest.html', pp0);
    const v1rc = await judgeDirectExecute(l1rc, realGolden, pp0);
    if (!v1rc.ok) fails.push(`self-test leg 1 removeChild control expected clean, got: ${v1rc.problem}`);
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
  console.log('✓ check-webmcp-direct-execute --self-test clean — leg-1 GREEN + hash-mismatch RED + never-settles RED; leg-2 GREEN + run-throw RED + wrong-hash RED + unwired-adapter fail-closed RED; same-change RED + GREEN; fn-exec RED + GREEN.');
}

const invokedAsMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  (SELFTEST ? selfTest() : main()).catch((e) => { console.error('✗ harness exception:', e); process.exitCode = 1; });
}
