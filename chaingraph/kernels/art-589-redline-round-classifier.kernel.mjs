import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-589-redline-round-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'classify_redline_round_changes',
  mandate_type: 'compliance_control',
  gpu: false,
};

// Redline round classifier (art-589). Negotiation-round diffing is manual paralegal work today:
// someone reads two drafts of a contract side by side and writes down what changed. This kernel
// classifies each declared segment (a paragraph or clause, already split by the caller -- this
// kernel never parses DOCX, PDF, or any binary format) into one of five states by comparing three
// caller-declared strings per segment: the BASELINE text (the clause as it stood in round 1 / the
// original template), the PRIOR text (the clause as it stood in the immediately preceding round),
// and the CURRENT text (the clause as it stands in this round).
//
//   ACCEPTED  -- current equals prior: whatever stood at the end of the last round was carried
//                forward unchanged, i.e. the other side accepted it as written.
//   REVERTED  -- current equals baseline, and baseline differs from prior: the clause had been
//                changed in an earlier round and has now been walked back to the original wording.
//   MODIFIED  -- current differs from both prior and baseline (or no baseline was declared): a
//                further edit was made this round that is neither acceptance nor a full reversion.
//   NEW       -- no prior text was declared for this segment_id but current text is present: the
//                segment did not exist in the prior round.
//   DELETED   -- prior text was declared but current text is absent: the segment was removed.
//
// ATTRIBUTION (design borrow, not code): this five-state enum extends the four-state
// ACCEPTED/REVERTED/MODIFIED/NEW classification used by eigenlegal/counsel-os's diff_rounds.py
// (MIT license) -- adding DELETED, which that enum does not carry. That file's source has NOT
// been read by whoever wrote this kernel; only the enum SHAPE, described in third-party notes, was
// borrowed as design inspiration. No code from diff_rounds.py appears here or was ported into this
// kernel. See https://github.com/eigenlegal/counsel-os (MIT).
//
// SCOPE GUARD -- this kernel classifies the CHANGE, never the negotiating POSITION. It does not
// score a clause as aggressive, vendor-favorable, or otherwise evaluate which side benefits from a
// change. That judgment is explicitly out of scope: this is mechanical text-equality classification
// and a word-level diff transcript, nothing else. This is not legal advice.
//
// ROUND-OVER-ROUND CHAINING -- a round's declared `prior_round_digest` is the execution_hash this
// same node produced for the immediately preceding round's OWN artifact (policy_parameters +
// output_payload). This kernel does not itself recompute that hash (it has no visibility into the
// prior round's raw content, only the digest string the caller declares) -- it records the
// declaration and its well-formedness. verifyRoundChain() below, given the actual prior artifacts,
// recomputes each one's execution_hash and confirms it equals what the next round declared: a
// tampered middle round's content no longer reproduces the hash the following round committed to,
// so the chain check fails exactly there. Round 1 (the root of a chain) declares no prior digest.
//
// Deterministic string/array comparison only. No clock, no network, no PII (segment text is a
// synthetic/anonymised input per the PII banner, never real client or counterparty text).

function s(v) { return typeof v === 'string' ? v : (v == null ? null : String(v)); }
function normText(v) { return typeof v === 'string' ? v : null; }
function normDigest(v) { return typeof v === 'string' ? v.trim().toLowerCase().replace(/^sha256:/, '') : ''; }
function digestWellFormed(v) { return /^[0-9a-f]{64}$/.test(normDigest(v)); }

// Word-level LCS diff -- pure, deterministic, no locale-sensitive tokenization (plain whitespace
// split). Returns an ordered list of {op:'equal'|'delete'|'insert', text} tokens.
function wordDiff(a, b) {
  const aw = a == null ? [] : a.split(/(\s+)/).filter((t) => t !== '');
  const bw = b == null ? [] : b.split(/(\s+)/).filter((t) => t !== '');
  const n = aw.length, m = bw.length;
  // LCS length table.
  const dp = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Array(m + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aw[i] === bw[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (aw[i] === bw[j]) { ops.push({ op: 'equal', text: aw[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: 'delete', text: aw[i] }); i++; }
    else { ops.push({ op: 'insert', text: bw[j] }); j++; }
  }
  while (i < n) { ops.push({ op: 'delete', text: aw[i] }); i++; }
  while (j < m) { ops.push({ op: 'insert', text: bw[j] }); j++; }
  // Merge adjacent same-op tokens for a compact transcript.
  const merged = [];
  for (const t of ops) {
    const last = merged[merged.length - 1];
    if (last && last.op === t.op) last.text += t.text;
    else merged.push({ op: t.op, text: t.text });
  }
  return merged;
}

function classifySegment(entry) {
  const segment_id = typeof entry.segment_id === 'string' && entry.segment_id.trim() !== '' ? entry.segment_id.trim() : null;
  const baseline_text = normText(entry.baseline_text);
  const prior_text = normText(entry.prior_text);
  const current_text = normText(entry.current_text);

  if (!segment_id) {
    return { rejected: true, reason: 'missing_segment_id', entry };
  }
  if (prior_text == null && current_text == null) {
    return { rejected: true, reason: 'no_prior_or_current_text', segment_id };
  }

  let classification;
  if (prior_text == null && current_text != null) {
    classification = 'NEW';
  } else if (prior_text != null && current_text == null) {
    classification = 'DELETED';
  } else if (current_text === prior_text) {
    classification = 'ACCEPTED';
  } else if (baseline_text != null && current_text === baseline_text && baseline_text !== prior_text) {
    classification = 'REVERTED';
  } else {
    classification = 'MODIFIED';
  }

  const changed = classification !== 'ACCEPTED';
  const result = {
    segment_id,
    classification,
    baseline_text: baseline_text ?? null,
    prior_text: prior_text ?? null,
    current_text: current_text ?? null,
    changed,
  };

  if (changed) {
    const fromText = classification === 'NEW' ? null : prior_text;
    const toText = classification === 'DELETED' ? null : current_text;
    result.diff = wordDiff(fromText, toText);
  }

  return { rejected: false, result };
}

export function compute(pp) {
  pp = pp || {};
  const document_id = typeof pp.document_id === 'string' && pp.document_id.trim() !== '' ? pp.document_id.trim() : null;
  const roundIn = pp.round && typeof pp.round === 'object' ? pp.round : {};
  const round_number = Number.isInteger(roundIn.number) && roundIn.number > 0 ? roundIn.number : null;
  const round_label = typeof roundIn.label === 'string' && roundIn.label.trim() !== '' ? roundIn.label.trim() : null;
  const prior_round_digest = typeof pp.prior_round_digest === 'string' && pp.prior_round_digest.trim() !== '' ? pp.prior_round_digest.trim() : null;
  const segmentsIn = Array.isArray(pp.segments) ? pp.segments : [];

  const compliance_flags = ['REDLINE_ROUND_CLASSIFICATION_EVALUATED'];

  // Round-chain declaration bookkeeping. This kernel records what was declared; it cannot itself
  // recompute a hash over content it never receives (the prior round's raw payload) -- that is
  // verifyRoundChain()'s job, run over the actual prior artifacts by the caller/page.
  let round_chain_state;
  if (round_number === 1) {
    if (prior_round_digest) {
      round_chain_state = { status: 'REJECTED', reason: 'round_1_must_not_declare_prior_round_digest' };
      compliance_flags.push('ROUND_1_DECLARED_UNEXPECTED_PRIOR_DIGEST');
    } else {
      round_chain_state = { status: 'ROOT', reason: null };
    }
  } else if (round_number != null && round_number > 1) {
    if (!prior_round_digest) {
      round_chain_state = { status: 'REJECTED', reason: 'prior_round_digest_required_for_round_gt_1' };
      compliance_flags.push('MISSING_PRIOR_ROUND_DIGEST');
    } else if (!digestWellFormed(prior_round_digest)) {
      round_chain_state = { status: 'REJECTED', reason: 'prior_round_digest_malformed' };
      compliance_flags.push('MALFORMED_PRIOR_ROUND_DIGEST');
    } else {
      round_chain_state = { status: 'LINKED', reason: null };
    }
  } else {
    round_chain_state = { status: 'REJECTED', reason: 'round_number_missing_or_invalid' };
    compliance_flags.push('ROUND_NUMBER_MISSING_OR_INVALID');
  }

  const classifications = [];
  const rejected_inputs = [];
  for (const entry of segmentsIn) {
    const c = classifySegment(entry && typeof entry === 'object' ? entry : {});
    if (c.rejected) rejected_inputs.push(c);
    else classifications.push(c.result);
  }

  const counts = { ACCEPTED: 0, REVERTED: 0, MODIFIED: 0, NEW: 0, DELETED: 0 };
  for (const c of classifications) counts[c.classification]++;
  const total_segments = classifications.length;
  const changed_count = total_segments - counts.ACCEPTED;

  const diff_transcript = classifications
    .filter((c) => c.changed)
    .map((c) => ({ segment_id: c.segment_id, classification: c.classification, diff: c.diff }));

  let verdict, reason;
  if (round_chain_state.status === 'REJECTED') {
    verdict = 'INDETERMINATE';
    reason = round_chain_state.reason;
  } else if (total_segments === 0) {
    verdict = 'INDETERMINATE';
    reason = 'no_segments_declared';
    compliance_flags.push('NO_SEGMENTS_DECLARED');
  } else {
    verdict = 'CLASSIFIED';
    reason = null;
    compliance_flags.push('SEGMENTS_CLASSIFIED');
  }

  const round_summary = {
    document_id,
    round_number,
    round_label,
    total_segments,
    changed_count,
    accepted_count: counts.ACCEPTED,
    reverted_count: counts.REVERTED,
    modified_count: counts.MODIFIED,
    new_count: counts.NEW,
    deleted_count: counts.DELETED,
  };

  const output_payload = {
    verdict,
    reason,
    round_summary,
    round_chain: {
      round_number,
      prior_round_digest,
      status: round_chain_state.status,
    },
    classifications,
    diff_transcript,
    rejected_inputs,
    scope_note: 'Classifies the TYPE of change per declared segment only (ACCEPTED, REVERTED, MODIFIED, NEW, DELETED). Never scores or evaluates the negotiating position of either side; not legal advice.',
    attribution_note: 'Five-state enum (ACCEPTED/REVERTED/MODIFIED/NEW/DELETED) extends the four-state classification used by eigenlegal/counsel-os diff_rounds.py (MIT license), design-borrow only. That file was not read; no code was ported from it.',
  };

  return { output_payload, compliance_flags };
}

// verifyRoundChain — given the actual sequence of round artifacts (each an object with at least
// {policy_parameters, output_payload, execution_hash}), recompute round[i]'s execution_hash from
// its OWN policy_parameters/output_payload and confirm round[i+1] declared exactly that value as
// its prior_round_digest. A round whose content was tampered after the fact recomputes to a
// different hash than what the next round committed to, so the chain check fails at that round.
// Independent of compute()'s per-round classification result: this is the hash-chain check, not
// the classification check, and the two are reported separately, never fused into one boolean.
export async function verifyRoundChain(rounds) {
  const list = Array.isArray(rounds) ? rounds : [];
  const details = [];
  if (list.length === 0) {
    return { valid: false, reason: 'no_rounds_declared', break_at_index: null, details };
  }

  let valid = true;
  let break_at_index = null;
  let break_reason = null;

  for (let i = 0; i < list.length; i++) {
    const round = list[i] || {};
    const recomputed = await executionHash(round.policy_parameters, round.output_payload);
    const selfConsistent = round.execution_hash ? recomputed === round.execution_hash : null;

    let linkedToNext = null;
    if (i + 1 < list.length) {
      const next = list[i + 1] || {};
      const declared = next.policy_parameters && typeof next.policy_parameters.prior_round_digest === 'string'
        ? normDigest(next.policy_parameters.prior_round_digest) : null;
      linkedToNext = declared != null && declared === normDigest(recomputed);
    }

    details.push({ index: i, recomputed_hash: recomputed, self_consistent: selfConsistent, linked_to_next: linkedToNext });

    if (selfConsistent === false && valid) {
      valid = false; break_at_index = i; break_reason = 'round_content_does_not_match_its_own_declared_execution_hash';
    }
    if (linkedToNext === false && valid) {
      valid = false; break_at_index = i; break_reason = 'next_round_prior_round_digest_does_not_match_recomputed_hash';
    }
  }

  return { valid, reason: valid ? null : break_reason, break_at_index, details };
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
