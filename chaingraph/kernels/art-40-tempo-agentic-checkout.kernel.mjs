/**
 * art-40-tempo-agentic-checkout.kernel.mjs
 * Tempo Agentic Checkout — protocol binding to ISO 20022 pacs.008 + TIP-20.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-40-tempo-agentic-checkout';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'map_tempo_settlement',
  mandate_type: 'settlement_mandate',
  gpu:          false,
};

const PROTOCOL_BINDINGS = {
  'ACP': {
    standard:     'ACP (Agentic Commerce Protocol)',
    fields_mapped: 'ACP session.reference → memo · ACP buyer_agent → debtor · ACP merchant_agent → creditor',
  },
  'Visa TAP': {
    standard:     'Visa Trusted Agent Protocol (TAP)',
    fields_mapped: 'TAP.reference → memo · TAP.cardholder → debtor · TAP.merchant → creditor',
  },
  'Manual ISO 20022': {
    standard:     'ISO 20022 pacs.008 (FI-to-FI Customer Credit Transfer)',
    fields_mapped: 'RmtInf → memo · Dbtr → debtor · Cdtr → creditor · InstrAmt → instructed_amount',
  },
  'On-chain Tempo tx': {
    standard:     'Tempo MPP (HTTP 402 · live March 2026)',
    fields_mapped: 'tx.memo → remittance_information · tx.sender → debtor · tx.receiver → creditor · tx.amount → instructed_amount',
  },
};

function deterministicAddr(name) {
  const str = name || 'unknown';
  // Simple deterministic address: use char codes to build hex
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) >>> 0;
  }
  // Build 20-char hex from name chars + hash
  const base   = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 16).padEnd(16, '0');
  const suffix = hash.toString(16).padStart(4, '0').slice(0, 4);
  return '0x' + base + suffix;
}

export function compute(pp) {
  const protocol       = pp.protocol      ?? 'Manual ISO 20022';
  const rawRef         = pp.rawRef        ?? '';
  const senderName     = pp.senderName    ?? '';
  const senderLei      = pp.senderLei     ?? null;
  const receiverName   = pp.receiverName  ?? '';
  const receiverLei    = pp.receiverLei   ?? null;
  const amount         = pp.amount        ?? 0;
  const stablecoin     = pp.stablecoin    ?? 'USDC';
  const creditorBic    = pp.creditorBic   ?? 'TMPOXYZ1';
  const settlementDate = pp.settlementDate ?? null;

  // Memo truncation
  let memo      = rawRef || 'ORD-REF';
  let truncated = false;
  if (memo.length > 32) {
    memo      = memo.slice(0, 32);
    truncated = true;
  }

  // Protocol binding (fallback to Manual ISO 20022)
  const protocolInfo = PROTOCOL_BINDINGS[protocol] ?? PROTOCOL_BINDINGS['Manual ISO 20022'];

  // TIP-20 transfer
  const tip20_transfer = {
    network:          'tempo-mainnet',
    token_standard:   'TIP-20',
    stablecoin,
    currency:         'USD',
    amount,
    memo,
    sender_address:   deterministicAddr(senderName),
    receiver_address: deterministicAddr(receiverName),
    settlement_date:  settlementDate || null,
  };

  // ISO 20022 pacs.008
  const iso20022_pacs008 = {
    message_type:      'pacs.008.001',
    instructed_amount: { amount, currency: 'USD' },
    debtor: {
      party_name: senderName,
      lei:        senderLei || null,
    },
    debtor_agent:  { bicfi: 'TMPOXYZ1' },
    creditor: {
      party_name: receiverName,
      lei:        receiverLei || null,
    },
    creditor_agent:          { bicfi: creditorBic || 'TMPOXYZ1' },
    settlement_date:         settlementDate || null,
    remittance_information:  memo,
    charge_bearer:           'SLEV',
  };

  const compliance_flags = truncated ? ['MEMO_TRUNCATED'] : [];

  const output_payload = {
    protocol,
    memo,
    truncated,
    tip20_transfer,
    iso20022_pacs008,
    protocol_binding: protocolInfo,
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version: '1.0.0',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
