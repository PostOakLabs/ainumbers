/**
 * chaingraph/errata-check.mjs — the shared kernel-errata reader (KERNEL-ERRATA-READER-1).
 *
 * Given the errata snapshot (the log's checkpoint plus the recorded module errata, both
 * shipped with the page by scripts/gen-errata-snapshot.mjs) and a receipt the holder is
 * verifying, this module reports whether an erratum names the receipt's module digest and
 * whether that receipt's inputs fall in the affected region. It is optional due diligence,
 * exactly like the errata feed itself: it never gates, blocks or qualifies the hash result,
 * and nothing about the receipt leaves the browser (the snapshot rides with the page; this
 * module performs zero network calls of any kind).
 *
 * Verdict states (BUILD-SPEC §3, KERNEL-ERRATA-READER-1): exactly three.
 *   NOT-LISTED        no erratum names this module digest as of tree size N.
 *   LISTED-UNAFFECTED an erratum names the digest; the predicate is false on these inputs.
 *   LISTED-AFFECTED   an erratum names the digest; the predicate is true on these inputs.
 * Two non-verdict outcomes exist so the reader never has to guess:
 *   STALE             past the checkpoint's expires_at; the caller prints the log's own
 *                     staleness sentence unchanged (the sentence travels verbatim in the
 *                     snapshot, byte-for-byte from registry/errata/checkpoint).
 *   NOT-ENGAGED       the input carries no module digest at all, so there is nothing to
 *                     check; and LISTED-INPUTS-NEEDED: an erratum names the digest but the
 *                     input carries no policy_parameters, so the affected region cannot be
 *                     evaluated here and no verdict is issued.
 *
 * Import discipline: this file has ZERO imports, so it can be served as a same-origin
 * module (`<script type="module">`, script-src 'self') and vendored verbatim into a
 * classic inline script (strip the `export ` keywords, wrap in an IIFE, return the four
 * functions) for self-contained pages. CSP on the verify pages is `connect-src 'none'`;
 * keep it that way: no fetch, no XMLHttpRequest, no WebSocket, no dynamic import().
 * Runs unchanged in Node (the selftest imports it directly) and in browsers.
 */

// ── checkpoint parsing ─────────────────────────────────────────────────────────-------
// tlog-checkpoint.md signed-note body: origin line, size line, base64 root line, then
// optional extension lines, a blank line, and the note signature line. The reader only
// needs the extension lines it publishes: `expires_at <unix seconds>` and the verbatim
// `staleness: ...` sentence. It does not verify the checkpoint signature here; the
// snapshot ships the checkpoint exactly as published under registry/errata/checkpoint,
// whose anchoring is verified offline via the Sigsum record (see errata.html).
export function parseErrataCheckpoint(text) {
  if (typeof text !== 'string') throw new TypeError('checkpoint text must be a string');
  const lines = text.split('\n');
  if (lines.length < 3) throw new Error('checkpoint body needs at least origin, size and root lines');
  const origin = lines[0];
  const size = Number(lines[1]);
  if (!Number.isInteger(size) || size < 0) throw new Error('checkpoint size line is not a non-negative integer');
  const rootHash = lines[2].trim();
  let expiresAt = null;
  let stalenessSentence = null;
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    if (line === '' || line.startsWith('— ')) break; // end of extension lines
    if (line.startsWith('expires_at ')) {
      const v = Number(line.slice('expires_at '.length).trim());
      if (!Number.isFinite(v)) throw new Error('checkpoint expires_at line is not a finite number');
      expiresAt = v;
    } else if (line.startsWith('staleness:')) {
      stalenessSentence = line; // kept verbatim, including the "staleness: " label
    }
  }
  return { origin, size, rootHash, expiresAt, stalenessSentence };
}

// ── receipt field extraction ──────────────────────────────────────────────────────────
// The module digest a receipt carries: ZkVmReceipt-shaped inputs put it in
// journal.kernel_digest; a flat kernel receipt may carry kernel_digest directly.
// Returns the digest string without any sha256: prefix, or null when absent.
export function extractKernelDigest(input) {
  const d = input && typeof input === 'object'
    ? (input.kernel_digest ?? (input.journal && typeof input.journal === 'object' ? input.journal.kernel_digest : null))
    : null;
  if (typeof d !== 'string' || d.trim() === '') return null;
  return d.trim().replace(/^sha256:/i, '').toLowerCase();
}

// The inputs a predicate evaluates: policy_parameters on the artifact itself, or under
// journal for receipt shapes that record replay inputs. Returns null when absent.
export function extractPolicyParameters(input) {
  const pp = input && typeof input === 'object'
    ? (input.policy_parameters ?? (input.journal && typeof input.journal === 'object' ? input.journal.policy_parameters : null))
    : null;
  return pp !== null && pp !== undefined && typeof pp === 'object' && !Array.isArray(pp) ? pp : null;
}

// ── the reader ────────────────────────────────────────────────────────────────────────
// snapshot: { checkpoint: { tree_size, expires_at, staleness_sentence }, entries: [...] }
//   entries carry id, summary, kernel_digest_affected (array), kernel_digest_fixed,
//   and affected(policy_parameters) — the embedded predicate.
// input:    { kernelDigest, policyParameters } — as produced by the two extractors
//           (digest without prefix, lowercased; parameters object or null).
// nowMs:    the caller's clock in epoch milliseconds. Pages pass Date.now(); the module
//           itself never reads a clock, so the selftest can plant any moment.
export function errataCheck(snapshot, input, nowMs) {
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('snapshot must be an object');
  const cp = snapshot.checkpoint ?? {};
  // Past the checkpoint's expiry the answer is the log's own staleness sentence,
  // unchanged, whatever the digest is. No expires_at published means no expiry is claimed.
  if (typeof cp.expires_at === 'number' && typeof nowMs === 'number' && nowMs / 1000 > cp.expires_at) {
    return { state: 'STALE', sentence: String(cp.staleness_sentence ?? '') };
  }
  const digest = input?.kernelDigest ?? null;
  if (!digest) return { state: 'NOT-ENGAGED' };
  const entry = (Array.isArray(snapshot.entries) ? snapshot.entries : [])
    .find((e) => Array.isArray(e.kernel_digest_affected) && e.kernel_digest_affected
      .some((d) => typeof d === 'string' && d.replace(/^sha256:/i, '').toLowerCase() === digest));
  if (!entry) {
    return {
      state: 'NOT-LISTED',
      treeSize: typeof cp.tree_size === 'number' ? cp.tree_size : null,
    };
  }
  const pp = input?.policyParameters ?? null;
  if (!pp) return { state: 'LISTED-INPUTS-NEEDED', entry };
  let hit;
  try {
    hit = entry.affected(pp) === true;
  } catch (e) {
    return { state: 'LISTED-INPUTS-NEEDED', entry, error: String(e && e.message ? e.message : e) };
  }
  return hit
    ? { state: 'LISTED-AFFECTED', entry, fixedDigest: entry.kernel_digest_fixed ?? null }
    : { state: 'LISTED-UNAFFECTED', entry, fixedDigest: entry.kernel_digest_fixed ?? null };
}

// ── reader-facing copy ────────────────────────────────────────────────────────────────
// One plain sentence per state, for the verify pages to print beside the hash result.
// These lines state the defect without minimising it and keep the feed's own posture:
// checking the log is optional due diligence and never a verification step.
export function errataSentence(result) {
  const id = result.entry ? result.entry.id : null;
  const fixed = result.fixedDigest ? 'sha256:' + String(result.fixedDigest).replace(/^sha256:/i, '') : '';
  switch (result.state) {
    case 'STALE':
      return result.sentence;
    case 'NOT-LISTED':
      return 'No erratum names this module digest as of tree size '
        + (result.treeSize === null ? '(unknown)' : String(result.treeSize))
        + '. The errata log is optional due diligence; this receipt verifies offline regardless.';
    case 'LISTED-AFFECTED':
      return 'Erratum ' + id + ' lists this module digest, and these inputs fall in the affected region. '
        + 'The verdict this receipt holds is not good: re-run it on the fixed module ' + fixed + '. '
        + 'Defect: ' + (result.entry.summary ?? '(no summary)') + ' The errata log is optional due diligence; it never revokes a receipt.';
    case 'LISTED-UNAFFECTED':
      return 'Erratum ' + id + ' lists this module digest, but these inputs do not fall in the affected region. '
        + 'The fixed module, should you want to re-run anyway: ' + fixed + '. '
        + 'The errata log is optional due diligence; this receipt verifies offline regardless.';
    case 'LISTED-INPUTS-NEEDED':
      return 'Erratum ' + id + ' lists this module digest'
        + (result.error ? ' (the embedded predicate failed: ' + result.error + ')' : '')
        + '. The receipt carries no policy_parameters, so the affected region cannot be evaluated here. '
        + 'Replay the receipt with its recorded inputs to classify it. '
        + 'Defect: ' + (result.entry.summary ?? '(no summary)');
    case 'NOT-ENGAGED':
    default:
      return null; // nothing to print; the caller hides the errata line
  }
}
