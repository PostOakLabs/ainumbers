import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-563-mt9xx-camt-statement-migration-mapper';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_mt9xx_to_camt',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Swift retires MT900/910/940/942/950 statement/notification messages in the 2027-28 coexistence
// window; receive-capability for the camt equivalents is mandated Nov 2027, and Swift itself provides
// NO MT->ISO 20022 conversion tool -- the translation burden lands on the corporate/treasury receiving
// the message. This kernel deterministically maps a pasted MT9xx tag-line message to a camt-shaped JSON
// mapping object PLUS a fidelity report (truncation findings, unmappable tags, a 60F+61=62F balance
// consistency check) -- the sellable half is the fidelity report, not the mapping alone. Kernel emits
// JSON only (one canonical hash path); camt XML serialization from this JSON is page-side.
// Field vocabulary (MT tag -> camt element path) reused verbatim from tools/402's decoder table.
// NEXTSUGG-WAVE-BUILD-SPEC.md §1.

const MT_TYPE_TO_TARGET = { '940': 'camt.053', '950': 'camt.053', '942': 'camt.052', '900': 'camt.054', '910': 'camt.054' };
const STATEMENT_TYPES = new Set(['940', '950', '942']);
const NOTIFICATION_TYPES = new Set(['900', '910']);
const MT86_MT_LIMIT = 390; // 6 lines x 65 chars, MT field spec
const MT72_MT_LIMIT = 210; // 6 lines x 35 chars
const CAMT_INSTR_MAX = 140; // Max140Text -- real data-loss direction, unlike :86:

function safeStr(v) { return typeof v === 'string' ? v : ''; }

function parseFields(text) {
  const lines = safeStr(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const fields = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^:(\d{2}[A-Z]?):(.*)$/);
    if (m) {
      if (current) fields.push(current);
      current = { tag: m[1], value: m[2] };
    } else if (current) {
      current.value += '\n' + line;
    }
  }
  if (current) fields.push(current);
  return fields.map((f) => ({ tag: f.tag, value: f.value.replace(/\n+$/, '') }));
}

function detectHeaderMtType(text) {
  const m = safeStr(text).match(/\{2:[IO](\d{3})/);
  return m ? m[1] : null;
}

function centsFromMtAmount(s) {
  if (typeof s !== 'string' || !/^[0-9]+,[0-9]*$/.test(s)) return null;
  const [whole, frac] = s.split(',');
  const fracPadded = (frac || '').padEnd(2, '0').slice(0, 2);
  return parseInt(whole, 10) * 100 + parseInt(fracPadded, 10);
}

function yymmddToIso(s) {
  if (typeof s !== 'string' || !/^\d{6}$/.test(s)) return null;
  const yy = parseInt(s.slice(0, 2), 10);
  const year = 2000 + yy; // assumption: all yy in [00,99] map to 20YY -- documented, no MT9xx pre-2000 use expected
  return `${year}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
}

function parseBalanceField(value) {
  // [D/C]YYMMDD[CCY][amount,]  e.g. C260801USD1234,56
  const m = safeStr(value).match(/^([DC])(\d{6})([A-Z]{3})([0-9]+,[0-9]*)$/);
  if (!m) return null;
  const [, dc, date, ccy, amt] = m;
  const cents = centsFromMtAmount(amt);
  if (cents === null) return null;
  return { dc, date_iso: yymmddToIso(date), currency: ccy, amount_cents: cents, signed_cents: dc === 'C' ? cents : -cents };
}

function parseStatementLine(value) {
  // 6!n[4!n]2a[1!a]15d1!a3!c16x[//16x][34x]
  const m = safeStr(value).match(/^(\d{6})(\d{4})?(RD|RC|D|C)([A-Z])?([0-9]+,[0-9]*)([A-Z][A-Z0-9]{3})?(.*)$/);
  if (!m) return null;
  const [, valueDate, entryDate, dc, fundsCode, amtRaw, txType, rest] = m;
  const amount_cents = centsFromMtAmount(amtRaw);
  if (amount_cents === null) return null;
  const signed_cents = (dc === 'C' || dc === 'RD') ? amount_cents : -amount_cents;
  let customer_ref = null, bank_ref = null;
  const restTrim = safeStr(rest);
  const slashIdx = restTrim.indexOf('//');
  if (slashIdx >= 0) {
    customer_ref = restTrim.slice(0, slashIdx) || null;
    bank_ref = restTrim.slice(slashIdx + 2) || null;
  } else if (restTrim) {
    customer_ref = restTrim;
  }
  return {
    value_date_iso: yymmddToIso(valueDate),
    entry_date_mmdd: entryDate || null,
    dc,
    funds_code: fundsCode || null,
    amount_cents,
    signed_cents,
    transaction_type_code: txType || null,
    customer_reference: customer_ref,
    bank_reference: bank_ref,
  };
}

function mt86Finding(value, entryIndex) {
  const findings = [];
  const len = safeStr(value).length;
  if (len > MT86_MT_LIMIT) findings.push({ tag: '86', entry_index: entryIndex, code: 'TAG_86_EXCEEDS_MT_LIMIT', detail: `:86: narrative is ${len} chars, exceeding the MT 6x65=${MT86_MT_LIMIT}-char field spec; source message was already non-conformant.` });
  if (/\?\d\d/.test(value)) findings.push({ tag: '86', entry_index: entryIndex, code: 'STRUCTURED_SUBFIELDS_NOT_DECODED', detail: 'Narrative contains structured ?nn subfield codes; this mapper carries the raw text into AddtlNtryInf without decoding individual ?nn codes to camt.053 usage-guideline sub-elements.' });
  return findings;
}

function buildStatement(fields, target) {
  const rejected = [];
  const get = (tag) => fields.find((f) => f.tag === tag);
  const msgIdF = get('20');
  const acctF = get('25');
  const seqF = get('28C');
  const openF = fields.find((f) => f.tag === '60F' || f.tag === '60M');
  const closeF = fields.find((f) => f.tag === '62F' || f.tag === '62M');

  if (!msgIdF) rejected.push({ where: ':20:', reason: 'missing Transaction Reference Number' });
  if (!acctF) rejected.push({ where: ':25:', reason: 'missing Account Identification' });
  if (!openF) rejected.push({ where: ':60F:/:60M:', reason: 'missing opening balance' });
  // MT942 (camt.052, interim report) has no closing-balance field by spec -- only MT940/950 (camt.053) do.
  if (!closeF && target !== 'camt.052') rejected.push({ where: ':62F:/:62M:', reason: 'missing closing balance' });

  const opening = openF ? parseBalanceField(openF.value) : null;
  if (openF && !opening) rejected.push({ where: `:${openF.tag}:`, reason: 'opening balance did not match [D/C]YYMMDD CCY amount format', supplied: openF.value });
  const closing = closeF ? parseBalanceField(closeF.value) : null;
  if (closeF && !closing) rejected.push({ where: `:${closeF.tag}:`, reason: 'closing balance did not match [D/C]YYMMDD CCY amount format', supplied: closeF.value });

  let stmt_number = null, seq_number = null;
  if (seqF) {
    const parts = safeStr(seqF.value).split('/');
    stmt_number = parts[0] || null;
    seq_number = parts.length > 1 ? parts[1] : null;
  }

  const entries = [];
  const unmappable_tags = [];
  const truncation_findings = [];
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].tag !== '61') continue;
    const entryIndex = entries.length;
    const parsed = parseStatementLine(fields[i].value);
    if (!parsed) {
      unmappable_tags.push({ tag: '61', index: entryIndex, reason: 'statement line did not match the MT :61: composite format', supplied: fields[i].value });
      continue;
    }
    let narrative = null;
    if (fields[i + 1] && fields[i + 1].tag === '86') {
      narrative = fields[i + 1].value;
      truncation_findings.push(...mt86Finding(narrative, entryIndex));
    }
    entries.push({ ...parsed, narrative, camt_path: `${target === 'camt.052' ? 'BkToCstmrAcctRpt/Rpt' : 'BkToCstmrStmt/Stmt'}/Ntry` });
  }

  const currency_consistent = !!(opening && closing && opening.currency === closing.currency);
  let balance_check = null;
  if (opening && closing) {
    const expected_closing_cents = opening.signed_cents + entries.reduce((s, e) => s + e.signed_cents, 0);
    balance_check = {
      opening_signed_cents: opening.signed_cents,
      sum_entries_signed_cents: entries.reduce((s, e) => s + e.signed_cents, 0),
      expected_closing_signed_cents: expected_closing_cents,
      actual_closing_signed_cents: closing.signed_cents,
      currency_consistent,
      pass: currency_consistent && expected_closing_cents === closing.signed_cents,
      discrepancy_cents: currency_consistent ? (closing.signed_cents - expected_closing_cents) : null,
    };
  }

  const root = target === 'camt.052' ? 'BkToCstmrAcctRpt/Rpt' : 'BkToCstmrStmt/Stmt';
  const mapping = [
    msgIdF && { mt_tag: '20', camt_path: `${target === 'camt.052' ? 'BkToCstmrAcctRpt/GrpHdr' : 'BkToCstmrStmt/GrpHdr'}/MsgId`, value: msgIdF.value, transform: 'direct' },
    acctF && { mt_tag: '25', camt_path: `${root}/Acct/Id/IBAN or Othr`, value: acctF.value.trim(), transform: 'IBAN direct; non-IBAN to Othr/Id' },
    seqF && { mt_tag: '28C', camt_path: `${root}/${target === 'camt.052' ? 'RptPgntn' : 'StmtPgntn'} or LglSeqNb`, value: seqF.value, transform: 'split statement/sequence number' },
    opening && { mt_tag: openF.tag, camt_path: `${root}/Bal[Tp/CdOrPrtry/Cd=OPBD]`, value: openF.value, transform: 'balance field parse' },
    closing && { mt_tag: closeF.tag, camt_path: `${root}/Bal[Tp/CdOrPrtry/Cd=CLBD]`, value: closeF.value, transform: 'balance field parse' },
    entries.length > 0 && { mt_tag: '61', camt_path: `${root}/Ntry`, value: `${entries.length} statement line(s)`, transform: 'composite MT61 parse to structured Ntry[]' },
  ].filter(Boolean);

  return {
    root,
    stmt_number, seq_number,
    account_id: acctF ? acctF.value.trim() : null,
    message_id: msgIdF ? msgIdF.value.trim() : null,
    opening, closing,
    entries,
    mapping,
    unmappable_tags,
    truncation_findings,
    balance_check,
    rejected_inputs: rejected,
  };
}

function buildNotification(fields, dcAssumed) {
  const rejected = [];
  const get = (tag) => fields.find((f) => f.tag === tag);
  const msgIdF = get('20');
  const relRefF = get('21');
  const acctF = get('25');
  const valF = get('32A');
  const ordF = fields.find((f) => f.tag === '52A' || f.tag === '52D');
  const infoF = get('72');

  if (!msgIdF) rejected.push({ where: ':20:', reason: 'missing Transaction Reference Number' });
  if (!acctF) rejected.push({ where: ':25:', reason: 'missing Account Identification' });
  if (!valF) rejected.push({ where: ':32A:', reason: 'missing value date / currency / amount' });

  let value = null;
  if (valF) {
    const m = safeStr(valF.value).match(/^(\d{6})([A-Z]{3})([0-9]+,[0-9]*)$/);
    if (m) {
      const cents = centsFromMtAmount(m[3]);
      value = cents === null ? null : { value_date_iso: yymmddToIso(m[1]), currency: m[2], amount_cents: cents, dc: dcAssumed };
    }
    if (!value) rejected.push({ where: ':32A:', reason: 'did not match YYMMDD CCY amount format', supplied: valF.value });
  }

  const truncation_findings = [];
  if (infoF) {
    const len = safeStr(infoF.value).length;
    if (len > MT72_MT_LIMIT) truncation_findings.push({ tag: '72', code: 'TAG_72_EXCEEDS_MT_LIMIT', detail: `:72: is ${len} chars, exceeding the MT 6x35=${MT72_MT_LIMIT}-char field spec.` });
    if (len > CAMT_INSTR_MAX) truncation_findings.push({ tag: '72', code: 'DATA_LOSS_RISK_MAX140TEXT', detail: `:72: content (${len} chars) exceeds camt Max140Text (${CAMT_INSTR_MAX}); mapping to InstrForNxtAgt truncates or requires SplmtryData carry-over.` });
  }

  const root = 'BkToCstmrDbtCdtNtfctn/Ntfctn';
  const mapping = [
    msgIdF && { mt_tag: '20', camt_path: `${root.split('/')[0]}/GrpHdr/MsgId`, value: msgIdF.value, transform: 'direct' },
    relRefF && { mt_tag: '21', camt_path: `${root}/Ntry/NtryDtls/TxDtls/Refs/InstrId`, value: relRefF.value, transform: 'direct' },
    acctF && { mt_tag: '25', camt_path: `${root}/Acct/Id/IBAN or Othr`, value: acctF.value.trim(), transform: 'IBAN direct; non-IBAN to Othr/Id' },
    valF && { mt_tag: '32A', camt_path: `${root}/Ntry/(Amt + ValDt/Dt + CdtDbtInd)`, value: valF.value, transform: 'split date/currency/amount; CdtDbtInd from message type (900=DBIT,910=CRDT)' },
    ordF && { mt_tag: ordF.tag, camt_path: `${root}/Ntry/NtryDtls/TxDtls/RltdAgts/InstgAgt`, value: ordF.value, transform: 'BIC direct' },
    infoF && { mt_tag: '72', camt_path: `${root}/Ntry/NtryDtls/TxDtls/AddtlTxInf`, value: infoF.value, transform: '6x35=210 chars vs Max140Text -- data-loss risk direction' },
  ].filter(Boolean);

  return {
    root,
    message_id: msgIdF ? msgIdF.value.trim() : null,
    related_reference: relRefF ? relRefF.value.trim() : null,
    account_id: acctF ? acctF.value.trim() : null,
    ordering_institution: ordF ? ordF.value.trim() : null,
    notification_info: infoF ? infoF.value : null,
    value,
    mapping,
    unmappable_tags: [],
    truncation_findings,
    balance_check: null,
    rejected_inputs: rejected,
  };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];
  const message_text = safeStr(pp.message_text);

  if (!message_text.trim()) rejected_inputs.push({ where: 'message_text', reason: 'absent or empty' });

  const headerType = detectHeaderMtType(message_text);
  const declared = ['900', '910', '940', '942', '950'].includes(safeStr(pp.declared_mt_type)) ? pp.declared_mt_type : null;
  let mt_type = headerType && MT_TYPE_TO_TARGET[headerType] ? headerType : (declared || null);
  const mt_type_conflict = !!(headerType && declared && headerType !== declared);
  if (!mt_type) rejected_inputs.push({ where: 'mt_type', reason: 'could not detect a supported MT9xx type from the {2:...} header and no declared_mt_type override supplied' });

  const requestedTarget = ['camt.053', 'camt.052', 'camt.054'].includes(safeStr(pp.target)) ? pp.target : null;
  const default_target = mt_type ? MT_TYPE_TO_TARGET[mt_type] : null;
  const target = requestedTarget || default_target;
  const target_overridden = !!(requestedTarget && default_target && requestedTarget !== default_target);

  const fields = parseFields(message_text);
  if (message_text.trim() && fields.length === 0) rejected_inputs.push({ where: 'message_text', reason: 'no :NN: tag-line fields found' });

  const supported = !!mt_type && !!target;
  let body = null;
  if (supported) {
    body = STATEMENT_TYPES.has(mt_type)
      ? buildStatement(fields, target)
      : buildNotification(fields, mt_type === '900' ? 'DBIT' : 'CRDT');
  }

  const data_loss_warnings = [];
  if (mt_type_conflict) data_loss_warnings.push('DECLARED_MT_TYPE_CONFLICTS_WITH_HEADER: using header-detected type.');
  if (target_overridden) data_loss_warnings.push(`TARGET_OVERRIDDEN_FROM_DEFAULT: requested ${requestedTarget}, default for MT${mt_type} is ${default_target}.`);

  const structural_incomplete = !supported || (body && body.rejected_inputs.length > 0);
  const has_findings = !!body && (body.unmappable_tags.length > 0 || body.truncation_findings.length > 0 || (body.balance_check && !body.balance_check.pass) || data_loss_warnings.length > 0);

  let verdict;
  if (structural_incomplete) verdict = 'UNMAPPABLE';
  else if (has_findings) verdict = 'MAPPED_WITH_WARNINGS';
  else verdict = 'CLEAN';

  const compliance_flags = [];
  compliance_flags.push(`MT9XX_CAMT_MAP_${verdict}`);
  if (rejected_inputs.length) compliance_flags.push('MT9XX_CAMT_INPUTS_INSUFFICIENT');

  const output_payload = {
    mt_type,
    mt_type_conflict,
    target,
    default_target,
    target_overridden,
    camt_message_root: body ? body.root : null,
    account_id: body ? body.account_id : null,
    message_id: body ? body.message_id : null,
    mapping: body ? body.mapping : [],
    statement: body && STATEMENT_TYPES.has(mt_type) ? {
      stmt_number: body.stmt_number, seq_number: body.seq_number,
      opening: body.opening, closing: body.closing, entries: body.entries,
    } : null,
    notification: body && NOTIFICATION_TYPES.has(mt_type) ? {
      related_reference: body.related_reference,
      ordering_institution: body.ordering_institution,
      notification_info: body.notification_info,
      value: body.value,
    } : null,
    fidelity_report: {
      truncation_findings: body ? body.truncation_findings : [],
      unmappable_tags: body ? body.unmappable_tags : [],
      data_loss_warnings,
      balance_check: body ? body.balance_check : null,
    },
    verdict,
    rejected_inputs: [...rejected_inputs, ...(body ? body.rejected_inputs : [])],
    disambiguation: 'map_mt9xx_to_camt maps a pasted MT900/910/940/942/950 statement/notification message to a camt.052/053/054-shaped JSON mapping object plus a fidelity report (truncation, unmappable tags, 60F+61=62F balance check). It reuses tools/402\'s MT-to-camt field vocabulary but does not duplicate art-565-camt053-reconciliation-workbench\'s bank-vs-ledger reconciliation semantics -- this node maps message format, art-565 (tools/565) reconciles already-mapped camt.053 data against a ledger.',
    pii_note: 'Statement/notification data may include real account numbers and counterparty references if a caller pastes a genuine message. This tool is zero-egress and computes entirely client-side or server-side per compute_mode; goldens ship synthetic statements only.',
    no_swift_endorsement: 'This mapping is produced by AINumbers.co and carries no Swift endorsement. Swift does not provide MT-to-ISO 20022 conversion tooling.',
    coexistence_note: 'Swift MT900/910/940/942/950 retirement runs the 2027-28 coexistence window; camt receive-capability is mandated from 2027-11 (dated observation, not a compliance-deadline claim by this tool).',
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
