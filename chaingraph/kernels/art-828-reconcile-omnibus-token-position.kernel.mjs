import { executionHash } from './_hash.mjs';

// art-828-reconcile-omnibus-token-position — venue-neutral reconciliation of a
// tokenized-securities omnibus position against caller-declared state. The
// caller pastes AGGREGATES ONLY: an omnibus balance, a custodial book-entry
// position, per-wallet balances under opaque labels, and an event log of
// mint/burn/forced-transfer/transfer entries. The kernel recomputes three
// things and nothing else: the sum of the declared wallet balances, the two
// deltas (omnibus vs wallets, omnibus vs book), and a hash-chained head over
// the declared events in seq order. Everything is caller-asserted: the kernel
// reads no ledger, queries no chain, and cannot prove any declared balance is
// real. DTS is the first profile of the venue-neutral arithmetic; a generic
// omnibus profile applies the same sums without the registered-wallet rule.
//
// METHOD (exact integer arithmetic; base units as decimal strings parsed to
// BigInt, never floats):
//   sum_wallets        = sum of every declared wallet balance (none dropped,
//                        including wallets that violate the profile rule --
//                        those are flagged, never silently removed)
//   omnibus_vs_wallets = omnibus_balance - sum_wallets
//   omnibus_vs_book    = omnibus_balance - book_entry_position
//   verdict            = RECONCILED  when every computable leg is within
//                                     tolerance_units and no rule flag fires
//                        MISMATCH    when any computable leg exceeds
//                                     tolerance, or the profile rule is
//                                     violated (an unregistered wallet
//                                     holding a balance under the DTS
//                                     profile: tokens are only transferable
//                                     to registered wallets, so the declared
//                                     state contradicts the rule)
//                        UNDECIDABLE when neither leg is computable (no
//                                     omnibus balance, or both other legs
//                                     absent) -- well-formed but insufficient
//   event_log_head     = chained SHA-256 over the events sorted by seq:
//                        entry_i = { prev, seq, kind, amount, wallet_label }
//                        where prev is the previous entry's digest string or
//                        null at genesis; each digest is 'sha256:' + hex over
//                        the JCS-canonical entry bytes. Head is the last
//                        digest, null when no events are declared.
//
// DECLARED-STATE REFUSALS (closed set, each with a reachable path + fixture):
//   - a JSON number where a decimal-string balance/amount belongs (floats
//     included: a number is never a decimal string here);
//   - a fractional or signed decimal string ("1.5", "-3"): units are exact
//     non-negative integers;
//   - a malformed decimal string (empty, non-digit characters), or a wallet
//     / event entry whose balance / amount member is missing entirely;
//   - a wallet label outside [A-Za-z0-9_-]{1,40};
//   - a duplicate wallet label, a duplicate event seq, an event kind outside
//     the four-value enum, a seq that is not a non-negative integer;
//   - a wallet entry whose registered flag is not a boolean;
//   - an identifier-shaped label (email, LEI, IBAN, long digit-run account
//     number): refused BEFORE the charset check and never echoed -- labels are
//     opaque handles, not identity fields;
//   - a profile outside the two-value enum, a tolerance that is not a
//     non-negative integer, an as_of outside YYYY-MM-DD shape.
//
// Absent-but-well-formed inputs are never refused: they are flagged
// (PROFILE_ABSENT, AS_OF_ABSENT, OMNIBUS_ABSENT, WALLET_LEG_ABSENT,
// BOOK_LEG_ABSENT, EVENTS_ABSENT) and the arithmetic proceeds over whatever
// legs remain, so a receipt always states exactly what it could and could not
// reconcile. manual_review_required is true whenever any flag fired.
//
// Pure ECMA-262 + BigInt only -- no Date, no Math.random, no network, no
// clock read (as_of is a caller-declared label). All digesting below is
// synchronous via the inlined pure-JS core (see note at _sha256).

const TOOL_ID = 'art-828-reconcile-omnibus-token-position';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'reconcile_omnibus_position',
  mandate_type: 'compliance_control', gpu: false,
};

const PROFILES = ['dtc_dts', 'generic_omnibus'];
const EVENT_KINDS = ['mint', 'burn', 'forced_transfer', 'transfer'];
const LABEL_RE = /^[A-Za-z0-9_-]{1,40}$/;
const AS_OF_RE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_RE = /^(0|[1-9][0-9]*)$/;

// ---- inlined sync digest core (verbatim algorithm proven in guest) ----
// Pure-JS SHA-256 (sync). Byte-identical to WebCrypto (verified vs NIST
// vectors + every fixture), inlined because compute() must stay synchronous
// for the fixture oracle / VM parity harness, while the zkVM guest provides
// no synchronous crypto and no TextEncoder. The hashed strings below are
// pure ASCII by construction (enforced label charset, enum kinds, digit
// strings), where every UTF-8 encoder is byte-identical. This core digests
// ONLY the event-log chain; the artifact execution_hash still flows through
// the shared ./_hash.mjs executionHash -- there is no second canonicalizer
// for it and no hand-built preimage anywhere.
function _utf8Bytes(str) {
  const s = String(str), out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = s.charCodeAt(++i);
      const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return new Uint8Array(out);
}
function _sha256(bytes) {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);
  const msgLen = bytes.length;
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  const bitLen = msgLen * 8;
  for (let i = 0; i < 8; i++) padded[paddedLen - 8 + i] = Number((BigInt(bitLen) >> BigInt(56 - i * 8)) & 0xffn);
  let [h0,h1,h2,h3,h4,h5,h6,h7] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x,n) => (x>>>n)|(x<<(32-n));
  for (let cs = 0; cs < paddedLen; cs += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) { const j=cs+i*4; W[i]=(padded[j]<<24)|(padded[j+1]<<16)|(padded[j+2]<<8)|padded[j+3]; }
    for (let i = 16; i < 64; i++) {
      const s0=rotr(W[i-15],7)^rotr(W[i-15],18)^(W[i-15]>>>3);
      const s1=rotr(W[i-2],17)^rotr(W[i-2],19)^(W[i-2]>>>10);
      W[i]=(W[i-16]+s0+W[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,h]=[h0,h1,h2,h3,h4,h5,h6,h7];
    for (let i = 0; i < 64; i++) {
      const S1=rotr(e,6)^rotr(e,11)^rotr(e,25), ch=(e&f)^(~e&g);
      const t1=(h+S1+ch+K[i]+W[i])>>>0;
      const S0=rotr(a,2)^rotr(a,13)^rotr(a,22), maj=(a&b)^(a&c)^(b&c);
      const t2=(S0+maj)>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;
    h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
  }
  const r=new Uint8Array(32);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach((v,i)=>{const j=i*4;r[j]=v>>>24;r[j+1]=(v>>>16)&0xff;r[j+2]=(v>>>8)&0xff;r[j+3]=v&0xff;});
  return r;
}
function sha256Hex(str) {
  return Array.from(_sha256(_utf8Bytes(String(str)))).map((b) => b.toString(16).padStart(2, '0')).join('');
}
// RFC 8785/JCS canonicalization -- byte-identical copy of _hash.mjs's cgCanon
// (key sort at every depth, array order preserved), inlined for the same
// sandbox reason as _sha256. The artifact execution_hash path is untouched.
function cgCanon(v) {
  if (Array.isArray(v)) return v.map(cgCanon);
  if (v !== null && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {});
  return v;
}

function refused(field, because) {
  return { field, because };
}

// Read one decimal-string balance/amount. Returns { kind: 'absent' } | { kind: 'ok', units: BigInt, text } |
// { kind: 'refused', field, because }. A JSON number is refused before any
// coercion (floats included); strings are validated as exact non-negative
// integer decimals and normalized (leading zeros collapse via BigInt).
function readUnits(v, field) {
  if (v === undefined || v === null) return { kind: 'absent' };
  if (typeof v === 'number') return { kind: 'refused', ...refused(field, 'number_not_decimal_string') };
  if (typeof v !== 'string') return { kind: 'refused', ...refused(field, 'malformed_decimal_string') };
  const s = v.trim();
  if (s.startsWith('-')) return { kind: 'refused', ...refused(field, 'negative_balance_refused') };
  if (s.includes('.') || s.toLowerCase().includes('e')) return { kind: 'refused', ...refused(field, 'fractional_units_refused') };
  if (!DECIMAL_RE.test(s)) return { kind: 'refused', ...refused(field, 'malformed_decimal_string') };
  return { kind: 'ok', units: BigInt(s), text: BigInt(s).toString() };
}

// Identifier-shape scan for one label. Runs BEFORE the charset check so an
// email-shaped label is refused as PII, not as a charset violation, and the
// offending value is never echoed in either branch.
function labelPiiShape(label) {
  if (label.includes('@')) return 'pii_email_shaped_label';
  if (/^[A-Z0-9]{20}$/.test(label)) return 'pii_lei_shaped_label';
  if (/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(label)) return 'pii_iban_shaped_label';
  if (/^\d{9,}$/.test(label)) return 'pii_account_number_shaped_label';
  return null;
}

function readLabel(v, field) {
  if (typeof v !== 'string') return { kind: 'refused', ...refused(field, 'wallet_label_charset_invalid') };
  const pii = labelPiiShape(v);
  if (pii) return { kind: 'refused', ...refused(field, pii) };
  if (!LABEL_RE.test(v)) return { kind: 'refused', ...refused(field, 'wallet_label_charset_invalid') };
  return { kind: 'ok', label: v };
}

export function compute(pp) {
  pp = pp || {};

  // -- Pass 1: profile, as_of, tolerance (scalars).
  let profile = 'generic_omnibus';
  const flags = [];
  if (pp.profile !== undefined && pp.profile !== null) {
    if (typeof pp.profile !== 'string' || !PROFILES.includes(pp.profile)) {
      return buildRefusal(refused('profile', 'profile_not_in_declared_enum'));
    }
    profile = pp.profile;
  } else {
    flags.push('PROFILE_ABSENT');
  }

  let as_of = null;
  if (pp.as_of !== undefined && pp.as_of !== null) {
    if (typeof pp.as_of !== 'string' || !AS_OF_RE.test(pp.as_of)) {
      return buildRefusal(refused('as_of', 'as_of_malformed'));
    }
    as_of = pp.as_of;
  } else {
    flags.push('AS_OF_ABSENT');
  }

  let tolerance = 0n;
  if (pp.tolerance_units !== undefined && pp.tolerance_units !== null) {
    const t = pp.tolerance_units;
    if (typeof t !== 'number' || !Number.isInteger(t) || t < 0) {
      return buildRefusal(refused('tolerance_units', 'tolerance_out_of_domain'));
    }
    tolerance = BigInt(t);
  }

  // -- Pass 2: the three balances (omnibus, book) -- strings located before coercion.
  const omnibus = readUnits(pp.omnibus_balance, 'omnibus_balance');
  if (omnibus.kind === 'refused') return buildRefusal(omnibus);
  const book = readUnits(pp.book_entry_position, 'book_entry_position');
  if (book.kind === 'refused') return buildRefusal(book);
  if (omnibus.kind === 'absent') flags.push('OMNIBUS_ABSENT');
  if (book.kind === 'absent') flags.push('BOOK_LEG_ABSENT');

  // -- Pass 3: wallets[] (aggregate balances under opaque labels).
  let wallets = null;
  if (pp.wallets !== undefined && pp.wallets !== null) {
    if (!Array.isArray(pp.wallets)) return buildRefusal(refused('wallets', 'wallets_not_an_array'));
    wallets = [];
    const seen = new Set();
    for (let i = 0; i < pp.wallets.length; i++) {
      const w = pp.wallets[i];
      const wf = 'wallets[' + i + ']';
      if (w === null || typeof w !== 'object' || Array.isArray(w)) {
        return buildRefusal(refused(wf, 'wallet_entry_not_object'));
      }
      const lab = readLabel(w.wallet_label, wf + '.wallet_label');
      if (lab.kind === 'refused') return buildRefusal(lab);
      if (seen.has(lab.label)) return buildRefusal(refused(wf + '.wallet_label', 'wallet_label_duplicate'));
      seen.add(lab.label);
      const bal = readUnits(w.balance, wf + '.balance');
      if (bal.kind === 'refused') return buildRefusal(bal);
      if (bal.kind === 'absent') return buildRefusal(refused(wf + '.balance', 'wallet_balance_absent'));
      if (typeof w.registered !== 'boolean') {
        return buildRefusal(refused(wf + '.registered', 'wallet_registered_not_boolean'));
      }
      wallets.push({ label: lab.label, units: bal.units, text: bal.text, registered: w.registered });
    }
  } else {
    flags.push('WALLET_LEG_ABSENT');
  }

  // -- Pass 4: events[] (hash-chained log, sorted by seq).
  let events = null;
  if (pp.events !== undefined && pp.events !== null) {
    if (!Array.isArray(pp.events)) return buildRefusal(refused('events', 'events_not_an_array'));
    events = [];
    const seqs = new Set();
    for (let i = 0; i < pp.events.length; i++) {
      const ev = pp.events[i];
      const ef = 'events[' + i + ']';
      if (ev === null || typeof ev !== 'object' || Array.isArray(ev)) {
        return buildRefusal(refused(ef, 'event_entry_not_object'));
      }
      if (typeof ev.seq !== 'number' || !Number.isInteger(ev.seq) || ev.seq < 0) {
        return buildRefusal(refused(ef + '.seq', 'event_seq_out_of_domain'));
      }
      if (seqs.has(ev.seq)) return buildRefusal(refused(ef + '.seq', 'event_seq_duplicate'));
      seqs.add(ev.seq);
      if (typeof ev.kind !== 'string' || !EVENT_KINDS.includes(ev.kind)) {
        return buildRefusal(refused(ef + '.kind', 'event_kind_not_in_enum'));
      }
      const amt = readUnits(ev.amount, ef + '.amount');
      if (amt.kind === 'refused') return buildRefusal(amt);
      if (amt.kind === 'absent') return buildRefusal(refused(ef + '.amount', 'event_amount_absent'));
      const lab = readLabel(ev.wallet_label, ef + '.wallet_label');
      if (lab.kind === 'refused') return buildRefusal(lab);
      events.push({ seq: ev.seq, kind: ev.kind, amount: amt.text, wallet_label: lab.label });
    }
    events.sort((a, b) => a.seq - b.seq);
  } else {
    flags.push('EVENTS_ABSENT');
  }

  // -- Arithmetic (exact BigInt; every output balance is a decimal string).
  const sumWallets = wallets === null ? null : wallets.reduce((acc, w) => acc + w.units, 0n);
  const walletsLeg = omnibus.kind === 'ok' && wallets !== null;
  const bookLeg = omnibus.kind === 'ok' && book.kind === 'ok';
  const deltaWallets = walletsLeg ? omnibus.units - sumWallets : null;
  const deltaBook = bookLeg ? omnibus.units - book.units : null;
  const abs = (x) => (x < 0n ? -x : x);
  const within = (d) => (d === null ? null : abs(d) <= tolerance);
  const legs = {
    wallets_leg_computable: walletsLeg,
    book_leg_computable: bookLeg,
    omnibus_vs_wallets_within_tolerance: within(deltaWallets),
    omnibus_vs_book_within_tolerance: within(deltaBook),
  };

  // Profile rule (DTS profile only): tokens are only transferable to
  // registered wallets, so an unregistered wallet holding a balance is a
  // declared state the rule excludes. Flagged, never dropped from the sum.
  const unregisteredHolders = wallets === null ? 0 : wallets.filter((w) => !w.registered && w.units > 0n).length;
  if (profile === 'dtc_dts' && unregisteredHolders > 0) flags.push('UNREGISTERED_WALLET_BALANCE');

  // Event chain: entry digest over the JCS-canonical {prev, seq, kind,
  // amount, wallet_label}; head is the last digest (null: no events).
  let eventLogHead = null;
  const eventCounts = { mint: 0, burn: 0, forced_transfer: 0, transfer: 0 };
  if (events !== null) {
    let prev = null;
    for (const ev of events) {
      const entry = { prev, seq: ev.seq, kind: ev.kind, amount: ev.amount, wallet_label: ev.wallet_label };
      prev = 'sha256:' + sha256Hex(JSON.stringify(cgCanon(entry)));
      eventCounts[ev.kind]++;
    }
    eventLogHead = events.length > 0 ? prev : null;
  }

  // -- Verdict.
  let verdict;
  if (!walletsLeg && !bookLeg) {
    verdict = 'UNDECIDABLE';
  } else {
    const legMismatch = (legs.omnibus_vs_wallets_within_tolerance === false)
      || (legs.omnibus_vs_book_within_tolerance === false);
    const ruleViolation = flags.includes('UNREGISTERED_WALLET_BALANCE');
    verdict = (legMismatch || ruleViolation) ? 'MISMATCH' : 'RECONCILED';
  }

  const warnings = flags.slice();
  const manualReview = flags.length > 0;

  return {
    output_payload: {
      verdict,
      profile,
      as_of,
      tolerance_units: Number(tolerance),
      omnibus_balance: omnibus.kind === 'ok' ? omnibus.text : null,
      book_entry_position: book.kind === 'ok' ? book.text : null,
      wallet_count: wallets === null ? null : wallets.length,
      registered_wallet_count: wallets === null ? null : wallets.filter((w) => w.registered).length,
      unregistered_wallet_count: wallets === null ? null : wallets.filter((w) => !w.registered).length,
      unregistered_wallets_holding_balance: wallets === null ? null : unregisteredHolders,
      sum_wallets: sumWallets === null ? null : sumWallets.toString(),
      omnibus_vs_wallets_delta: deltaWallets === null ? null : deltaWallets.toString(),
      omnibus_vs_book_delta: deltaBook === null ? null : deltaBook.toString(),
      legs,
      event_log_head: eventLogHead,
      events_counted: events === null ? null : events.length,
      event_counts: events === null ? null : eventCounts,
      forced_transfer_count: events === null ? null : eventCounts.forced_transfer,
      warnings,
      evidence: {
        record_type: 'omnibus_token_reconciliation',
        tool_id: TOOL_ID,
        tool_version: TOOL_VERSION,
        method: 'declared_state_recompute',
        balances_caller_asserted: true,
        reads_no_ledger: true,
        arithmetic_only: true,
        pii_carried: false,
        refused: false,
      },
      manual_review_required: manualReview,
    },
    compliance_flags: flags,
  };
}

// Refusal payload: structured non-verdict naming the branch; the refused
// value is never echoed. manual_review_required mirrors the INPUT_REFUSED flag.
function buildRefusal(r) {
  // The flag is earned by the refusal reason being named, not emitted as a constant.
  const compliance_flags = [];
  if (r.because) compliance_flags.push('INPUT_REFUSED');
  return {
    output_payload: {
      verdict: 'refused',
      refused_because: r.because,
      refused_field: r.field,
      profile: null,
      as_of: null,
      tolerance_units: null,
      omnibus_balance: null,
      book_entry_position: null,
      wallet_count: null,
      registered_wallet_count: null,
      unregistered_wallet_count: null,
      unregistered_wallets_holding_balance: null,
      sum_wallets: null,
      omnibus_vs_wallets_delta: null,
      omnibus_vs_book_delta: null,
      legs: null,
      event_log_head: null,
      events_counted: null,
      event_counts: null,
      forced_transfer_count: null,
      warnings: compliance_flags.slice(),
      evidence: {
        record_type: 'omnibus_token_reconciliation',
        tool_id: TOOL_ID,
        tool_version: TOOL_VERSION,
        method: 'declared_state_recompute',
        balances_caller_asserted: true,
        reads_no_ledger: true,
        arithmetic_only: true,
        pii_carried: false,
        refused: true,
      },
      manual_review_required: true,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
