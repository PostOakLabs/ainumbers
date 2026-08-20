import { executionHash } from './_hash.mjs';

// art-653-pta-verifier — plain-text-accounting verification kernel.
// journal text (synthetic) -> parse -> double-entry validation -> balance
// assertions -> Merkle root -> Evidence Envelope v0.1 receipt fields.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no
// network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, which
// lacks TextEncoder/atob/btoa/URL, so all hashing below is hand-rolled (sha256 over
// Uint8Array, utf8ToBytes for string encoding) rather than crypto.subtle/TextEncoder.

// ---------- UTF-8 encoding (guest has no TextEncoder — ART595-ART590-UTF8-FIX-1 shape) ----------
function utf8ToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i++;
      } else {
        code = 0xfffd; // unpaired high surrogate
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd; // lone low surrogate
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return Uint8Array.from(bytes);
}

// ---------- sha256 (hand-rolled, no crypto.subtle — guest-safe; RIDER-KERNEL.md art-476 lesson) ----------
function _sha256(bytes) {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  const msgLen = bytes.length;
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  const bitLen = msgLen * 8;
  for (let i = 0; i < 8; i++) {
    padded[paddedLen - 8 + i] = Number((BigInt(bitLen) >> BigInt(56 - i * 8)) & 0xffn);
  }
  let [h0, h1, h2, h3, h4, h5, h6, h7] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let cs = 0; cs < paddedLen; cs += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) { const j = cs + i * 4; W[i] = (padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]; }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const r = new Uint8Array(32);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => { const j = i * 4; r[j] = v >>> 24; r[j + 1] = (v >>> 16) & 0xff; r[j + 2] = (v >>> 8) & 0xff; r[j + 3] = v & 0xff; });
  return r;
}
function bytesToHex(bytes) { return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''); }
function concatBytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
function sha256Hex(bytes) { return bytesToHex(_sha256(bytes)); }

// RFC 6962 MTH (Merkle Tree Hash), recursive: MTH({}) = SHA-256(''); MTH({d0})=leaf(d0);
// MTH(D[n]) = interior(MTH(D[0:k]), MTH(D[k:n])), k = largest power of two < n.
// Matches chaingraph/kernels/c2sp-tlog-verify.mjs's 0x00/0x01-prefixed leaf/interior scheme
// (same hashing convention as the shared tlog verifier, kept sync/guest-safe here).
function merkleLeafHash(dataBytes) { return _sha256(concatBytes([new Uint8Array([0x00]), dataBytes])); }
function merkleInteriorHash(left, right) { return _sha256(concatBytes([new Uint8Array([0x01]), left, right])); }
function merkleRoot(leafDataList) {
  const n = leafDataList.length;
  if (n === 0) return _sha256(new Uint8Array(0));
  if (n === 1) return merkleLeafHash(leafDataList[0]);
  let k = 1;
  while (k * 2 < n) k *= 2;
  const left = merkleRoot(leafDataList.slice(0, k));
  const right = merkleRoot(leafDataList.slice(k));
  return merkleInteriorHash(left, right);
}

// ---------- canonical JSON (recursive key-sort, mirrors _hash.mjs cgCanon) ----------
function cgCanon(v) {
  if (Array.isArray(v)) return v.map(cgCanon);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = cgCanon(v[k]); return o; }, {});
  }
  return v;
}
function canonicalStringify(v) { return JSON.stringify(cgCanon(v)); }

// ---------- decimal-string -> integer cents (avoids float drift) ----------
function amountToCents(raw) {
  const s = raw.replace(/,/g, '').trim();
  const neg = s.startsWith('-');
  const unsigned = neg ? s.slice(1) : (s.startsWith('+') ? s.slice(1) : s);
  const [intPartRaw, decPartRaw = ''] = unsigned.split('.');
  const intPart = intPartRaw === '' ? '0' : intPartRaw;
  const decPart = (decPartRaw + '00').slice(0, 2);
  if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(decPartRaw)) return null;
  const cents = parseInt(intPart, 10) * 100 + parseInt(decPart, 10);
  return neg ? -cents : cents;
}

const DATE_RE = /^\d{4}[-/]\d{2}[-/]\d{2}/;
// account (no double-space run) then >=2 spaces/tab then amount, optional " = assertion".
const POSTING_RE = /^[ \t]+(\S(?:[^\t]*?\S)?)(?:[ \t]{2,}|\t)(-?\+?[\d,]+\.?\d*)(?:\s*=\s*(-?\+?[\d,]+\.?\d*))?\s*$/;
const POSTING_NOAMOUNT_RE = /^[ \t]+(\S(?:.*\S)?)\s*$/;

function parseJournal(journalText) {
  const lines = String(journalText || '').split('\n');
  const transactions = [];
  const unsupported_directives = [];
  let cur = null;

  function closeCurrent() {
    if (cur) transactions.push(cur);
    cur = null;
  }

  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln];
    const lineNo = ln + 1;
    if (raw.trim() === '') { closeCurrent(); continue; }

    const isIndented = /^[ \t]/.test(raw);
    if (!isIndented) {
      if (DATE_RE.test(raw)) {
        closeCurrent();
        const m = raw.match(DATE_RE);
        const date = m[0];
        const description = raw.slice(m[0].length).trim();
        cur = { date, description, postings: [], line: lineNo };
      } else {
        closeCurrent();
        unsupported_directives.push({ line: lineNo, text: raw });
      }
      continue;
    }

    // indented line -> posting (only meaningful inside an open transaction)
    if (!cur) {
      unsupported_directives.push({ line: lineNo, text: raw });
      continue;
    }
    const pm = raw.match(POSTING_RE);
    if (pm) {
      const account = pm[1].trim();
      const cents = amountToCents(pm[2]);
      const assertedCents = pm[3] != null ? amountToCents(pm[3]) : null;
      if (cents === null) {
        unsupported_directives.push({ line: lineNo, text: raw });
        continue;
      }
      cur.postings.push({ account, cents, elided: false, assertedCents, line: lineNo });
      continue;
    }
    const nm = raw.match(POSTING_NOAMOUNT_RE);
    if (nm) {
      cur.postings.push({ account: nm[1].trim(), cents: null, elided: true, assertedCents: null, line: lineNo });
      continue;
    }
    unsupported_directives.push({ line: lineNo, text: raw });
  }
  closeCurrent();

  return { transactions, unsupported_directives };
}

export function compute(pp) {
  pp = pp || {};
  const journal_text = typeof pp.journal_text === 'string' ? pp.journal_text : '';
  const { transactions, unsupported_directives } = parseJournal(journal_text);

  const accountBalancesCents = {}; // running, applied in journal order
  const imbalanced_transactions = [];
  const balance_assertion_failures = [];
  let balanced_transaction_count = 0;
  let balance_assertions_checked = 0;

  const leafDataList = [];

  transactions.forEach((txn, idx) => {
    const elidedPostings = txn.postings.filter((p) => p.elided);
    let resolvedPostings = txn.postings;
    let status = 'balanced';
    let imbalanceCents = 0;

    if (elidedPostings.length > 1) {
      status = 'unsupported_multiple_elided_postings';
    } else {
      const known = txn.postings.filter((p) => !p.elided);
      const sum = known.reduce((s, p) => s + p.cents, 0);
      if (elidedPostings.length === 1) {
        const filled = -sum;
        resolvedPostings = txn.postings.map((p) => (p.elided ? { ...p, cents: filled, elided: false } : p));
        imbalanceCents = 0;
      } else {
        imbalanceCents = sum;
      }
      if (imbalanceCents !== 0) status = 'imbalanced';
    }

    if (status === 'balanced') {
      balanced_transaction_count++;
    } else {
      imbalanced_transactions.push({
        index: idx,
        date: txn.date,
        description: txn.description,
        reason: status,
        imbalance_cents: imbalanceCents,
      });
    }

    // apply resolved postings to running account balances + check assertions, in file order
    if (status !== 'unsupported_multiple_elided_postings') {
      for (const p of resolvedPostings) {
        const prev = accountBalancesCents[p.account] || 0;
        const next = prev + (p.cents || 0);
        accountBalancesCents[p.account] = next;
        if (p.assertedCents !== null) {
          balance_assertions_checked++;
          if (p.assertedCents !== next) {
            balance_assertion_failures.push({
              account: p.account,
              line: p.line,
              expected_cents: p.assertedCents,
              actual_cents: next,
            });
          }
        }
      }
    }

    leafDataList.push(utf8ToBytes(canonicalStringify({
      index: idx,
      date: txn.date,
      description: txn.description,
      postings: resolvedPostings.map((p) => ({ account: p.account, cents: p.cents })),
    })));
  });

  const accounts = {};
  for (const k of Object.keys(accountBalancesCents).sort()) accounts[k] = accountBalancesCents[k];

  const root = merkleRoot(leafDataList);
  const merkle_root_hex = 'sha256:' + bytesToHex(root);

  const result_status = (imbalanced_transactions.length === 0 && balance_assertion_failures.length === 0) ? 'success' : 'error';

  const input_hash = 'sha256:' + sha256Hex(utf8ToBytes(journal_text));

  const findings = {
    parsed_transaction_count: transactions.length,
    balanced_transaction_count,
    imbalanced_transactions,
    balance_assertions_checked,
    balance_assertion_failures,
    unsupported_directives,
    accounts,
    merkle_root: merkle_root_hex,
  };
  const output_hash = 'sha256:' + sha256Hex(utf8ToBytes(canonicalStringify(findings)));

  const evidence_envelope = {
    schema: 'ainumbers.evidence.v0.1',
    event_type: 'journal_verification',
    source_adapter: 'native-tool',
    result_status,
    input_hash,
    output_hash,
    links: [],
    extensions: {
      transaction_count: transactions.length,
      balanced_transaction_count,
      imbalanced_count: imbalanced_transactions.length,
      balance_assertions_checked,
      balance_assertion_failure_count: balance_assertion_failures.length,
      unsupported_directive_count: unsupported_directives.length,
    },
    unprotected: { proofs: { merkle_root: merkle_root_hex } },
  };

  const output_payload = { ...findings, evidence_envelope };

  const compliance_flags = ['PTA_DOUBLE_ENTRY_VALIDATED'];
  if (imbalanced_transactions.length > 0) compliance_flags.push('PTA_IMBALANCED_TRANSACTIONS_FOUND');
  if (balance_assertion_failures.length > 0) compliance_flags.push('PTA_BALANCE_ASSERTION_FAILED');
  if (unsupported_directives.length > 0) compliance_flags.push('PTA_UNSUPPORTED_DIRECTIVES_SKIPPED');
  if (result_status === 'success') compliance_flags.push('PTA_JOURNAL_VERIFIED');

  return { output_payload, compliance_flags };
}

export const meta = {
  tool_id: 'art-653-pta-verifier',
  tool_version: '1.0.0',
  mcp_name: 'compute_pta_verifier',
  mandate_type: 'compliance_control',
  gpu: false,
};

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: meta.tool_id,
    tool_version: meta.tool_version,
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
