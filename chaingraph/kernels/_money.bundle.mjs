// _money.bundle.mjs - exact decimal parse + integer minor-unit arithmetic + named
// rounding modes for OpenChainGraph kernels.
//
// PURPOSE: the estate's money path currently forks scale-8 BigInt fixed point across
// several kernels and floats elsewhere. Documented defects this bundle closes, by
// construction (browser-first-primitives-enhancements-2026-10-16.md):
//   D7  - parse silently coerces "1e5"/"1,000" to 0 and truncates excess precision.
//   D8  - unknown rounding modes silently fall back to half_up (typos included).
//   D9  - Math.round(v*100)/100 floats: half goes toward +Infinity for negatives and
//         1.005*100 pre-multiply error rounds 1.005 DOWN at half_up.
//   D11 - unknown mode is a silent no-op returning the unrounded value.
// None of that can happen here: the grammar is closed, the mode set is closed, an
// unknown token is a REFUSAL (a thrown MoneyRefusal carrying a stable code), and no
// engine float ever touches the value path. There is NO default rounding mode anywhere
// in this bundle - a caller who omits a mode where one is needed gets
// REFUSED_ROUNDING_MODE_REQUIRED, never a silently-chosen mode.
//
// REPRESENTATION: a value is { v: BigInt, s: number } - an integer minor count `v` at
// decimal scale `s` (v * 10^-s). Strings cross the receipt boundary; BigInts never do
// (assertIJson rejects integers above 2^53 in _hash.mjs, so a BigInt must be
// stringified before it can reach an output_payload). No currency-less defaults: the
// scale is an explicit argument of parse/mul/div/rescale/toString, and currency
// exponents arrive as DATA via policy_parameters (same ruling as _ruleversion - never
// baked into kernel bytes).
//
// SAFETY: zero imports, zero guest-absent builtins (no TextEncoder/atob/btoa/URL, no
// Date, no Math on the value path - Math is used only for clamp of scale bounds on
// caller-declared integers, never on a monetary value). Bounds: MAX_DIGITS (38,
// decimal128-like) on significant digits of any parsed value; MAX_SCALE (38) on any
// scale argument; MAX_ALLOC_PARTS (1000) on allocation arity. Exceeding a bound is a
// MoneyRefusal, never a longer loop or a silent clamp. BigInt arithmetic only.
//
// ROUNDING MODE SET (closed; these exact tokens, nothing else, no aliases):
//   half_up   - ties away from zero   (Java RoundingMode.HALF_UP)
//   half_down - ties toward zero      (Java RoundingMode.HALF_DOWN)
//   half_even - ties to even          (Java RoundingMode.HALF_EVEN, banker's)
//   truncate  - toward zero           (Java RoundingMode.DOWN)
//   floor     - toward -Infinity      (Java RoundingMode.FLOOR)
//   ceiling   - toward +Infinity      (Java RoundingMode.CEILING)
// All six are sign-correct for negative values; the golden vector table exercises each
// mode at +x.5, -x.5, +x.25, -x.25, +0.005 and -0.005.
//
// COMPOSITION (BUILD-SPEC sec 4.1): a consuming kernel pastes this bundle VERBATIM inside
// the sentinel comments and destructures - never import at runtime (the RISC0 guest
// provides only _hash). The export tail below is linkage, not payload: it is replaced
// by the consumer's destructure line when inlined, and the inline-bundle drift gate
// (scripts/check-inline-ssot-sync.mjs, pair `_money`) carves the compared unit at the
// ssotUntilMarker for exactly that reason.

const MAX_DIGITS = 38; // significant decimal digits of any parsed/derived value (decimal128-like cap)
const MAX_SCALE = 38;  // largest scale argument accepted anywhere in the bundle
const MAX_ALLOC_PARTS = 1000; // largest allocation arity

// Grammar accepted by parseDecimal: exactly -?\d+(\.\d+)? - no exponent form, no
// thousands separators, no empty/whitespace input, no bare ".", no trailing ".",
// no sign-only, no hex. Anything else is REFUSED_MONEY_PARSE.
const MONEY_GRAMMAR = /^-?\d+(\.\d+)?$/;

class MoneyRefusal extends Error {
  constructor(code, detail) {
    super(code + (detail ? ': ' + detail : ''));
    this.name = 'MoneyRefusal';
    this.code = code;
  }
}

function _requireValue(x, who) {
  if (x === null || typeof x !== 'object' || typeof x.v !== 'bigint' || !Number.isInteger(x.s) || x.s < 0 || x.s > MAX_SCALE) {
    throw new MoneyRefusal('REFUSED_MONEY_SHAPE', who + ' expects {v: BigInt, s: integer scale 0..' + MAX_SCALE + '}');
  }
  return x;
}

function _requireScale(s, who) {
  if (!Number.isInteger(s) || s < 0 || s > MAX_SCALE) {
    throw new MoneyRefusal('REFUSED_MONEY_SCALE', who + ' scale must be an integer 0..' + MAX_SCALE + ', got ' + String(s));
  }
  return s;
}

function _requireMode(mode, who) {
  if (typeof mode !== 'string') {
    throw new MoneyRefusal('REFUSED_UNKNOWN_ROUNDING_MODE', who + ' mode must be a string, got ' + typeof mode);
  }
  switch (mode) {
    case 'half_up':
    case 'half_down':
    case 'half_even':
    case 'truncate':
    case 'floor':
    case 'ceiling':
      return mode;
    default:
      // Closed set, structured refusal, never a fallback (defects D8/D11).
      throw new MoneyRefusal('REFUSED_UNKNOWN_ROUNDING_MODE', who + ' mode "' + mode + '" is outside the closed set {half_up, half_down, half_even, truncate, floor, ceiling}');
  }
}

function _pow10(n) {
  // n is a validated integer 0..MAX_SCALE*2+1; multiplication, not exponentiation.
  let r = 1n;
  for (let i = 0; i < n; i++) r *= 10n;
  return r;
}

// Core sign-aware rescale: exact when sTo >= v.s; otherwise ONE rounding by `mode`.
// Every public rounding path funnels through here so the mode table has exactly one
// implementation to audit.
function _rescale(v, sTo, mode) {
  if (sTo === v.s) return v.v;
  if (sTo > v.s) return v.v * _pow10(sTo - v.s);
  const factor = _pow10(v.s - sTo);
  const neg = v.v < 0n;
  const av = neg ? -v.v : v.v;
  let q = av / factor;
  const r = av % factor;
  let inc = false;
  if (r !== 0n) {
    switch (mode) {
      case 'truncate':
        inc = false;
        break;
      case 'floor':
        inc = neg; // toward -Infinity: a negative remainder always goes down one more
        break;
      case 'ceiling':
        inc = !neg; // toward +Infinity
        break;
      case 'half_up':
        inc = r * 2n >= factor; // tie AWAY from zero on the magnitude, then re-sign
        break;
      case 'half_down':
        inc = r * 2n > factor; // tie TOWARD from zero
        break;
      case 'half_even':
        inc = r * 2n > factor || (r * 2n === factor && (q % 2n) === 1n);
        break;
      default:
        // _requireMode already closed this set; this is defense in depth, not a path.
        throw new MoneyRefusal('REFUSED_UNKNOWN_ROUNDING_MODE', 'internal: unreached mode ' + String(mode));
    }
  }
  let out = inc ? q + 1n : q;
  return neg ? -out : out;
}

const _money = {
  MoneyRefusal,

  MAX_DIGITS,
  MAX_SCALE,
  MAX_ALLOC_PARTS,

  /** True when str is exactly the accepted grammar (for callers that pre-validate). */
  isParseable(str) {
    return typeof str === 'string' && MONEY_GRAMMAR.test(str);
  },

  /**
   * parseDecimal(str, scale, opts?) -> {v: BigInt, s: scale}
   * Accepts ONLY -?\d+(\.\d+)? at the caller-declared scale. Exponent form, thousands
   * separators, empty input, bare sign and any other grammar breach are
   * REFUSED_MONEY_PARSE (defect D7). More fractional digits than `scale` are
   * REFUSED_MONEY_PRECISION unless opts.truncateExcess === true (a DECLARED
   * truncation flag: the caller names the policy, the bundle never invents one);
   * when declared, the excess digits are dropped toward zero (truncate) - declared
   * truncation, not a rounding mode choice. More than MAX_DIGITS significant digits
   * is REFUSED_MONEY_OVERFLOW.
   */
  parseDecimal(str, scale, opts) {
    const s = _requireScale(scale, 'parseDecimal');
    const truncDeclared = !!(opts && opts.truncateExcess === true);
    if (typeof str !== 'string' || !MONEY_GRAMMAR.test(str)) {
      throw new MoneyRefusal('REFUSED_MONEY_PARSE', 'expected -?digits(.digits)? at scale ' + String(s) + ', got ' + JSON.stringify(str === undefined ? 'undefined' : str));
    }
    const neg = str.charCodeAt(0) === 0x2d; // '-'
    const body = neg ? str.slice(1) : str;
    const dot = body.indexOf('.');
    const intPart = dot === -1 ? body : body.slice(0, dot);
    const fracPart = dot === -1 ? '' : body.slice(dot + 1);
    if (fracPart.length > s) {
      if (!truncDeclared) {
        throw new MoneyRefusal('REFUSED_MONEY_PRECISION', 'input has ' + String(fracPart.length) + ' fractional digits, scale is ' + String(s) + '; pass {truncateExcess:true} to DECLARE truncation');
      }
    }
    const usedFrac = fracPart.slice(0, s);
    const digits = (intPart === '0' ? '' : intPart) + usedFrac;
    if (digits.replace(/^0+/, '').length > MAX_DIGITS) {
      throw new MoneyRefusal('REFUSED_MONEY_OVERFLOW', 'value exceeds MAX_DIGITS=' + String(MAX_DIGITS) + ' significant digits');
    }
    let v = BigInt((intPart || '0') + (s > 0 ? usedFrac : ''));
    for (let i = usedFrac.length; i < s; i++) v *= 10n;
    return { v: neg ? -v : v, s };
  },

  /**
   * round(value, places, mode) -> {v: BigInt, s: places}
   * The mode is REQUIRED and drawn from the closed set; anything else (including
   * typos, missing, floorCeiling camelCase) is REFUSED_UNKNOWN_ROUNDING_MODE -
   * never a fallback (defects D8/D11). Sign-correct for negatives at every tie.
   */
  round(value, places, mode) {
    _requireValue(value, 'round');
    const sTo = _requireScale(places, 'round');
    _requireMode(mode, 'round');
    return { v: _rescale(value, sTo, mode), s: sTo };
  },

  /**
   * mul(a, b, mode, outScale) -> {v: BigInt, s: outScale}
   * Exact BigInt product (a.v*b.v at scale a.s+b.s), then ONE rounding at the
   * caller-declared outScale with the REQUIRED explicit mode. No intermediate
   * truncation exists to bias (defect D7's systematic toward-zero drift).
   */
  mul(a, b, mode, outScale) {
    _requireValue(a, 'mul');
    _requireValue(b, 'mul');
    const sOut = _requireScale(outScale, 'mul');
    _requireMode(mode, 'mul');
    const exact = { v: a.v * b.v, s: a.s + b.s };
    if (exact.s > MAX_SCALE + MAX_SCALE) {
      throw new MoneyRefusal('REFUSED_MONEY_OVERFLOW', 'product scale exceeds the bundle bound');
    }
    return { v: _rescale(exact, sOut, mode), s: sOut };
  },

  /**
   * div(a, b, mode, outScale) -> {v: BigInt, s: outScale}
   * Exact rational a/b scaled to outScale, then ONE rounding with the REQUIRED
   * explicit mode. A zero divisor is REFUSED_DIVIDE_BY_ZERO - never a silent 0
   * (defect D7's divFixed).
   */
  div(a, b, mode, outScale) {
    _requireValue(a, 'div');
    _requireValue(b, 'div');
    const sOut = _requireScale(outScale, 'div');
    _requireMode(mode, 'div');
    if (b.v === 0n) {
      throw new MoneyRefusal('REFUSED_DIVIDE_BY_ZERO', 'divisor is exactly zero');
    }
    const neg = (a.v < 0n) !== (b.v < 0n);
    const av = a.v < 0n ? -a.v : a.v;
    const bv = b.v < 0n ? -b.v : b.v;
    // numerator = av * 10^(sOut + b.s) / (bv * 10^a.s), all-integer, one rounding.
    const numShift = sOut + b.s;
    const den = bv * _pow10(a.s);
    const num = av * _pow10(numShift > MAX_SCALE * 2 ? MAX_SCALE * 2 : numShift);
    // numShift can exceed MAX_SCALE*2 only for absurd scales; both are bounded above,
    // and _requireScale caps sOut at MAX_SCALE, so numShift <= 2*MAX_SCALE always.
    let q = num / den;
    const r = num % den;
    if (r !== 0n) {
      const twice = r * 2n;
      let inc = false;
      switch (mode) {
        case 'truncate': inc = false; break;
        case 'floor': inc = neg; break;
        case 'ceiling': inc = !neg; break;
        case 'half_up': inc = twice >= den; break;
        case 'half_down': inc = twice > den; break;
        case 'half_even': inc = twice > den || (twice === den && (q % 2n) === 1n); break;
        default: throw new MoneyRefusal('REFUSED_UNKNOWN_ROUNDING_MODE', 'internal: unreached mode ' + String(mode));
      }
      if (inc) q += 1n;
    }
    return { v: neg ? -q : q, s: sOut };
  },

  /**
   * allocate(total, weights) -> array of {v: BigInt, s: total.s}
   * Largest-remainder apportionment: each part starts at floor(share), the residual
   * minor units are handed out one each to the largest fractional remainders, ties
   * broken by LOWER index (deterministic, no sort instability). The parts ALWAYS sum
   * exactly to total - there is no residue and no plug. Zero weights are legal and
   * receive exactly 0. A negative total is allocated as the exact sign-mirror of the
   * positive allocation of its magnitude (allocate(-T, w) === -allocate(T, w)), so
   * sign symmetry and the exact sum both hold. A zero/negative weight sum, a negative
   * weight, or arity above MAX_ALLOC_PARTS is refused. No rounding mode: the method
   * itself (floor + largest remainder) IS the declared allocation policy.
   */
  allocate(total, weights) {
    // Types are asserted, not inferred: total is a validated {v: BigInt, s} and
    // weights a validated bigint[] (both _requireValue/refused above), so the
    // bigint operators below are sound for the jsdoc-checkjs gate.
    _requireValue(total, 'allocate');
    const tv = /** @type {bigint} */ (total.v);
    const ws = /** @type {bigint[]} */ (weights);
    if (!Array.isArray(weights) || weights.length === 0) {
      throw new MoneyRefusal('REFUSED_ALLOCATE_WEIGHTS', 'weights must be a non-empty array');
    }
    if (weights.length > MAX_ALLOC_PARTS) {
      throw new MoneyRefusal('REFUSED_ALLOCATE_WEIGHTS', 'arity ' + String(weights.length) + ' exceeds MAX_ALLOC_PARTS=' + String(MAX_ALLOC_PARTS));
    }
    if (tv < 0n) {
      return _money.allocate({ v: -tv, s: total.s }, ws).map((p) => ({ v: -p.v, s: p.s }));
    }
    let wsum = 0n;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i];
      if (typeof w !== 'bigint' || w < 0n) {
        throw new MoneyRefusal('REFUSED_ALLOCATE_WEIGHTS', 'weight[' + String(i) + '] must be a non-negative BigInt, got ' + JSON.stringify(w === undefined ? 'undefined' : String(w)));
      }
      wsum += /** @type {bigint} */ (w);
    }
    if (wsum === 0n) {
      throw new MoneyRefusal('REFUSED_ALLOCATE_WEIGHTS', 'weight sum is zero');
    }
    const floors = new Array(weights.length);
    const rems = new Array(weights.length);
    let used = 0n;
    for (let i = 0; i < weights.length; i++) {
      const num = tv * ws[i];
      const q = num / wsum; // BigInt division truncates toward zero; total.v >= 0 so this is floor
      floors[i] = q;
      rems[i] = num - q * wsum;
      used += q;
    }
    let leftover = tv - used;
    const order = [];
    for (let i = 0; i < weights.length; i++) order.push(i);
    // Deterministic selection: repeatedly take the largest remainder, ties to the
    // lower index. N is bounded by MAX_ALLOC_PARTS; no policy-driven loop bound.
    while (leftover > 0n) {
      let best = -1;
      for (let i = 0; i < order.length; i++) {
        const idx = order[i];
        if (rems[idx] < 0n) continue; // already promoted
        if (best === -1 || rems[idx] > rems[best]) best = idx;
      }
      if (best === -1) {
        throw new MoneyRefusal('REFUSED_ALLOCATE_WEIGHTS', 'internal: remainder exhausted before total was placed');
      }
      floors[best] += 1n;
      rems[best] = -1n; // promoted; never promoted twice
      leftover -= 1n;
    }
    return floors.map((v) => ({ v, s: total.s }));
  },

  /**
   * toString(value, places?, mode?) -> string, receipt form.
   * places defaults to the value's own scale (exact rendering, sign-minimal: no
   * leading '+', no "-0", trailing zeros kept so the scale is visible). When places
   * exceeds the value's scale the extra digits are exact zeros. When rendering needs
   * to ROUND (places < value scale) a mode is REQUIRED; omitting it there is
   * REFUSED_ROUNDING_MODE_REQUIRED - "no default mode" holds to the receipt boundary.
   */
  toString(value, places, mode) {
    _requireValue(value, 'toString');
    const s = places === undefined || places === null ? value.s : _requireScale(places, 'toString');
    let v = value.v;
    if (s !== value.s) {
      if (s > value.s) {
        v = v * _pow10(s - value.s);
      } else {
        if (mode === undefined || mode === null) {
          throw new MoneyRefusal('REFUSED_ROUNDING_MODE_REQUIRED', 'toString needs places ' + String(s) + ' < value scale ' + String(value.s) + '; pass an explicit mode from the closed set');
        }
        _requireMode(mode, 'toString');
        v = _rescale(value, s, mode);
      }
    }
    const neg = v < 0n;
    let digits = (neg ? -v : v).toString();
    let out;
    if (s === 0) {
      out = digits;
    } else {
      while (digits.length <= s) digits = '0' + digits;
      out = digits.slice(0, digits.length - s) + '.' + digits.slice(digits.length - s);
    }
    return (neg && v !== 0n ? '-' : '') + out;
  },

  /** add/sub/cmp at a common scale - exact, no mode. Mismatched scales are refused
   *  (the caller rescales with an explicit mode instead of the bundle guessing). */
  add(a, b) {
    _requireValue(a, 'add');
    _requireValue(b, 'add');
    if (a.s !== b.s) throw new MoneyRefusal('REFUSED_SCALE_MISMATCH', 'add requires equal scales; rescale explicitly');
    return { v: a.v + b.v, s: a.s };
  },

  sub(a, b) {
    _requireValue(a, 'sub');
    _requireValue(b, 'sub');
    if (a.s !== b.s) throw new MoneyRefusal('REFUSED_SCALE_MISMATCH', 'sub requires equal scales; rescale explicitly');
    return { v: a.v - b.v, s: a.s };
  },

  /** -1 | 0 | 1 at equal scales; REFUSED_SCALE_MISMATCH otherwise. */
  cmp(a, b) {
    _requireValue(a, 'cmp');
    _requireValue(b, 'cmp');
    if (a.s !== b.s) throw new MoneyRefusal('REFUSED_SCALE_MISMATCH', 'cmp requires equal scales; rescale explicitly');
    return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
  },
};

export { MoneyRefusal, MAX_DIGITS, MAX_SCALE, MAX_ALLOC_PARTS };
export const isParseable = _money.isParseable;
export const parseDecimal = _money.parseDecimal;
export const round = _money.round;
export const mul = _money.mul;
export const div = _money.div;
export const allocate = _money.allocate;
export const toString = _money.toString;
export const add = _money.add;
export const sub = _money.sub;
export const cmp = _money.cmp;
export default _money;
