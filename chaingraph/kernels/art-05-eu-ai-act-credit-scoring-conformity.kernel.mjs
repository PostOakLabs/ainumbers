// art-05 — EU AI Act Credit-Scoring Conformity Pack: pure decision kernel.
// Faithful port of the scoring logic in
//   repo/chaingraph/art-05-eu-ai-act-credit-scoring-conformity.html
// Pure: no DOM, no window, no network, no Date.now().
// EU AI Act Annex III Part 5(b) — full obligations apply 2027-12-02 (per Digital Omnibus, June 2026).

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-05-eu-ai-act-credit-scoring-conformity';
const TOOL_VERSION = '1.0.1';

// Bias thresholds (indicative — EEOC four-fifths rule + equalized-odds guidance)
const DIR_THRESHOLD    = 0.80; // disparate impact ratio lower bound
const EO_GAP_THRESHOLD = 5;    // max pp equalized-odds gap (TPR/FPR)
const DP_GAP_THRESHOLD = 10;   // max pp demographic-parity gap (informational only)

// Data governance checklist — Art. 10 (weights used in scoreChecklist)
const DATA_CHECKLIST = [
  { id:'d1', weight:2, article:'Art. 10(2)(f) · Annex IV §2' },
  { id:'d2', weight:1, article:'Art. 10(1) · Annex IV §2'    },
  { id:'d3', weight:2, article:'Art. 10(5)'                  },
  { id:'d4', weight:2, article:'Art. 10(2)(f)'               },
  { id:'d5', weight:1, article:'Art. 10(3)'                  },
  { id:'d6', weight:1, article:'Art. 10(6) · GDPR Art. 5(1)(c)' },
];

// Article/conformity checklist — Art. 9/11/13/14/15/49
const ART_CHECKLIST = [
  { id:'r1',   weight:2, article:'Art. 9'             },
  { id:'r2',   weight:1, article:'Art. 9(7)'          },
  { id:'t1',   weight:1, article:'Art. 11 · Annex IV §1' },
  { id:'t2',   weight:2, article:'Art. 11 · Annex IV §2' },
  { id:'t3',   weight:2, article:'Art. 11 · Annex IV §3' },
  { id:'t4',   weight:2, article:'Art. 11 · Annex IV §5' },
  { id:'t5',   weight:1, article:'Art. 11 · Annex IV §6' },
  { id:'tr1',  weight:1, article:'Art. 13'            },
  { id:'tr2',  weight:2, article:'Art. 13(3)(b)'      },
  { id:'tr3',  weight:1, article:'Art. 13(3)(c)'      },
  { id:'h1',   weight:2, article:'Art. 14(4)'         },
  { id:'h2',   weight:1, article:'Art. 14(5)'         },
  { id:'a1',   weight:2, article:'Art. 15(1)'         },
  { id:'a2',   weight:2, article:'Art. 15(3)'         },
  { id:'reg1', weight:1, article:'Art. 49(1)'         },
];

// ----- helpers ---------------------------------------------------------------

function computeBias(characteristics) {
  return (characteristics ?? []).map(c => {
    const groups = (c.groups ?? []).filter(g => g.label && g.approval != null);
    if (groups.length < 2) {
      return { name: c.name ?? '', skipped: true, reason: 'Need ≥2 groups' };
    }
    const approvals = groups.map(g => Number(g.approval));
    const minApproval = Math.min(...approvals);
    const maxApproval = Math.max(...approvals);
    const dir   = maxApproval > 0 ? minApproval / maxApproval : 1;
    const dpGap = maxApproval - minApproval;

    const tprs   = groups.map(g => g.tpr).filter(v => v != null).map(Number);
    const fprs   = groups.map(g => g.fpr).filter(v => v != null).map(Number);
    const tprGap = tprs.length >= 2 ? Math.max(...tprs) - Math.min(...tprs) : null;
    const fprGap = fprs.length >= 2 ? Math.max(...fprs) - Math.min(...fprs) : null;

    const dirFail = dir < DIR_THRESHOLD;
    const tprFail = tprGap !== null && tprGap > EO_GAP_THRESHOLD;
    const fprFail = fprGap !== null && fprGap > EO_GAP_THRESHOLD;
    const dpFail  = dpGap > DP_GAP_THRESHOLD;

    const failing = [];
    if (dirFail) failing.push(`DIR ${dir.toFixed(3)} < ${DIR_THRESHOLD} (adverse impact)`);
    if (tprFail) failing.push(`TPR gap ${tprGap.toFixed(1)}pp > ${EO_GAP_THRESHOLD}pp`);
    if (fprFail) failing.push(`FPR gap ${fprGap.toFixed(1)}pp > ${EO_GAP_THRESHOLD}pp`);
    if (dpFail && !dirFail) failing.push(`Approval gap ${dpGap.toFixed(1)}pp > ${DP_GAP_THRESHOLD}pp`);

    return {
      name: c.name ?? '', skipped: false,
      dir: parseFloat(dir.toFixed(4)),
      dp_gap: parseFloat(dpGap.toFixed(2)),
      tpr_gap: tprGap !== null ? parseFloat(tprGap.toFixed(2)) : null,
      fpr_gap: fprGap !== null ? parseFloat(fprGap.toFixed(2)) : null,
      dir_fail: dirFail, tpr_fail: tprFail, fpr_fail: fprFail, dp_fail: dpFail,
      // dp_fail does NOT contribute to anyFail — informational only
      any_fail: dirFail || tprFail || fprFail,
      failing,
    };
  });
}

function scoreChecklist(items, answers) {
  let earned = 0, total = 0;
  const missing = [];
  for (const item of items) {
    total += item.weight;
    if (answers[item.id] === true) earned += item.weight;
    else if (answers[item.id] === false) missing.push(item);
    // null/undefined → not answered, not counted
  }
  return { score: total > 0 ? earned / total : 1, earned, total, missing };
}

// ----- public API ------------------------------------------------------------

/**
 * compute(pp) — pure EU AI Act credit-scoring conformity engine.
 * pp: {
 *   characteristics?: Array<{
 *     name: string,
 *     groups: Array<{ label: string, approval: number, tpr?: number, fpr?: number }>
 *   }>,
 *   data_answers?:  Record<string, boolean|null>,  // d1–d6
 *   art_answers?:   Record<string, boolean|null>,  // r1, r2, t1–t5, tr1–tr3, h1, h2, a1, a2, reg1
 *   sys_name?:      string,
 *   sys_use_case?:  string,
 *   sys_deployment?: string,
 * }
 */
export function compute(pp) {
  const dataAnswers = pp.data_answers ?? {};
  const artAnswers  = pp.art_answers  ?? {};

  const biasResults  = computeBias(pp.characteristics ?? []);
  const dataScore    = scoreChecklist(DATA_CHECKLIST, dataAnswers);
  const artScore     = scoreChecklist(ART_CHECKLIST,  artAnswers);

  const anyBiasFail        = biasResults.some(b => !b.skipped && b.any_fail);
  const highWeightDataFail = DATA_CHECKLIST.filter(i => i.weight > 1).some(i => dataAnswers[i.id] === false);
  const highWeightArtFail  = ART_CHECKLIST.filter(i => i.weight > 1).some(i => artAnswers[i.id] === false);

  let determination;
  if (anyBiasFail || highWeightDataFail || highWeightArtFail) determination = 'FAIL';
  else if (dataScore.score < 0.85 || artScore.score < 0.85)  determination = 'WARN';
  else                                                         determination = 'PASS';

  // Build failing_dimensions array (bias first, then checklist)
  const failing_dimensions = [];
  for (const br of biasResults) {
    if (br.skipped || !br.any_fail) continue;
    for (const msg of br.failing) {
      failing_dimensions.push({
        dimension: `Bias — ${br.name}`,
        detail: msg,
        article: 'EU AI Act Art. 10(5) · 15(3)',
      });
    }
  }
  for (const item of dataScore.missing) {
    failing_dimensions.push({
      dimension: `Data governance — ${item.id.toUpperCase()}`,
      detail: `Checklist item not met`,
      article: item.article,
    });
  }
  for (const item of artScore.missing) {
    failing_dimensions.push({
      dimension: `Conformity checklist — ${item.id.toUpperCase()}`,
      detail: `Checklist item not met`,
      article: item.article,
    });
  }

  const output_payload = {
    determination,
    bias_results: biasResults.map(b => ({
      characteristic: b.name,
      skipped:        b.skipped ?? false,
      dir:            b.dir ?? null,
      dir_pass:       b.dir_fail === undefined ? null : !b.dir_fail,
      tpr_gap:        b.tpr_gap ?? null,
      tpr_pass:       b.tpr_fail === undefined ? null : !b.tpr_fail,
      fpr_gap:        b.fpr_gap ?? null,
      fpr_pass:       b.fpr_fail === undefined ? null : !b.fpr_fail,
      any_fail:       b.any_fail ?? false,
    })),
    data_governance_score_pct: Math.round(dataScore.score * 100),
    art_checklist_score_pct:   Math.round(artScore.score  * 100),
    failing_dimensions,
    applicable_deadline:       '2027-12-02',
    applicable_deadline_note:  'EU AI Act Annex III Part 5(b) — credit-scoring high-risk obligations fully apply 2 December 2027, per the Digital Omnibus amendments (Parliament final approval, June 2026)',
    regulatory_framework:      'EU AI Act (Regulation (EU) 2024/1689) — Annex III Part 5(b)',
  };

  const compliance_flags = determination === 'FAIL'
    ? ['AI_ACT_NON_CONFORMANT', 'BIAS_OR_CHECKLIST_FAIL']
    : determination === 'WARN'
      ? ['AI_ACT_PARTIAL_CONFORMANCE', 'CHECKLIST_GAPS']
      : ['AI_ACT_CONFORMANT'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       'model_governance',
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    compute_mode:       'server',
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'model_governance' };
