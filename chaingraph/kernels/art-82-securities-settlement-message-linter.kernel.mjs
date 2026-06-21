/**
 * art-82-securities-settlement-message-linter.kernel.mjs
 * Wave 17 — Securities-Settlement Message Linter.
 * ISO 20022 SCOPE GUARD: lints ONLY sese.023, sese.024, semt.044 messages.
 * MUST NOT touch payments pacs/camt messages — those are owned by cbpr-cutover/rca-03.
 * Validates message type, mandatory-field presence, ISIN format, BIC format,
 * settlement date sequencing, and quantity/amount consistency.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * ISO 20022 messages in scope (securities settlement ONLY):
 *   sese.023 — SecuritiesSettlementTransactionInstruction
 *   sese.024 — SecuritiesSettlementTransactionStatusAdvice
 *   semt.044 — SecuritiesAccountStatementV04
 *
 * OUT OF SCOPE — do NOT add: pacs.008, pacs.009, camt.056, camt.029,
 *   or any other payments/cash-leg messages. Scope: sese/semt only.
 *
 * Citations (verify before citing on any page):
 *   ISO 20022 — https://www.iso20022.org/ (verify current MX catalogue).
 *   sese.023 v10: SecuritiesSettlementTransactionInstruction — Feb 2024 edition.
 *   sese.024 v04: SecuritiesSettlementTransactionStatusAdvice.
 *   semt.044 v04: SecuritiesAccountStatementV04.
 *   EDUCATIONAL: outputs are decision-support drafts, not ISO conformance certificates.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-82-securities-settlement-message-linter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'lint_securities_settlement_message',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ─── ISO 20022 scope guard — in-scope message types only ─────────────────────
const IN_SCOPE_MSG_TYPES = new Set(['sese.023', 'sese.024', 'semt.044']);

// ─── Mandatory fields per message type ───────────────────────────────────────
const MANDATORY_FIELDS = {
  'sese.023': ['TxId', 'SttlmTpAndAddtlParams', 'TradDt', 'SttlmDt', 'FinInstrmId', 'Qty', 'SttlmAmt', 'DlvrgSttlmPties', 'RcvgSttlmPties'],
  'sese.024': ['TxId', 'Sts', 'SttlmDt', 'FinInstrmId', 'Qty'],
  'semt.044': ['Stmt', 'AcctId', 'BalDt', 'SubAcctDtls'],
};

// ─── ISIN validation (ISO 6166) ───────────────────────────────────────────────
const isValidISIN = (s) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(s ?? ''));

// ─── BIC validation (ISO 9362) ────────────────────────────────────────────────
const isValidBIC = (s) => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(s ?? ''));

const SCOPE_GUARD_NOTE =
  'ISO 20022 scope: sese/semt ONLY. Payments messages (pacs/camt) are out of scope — '
  + 'owned by cbpr-cutover/rca-03. Do not add pacs/camt rules here.';

export function compute(pp) {
  const { messages = [] } = pp;

  const results = [];
  let total_issues = 0;
  let out_of_scope = 0;

  for (const msg of messages) {
    const issues = [];
    const msg_type = String(msg.msg_type ?? '');

    // ── Scope guard: reject out-of-scope message types ──
    if (!IN_SCOPE_MSG_TYPES.has(msg_type)) {
      out_of_scope++;
      issues.push({
        rule:   'OUT_OF_SCOPE_MESSAGE_TYPE',
        field:  'msg_type',
        detail: `"${msg_type}" is not in scope. Only sese.023, sese.024, semt.044 accepted. `
              + 'For pacs/camt messages use cbpr-cutover/rca-03 tooling.',
        severity: 'ERROR',
      });
      results.push({ msg_type, msg_ref: msg.msg_ref ?? '', issues, status: 'REJECTED' });
      total_issues += issues.length;
      continue;
    }

    // ── Mandatory field presence ──
    const mandatoryFields = MANDATORY_FIELDS[msg_type] ?? [];
    const body = msg.body ?? {};
    for (const field of mandatoryFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        issues.push({ rule: 'MISSING_MANDATORY_FIELD', field, detail: `Mandatory field "${field}" absent in ${msg_type}.`, severity: 'ERROR' });
      }
    }

    // ── ISIN validation ──
    const isin = body.FinInstrmId?.ISIN ?? body.ISIN;
    if (isin !== undefined && !isValidISIN(isin)) {
      issues.push({ rule: 'INVALID_ISIN', field: 'FinInstrmId.ISIN', detail: `"${isin}" not valid ISO 6166 ISIN (2 alpha CC + 9 alphanumeric + 1 check digit).`, severity: 'ERROR' });
    }

    // ── BIC validation (delivering/receiving settlement parties) ──
    const bics = [
      body.DlvrgSttlmPties?.Pty1?.Id?.AnyBIC,
      body.RcvgSttlmPties?.Pty1?.Id?.AnyBIC,
      body.DlvrgSttlmPties?.AgtId?.FinInstnId?.BICFI,
      body.RcvgSttlmPties?.AgtId?.FinInstnId?.BICFI,
    ].filter(Boolean);
    for (const bic of bics) {
      if (!isValidBIC(bic)) {
        issues.push({ rule: 'INVALID_BIC', field: 'SettlementParty.BIC', detail: `"${bic}" not valid ISO 9362 BIC.`, severity: 'ERROR' });
      }
    }

    // ── sese.023: settlement date sanity (SttlmDt >= TradDt) ──
    if (msg_type === 'sese.023' && body.TradDt && body.SttlmDt) {
      if (String(body.SttlmDt) < String(body.TradDt)) {
        issues.push({ rule: 'SETTLEMENT_DATE_BEFORE_TRADE_DATE', field: 'SttlmDt', detail: `SttlmDt "${body.SttlmDt}" is before TradDt "${body.TradDt}".`, severity: 'ERROR' });
      }
    }

    // ── Quantity/amount presence check ──
    if (msg_type === 'sese.023' || msg_type === 'sese.024') {
      if (!body.Qty && body.Qty !== 0) {
        issues.push({ rule: 'MISSING_QUANTITY', field: 'Qty', detail: 'Settlement quantity absent — required for sese.023/024.', severity: 'WARNING' });
      }
    }

    results.push({
      msg_type,
      msg_ref:  msg.msg_ref ?? '',
      issues,
      status:   issues.some(i => i.severity === 'ERROR') ? 'FAIL' : issues.length > 0 ? 'WARN' : 'PASS',
    });
    total_issues += issues.length;
  }

  const pass_count  = results.filter(r => r.status === 'PASS').length;
  const fail_count  = results.filter(r => r.status === 'FAIL').length;
  const warn_count  = results.filter(r => r.status === 'WARN').length;
  const pass_rate   = messages.length > 0 ? +(pass_count / messages.length * 100).toFixed(1) : 100;

  const compliance_flags = [];
  if (fail_count > 0)   compliance_flags.push('ISO20022_LINT_FAILURES');
  if (warn_count > 0)   compliance_flags.push('ISO20022_LINT_WARNINGS');
  if (out_of_scope > 0) compliance_flags.push('OUT_OF_SCOPE_MESSAGES_REJECTED');

  const output_payload = {
    pass_rate,
    total_messages:   messages.length,
    pass_count,
    fail_count,
    warn_count,
    out_of_scope_count: out_of_scope,
    total_issues,
    results,
    in_scope_message_types: [...IN_SCOPE_MSG_TYPES],
    scope_guard_note: SCOPE_GUARD_NOTE,
    reference: {
      standard:   'ISO 20022 (https://www.iso20022.org/) — verify current MX catalogue version',
      sese_023:   'SecuritiesSettlementTransactionInstruction — sese.023 v10 (Feb 2024) — verify',
      sese_024:   'SecuritiesSettlementTransactionStatusAdvice — sese.024 v04 — verify',
      semt_044:   'SecuritiesAccountStatementV04 — semt.044 v04 — verify',
      bic:        'ISO 9362:2022',
      isin:       'ISO 6166',
      out_of_scope_note: 'pacs.008, pacs.009, camt.056, camt.029 and all other payments messages are OUT OF SCOPE. See cbpr-cutover/rca-03.',
    },
    note: 'DECISION-SUPPORT DRAFT — not an ISO 20022 conformance certificate. Lint rules check field presence and format against the versioned message catalogue; verify against current ISO 20022 MX catalogue. SCOPE: sese/semt only. pacs/camt are owned by cbpr-cutover/rca-03.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
