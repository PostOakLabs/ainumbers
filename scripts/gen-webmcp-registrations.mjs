#!/usr/bin/env node
/**
 * gen-webmcp-registrations.mjs — WEBMCP-GEN-FROM-MANIFEST-1
 *
 * Emits each tool page's inline WebMCP registration block FROM its manifest
 * (`manifests/*.manifest.json`, `mcp_tool_definition`), making the registration
 * a derived artifact: hand-copies drift (generator law), so the block is
 * generated, marker-delimited, and verified by `--check` in preflight.
 *
 * SWEEP GATE FIRST (the row's precondition): a registration generator must never
 * emit from an uncleared schema. The cleared set is NOT read from the sweep's
 * dated TSV — it is recomputed LIVE per candidate by importing the exported
 * sweepKernel/loadManifestIndex/loadMcpNameIndex of
 * scripts/check-schema-read-divergence.mjs (SCHEMA-READ-DIVERGENCE-SWEEP-1) and
 * requiring verdict CLEARED (reads == declared both directions). BENIGN-ALIAS is
 * NOT generable: its resolution is a schema widening, i.e. a manifest edit, which
 * is outside this generator's fence. Divergent tools are EXCLUDED with a
 * per-tool reason line in the generator output; the exclusion list shrinks as
 * fix rows land.
 *
 * Emitted pattern (the 2026-08 spec state; all dated observations):
 *   - `document.modelContext` preferred with `'modelContext' in navigator`
 *     fallback (getter moved to document, observed 2026-08-10, #1546 pattern);
 *     absent API registers nothing (page stays byte-identical without it);
 *   - ONE function per tool, ONE registration per page — namespace uniqueness
 *     is gated by scripts/check-webmcp-name-uniqueness.mjs (the check-tool-names
 *     gate family extended to WebMCP registrations);
 *   - name / description / inputSchema reused VERBATIM from the manifest's
 *     mcp_tool_definition (the generator computes nothing and restates no
 *     computed value; the emitted name equals the node's mcp_name, so page,
 *     manifest and worker agree on one name per tool);
 *   - required-input validation with actionable errors (the type contract comes
 *     from the manifest's own schema — restating it is derivation, not invention);
 *   - annotations: { readOnlyHint: true } — truthful-hint posture (#1616):
 *     our tools are deterministic local compute with no UGC, so
 *     untrustedContentHint is stated n/a per tool in the block comment rather
 *     than emitted as a field; exposedTo is OMITTED entirely (no cross-origin
 *     exposure — decided posture, 2026-09-01); the comment notes the
 *     never-trust-client rule and why it is moot for zero-server tools;
 *   - execute() is async, maps params onto the page's own form element ids,
 *     awaits the page's own no-arg wrapper (WEBMCP-GEN-RUNWRAPPER-1) and returns the
 *     page's result global (byte-for-byte delegate, shared experience: the
 *     human sees what the agent did); errors return structured text, never
 *     raw exceptions. Async is the canonical form so pages whose compute is
 *     genuinely asynchronous return the real result instead of null.
 *   - Everything inline/self-contained: no external script, no CDN — CONTRACT
 *     constraints bind generated output exactly like hand-authored pages.
 *
 * Guard rails (hard failures — the generator never guesses):
 *   G1 manifest shape: snake_case name, description >= 8 words, typed properties;
 *   G2 page mapping: every inputSchema property must match a form element id
 *      (`id="<prop>"`) on the page — a property with no element cannot be
 *      delegated and is refused;
 *   G3 the page declares `function <execution.function_name>` and sets a
 *      result global (_lastResult, else _lastArtifact);
 *   G3b the emitted call targets the page's OWN no-arg wrapper that assembles
 *      the params object and invokes the manifest fn — the wrapper name is READ
 *      from the page (fn itself when fn is zero-arg), never invented (the
 *      argumentless call to a `fn(pp)` compute is the measured art-635
 *      compute_failed defect);
 *   G4 OWNERSHIP: a page carrying a registerTool call outside this generator's
 *      markers is never touched (pilot pages and index.html are other rows');
 *   G5 the manifest's execution.entry must be the page being written;
 *   G6 SWEEP GATE: the tool's kernel must re-verify CLEARED live.
 *
 * Modes:
 *   node scripts/gen-webmcp-registrations.mjs                 (report only)
 *   node scripts/gen-webmcp-registrations.mjs --all --write   (regen tranche)
 *   node scripts/gen-webmcp-registrations.mjs --tool <id> --write
 *   node scripts/gen-webmcp-registrations.mjs --check         (CI/preflight)
 *   node scripts/gen-webmcp-registrations.mjs --selftest
 *
 * Exit: 0 clean; 1 on any --check drift or hard-guard failure.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { loadManifestIndex, loadMcpNameIndex, sweepKernel } from './check-schema-read-divergence.mjs';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

export const BEGIN = '<!-- WEBMCP:GEN-BEGIN ';
// A full HTML comment: a bare `-- WEBMCP:GEN-END -->` line is not a comment to
// the copy-hallmarks prose stripper, and its `--` bytes read as em-dash
// substitutes in reader-facing text (measured: 16-page preflight red).
export const END = '<!-- WEBMCP:GEN-END -->';

function beginLine(manifestPath) {
  return `<!-- WEBMCP:GEN-BEGIN manifest=${manifestPath} generator=scripts/gen-webmcp-registrations.mjs -->`;
}

// ── Per-tool manifest-property → element-id map (WEBMCP-GEN-IDMAP-1) ──────────
/**
 * Authored per-entry by WEBMCP-GEN-IDMAP-1 under Tim's 2026-09-04 ruling.
 * ⛔ NOT a snake↔camel heuristic — a transform can silently bind a wrong
 * control. Every entry below was authored against the page's real control by
 * reading the page's own param-assembly code; the comment cites that read path
 * (file:line) as the justification. Consulted ONLY when the literal id guard
 * (G2, `id="<prop>"`) fails; unmapped properties still require the literal id.
 * `via` is how the emitted execute() writes the value:
 *   'string'     .value = String(params.p)          (default for string/number/unknown)
 *   'json'       .value = JSON.stringify(params.p)  (JSON-text textarea/select controls)
 *   'checked'    .checked = params.p === true       (real checkbox)
 *   'boolstring' .value = String(params.p === true) (select whose values are "true"/"false")
 * A property with no faithful control on its page gets NO entry and the tool
 * stays excluded — honest exclusion, never a guess.
 */
export const propertyIdMap = {
  // art-12 runCheck reads exactly these two controls:
  //   chaingraph/art-12-acp-checkout-conformance-validator.html:645-646
  'art-12-acp-checkout-conformance-validator': {
    payload: { element_id: 'payloadInput', via: 'json' },
    message_type_override: { element_id: 'msgType', via: 'string' },
  },
  // art-32 validateChain reads cardInput/chainInput/spendInput textareas:
  //   chaingraph/art-32-a2a-agent-card-trust-chain-validator.html:644,651,663
  'art-32-a2a-agent-card-trust-chain-validator': {
    agent_card: { element_id: 'cardInput', via: 'json' },
    delegation_chain: { element_id: 'chainInput', via: 'json' },
    spend_policy: { element_id: 'spendInput', via: 'json' },
  },
  // art-133 pp assembly reads dir/sig_ok as 'true'/'false' selects:
  //   chaingraph/art-133-agent-payment-rail-trust-crosswalk.html:309
  'art-133-agent-payment-rail-trust-crosswalk': {
    directory_published: { element_id: 'dir', via: 'boolstring' },
    signature_verified: { element_id: 'sig_ok', via: 'boolstring' },
  },
  // art-134 reads all five via b(id)=…value==='true' (loadPreset names the ids):
  //   chaingraph/art-134-agent-directory-publish-readiness.html:298,331
  'art-134-agent-directory-publish-readiness': {
    well_known_path_ok: { element_id: 'wkpath', via: 'boolstring' },
    jwks_reachable: { element_id: 'reachable', via: 'boolstring' },
    card_complete: { element_id: 'card', via: 'boolstring' },
    rotation_posture_ok: { element_id: 'rotation', via: 'boolstring' },
    alg_ed25519: { element_id: 'alg_ed', via: 'boolstring' },
  },
  // art-560 pp assembly: pair/subs/thr/stale/prev (mode and epoch match literally):
  //   chaingraph/art-560-oracle-price-aggregation.html:622-632
  'art-560-oracle-price-aggregation': {
    currency_pair: { element_id: 'pair', via: 'string' },
    submissions: { element_id: 'subs', via: 'json' },
    outlier_threshold_pct: { element_id: 'thr', via: 'string' },
    stale_after_seconds: { element_id: 'stale', via: 'string' },
    prev_print_hash: { element_id: 'prev', via: 'string' },
  },
  // art-590 pp assembly reads every EIP-712 domain/auth field:
  //   chaingraph/art-590-x402-eip712-digest-recomputer.html:1497-1506
  'art-590-x402-eip712-digest-recomputer': {
    name: { element_id: 'domName', via: 'string' },
    version: { element_id: 'domVersion', via: 'string' },
    chainId: { element_id: 'domChainId', via: 'string' },
    verifyingContract: { element_id: 'domVerifyingContract', via: 'string' },
    from: { element_id: 'authFrom', via: 'string' },
    to: { element_id: 'authTo', via: 'string' },
    value: { element_id: 'authValue', via: 'string' },
    validAfter: { element_id: 'authValidAfter', via: 'string' },
    validBefore: { element_id: 'authValidBefore', via: 'string' },
    nonce: { element_id: 'authNonce', via: 'string' },
  },
  // art-591 pp assembly (recovery inputs):
  //   chaingraph/art-591-x402-signer-recovery-verifier.html:5901-5908
  'art-591-x402-signer-recovery-verifier': {
    digest: { element_id: 'inDigest', via: 'string' },
    signature: { element_id: 'inSignature', via: 'string' },
    r: { element_id: 'inR', via: 'string' },
    s: { element_id: 'inS', via: 'string' },
    v: { element_id: 'inV', via: 'string' },
    yParity: { element_id: 'inYParity', via: 'string' },
    chainId: { element_id: 'inChainId', via: 'string' },
    claimedFrom: { element_id: 'inClaimedFrom', via: 'string' },
  },
  // art-592 pp assembly; nonce_already_used is a ''/'true'/'false' select read
  // as usedSel==='true': chaingraph/art-592-x402-domain-nonce-window-checker.html:453-462
  'art-592-x402-domain-nonce-window-checker': {
    expected_chain_id: { element_id: 'expChainId', via: 'string' },
    expected_verifying_contract: { element_id: 'expVerifyingContract', via: 'string' },
    chainId: { element_id: 'sigChainId', via: 'string' },
    verifyingContract: { element_id: 'sigVerifyingContract', via: 'string' },
    now_unix: { element_id: 'nowUnix', via: 'string' },
    nonce_already_used: { element_id: 'nonceAlreadyUsed', via: 'boolstring' },
  },
  // art-595 pp assembly (cart hash-chain inputs):
  //   chaingraph/art-595-ap2-cartmandate-hashchain-builder.html:756-767
  'art-595-ap2-cartmandate-hashchain-builder': {
    agent_id: { element_id: 'agentId', via: 'string' },
    cart_items: { element_id: 'cartItems', via: 'json' },
    claimed_links: { element_id: 'claimedLinks', via: 'json' },
  },
  // art-596 pp assembly (cartRoot/cartItems/x402Evidence; merchant matches literally):
  //   chaingraph/art-596-ap2-x402-cart-correlation.html:814-819
  'art-596-ap2-x402-cart-correlation': {
    cart_root: { element_id: 'cartRoot', via: 'string' },
    cart_items: { element_id: 'cartItems', via: 'json' },
    x402_spend_evidence: { element_id: 'x402Evidence', via: 'json' },
  },
  // art-605 pp assembly (encoding select, pair_sort checkbox, claimed path JSON):
  //   chaingraph/art-605-merkle-airdrop-proof-verifier.html:864-876
  'art-605-merkle-airdrop-proof-verifier': {
    encoding_variant: { element_id: 'encodingVariant', via: 'string' },
    pair_sort: { element_id: 'pairSort', via: 'checked' },
    claimed_root: { element_id: 'claimedRoot', via: 'string' },
    claimed_path: { element_id: 'claimedPath', via: 'json' },
  },
  // art-610 pp assembly (vault-share math inputs, incl. snapshot_b JSON):
  //   chaingraph/art-610-erc4626-vault-share-math.html:680-699
  'art-610-erc4626-vault-share-math': {
    total_assets: { element_id: 'totalAssets', via: 'string' },
    total_supply: { element_id: 'totalSupply', via: 'string' },
    virtual_amounts: { element_id: 'virtualAmounts', via: 'checked' },
    decimals_offset: { element_id: 'decimalsOffset', via: 'string' },
    round_trip_assets: { element_id: 'roundTripAssets', via: 'string' },
    snapshot_b: { element_id: 'snapshotB', via: 'json' },
    fee_bps: { element_id: 'feeBps', via: 'string' },
    fee_basis: { element_id: 'feeBasis', via: 'string' },
    chain_id: { element_id: 'chainId', via: 'string' },
    network_label: { element_id: 'networkLabel', via: 'string' },
  },
  // art-613 pp assembly (_val/_optVal name every control explicitly):
  //   chaingraph/art-613-erc4337-userop-math.html:1753-1771
  'art-613-erc4337-userop-math': {
    entryPointVersion: { element_id: 'epVersion', via: 'string' },
    entryPoint: { element_id: 'epAddress', via: 'string' },
    chainId: { element_id: 'opChainId', via: 'string' },
    sender: { element_id: 'opSender', via: 'string' },
    nonce: { element_id: 'opNonce', via: 'string' },
    initCode: { element_id: 'opInitCode', via: 'string' },
    callData: { element_id: 'opCallData', via: 'string' },
    paymasterAndData: { element_id: 'opPaymasterAndData', via: 'string' },
    callGasLimit: { element_id: 'opCallGasLimit', via: 'string' },
    verificationGasLimit: { element_id: 'opVerificationGasLimit', via: 'string' },
    preVerificationGas: { element_id: 'opPreVerificationGas', via: 'string' },
    maxFeePerGas: { element_id: 'opMaxFeePerGas', via: 'string' },
    maxPriorityFeePerGas: { element_id: 'opMaxPriorityFeePerGas', via: 'string' },
    declaredBaseFeePerGas: { element_id: 'opDeclaredBaseFee', via: 'string' },
    declaredActualGasUsed: { element_id: 'recGasUsed', via: 'string' },
    declaredActualGasCostWei: { element_id: 'recGasCost', via: 'string' },
    declaredL1DataFeeWei: { element_id: 'recL1Fee', via: 'string' },
    reconciliationToleranceWei: { element_id: 'recTolerance', via: 'string' },
  },
  // art-614 pp assembly (authorization tuple inputs):
  //   chaingraph/art-614-eip7702-authorization-tuple-decoder.html:5942-5949
  'art-614-eip7702-authorization-tuple-decoder': {
    chainId: { element_id: 'inChainId', via: 'string' },
    address: { element_id: 'inAddress', via: 'string' },
    nonce: { element_id: 'inNonce', via: 'string' },
    signature: { element_id: 'inSignature', via: 'string' },
    r: { element_id: 'inR', via: 'string' },
    s: { element_id: 'inS', via: 'string' },
    v: { element_id: 'inV', via: 'string' },
    yParity: { element_id: 'inYParity', via: 'string' },
  },
  // art-615 pp assembly (charge type select + two checkboxes):
  //   chaingraph/art-615-mla-charge-inclusion-classifier.html:304-306
  'art-615-mla-charge-inclusion-classifier': {
    charge_type: { element_id: 'chargeType', via: 'string' },
    is_credit_card_account: { element_id: 'isCreditCard', via: 'checked' },
    short_term_exception_claimed: { element_id: 'shortTerm', via: 'checked' },
  },
  // art-634 pp assembly (four checkboxes + spec item select/input):
  //   chaingraph/art-634-codm-expense-significance-classifier.html:248-252
  'art-634-codm-expense-significance-classifier': {
    included_in_segment_profit_measure: { element_id: 'included', via: 'checked' },
    regularly_provided_to_codm: { element_id: 'regularly', via: 'checked' },
    easily_computable_from_codm_information: { element_id: 'easily', via: 'checked' },
    assessed_significant: { element_id: 'significant', via: 'checked' },
    specified_item_50_22: { element_id: 'specItem', via: 'string' },
  },
  // art-635 pp assembly (two selects, two numbers, one checkbox):
  //   chaingraph/art-635-rate-rec-5pct-threshold-classifier.html:266-270
  'art-635-rate-rec-5pct-threshold-classifier': {
    reconciling_item_category: { element_id: 'category', via: 'string' },
    reconciling_item_amount: { element_id: 'amount', via: 'string' },
    pretax_income: { element_id: 'pretax', via: 'string' },
    statutory_rate_pct: { element_id: 'rate', via: 'string' },
    entity_is_public_business_entity: { element_id: 'isPbe', via: 'checked' },
  },

  // ── WEBMCP-IDMAP-BATCH-1 (first 25 RENAME-ONLY pages from
  // research/WEBMCP-TRIAGE-2026-09.json, PR #1729). Every control below was
  // re-verified against the page at base e83a3992: the id exists and the
  // page's own compute reads it (cited file:line). art-173 was DROPPED from
  // this batch: its only inputSchema property `system` is a composite spread
  // across six checkboxes (getParams, art-173:561-568) with no single
  // faithful control — honest exclusion, not a guess.

  // getParams reads geo_type select:
  //   chaingraph/art-166-eudr-geolocation-plot-validator.html:390
  'art-166-eudr-geolocation-plot-validator': {
    geo: { element_id: 'geo_type', via: 'string' },
  },
  // getParams reads entity_type select:
  //   chaingraph/art-167-eudr-commodity-scope-classifier.html:395
  'art-167-eudr-commodity-scope-classifier': {
    entity: { element_id: 'entity_type', via: 'string' },
  },
  // getParams reads is_gpai_provider checkbox (the schema's provider flag):
  //   chaingraph/art-175-gpai-code-of-practice-conformance.html:489
  'art-175-gpai-code-of-practice-conformance': {
    provider: { element_id: 'is_gpai_provider', via: 'checked' },
  },
  // loadParams assigns content/creator/title inputs verbatim:
  //   chaingraph/art-201-iscc-content-code-generator.html:571-579
  'art-201-iscc-content-code-generator': {
    content: { element_id: 'contentIn', via: 'string' },
    creator: { element_id: 'creatorIn', via: 'string' },
    title: { element_id: 'titleIn', via: 'string' },
  },
  // pp assembly names every camelCase control explicitly:
  //   chaingraph/art-221-llpa-stack.html:447-455
  'art-221-llpa-stack': {
    ami_pct: { element_id: 'amiPct', via: 'string' },
    fico_score: { element_id: 'ficoScore', via: 'string' },
    first_time_buyer: { element_id: 'firstTimeBuyer', via: 'checked' },
    loan_purpose: { element_id: 'loanPurpose', via: 'string' },
    ltv_pct: { element_id: 'ltvPct', via: 'string' },
    occupancy_type: { element_id: 'occupancyType', via: 'string' },
    property_type: { element_id: 'propertyType', via: 'string' },
    subordinate_financing: { element_id: 'subordinateFinancing', via: 'checked' },
  },
  // pp assembly names every camelCase control explicitly:
  //   chaingraph/art-225-va-funding-fee-residual.html:524-533
  'art-225-va-funding-fee-residual': {
    base_loan_amount: { element_id: 'baseLoanAmount', via: 'string' },
    down_payment_pct: { element_id: 'downPaymentPct', via: 'string' },
    dti_pct: { element_id: 'dtiPct', via: 'string' },
    family_size: { element_id: 'familySize', via: 'string' },
    funding_fee_exempt: { element_id: 'fundingFeeExempt', via: 'checked' },
    gross_monthly_income: { element_id: 'grossMonthlyIncome', via: 'string' },
    loan_purpose: { element_id: 'loanPurpose', via: 'string' },
    monthly_shelter_expenses: { element_id: 'monthlyShelterExpenses', via: 'string' },
    state: { element_id: 'stateCode', via: 'string' },
    va_use_type: { element_id: 'vaUseType', via: 'string' },
  },
  // raw = loanDataJson.value parsed as JSON text:
  //   chaingraph/art-226-mismo-uldd-ulad.html:542
  'art-226-mismo-uldd-ulad': {
    loan_data: { element_id: 'loanDataJson', via: 'json' },
  },
  // pp assembly names every group_* control explicitly:
  //   chaingraph/art-229-compute-disparity-metrics.html:420-425
  'art-229-compute-disparity-metrics': {
    group_a_approvals: { element_id: 'groupAApprovals', via: 'string' },
    group_a_label: { element_id: 'groupALabel', via: 'string' },
    group_a_total: { element_id: 'groupATotal', via: 'string' },
    group_b_approvals: { element_id: 'groupBApprovals', via: 'string' },
    group_b_label: { element_id: 'groupBLabel', via: 'string' },
    group_b_total: { element_id: 'groupBTotal', via: 'string' },
  },
  // pp assembly names every control explicitly:
  //   chaingraph/art-230-compute-hmda-rate-spread.html:389-393
  'art-230-compute-hmda-rate-spread': {
    apor_pct: { element_id: 'aporPct', via: 'string' },
    apr_pct: { element_id: 'aprPct', via: 'string' },
    lien_type: { element_id: 'lienType', via: 'string' },
    lock_date: { element_id: 'lockDate', via: 'string' },
    product_type: { element_id: 'productType', via: 'string' },
  },
  // pp assembly; two booleans are "true"/"false" selects:
  //   chaingraph/art-232-compute-scra-rate-cap.html:387-391
  'art-232-compute-scra-rate-cap': {
    covered_months: { element_id: 'coveredMonths', via: 'string' },
    is_pre_service_obligation: { element_id: 'isPreServiceObligation', via: 'boolstring' },
    loan_balance: { element_id: 'loanBalance', via: 'string' },
    original_rate_pct: { element_id: 'originalRatePct', via: 'string' },
    servicemember_notified: { element_id: 'servicememberNotified', via: 'boolstring' },
  },
  // pp assembly names every party control explicitly:
  //   chaingraph/art-242-pacs008-party-completeness-validator.html:349-365
  'art-242-pacs008-party-completeness-validator': {
    creditor_agent_bic: { element_id: 'creditorAgentBic', via: 'string' },
    creditor_lei: { element_id: 'creditorLei', via: 'string' },
    creditor_name: { element_id: 'creditorName', via: 'string' },
    debtor_agent_bic: { element_id: 'debtorAgentBic', via: 'string' },
    debtor_lei: { element_id: 'debtorLei', via: 'string' },
    debtor_name: { element_id: 'debtorName', via: 'string' },
    purpose_code: { element_id: 'purposeCode', via: 'string' },
  },
  // pp assembly names every control explicitly:
  //   chaingraph/art-244-gpi-tracker-lifecycle-simulator.html:363-372
  'art-244-gpi-tracker-lifecycle-simulator': {
    amount_usd: { element_id: 'amountUsd', via: 'string' },
    current_status: { element_id: 'currentStatus', via: 'string' },
    hours_elapsed: { element_id: 'hoursElapsed', via: 'string' },
    next_status: { element_id: 'nextStatus', via: 'string' },
  },
  // pp assembly names every control explicitly:
  //   chaingraph/art-249-compare-corridor-cost.html:371-377
  'art-249-compare-corridor-cost': {
    from_country: { element_id: 'fromCountry', via: 'string' },
    fx_rate_mid: { element_id: 'fxRateMid', via: 'string' },
    fx_rate_used: { element_id: 'fxRateUsed', via: 'string' },
    provider_fee: { element_id: 'providerFee', via: 'string' },
    send_amount: { element_id: 'sendAmount', via: 'string' },
    service_name: { element_id: 'serviceName', via: 'string' },
    to_country: { element_id: 'toCountry', via: 'string' },
  },
  // record = JSON.parse(recordJson.value):
  //   chaingraph/art-256-validate-openids-homeowners-record.html:381
  'art-256-validate-openids-homeowners-record': {
    record: { element_id: 'recordJson', via: 'json' },
  },
  // one line reads openingBalance/dayCountConvention/closingBalance:
  //   chaingraph/art-258-parse-camt053-reconciliation.html:356
  'art-258-parse-camt053-reconciliation': {
    closing_balance: { element_id: 'closingBalance', via: 'string' },
    day_count_convention: { element_id: 'dayCountConvention', via: 'string' },
    opening_balance: { element_id: 'openingBalance', via: 'string' },
  },
  // pp assembly reads the three controls directly:
  //   chaingraph/art-267-check-producer-license-reciprocity.html:327-329
  'art-267-check-producer-license-reciprocity': {
    loa_codes: { element_id: 'loaCodes', via: 'string' },
    resident_state: { element_id: 'residentState', via: 'string' },
    target_states: { element_id: 'targetStates', via: 'string' },
  },
  // JSON.parse on both JSON textareas + entity id:
  //   chaingraph/art-268-compute-cdd-ownership-25pct.html:363-365
  'art-268-compute-cdd-ownership-25pct': {
    natural_persons: { element_id: 'naturalPersons', via: 'json' },
    ownership_tiers: { element_id: 'ownershipTiers', via: 'json' },
    target_entity_id: { element_id: 'targetEntityId', via: 'string' },
  },
  // mandateHash read into pp.mandate_hash:
  //   chaingraph/art-274-compile-work-mandate.html:341
  'art-274-compile-work-mandate': {
    mandate: { element_id: 'mandateHash', via: 'string' },
  },
  // f_* controls read verbatim in the composer payload:
  //   chaingraph/art-276-mutual-nda-composer.html:388-403
  'art-276-mutual-nda-composer': {
    confidentiality_term_mode: { element_id: 'f_confidentiality_term_mode', via: 'string' },
    confidentiality_term_years: { element_id: 'f_confidentiality_term_years', via: 'string' },
    effective_date: { element_id: 'f_effective_date', via: 'string' },
    governing_law: { element_id: 'f_governing_law', via: 'string' },
    jurisdiction: { element_id: 'f_jurisdiction', via: 'string' },
    mnda_term_mode: { element_id: 'f_mnda_term_mode', via: 'string' },
    mnda_term_years: { element_id: 'f_mnda_term_years', via: 'string' },
    modifications: { element_id: 'f_modifications', via: 'string' },
    purpose: { element_id: 'f_purpose', via: 'string' },
  },
  // f_* controls read verbatim in the binder payload:
  //   chaingraph/art-277-agreement-acceptance-binder.html:341-346
  'art-277-agreement-acceptance-binder': {
    acceptance_statement: { element_id: 'f_acceptance_statement', via: 'string' },
    accepting_party_role: { element_id: 'f_accepting_party_role', via: 'string' },
    body_sha256: { element_id: 'f_body_sha256', via: 'string' },
    previous_proof_hash: { element_id: 'f_previous_proof_hash', via: 'string' },
    referenced_execution_hash: { element_id: 'f_referenced_execution_hash', via: 'string' },
    template_id: { element_id: 'f_template_id', via: 'string' },
  },
  // pp assembly names every control explicitly:
  //   chaingraph/art-318-rhc-regime-mapper.html:384-389
  'art-318-rhc-regime-mapper': {
    holder_of_record: { element_id: 'holderOfRecord', via: 'string' },
    instrument_type: { element_id: 'instrumentType', via: 'string' },
    issuer_entity: { element_id: 'issuerEntity', via: 'string' },
    target_jurisdictions: { element_id: 'targetJurisdictions', via: 'string' },
    voting_rights: { element_id: 'votingRights', via: 'checked' },
  },
  // solveFor select + ratePct:
  //   chaingraph/art-327-tvm-annuity.html:341,392
  'art-327-tvm-annuity': {
    rate_pct: { element_id: 'ratePct', via: 'string' },
    solve_for: { element_id: 'solveFor', via: 'string' },
  },
  // pp assembly names every TVM control explicitly:
  //   chaingraph/art-330-tvm-dv01.html:329-331,396-401
  'art-330-tvm-dv01': {
    basis_points: { element_id: 'basisPoints', via: 'string' },
    coupon_rate_pct: { element_id: 'couponRatePct', via: 'string' },
    face_value: { element_id: 'faceValue', via: 'string' },
    periods_per_year: { element_id: 'periodsPerYear', via: 'string' },
    years_to_maturity: { element_id: 'yearsToMaturity', via: 'string' },
    ytm_pct: { element_id: 'ytmPct', via: 'string' },
  },
  // pp assembly names every TVM control explicitly:
  //   chaingraph/art-331-tvm-convexity.html:329-331,396-400
  'art-331-tvm-convexity': {
    coupon_rate_pct: { element_id: 'couponRatePct', via: 'string' },
    face_value: { element_id: 'faceValue', via: 'string' },
    periods_per_year: { element_id: 'periodsPerYear', via: 'string' },
    years_to_maturity: { element_id: 'yearsToMaturity', via: 'string' },
    yield_shock_bp: { element_id: 'yieldShockBp', via: 'string' },
    ytm_pct: { element_id: 'ytmPct', via: 'string' },
  },
};

// ── Guard helpers ─────────────────────────────────────────────────────────────

function fail(msg) {
  console.error('GEN-ERROR: ' + msg);
  process.exit(1);
}

function loadManifestFor(toolId, manifestIndex, mcpNameByTool, repoRoot) {
  const root = repoRoot || REPO;
  const rec = manifestIndex.byTool.get(toolId)
    || (mcpNameByTool.get(toolId) ? manifestIndex.byMcp.get(mcpNameByTool.get(toolId)) : null)
    || null;
  if (!rec) return { error: `no manifests/*.manifest.json record pairs with tool_id '${toolId}' (generator emits only from manifest records)` };
  let m;
  try { m = JSON.parse(readFileSync(resolve(root, rec.file), 'utf8')); } catch (e) {
    return { error: `manifest ${rec.file} is not valid JSON: ${e.message}` };
  }
  return { file: rec.file, m };
}

// Root indirection so the selftest can run the same code against a fixture tree.
function readRepoFile(rel, repoRoot) {
  return readFileSync(resolve(repoRoot || REPO, rel), 'utf8');
}

/** G1: manifest shape. Returns an error string or null. */
export function checkManifestShape(m) {
  const def = m?.mcp_tool_definition;
  if (!def || typeof def.name !== 'string') return 'missing mcp_tool_definition.name';
  if (!/^[a-z][a-z0-9_]*$/.test(def.name)) return `mcp_tool_definition.name '${def.name}' is not snake_case`;
  const words = (def.description || '').trim().split(/\s+/).filter(Boolean).length;
  if (words < 8) return `mcp_tool_definition.description has ${words} words, need >= 8`;
  const props = def.inputSchema && def.inputSchema.properties ? def.inputSchema.properties : null;
  if (!props || typeof props !== 'object') return 'mcp_tool_definition.inputSchema.properties missing';
  for (const [k, v] of Object.entries(props)) {
    if (!v || typeof v.type !== 'string') return `inputSchema property '${k}' has no type`;
  }
  if (!m.execution || typeof m.execution.function_name !== 'string' || !m.execution.function_name) {
    return 'missing execution.function_name';
  }
  return null;
}

/** G1b: the manifest's two schema writers must agree — the sweep clears
 *  `input_schema`, emission uses `mcp_tool_definition.inputSchema`; emitting a
 *  schema the sweep did not clear is forbidden. Returns error string or null. */
export function checkManifestSchemaParity(m) {
  const a = m?.input_schema?.properties;
  const b = m?.mcp_tool_definition?.inputSchema?.properties;
  if (!a || !b) return 'manifest lacks input_schema or mcp_tool_definition.inputSchema — the sweep clears the former, emission needs the latter';
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.join(',') !== keysB.join(',')) {
    return `schema writers disagree on property sets: input_schema=[${keysA.join(',')}] vs mcp_tool_definition.inputSchema=[${keysB.join(',')}] — align them before emission`;
  }
  const reqA = (m.input_schema.required || []).slice().sort().join(',');
  const reqB = (m.mcp_tool_definition.inputSchema.required || []).slice().sort().join(',');
  if (reqA !== reqB) return `schema writers disagree on required: [${reqA}] vs [${reqB}]`;
  for (const k of keysA) {
    if (a[k].type !== b[k].type) return `schema writers disagree on type of '${k}': ${a[k].type} vs ${b[k].type}`;
  }
  return null;
}

/**
 * G3b (WEBMCP-GEN-RUNWRAPPER-1): resolve the page's own no-arg wrapper for the
 * manifest-declared execution fn — the callable that assembles the params
 * object from the form and invokes `fn(pp)`. The name is READ from the page,
 * never invented: fn itself when fn is declared zero-arg; otherwise the unique
 * zero-arg function declaration whose body calls `fn(`. Returns null when no
 * unique wrapper exists (the generator then refuses — it never guesses).
 */
export function findWrapperName(pageSrc, fn) {
  if (new RegExp(`(?:async\\s+)?function\\s+${fn}\\s*\\(\\s*\\)\\s*\\{`).test(pageSrc)) return fn;
  const callRe = new RegExp(`(?:^|[^\\w$.])${fn}\\s*\\(`);
  const declRe = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(\s*\)\s*\{/g;
  const names = new Set();
  let m;
  while ((m = declRe.exec(pageSrc)) !== null) {
    let depth = 1;
    let j = m.index + m[0].length; // m[0] ends with the opening '{'
    while (j < pageSrc.length && depth > 0) {
      const c = pageSrc[j];
      if (c === '{') depth++; else if (c === '}') depth--;
      j++;
    }
    if (depth !== 0) continue;
    if (callRe.test(pageSrc.slice(m.index, j))) names.add(m[1]);
  }
  return names.size === 1 ? [...names][0] : null;
}

/** G2/G3/G3b/G4: element-id mapping, compute function, wrapper, result global, ownership.
 *  `idMap` (optional) is the tool's propertyIdMap entry: mapped properties are
 *  checked against their authored element_id (the mapping cannot go stale
 *  silently — a mapped id absent from the page is a hard refusal). */
export function verifyPageMapping(manifest, pageSrc, pageLabel, idMap) {
  const def = manifest.mcp_tool_definition;
  const props = Object.keys(def.inputSchema.properties);
  const map = idMap || {};
  const missing = props.filter((p) => {
    const target = map[p] ? map[p].element_id : p;
    return !new RegExp(`id=["']${target}["']`).test(pageSrc);
  });
  if (missing.length > 0) {
    return { error: `${pageLabel}: form-element mapping incomplete, inputSchema properties with no matching element id: ${missing.map((p) => (map[p] ? `${p} -> #${map[p].element_id} (mapped)` : p)).join(', ')}` };
  }
  const fn = manifest.execution.function_name;
  if (!new RegExp(`function\\s+${fn}\\s*\\(`).test(pageSrc)) {
    return { error: `${pageLabel}: no 'function ${fn}(' found — execution.function_name does not exist on the page` };
  }
  // G3b: the emitted call must target the page's own form-assembling wrapper.
  // A bare argumentless call to a `fn(pp)` compute is the measured compute_failed
  // defect (halt-3, art-635) — a page with no detectable wrapper is refused.
  const wrapper = findWrapperName(pageSrc, fn);
  if (!wrapper) {
    return { error: `${pageLabel}: no zero-arg wrapper invoking ${fn} found — the emitted call must target the page's own form-assembling wrapper, and none is detectable` };
  }
  // G4: registerTool outside this generator's own marked region is another row's.
  const withoutOwn = stripMarkedRegions(pageSrc);
  if (/\.registerTool\s*\(/.test(withoutOwn)) {
    return { error: `${pageLabel}: already contains a registerTool call outside this generator's markers — owned by another row, never rewritten` };
  }
  if (/_lastResult\s*=/.test(pageSrc)) return { resGlobal: '_lastResult', wrapper };
  if (/_lastArtifact\s*=/.test(pageSrc)) return { resGlobal: '_lastArtifact', wrapper };
  return { error: `${pageLabel}: page sets no _lastResult/_lastArtifact global — the delegate return cannot be verified` };
}

function stripMarkedRegions(src) {
  let out = src;
  let b;
  while ((b = out.indexOf(BEGIN)) !== -1) {
    const e = out.indexOf(END, b);
    if (e === -1) break;
    out = out.slice(0, b) + out.slice(e + END.length);
  }
  return out;
}

// ── Emission ──────────────────────────────────────────────────────────────────

function jsStr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function validationLine(prop, type) {
  const r = `JSON.stringify(params.${prop})`;
  switch (type) {
    case 'number': return `if (typeof params.${prop} !== 'number' || !Number.isFinite(params.${prop})) throw new Error('${jsStr(prop)} must be a finite number; received ' + ${r} + '.');`;
    case 'boolean': return `if (typeof params.${prop} !== 'boolean') throw new Error('${jsStr(prop)} must be a boolean; received ' + ${r} + '.');`;
    case 'string': return `if (typeof params.${prop} !== 'string') throw new Error('${jsStr(prop)} must be a string; received ' + ${r} + '.');`;
    case 'array': return `if (!Array.isArray(params.${prop})) throw new Error('${jsStr(prop)} must be an array; received ' + ${r} + '.');`;
    default: return `if (params.${prop} === null || typeof params.${prop} !== 'object' || Array.isArray(params.${prop})) throw new Error('${jsStr(prop)} must be a JSON object; received ' + ${r} + '.');`;
  }
}

function mappingLine(prop, type, optional, entry) {
  const via = entry ? entry.via : null;
  const id = entry ? entry.element_id : prop;
  let expr;
  if (via === 'checked' || (!via && type === 'boolean')) expr = `document.getElementById('${jsStr(id)}').checked = params.${prop} === true;`;
  else if (via === 'boolstring') expr = `document.getElementById('${jsStr(id)}').value = String(params.${prop} === true);`;
  else if (via === 'json' || type === 'array' || type === 'object') expr = `document.getElementById('${jsStr(id)}').value = JSON.stringify(params.${prop});`;
  else expr = `document.getElementById('${jsStr(id)}').value = String(params.${prop});`;
  return optional ? `if (params.${prop} !== undefined) ${expr}` : expr;
}

/**
 * Builds the marker-delimited block for one tool page. Pure: same inputs, same
 * bytes (RESULT_GLOBAL is substituted by buildBlockForPage).
 */
export function buildBlock(manifest, manifestPath, idMap, wrapper) {
  const def = manifest.mcp_tool_definition;
  const props = Object.entries(def.inputSchema.properties);
  const required = Array.isArray(def.inputSchema.required) ? def.inputSchema.required : [];
  const target = wrapper || manifest.execution.function_name;
  const map = idMap || {};
  const lines = [];
  lines.push(beginLine(manifestPath));
  lines.push('<script>');
  lines.push('// WebMCP registration generated by scripts/gen-webmcp-registrations.mjs from');
  lines.push(`// ${manifestPath} (mcp_tool_definition reused verbatim; the generator computes`);
  lines.push('// nothing and restates no computed value). Feature-detected: absent API');
  lines.push('// registers nothing, so this page is byte-identical without the API.');
  lines.push("// Answer-class delegate to this page's existing compute; zero network I/O.");
  lines.push('// Trust annotations, truthful-hint posture: deterministic local compute, no');
  lines.push('// untrusted content, so untrustedContentHint is not applicable per tool (n/a);');
  lines.push('// exposedTo intentionally omitted: no cross-origin exposure. A browser agent');
  lines.push('// is untrusted input like any form submission; the never-trust-client rule is');
  lines.push('// honored by construction because the tool is zero-server and only returns');
  lines.push('// computed JSON derived from declared inputs.');
  lines.push('// Browser support (dated observation): WebMCP origin trial from Chrome 149');
  lines.push('// (May 2026) per developer.chrome.com/docs/ai/webmcp (retrieved 2026-09-01).');
  lines.push("const mc = document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null);");
  lines.push('if (mc) {');
  lines.push('  mc.registerTool({');
  lines.push(`    name: '${jsStr(def.name)}',`);
  lines.push(`    description: '${jsStr(def.description)}',`);
  lines.push(`    inputSchema: ${JSON.stringify(def.inputSchema, null, 2).replace(/\n/g, '\n    ')},`);
  lines.push('    annotations: { readOnlyHint: true },');
  lines.push('    execute: async function(params) {');
  lines.push('      try {');
  for (const [name, spec] of props) {
    if (required.includes(name)) lines.push(`      ${validationLine(name, spec.type)}`);
  }
  for (const [name, spec] of props) {
    lines.push(`      ${mappingLine(name, spec.type, !required.includes(name), map[name])}`);
  }
  lines.push(`      await ${target}();`);
  lines.push('      return RESULT_GLOBAL;');
  lines.push('      } catch (err) {');
  lines.push("        return { error: 'compute_failed', detail: String((err && err.message) || err) };");
  lines.push('      }');
  lines.push('    }');
  lines.push('  });');
  lines.push('}');
  lines.push('</script>');
  lines.push(END);
  return lines.join('\n');
}

/** buildBlock with the page's verified result global substituted in. `wrapper`
 *  is the page-verified no-arg wrapper (G3b) the emitted call must target. */
export function buildBlockForPage(manifest, manifestPath, resGlobal, idMap, wrapper) {
  return buildBlock(manifest, manifestPath, idMap, wrapper).replace('return RESULT_GLOBAL;', `return ${resGlobal};`);
}

function regionOf(pageSrc) {
  const b = pageSrc.indexOf(BEGIN);
  if (b === -1) return null;
  const e = pageSrc.indexOf(END, b);
  if (e === -1) return null;
  return { start: b, end: e + END.length };
}

/** Idempotent write: replace the marked region, or insert before the final </body>. */
export function insertIntoPage(pageSrc, block) {
  const region = regionOf(pageSrc);
  if (region) {
    return pageSrc.slice(0, region.start) + block + pageSrc.slice(region.end);
  }
  if (!pageSrc.includes('</body>')) throw new Error('page has no </body> to insert before');
  return pageSrc.replace('</body>', block + '\n\n</body>');
}

// ── Candidate derivation (sweep gate live) ────────────────────────────────────

function listKernels(root) {
  const out = execFileSync('git', ['ls-files', 'chaingraph/kernels/*.kernel.mjs'], { cwd: root, env: gitEnv(), encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

function listPages(root) {
  const out = execFileSync('git', ['ls-files', '*.html'], { cwd: root, env: gitEnv(), encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

/**
 * Full per-tool decision: why a tool is or is not emittable TODAY.
 * Returns { toolId, ok, reason, detail }.
 */
export function adjudicateTool(toolId, repoRoot, manifestIndex, mcpNameByTool) {
  const pageRel = `chaingraph/${toolId}.html`;
  const pageAbs = resolve(repoRoot, pageRel);
  if (!existsSync(pageAbs)) return { toolId, ok: false, reason: `${pageRel} absent — kernel-only tool, no page to carry an inline registration` };

  // G6 — sweep gate, live: only CLEARED schemas generate.
  const kernelFile = `chaingraph/kernels/${toolId}.kernel.mjs`;
  const rec = sweepKernel(repoRoot, kernelFile, manifestIndex, mcpNameByTool);
  if (rec.verdict !== 'CLEARED') {
    const t = rec.triage?.class ? ` [${rec.triage.class}]` : '';
    return { toolId, ok: false, reason: `schema-read sweep verdict ${rec.verdict}${t} — registration may not emit from an uncleared schema` };
  }

  const loaded = loadManifestFor(toolId, manifestIndex, mcpNameByTool, repoRoot);
  if (loaded.error) return { toolId, ok: false, reason: loaded.error };
  const shapeErr = checkManifestShape(loaded.m);
  if (shapeErr) return { toolId, ok: false, reason: `manifest ${loaded.file}: ${shapeErr}` };
  const parityErr = checkManifestSchemaParity(loaded.m);
  if (parityErr) return { toolId, ok: false, reason: `manifest ${loaded.file}: ${parityErr}` };

  // G5 — the manifest's declared entry must be this page.
  const entry = loaded.m.execution?.entry || '';
  if (entry && basename(entry) !== `${toolId}.html`) {
    return { toolId, ok: false, reason: `manifest ${loaded.file} execution.entry (${entry}) is not this page` };
  }

  const pageSrc = readFileSync(pageAbs, 'utf8');
  const mapped = verifyPageMapping(loaded.m, pageSrc, pageRel, propertyIdMap[toolId]);
  if (mapped.error) return { toolId, ok: false, reason: mapped.error };

  return {
    toolId, ok: true,
    detail: { manifest: loaded.file, page: pageRel, resGlobal: mapped.resGlobal, name: loaded.m.mcp_tool_definition.name },
  };
}

/** Live sweep over every kernel; returns the CLEARED tool ids plus the indexes. */
export function deriveTargets(repoRoot) {
  const manifestIndex = loadManifestIndex(repoRoot);
  const mcpNameByTool = loadMcpNameIndex(repoRoot);
  const cleared = [];
  for (const kernelFile of listKernels(repoRoot)) {
    const rec = sweepKernel(repoRoot, kernelFile, manifestIndex, mcpNameByTool);
    if (rec.verdict === 'CLEARED') cleared.push(rec.tool_id);
  }
  cleared.sort();
  return { cleared, manifestIndex, mcpNameByTool };
}

// ── Modes ─────────────────────────────────────────────────────────────────────

function expectedBlock(toolId, manifestIndex, mcpNameByTool, repoRoot) {
  const loaded = loadManifestFor(toolId, manifestIndex, mcpNameByTool, repoRoot);
  if (loaded.error) throw new Error(loaded.error);
  const pageSrc = readRepoFile(`chaingraph/${toolId}.html`, repoRoot);
  const mapped = verifyPageMapping(loaded.m, pageSrc, toolId, propertyIdMap[toolId]);
  if (mapped.error) throw new Error(mapped.error);
  return buildBlockForPage(loaded.m, loaded.file, mapped.resGlobal, propertyIdMap[toolId], mapped.wrapper);
}

function runCheck() {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(REPO);
  const emittable = [];
  const excluded = [];
  for (const id of cleared) {
    const d = adjudicateTool(id, REPO, manifestIndex, mcpNameByTool);
    if (d.ok) emittable.push({ ...d.detail, toolId: id }); else excluded.push({ id, reason: d.reason });
  }

  const problems = [];
  // 1. Every emittable page carries a byte-exact generated region.
  for (const d of emittable) {
    const pageSrc = readRepoFile(d.page, REPO);
    const region = regionOf(pageSrc);
    if (!region) {
      problems.push(`${d.page}: no generated WebMCP registration region (coverage regression — expected for tool '${d.name}')`);
      continue;
    }
    let expected;
    try { expected = expectedBlock(d.toolId, manifestIndex, mcpNameByTool, REPO); } catch (e) {
      problems.push(`${d.page}: expected block could not be rebuilt: ${e.message}`);
      continue;
    }
    const actual = pageSrc.slice(region.start, region.end);
    if (actual !== expected) {
      problems.push(`${d.page}: generated region drifted from ${d.manifest} — hand-edits to generated blocks are red; run node scripts/gen-webmcp-registrations.mjs --all --write`);
      continue;
    }
    // Byte-exact implies parseable today; keep a parse proof so a future emitter
    // bug (or an exact-match escape) is a distinct, diagnosable red.
    const scriptBody = actual.slice(actual.indexOf('<script>') + 8, actual.lastIndexOf('</script>'));
    try { new Function(scriptBody); } catch (e) {
      problems.push(`${d.page}: generated region does not parse as JavaScript: ${e.message}`);
    }
  }
  // 2. Every generated region on disk still corresponds to an emittable tool.
  const emittablePages = new Set(emittable.map((d) => d.page));
  for (const p of listPages(REPO)) {
    let pageSrc;
    try { pageSrc = readRepoFile(p, REPO); } catch { continue; }
    if (!pageSrc.includes(BEGIN)) continue;
    if (!emittablePages.has(p)) {
      problems.push(`${p}: carries a generated WebMCP region but is not in today's emittable set (schema or mapping changed) — regenerate or remove the region`);
    }
  }

  if (problems.length) {
    console.error(`✗ webmcp-registration freshness FAILED (${problems.length}):`);
    problems.forEach((p) => console.error('    ' + p));
    process.exit(1);
  }
  console.log(`✓ webmcp-registration freshness clean — ${emittable.length} generated registration(s) byte-exact vs their manifests; ${excluded.length} sweep-cleared tool(s) excluded with reasons (shrinks as fix rows land).`);
  excluded.forEach((e) => console.log(`  EXCLUDED ${e.id}: ${e.reason}`));
}

function runReportOrWrite(write, onlyTool) {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(REPO);
  let emitted = 0;
  let exact = 0;
  const exclusions = [];
  const targets = onlyTool && !cleared.includes(onlyTool)
    ? [onlyTool] // --tool probes ANY tool id, even one the sweep did not clear — the refusal reason is the answer
    : cleared;
  for (const id of targets) {
    if (onlyTool && id !== onlyTool) continue;
    const d = adjudicateTool(id, REPO, manifestIndex, mcpNameByTool);
    if (!d.ok) { exclusions.push({ id, reason: d.reason }); continue; }
    const block = expectedBlock(id, manifestIndex, mcpNameByTool, REPO);
    const pageAbs = resolve(REPO, d.detail.page);
    if (write) {
      const pageSrc = readFileSync(pageAbs, 'utf8');
      const next = insertIntoPage(pageSrc, block);
      if (next !== pageSrc) { writeFileSync(pageAbs, next, 'utf8'); emitted++; console.log(`✓ emitted WebMCP registration into ${d.detail.page} (name: ${d.detail.name})`); }
      else { exact++; }
    } else {
      emitted++;
      console.log(`WOULD EMIT ${d.detail.page} (name: ${d.detail.name}, manifest: ${d.detail.manifest}, result: ${d.detail.resGlobal})`);
    }
  }
  if (write) console.log(`\n${emitted} page(s) written, ${exact} already byte-exact; ${exclusions.length} excluded with per-tool reasons:`);
  else console.log(`\n${emitted} emittable page(s); ${exclusions.length} excluded with per-tool reasons:`);
  exclusions.forEach((e) => console.log(`  EXCLUDED ${e.id}: ${e.reason}`));
}

// ── Selftest (synthetic fixture repo; the real tree is never written) ─────────

function selftest() {
  let failures = 0;
  const check = (label, ok) => {
    console.log((ok ? '  ✓ ' : '  ✗ ') + label);
    if (!ok) failures++;
  };
  const tmp = mkdtempSync(join(tmpdir(), 'gwmr-'));
  try {
    const manifestsDir = join(tmp, 'manifests');
    const kernelsDir = join(tmp, 'chaingraph', 'kernels');
    mkdirSync(manifestsDir, { recursive: true });
    mkdirSync(kernelsDir, { recursive: true });

    const schema = {
      type: 'object',
      required: ['principal', 'label'],
      properties: {
        principal: { type: 'number', description: 'Principal amount' },
        label: { type: 'string', description: 'Display label' },
        flag: { type: 'boolean', description: 'Optional toggle' },
        rows: { type: 'array', description: 'Optional rows' }
      }
    };
    const manifest = {
      tool_id: 'fx-100-selftest',
      input_schema: { properties: schema.properties, required: schema.required },
      mcp_tool_definition: {
        name: 'run_fx_100_selftest',
        description: 'Selftest fixture tool that exercises the registration generator end to end.',
        inputSchema: schema
      },
      execution: { type: 'browser-javascript', entry: 'chaingraph/fx-100-selftest.html', function_name: 'run', timeout_ms: 3000 }
    };
    writeFileSync(join(manifestsDir, '950-fx-100-selftest.manifest.json'), JSON.stringify(manifest, null, 2));
    // CLEARED kernel: compute reads exactly the declared fields.
    writeFileSync(join(kernelsDir, 'fx-100-selftest.kernel.mjs'), [
      "export const meta = { mcp_name: 'run_fx_100_selftest' };",
      'export function compute(pp) {',
      '  const principal = pp.principal; const label = pp.label;',
      '  const flag = pp.flag; const rows = pp.rows;',
      '  return { output_payload: { principal, label, flag, count: (rows || []).length }, compliance_flags: {} };',
      '}'
    ].join('\n'));
    const pageBody = [
      '<html><body>',
      '<input id="principal"><input id="label"><input id="flag"><input id="rows">',
      '<script>',
      'var _lastArtifact = null;',
      'async function run(){ _lastArtifact = { ok: true }; }',
      '</script>',
      '</body></html>'
    ].join('\n');
    writeFileSync(join(tmp, 'chaingraph', 'fx-100-selftest.html'), pageBody);

    const manifestIndex = loadManifestIndex(tmp);
    const mcpNameByTool = loadMcpNameIndex(tmp);

    // 1. Sweep gate: the fixture kernel re-verifies CLEARED live.
    const rec = sweepKernel(tmp, 'chaingraph/kernels/fx-100-selftest.kernel.mjs', manifestIndex, mcpNameByTool);
    check('sweep gate: fixture kernel is CLEARED live', rec.verdict === 'CLEARED');

    // 2. Full adjudication passes and reports the emit inputs.
    const d = adjudicateTool('fx-100-selftest', tmp, manifestIndex, mcpNameByTool);
    check('adjudication emits the fixture tool', d.ok === true);
    check('adjudication picks _lastArtifact as the result global', d.ok && d.detail.resGlobal === '_lastArtifact');

    // 3. Emitted block: verbatim name/schema, async delegate, truthful annotations.
    const wrap1 = findWrapperName(pageBody, 'run');
    check('G3b: zero-arg fn is its own wrapper (run)', wrap1 === 'run');
    const block = buildBlockForPage(manifest, 'manifests/950-fx-100-selftest.manifest.json', d.detail.resGlobal, undefined, wrap1);
    check('name emitted verbatim from mcp_tool_definition', block.includes("name: 'run_fx_100_selftest'"));
    check('inputSchema emitted verbatim', block.includes(JSON.stringify(schema, null, 2).replace(/\n/g, '\n    ')));
    check('execute is async and awaits the manifest function', block.includes('execute: async function(params)') && block.includes('await run();'));
    check('returns the page result global', block.includes('return _lastArtifact;'));
    check('annotations carry only readOnlyHint:true', block.includes('annotations: { readOnlyHint: true },') && !block.includes('untrustedContentHint:'));
    check('untrustedContentHint stated n/a in the comment', block.includes('untrustedContentHint is not applicable'));
    check('exposedTo omitted entirely', !block.includes('exposedTo:'));
    check('required-input validation emitted (principal)', block.includes("if (typeof params.principal !== 'number'"));
    check('optional mapping guarded, required unguarded', block.includes("if (params.flag !== undefined) document.getElementById('flag').checked") && block.includes("document.getElementById('principal').value = String(params.principal);"));
    check('feature-detect gates the registration', block.indexOf('document.modelContext') !== -1 && block.indexOf('registerTool') > block.indexOf('modelContext'));
    check('markers delimit the block', block.startsWith(beginLine('manifests/950-fx-100-selftest.manifest.json')) && block.endsWith(END));

    // 4. Insert is idempotent.
    const once = insertIntoPage(pageBody, block);
    const twice = insertIntoPage(once, block);
    check('insert is idempotent (second write replaces, not appends)', once !== pageBody && once === twice);

    // 5. Mutation control: a hand-edit to the emitted block is detectable.
    const mutated = once.replace("name: 'run_fx_100_selftest'", "name: 'hand_renamed_tool'");
    check('hand-edit mutation changes the region (detectable)', mutated !== once);
    check('stripMarkedRegions removes the whole region for G4', !/\.registerTool\s*\(/.test(stripMarkedRegions(once)));

    // 6. G2 refusal: a page missing one element id is refused, with the id named.
    const badPage = pageBody.replace('<input id="rows">', '');
    const refused = verifyPageMapping(manifest, badPage, 'fixture page');
    check('G2 refusal names the missing id (rows)', !!(refused.error && refused.error.includes('rows')));

    // 6b. propertyIdMap staleness guard (WEBMCP-GEN-IDMAP-1): a mapping whose
    // target element_id does NOT exist on the page FAILS — the table cannot go
    // stale silently. (Red-before-green proof for the mapped-id guard.)
    const staleMap = { principal: { element_id: 'no_such_control', via: 'string' } };
    const refusedStale = verifyPageMapping(manifest, pageBody, 'fixture page', staleMap);
    check('mapped id absent from page FAILS (staleness guard)',
      !!(refusedStale.error && refusedStale.error.includes('no_such_control') && refusedStale.error.includes('(mapped)')));

    // 6c. A valid mapping binds emission to the authored element_id.
    const mappedPage = pageBody.replace('<input id="principal">', '<input id="amtInput">');
    const okMapped = verifyPageMapping(manifest, mappedPage, 'fixture page', { principal: { element_id: 'amtInput', via: 'string' } });
    check('valid mapping passes G2 against the authored element_id', !okMapped.error);
    const mappedBlock = buildBlockForPage(manifest, 'manifests/950-fx-100-selftest.manifest.json', '_lastArtifact', { principal: { element_id: 'amtInput', via: 'string' } }, 'run');
    check('emission writes the mapped element_id, not the property name', mappedBlock.includes("document.getElementById('amtInput').value = String(params.principal);") && !mappedBlock.includes("getElementById('principal')"));
    // Unmapped properties keep the literal guard even when a map is present.
    const partialMap = { principal: { element_id: 'amtInput', via: 'string' } };
    const refusedPartial = verifyPageMapping(manifest, pageBody, 'fixture page', partialMap);
    check('unmapped property still requires its literal id under a mapping', !!(refusedPartial && refusedPartial.error && refusedPartial.error.includes('principal') && !refusedPartial.error.includes('label')));
    // boolstring via emits a 'true'/'false' select write, not .checked.
    const boolBlock = buildBlockForPage(manifest, 'manifests/950-fx-100-selftest.manifest.json', '_lastArtifact', { flag: { element_id: 'flag', via: 'boolstring' } }, 'run');
    check("boolstring via emits .value = String(params.x === true)", boolBlock.includes("document.getElementById('flag').value = String(params.flag === true);") && !boolBlock.includes("getElementById('flag').checked"));

    // 7. G3 refusal: no result global -> refused.
    const noRes = pageBody
      .replace('var _lastArtifact = null;', 'var _other = null;')
      .replace('_lastArtifact = { ok: true };', '_other = { ok: true };');
    const refusedRes = verifyPageMapping(manifest, noRes, 'fixture page');
    check('G3 refusal: missing result global refused', !!(refusedRes && refusedRes.error));

    // 8. G4 refusal: a page already carrying an unmarked registerTool is never touched.
    const owned = pageBody.replace('</body>', '<script>mc.registerTool({ name: "x" });</script></body>');
    const refusedOwned = verifyPageMapping(manifest, owned, 'fixture page');
    check('G4 refusal: existing unmarked registration refused', !!(refusedOwned && refusedOwned.error && refusedOwned.error.includes('owned by another row')));

    // 9. G1 refusal: manifest description too short.
    const thin = JSON.parse(JSON.stringify(manifest));
    thin.mcp_tool_definition.description = 'too short';
    const thinErr = checkManifestShape(thin);
    check('G1 refusal: short description refused', thinErr !== null);

    // 9b. G1b refusal: the two schema writers disagree -> not emittable.
    const drifted = JSON.parse(JSON.stringify(manifest));
    drifted.input_schema.properties.extra_field = { type: 'string' };
    const parityErr = checkManifestSchemaParity(drifted);
    check('G1b refusal: input_schema vs mcp_tool_definition drift refused', parityErr !== null && parityErr.includes('property sets'));

    // 10. Sweep gate refusal: a kernel reading an undeclared field is not emittable.
    writeFileSync(join(kernelsDir, 'fx-101-drifted.kernel.mjs'), [
      'export function compute(pp) {',
      '  return { output_payload: { surprise: pp.undeclared_field }, compliance_flags: {} };',
      '}'
    ].join('\n'));
    const rec2 = sweepKernel(tmp, 'chaingraph/kernels/fx-101-drifted.kernel.mjs', manifestIndex, mcpNameByTool);
    check('sweep gate: drifted kernel is NOT CLEARED (never emitted)', rec2.verdict !== 'CLEARED');

    // 11. Entry guard: manifest entry pointing elsewhere is refused (G5).
    const d5 = (() => {
      const alt = JSON.parse(JSON.stringify(manifest));
      alt.execution.entry = 'chaingraph/kernels/fx-102-entry.kernel.mjs';
      writeFileSync(join(manifestsDir, '951-fx-102-entry.manifest.json'), JSON.stringify({ ...alt, tool_id: 'fx-102-entry' }, null, 2));
      // Same cleared read shape as fx-100 so the flow reaches G5, not G6.
      writeFileSync(join(kernelsDir, 'fx-102-entry.kernel.mjs'), readFileSync(join(kernelsDir, 'fx-100-selftest.kernel.mjs')));
      writeFileSync(join(tmp, 'chaingraph', 'fx-102-entry.html'), pageBody.replace(/fx-100-selftest/g, 'fx-102-entry'));
      // The manifest index was loaded before this fixture file existed — reload.
      const idx2 = loadManifestIndex(tmp);
      return adjudicateTool('fx-102-entry', tmp, idx2, mcpNameByTool);
    })();
    check('G5 refusal: execution.entry not this page', !d5.ok && d5.reason.includes('execution.entry'));

    // 12. G3b red-before-green (WEBMCP-GEN-RUNWRAPPER-1): a fn(pp)-shaped page.
    // The pre-fix emitter produced `await compute();` against exactly this page
    // shape — the halt-3 art-635 compute_failed defect. The guard below is RED
    // on that emission shape and GREEN only when the region calls the wrapper.
    const ppPage = [
      '<html><body>',
      '<input id="principal"><input id="label"><input id="flag"><input id="rows">',
      '<script>',
      'var _lastArtifact = null;',
      'function compute(pp){ _lastArtifact = { pp: pp }; }',
      'async function run(){ compute({ principal: Number(document.getElementById(\'principal\').value) }); }',
      '</script>',
      '</body></html>'
    ].join('\n');
    const ppMan = JSON.parse(JSON.stringify(manifest));
    ppMan.execution = { ...ppMan.execution, function_name: 'compute' };
    check('G3b detection: zero-arg invoker of compute(pp) is run', findWrapperName(ppPage, 'compute') === 'run');
    const ppMapped = verifyPageMapping(ppMan, ppPage, 'pp fixture page');
    check('G3b: parametered page maps with wrapper run', !ppMapped.error && ppMapped.wrapper === 'run');
    const ppBlock = buildBlockForPage(ppMan, 'manifests/950-fx-100-selftest.manifest.json', '_lastArtifact', undefined, ppMapped.wrapper);
    // The RED control: the pre-fix emission shape fails this assertion.
    check('red-before-green: pre-fix shape (await compute();) FAILS the wrapper guard', !ppBlock.includes('await compute();'));
    check('emitted call targets the page wrapper run()', ppBlock.includes('await run();'));
    // No wrapper on the page -> refused, never guessed.
    const noWrapPage = ppPage.replace('async function run(){ compute({ principal: Number(document.getElementById(\'principal\').value) }); }', '');
    check('findWrapperName: absent wrapper -> null', findWrapperName(noWrapPage, 'compute') === null);
    const refusedWrap = verifyPageMapping(ppMan, noWrapPage, 'pp fixture page');
    check('G3b refusal: parametered fn with no detectable wrapper refused', !!(refusedWrap.error && refusedWrap.error.includes('wrapper')));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(failures === 0 ? 'GEN-WEBMCP-REGISTRATIONS SELFTEST: PASS' : 'GEN-WEBMCP-REGISTRATIONS SELFTEST: FAIL');
  process.exit(failures === 0 ? 0 : 1);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  selftest();
} else if (args.includes('--check')) {
  runCheck();
} else {
  const write = args.includes('--write');
  const all = args.includes('--all');
  const tIdx = args.indexOf('--tool');
  const onlyTool = tIdx !== -1 ? args[tIdx + 1] : null;
  runReportOrWrite(write, onlyTool);
}
