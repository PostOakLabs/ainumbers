#!/usr/bin/env node
// gen-agentic-payments-map.mjs — AGENTIC-PAY-COOKBOOK-EXPLAINER-1.
//
// Renders chaingraph/agentic-payments-map.html and chaingraph/data/agentic-payments-map.json
// from ONE source table (ROWS below) + chaingraph.json. Node/chain references are resolved
// live from chaingraph.json (never hand-typed) so a renamed/removed node cannot leave a
// dangling reference: an unresolved tool_id or chain name is a hard error at generation time.
//
// Every cell that makes an external-spec claim cites a pinned snapshot from
// research/AGENTIC-PAY-SNAPSHOT-INDEX-2026-08-17.md (retrieved for AGENTIC-PAY-RETRIEVAL-1).
// Cells with no governing text say so plainly rather than inventing a citation.
//
// Node-local generator (reads chaingraph.json for link resolution only; does not regenerate
// any file in scripts/derived-artifacts.mjs's shared set). --check wired into preflight.mjs
// alongside this row's dead-link / sitemap / copy-hallmarks gates, same pattern as
// scripts/gen-clause-edge-report.mjs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNav, buildFooter, CHROME_CSS } from '../chaingraph/_page-chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CG_PATH = join(ROOT, 'chaingraph', 'chaingraph.json');
const OUT_JSON = join(ROOT, 'chaingraph', 'data', 'agentic-payments-map.json');
const OUT_HTML = join(ROOT, 'chaingraph', 'agentic-payments-map.html');
const CHECK = process.argv.includes('--check');

const cg = JSON.parse(readFileSync(CG_PATH, 'utf8'));

// Page lives at chaingraph/agentic-payments-map.html; node.url is an absolute
// https://ainumbers.co/<path> — relativize to "../<path>" from that location.
function relFromChaingraph(absUrl) {
  const path = absUrl.replace(/^https:\/\/ainumbers\.co\//, '');
  return path.startsWith('chaingraph/') ? path.slice('chaingraph/'.length) : `../${path}`;
}

function resolveNode(shortId) {
  const node = cg.nodes.find((n) => n.tool_id === shortId || n.tool_id.startsWith(shortId + '-'));
  if (!node) throw new Error(`gen-agentic-payments-map: node "${shortId}" not found in chaingraph.json — dangling reference`);
  return { id: shortId, tool_id: node.tool_id, title: node.display_name, url: relFromChaingraph(node.url), status: node.status };
}

function resolveChain(name) {
  const chain = cg.chains.find((c) => c.name === name);
  if (!chain) throw new Error(`gen-agentic-payments-map: chain "${name}" not found in chaingraph.json — dangling reference`);
  return { name: chain.name, title: chain.title, url: relFromChaingraph(chain.composer_url) };
}

// Pinned snapshot sources, keyed to research/AGENTIC-PAY-SNAPSHOT-INDEX-2026-08-17.md rows 1-10.
const SRC = {
  x402: { n: 1, doc: 'x402 v2 spec' },
  vpsf: { n: 2, doc: 'draft-vauban-x402-vpsf-algebra-01' },
  stark: { n: 3, doc: 'draft-vauban-x402-stark-receipts-00' },
  starkconf: { n: 4, doc: 'x402-stark-receipts-conformance' },
  acp: { n: 5, doc: 'ACP stable spec' },
  ap2: { n: 6, doc: 'AP2 (FIDO-governed)' },
  cookbook: { n: 7, doc: 'OpenAI×AWS AgentCore Payments cookbook' },
  circle: { n: 8, doc: 'Circle, "Building the open agentic economy"' },
  erc8004: { n: 9, doc: 'ERC-8004' },
  mpp: { n: 10, doc: 'MPP (Machine Payments Protocol, Tempo/Stripe)' },
};
function cite(key, section) { return { src: SRC[key].n, doc: SRC[key].doc, section }; }

// ── THE SOURCE TABLE — SSOT for both the JSON twin and the rendered page. ──────────────────
const ROWS = [
  {
    concept: 'Bounded pre-authorization to spend',
    agentcore: 'ApprovalGrant{approval_id, request_id, resource_url, purpose, maximum_amount, approved_by, expires_at, currency}. App-issued; the model never sets these values.',
    x402: 'No pre-authorization primitive. x402 payment is settled per-request rather than pre-scoped.',
    mpp: 'No direct equivalent in the pinned core/tempo specs',
    vpsf: 'DelegationGrant (§3.2): a principal authorises an agent to spawn PaymentIntents within a scoped constraint set',
    acp: 'delegate_payment / delegate_authentication schema objects',
    ap2: 'Checkout Mandate / Payment Mandate (current FIDO-governed spec text; the earlier "Intent/Cart Mandate" naming does not appear in the pinned spec)',
    erc8004: 'n/a',
    verifiers: ['art-01', 'art-16', 'art-17', 'art-274', 'art-476'],
    asserts: 'Mandate-chain signature, scope, and limit-consistency integrity across the Intent→Cart→Payment trio (art-01); translation of a mandate declared under one protocol into another\'s fields (art-476).',
    notAsserts: 'Whether the merchant actually honored the approval at settlement time is a separate question, covered below.',
    cites: [cite('cookbook', 'ApprovalGrant field shape'), cite('vpsf', '§3.2 DelegationGrant'), cite('acp', 'delegate_payment / delegate_authentication schemas'), cite('ap2', 'specification.md, Mandate types: Checkout Mandate and Payment Mandate')],
  },
  {
    concept: 'A specific purchase the agent wants to make',
    agentcore: 'PurchaseRequest{request_id, resource_url, purpose, idempotency_key}',
    x402: 'PAYMENT-SIGNATURE request header: the client presents payment proof for the resource',
    mpp: 'draft-httpauth-payment-00 payment-request field (core HTTP auth scheme, generic across tempo methods)',
    vpsf: 'PaymentIntent (§3.2): the initiating state, records the payer\'s commitment',
    acp: 'agentic_checkout schema object',
    ap2: 'No distinct object; folded into Checkout/Payment Mandate above',
    erc8004: 'n/a',
    verifiers: ['art-26', 'art-01'],
    asserts: 'Decodes and lints the base64 PAYMENT-SIGNATURE header shape against the exact-scheme x402 flow (art-26).',
    notAsserts: 'Does not verify the merchant actually fulfilled the purchase.',
    cites: [cite('cookbook', 'PurchaseRequest field shape, idempotency_key'), cite('x402', 'PAYMENT-SIGNATURE header'), cite('vpsf', '§3.2 PaymentIntent'), cite('acp', 'json-schema/schema.agentic_checkout.json')],
  },
  {
    concept: 'Evidence the payment settled',
    agentcore: 'Receipt{receipt_id, amount, currency, network, reused}',
    x402: 'PAYMENT-RESPONSE header / SettleResponse.transaction (§5.3.2)',
    mpp: 'Tempo session voucher/receipt (see the MPP row below: same shape, its own row for the field-level divergences found)',
    vpsf: 'SettlementReceipt (§3.2): the terminal successful state, linked to its originating PaymentIntent by JCS Preimage Hash',
    acp: 'No distinct receipt object in the pinned spec beyond checkout completion',
    ap2: 'No distinct object; receipt evidence is carried inside the Payment Mandate flow',
    erc8004: 'n/a',
    verifiers: ['art-26', 'art-513'],
    chain: 'x402-spend-evidence',
    asserts: 'Turns one caller-transcribed payment into settlement evidence an audit authority can check (art-513); recomputes the EIP-712 digest, signer recovery, and domain-nonce-window trust signals behind an x402 authorization (x402-spend-evidence chain), described by the chain itself as an evidence bundle rather than a settlement proof.',
    notAsserts: 'Independent confirmation of on-chain settlement finality is out of scope: x402\'s own SettleResponse.transaction is "Blockchain transaction hash (empty string if settlement failed)," a chain-lookup reference rather than a self-contained artifact. That is exactly the gap the STARK-receipts extension (source 3) exists to close, and the estate has not implemented it.',
    cites: [cite('cookbook', 'Receipt field shape'), cite('x402', '§5.3.2 SettleResponse.transaction'), cite('stark', 'line 17: "reference but does not provide a self-contained, offline-verifiable [receipt]"'), cite('vpsf', '§3.2 SettlementReceipt')],
  },
  {
    concept: 'Audit trail of what happened, in order',
    agentcore: 'audit {sequence, event_type}',
    x402: 'No audit-log primitive in the pinned spec',
    mpp: 'No audit-log primitive in the pinned specs',
    vpsf: 'No audit-log primitive: the composite preimage links claims but does not sequence events',
    acp: 'n/a',
    ap2: 'n/a',
    erc8004: 'n/a',
    verifiers: [],
    asserts: 'Every AINumbers node run carries an execution_hash: a deterministic SHA-256 over the RFC 8785 (JCS) canonical form of {policy_parameters, output_payload}, computed by the one shared chaingraph/kernels/_hash.mjs path. That is a content-addressed receipt of one computation rather than an ordered event log.',
    notAsserts: 'This is a different mechanism than AgentCore\'s own internal audit sequence numbers, and it is a receipt scheme rather than a blockchain audit trail.',
    cites: [cite('cookbook', 'audit {sequence, event_type}')],
    noVerifierNote: 'No single node verifies an audit sequence as such: execution_hash is a property of every node\'s own run. See How the Kernel VM Works for the mechanism.',
  },
  {
    concept: 'Whether settlement actually finalized',
    agentcore: 'settlement_verified=false. "Merchant acceptance establishes that the paid request completed. Independent settlement and transaction finality require separate evidence."',
    x402: 'SettleResponse.transaction (§5.3.2): a chain-lookup reference rather than a finality attestation',
    mpp: 'Tempo channel settled/cumulativeAmount fields (uint128) record state; they are not an independent finality confirmation',
    vpsf: 'SettlementReceipt claims settlement occurred; the algebra does not itself define a finality check',
    acp: 'n/a',
    ap2: 'n/a',
    erc8004: 'n/a',
    verifiers: ['art-03', 'art-492', 'art-394'],
    asserts: 'art-492 classifies which of three settlement-finality models applies and its evidentiary weight, vendor-neutral; art-03 recommends a settlement rail based on finality needs across x402/Stripe-USDC/card/ACH/SWIFT; art-394 validates the shape of a Cloudflare deferred x402 handshake.',
    notAsserts: 'None of the three independently observes on-chain confirmation for a specific transaction. That is the same gap AgentCore names with settlement_verified=false.',
    cites: [cite('cookbook', 'settlement_verified=false, "settlement still needs separate evidence"'), cite('x402', '§5.3.2 SettleResponse.transaction')],
  },
  {
    concept: 'A per-run spend cap',
    agentcore: 'policy.per_run_limit',
    x402: 'No run-level budget field; scoping is the caller\'s own responsibility',
    mpp: 'n/a',
    vpsf: 'Closest is DelegationGrant\'s "scoped constraint set" (§3.2), which is not itself a named field',
    acp: 'n/a',
    ap2: 'n/a',
    erc8004: 'n/a',
    verifiers: ['art-02'],
    asserts: 'Simulates thousands of synthetic agent transactions against a user-authored spend policy (per-merchant, per-day, per-transaction caps) and reports policy compliance.',
    notAsserts: 'This is an offline policy simulator; it does not enforce the limit live inside any run.',
    cites: [cite('cookbook', 'policy.per_run_limit')],
  },
  {
    concept: 'A merchant-initiated reversal',
    agentcore: 'Not present in the pinned cookbook text',
    x402: 'Not present in the pinned x402 v2 spec',
    mpp: 'n/a',
    vpsf: 'RefundClaim (§3.2): the reversal state, merchant-initiated, cryptographically linked to the SettlementReceipt it reverses',
    acp: 'n/a',
    ap2: 'n/a',
    erc8004: 'n/a',
    verifiers: [],
    asserts: 'n/a',
    notAsserts: 'No AINumbers node computes or verifies a refund/reversal claim today. This is stated plainly here rather than mapped to a node that does not exist.',
    cites: [cite('vpsf', '§3.2 RefundClaim')],
    noVerifierNote: 'No node. A genuine coverage gap, named here rather than left as a silent omission.',
  },
  {
    concept: 'De-duplicating a retried purchase',
    agentcore: 'PurchaseRequest.idempotency_key',
    x402: 'Not present in the pinned x402 v2 spec',
    mpp: 'n/a',
    vpsf: 'n/a',
    acp: 'n/a',
    ap2: 'n/a',
    erc8004: 'n/a',
    verifiers: [],
    asserts: 'n/a',
    notAsserts: 'No AINumbers node checks or enforces idempotency. This is stated plainly here rather than mapped to a node that does not exist.',
    cites: [cite('cookbook', 'idempotency_key="purchase-cookbook-001"')],
    noVerifierNote: 'No node. A genuine coverage gap, named here rather than left as a silent omission.',
  },
  {
    concept: 'Who the agent claims to be',
    agentcore: 'approved_by field is the closest analog; the pinned cookbook text carries no identity-registry concept',
    x402: 'n/a',
    mpp: 'n/a',
    vpsf: 'n/a',
    acp: 'n/a',
    ap2: 'n/a',
    erc8004: 'Identity Registry: ERC-721 plus URIStorage extension resolving agentId/agentURI to a portable, censorship-resistant registration file',
    verifiers: ['art-604', 'art-04'],
    asserts: 'art-604 checks a caller-supplied claimed ERC-8004 registry entry field-by-field against the registry type it declares (Identity, Reputation, or Validation), with no hardcoded per-registry field names by design. art-04 checks a separate DIF Trusted AI Agents WG credential-chain attestation (KYA-OS), a different standard aimed at the same general question.',
    notAsserts: 'art-04 does not implement ERC-8004. The retrieval pass for this page (see the source list below) checked both its HTML and JSON node files and found zero ERC-8004 citations there, so this table makes no such claim.',
    cites: [cite('erc8004', 'Identity Registry: agentId/agentURI, ERC-721+URIStorage')],
  },
  {
    concept: 'Whether the agent has a track record',
    agentcore: 'n/a',
    x402: 'n/a',
    mpp: 'n/a',
    vpsf: 'n/a',
    acp: 'n/a',
    ap2: 'n/a',
    erc8004: 'Reputation Registry: standard interface for posting and fetching feedback signals (giveFeedback), scored both on-chain and off-chain',
    verifiers: ['art-278'],
    asserts: 'Aggregates a set of OCG execution receipts (attestations) into a deterministic, groth16-provable reputation score.',
    notAsserts: 'This aggregates our own OCG receipts, a parallel scheme over a different evidence source. It does not implement ERC-8004\'s on-chain giveFeedback interface, and it is not a registry client.',
    cites: [cite('erc8004', 'Reputation Registry: giveFeedback, on-chain and off-chain scoring')],
  },
  {
    concept: 'A Tempo/Stripe MPP session voucher or receipt',
    agentcore: 'n/a',
    x402: 'n/a',
    mpp: 'methodDetails.sessionProtocol, cumulativeAmount (uint128 for both v1 and v2)',
    vpsf: 'n/a',
    acp: 'n/a',
    ap2: 'n/a',
    erc8004: 'n/a',
    verifiers: ['art-594', 'art-36'],
    asserts: 'art-594 verifies a Tempo MPP cumulative EIP-712 session voucher offline (ecrecover, no network call); art-36 parses an MPP session and maps its terms to HTTP-request fields.',
    notAsserts: 'The retrieval pass for this page found two open divergences against the pinned spec, left unfixed here since this is a mapping page rather than a kernel edit: art-594\'s input field is named protocolVersion where the spec\'s field is methodDetails.sessionProtocol, and art-594 states v2 uses uint96 where the pinned spec states uint128 for both v1 and v2. Separately, art-36\'s hero copy expands "MPP" as "Money Payment Protocol," where the spec repo\'s own title is "Machine Payments Protocol."',
    cites: [cite('mpp', 'draft-tempo-session-00.md §"Protocol Versions", Contract-Backed Channel State table')],
  },
  {
    concept: 'USDC settlement over Circle\'s Arc network',
    agentcore: 'n/a',
    x402: 'n/a',
    mpp: 'n/a',
    vpsf: 'n/a',
    acp: 'n/a',
    ap2: 'n/a',
    erc8004: 'n/a',
    verifiers: ['art-492', 'art-110', 'art-111'],
    asserts: 'art-110 scores a non-USD stablecoin issuer\'s readiness to join Circle Partner Stablecoins on Arc; art-111 routes each leg of a multi-currency Arc corridor to its per-currency home regime; art-492\'s vendor-neutral finality classification applies to Arc settlements as one of its covered models.',
    notAsserts: 'None of the ten pinned sources for this page is an Arc-specific settlement spec, so this table cites no clause for the Arc mechanics themselves. See the Arc network guide linked here for that detail instead of restating it.',
    cites: [],
    seeAlso: { label: 'Arc / USDC network guide', url: 'guide-arc.html' },
  },
  {
    concept: '"Verifiable compute" as a validation primitive',
    agentcore: 'n/a',
    x402: 'n/a',
    mpp: 'n/a',
    vpsf: 'n/a',
    acp: 'n/a',
    ap2: 'n/a',
    erc8004: 'n/a',
    verifiers: [],
    asserts: 'Circle\'s own market map lists "Validation: ERC-8004 + verifiable compute" as an "Emerging" capability. Nodes carrying compute_proof in this estate ship a zk proof of execution bound to a kernel digest, spec digest, and toolchain digest, the same triple-identity binding the formal-verification pilot documents, which is the same general shape Circle names.',
    notAsserts: 'Coverage is never quoted as a fixed number here; it is a live-derived count (node scripts/check-compute-proof-coverage.mjs), per this estate\'s own standing rule against publishing a duty-bound figure that can silently go stale. This table also makes no claim that our compute_proof and Circle\'s "verifiable compute" category are the same mechanism, only that they name the same general shape.',
    cites: [cite('circle', '"Validation: ERC-8004 + verifiable compute," Emerging')],
    seeAlso: { label: 'How the Formal-Verification Pilot Works (Panel 5: execution binding)', url: '../fv-explainer.html' },
  },
];

function buildData() {
  const rows = ROWS.map((r) => ({
    concept: r.concept,
    agentcore_cookbook: r.agentcore,
    x402_v2: r.x402,
    mpp: r.mpp,
    vpsf_claim_operator: r.vpsf,
    acp_object: r.acp,
    ap2_mandate_type: r.ap2,
    erc8004_registry: r.erc8004,
    ainumbers_verifiers: (r.verifiers || []).map(resolveNode),
    ainumbers_chain: r.chain ? resolveChain(r.chain) : null,
    no_verifier_note: r.noVerifierNote || null,
    see_also: r.seeAlso || null,
    we_assert: r.asserts,
    we_do_not_assert: r.notAsserts,
    cites: r.cites,
  }));
  return {
    generated_at: process.env.AGENTIC_PAY_MAP_TIMESTAMP ?? new Date().toISOString(),
    note: 'Agentic-payments mapping table. Node/chain references are resolved live from chaingraph.json at generation time, so a renamed or removed node fails generation rather than shipping a dangling link. Every claim cites a pinned snapshot from research/AGENTIC-PAY-SNAPSHOT-INDEX-2026-08-17.md; cells with no governing text say so rather than inventing a citation.',
    snapshot_index: 'research/AGENTIC-PAY-SNAPSHOT-INDEX-2026-08-17.md',
    sources: SRC,
    rows,
  };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function citeBadges(cites) {
  if (!cites || !cites.length) return '<span class="no-cite">no governing text among the ten pinned sources</span>';
  return cites.map((c) => `<span class="cite-badge" title="${esc(c.doc)}: ${esc(c.section)}">[${c.src}]</span>`).join(' ');
}

function verifierLinks(verifiers, chain, noVerifierNote, seeAlso) {
  const parts = [];
  for (const v of verifiers) parts.push(`<a href="${esc(v.url)}"><code>${esc(v.tool_id)}</code></a>`);
  if (chain) parts.push(`<a href="${esc(chain.url)}">chain: ${esc(chain.title)}</a>`);
  if (!parts.length) {
    return noVerifierNote
      ? `<span class="gap-note">${esc(noVerifierNote)}</span>`
      : '<span class="gap-note">no node</span>';
  }
  let html = parts.join('<br>');
  if (seeAlso) html += `<br><a href="${esc(seeAlso.url)}" class="see-also-link">${esc(seeAlso.label)} &rarr;</a>`;
  return html;
}

function rowHtml(r) {
  return `
        <tr>
          <td class="concept-cell">${esc(r.concept)}</td>
          <td>${esc(r.agentcore_cookbook)}</td>
          <td>${esc(r.x402_v2)}</td>
          <td>${esc(r.mpp)}</td>
          <td>${esc(r.vpsf_claim_operator)}</td>
          <td>${esc(r.acp_object)}</td>
          <td>${esc(r.ap2_mandate_type)}</td>
          <td>${esc(r.erc8004_registry)}</td>
          <td>${verifierLinks(r.ainumbers_verifiers, r.ainumbers_chain, r.no_verifier_note, r.see_also)}</td>
          <td class="assert-yes">${esc(r.we_assert)}</td>
          <td class="assert-no">${esc(r.we_do_not_assert)}</td>
          <td>${citeBadges(r.cites)}</td>
        </tr>`;
}

function sourceListHtml(sources) {
  return Object.values(sources)
    .sort((a, b) => a.n - b.n)
    .map((s) => `<li><span class="src-num">[${s.n}]</span> ${esc(s.doc)}</li>`)
    .join('\n        ');
}

const FLOW_SVG = `<svg viewBox="0 0 940 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow: agent requests a purchase, app approves within a bounded grant, agent presents payment proof to merchant, merchant returns a receipt, our verification attaches at the receipt and settlement-classification step, and settlement finality plus offline-verifiable STARK receipts remain unproven in this flow.">
  <defs><marker id="fa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--border-2)"/></marker></defs>
  <g font-family="JetBrains Mono, monospace" font-size="10.5">
    <rect class="svg-box" x="8" y="30" width="140" height="60" rx="8"/>
    <text class="svg-title" x="78" y="65" font-size="11.5" text-anchor="middle" font-family="Sora,sans-serif">Agent</text>
    <path class="svg-arrow" d="M148 60 H196" marker-end="url(#fa)"/>
    <rect class="svg-box" x="200" y="30" width="150" height="60" rx="8"/>
    <text class="svg-title" x="275" y="58" font-size="11" text-anchor="middle" font-family="Sora,sans-serif">App approval</text>
    <text class="svg-mono-dim" x="275" y="74" font-size="8.5" text-anchor="middle">ApprovalGrant / DelegationGrant</text>
    <path class="svg-arrow" d="M350 60 H398" marker-end="url(#fa)"/>
    <rect class="svg-box" x="402" y="30" width="150" height="60" rx="8"/>
    <text class="svg-title" x="477" y="58" font-size="11" text-anchor="middle" font-family="Sora,sans-serif">Payment proof</text>
    <text class="svg-mono-dim" x="477" y="74" font-size="8.5" text-anchor="middle">PAYMENT-SIGNATURE / PaymentIntent</text>
    <path class="svg-arrow" d="M552 60 H600" marker-end="url(#fa)"/>
    <rect class="svg-box" x="604" y="30" width="130" height="60" rx="8"/>
    <text class="svg-title" x="669" y="65" font-size="11.5" text-anchor="middle" font-family="Sora,sans-serif">Merchant</text>
    <path class="svg-arrow" d="M734 60 H782" marker-end="url(#fa)"/>
    <rect class="svg-box-hi" x="786" y="20" width="146" height="80" rx="8"/>
    <text class="svg-title" x="859" y="48" font-size="11" text-anchor="middle" font-family="Sora,sans-serif">Receipt</text>
    <text class="svg-tag" x="859" y="64" font-size="9" text-anchor="middle">our verification</text>
    <text class="svg-tag" x="859" y="78" font-size="9" text-anchor="middle">attaches here</text>
    <text class="svg-mono-dim" x="859" y="92" font-size="8" text-anchor="middle">art-26 / art-513</text>
  </g>
  <path class="svg-arrow" d="M859 100 V150" marker-end="url(#fa)"/>
  <rect class="svg-box-hi" x="734" y="154" width="198" height="56" rx="8"/>
  <text class="svg-title" x="833" y="176" font-size="11" text-anchor="middle" font-family="Sora,sans-serif">Settlement classification</text>
  <text class="svg-mono-dim" x="833" y="192" font-size="8.5" text-anchor="middle">art-492 / art-03 / art-394</text>
  <path class="svg-arrow" d="M734 182 H570" marker-end="url(#fa)"/>
  <rect class="svg-box-bad" x="360" y="154" width="198" height="70" rx="8"/>
  <text class="svg-title" x="459" y="174" font-size="11" text-anchor="middle" font-family="Sora,sans-serif">Settlement finality</text>
  <text class="svg-mono-dim" x="459" y="190" font-size="8.5" text-anchor="middle">settlement_verified=false in the</text>
  <text class="svg-mono-dim" x="459" y="202" font-size="8.5" text-anchor="middle">cookbook; SettleResponse.transaction</text>
  <text class="svg-tag-bad" x="459" y="216" font-size="9" text-anchor="middle">not independently confirmed here</text>
  <path class="svg-arrow" d="M360 190 H208" marker-end="url(#fa)"/>
  <rect class="svg-box-bad" x="8" y="154" width="198" height="70" rx="8"/>
  <text class="svg-title" x="107" y="174" font-size="11" text-anchor="middle" font-family="Sora,sans-serif">Offline-verifiable receipt</text>
  <text class="svg-mono-dim" x="107" y="190" font-size="8.5" text-anchor="middle">STARK-receipts extension exists</text>
  <text class="svg-mono-dim" x="107" y="202" font-size="8.5" text-anchor="middle">to close this exact gap</text>
  <text class="svg-tag-bad" x="107" y="216" font-size="9" text-anchor="middle">not implemented in this estate</text>
  <text class="svg-mono-dim" x="8" y="248" font-size="9">Green = where an AINumbers node attaches. Red = named gaps, stated honestly rather than silently skipped.</text>
</svg>`;

function render(data) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<title>Agentic Payments Cookbook Map | AINumbers.co</title>
<meta name="description" content="A field-by-field map across the OpenAI×AWS AgentCore Payments cookbook, x402 v2, VPSF/STARK receipt drafts, ACP, AP2, ERC-8004, MPP, and the AINumbers node or chain that verifies each piece, with what we assert and what we do not.">
<meta name="robots" content="index, follow">
<meta name="author" content="Post Oak Labs">
<link rel="canonical" href="https://ainumbers.co/chaingraph/agentic-payments-map.html">

<meta property="og:type" content="website">
<meta property="og:title" content="Agentic Payments Cookbook Map | AINumbers.co">
<meta property="og:description" content="What maps to what across AgentCore Payments, x402 v2, VPSF/STARK, ACP, AP2, ERC-8004, MPP, and our verifiers.">
<meta property="og:url" content="https://ainumbers.co/chaingraph/agentic-payments-map.html">
<meta property="og:site_name" content="AINumbers.co">

<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23080E1A'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Sora,sans-serif' font-weight='600' font-size='13' fill='%2314B8A6'>AI</text></svg>">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": "https://ainumbers.co/#org", "name": "AINumbers.co", "url": "https://ainumbers.co" },
    {
      "@type": "CollectionPage",
      "@id": "https://ainumbers.co/chaingraph/agentic-payments-map.html",
      "name": "Agentic Payments Cookbook Map",
      "url": "https://ainumbers.co/chaingraph/agentic-payments-map.html",
      "isPartOf": { "@id": "https://ainumbers.co/#org" },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ainumbers.co" },
          { "@type": "ListItem", "position": 2, "name": "ChainGraph Hub", "item": "https://ainumbers.co/chaingraph/chaingraph-hub.html" },
          { "@type": "ListItem", "position": 3, "name": "Agentic Payments Cookbook Map", "item": "https://ainumbers.co/chaingraph/agentic-payments-map.html" }
        ]
      }
    }
  ]
}
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">

<style>
:root{
  --bg:#080E1A;--bg-2:#0D1627;--bg-3:#111E35;--bg-4:#162340;
  --border:#1E2F4A;--border-2:#263855;--muted:#3A5270;--body:#6888A8;
  --text:#A8C4DE;--bright:#D4E8F8;--white:#EEF6FD;
  --teal:#14B8A6;--teal-dim:rgba(20,184,166,.12);--teal-lt:#2DD4BF;
  --gold:#D4A847;--gold-dim:rgba(212,168,71,.12);
  --green:#22C55E;--green-dim:rgba(34,197,94,.12);
  --red:#EF4444;--red-dim:rgba(239,68,68,.12);
  --radius:6px;--radius-lg:10px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Sora',sans-serif;font-weight:300;font-size:15px;line-height:1.7;-webkit-font-smoothing:antialiased}
h1,h2{font-family:'DM Serif Display',serif;font-weight:400;line-height:1.2}
a{color:inherit;text-decoration:none}
code{font-family:'JetBrains Mono',monospace;font-size:.85em;color:var(--teal-lt)}
.container{max-width:1200px;margin:0 auto;padding:0 2rem}
.hero{padding:3.5rem 0 2.5rem;border-bottom:1px solid var(--border)}
.hero-eyebrow{display:flex;align-items:center;gap:.6rem;margin-bottom:1rem;font-family:'JetBrains Mono',monospace;font-size:.57rem;letter-spacing:.22em;text-transform:uppercase;color:var(--teal-lt)}
.hero-eyebrow::before{content:'';display:block;width:28px;height:1px;background:var(--teal)}
.hero h1{font-size:clamp(1.9rem,3.6vw,2.7rem);color:var(--white);max-width:820px;margin-bottom:.9rem}
.hero-desc{font-size:.93rem;color:var(--body);max-width:760px;line-height:1.85;margin-bottom:1rem}
.hero-desc a{color:var(--teal-lt);border-bottom:1px solid rgba(45,212,191,.3)}
.section{padding:2.75rem 0;border-bottom:1px solid var(--border)}
.section:last-of-type{border-bottom:none}
.sec-label{font-family:'JetBrains Mono',monospace;font-size:.52rem;letter-spacing:.22em;text-transform:uppercase;color:var(--teal);margin-bottom:.5rem}
.sec-heading{font-size:clamp(1.1rem,2vw,1.45rem);color:var(--white);margin-bottom:.5rem}
.sec-note{font-size:.85rem;color:var(--body);max-width:820px;line-height:1.8;margin-bottom:1.2rem}
.panel-svg-wrap{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.1rem 1.1rem .9rem;margin:0 0 1.2rem;overflow-x:auto}
.panel-svg-wrap svg{display:block;min-width:700px;width:100%;height:auto}
.svg-box{fill:var(--bg-3);stroke:var(--border-2)}
.svg-box-hi{fill:var(--teal-dim);stroke:var(--teal)}
.svg-box-bad{fill:var(--red-dim);stroke:var(--red)}
.svg-title{font-family:'Sora',sans-serif;font-weight:500;fill:var(--bright)}
.svg-mono-dim{font-family:'JetBrains Mono',monospace;fill:var(--body)}
.svg-tag{font-family:'JetBrains Mono',monospace;fill:var(--teal-lt)}
.svg-tag-bad{font-family:'JetBrains Mono',monospace;fill:var(--red)}
.svg-arrow{stroke:var(--border-2);stroke-width:1.5;fill:none}
.map-table-wrap{overflow-x:auto;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg)}
.map-table{width:100%;border-collapse:collapse;font-size:.76rem;min-width:1600px}
.map-table th{text-align:left;padding:.6rem .8rem;background:var(--bg-3);color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:.56rem;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid var(--border);white-space:nowrap;position:sticky;top:0}
.map-table td{padding:.65rem .8rem;border-bottom:1px solid var(--border);color:var(--text);vertical-align:top;line-height:1.6}
.map-table tr:last-child td{border-bottom:none}
.concept-cell{font-weight:500;color:var(--bright);min-width:160px}
.assert-yes{color:var(--green);min-width:220px}
.assert-no{color:var(--body);min-width:220px}
.cite-badge{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--teal-lt);background:var(--teal-dim);border:1px solid rgba(45,212,191,.3);border-radius:4px;padding:.05rem .35rem;margin-right:.15rem;cursor:help}
.no-cite{font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--muted);font-style:italic}
.gap-note{font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--red)}
.see-also-link{font-family:'JetBrains Mono',monospace;font-size:.65rem;color:var(--gold)}
.src-list{list-style:none;font-size:.8rem;color:var(--body);line-height:2}
.src-num{font-family:'JetBrains Mono',monospace;color:var(--teal-lt);margin-right:.4rem}
.scope-callout{background:var(--bg-2);border:1px solid rgba(212,168,71,.25);border-left:3px solid var(--gold);border-radius:var(--radius-lg);padding:1.2rem 1.4rem;font-size:.85rem;color:var(--body);line-height:1.85}
.scope-callout strong{color:var(--text)}
.data-link{font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--teal-lt)}
${CHROME_CSS}
</style>
</head>
<body>

${buildNav('Agentic Payments Cookbook Map')}

<main>
  <div class="hero">
    <div class="container">
      <div class="hero-eyebrow">ChainGraph &middot; agentic payments</div>
      <h1>What maps to what, across the agentic-payments stack</h1>
      <p class="hero-desc">The OpenAI&times;AWS AgentCore Payments cookbook, x402 v2, the VPSF/STARK receipt drafts, ACP, AP2, ERC-8004, and MPP each name a piece of the same problem: an agent spends money and someone needs to check it happened correctly. This page lines up their fields side by side with the AINumbers node or chain that verifies each piece, states what we actually assert, and states what we do not, as often as the reverse. Every claim below cites a pinned snapshot retrieved for this page; a cell with nothing to cite says so.</p>
    </div>
  </div>

  <div class="section">
    <div class="container">
      <div class="sec-label">Flow</div>
      <h2 class="sec-heading">Where our verification attaches, and what stays unproven</h2>
      <p class="sec-note">Agent to app approval to payment proof to merchant to receipt: our nodes attach at the receipt and settlement-classification steps. Settlement finality itself, and an offline-verifiable receipt in the STARK sense, are named gaps here rather than silent ones.</p>
      <div class="panel-svg-wrap">${FLOW_SVG}</div>
    </div>
  </div>

  <div class="section">
    <div class="container">
      <div class="sec-label">Mapping table</div>
      <h2 class="sec-heading">Field by field, protocol by protocol</h2>
      <p class="sec-note">Machine-readable twin at <a href="data/agentic-payments-map.json" class="data-link">chaingraph/data/agentic-payments-map.json</a>, generated by the same script from the same source table. Node and chain links are resolved from <code>chaingraph.json</code> at generation time, so a link here cannot dangle.</p>
      <div class="map-table-wrap">
        <table class="map-table">
          <thead>
            <tr>
              <th>Concept</th>
              <th>AgentCore cookbook</th>
              <th>x402 v2</th>
              <th>MPP</th>
              <th>VPSF claim/operator</th>
              <th>ACP object</th>
              <th>AP2 mandate type</th>
              <th>ERC-8004 registry</th>
              <th>AINumbers verifier</th>
              <th>We assert</th>
              <th>We do NOT assert</th>
              <th>Cites</th>
            </tr>
          </thead>
          <tbody>${data.rows.map(rowHtml).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="container">
      <div class="sec-label">Sources</div>
      <h2 class="sec-heading">Pinned snapshots cited above</h2>
      <ul class="src-list">
        ${sourceListHtml(data.sources)}
      </ul>
      <p class="sec-note" style="margin-top:.8rem">Full index with sha256, retrieval date, and section refs: <code>research/${esc(data.snapshot_index.split('/').pop())}</code> (workspace-root, not published).</p>
    </div>
  </div>

  <div class="section">
    <div class="container">
      <div class="sec-label">Scope</div>
      <p class="sec-note">This page maps field names from AgentCore, x402 v2, VPSF/STARK, ACP, AP2, ERC-8004, and MPP onto the nodes that already exist on this estate, asserting nothing about a mapped node beyond what that node's own description computes. It does not integrate with any of those systems directly. Where the retrieval pass found an open divergence between a node and its pinned spec (art-594, art-36), that divergence is stated in the table above.</p>
    </div>
  </div>
</main>

${buildFooter({ root: '../', cg: '' })}

</body>
</html>
`;
}

function main() {
  const data = buildData();
  const html = render(data);
  const jsonBody = JSON.stringify(data, null, 2) + '\n';

  if (CHECK) {
    let okJson = false, okHtml = false;
    try {
      const onDisk = JSON.parse(readFileSync(OUT_JSON, 'utf8'));
      const { generated_at: _a, ...rest1 } = onDisk;
      const { generated_at: _b, ...rest2 } = data;
      okJson = JSON.stringify(rest1) === JSON.stringify(rest2);
    } catch { /* missing -> stale */ }
    try {
      okHtml = readFileSync(OUT_HTML, 'utf8') === html;
    } catch { /* missing -> stale */ }
    if (!okJson || !okHtml) {
      console.error(`gen-agentic-payments-map --check: stale (json ${okJson ? 'OK' : 'STALE'}, html ${okHtml ? 'OK' : 'STALE'}), run \`node scripts/gen-agentic-payments-map.mjs\``);
      process.exit(1);
    }
    console.log(`gen-agentic-payments-map --check: OK, ${data.rows.length} rows.`);
    return;
  }

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  let priorJson = null;
  try { priorJson = JSON.parse(readFileSync(OUT_JSON, 'utf8')); } catch { /* missing -> write fresh */ }
  const substantive = (r) => { const { generated_at: _s, ...rest } = r; return JSON.stringify(rest); };
  if (!priorJson || substantive(priorJson) !== substantive(data)) {
    writeFileSync(OUT_JSON, jsonBody);
    console.log(`gen-agentic-payments-map: wrote ${OUT_JSON.replace(ROOT, '').replace(/\\/g, '/')}`);
  } else {
    console.log('gen-agentic-payments-map: JSON twin unchanged — left untouched.');
  }
  let priorHtml = null;
  try { priorHtml = readFileSync(OUT_HTML, 'utf8'); } catch { /* missing -> write fresh */ }
  if (priorHtml !== html) {
    writeFileSync(OUT_HTML, html);
    console.log(`gen-agentic-payments-map: wrote ${OUT_HTML.replace(ROOT, '').replace(/\\/g, '/')}`);
  } else {
    console.log('gen-agentic-payments-map: page unchanged — left untouched.');
  }
  console.log(`gen-agentic-payments-map: ${data.rows.length} rows mapped.`);
}

main();
