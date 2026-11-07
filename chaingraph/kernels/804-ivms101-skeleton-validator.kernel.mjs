import { executionHash } from './_hash.mjs';

// 804-ivms101-skeleton-validator — structural and code-list validation of an IVMS101
// travel-rule payload supplied as a ZERO-PII SKELETON. Every free-text leaf must be either
// the literal "SYNTHETIC" or a length marker {"len": <int>}; code-list leaves (country,
// name/identifier/address type codes) are accepted as enumeration values and checked
// against the pinned code lists. The kernel never echoes a leaf value: output is
// {path, rule_id, section} violations only. Field rules, cardinalities, max lengths and
// code lists are ported from the pinned IVMS 101.2023 text (research/clause-snapshots/ivms101/,
// sha256 64bb38bd..., CC BY-ND 4.0) — facts cited by section, no text reproduced.
//
// DETERMINISM: compute() is a pure function of pp — no clock, no randomness. Constraint
// C2 (DateInPast) is evaluated against the pinned constant EVAL_DATE below (the edition
// pinning date), NOT a runtime clock, so identical input always yields identical output.

const TOOL_ID = '804-ivms101-skeleton-validator';
const TOOL_VERSION = '1.0.0';

const PINNED_EDITION = '101.2023';
const EVAL_DATE = '2026-11-01'; // pinned C2 evaluation date (date pinning of this build)

const CODES = {
  naturalPersonNameIdentifierType: { list: ['ALIA', 'BIRT', 'MAID', 'LEGL', 'MISC'], section: '5.3.9' },
  naturalPersonNameIdentifierTypeLocal: { list: ['ALIA', 'BIRT', 'MAID', 'LEGL', 'MISC'], section: '5.3.9' },
  legalPersonNameIdentifierType: { list: ['LEGL', 'SHRT', 'TRAD'], section: '5.3.10' },
  legalPersonNameIdentifierTypeLocal: { list: ['LEGL', 'SHRT', 'TRAD'], section: '5.3.10' },
  addressType: { list: ['HOME', 'BIZZ', 'GEOG'], section: '5.3.12' },
  country: { iso: true, section: '5.3.13' },
  countryOfIssue: { iso: true, section: '5.3.13' },
  countryOfRegistration: { iso: true, section: '5.3.13' },
  countryOfResidence: { iso: true, section: '5.3.13' },
  nationalIdentifierType: { list: ['ARNU', 'CCPT', 'RAID', 'DRLC', 'FIIN', 'TXID', 'SOCS', 'IDCD', 'LEIX', 'MISC'], section: '5.3.15' },
  transliterationMethod: { list: ['arab', 'aran', 'armn', 'cyrl', 'deva', 'geor', 'grek', 'hani', 'hebr', 'kana', 'kore', 'thai', 'othr'], section: '5.3.17' },
  payloadVersion: { list: ['101', '101.2023'], section: '5.3.18' },
};

const MAXLEN = {
  Max100Text: 100, LocalMax100Text: 100, Max50Text: 50, Max70Text: 70,
  Max35Text: 35, Max16Text: 16, Max512Text: 512,
};
const MAXLEN_SECTION = '5.3';

// Element schemas: multiplicity [min..maxInf], kind: 'object' | 'array' | leaf spec.
const NP_NAME_ID = {
  primaryIdentifier: { mult: [1, 1], str: 'Max100Text' },
  secondaryIdentifier: { mult: [0, 1], str: 'Max100Text' },
  naturalPersonNameIdentifierType: { mult: [1, 1], code: 'naturalPersonNameIdentifierType' },
};
const NP_NAME_ID_LOCAL = {
  primaryIdentifier: { mult: [1, 1], str: 'LocalMax100Text' },
  secondaryIdentifier: { mult: [0, 1], str: 'LocalMax100Text' },
  nameIdentifierType: { mult: [1, 1], code: 'naturalPersonNameIdentifierTypeLocal' },
};
const LP_NAME_ID = {
  legalPersonName: { mult: [1, 1], str: 'Max100Text' },
  legalPersonNameIdentifierType: { mult: [1, 1], code: 'legalPersonNameIdentifierType' },
};
const LP_NAME_ID_LOCAL = {
  legalPersonName: { mult: [1, 1], str: 'LocalMax100Text' },
  legalPersonNameIdentifierType: { mult: [1, 1], code: 'legalPersonNameIdentifierTypeLocal' },
};
const NP_NAME = {
  nameIdentifier: { mult: [1, Infinity], array: NP_NAME_ID },
  localNameIdentifier: { mult: [0, Infinity], array: NP_NAME_ID_LOCAL },
  phoneticNameIdentifier: { mult: [0, Infinity], array: NP_NAME_ID_LOCAL },
};
const LP_NAME = {
  nameIdentifier: { mult: [1, Infinity], array: LP_NAME_ID },
  localNameIdentifier: { mult: [0, Infinity], array: LP_NAME_ID_LOCAL },
  phoneticNameIdentifier: { mult: [0, Infinity], array: LP_NAME_ID_LOCAL },
};
const ADDRESS = {
  addressType: { mult: [1, 1], code: 'addressType' },
  department: { mult: [0, 1], str: 'Max50Text' },
  subDepartment: { mult: [0, 1], str: 'Max70Text' },
  streetName: { mult: [0, 1], str: 'Max70Text' },
  buildingNumber: { mult: [0, 1], str: 'Max16Text' },
  buildingName: { mult: [0, 1], str: 'Max35Text' },
  floor: { mult: [0, 1], str: 'Max70Text' },
  postBox: { mult: [0, 1], str: 'Max16Text' },
  room: { mult: [0, 1], str: 'Max70Text' },
  postCode: { mult: [0, 1], str: 'Max16Text' },
  townName: { mult: [1, 1], str: 'Max35Text' },
  townLocationName: { mult: [0, 1], str: 'Max35Text' },
  districtName: { mult: [0, 1], str: 'Max35Text' },
  countrySubDivision: { mult: [0, 1], str: 'Max35Text' },
  addressLine: { mult: [0, 7], arrayOfStr: 'Max70Text' },
  country: { mult: [1, 1], code: 'country' },
};
const DOB = {
  dateOfBirth: { mult: [1, 1], date: true },
  placeOfBirth: { mult: [1, 1], str: 'Max70Text' },
};
const NAT_ID = {
  nationalIdentifier: { mult: [1, 1], str: 'Max35Text' },
  nationalIdentifierType: { mult: [1, 1], code: 'nationalIdentifierType' },
  countryOfIssue: { mult: [0, 1], code: 'countryOfIssue' },
  registrationAuthority: { mult: [0, 1], ra: true },
};
const NATURAL_PERSON = {
  name: { mult: [1, 1], object: NP_NAME },
  geographicAddress: { mult: [0, Infinity], array: ADDRESS },
  nationalIdentification: { mult: [0, 1], object: NAT_ID },
  customerIdentification: { mult: [0, 1], str: 'Max50Text' },
  dateAndPlaceOfBirth: { mult: [0, 1], object: DOB },
  countryOfResidence: { mult: [0, 1], code: 'countryOfResidence' },
};
const LEGAL_PERSON = {
  name: { mult: [1, 1], object: LP_NAME },
  geographicAddress: { mult: [0, Infinity], array: ADDRESS },
  customerIdentification: { mult: [0, 1], str: 'Max50Text' },
  nationalIdentification: { mult: [0, 1], object: NAT_ID },
  countryOfRegistration: { mult: [0, 1], code: 'countryOfRegistration' },
};
const PERSON = {
  naturalPerson: { mult: [0, 1], object: NATURAL_PERSON },
  legalPerson: { mult: [0, 1], object: LEGAL_PERSON },
  accountNumber: { mult: [0, Infinity], arrayOfStr: 'Max512Text' },
};
const INTERMEDIARY = {
  intermediaryVASP: { mult: [1, 1], object: PERSON },
  sequence: { mult: [1, 1], integer: true },
};
const PAYLOAD = {
  originator: { mult: [1, Infinity], array: PERSON },
  beneficiary: { mult: [1, Infinity], array: PERSON },
  originatingVASP: { mult: [0, 1], object: PERSON },
  beneficiaryVASP: { mult: [0, 1], object: PERSON },
  transferPath: { mult: [0, Infinity], array: INTERMEDIARY },
  payloadMetadata: {
    mult: [1, 1],
    object: {
      transliterationMethod: { mult: [0, Infinity], arrayOfCode: 'transliterationMethod' },
      payloadVersion: { mult: [1, 1], code: 'payloadVersion' },
    },
  },
};

function isInt(v) { return typeof v === 'number' && Number.isInteger(v); }

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_ivms101_skeleton',
  mandate_type: 'compliance_control', gpu: false,
};

export function compute(pp) {
  pp = pp || {};
  const violations = [];
  const rules = ['EDITION', 'PII-REFUSAL', 'REQUIRED', 'CARD', 'MAXLEN', 'CODE', 'PERSON-EXCL',
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12'];
  const edition = typeof pp.ivms101_edition === 'string' ? pp.ivms101_edition : '';

  // Fail closed: anything but the pinned edition short-circuits all further validation.
  if (edition !== PINNED_EDITION) {
    violations.push({ path: 'ivms101_edition', rule_id: 'EDITION', section: '5.3.18' });
    return finish(violations, rules, edition);
  }

  const payload = pp.payload;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    violations.push({ path: 'payload', rule_id: 'CARD', section: '6' });
    return finish(violations, rules, edition);
  }

  walkObject(payload, PAYLOAD, 'payload', violations);

  // Cross-entity constraints C1–C12.
  crossChecks(payload, violations);

  violations.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0));
  return finish(violations, rules, edition);
}

function finish(violations, rules, edition) {
  const valid = violations.length === 0;
  const flags = valid ? ['IVMS101_SKELETON_VALID'] : ['IVMS101_SKELETON_INVALID'];
  if (violations.some((v) => v.rule_id === 'PII-REFUSAL')) flags.push('IVMS101_PII_REFUSED');
  if (violations.some((v) => v.rule_id === 'EDITION')) flags.push('IVMS101_EDITION_REJECTED');
  return {
    output_payload: {
      valid,
      edition: PINNED_EDITION,
      edition_declared: edition === '' ? null : edition,
      rules_checked: rules,
      violation_count: violations.length,
      violations,
    },
    compliance_flags: flags,
  };
}

function joinPath(base, key, idx) {
  return idx === undefined ? base + '.' + key : base + '.' + key + '[' + idx + ']';
}

function walkObject(obj, schema, base, out) {
  for (const key of Object.keys(schema)) {
    const spec = schema[key];
    const p = joinPath(base, key);
    const present = Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null;
    if (!present) {
      if (spec.mult[0] >= 1) out.push({ path: p, rule_id: 'REQUIRED', section: spec.section || sectionOf(schema, key) });
      continue;
    }
    const v = obj[key];
    if (spec.array || spec.arrayOfStr || spec.arrayOfCode) {
      if (!Array.isArray(v)) { out.push({ path: p, rule_id: 'CARD', section: spec.section || sectionOf(schema, key) }); continue; }
      if (v.length < spec.mult[0] || v.length > spec.mult[1]) {
        out.push({ path: p, rule_id: 'CARD', section: spec.section || sectionOf(schema, key) });
        continue;
      }
      v.forEach((el, i) => {
        const ip = p + '[' + i + ']';
        if (spec.array) {
          if (el === null || typeof el !== 'object' || Array.isArray(el)) { out.push({ path: ip, rule_id: 'CARD', section: spec.section || sectionOf(schema, key) }); return; }
          walkObject(el, spec.array, ip, out);
        } else if (spec.arrayOfStr) {
          leaf(el, ip, spec.arrayOfStr, out);
        } else {
          codeLeaf(el, ip, spec.arrayOfCode, out);
        }
      });
    } else if (spec.object) {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) { out.push({ path: p, rule_id: 'CARD', section: spec.section || sectionOf(schema, key) }); continue; }
      walkObject(v, spec.object, p, out);
    } else if (spec.integer) {
      if (!isInt(v)) out.push({ path: p, rule_id: 'CARD', section: '5.3.16' });
    } else if (spec.date) {
      dateLeaf(v, p, out);
    } else if (spec.code) {
      codeLeaf(v, p, spec.code, out);
    } else if (spec.ra) {
      raLeaf(v, p, out);
    } else if (spec.str) {
      leaf(v, p, spec.str, out);
    }
  }
}

function sectionOf(schema, key) {
  // Structural sections follow the entity/component tables of the pinned text.
  if (schema === PAYLOAD) return '6';
  if (schema === PERSON) return '5.2.1.1';
  if (schema === NATURAL_PERSON) return '5.2.2.1';
  if (schema === LEGAL_PERSON) return '5.2.9.1';
  if (schema === NP_NAME || schema === LP_NAME) return schema === NP_NAME ? '5.2.3.1' : '5.2.10.1';
  if (schema === NP_NAME_ID) return '5.2.4.1';
  if (schema === NP_NAME_ID_LOCAL) return '5.2.5.1';
  if (schema === LP_NAME_ID) return '5.2.11.1';
  if (schema === LP_NAME_ID_LOCAL) return '5.2.12.1';
  if (schema === ADDRESS) return '5.2.6.1';
  if (schema === DOB) return '5.2.7.1';
  if (schema === NAT_ID) return '5.2.8.1';
  if (schema === INTERMEDIARY) return '5.2.13.1';
  return '6';
}

// Free-text skeleton leaf: "SYNTHETIC" or {"len": int}; anything else is refused by path only.
function leaf(v, p, datatype, out) {
  if (v === 'SYNTHETIC') return;
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === 'len' && isInt(v.len) && v.len >= 1) {
      const max = MAXLEN[datatype];
      if (max !== undefined && v.len > max) out.push({ path: p, rule_id: 'MAXLEN', section: MAXLEN_SECTION });
      return;
    }
  }
  out.push({ path: p, rule_id: 'PII-REFUSAL', section: 'skeleton-contract' });
}

function codeLeaf(v, p, codeName, out) {
  const spec = CODES[codeName];
  if (typeof v !== 'string') { out.push({ path: p, rule_id: 'CODE', section: spec.section }); return; }
  if (spec.iso) {
    if (!/^[A-Z]{2}$/.test(v)) out.push({ path: p, rule_id: 'CODE', section: spec.section });
    return;
  }
  const up = v.toUpperCase();
  const ok = spec.list.some((c) => c.toUpperCase() === up);
  if (!ok) out.push({ path: p, rule_id: 'CODE', section: spec.section });
}

// GLEIF Registration Authority code: 8-char RA###### format (pinned RegistrationAuthority datatype). "SYNTHETIC"
// is accepted as a placeholder; a real value must match the format; anything else refused.
function raLeaf(v, p, out) {
  if (v === 'SYNTHETIC') return;
  if (typeof v === 'string' && /^RA[0-9]{6}$/.test(v)) return;
  out.push({ path: p, rule_id: 'CODE', section: '5.3.14' });
}

function dateLeaf(v, p, out) {
  if (typeof v !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)) {
    out.push({ path: p, rule_id: 'CARD', section: '5.3.11' });
    return;
  }
  const y = +v.slice(0, 4), m = +v.slice(5, 7), d = +v.slice(8, 10);
  const last = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  if (m < 1 || m > 12 || d < 1 || d > last) { out.push({ path: p, rule_id: 'CARD', section: '5.3.11' }); return; }
  // C2 DateInPast — evaluated against the pinned EVAL_DATE, deterministically.
  if (v >= EVAL_DATE) out.push({ path: p, rule_id: 'C2', section: '5.2.7.2' });
}

function crossChecks(payload, out) {
  const entities = [
    ['originator', payload.originator, true],
    ['beneficiary', payload.beneficiary, false],
    ['originatingVASP', payload.originatingVASP == null ? [] : [payload.originatingVASP], false],
    ['beneficiaryVASP', payload.beneficiaryVASP == null ? [] : [payload.beneficiaryVASP], false],
  ];
  for (const [name, list, isOriginator] of entities) {
    if (!Array.isArray(list)) continue;
    list.forEach((person, pi) => {
      if (person === null || typeof person !== 'object' || Array.isArray(person)) return;
      const base = name + '[' + pi + ']';
      personCheck(person, base, isOriginator, out);
    });
  }
  // C12 sequentialIntegrity over transferPath.
  const tp = payload.transferPath;
  if (Array.isArray(tp)) {
    tp.forEach((el, i) => {
      if (el === null || typeof el !== 'object' || Array.isArray(el)) return;
      const sp = 'transferPath[' + i + '].sequence';
      if (!isInt(el.sequence) || el.sequence !== i) out.push({ path: sp, rule_id: 'C12', section: '5.2.13.2' });
    });
  }
}

function personCheck(person, base, isOriginator, out) {
  const np = person.naturalPerson;
  const lp = person.legalPerson;
  const npObj = np !== null && typeof np === 'object' && !Array.isArray(np) ? np : null;
  const lpObj = lp !== null && typeof lp === 'object' && !Array.isArray(lp) ? lp : null;

  // Mutually exclusive natural-person / legal-person branches (Person component).
  if ((npObj && lpObj) || (!npObj && !lpObj)) {
    out.push({ path: base, rule_id: 'PERSON-EXCL', section: '5.2.1.1' });
  }

  if (npObj) {
    if (isOriginator) {
      // C1 OriginatorInformationNaturalPerson.
      const addrOk = Array.isArray(npObj.geographicAddress) && npObj.geographicAddress.some((a) => a && typeof a === 'object' && (a.addressType === 'GEOG' || a.addressType === 'HOME' || a.addressType === 'BIZZ'));
      const c1 = addrOk || npObj.customerIdentification !== undefined || npObj.nationalIdentification !== undefined || npObj.dateAndPlaceOfBirth !== undefined;
      if (!c1) out.push({ path: base + '.naturalPerson', rule_id: 'C1', section: '5.2.1.2' });
    }
    // C6 LegalNamePresentNaturalPerson.
    const nameArr = npObj.name && Array.isArray(npObj.name.nameIdentifier) ? npObj.name.nameIdentifier : [];
    const legl = nameArr.some((n) => n && typeof n === 'object' && typeof n.naturalPersonNameIdentifierType === 'string' && n.naturalPersonNameIdentifierType.toUpperCase() === 'LEGL');
    if (!legl) out.push({ path: base + '.naturalPerson.name.nameIdentifier', rule_id: 'C6', section: '5.2.3.2' });
  }

  if (lpObj) {
    if (isOriginator) {
      // C4 OriginatorInformationLegalPerson.
      const addrOk = Array.isArray(lpObj.geographicAddress) && lpObj.geographicAddress.some((a) => a && typeof a === 'object' && a.addressType === 'GEOG');
      const c4 = addrOk || lpObj.customerIdentification !== undefined || lpObj.nationalIdentification !== undefined;
      if (!c4) out.push({ path: base + '.legalPerson', rule_id: 'C4', section: '5.2.1.2' });
    }
    // C5 LegalNamePresentLegalPerson.
    const nameArr = lpObj.name && Array.isArray(lpObj.name.nameIdentifier) ? lpObj.name.nameIdentifier : [];
    const legl = nameArr.some((n) => n && typeof n === 'object' && typeof n.legalPersonNameIdentifierType === 'string' && n.legalPersonNameIdentifierType.toUpperCase() === 'LEGL');
    if (!legl) out.push({ path: base + '.legalPerson.name.nameIdentifier', rule_id: 'C5', section: '5.2.10.2' });

    // C7 / C9 / C10 / C11 over nationalIdentification.
    const ni = lpObj.nationalIdentification;
    if (ni && typeof ni === 'object' && !Array.isArray(ni)) {
      const t = typeof ni.nationalIdentifierType === 'string' ? ni.nationalIdentifierType.toUpperCase() : null;
      if (t !== null && !['RAID', 'MISC', 'LEIX', 'TXID'].includes(t)) {
        out.push({ path: base + '.legalPerson.nationalIdentification.nationalIdentifierType', rule_id: 'C7', section: '5.2.8.2' });
      }
      if (ni.countryOfIssue !== undefined && ni.countryOfIssue !== null) {
        out.push({ path: base + '.legalPerson.nationalIdentification.countryOfIssue', rule_id: 'C9', section: '5.2.8.2' });
      }
      const raPresent = ni.registrationAuthority !== undefined && ni.registrationAuthority !== null;
      if (t === 'LEIX') {
        if (raPresent) out.push({ path: base + '.legalPerson.nationalIdentification.registrationAuthority', rule_id: 'C9', section: '5.2.8.2' });
        // C11 ValidLEI: LEIText is exactly 20 chars — checkable only on a len marker;
        // a "SYNTHETIC" placeholder carries no length by construction and is not evaluated.
        const nid = ni.nationalIdentifier;
        if (nid !== null && typeof nid === 'object' && !Array.isArray(nid) && isInt(nid.len) && nid.len !== 20) {
          out.push({ path: base + '.legalPerson.nationalIdentification.nationalIdentifier', rule_id: 'C11', section: '5.2.8.2' });
        }
      } else if (t !== null && !raPresent) {
        out.push({ path: base + '.legalPerson.nationalIdentification.registrationAuthority', rule_id: 'C9', section: '5.2.8.2' });
      }
    }
  }

  // C8 ValidAddress + C2 for every address / dateAndPlaceOfBirth present.
  const holder = npObj || lpObj;
  if (holder && Array.isArray(holder.geographicAddress)) {
    holder.geographicAddress.forEach((a, ai) => {
      if (a === null || typeof a !== 'object' || Array.isArray(a)) return;
      const ap = base + '.' + (npObj ? 'naturalPerson' : 'legalPerson') + '.geographicAddress[' + ai + ']';
      const hasLine = Array.isArray(a.addressLine) && a.addressLine.length >= 1;
      const hasStreet = a.streetName !== undefined || a.buildingName !== undefined || a.buildingNumber !== undefined;
      if (!hasLine && !hasStreet) out.push({ path: ap, rule_id: 'C8', section: '5.2.6.2' });
    });
  }
  if (holder && holder.dateAndPlaceOfBirth && typeof holder.dateAndPlaceOfBirth === 'object') {
    const dob = holder.dateAndPlaceOfBirth.dateOfBirth;
    if (typeof dob === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dob) && dob >= EVAL_DATE) {
      out.push({ path: base + '.' + (npObj ? 'naturalPerson' : 'legalPerson') + '.dateAndPlaceOfBirth.dateOfBirth', rule_id: 'C2', section: '5.2.7.2' });
    }
  }
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
