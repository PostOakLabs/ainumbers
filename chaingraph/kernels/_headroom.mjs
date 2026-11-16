// _headroom.mjs: distance to the nearest verdict change found on a declared grid.
//
// PURE. No clock, no randomness, no I/O, no imports. The kernel (a compute function) and the
// verdict classifier are handed in by the caller. Grid stepping is done in scaled integers
// (BigInt over the step's decimal places), never by repeated floating-point addition.
//
// Copy rule: say "distance to the nearest verdict change found on the declared grid". A
// result whose basis is `bracketed` is "a verdict change exists at this distance", never
// "the nearest". Never "safe margin", "guaranteed" or "compliant up to".
//
// Three verdict classes (the shared reader's classes):
//   positive <-> negative   a FLIP
//   into refusal            a DOMAIN EDGE (reported apart, never counted as a flip)
//   a thrown error          a DOMAIN EDGE
// A base point whose own class is refusal or unclassified is skipped and counted.

export const EVAL_CAP = 64;        // bracket + bisect evaluations per direction
export const SCAN_CAP = 10000;     // linear-scan evaluations in Node (500 in the worker)

// ---- exact decimal grid ----------------------------------------------------

const DEC = /^(-?)(\d+)(?:\.(\d+))?$/;

/** Decimal places of a decimal string ("0.01" -> 2, "5" -> 0). */
export function placesOf(s) {
  const m = DEC.exec(String(s));
  if (!m) throw new Error(`not a decimal string: ${s}`);
  return m[3] ? m[3].length : 0;
}

/** Scale a decimal string to a BigInt at the given places (places must be >= placesOf(s)). */
export function toScaled(s, places) {
  const m = DEC.exec(String(s));
  if (!m) throw new Error(`not a decimal string: ${s}`);
  const frac = m[3] || '';
  if (frac.length > places) throw new Error(`${s} has more than ${places} decimal places`);
  const digits = BigInt(m[2] + frac.padEnd(places, '0'));
  return m[1] === '-' ? -digits : digits;
}

/** Format a scaled BigInt with exactly `places` decimals. */
export function fromScaled(v, places) {
  const neg = v < 0n;
  const abs = (neg ? -v : v).toString().padStart(places + 1, '0');
  const body = places === 0 ? abs : `${abs.slice(0, abs.length - places)}.${abs.slice(abs.length - places)}`;
  return neg ? `-${body}` : body;
}

/** base + n*step as an exact decimal string. n may be negative. Places = max(base, step). */
export function gridValue(base, step, n) {
  const places = Math.max(placesOf(base), placesOf(step));
  return fromScaled(toScaled(base, places) + BigInt(n) * toScaled(step, places), places);
}

/** Whole steps from `from` to `to` along `step` (BigInt division, truncated toward zero). */
export function stepsBetween(from, to, step) {
  const places = Math.max(placesOf(from), placesOf(to), placesOf(step));
  return (toScaled(to, places) - toScaled(from, places)) / toScaled(step, places);
}

// ---- JSON pointer on policy_parameters ------------------------------------

const seg = (s) => s.replace(/~1/g, '/').replace(/~0/g, '~');

export function getPointer(obj, pointer) {
  let cur = obj;
  for (const p of pointer.split('/').slice(1).map(seg)) {
    if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, p)) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setPointer(obj, pointer, value) {
  const parts = pointer.split('/').slice(1).map(seg);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = value;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- the search (spec section 4) -------------------------------------------

/**
 * Search one direction. `evaluate(n)` (sync or async) returns 'same' | 'flip' | 'edge' for the
 * point n grid steps from the base (n >= 1).
 *
 *  1. exponential bracket 1, 2, 4, ... up to maxSteps
 *  2. bisect inside the bracket to one grid step
 *  3. when the distance is within scanCap, scan every grid point and upgrade the basis to scanned
 *
 * Returns { status, lo, hi, kind, scanned, evaluations, bound? }:
 *   status 'flip' | 'domain_edge' | 'no_flip_within_range'
 *   lo = last grid index with the base verdict class, hi = lo + 1 = first index that differs.
 */
/**
 * @param {{ evaluate: (n: number) => any, maxSteps: number, scanCap?: number, evalCap?: number }} args
 * @returns {Promise<any>}
 */
export async function searchHeadroom(args) {
  const { evaluate, maxSteps, scanCap = SCAN_CAP, evalCap = EVAL_CAP } = args;
  const memo = new Map();
  let evaluations = 0;
  const ev = async (n) => {
    if (!memo.has(n)) memo.set(n, await evaluate(n));
    return memo.get(n);
  };
  const counted = async (n) => {
    if (!memo.has(n)) evaluations++;
    return ev(n);
  };
  const none = (bound, lo) => ({ status: 'no_flip_within_range', lo, hi: null, kind: null, scanned: false, evaluations, bound });
  if (!(maxSteps >= 1)) return none('range', 0);

  let lo = 0;
  /** @type {any} */
  let hi = null;
  /** @type {any} */
  let kind = null;
  let n = 1;
  for (;;) {
    if (evaluations >= evalCap) return none('evaluations', lo);
    const k = await counted(n);
    if (k !== 'same') { hi = n; kind = k; break; }
    lo = n;
    if (n >= maxSteps) return none('range', lo);
    n = Math.min(n * 2, maxSteps);
  }
  while (hi - lo > 1) {
    if (evaluations >= evalCap) return none('evaluations', lo);
    const mid = lo + Math.floor((hi - lo) / 2);
    const k = await counted(mid);
    if (k === 'same') lo = mid; else { hi = mid; kind = k; }
  }
  let scanned = false;
  if (hi <= scanCap) {
    scanned = true;
    for (let i = 1; i < hi; i++) {
      const k = await ev(i);
      if (k !== 'same') { hi = i; kind = k; break; }
    }
    lo = hi - 1;
  }
  return { status: kind === 'flip' ? 'flip' : 'domain_edge', lo, hi, kind, scanned, evaluations };
}

// ---- one probe over a kernel ----------------------------------------------

/** Class of one kernel run: { cls, payload } or { cls: 'thrown' }. `classify(payload)` -> class. */
export async function runClass(compute, pp, classify) {
  try {
    const res = await compute(clone(pp));
    if (res && typeof res === 'object' && (res.error || res.errors)) return { cls: 'refusal', payload: res };
    const payload = res && typeof res === 'object' && 'output_payload' in res ? res.output_payload : res;
    return { cls: classify(payload) || 'unclassified', payload };
  } catch (e) {
    return { cls: 'thrown', payload: null, thrown: String((e && e.message) || e) };
  }
}

/** Value at grid index n (signed) for a probe, typed like the base value (string stays a string). */
export function probeValue(probe, baseValue, n) {
  const text = gridValue(String(baseValue), probe.step, n);
  if (typeof baseValue === 'string') return text;
  return Number(text);
}

/** Largest n >= 0 such that the point n grid steps in `dir` stays inside the declared range. */
export function maxStepsFor(probe, baseValue, dir) {
  const bound = dir === '+' ? probe.max : probe.min;
  if (bound === undefined) return 0;
  const k = stepsBetween(String(baseValue), bound, probe.step);
  const out = dir === '+' ? k : -k;
  return out > 0n ? Number(out) : 0;
}

/**
 * Headroom of one probe in one direction. Returns a plain entry (no hashes: the runner adds
 * those through executionHash in _hash.mjs and nowhere else).
 */
/**
 * @param {{ compute: any, pp: any, probe: any, dir: string, classify: any, base?: any, scanCap?: number, evalCap?: number }} args
 * @returns {Promise<any>}
 */
export async function probeHeadroom(args) {
  const { compute, pp, probe, dir, classify, base, scanCap, evalCap } = args;
  const baseValue = getPointer(pp, probe.pointer);
  const entry = { pointer: probe.pointer, direction: dir, step: probe.step };
  if (typeof baseValue !== 'number' && typeof baseValue !== 'string') return { ...entry, status: 'skipped', reason: 'no-numeric-base-value' };
  const baseRun = base || await runClass(compute, pp, classify);
  if (baseRun.cls !== 'positive' && baseRun.cls !== 'negative') return { ...entry, status: 'skipped', reason: `base-class-${baseRun.cls}` };
  const sign = dir === '+' ? 1 : -1;
  const at = (n) => { const q = clone(pp); setPointer(q, probe.pointer, probeValue(probe, baseValue, sign * n)); return q; };
  const evaluate = async (n) => {
    const r = await runClass(compute, at(n), classify);
    if (r.cls === baseRun.cls) return 'same';
    return r.cls === 'positive' || r.cls === 'negative' ? 'flip' : 'edge';
  };
  const found = await searchHeadroom({ evaluate, maxSteps: maxStepsFor(probe, baseValue, dir), scanCap, evalCap });
  if (found.status === 'no_flip_within_range') return { ...entry, ...found, base_class: baseRun.cls };
  const lastSame = gridValue(String(baseValue), probe.step, sign * found.lo);
  const firstOther = gridValue(String(baseValue), probe.step, sign * found.hi);
  const places = Math.max(placesOf(String(baseValue)), placesOf(probe.step));
  const distance = fromScaled(BigInt(found.lo) * toScaled(probe.step, places), places);
  const basis = found.scanned ? 'scanned' : probe.monotone ? 'declared-monotone' : 'bracketed';
  return {
    ...entry, ...found, base_class: baseRun.cls,
    steps_to_flip: found.lo, distance, basis,
    witness: { last_same: { value: lastSame }, first_other: { value: firstOther } },
  };
}
