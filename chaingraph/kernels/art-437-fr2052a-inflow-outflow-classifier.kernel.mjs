import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-437-fr2052a-inflow-outflow-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_fr2052a_inflow_outflow_classification',
  mandate_type: 'regulatory_reporting', gpu: false,
};

// FR 2052a filing-layer kernel, scoped to ONE section per BANKING-OCG-BUILD-SPEC.md §4.3:
// complex-institution liquidity monitoring inflow/outflow rows. Steps: (1) classify each row into
// a maturity bucket using a caller-supplied Appendix IV-style boundary table (policy input,
// versioned -- this kernel does not hardcode FR 2052a's bucket schedule, matching the art-427 DW
// margin-table pattern); (2) an explicit per-row bucket_override (with mandatory reason_code) can
// replace the table-derived bucket -- an override lacking a reason_code is flagged deficient and
// is the row-level basis for a §27 human_accountability_record (record_type:"override"); the
// kernel itself does not sign or mint that record, it only surfaces which rows require one;
// (3) intercompany elimination -- rows flagged is_intercompany are excluded from the external
// aggregation and reported separately as elimination_total, never netted silently into the filed
// figures; (4) aggregation + form-shaped export -- external (non-intercompany) rows are summed by
// bucket into inflow/outflow/net, in bucket order, under `output_payload.form_2052a`.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random. Dollar figures rounded
// to 2 decimals (r2) only at declared output boundaries. No filing claim: this produces an
// evidence artifact and a form-shaped export, never a submission (SPEC §0 "no filing claims").

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function str(v, def) { return (typeof v === 'string' && v) ? v : def; }

function classifyBucket(days, boundaries) {
  const sorted = boundaries.slice().sort((a, b) => a.max_days - b.max_days);
  for (const b of sorted) {
    if (days <= b.max_days) return b.bucket_label;
  }
  return sorted.length ? sorted[sorted.length - 1].bucket_label : 'unclassified';
}

function classifyRows(rows, boundaryTable) {
  const boundaries = arr(boundaryTable).map((b) => ({
    bucket_label: str(b && b.bucket_label, 'unclassified'),
    max_days: Math.max(0, safeNum(b && b.max_days, 0)),
  }));

  let overrideMissingReason = 0;
  let overrideCount = 0;

  const classified = arr(rows).map((row, idx) => {
    const rowId = str(row && row.row_id, 'row-' + idx);
    const flowType = (row && row.flow_type === 'outflow') ? 'outflow' : 'inflow';
    const amount = Math.max(0, safeNum(row && row.amount_musd, 0));
    const maturityDays = Math.max(0, safeNum(row && row.maturity_days, 0));
    const isIntercompany = !!(row && row.is_intercompany);

    const tableBucket = boundaries.length ? classifyBucket(maturityDays, boundaries) : 'unclassified';
    let bucket = tableBucket;
    let overridden = false;
    let overrideReasonCode = null;

    if (row && row.bucket_override) {
      overridden = true;
      overrideCount += 1;
      bucket = str(row.bucket_override, tableBucket);
      overrideReasonCode = str(row.override_reason_code, null);
      if (!overrideReasonCode) overrideMissingReason += 1;
    }

    return {
      row_id: rowId,
      flow_type: flowType,
      amount_musd: r2(amount),
      maturity_days: maturityDays,
      table_bucket: tableBucket,
      bucket,
      is_intercompany: isIntercompany,
      override_applied: overridden,
      override_reason_code: overrideReasonCode,
    };
  });

  return { classified, overrideCount, overrideMissingReason };
}

function aggregate(classified) {
  const bucketOrder = [];
  const byBucket = {};
  let eliminationTotal = 0;

  for (const row of classified) {
    if (row.is_intercompany) {
      eliminationTotal += row.amount_musd;
      continue;
    }
    if (!byBucket[row.bucket]) {
      byBucket[row.bucket] = { bucket: row.bucket, inflow_musd: 0, outflow_musd: 0 };
      bucketOrder.push(row.bucket);
    }
    if (row.flow_type === 'outflow') byBucket[row.bucket].outflow_musd += row.amount_musd;
    else byBucket[row.bucket].inflow_musd += row.amount_musd;
  }

  const form_2052a = bucketOrder.map((b) => {
    const rec = byBucket[b];
    return {
      bucket: rec.bucket,
      inflow_musd: r2(rec.inflow_musd),
      outflow_musd: r2(rec.outflow_musd),
      net_musd: r2(rec.inflow_musd - rec.outflow_musd),
    };
  });

  const totalInflow = form_2052a.reduce((s, r) => s + r.inflow_musd, 0);
  const totalOutflow = form_2052a.reduce((s, r) => s + r.outflow_musd, 0);

  return {
    form_2052a,
    total_inflow_musd: r2(totalInflow),
    total_outflow_musd: r2(totalOutflow),
    total_net_musd: r2(totalInflow - totalOutflow),
    elimination_total_musd: r2(eliminationTotal),
  };
}

export function compute(pp) {
  pp = pp || {};

  const boundaryTableVersion = str(pp.boundary_table_version, null);
  const { classified, overrideCount, overrideMissingReason } = classifyRows(pp.rows, pp.bucket_boundaries);
  const { form_2052a, total_inflow_musd, total_outflow_musd, total_net_musd, elimination_total_musd } = aggregate(classified);

  const compliance_flags = [];
  if (overrideMissingReason > 0) compliance_flags.push('FR2052A_OVERRIDE_MISSING_REASON_CODE');
  else compliance_flags.push('FR2052A_CLASSIFICATION_OK');
  if (elimination_total_musd > 0) compliance_flags.push('FR2052A_INTERCOMPANY_ELIMINATED');

  const output_payload = {
    boundary_table_version: boundaryTableVersion,
    row_count: classified.length,
    override_count: overrideCount,
    override_missing_reason_count: overrideMissingReason,
    rows: classified,
    form_2052a,
    total_inflow_musd,
    total_outflow_musd,
    total_net_musd,
    elimination_total_musd,
    note: 'Product/maturity-bucket classification against a versioned Appendix IV-style boundary table (policy input); an overridden bucket without a reason_code is flagged and is the row-level basis for a separate signed §27 human_accountability_record (this kernel does not mint that record). Intercompany rows are eliminated from the external aggregation and reported only in elimination_total_musd. Evidence artifact and form-shaped export only -- not a filing, not regulator-submittable.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
