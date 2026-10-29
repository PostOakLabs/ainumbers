import { executionHash } from './_hash.mjs';

// 783-emv-mpm-qr-validator — decode and validate an EMV merchant-presented QR payload
// against a pluggable national scheme profile (generic EMV MPM, Fiji FJQR, Brazil Pix
// BR Code). Values-only, zero-PII, zero-network: a dynamic payload URL is never fetched,
// only its shape is checked; the optional signed-envelope input carries a JWS protected
// header SKELETON only (no signature verification, no key material).
//
// NO-ECHO CONTRACT (behaviour, enforced by proptest): merchant-bearing field values —
// tag 59 (merchant name), 61 (postal), 62 subfield values, 64-01/64-02 values, and every
// merchant account identifier inside tags 26-51 other than the template GUID — are NEVER
// copied into the output. They are reported as {tag, length, verdict} only. Echo is
// allowed for structural root tags 00/01/52/53/54/58/63 and template GUID sub-values.
//
// Determinism: compute() is a pure function of pp — no Date/Math.random, no network, no
// filesystem, and no TextEncoder/atob/btoa/URL (zkVM guest subset). UTF-8 needs are met
// by the pure-JS encoder below (ART595-ART590-UTF8-FIX-1, byte-identical to TextEncoder).
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

const TOOL_ID = '783-emv-mpm-qr-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_emv_mpm_qr_payload',
  mandate_type: 'compliance_control', gpu: false,
};

// ── scheme profiles (engine data, mirrored in fixtures/783-emv-mpm-qr-validator.profiles.json;
//    the proptest asserts the mirror and the kernel copy are deep-equal) ──────────────────
// sourceKey values resolve through the node shard's cited_clause_digest and the pinned
// clause snapshots; they are behavioural locator data, not reproduced spec text.
const SOURCES = {
  emv: 'EMV-MPM-v1.1',
  fjqr: 'RBF-FJQR-2026-05',
  bcbBrc: 'BCB-BRCode-2.0.0',
  bcbPix: 'BCB-Pix-Iniciacao',
  bcbSfn: 'BCB-SFN-Seg-Vol2',
};

const PROFILES = {
  generic: {
    key: 'generic',
    currency: null,
    country: null,
    required_guids: null, // null = any well-formed GUID accepted
    guid_registry_public: true,
    txid_required: false,
    addl_data_required: false,
    mode: 'open',
  },
  fjqr: {
    key: 'fjqr',
    currency: '242', // FJD
    country: null, // not pinned in the public guidelines text
    required_guids: null, // GUI registry lives in the non-public technical specification
    guid_registry_public: false,
    txid_required: false,
    addl_data_required: false,
    mode: 'static_launch',
  },
  pix_brcode: {
    key: 'pix_brcode',
    currency: '986', // BRL
    country: 'BR',
    required_guids: ['br.gov.bcb.pix'],
    guid_registry_public: true,
    txid_required: true,
    addl_data_required: true,
    mode: 'open',
  },
};

// Root tags whose value is structural (never merchant-identifying) and may be echoed.
const ECHO_SAFE_ROOT = new Set(['00', '01', '52', '53', '54', '58', '63']);
// Template tags whose sub-ID 00 (the GUID) may be echoed.
const GUID_TEMPLATES = new Set(['26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95','96','97','98','99']);
// Length caps for Additional Data Field Template (tag 62) sub-IDs.
const ADDL_SUB_CAP = { '01': 25, '02': 25, '03': 25, '04': 25, '05': 25, '06': 25, '07': 25, '08': 25, '09': 3, '10': 20, '11': 3 };

// Exported for the fixtures-dir data mirror (profiles as data): the proptest asserts this
// object stays deep-equal to fixtures/783-emv-mpm-qr-validator.profiles.json.
export const SCHEME_PROFILES = { profiles: PROFILES, sources: SOURCES, echo_safe_root: [...ECHO_SAFE_ROOT].sort(), addl_sub_cap: ADDL_SUB_CAP };

// JWS protected-header alg set (skeleton shape check only — never a signature check).
const JWS_ALG_ALLOWED = new Set(['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'PS256', 'PS384', 'PS512']);
const JWS_ALG_RECOMMENDED = new Set(['PS256', 'PS512']);

const PAYLOAD_BOUND = 2048; // bounded-input refusal guard (resource bound, not a spec limit)
const SPEC_PAYLOAD_SHOULD = 512; // documented "should not exceed" advisory limit

// ── CRC-16/CCITT-FALSE: polynomial 0x1021, init 0xFFFF, no reflection, xorout 0 ─────────
function crc16CcittFalse(bytes) {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}
function crcHex(bytes) {
  return crc16CcittFalse(bytes).toString(16).toUpperCase().padStart(4, '0');
}

// ── TLV parse: two-digit numeric ID, two-digit numeric length ────────────────────────────
function isDigits(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

function parseTlv(raw, tagPathPrefix, violations, counter) {
  // Returns {objects: [{id, len, value, path}], trailing: string|null}
  const objects = [];
  const seen = new Set();
  let i = 0;
  while (i < raw.length) {
    counter.n++;
    if (i + 4 > raw.length) {
      violations.push({ tag_path: tagPathPrefix, rule_id: 'TLV_TRUNCATED_HEADER', source: SOURCES.emv + '/4.3.1.1,4.4.1.1', severity: 'error' });
      return { objects, trailing: raw.slice(i) };
    }
    const id = raw.slice(i, i + 2);
    const lenStr = raw.slice(i + 2, i + 4);
    if (!isDigits(id) || !isDigits(lenStr)) {
      violations.push({ tag_path: tagPathPrefix, rule_id: 'TLV_NON_NUMERIC_ID_OR_LENGTH', source: SOURCES.emv + '/4.3.1.1,4.4.1.1', severity: 'error' });
      return { objects, trailing: raw.slice(i) };
    }
    const len = parseInt(lenStr, 10);
    const valueStart = i + 4;
    if (valueStart + len > raw.length) {
      violations.push({ tag_path: tagPathPrefix || id, rule_id: 'TLV_LENGTH_OVERRUN', source: SOURCES.emv + '/4.4.1.1', severity: 'error' });
      return { objects, trailing: raw.slice(i) };
    }
    const value = raw.slice(valueStart, valueStart + len);
    const path = tagPathPrefix ? tagPathPrefix + '.' + id : id;
    if (seen.has(id)) {
      violations.push({ tag_path: path, rule_id: 'DUPLICATE_TAG', source: SOURCES.emv + '/4.3.1.2', severity: 'error' });
    }
    seen.add(id);
    objects.push({ id, len, value, path });
    i = valueStart + len;
  }
  return { objects, trailing: null };
}

function amountShapeOk(v) {
  if (v.length === 0 || v.length > 13) return false;
  const parts = v.split('.');
  if (parts.length > 2) return false;
  for (const p of parts) {
    if (p.length === 0 || !isDigits(p)) return false;
  }
  if (parts.join('').split('').every((c) => c === '0')) return false; // shall be different from zero
  return true;
}

function guidShapeOk(v) {
  if (v.length === 0 || v.length > 32) return false;
  // AID (hex), UUID without hyphens (32 hex), or reverse domain — reject control chars/space
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c <= 32 || c >= 127) return false;
  }
  return true;
}

function urlish(v) {
  return v.indexOf('://') !== -1 || v.toLowerCase().indexOf('http://') === 0 || v.toLowerCase().indexOf('https://') === 0;
}

// ── compute ─────────────────────────────────────────────────────────────────────────────
export function compute(pp) {
  pp = pp || {};
  const compliance_flags = [];
  const counter = { n: 0 };

  const refuse = (refused_because, detail) => {
    compliance_flags.push('QR_REFUSED_' + refused_because.toUpperCase());
    return {
      output_payload: {
        valid: false,
        profile: typeof pp.profile === 'string' ? pp.profile : null,
        mode: null,
        tags: [],
        violations: [{ tag_path: '', rule_id: 'INPUT_REFUSED_' + refused_because.toUpperCase(), source: 'kernel-input-contract', severity: 'error' }],
        crc: { expected: null, found: null },
        rules_checked: counter.n,
        refused: { refused: true, refused_because, detail },
      },
      compliance_flags,
    };
  };

  // Refusal branches (authoring-standard refusal-carrying exclusions: every input shape the
  // kernel cannot carry to a verdict gets a structured non-verdict naming the branch; each
  // is reachable and fixture-proven).
  if (typeof pp.payload !== 'string') return refuse('payload_not_string', 'payload must be the QR code string');
  if (pp.payload.length === 0) return refuse('payload_empty', 'payload must be non-empty');
  if (pp.payload.length > PAYLOAD_BOUND) return refuse('payload_bound_exceeded', 'payload exceeds the bounded-input guard of ' + PAYLOAD_BOUND + ' characters');
  if (pp.profile !== undefined && pp.profile !== null && typeof pp.profile !== 'string') return refuse('profile_not_string', 'profile must be a string');
  const profileKey = pp.profile === undefined || pp.profile === null || pp.profile === '' ? 'generic' : pp.profile;
  if (!Object.prototype.hasOwnProperty.call(PROFILES, profileKey)) return refuse('profile_unknown', 'unknown profile: use one of generic, fjqr, pix_brcode');
  const profile = PROFILES[profileKey];
  if (pp.profile === undefined || pp.profile === null || pp.profile === '') compliance_flags.push('QR_PROFILE_DEFAULTED_GENERIC');
  if (pp.expect !== undefined && pp.expect !== null) {
    if (typeof pp.expect !== 'string' || (pp.expect !== 'static' && pp.expect !== 'dynamic')) {
      return refuse('expect_invalid', 'expect must be "static" or "dynamic"');
    }
  }
  let envelope = null;
  if (pp.dynamic_envelope !== undefined && pp.dynamic_envelope !== null) {
    if (typeof pp.dynamic_envelope !== 'object' || Array.isArray(pp.dynamic_envelope)) {
      return refuse('dynamic_envelope_not_object', 'dynamic_envelope must be an object (JWS protected-header skeleton: alg, typ, kid, jku)');
    }
    envelope = pp.dynamic_envelope;
  }

  const payload = pp.payload;
  const violations = [];
  const tagRows = [];

  const addV = (tag_path, rule_id, source, severity) => {
    violations.push({ tag_path, rule_id, source, severity });
  };

  // ── structural parse of the root ──
  const parsed = parseTlv(payload, '', violations, counter);
  const root = parsed.objects;
  if (parsed.trailing !== null && parsed.trailing.length > 0) {
    // trailing bytes AFTER the CRC object is the classic generator defect
    addV('63', 'TRAILING_DATA_AFTER_CRC', SOURCES.emv + '/4.6.1.2', 'error');
  }

  const rootById = new Map();
  for (const o of root) rootById.set(o.id, o);

  const pfi = rootById.get('00');
  const crcObj = rootById.get('63');

  // Payload format indicator: present, value "01", first object
  if (root.length > 0 && root[0].id !== '00') addV('00', 'PFI_NOT_FIRST', SOURCES.emv + '/4.6.1.1', 'error');
  if (pfi === undefined) addV('00', 'PFI_MISSING', SOURCES.emv + '/4.2.1.1', 'error');
  else if (pfi.value !== '01') addV('00', 'PFI_VALUE_NOT_01', SOURCES.emv + '/4.7.1.1', 'error');

  // CRC: last object, length 04, recomputed over payload incl. the literal "6304"
  let crcPos = payload.length; // start index of the CRC object's ID
  let crcFound = null;
  let crcCoversLiteral = true;
  if (crcObj === undefined) {
    addV('63', 'CRC_MISSING', SOURCES.emv + '/4.6.1.2', 'error');
  } else {
    // locate the CRC object's start index deterministically by re-scanning
    let idx = -1;
    let scan = 0;
    while (scan < payload.length) {
      const id2 = payload.slice(scan, scan + 2);
      const l2 = payload.slice(scan + 2, scan + 4);
      if (id2 === crcObj.id && l2 === String(crcObj.len).padStart(2, '0')) { idx = scan; break; }
      if (!isDigits(id2) || !isDigits(l2)) break;
      const l = parseInt(l2, 10);
      scan += 4 + l;
    }
    crcPos = idx >= 0 ? idx : payload.length - 4 - crcObj.len;
    crcFound = crcObj.value;
    if (root[root.length - 1].id !== '63') addV('63', 'CRC_NOT_LAST', SOURCES.emv + '/4.6.1.2', 'error');
    if (crcObj.len !== 4) addV('63', 'CRC_LENGTH_NOT_04', SOURCES.emv + '/4.7.3.2', 'error');
    if (!/^[0-9A-Fa-f]{4}$/.test(crcObj.value)) addV('63', 'CRC_VALUE_NOT_HEX', SOURCES.emv + '/4.7.3.2', 'error');
  }
  const crcExpected = crcHex(utf8ToBytes(payload.slice(0, crcPos) + '6304'));
  const crcAlt = crcHex(utf8ToBytes(payload.slice(0, crcPos))); // CRC computed WITHOUT the "6304" literal
  if (crcFound !== null && /^[0-9A-Fa-f]{4}$/.test(crcFound)) {
    if (crcFound.toUpperCase() === crcExpected) {
      // CRC agrees
    } else if (crcFound.toUpperCase() === crcAlt) {
      addV('63', 'CRC_EXCLUDED_6304_LITERAL', SOURCES.emv + '/4.7.3.1', 'error'); // the common generator bug
      crcCoversLiteral = false;
    } else {
      addV('63', 'CRC_MISMATCH', SOURCES.emv + '/4.7.3.1', 'error');
    }
  } else if (crcFound !== null) {
    addV('63', 'CRC_MISMATCH', SOURCES.emv + '/4.7.3.1', 'error');
  }

  // Payload length advisory (documented "should")
  if (payload.length > SPEC_PAYLOAD_SHOULD) addV('', 'PAYLOAD_LEN_EXCEEDS_512', SOURCES.emv + '/4.1', 'advisory');

  // ── mode (static / dynamic) ──
  const pim = rootById.get('01');
  let mode = 'static';
  if (pim !== undefined) {
    if (pim.value !== '11' && pim.value !== '12') addV('01', 'PIM_VALUE_INVALID', SOURCES.emv + '/4.7.2.1', 'error');
    if (pim.value === '12') mode = 'dynamic';
  }
  if (pp.expect !== undefined && pp.expect !== null && pp.expect !== mode) {
    addV('01', 'EXPECT_MODE_MISMATCH', 'kernel-input-contract', 'error');
  }

  // ── merchant account information (02-51) ──
  const accountIds = ['02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51'];
  const templates = [];
  const primitives = [];
  for (const o of root) {
    if (o.id >= '26' && o.id <= '51') templates.push(o);
    else if (o.id >= '02' && o.id <= '25') primitives.push(o);
  }
  if (templates.length + primitives.length === 0) {
    addV('26', 'MERCHANT_ACCOUNT_MISSING', SOURCES.emv + '/4.7.9.1', 'error');
  }
  const guidValues = [];
  const locationByTemplate = new Map(); // template path -> location subvalue (25)
  for (const t of templates) {
    counter.n++;
    const sub = parseTlv(t.value, t.id, violations, counter);
    if (sub.trailing !== null && sub.trailing.length > 0) {
      addV(t.id, 'TEMPLATE_TRAILING_DATA', SOURCES.emv + '/4.3.1.2', 'error');
    }
    const subById = new Map();
    for (const s of sub.objects) subById.set(s.id, s);
    const guid = subById.get('00');
    if (guid === undefined) {
      addV(t.id + '.00', 'ACCOUNT_TEMPLATE_NO_GUID', SOURCES.emv + '/4.7.11.2', 'error');
    } else {
      if (!guidShapeOk(guid.value)) addV(t.id + '.00', 'GUID_SHAPE_INVALID', SOURCES.emv + '/4.7.11.2', 'error');
      guidValues.push(guid.value);
    }
    const loc = subById.get('25');
    if (loc !== undefined) locationByTemplate.set(t.id, loc.value);
  }
  // Profile-recognised GUID (case-insensitive: reverse-domain case varies across scheme texts)
  if (profile.required_guids !== null) {
    const lower = guidValues.map((g) => g.toLowerCase());
    const hit = profile.required_guids.some((g) => lower.indexOf(g.toLowerCase()) !== -1);
    if (!hit && templates.length + primitives.length > 0) {
      addV('26', 'PROFILE_GUID_NOT_RECOGNISED', SOURCES.bcbBrc + '/T1;EMV-MPM-v1.1/4.7.11.2', 'error');
    }
  } else if (!profile.guid_registry_public && guidValues.length > 0) {
    addV('26.00', 'PROFILE_GUID_UNVERIFIABLE', SOURCES.fjqr + '/1.2', 'advisory');
  }

  // ── MCC (52) ──
  const mcc = rootById.get('52');
  if (mcc === undefined) addV('52', 'MCC_MISSING', SOURCES.emv + '/4.2.1.1', 'error');
  else if (!/^\d{4}$/.test(mcc.value)) addV('52', 'MCC_FORMAT', SOURCES.emv + '/4.7.12.1', 'error');

  // ── currency (53) ──
  const ccys = rootById.get('53');
  if (ccys === undefined) addV('53', 'CCY_MISSING', SOURCES.emv + '/4.2.1.1', 'error');
  else if (!/^\d{3}$/.test(ccys.value)) addV('53', 'CCY_FORMAT', SOURCES.emv + '/4.7.5.1', 'error');
  else if (profile.currency !== null && ccys.value !== profile.currency) {
    addV('53', 'CCY_PROFILE_MISMATCH', SOURCES.emv + '/4.7.5.1', 'error');
  }

  // ── amount (54) ──
  const amount = rootById.get('54');
  if (amount !== undefined) {
    counter.n++;
    if (!amountShapeOk(amount.value)) addV('54', 'AMOUNT_FORMAT', SOURCES.emv + '/4.7.4.1', 'error');
  }

  // ── tip / convenience (55-57) ──
  const tip = rootById.get('55');
  const feeFixed = rootById.get('56');
  const feePct = rootById.get('57');
  if (tip !== undefined) {
    counter.n++;
    if (tip.value !== '01' && tip.value !== '02' && tip.value !== '03') {
      addV('55', 'TIP_INDICATOR_INVALID', SOURCES.emv + '/4.7.6.1', 'error');
    } else {
      if (tip.value === '02') {
        if (feeFixed === undefined) addV('56', 'CONVENIENCE_FEE_FIXED_MISSING', SOURCES.emv + '/4.7.7.1', 'error');
        else if (!amountShapeOk(feeFixed.value)) addV('56', 'CONVENIENCE_FEE_FIXED_FORMAT', SOURCES.emv + '/4.7.7.2', 'error');
        if (feePct !== undefined) addV('57', 'CONVENIENCE_FEE_PCT_PRESENT', SOURCES.emv + '/4.7.8.1', 'error');
      } else if (feeFixed !== undefined) {
        addV('56', 'CONVENIENCE_FEE_FIXED_PRESENT', SOURCES.emv + '/4.7.7.1', 'error');
      }
      if (tip.value === '03') {
        if (feePct === undefined) addV('57', 'CONVENIENCE_FEE_PCT_MISSING', SOURCES.emv + '/4.7.8.1', 'error');
        else {
          const pct = parseFloat(feePct.value);
          if (!/^\d+(\.\d+)?$/.test(feePct.value) || !(pct >= 0.01 && pct <= 99.99)) {
            addV('57', 'CONVENIENCE_FEE_PCT_RANGE', SOURCES.emv + '/4.7.8.1', 'error');
          }
        }
      } else if (feePct !== undefined) {
        addV('57', 'CONVENIENCE_FEE_PCT_PRESENT', SOURCES.emv + '/4.7.8.1', 'error');
      }
    }
  } else {
    if (feeFixed !== undefined) addV('56', 'CONVENIENCE_FEE_FIXED_PRESENT', SOURCES.emv + '/4.7.7.1', 'error');
    if (feePct !== undefined) addV('57', 'CONVENIENCE_FEE_PCT_PRESENT', SOURCES.emv + '/4.7.8.1', 'error');
  }

  // ── country (58) ──
  const country = rootById.get('58');
  if (country === undefined) addV('58', 'COUNTRY_MISSING', SOURCES.emv + '/4.2.1.1', 'error');
  else if (!/^[A-Za-z]{2}$/.test(country.value)) addV('58', 'COUNTRY_FORMAT', SOURCES.emv + '/4.7.13.1', 'error');
  else if (profile.country !== null && country.value.toUpperCase() !== profile.country) {
    addV('58', 'COUNTRY_PROFILE_MISMATCH', SOURCES.bcbBrc + '/T1', 'error');
  }

  // ── merchant name (59) / city (60) / postal (61) — NEVER echoed ──
  const name = rootById.get('59');
  if (name === undefined) addV('59', 'MERCHANT_NAME_MISSING', SOURCES.emv + '/4.2.1.1', 'error');
  else if (name.len < 1 || name.len > 25) addV('59', 'MERCHANT_NAME_LENGTH', SOURCES.emv + '/4.7;T3.6', 'error');
  const city = rootById.get('60');
  if (city === undefined) addV('60', 'MERCHANT_CITY_MISSING', SOURCES.emv + '/4.2.1.1', 'error');
  else if (city.len < 1 || city.len > 15) addV('60', 'MERCHANT_CITY_LENGTH', SOURCES.emv + '/4.7;T3.6', 'error');
  const postal = rootById.get('61');
  if (postal !== undefined && postal.len > 10) addV('61', 'POSTAL_LENGTH', SOURCES.emv + '/T3.6', 'error');

  // ── additional data template (62) — subfield values NEVER echoed ──
  const addl = rootById.get('62');
  let addlSub = new Map();
  if (addl !== undefined) {
    counter.n++;
    if (addl.len > 99) addV('62', 'ADDL_TEMPLATE_LENGTH', SOURCES.emv + '/T3.6', 'error');
    const sub = parseTlv(addl.value, '62', violations, counter);
    if (sub.trailing !== null && sub.trailing.length > 0) addV('62', 'TEMPLATE_TRAILING_DATA', SOURCES.emv + '/4.3.1.2', 'error');
    for (const s of sub.objects) {
      addlSub.set(s.id, s);
      const cap = ADDL_SUB_CAP[s.id];
      if (cap !== undefined && s.len > cap) {
        addV('62.' + s.id, 'ADDL_SUB_LENGTH', SOURCES.emv + '/T3.7', 'error');
      }
      if (s.id === '09' && !/^[AME]{1,3}$/.test(s.value)) {
        addV('62.09', 'ADDL_CONSUMER_REQUEST_SHAPE', SOURCES.emv + '/4.8;T3.7', 'advisory');
      }
    }
  }

  // ── language template (64) — alternate merchant name/city NEVER echoed ──
  const langT = rootById.get('64');
  if (langT !== undefined) {
    counter.n++;
    const sub = parseTlv(langT.value, '64', violations, counter);
    const subById = new Map();
    for (const s of sub.objects) subById.set(s.id, s);
    const lp = subById.get('00');
    if (lp === undefined) addV('64.00', 'LANGUAGE_PREFERENCE_MISSING', SOURCES.emv + '/4.2.1.3;T3.8', 'error');
    else if (lp.len !== 2) addV('64.00', 'LANGUAGE_PREFERENCE_LENGTH', SOURCES.emv + '/T3.8', 'error');
    const altName = subById.get('01');
    if (altName === undefined) addV('64.01', 'ALT_MERCHANT_NAME_MISSING', SOURCES.emv + '/4.2.1.3;T3.8', 'error');
    else if (altName.len > 25) addV('64.01', 'ALT_MERCHANT_NAME_LENGTH', SOURCES.emv + '/T3.8', 'error');
    const altCity = subById.get('02');
    if (altCity !== undefined && altCity.len > 15) addV('64.02', 'ALT_MERCHANT_CITY_LENGTH', SOURCES.emv + '/T3.8', 'error');
  }

  // ── unreserved templates (80-99): GUID presence, values never echoed ──
  for (const o of root) {
    if (o.id >= '80' && o.id <= '99') {
      counter.n++;
      const sub = parseTlv(o.value, o.id, violations, counter);
      const hasGuid = sub.objects.some((s) => s.id === '00');
      if (!hasGuid) addV(o.id + '.00', 'UNRESERVED_TEMPLATE_NO_GUID', SOURCES.emv + '/4.11', 'error');
    }
  }

  // ── profile-specific mode rules ──
  if (profile.key === 'fjqr') {
    if (mode === 'dynamic') {
      addV('01', 'FJQR_DYNAMIC_BEYOND_LAUNCH_SCOPE', SOURCES.fjqr + '/1.2fn2,fn5', 'advisory');
      if (amount === undefined) addV('54', 'FJQR_DYNAMIC_AMOUNT_MISSING', SOURCES.fjqr + '/2.2', 'error');
      if (addlSub.get('05') === undefined) addV('62.05', 'FJQR_DYNAMIC_TXREF_MISSING', SOURCES.fjqr + '/2.2', 'error');
    } else if (amount !== undefined) {
      addV('54', 'FJQR_STATIC_AMOUNT_UNEXPECTED', SOURCES.fjqr + '/2.2', 'advisory');
    }
  }
  if (profile.key === 'pix_brcode') {
    if (addl === undefined) addV('62', 'PIX_ADDL_DATA_MISSING', SOURCES.bcbBrc + '/T1', 'error');
    else if (addlSub.get('05') === undefined) addV('62.05', 'PIX_TXID_MISSING', SOURCES.bcbBrc + '/T1', 'error');
    const pixTemplateIds = templates.filter((t) => {
      const sub = parseTlv(t.value, t.id, [], counter);
      const g = sub.objects.find((s) => s.id === '00');
      return g !== undefined && g.value.toLowerCase() === 'br.gov.bcb.pix';
    });
    const pixLocations = pixTemplateIds.map((t) => ({ id: t.id, loc: locationByTemplate.get(t.id) })).filter((x) => x.loc !== undefined);
    if (mode === 'dynamic') {
      if (pixLocations.length === 0) {
        addV('26.25', 'PIX_LOCATION_MISSING', SOURCES.bcbPix + '/2.5.2,2.7.2', 'error');
      } else {
        const loc = pixLocations[0].loc;
        if (urlish(loc)) addV('26.25', 'PIX_LOCATION_PROTOCOL_PREFIX', SOURCES.bcbPix + '/2.5.2', 'error');
        if (loc.length > 77) addV('26.25', 'PIX_LOCATION_LENGTH', SOURCES.bcbPix + '/2.5.2', 'error');
        const slash = loc.indexOf('/');
        const host = slash === -1 ? loc : loc.slice(0, slash);
        if (slash === -1 || host.indexOf('.') === -1 || host.length === 0 || slash === loc.length - 1) {
          addV('26.25', 'PIX_LOCATION_SHAPE', SOURCES.bcbPix + '/2.5.2', 'error');
        }
      }
    } else {
      if (pixLocations.length > 0) addV('26.25', 'PIX_LOCATION_IN_STATIC', SOURCES.bcbPix + '/2.5.2', 'error');
    }
    // Signed dynamic-payload envelope shape (skeleton only; never fetched, never verified)
    if (envelope !== null) {
      if (mode !== 'dynamic') addV('26.25', 'ENVELOPE_NOT_APPLICABLE', 'kernel-input-contract', 'advisory');
      const alg = envelope.alg;
      if (typeof alg !== 'string' || alg.length === 0) addV('jws.alg', 'JWS_ALG_MISSING', SOURCES.bcbSfn + '/5', 'error');
      else if (alg.toLowerCase() === 'none' || alg.toUpperCase().indexOf('HS') === 0) addV('jws.alg', 'JWS_ALG_PROHIBITED', SOURCES.bcbSfn + '/5', 'error');
      else if (!JWS_ALG_ALLOWED.has(alg.toUpperCase())) addV('jws.alg', 'JWS_ALG_NOT_ALLOWED', SOURCES.bcbSfn + '/5', 'error');
      else if (!JWS_ALG_RECOMMENDED.has(alg.toUpperCase())) addV('jws.alg', 'JWS_ALG_NOT_RECOMMENDED', SOURCES.bcbSfn + '/5', 'advisory');
      if (typeof envelope.kid !== 'string' || envelope.kid.length === 0) addV('jws.kid', 'JWS_KID_MISSING', SOURCES.bcbSfn + '/5', 'error');
      if (typeof envelope.jku !== 'string' || envelope.jku.length === 0) addV('jws.jku', 'JWS_JKU_MISSING', SOURCES.bcbSfn + '/5', 'error');
      else if (envelope.jku.indexOf('https://') !== 0) addV('jws.jku', 'JWS_JKU_NOT_HTTPS', SOURCES.bcbSfn + '/5', 'error');
    }
  } else if (envelope !== null) {
    addV('jws', 'ENVELOPE_NOT_APPLICABLE', 'kernel-input-contract', 'advisory');
  }

  // ── tag rows (parse order; children after their template; values only where echo-safe) ──
  const echoRoot = (o) => {
    if (ECHO_SAFE_ROOT.has(o.id)) return o.value;
    return undefined;
  };
  for (const o of root) {
    const pathIds = violations.filter((v) => v.tag_path === o.id || v.tag_path.indexOf(o.id + '.') === 0);
    const sev = pathIds.some((v) => v.severity === 'error') ? 'fail' : (pathIds.some((v) => v.severity === 'advisory') ? 'advisory' : 'pass');
    const row = { tag: o.id, length: o.len, verdict: sev };
    const val = echoRoot(o);
    if (val !== undefined) row.value = val;
    tagRows.push(row);
    if (o.id >= '26' && o.id <= '51') {
      const sub = parseTlv(o.value, o.id, [], counter);
      for (const s of sub.objects) {
        const subPath = o.id + '.' + s.id;
        const subSev = violations.some((v) => v.tag_path === subPath && v.severity === 'error') ? 'fail' : (violations.some((v) => v.tag_path === subPath && v.severity === 'advisory') ? 'advisory' : 'pass');
        const subRow = { tag: subPath, length: s.len, verdict: subSev };
        if (s.id === '00') subRow.value = s.value; // template GUID is echo-safe
        tagRows.push(subRow);
      }
    } else if (o.id === '62') {
      const sub = parseTlv(o.value, '62', [], counter);
      for (const s of sub.objects) {
        const subPath = '62.' + s.id;
        const subSev = violations.some((v) => v.tag_path === subPath && v.severity === 'error') ? 'fail' : (violations.some((v) => v.tag_path === subPath && v.severity === 'advisory') ? 'advisory' : 'pass');
        tagRows.push({ tag: subPath, length: s.len, verdict: subSev }); // never echo subfield values
      }
    } else if (o.id === '64') {
      const sub = parseTlv(o.value, '64', [], counter);
      for (const s of sub.objects) {
        const subPath = '64.' + s.id;
        const subSev = violations.some((v) => v.tag_path === subPath && v.severity === 'error') ? 'fail' : (violations.some((v) => v.tag_path === subPath && v.severity === 'advisory') ? 'advisory' : 'pass');
        tagRows.push({ tag: subPath, length: s.len, verdict: subSev }); // never echo alternate name/city
      }
    }
  }

  // ── assemble, sorted for determinism ──
  violations.sort((a, b) => (a.tag_path < b.tag_path ? -1 : a.tag_path > b.tag_path ? 1 : a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0));
  const hasError = violations.some((v) => v.severity === 'error');
  const valid = !hasError;

  if (valid) compliance_flags.push('QR_PAYLOAD_VALID');
  else compliance_flags.push('QR_PAYLOAD_INVALID');
  if (!crcCoversLiteral) compliance_flags.push('QR_CRC_EXCLUDED_6304_BUG');
  compliance_flags.push('QR_PROFILE_' + profile.key.toUpperCase());

  return {
    output_payload: {
      valid,
      profile: profile.key,
      mode,
      tags: tagRows,
      violations,
      crc: { expected: crcExpected, found: crcFound === null ? null : crcFound.toUpperCase() },
      rules_checked: counter.n,
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
