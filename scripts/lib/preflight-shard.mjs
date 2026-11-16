// CI-PREFLIGHT-SHARD-1: the deterministic partition behind `preflight.mjs --shard i/N`.
//
// preflight.mjs computes its FULL run list exactly as an unsharded run does, then
// asks planShards() which shard owns each entry and keeps only its own. Every shard
// computes the same list from the same tree, so each one derives the same plan
// independently: no shard coordinates with another, and the union of the N kept
// lists is the whole list, each entry exactly once (preflight's --shard-plan prints
// both and asserts it).
//
// Balance: with a timing file (scripts/ci/preflight-gate-timings.json, per-gate ms
// parsed from a real CI log), longest-processing-time greedy: heaviest gate first,
// onto the least-loaded shard, ties to the lowest index. Without one, round-robin
// over the label-sorted list. Either way the order of the inputs is label order, so
// the plan never depends on GATES declaration order or on wall-clock.
//
// PINNED entries always go to shard 0 (preflight pins its SERIAL_GATES and its
// post-loop checks there). Weights decide balance only; they never select, skip or
// reorder a gate, and a missing or stale timing file costs balance, never coverage.

import { existsSync, readFileSync } from 'node:fs';

/** Parse "i/N" (0 <= i < N, N >= 1). Returns { index, count } or null when malformed. */
export function parseShardSpec(spec) {
  const m = /^(\d+)\/(\d+)$/.exec(String(spec ?? ''));
  if (!m) return null;
  const index = Number(m[1]);
  const count = Number(m[2]);
  if (count < 1 || index >= count) return null;
  return { index, count };
}

/** Read the timing file's `ms` map; null when absent or unreadable (round-robin then). */
export function loadTimings(path) {
  if (!path || !existsSync(path)) return null;
  try {
    const ms = JSON.parse(readFileSync(path, 'utf8')).ms;
    return ms && typeof ms === 'object' ? ms : null;
  } catch {
    return null;
  }
}

const byLabel = (a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : a.i - b.i);

/**
 * Assign every label to a shard.
 * @param {string[]} labels  the full run list, in declaration order (duplicates allowed)
 * @param {number} count     shard count N
 * @param {{ timings?: Record<string, number> | null, pinned?: (label: string) => boolean }} [opts]
 * @returns {number[]} shard index per label, aligned to `labels`
 */
export function planShards(labels, count, { timings = null, pinned = () => false } = {}) {
  const items = labels.map((label, i) => ({ label, i }));
  const out = new Array(labels.length);
  const load = new Array(count).fill(0);
  const known = timings ? labels.map((l) => timings[l]).filter((v) => Number.isFinite(v)) : [];
  const sortedKnown = [...known].sort((a, b) => a - b);
  const median = sortedKnown.length ? sortedKnown[Math.floor(sortedKnown.length / 2)] : 1;
  const weight = (l) => (timings && Number.isFinite(timings[l]) ? timings[l] : median);

  const free = [];
  for (const it of items.sort(byLabel)) {
    if (pinned(it.label)) {
      out[it.i] = 0;
      load[0] += weight(it.label);
    } else {
      free.push(it);
    }
  }
  if (!timings) {
    free.forEach((it, k) => { out[it.i] = k % count; });
    return out;
  }
  // Stable sort: equal weights keep label order, so the plan is a pure function of the inputs.
  free.sort((a, b) => weight(b.label) - weight(a.label));
  for (const it of free) {
    let best = 0;
    for (let s = 1; s < count; s++) if (load[s] < load[best]) best = s;
    out[it.i] = best;
    load[best] += weight(it.label);
  }
  return out;
}
