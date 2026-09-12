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
 *   node scripts/gen-webmcp-registrations.mjs --triage [--out <file>]
 *       (WEBMCP-EXCLUSION-TRIAGE-1: one JSON line per page excluded with the
 *       reason "form-element mapping incomplete" — missing props with schema
 *       kind, heuristic name-similarity candidates, JSON-textarea presence,
 *       parametered-function flag, and a RENAME-ONLY / AGGREGATE /
 *       VOCAB-DIVERGENT / MIXED bucket. REPORT ONLY: the IDMAP ruling bans
 *       heuristic BINDING, not heuristic REPORTING — a candidate emitted here
 *       is never written into a propertyIdMap or a registration block; authored
 *       mappings remain the only binding path.)
 *   node scripts/gen-webmcp-registrations.mjs --all --write   (regen tranche)
 *   node scripts/gen-webmcp-registrations.mjs --tool <id> --write
 *   node scripts/gen-webmcp-registrations.mjs --check         (CI/preflight)
 *   node scripts/gen-webmcp-registrations.mjs --manifest [--write|--check]
 *       (WEBMCP-MANIFEST-1: the /.well-known/webmcp.json directory emitter)
 *   node scripts/gen-webmcp-registrations.mjs --derive-map [--write] [--report]
 *       (WEBMCP-WRAPPER-PARSE-1: parse each excluded page's own no-arg wrapper,
 *       bind prop←id explicitly, probe every derived page against fixture 0's
 *       execution_hash, and write proven entries into propertyIdMap's derived
 *       region with source 'parsed-from-wrapper' + wrapper_digest. --report
 *       prints the per-page buckets.)
 *   node scripts/gen-webmcp-registrations.mjs --selftest
 *
 * WEBMCP-OT-META-1: every write/check mode above also carries the origin-trial
 * <meta> region in each generator-owned page's <head> (token from
 * chaingraph/webmcp-ot-token.txt; placeholder = nothing emitted) and --check
 * runs the OT token gate (origin/feature/expiry, 14-day renewal floor).
 *
 * Exit: 0 clean; 1 on any --check drift or hard-guard failure.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import * as vm from 'node:vm';
import { loadManifestIndex, loadMcpNameIndex, sweepKernel } from './check-schema-read-divergence.mjs';
import { gitEnv } from './_git-env-lib.mjs';
import { buildDeeplinkScript, buildFileImportScript, DEEPLINK_MARKER, FILE_IMPORT_MARKER } from '../chaingraph/_page-chrome.mjs';

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

// ── Origin-trial meta emitter + token gate (WEBMCP-OT-META-1) ────────────────
/**
 * Chrome's WebMCP origin trial exposes document.modelContext only when the page
 * serves a first-party OT token. The token file (`chaingraph/webmcp-ot-token.txt`,
 * real token from PR #1726) is read at generation time:
 *   - with a real token, every generator-owned registered page's <head> carries
 *     `<meta http-equiv="origin-trial" content="...">` inside its own marker
 *     region (OT_META_BEGIN/END), byte-exact under --check;
 *   - with the placeholder, nothing is emitted and pages stay byte-identical.
 * The --check gate decodes the token (base64 envelope, JSON payload at the tail)
 * and goes RED when origin/feature mismatch or expiry is < 14 days out (the
 * expiry gate IS the renewal alarm — no cron, no workflow); placeholder prints
 * ADVISORY: OT-TOKEN ABSENT. Registration needs a Google account (no API), so
 * the token paste is the operator's one-line commit (WEBMCP-OT-TOKEN-PASTE).
 */
export const OT_META_BEGIN = '<!-- WEBMCP:OT-META-BEGIN generator=scripts/gen-webmcp-registrations.mjs -->';
export const OT_META_END = '<!-- WEBMCP:OT-META-END -->';
export const OT_TOKEN_PLACEHOLDER = 'PLACEHOLDER-SET-BY-OPERATOR';
export const OT_MIN_DAYS = 14;

/** Read + classify the OT token file. `present` is true only for a real token. */
export function readOtToken(repoRoot) {
  const abs = resolve(repoRoot || REPO, OT_TOKEN_REL);
  if (!existsSync(abs)) return { present: false, placeholder: true, token: '' };
  const token = readFileSync(abs, 'utf8').trim();
  if (!token || token === OT_TOKEN_PLACEHOLDER) return { present: false, placeholder: true, token };
  return { present: true, placeholder: false, token };
}

/** Decode the token envelope: base64 bytes whose tail carries the JSON payload
 *  {origin, feature, expiry (seconds), isSubdomain}. Returns {ok, payload} or
 *  {ok:false, error}. */
export function decodeOtToken(token) {
  let bytes;
  try {
    bytes = Buffer.from(String(token).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
  } catch (e) {
    return { ok: false, error: `token is not base64: ${e.message}` };
  }
  const m = bytes.match(/\{[^{}]*\}\s*$/);
  if (!m) return { ok: false, error: 'decoded token carries no JSON payload at its tail' };
  try { return { ok: true, payload: JSON.parse(m[0]) }; }
  catch (e) { return { ok: false, error: `token JSON payload is not valid JSON: ${e.message}` }; }
}

/** Pure OT gate: [] when the token is acceptable, else one string per RED. */
export function otTokenGateErrors(token, now = new Date()) {
  const dec = decodeOtToken(token);
  if (!dec.ok) return [`OT token does not decode: ${dec.error}`];
  const p = dec.payload;
  const reasons = [];
  // The payload carries the port (https://ainumbers.co:443); :443 is the default
  // HTTPS port, so it normalizes to the bare origin.
  const origin = typeof p.origin === 'string' ? p.origin.replace(/:443$/, '') : p.origin;
  if (origin !== 'https://ainumbers.co') reasons.push(`OT token origin ${JSON.stringify(p.origin)} !== https://ainumbers.co`);
  if (p.feature !== 'WebMCP') reasons.push(`OT token feature ${JSON.stringify(p.feature)} !== 'WebMCP'`);
  const days = typeof p.expiry === 'number' ? (p.expiry * 1000 - now.getTime()) / 86400000 : NaN;
  if (!Number.isFinite(days)) reasons.push('OT token expiry missing or unparseable (seconds-since-epoch expected)');
  else if (days < OT_MIN_DAYS) reasons.push(`OT token expires in ${days.toFixed(1)} days — below the ${OT_MIN_DAYS}-day renewal floor (renew the token: origin-trials.google.com)`);
  return reasons;
}

/** The marker-delimited <head> region carrying the meta tag. */
export function otMetaBlock(token) {
  return [OT_META_BEGIN, `<meta http-equiv="origin-trial" content="${token}">`, OT_META_END].join('\n');
}

function otMetaRegionOf(pageSrc) {
  const b = pageSrc.indexOf(OT_META_BEGIN);
  if (b === -1) return null;
  const e = pageSrc.indexOf(OT_META_END, b);
  if (e === -1) return null;
  return { start: b, end: e + OT_META_END.length };
}

/** Idempotent <head> writer: with `block`, the region sits on the first line
 *  after <head>; with null, any existing region is stripped (byte-identical
 *  with a never-tokenized page). */
export function applyOtMeta(pageSrc, block) {
  let src = pageSrc;
  const region = otMetaRegionOf(src);
  if (region) src = src.slice(0, region.start) + src.slice(region.end).replace(/^\n/, '');
  if (!block) return src;
  const m = /<head\b[^>]*>/.exec(src);
  if (!m) throw new Error('page has no <head> to carry the origin-trial meta region');
  let at = m.index + m[0].length;
  if (src[at] === '\n') at += 1;
  return src.slice(0, at) + block + '\n' + src.slice(at);
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

  // ── WEBMCP-IDMAP-BATCH-2 (the remaining 15 RENAME-ONLY pages from
  // research/WEBMCP-TRIAGE-2026-09.json after BATCH-1's 25; PR #1729). Every
  // control below was re-verified against the page at base 1eec8891: the id
  // exists and the page's own compute reads it (cited file:line).
  // DROPPED (honest exclusion, no faithful single control):
  //   art-375-compute-fund-expense-ratios + art-515-build-allocation-decision-
  //   receipt — `rounding` is a composite object assembled from two controls
  //   (decimal_places + rounding_mode; art-375:515, art-515:695-696).
  //   art-404-check-retail-installment-disclosures — `inputs` is a composite
  //   object spread across ten controls (getParams, art-404:327-339).
  //   rca-03-iso20022-address-migration-verifier — partial mapping below; the
  //   required `records` prop has no faithful control (CSV-imported in-memory
  //   `_records` state rendered as dynamic per-field inputs; importCsv,
  //   rca-03:637-652), so the page stays excluded.

  // getParams reads the merchant/duration/rail/cadence controls:
  //   chaingraph/art-36-tempo-mpp-agent-mandate.html:513-518
  'art-36-tempo-mpp-agent-mandate': {
    merchant: { element_id: 'merchantEndpoint', via: 'string' },
    duration: { element_id: 'sessionDuration', via: 'string' },
    rail: { element_id: 'paymentRail', via: 'string' },
    cadence: { element_id: 'voucherCadence', via: 'string' },
  },
  // getParams reads every camelCase control explicitly:
  //   chaingraph/art-367-compute-cross-border-fees.html:307-314
  'art-367-compute-cross-border-fees': {
    invoice_amount: { element_id: 'invoiceAmount', via: 'string' },
    origin_country: { element_id: 'originCountry', via: 'string' },
    dest_country: { element_id: 'destCountry', via: 'string' },
    fx_spread_bps: { element_id: 'fxSpreadBps', via: 'string' },
    method_fee: { element_id: 'methodFee', via: 'string' },
    vat_rate: { element_id: 'vatRate', via: 'string' },
    doc_cost: { element_id: 'docCost', via: 'string' },
    recon_cost: { element_id: 'reconCost', via: 'string' },
  },
  // assembler payload reads f_* selects verbatim; two booleans are
  // "true"/"false" selects (bool(): art-411:416):
  //   chaingraph/art-411-ai-addendum-assembler.html:418-427
  'art-411-ai-addendum-assembler': {
    train_on_customer_data: { element_id: 'f_train_on_customer_data', via: 'boolstring' },
    model_improvement: { element_id: 'f_model_improvement', via: 'boolstring' },
    training_data: { element_id: 'f_training_data', via: 'string' },
    training_purposes: { element_id: 'f_training_purposes', via: 'string' },
    training_restrictions: { element_id: 'f_training_restrictions', via: 'string' },
    improvement_restrictions: { element_id: 'f_improvement_restrictions', via: 'string' },
    retention_window: { element_id: 'f_retention_window', via: 'string' },
    output_ownership: { element_id: 'f_output_ownership', via: 'string' },
    subprocessor_ai: { element_id: 'f_subprocessor_ai', via: 'string' },
    effective_date: { element_id: 'f_effective_date', via: 'string' },
  },
  // mapper payload reads the two f_* controls verbatim:
  //   chaingraph/art-412-ai-act-procurement-clause-mapper.html:337-338
  'art-412-ai-act-procurement-clause-mapper': {
    risk_tier: { element_id: 'f_risk_tier', via: 'string' },
    deployment_context: { element_id: 'f_deployment_context', via: 'string' },
  },
  // getParams reads listVersion select:
  //   chaingraph/art-413-screen-sanctions-private.html:338
  'art-413-screen-sanctions-private': {
    list_version: { element_id: 'listVersion', via: 'string' },
  },
  // getParams reads every camelCase control explicitly; two are checkboxes:
  //   chaingraph/art-450-model-inventory-entry.html:362-372
  'art-450-model-inventory-entry': {
    model_name: { element_id: 'modelName', via: 'string' },
    model_owner: { element_id: 'modelOwner', via: 'string' },
    business_purpose: { element_id: 'businessPurpose', via: 'string' },
    development_date: { element_id: 'developmentDate', via: 'string' },
    deployment_date: { element_id: 'deploymentDate', via: 'string' },
    last_validation_date: { element_id: 'lastValidationDate', via: 'string' },
    materiality_score: { element_id: 'materialityScore', via: 'string' },
    complexity_score: { element_id: 'complexityScore', via: 'string' },
    usage_scope: { element_id: 'usageScope', via: 'string' },
    third_party_vendor: { element_id: 'thirdPartyVendor', via: 'checked' },
    ai_ml_model: { element_id: 'aiMlModel', via: 'checked' },
  },
  // getParams reads every camelCase control explicitly:
  //   chaingraph/art-458-attribute-sampling-plan.html:331-335
  'art-458-attribute-sampling-plan': {
    confidence_level: { element_id: 'confidenceLevel', via: 'string' },
    population_size: { element_id: 'populationSize', via: 'string' },
    tolerable_deviation_rate: { element_id: 'tolerableDeviationRate', via: 'string' },
    expected_deviation_rate: { element_id: 'expectedDeviationRate', via: 'string' },
    population_hash: { element_id: 'populationHash', via: 'string' },
  },
  // getParams reads every camelCase control explicitly:
  //   chaingraph/art-460-ipe-integrity-verifier.html:331-336
  'art-460-ipe-integrity-verifier': {
    source_extract_hash: { element_id: 'sourceExtractHash', via: 'string' },
    report_hash: { element_id: 'reportHash', via: 'string' },
    source_row_count: { element_id: 'sourceRowCount', via: 'string' },
    report_row_count: { element_id: 'reportRowCount', via: 'string' },
    source_control_total: { element_id: 'sourceControlTotal', via: 'string' },
    report_control_total: { element_id: 'reportControlTotal', via: 'string' },
  },
  // pp assembly JSON.parses the three textarea controls:
  //   chaingraph/art-482-emir-recon-adjudicator.html:450-452
  'art-482-emir-recon-adjudicator': {
    tr_response: { element_id: 'trResponse', via: 'json' },
    firm_state: { element_id: 'firmState', via: 'json' },
    policy: { element_id: 'policyInput', via: 'json' },
  },
  // buildPolicyParameters reads every control explicitly; five booleans are
  // fieldBool "true"/"false" selects (art-492:561):
  //   chaingraph/art-492-classify-settlement-finality.html:564-587
  'art-492-classify-settlement-finality': {
    settlement_model: { element_id: 'settlementModel', via: 'string' },
    as_of_ts: { element_id: 'asOfTs', via: 'string' },
    required_tier: { element_id: 'requiredTier', via: 'string' },
    claimed_tier: { element_id: 'claimedTier', via: 'string' },
    chain_label: { element_id: 'chainLabel', via: 'string' },
    assertion_created_at: { element_id: 'assertionCreatedAt', via: 'string' },
    challenge_window_seconds: { element_id: 'challengeWindowSeconds', via: 'string' },
    batch_posted: { element_id: 'batchPosted', via: 'boolstring' },
    batch_committed_at: { element_id: 'batchCommittedAt', via: 'string' },
    proof_submitted_at: { element_id: 'proofSubmittedAt', via: 'string' },
    proof_accepted: { element_id: 'proofAccepted', via: 'boolstring' },
    l1_finalized: { element_id: 'l1Finalized', via: 'boolstring' },
    l1_finality_seconds: { element_id: 'l1FinalitySeconds', via: 'string' },
    expected_proof_cadence_seconds: { element_id: 'expectedProofCadenceSeconds', via: 'string' },
    included_in_block: { element_id: 'includedInBlock', via: 'boolstring' },
    quorum_committed: { element_id: 'quorumCommitted', via: 'boolstring' },
    quorum_pct_of_stake: { element_id: 'quorumPctOfStake', via: 'string' },
  },
  // run() JSON.parses the payloadJson textarea:
  //   chaingraph/art-564-ucp-checkout-payload-lint.html:462
  'art-564-ucp-checkout-payload-lint': {
    payload: { element_id: 'payloadJson', via: 'json' },
  },
  // PARTIAL: `records` dropped (no faithful control — see batch header note).
  // runFinality reads the two remaining controls directly:
  //   chaingraph/rca-03-iso20022-address-migration-verifier.html:774-775
  'rca-03-iso20022-address-migration-verifier': {
    strictness: { element_id: 'strictnessSelect', via: 'string' },
    trunc_threshold: { element_id: 'truncThreshold', via: 'string' },
  },
    // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-01-ap2-mandate-chain-validator.html:316 — cart -> #cartJson (JSON-text textarea (#cartJson); page parses JSON textareas)
  //   chaingraph/art-01-ap2-mandate-chain-validator.html:348 — hnp_mode -> #hnpMode (#hnpMode read as a plain .value string)
  //   chaingraph/art-01-ap2-mandate-chain-validator.html:308 — intent -> #intentJson (JSON-text textarea (#intentJson); page parses JSON textareas)
  //   chaingraph/art-01-ap2-mandate-chain-validator.html:324 — payment -> #paymentJson (JSON-text textarea (#paymentJson); page parses JSON textareas)
  //   chaingraph/art-01-ap2-mandate-chain-validator.html:336 — validate_at -> #validateAt (#validateAt read as a plain .value string)
  'art-01-ap2-mandate-chain-validator': {
    cart: { element_id: 'cartJson', via: 'json' },
    hnp_mode: { element_id: 'hnpMode', via: 'string' },
    intent: { element_id: 'intentJson', via: 'json' },
    payment: { element_id: 'paymentJson', via: 'json' },
    validate_at: { element_id: 'validateAt', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/cry-01-zk-compliance-proof-generator.html:191 — predicate_type -> #predicateType (#predicateType read as a plain .value string)
  'cry-01-zk-compliance-proof-generator': {
    predicate_type: { element_id: 'predicateType', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/ml-01-isolation-forest.html:244 — n_trees -> #nTrees (#nTrees read as a plain .value string)
  'ml-01-isolation-forest': {
    n_trees: { element_id: 'nTrees', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/ptg-01-ap2-prompt-template-generator.html:266 — audience -> #audienceSelect (#audienceSelect read as a plain .value string)
  //   chaingraph/ptg-01-ap2-prompt-template-generator.html:254 — task -> #taskSelect (#taskSelect read as a plain .value string)
  'ptg-01-ap2-prompt-template-generator': {
    audience: { element_id: 'audienceSelect', via: 'string' },
    task: { element_id: 'taskSelect', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/qfa-01-options-greeks.html:289 — rate -> #inRate (#inRate read as a plain .value string)
  //   chaingraph/qfa-01-options-greeks.html:271 — spot -> #inSpot (#inSpot read as a plain .value string)
  //   chaingraph/qfa-01-options-greeks.html:275 — strike -> #inStrike (#inStrike read as a plain .value string)
  //   chaingraph/qfa-01-options-greeks.html:283 — vol -> #inVol (#inVol read as a plain .value string)
  'qfa-01-options-greeks': {
    rate: { element_id: 'inRate', via: 'string' },
    spot: { element_id: 'inSpot', via: 'string' },
    strike: { element_id: 'inStrike', via: 'string' },
    vol: { element_id: 'inVol', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/sim-01-lcr-nsfr-liquidity-stress-test.html:300 — n_paths -> #nPaths (#nPaths read as a plain .value string)
  'sim-01-lcr-nsfr-liquidity-stress-test': {
    n_paths: { element_id: 'nPaths', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-02-agent-spend-policy-simulator.html:380 — chaos -> #chaosLevel (#chaosLevel read as a plain .value string)
  //   chaingraph/art-02-agent-spend-policy-simulator.html:385 — drip_freq -> #dripFreq (#dripFreq read as a plain .value string)
  //   chaingraph/art-02-agent-spend-policy-simulator.html:375 — hnp_ratio -> #hnpRatio (#hnpRatio read as a plain .value string)
  'art-02-agent-spend-policy-simulator': {
    chaos: { element_id: 'chaosLevel', via: 'string' },
    drip_freq: { element_id: 'dripFreq', via: 'string' },
    hnp_ratio: { element_id: 'hnpRatio', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/ml-02-credit-default-risk-scorer.html:239 — asset_class -> #assetClass (#assetClass read as a plain .value string)
  //   chaingraph/ml-02-credit-default-risk-scorer.html:235 — n_loans -> #nLoans (#nLoans read as a plain .value string)
  //   chaingraph/ml-02-credit-default-risk-scorer.html:270 — pd_threshold -> #pdThreshold (#pdThreshold read as a plain .value string)
  'ml-02-credit-default-risk-scorer': {
    asset_class: { element_id: 'assetClass', via: 'string' },
    n_loans: { element_id: 'nLoans', via: 'string' },
    pd_threshold: { element_id: 'pdThreshold', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/qfa-02-portfolio-var-engine.html:216 — conf_level -> #confLevel (#confLevel read as a plain .value string)
  //   chaingraph/qfa-02-portfolio-var-engine.html:206 — mc_sims -> #mcSims (#mcSims read as a plain .value string)
  //   chaingraph/qfa-02-portfolio-var-engine.html:193 — n_assets -> #nAssets (#nAssets read as a plain .value string)
  'qfa-02-portfolio-var-engine': {
    conf_level: { element_id: 'confLevel', via: 'string' },
    mc_sims: { element_id: 'mcSims', via: 'string' },
    n_assets: { element_id: 'nAssets', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/rca-02-mica-reserve-stress.html:307 — horizon_days -> #horizonDays (#horizonDays read as a plain .value string)
  //   chaingraph/rca-02-mica-reserve-stress.html:302 — n_paths -> #nPaths (#nPaths read as a plain .value string)
  'rca-02-mica-reserve-stress': {
    horizon_days: { element_id: 'horizonDays', via: 'string' },
    n_paths: { element_id: 'nPaths', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/qfa-03-stress-test-engine.html:276 — equity_beta -> #equityBeta (#equityBeta read as a plain .value string)
  //   chaingraph/qfa-03-stress-test-engine.html:298 — mc_paths -> #mcPaths (#mcPaths read as a plain .value string)
  'qfa-03-stress-test-engine': {
    equity_beta: { element_id: 'equityBeta', via: 'string' },
    mc_paths: { element_id: 'mcPaths', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/cry-04-merkle-batch-verifier.html:311 — merkle_root -> #merkleRoot (#merkleRoot read as a plain .value string)
  //   chaingraph/cry-04-merkle-batch-verifier.html:317 — proof_entries -> #proofEntries (JSON-text textarea (#proofEntries); page parses JSON textareas)
  'cry-04-merkle-batch-verifier': {
    merkle_root: { element_id: 'merkleRoot', via: 'string' },
    proof_entries: { element_id: 'proofEntries', via: 'json' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/qfa-04-xva-cva-calculator.html:280 — n_paths -> #inNPaths (#inNPaths read as a plain .value string)
  //   chaingraph/qfa-04-xva-cva-calculator.html:270 — notional -> #inNotional (#inNotional read as a plain .value string)
  'qfa-04-xva-cva-calculator': {
    n_paths: { element_id: 'inNPaths', via: 'string' },
    notional: { element_id: 'inNotional', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-06-genius-act-reserve-attestation.html:304 — issuer_type -> #issuerType (#issuerType read as a plain .value string)
  //   chaingraph/art-06-genius-act-reserve-attestation.html:288 — outstanding_tokens -> #outstandingTokens (#outstandingTokens read as a plain .value string)
  //   chaingraph/art-06-genius-act-reserve-attestation.html:293 — token_price -> #tokenPrice (#tokenPrice read as a plain .value string)
  'art-06-genius-act-reserve-attestation': {
    issuer_type: { element_id: 'issuerType', via: 'string' },
    outstanding_tokens: { element_id: 'outstandingTokens', via: 'string' },
    token_price: { element_id: 'tokenPrice', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-11-vop-batch-match-rate-analyser.html:341 — match_threshold -> #matchThreshold (#matchThreshold read as a plain .value string)
  'art-11-vop-batch-match-rate-analyser': {
    match_threshold: { element_id: 'matchThreshold', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-35-tempo-payments-business-case.html:262 — impl_months -> #implMonths (#implMonths read as a plain .value string)
  //   chaingraph/art-35-tempo-payments-business-case.html:232 — rail -> #incumbentRail (#incumbentRail read as a plain .value string)
  'art-35-tempo-payments-business-case': {
    impl_months: { element_id: 'implMonths', via: 'string' },
    rail: { element_id: 'incumbentRail', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-38-tempo-onchain-aml.html:221 — sar_threshold -> #sarThreshold (#sarThreshold read as a plain .value string)
  //   chaingraph/art-38-tempo-onchain-aml.html:225 — tr_threshold -> #trThreshold (#trThreshold read as a plain .value string)
  'art-38-tempo-onchain-aml': {
    sar_threshold: { element_id: 'sarThreshold', via: 'string' },
    tr_threshold: { element_id: 'trThreshold', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-43-arc-cpn-model.html:200 — rail -> #incumbentRail (#incumbentRail read as a plain .value string)
  'art-43-arc-cpn-model': {
    rail: { element_id: 'incumbentRail', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-44-arc-stablefx-model.html:201 — trading_days -> #tradingDays (#tradingDays read as a plain .value string)
  'art-44-arc-stablefx-model': {
    trading_days: { element_id: 'tradingDays', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-45-arc-xreserve-linter.html:250 — cctp_domains -> #cctpDomains (#cctpDomains read as a plain .value string)
  //   chaingraph/art-45-arc-xreserve-linter.html:224 — usdc_pct -> #usdcPct (#usdcPct read as a plain .value string)
  //   chaingraph/art-45-arc-xreserve-linter.html:229 — usyc_pct -> #usycPct (#usycPct read as a plain .value string)
  'art-45-arc-xreserve-linter': {
    cctp_domains: { element_id: 'cctpDomains', via: 'string' },
    usdc_pct: { element_id: 'usdcPct', via: 'string' },
    usyc_pct: { element_id: 'usycPct', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-46-arc-paymaster-model.html:202 — eth_price_usd -> #ethPriceUsd (#ethPriceUsd read as a plain .value string)
  //   chaingraph/art-46-arc-paymaster-model.html:192 — gas_per_uop -> #gasPerUop (#gasPerUop read as a plain .value string)
  //   chaingraph/art-46-arc-paymaster-model.html:187 — monthly_uops -> #monthlyUops (#monthlyUops read as a plain .value string)
  'art-46-arc-paymaster-model': {
    eth_price_usd: { element_id: 'ethPriceUsd', via: 'string' },
    gas_per_uop: { element_id: 'gasPerUop', via: 'string' },
    monthly_uops: { element_id: 'monthlyUops', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-47-arc-cctp-transfer.html:227 — notional_usd -> #notionalUsd (#notionalUsd read as a plain .value string)
  //   chaingraph/art-47-arc-cctp-transfer.html:232 — transfer_mode -> #transferMode (#transferMode read as a plain .value string)
  'art-47-arc-cctp-transfer': {
    notional_usd: { element_id: 'notionalUsd', via: 'string' },
    transfer_mode: { element_id: 'transferMode', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-61-x402-batch-settlement-reconciler.html:162 — batch -> #batch_id (#batch_id read as a plain .value string)
  //   chaingraph/art-61-x402-batch-settlement-reconciler.html:181 — vouchers -> #vouchers_json (page JSON.parses #vouchers_json's value)
  'art-61-x402-batch-settlement-reconciler': {
    batch: { element_id: 'batch_id', via: 'string' },
    vouchers: { element_id: 'vouchers_json', via: 'json' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-63-agent-service-metering-modeler.html:163 — pricing -> #pricing_model (#pricing_model read as a plain .value string)
  'art-63-agent-service-metering-modeler': {
    pricing: { element_id: 'pricing_model', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-67-agentic-ai-risk-classifier.html:195 — model -> #model_type (#model_type read as a plain .value string)
  'art-67-agentic-ai-risk-classifier': {
    model: { element_id: 'model_type', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-69-cbam-embedded-emissions-calculator.html:208 — precursor_emissions -> #precursor_emissions_tco2e (#precursor_emissions_tco2e read as a plain .value string)
  'art-69-cbam-embedded-emissions-calculator': {
    precursor_emissions: { element_id: 'precursor_emissions_tco2e', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-71-cbam-certificate-cost-engine.html:188 — eua_reference_price -> #eua_reference_price_eur (#eua_reference_price_eur read as a plain .value string)
  'art-71-cbam-certificate-cost-engine': {
    eua_reference_price: { element_id: 'eua_reference_price_eur', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-76-climate-scenario-applicator.html:176 — scenario -> #scenario_family (#scenario_family read as a plain .value string)
  'art-76-climate-scenario-applicator': {
    scenario: { element_id: 'scenario_family', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-78-csdr-penalty-calculator.html:176 — fail -> #fail_days (#fail_days read as a plain .value string)
  'art-78-csdr-penalty-calculator': {
    fail: { element_id: 'fail_days', via: 'string' },
  },
  // WEBMCP-PROPERTYIDMAP-BATCH-1: rename pair(s) from fixlist WEBMCP-SCHEMA-DIVERGENCE-FIXLIST-1
  // (graded PASS, board/reference/SHADOW-PROPOSALS.md CS-145); via authored from the page's
  // own control reads:
  //   chaingraph/art-106-tempo-subscription-reconciler.html:237 — draws -> #draws_json (page JSON.parses #draws_json's value)
  'art-106-tempo-subscription-reconciler': {
    draws: { element_id: 'draws_json', via: 'json' },
  },
  // art-160 (WEBMCP-PROPERTYIDMAP-BATCH-1 follow-up): the fixlist's rename pair
  // `transaction -> #transaction_value` was withdrawn — `transaction` is an
  // object prop (7 sub-fields) and the sole #transaction_value number input
  // cannot faithfully carry it (deep-link probe execution_hash mismatch,
  // preflight FULL 2026-09-10). Honest exclusion; PAGE-FIX-NEEDED.

/* WEBMCP:DERIVED-MAP-BEGIN (generated by --derive-map --write, WEBMCP-WRAPPER-PARSE-1; hand-edits are red) */
  'art-153-emir-trade-report-field-validator': {
    // wrapper: run (sha256 1ff6c74b2596…, WEBMCP-WRAPPER-PARSE-1 probe-verified)
    "report": {"source":"parsed-from-wrapper","wrapper_digest":"1ff6c74b259680f6f21814d060f5f890fd4d648b7d3ef88e82d6ef528ae4d2cc","object":{"action_type":{"id":"action_type"},"reporting_counterparty_lei":{"id":"reporting_counterparty_lei"},"other_counterparty_lei":{"id":"other_counterparty_lei"},"uti":{"id":"uti"},"upi":{"id":"upi"},"notional":{"id":"notional","coerce":"number"},"notional_currency":{"id":"notional_currency"},"effective_date":{"id":"effective_date"},"asset_class":{"id":"asset_class"}}},
  },
  'art-163-vida-oss-registration-router': {
    // wrapper: run (sha256 bbd4651c386a…, WEBMCP-WRAPPER-PARSE-1 probe-verified)
    "supply": {"source":"parsed-from-wrapper","wrapper_digest":"bbd4651c386a7172e3fb4106e7e2324dd2d8a8c28c7c91861afcb7afef8d6f90","object":{"supply_type":{"id":"supply_type"},"seller_establishment":{"id":"seller_establishment"},"destination_member_state":{"id":"destination_member_state"}}},
  },
  'art-164-vida-compliance-readiness-diagnostic': {
    // wrapper: run (sha256 bbd4651c386a…, WEBMCP-WRAPPER-PARSE-1 probe-verified)
    "entity": {"source":"parsed-from-wrapper","wrapper_digest":"bbd4651c386a7172e3fb4106e7e2324dd2d8a8c28c7c91861afcb7afef8d6f90","object":{"einvoice_ready":{"id":"einvoice_ready","coerce":"boolean"},"drr_ready":{"id":"drr_ready","coerce":"boolean"},"platform_assessed":{"id":"platform_assessed","coerce":"boolean"},"platform_not_applicable":{"id":"platform_not_applicable","coerce":"boolean"},"oss_scheme_configured":{"id":"oss_scheme_configured","coerce":"boolean"},"oss_not_applicable":{"id":"oss_not_applicable","coerce":"boolean"}}},
  },
  /* WEBMCP:DERIVED-MAP-END */
};

// Derived-map entry shape (WEBMCP-WRAPPER-PARSE-1): every property entry carries
// `source: 'parsed-from-wrapper'` and `wrapper_digest` (sha256 of the wrapper
// body the binding was parsed from). `verifyPageMapping` ignores derived entries
// (no element_id/via — the literal-id guard applies to them unchanged, so
// emission is untouched); `--check` re-parses each derived page and refuses on
// wrapper-byte drift (digest mismatch) or entry drift — drift is red, never silent.
export const DERIVED_MAP_BEGIN = '/* WEBMCP:DERIVED-MAP-BEGIN (generated by --derive-map --write, WEBMCP-WRAPPER-PARSE-1; hand-edits are red) */';
export const DERIVED_MAP_END = '/* WEBMCP:DERIVED-MAP-END */';

// ── Guard helpers ─────────────────────────────────────────────────────────────

function fail(msg) {
  console.error('GEN-ERROR: ' + msg);
  process.exit(1);
}

export function loadManifestFor(toolId, manifestIndex, mcpNameByTool, repoRoot) {
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

// RULINGS 2026-09-10T20:30:44Z (MCP-SCHEMA-CONFORMANCE-1): the seven legal JSON
// Schema type names. A property with NO `type` keyword is legal (valid 2020-12,
// accepts any JSON) and maps via the 'string' via (`.value = String(params.p)`) —
// exactly as the legacy `unknown` did; a `type` that names anything else is refused.
export const LEGAL_TYPE_NAMES = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
const LEGAL_TYPE_SET = new Set(LEGAL_TYPE_NAMES);

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
    if (!v || typeof v !== 'object' || Array.isArray(v)) return `inputSchema property '${k}' is not a schema object`;
    if (!('type' in v)) continue; // typeless: legal JSON Schema (RULINGS 2026-09-10T20:30:44Z); 'string' via by default
    const names = Array.isArray(v.type) ? v.type : [v.type];
    const bad = names.filter((n) => !LEGAL_TYPE_SET.has(n));
    if (bad.length) {
      const rendered = bad.map((n) => (typeof n === 'string' ? `'${n}'` : JSON.stringify(n))).join(', ');
      return `inputSchema property '${k}' has illegal type name ${rendered} — legal names: ${LEGAL_TYPE_NAMES.join(' ')}`;
    }
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
    // WEBMCP-WRAPPER-PARSE-1: derived entries (source: 'parsed-from-wrapper')
    // carry no element_id/via — they are NOT authored mappings and are never
    // consulted for emission; the literal-id guard applies to them unchanged.
    const target = map[p] && map[p].element_id ? map[p].element_id : p;
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
 * TOOLPAGE-DEEPLINK-1: the page's deep-link prefill table, derived from the SAME
 * mapping decisions as mappingLine (authored propertyIdMap entry first, literal-id
 * + type-shape default second) — never a re-derivation. Emitted as a JSON literal
 * inside the page's deep-link reader (buildDeeplinkScript).
 */
function deeplinkPrefillTable(manifest, idMap) {
  const props = Object.entries(manifest.mcp_tool_definition.inputSchema.properties);
  const map = idMap || {};
  const table = {};
  for (const [name, spec] of props) {
    const entry = map[name];
    let via;
    if (entry) via = entry.via;
    else if (spec.type === 'boolean') via = 'checked';
    else if (spec.type === 'array' || spec.type === 'object') via = 'json';
    else via = 'string';
    table[name] = [entry ? entry.element_id : name, via];
  }
  return JSON.stringify(table);
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
  // TOOLPAGE-DEEPLINK-1: the fragment-only prefill-and-run deep-link reader rides
  // in the SAME marked region (one region per page keeps regionOf/insertIntoPage/
  // runCheck byte-exact machinery unchanged). Source of truth: buildDeeplinkScript
  // in chaingraph/_page-chrome.mjs; prefill table = this file's mapping decisions.
  lines.push('');
  lines.push('<script>');
  lines.push(buildDeeplinkScript(deeplinkPrefillTable(manifest, map), target));
  lines.push('</script>');
  // TOOLPAGE-FILE-IMPORT-1: the zero-upload file-import reader (drop zone +
  // picker) rides in the SAME marked region, sharing the prefill table and the
  // verified run target. Source of truth: buildFileImportScript in _page-chrome.mjs.
  lines.push('');
  lines.push('<script>');
  lines.push(buildFileImportScript(deeplinkPrefillTable(manifest, map), target));
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

// MCP-SCHEMA-CONFORMANCE-1 TRANSITION (removed in PR-5 with the rest of the
// transition): until the 498-manifest sweep lands in slices, a generator-owned
// manifest may still be rendered under the LEGACY rule — `"type": "unknown"` as
// the no-evidence type inside mcp_tool_definition.inputSchema. `unknown` is the
// legacy rendering of a typeless property (same 'string' via), so such a manifest
// stays in the emittable set — the registered set cannot drop mid-transition.
// The strict law lives in checkManifestShape (the selftest's RED control proves
// it reds on `unknown`); this tolerance only ever fires for provenance-owned
// manifests (either mark) whose sole type-law defect is the legacy `unknown`.
function legacyUnknownShapeOnly(m) {
  const prov = m?.input_schema_provenance ?? m?.input_schema?.x_schema_provenance;
  if (!/^derived-from-kernel-reads \d{4}-\d{2}-\d{2}$/.test(prov || '')) return false;
  const bad = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    if ('type' in node) {
      const names = Array.isArray(node.type) ? node.type : [node.type];
      for (const n of names) if (n !== 'unknown' && !LEGAL_TYPE_SET.has(n)) bad.push(n);
    }
    if (node.items) walk(node.items);
    if (node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)) {
      for (const sub of Object.values(node.properties)) walk(sub);
    }
  };
  walk(m?.mcp_tool_definition?.inputSchema);
  return bad.length === 0;
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
  if (shapeErr && !(shapeErr.includes('illegal type name') && legacyUnknownShapeOnly(loaded.m))) {
    return { toolId, ok: false, reason: `manifest ${loaded.file}: ${shapeErr}` };
  }
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

// ── Triage (WEBMCP-EXCLUSION-TRIAGE-1 — report only, never a binding) ────────

/** Lowercase, strip `_`/`-`, strip a leading `in`/`inp` prefix. */
export function normaliseName(s) {
  let n = String(s).toLowerCase().replace(/[_-]/g, '');
  if (n.startsWith('inp')) n = n.slice(3);
  else if (n.startsWith('in')) n = n.slice(2);
  return n;
}

/** Schema kind for a property spec: enum | array | object | scalar. */
export function schemaKind(spec) {
  if (Array.isArray(spec?.enum)) return 'enum';
  if (spec?.type === 'array') return 'array';
  if (spec?.type === 'object') return 'object';
  return 'scalar';
}

function elementIdsOnPage(pageSrc) {
  const ids = [];
  const re = /\bid=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(pageSrc)) !== null) ids.push(m[1]);
  return ids;
}

/**
 * One triage record for one "form-element mapping incomplete" page.
 * HEURISTIC REPORTING ONLY: `candidates` are name-similarity hints for the
 * human authoring a propertyIdMap; nothing here is ever bound automatically.
 */
export function triagePage(manifest, pageSrc) {
  const def = manifest.mcp_tool_definition;
  const ids = elementIdsOnPage(pageSrc);
  const props = Object.entries(def.inputSchema.properties);
  const present = new Set(props.filter(([p]) => ids.includes(p)).map(([p]) => p));
  const missingProps = props.filter(([p]) => !present.has(p)).map(([prop, spec]) => {
    const kind = schemaKind(spec);
    const norm = normaliseName(prop);
    const candidates = kind === 'array' || kind === 'object' ? [] : ids.filter((id) => {
      const ni = normaliseName(id);
      return ni === norm || ni.includes(norm);
    });
    return { prop, kind, candidates };
  });
  const hasJsonTextarea = /<textarea\b[^>]*\b(id|name)=["'][^"']*json[^"']*["']/i.test(pageSrc);
  const fn = manifest.execution?.function_name || '';
  const fnMatch = new RegExp(`function\\s+${fn}\\s*\\(([^)]*)\\)`).exec(pageSrc);
  const fnIsParametered = !!(fnMatch && fnMatch[1].trim().length > 0);
  const anyAggregate = missingProps.some((p) => p.kind === 'array' || p.kind === 'object');
  const anyZero = missingProps.some((p) => (p.kind === 'scalar' || p.kind === 'enum') && p.candidates.length === 0);
  const allSingle = missingProps.every((p) => p.candidates.length === 1);
  const bucket = anyAggregate ? 'AGGREGATE' : anyZero ? 'VOCAB-DIVERGENT' : allSingle ? 'RENAME-ONLY' : 'MIXED';
  return { missing_props: missingProps, has_json_textarea: hasJsonTextarea, fn_is_parametered: fnIsParametered, bucket };
}

function runTriage(outFile) {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(REPO);
  const lines = [];
  for (const id of cleared) {
    const d = adjudicateTool(id, REPO, manifestIndex, mcpNameByTool);
    if (d.ok || !d.reason.includes('form-element mapping incomplete')) continue;
    const loaded = loadManifestFor(id, manifestIndex, mcpNameByTool, REPO);
    if (loaded.error) { console.error(`TRIAGE-SKIP ${id}: ${loaded.error}`); continue; }
    const pageSrc = readFileSync(resolve(REPO, `chaingraph/${id}.html`), 'utf8');
    const rec = { tool_id: id, ...triagePage(loaded.m, pageSrc) };
    lines.push(JSON.stringify(rec));
  }
  const counts = {};
  for (const l of lines) { const b = JSON.parse(l).bucket; counts[b] = (counts[b] || 0) + 1; }
  const summary = `triage: ${lines.length} mapping-incomplete page(s) — ` +
    Object.entries(counts).sort().map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(summary);
  if (outFile) {
    writeFileSync(resolve(outFile), lines.join('\n') + '\n', 'utf8');
    console.log(`wrote ${lines.length} JSON line(s) to ${outFile}`);
  } else {
    lines.forEach((l) => console.log(l));
  }
}



// ── Chain composer mode (COMPOSER-PLAN-AND-ROOT-WEBMCP-1) ────────────────────
// Three honest WebMCP tools on EVERY chain composer page (chaingraph/chains/*.html):
//   plan_chain               — returns the page's existing §4 chain-definition PLAN
//                              artifact (buildArtifact output); never a run.
//   assemble_session_receipt — SHA-256 Merkle root over an ordered hash list; the
//                              page-side port of the worker's build_session_receipt
//                              (worker.mjs buildSessionReceiptCore, ~line 2996).
//   apply_delegation_bundle  — validates the worker run_chain compute:"browser"
//                              bundle (worker.mjs, the compute:"browser" emitter,
//                              ~line 2233) and returns the ordered deep links,
//                              plus the chain's runner page when one exists.
// Tool names are FINAL (C9): plan_chain, assemble_session_receipt,
// apply_delegation_bundle. RUNNER-WORKER-FOLD-1 adds run_chain__<chain> beside
// them and never renames these.
//
// SINGLE ROUTINE LAW: ainSessionRoot below is THE session-root routine. The same
// bytes ship in scripts/ain-bridge-v1.snippet.html (v1.2, window.AINBridge.sessionRoot)
// for tool pages; chain pages get the identical bytes through this generated block.
// Never re-derive the Merkle rule anywhere else.

/** The session-root routine, verbatim as emitted (site + bridge SSOT). Port of
 *  worker.mjs buildSessionReceiptCore's Merkle fold: normalize (strip 'sha256:',
 *  lowercase), leaves 'sha256:'+hex, pair = SHA-256(hex(left)+hex(right)),
 *  duplicate last leaf when odd, root = 'sha256:'+hex. Async (WebCrypto). */
export const SESSION_ROOT_SOURCE = [
  "async function ainSessionRoot(executionHashes) {",
  "  if (!Array.isArray(executionHashes) || executionHashes.length === 0) throw new Error('execution_hashes must be a non-empty array.');",
  "  var normalize = function (h) { return String(h).replace(/^sha256:/, '').toLowerCase(); };",
  "  var level = executionHashes.map(normalize).map(function (h) { return 'sha256:' + h; });",
  "  var hashPair = async function (a, b) {",
  "    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalize(a) + normalize(b)));",
  "    return 'sha256:' + Array.from(new Uint8Array(buf)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');",
  "  };",
  "  while (level.length > 1) {",
  "    var next = [];",
  "    for (var i = 0; i < level.length; i += 2) {",
  "      var right = level[i + 1] !== undefined ? level[i + 1] : level[i]; // duplicate last leaf when odd",
  "      next.push(await hashPair(level[i], right));",
  "    }",
  "    level = next;",
  "  }",
  "  return level[0];",
  "}",
].join('\n');

/** Build the marker-delimited chain block for one composer page. Pure. */
export function buildChainBlock(chainName, hasRunner) {
  const runnerUrl = '../runners/' + chainName + '.html';
  const cfg = JSON.stringify({ chain_id: chainName, runner_url: hasRunner ? runnerUrl : null }, null, 2).replace(/\n/g, '\n    ');
  const lines = [];
  lines.push(`<!-- WEBMCP:GEN-BEGIN manifest=chain:${chainName} generator=scripts/gen-webmcp-registrations.mjs mode=chains -->`);
  lines.push('<script>');
  lines.push('// WebMCP registrations generated by scripts/gen-webmcp-registrations.mjs (chain mode,');
  lines.push(`// COMPOSER-PLAN-AND-ROOT-WEBMCP-1) for composer page chain:${chainName}. Feature-detected:`);
  lines.push('// absent API registers nothing, so the page stays byte-identical without the API.');
  lines.push('// All three tools are zero-server, zero-network, and read only page state or their');
  lines.push('// declared arguments. Trust annotations, truthful-hint posture: deterministic local');
  lines.push('// compute over page state or caller-supplied hashes, no untrusted content is fetched,');
  lines.push('// so untrustedContentHint is not applicable per tool (n/a); exposedTo intentionally');
  lines.push('// omitted: no cross-origin exposure. Tool names are FINAL (plan_chain,');
  lines.push('// assemble_session_receipt, apply_delegation_bundle).');
  lines.push('// Browser support (dated observation): WebMCP origin trial from Chrome 149');
  lines.push('// (May 2026) per developer.chrome.com/docs/ai/webmcp (retrieved 2026-09-01).');
  lines.push("const mc = document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null);");
  lines.push('if (mc) {');
  // The SSOT session-root routine (same bytes as the bridge snippet v1.2).
  lines.push(SESSION_ROOT_SOURCE);
  lines.push("  if (window.AINBridge) window.AINBridge.sessionRoot = ainSessionRoot;");
  lines.push('  mc.registerTool({');
  lines.push("    name: 'plan_chain',");
  lines.push(`    description: '${jsStr("Return this chain's OpenChainGraph section 4 chain definition plan artifact: the page's own deterministic SHA-256 hash over the canonical plan (chain id, ordered step tool ids and handoffs) exactly as the page computes and displays it, with the plan preimage attached. This is the plan, not a run: no step executes and no output payload is computed. The worker emits the same chain definition as chain_plan via build_chaingraph, and the fleet SSOT plan hash set is pinned in data/chain-plan-hashes.json.")}',`);
  lines.push('    inputSchema: { type: \'object\', required: [], properties: {} },');
  lines.push('    annotations: { readOnlyHint: true },');
  lines.push('    execute: async function(params) {');
  lines.push('      try {');
  lines.push('        // The page\'s own §4 plan artifact, no new computation. Template pages expose');
  lines.push('        // CHAIN_HASH + buildArtifact; legacy pages expose _artifact / _chainHash.');
  lines.push('        if (typeof CHAIN_HASH === \'string\' && CHAIN_HASH.length > 0 && typeof buildArtifact === \'function\') return buildArtifact(CHAIN_HASH);');
  lines.push("        if (typeof _artifact === 'object' && _artifact !== null && _artifact.execution_hash) return _artifact;");
  lines.push('        if (typeof _chainHash === \'string\' && _chainHash.length > 0 && typeof CHAIN_MANIFEST === \'object\' && CHAIN_MANIFEST) return {');
  lines.push("          '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',");
  lines.push("          'chaingraph_version': '0.4.0',");
  lines.push("          'compute_mode': 'browser',");
  lines.push("          'tool_id': 'chain:' + CHAIN_MANIFEST.chain_id,");
  lines.push("          'execution_hash': _chainHash,");
  lines.push("          'chain': { 'parent_hashes': [], 'parent_tool_ids': [], 'chain_depth': 0 },");
  lines.push("          'policy_parameters': { 'chain_id': CHAIN_MANIFEST.chain_id, 'version': CHAIN_MANIFEST.version, 'steps': CHAIN_MANIFEST.steps },");
  lines.push("          'output_payload': { 'chain_depth': CHAIN_MANIFEST.chain_depth, 'step_count': CHAIN_MANIFEST.steps.length, 'tool_ids': CHAIN_MANIFEST.steps.map(function (s) { return s.tool_id; }) },");
  lines.push("          'compliance_flags': ['CHAIN_DEFINITION_ANCHORED']");
  lines.push('        };');
  lines.push('        throw new Error(\'This composer page exposes no plan hash surface (CHAIN_HASH/buildArtifact or _chainHash/_artifact); page template and generated block have drifted.\');');
  lines.push('      } catch (err) {');
  lines.push("        return { error: 'compute_failed', detail: String((err && err.message) || err) };");
  lines.push('      }');
  lines.push('    }');
  lines.push('  });');
  lines.push('  mc.registerTool({');
  lines.push("    name: 'assemble_session_receipt',");
  lines.push(`    description: '${jsStr("Assemble a session receipt: one deterministic SHA-256 Merkle root over an ordered list of execution_hash values, byte-identical to the worker build_session_receipt tool (same normalize, pair, and odd-leaf rules). Collect hashes from any ChainGraph tools run in this session, in call order, and this returns the tamper-evident root that aggregates them.")}',`);
  lines.push('    inputSchema: { type: \'object\', required: [\'execution_hashes\'], properties: { execution_hashes: { type: \'array\', description: \'Ordered execution_hash values (lowercase 64-hex, optional sha256: prefix) from ChainGraph tool calls in this session, in call order. Minimum 1.\' } } },');
  lines.push('    annotations: { readOnlyHint: true },');
  lines.push('    execute: async function(params) {');
  lines.push('      try {');
  lines.push("        if (!Array.isArray(params.execution_hashes)) throw new Error('execution_hashes must be an array; received ' + JSON.stringify(params.execution_hashes) + '.');");
  lines.push('        var session_receipt_root = await ainSessionRoot(params.execution_hashes);');
  lines.push('        return {');
  lines.push("          receipt_type: 'session_receipt',");
  lines.push('          session_receipt_root: session_receipt_root,');
  lines.push('          hash_count: params.execution_hashes.length,');
  lines.push('          execution_hashes: params.execution_hashes,');
  lines.push("          merkle_algorithm: 'SHA-256 binary tree, duplicate-last-leaf padding',");
  lines.push("          spec: 'ChainGraph Standard v0.4 section C',");
  lines.push("          note: 'Root computed client-side; identical to the worker build_session_receipt root over the same ordered hashes.'");
  lines.push('        };');
  lines.push('      } catch (err) {');
  lines.push("        return { error: 'compute_failed', detail: String((err && err.message) || err) };");
  lines.push('      }');
  lines.push('    }');
  lines.push('  });');
  lines.push('  mc.registerTool({');
  lines.push("    name: 'apply_delegation_bundle',");
  lines.push(`    description: '${jsStr("Apply a zero-egress browser delegation bundle returned by the worker run_chain tool with compute browser: validate the bundle schema and return the ordered step deep links for in-browser execution. No step is executed here; run the links in order and thread each execution_hash forward, or open this chain's live runner page when one is offered.")}',`);
  lines.push('    inputSchema: { type: \'object\', required: [\'bundle\'], properties: { bundle: { type: \'object\', description: \'The run_chain compute browser delegation bundle (mode browser_delegation, chain, steps with order/tool_id/browser_url).\' } } },');
  lines.push('    annotations: { readOnlyHint: true },');
  lines.push('    execute: async function(params) {');
  lines.push('      try {');
  lines.push("        var b = params.bundle;");
  lines.push("        if (b === null || typeof b !== 'object' || Array.isArray(b)) throw new Error('bundle must be a JSON object; received ' + JSON.stringify(b) + '.');");
  lines.push("        if (b.mode !== 'browser_delegation') throw new Error('bundle.mode must be browser_delegation; received ' + JSON.stringify(b.mode) + '.');");
  lines.push("        if (!Array.isArray(b.steps) || b.steps.length === 0) throw new Error('bundle.steps must be a non-empty array; received ' + JSON.stringify(b.steps) + '.');");
  lines.push('        var links = b.steps.map(function (s, i) {');
  lines.push("          if (s === null || typeof s !== 'object') throw new Error('bundle.steps[' + i + '] must be an object.');");
  lines.push("          if (typeof s.tool_id !== 'string' || s.tool_id.length === 0) throw new Error('bundle.steps[' + i + '].tool_id must be a non-empty string.');");
  lines.push("          if (typeof s.browser_url !== 'string' || s.browser_url.length === 0) throw new Error('bundle.steps[' + i + '].browser_url must be a non-empty string.');");
  lines.push("          return { order: typeof s.order === 'number' ? s.order : i + 1, tool_id: s.tool_id, browser_url: s.browser_url };");
  lines.push('        });');
  lines.push('        var runner = ' + JSON.stringify(hasRunner ? runnerUrl : null) + ';');
  lines.push('        return {');
  lines.push('          ok: true,');
  lines.push("          compute_mode: 'browser',");
  lines.push('          chain: b.chain !== undefined ? b.chain : ' + JSON.stringify(chainName) + ',');
  lines.push('          composer_url: typeof b.composer_url === \'string\' ? b.composer_url : null,');
  lines.push('          step_count: links.length,');
  lines.push('          links: links,');
  lines.push('          runner_url: runner,');
  lines.push('          note: runner');
  lines.push("            ? 'Steps validated. Run the ordered links in the browser, or open the live runner page for this chain: ' + runner + '. No step is executed by this tool.'");
  lines.push("            : 'Steps validated. Run the ordered links in the browser in order and thread each execution_hash forward. No step is executed by this tool.'");
  lines.push('        };');
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

/** Chain-mode writer/check over every chain in chaingraph.json that has a
 *  composer page on disk. Returns the per-page verdict list. */
export function expectedChainBlocks(repoRoot) {
  const cg = JSON.parse(readFileSync(resolve(repoRoot, 'chaingraph', 'chaingraph.json'), 'utf8'));
  const out = [];
  for (const chain of (cg.chains ?? [])) {
    if (!chain.name) continue;
    const pageRel = `chaingraph/chains/${chain.name}.html`;
    const pageAbs = resolve(repoRoot, pageRel);
    if (!existsSync(pageAbs)) continue;
    const hasRunner = existsSync(resolve(repoRoot, 'chaingraph', 'runners', `${chain.name}.html`));
    out.push({ chain: chain.name, page: pageRel, hasRunner, block: buildChainBlock(chain.name, hasRunner) });
  }
  return out;
}

function runChainMode(write) {
  const entries = expectedChainBlocks(REPO);
  const ot = readOtToken(REPO);
  const otBlock = ot.present ? otMetaBlock(ot.token) : null;
  let written = 0, drifted = 0;
  for (const e of entries) {
    const pageAbs = resolve(REPO, e.page);
    const src = readFileSync(pageAbs, 'utf8');
    const updated = applyOtMeta(insertIntoPage(src, e.block), otBlock);
    if (updated !== src) {
      if (!write) { drifted++; console.error(`DRIFT ${e.page}: chain registration region missing or stale (run with --write)`); continue; }
      writeFileSync(pageAbs, updated);
      written++;
      console.log(`wrote ${e.page} (chain registrations: plan_chain, assemble_session_receipt, apply_delegation_bundle${e.hasRunner ? '; runner link in cfg' : ''}${ot.present ? '; OT meta in head' : ''})`);
    }
  }
  if (!write) {
    if (drifted > 0) {
      console.error(`\nchain-mode check FAILED: ${drifted} of ${entries.length} composer page(s) drifted.`);
      process.exit(1);
    }
    console.log(`✓ chain-mode check clean: ${entries.length} composer page(s) carry byte-exact chain registration regions.`);
  } else {
    console.log(`\nchain-mode write: ${written} page(s) updated, ${entries.length - written} already byte-exact.`);
  }
}

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
  const runCheckInner = async () => {
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
    // bug (or an exact-match escape) is a distinct, diagnosable red. The region
    // carries TWO scripts since TOOLPAGE-DEEPLINK-1 (registration + deep-link
    // reader) — parse each separately.
    const scriptBodies = [...actual.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const scriptBody of scriptBodies) {
      try { new Function(scriptBody); } catch (e) {
        problems.push(`${d.page}: generated region does not parse as JavaScript: ${e.message}`);
      }
    }
  }
  // 2. Every generated region on disk still corresponds to an emittable tool.
  // Chain composer pages (chaingraph/chains/*) carry chain-mode regions instead of
  // manifest-driven node blocks; they are verified byte-exact in section 3 below.
  const emittablePages = new Set(emittable.map((d) => d.page));
  for (const p of listPages(REPO)) {
    let pageSrc;
    try { pageSrc = readRepoFile(p, REPO); } catch { continue; }
    if (!pageSrc.includes(BEGIN)) continue;
    if (p.startsWith('chaingraph/chains/')) continue;
    if (!emittablePages.has(p)) {
      problems.push(`${p}: carries a generated WebMCP region but is not in today's emittable set (schema or mapping changed) — regenerate or remove the region`);
    }
  }
  // 3. Chain composer pages (COMPOSER-PLAN-AND-ROOT-WEBMCP-1): byte-exact
  // chain-mode regions (plan_chain, assemble_session_receipt, apply_delegation_bundle).
  for (const e of expectedChainBlocks(REPO)) {
    let pageSrc;
    try { pageSrc = readRepoFile(e.page, REPO); } catch { continue; }
    const region = regionOf(pageSrc);
    if (!region) {
      problems.push(`${e.page}: no generated chain registration region (expected for chain '${e.chain}')`);
      continue;
    }
    const actual = pageSrc.slice(region.start, region.end);
    if (actual !== e.block) {
      problems.push(`${e.page}: chain registration region drifted — hand-edits are red; run node scripts/gen-webmcp-registrations.mjs --chains --write`);
      continue;
    }
    const chainScripts = [...actual.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const scriptBody of chainScripts) {
      try { new Function(scriptBody); } catch (err) {
        problems.push(`${e.page}: chain registration region does not parse as JavaScript: ${err.message}`);
      }
    }
  }

  // 4. Derived pages (WEBMCP-WRAPPER-PARSE-1): committed derived entries are
  // re-parsed and re-probed against fixture 0 — wrapper-byte drift, entry
  // drift, or a failed probe is RED, never silent.
  await checkDerivedEntries(manifestIndex, mcpNameByTool, (p) => problems.push(p));
  // 4. OT token gate + meta region freshness (WEBMCP-OT-META-1). The expiry
  // check IS the renewal alarm: main goes RED 14 days before expiry and the
  // nightly opener surfaces it — no cron, no workflow.
  const ot = readOtToken(REPO);
  if (ot.present) {
    const reasons = otTokenGateErrors(ot.token);
    if (reasons.length > 0) {
      console.error('✗ OT token gate FAILED (WEBMCP-OT-META-1):');
      reasons.forEach((r) => console.error('    ' + r));
      process.exit(1);
    }
    const days = ((decodeOtToken(ot.token).payload.expiry * 1000 - Date.now()) / 86400000).toFixed(1);
    console.log(`✓ OT token gate GREEN — origin https://ainumbers.co (subdomain match), feature WebMCP, expiry ${days} days out (floor ${OT_MIN_DAYS}).`);
  } else {
    console.log('ADVISORY: OT-TOKEN ABSENT — no origin-trial meta emitted; pages stay byte-identical (paste a real token to chaingraph/webmcp-ot-token.txt).');
  }
  if (ot.present) {
    const expectedOt = otMetaBlock(ot.token);
    for (const p of listPages(REPO)) {
      let pageSrc;
      try { pageSrc = readRepoFile(p, REPO); } catch { continue; }
      if (!pageSrc.includes(BEGIN)) continue; // only generator-owned pages; pilot pages are another row's
      const region = otMetaRegionOf(pageSrc);
      if (!region) {
        problems.push(`${p}: no origin-trial meta region in <head> (token present) — run node scripts/gen-webmcp-registrations.mjs --all --write and node scripts/gen-webmcp-registrations.mjs --chains --write`);
        continue;
      }
      if (pageSrc.slice(region.start, region.end) !== expectedOt) {
        problems.push(`${p}: origin-trial meta region drifted from chaingraph/webmcp-ot-token.txt — regenerate with --write`);
      }
    }
  }

  if (problems.length) {
    console.error(`✗ webmcp-registration freshness FAILED (${problems.length}):`);
    problems.forEach((p) => console.error('    ' + p));
    process.exit(1);
  }
  const chainCount = expectedChainBlocks(REPO).length;
  const derivedTools = Object.entries(propertyIdMap).filter(([, m]) => derivedEntriesOf(m).length).length;
  console.log(`✓ webmcp-registration freshness clean — ${emittable.length} generated registration(s) byte-exact vs their manifests, ${chainCount} chain composer page(s) byte-exact in chain mode, ${derivedTools} derived-map page(s) re-parsed and probe-verified vs fixture 0; ${excluded.length} sweep-cleared tool(s) excluded with reasons (shrinks as fix rows land).`);
  excluded.forEach((e) => console.log(`  EXCLUDED ${e.id}: ${e.reason}`));
  };
  return runCheckInner();
}

function runReportOrWrite(write, onlyTool) {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(REPO);
  const ot = readOtToken(REPO);
  const otBlock = ot.present ? otMetaBlock(ot.token) : null;
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
      // WEBMCP-OT-META-1: the <head> OT meta region rides the same write pass.
      const next = applyOtMeta(insertIntoPage(pageSrc, block), otBlock);
      if (next !== pageSrc) { writeFileSync(pageAbs, next, 'utf8'); emitted++; console.log(`✓ wrote ${d.detail.page} (name: ${d.detail.name}${ot.present ? '; OT meta in head' : ''})`); }
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

// ── Directory manifest emitter (WEBMCP-MANIFEST-1) ───────────────────────────
/**
 * `--manifest`: emits `/.well-known/webmcp.json` FROM the live registration set
 * (the same adjudication the page emitter uses), so the directory listing can
 * never claim a tool the pages do not register. Shape is deliberately minimal —
 * no cross-directory standard exists yet (WEBMCP-AGENT-SHOWCASE-PROMPTS
 * 2026-09-05 §9 #15): one entry per registered page (page URL, tool name,
 * description, sha256 of the inputSchema JSON, annotations) plus a top-level
 * `origin_trial` field read from the OT gate (chaingraph/webmcp-ot-token.txt,
 * landed by WEBMCP-OT-META-1 #1726), so the manifest states the token status
 * truthfully rather than promising trial coverage.
 *
 * Modes:
 *   node scripts/gen-webmcp-registrations.mjs --manifest            (print)
 *   node scripts/gen-webmcp-registrations.mjs --manifest --write    (regen)
 *   node scripts/gen-webmcp-registrations.mjs --manifest --check    (freshness;
 *       drift vs the live registration set is RED — wired into preflight and
 *       registered in derived-artifacts.mjs COVERED id 'webmcp-manifest')
 *
 * Deterministic by construction: no timestamps, no wall clock — two passes over
 * the same tree are byte-identical (the idempotency property the COVERED
 * registration requires). ⛔ The generated file itself is NOT committed by a
 * PR: `.well-known/webmcp.json` is a SO #35 single-writer artifact written by
 * derived-artifacts-regen.yml on main.
 */
export const MANIFEST_REL = '.well-known/webmcp.json';
export const SITE_ORIGIN = 'https://ainumbers.co';
export const OT_TOKEN_REL = 'chaingraph/webmcp-ot-token.txt';

/** Truthful OT-token status: 'first-party token present' | 'absent'. */
export function otTokenStatus(repoRoot) {
  return existsSync(resolve(repoRoot || REPO, OT_TOKEN_REL))
    ? 'first-party token present'
    : 'absent';
}

/** sha256 over the compact JSON encoding of the manifest's inputSchema. */
export function inputSchemaSha256(inputSchema) {
  return createHash('sha256').update(JSON.stringify(inputSchema), 'utf8').digest('hex');
}

/** One directory entry per emittable (registered) page. */
export function buildDirectoryEntries(repoRoot) {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(repoRoot || REPO);
  const entries = [];
  for (const id of cleared) {
    const d = adjudicateTool(id, repoRoot || REPO, manifestIndex, mcpNameByTool);
    if (!d.ok) continue; // excluded tools are not registered anywhere, so they are not listed
    const loaded = loadManifestFor(id, manifestIndex, mcpNameByTool, repoRoot || REPO);
    if (loaded.error) throw new Error(loaded.error);
    const def = loaded.m.mcp_tool_definition;
    entries.push({
      url: `${SITE_ORIGIN}/chaingraph/${id}.html`,
      name: def.name,
      description: def.description,
      input_schema_sha256: inputSchemaSha256(def.inputSchema),
      annotations: { readOnlyHint: true },
    });
  }
  return entries;
}

/** Full file bytes: stable key order, 2-space indent, trailing newline.
 *  `directoryJsonFromEntries` is the pure half (selftest-friendly, no live-set
 *  sweep); `buildDirectoryJson` derives the entries from the live set itself. */
export function directoryJsonFromEntries(entries, repoRoot) {
  const doc = {
    origin_trial: otTokenStatus(repoRoot),
    tools: entries,
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

export function buildDirectoryJson(repoRoot) {
  return directoryJsonFromEntries(buildDirectoryEntries(repoRoot), repoRoot);
}

function runManifest(write, check) {
  const expected = buildDirectoryJson(REPO);
  const abs = resolve(REPO, MANIFEST_REL);
  if (check) {
    if (!existsSync(abs)) {
      console.error(`✗ webmcp.json freshness FAILED: ${MANIFEST_REL} absent — run node scripts/gen-webmcp-registrations.mjs --manifest --write`);
      process.exit(1);
    }
    const actual = readFileSync(abs, 'utf8');
    if (actual !== expected) {
      const a = JSON.parse(actual);
      const e = JSON.parse(expected);
      console.error(`✗ webmcp.json freshness FAILED: ${MANIFEST_REL} drifted from the live registration set ` +
        `(on disk: ${a.tools.length} tool(s), origin_trial ${JSON.stringify(a.origin_trial)}; live set: ${e.tools.length} tool(s), origin_trial ${JSON.stringify(e.origin_trial)}) — run node scripts/gen-webmcp-registrations.mjs --manifest --write`);
      process.exit(1);
    }
    console.log(`✓ webmcp.json freshness clean — ${JSON.parse(actual).tools.length} entr(ies) byte-exact vs the live registration set; origin_trial ${JSON.stringify(JSON.parse(actual).origin_trial)}.`);
    return;
  }
  if (write) {
    const existing = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    if (existing === expected) {
      console.log(`${MANIFEST_REL} already byte-exact (${JSON.parse(expected).tools.length} entr(ies)) — no write (idempotent).`);
      return;
    }
    writeFileSync(abs, expected, 'utf8');
    console.log(`✓ wrote ${MANIFEST_REL} (${JSON.parse(expected).tools.length} entr(ies), origin_trial ${JSON.stringify(JSON.parse(expected).origin_trial)})`);
    return;
  }
  process.stdout.write(expected);
}

// ── Wrapper-binding parser (WEBMCP-WRAPPER-PARSE-1) ──────────────────────────
/**
 * Static parse of a page's own no-arg wrapper: the wrapper reads controls by id
 * and passes a manifest-shaped object to the parametered execution fn. Parsing
 * those bytes yields an explicit per-tool propertyIdMap entry set — derived from
 * the page's own code (never a name heuristic), diff-visible like an authored
 * entry, and verified page-by-page by the fixture-hash probe below. A page that
 * fails the parse or the probe is EXCLUDED with a per-page reason, never a
 * program halt. Zero dependencies: a hand-rolled tokenizer over the wrapper
 * text (the findWrapperName brace-walk is the in-repo pattern). Only code
 * structure is matched — no regex over property NAMES anywhere in the binding
 * path (the WEBMCP-GEN-IDMAP-1 ruling).
 */

/** Skip a string/template literal starting at `src[i]` (a quote char). */
function skipStr(src, i) {
  const q = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === q) return i + 1;
    i++;
  }
  return i;
}

/** Balanced-span walker (strings/comments-aware). `src[i]` must be the opener. */
function balancedSpan(src, openIdx) {
  const pairs = { '{': '}', '(': ')', '[': ']' };
  const open = src[openIdx];
  if (!(open in pairs)) return null;
  const close = pairs[open];
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') { i = skipStr(src, i); continue; }
    if (c === '/' && src[i + 1] === '/') { const n = src.indexOf('\n', i); if (n === -1) return null; i = n + 1; continue; }
    if (c === '/' && src[i + 1] === '*') { const n = src.indexOf('*/', i + 2); if (n === -1) return null; i = n + 2; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return { start: openIdx, end: i + 1 }; }
    i++;
  }
  return null;
}

/** The wrapper's body span: zero-arg `function <name>() { ... }` (G3b shape). */
export function wrapperSpan(pageSrc, wrapperName) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${wrapperName}\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  let m;
  while ((m = re.exec(pageSrc)) !== null) {
    if (m[1].trim() !== '') continue;
    const span = balancedSpan(pageSrc, m.index + m[0].length - 1);
    if (span) return span;
  }
  return null;
}

/** Split `text` on top-level commas (strings/templates/nesting aware). */
function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') { i = skipStr(text, i); continue; }
    if (c === '/' && text[i + 1] === '/') { const n = text.indexOf('\n', i); if (n === -1) break; i = n + 1; continue; }
    if (c === '/' && text[i + 1] === '*') { const n = text.indexOf('*/', i + 2); if (n === -1) return null; i = n + 2; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === sep && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
    i++;
  }
  parts.push(text.slice(start));
  return parts;
}

/** Does the page define a `$` helper that resolves ids (defined on the same page)? */
export function dollarHelperDetected(pageSrc) {
  const fn = pageSrc.match(/function\s+\$\s*\([^)]*\)\s*\{/);
  if (fn) {
    const sp = balancedSpan(pageSrc, fn.index + fn[0].length - 1);
    if (sp && /getElementById\s*\(|querySelector\s*\(\s*['"]#/.test(pageSrc.slice(sp.start, sp.end))) return true;
  }
  const arrow = pageSrc.match(/(?:const|let|var)\s+\$\s*=\s*\(([^)]*)\)\s*=>/);
  if (arrow) {
    const tail = pageSrc.slice(arrow.index, arrow.index + 200);
    if (/getElementById\s*\(|querySelector\s*\(\s*['"]#/.test(tail)) return true;
  }
  return false;
}

/** All DOM reads of the accepted forms inside `expr`. */
function domReads(expr, dollar) {
  const re = new RegExp(
    `document\\.getElementById\\(\\s*(['"])([^'"\\n]+)\\1\\s*\\)` +
    `|document\\.querySelector\\(\\s*(['"])#([^'"\\n]+)\\3\\s*\\)` +
    (dollar ? `|\\$\\(\\s*(['"])([^'"\\n]+)\\5\\s*\\)` : ''),
    'g');
  const reads = [];
  let m;
  while ((m = re.exec(expr)) !== null) {
    const id = m[2] !== undefined ? m[2] : (m[4] !== undefined ? m[4] : m[6]);
    reads.push({ id, start: m.index, end: m.index + m[0].length });
  }
  return reads;
}


/** Classify ONE property value expression into an entry (or a refusal kind).
 *  The remainder after the single distinct DOM read must be a benign
 *  normalization (method chains, `||`/`??` literal defaults, Number/parseFloat/
 *  JSON.parse wrappers, emptyness-guard ternaries) — anything referencing
 *  another identifier or an operator outside the allowlist is `computed`.
 *  The probe, not the classifier, verifies the value survives the chain: a
 *  reading that corrupts the preimage fails the fixture hash and stays excluded. */
function classifyValueExpr(expr, dollar, scope) {
  for (let hop = 0; hop <= 2; hop++) {
    const r = classifyCore(expr, dollar);
    if (r.kind !== 'computed' || !scope) return r;
    // helper-local identifiers (`const tv = ...value;` in the same scope):
    // substitute the local's RHS (itself a single-read benign expression) and
    // re-classify — one hop, bounded.
    let substituted = false;
    const toks = [...new Set([...expr.matchAll(/[A-Za-z_$][\w$]*/g)].map((mm) => mm[0]))];
    for (const tok of toks) {
      if (/^(?:document|window|Number|parseFloat|String|JSON|Math|undefined|null|true|false)$/.test(tok)) continue;
      const rhs = assignmentRhs(scope, tok);
      if (!rhs || rhs.includes(tok)) continue;
      const nr = classifyCore(rhs, dollar);
      if (nr.kind === 'bind' || nr.kind === 'constant') {
        expr = expr.replace(new RegExp(`\\b${tok}\\b`, 'g'), rhs);
        substituted = true;
      }
    }
    if (!substituted) return r;
  }
  return { kind: 'computed' };
}

function classifyCore(expr, dollar) {
  const t = expr.trim();
  const reads = domReads(t, dollar);
  if (reads.length === 0) return { kind: 'constant' };
  const distinct = new Set(reads.map((r) => r.id));
  if (distinct.size > 1) return { kind: 'multi' };
  const id = reads[0].id;
  // remove every DOM read occurrence (all abuse the same control), then strip
  // the accepted structural tokens around them; anything left names another
  // identifier or an operator outside the allowlist (computed value)
  let rest = t;
  for (const rr of [...reads].sort((a, b) => b.start - a.start)) {
    rest = rest.slice(0, rr.start) + ' ' + rest.slice(rr.end);
  }
  rest = rest.replace(/-?\d+(?:\.\d+)?/g, ' ');
  rest = rest.replace(/(?:['"`])(?:\\.|[^'"`\\])*['"`]/g, ' ');
  rest = rest.replace(/\b(?:Number|parseFloat|String|JSON|undefined|null|true|false)\b/g, ' ');
  rest = rest.replace(/\.(?:parse|trim|toUpperCase|toLowerCase|value|checked)\b/g, ' ');
  rest = rest.replace(/\|\||&&|\?\?|===|!==|==|!=/g, ' ');
  rest = rest.replace(/[\s?():.,[\]]/g, '');
  if (rest.length > 0) return { kind: 'computed' };
  if (/JSON\s*\.\s*parse/.test(t)) return { kind: 'bind', entry: { json: id } };
  const rereads = domReads(t, dollar);
  const checkedOnly = rereads.every((rr) => {
    const after = t.slice(rr.end).trim();
    return after === '' || after.startsWith('.checked') || after.startsWith('?.checked');
  });
  if (/checked/.test(t) && checkedOnly) return { kind: 'bind', entry: { id, coerce: 'boolean' } };
  const numWrap = /\b(?:Number|parseFloat)\s*\(/.test(t);
  return { kind: 'bind', entry: numWrap ? { id, coerce: 'number' } : { id } };
}

/** Parse a plain object literal's top-level `key: expr` members. */
function parseObjectLiteralProps(lit) {
  const props = new Map();
  const bad = [];
  const parts = splitTopLevel(lit, ',');
  if (!parts) return null;
  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    if (t.startsWith('...')) { bad.push(t.slice(0, 40)); continue; }
    const m = t.match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/);
    if (m) { props.set(m[1], m[2].trim()); continue; }
    if (/^[A-Za-z_$][\w$]*$/.test(t)) { props.set(t, t); continue; }
    bad.push(t.slice(0, 40));
  }
  return { props, bad };
}

/** RHS of `const|let|var <name> = ... ;` inside `text` (depth-aware). */
function assignmentRhs(text, name) {
  const re = new RegExp(`(?:const|let|var)\\s+${name}\\s*=`, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    let depth = 0;
    let i = m.index + m[0].length;
    const start = i;
    while (i < text.length) {
      const c = text[i];
      if (c === '"' || c === "'" || c === '`') { i = skipStr(text, i); continue; }
      if (c === '{' || c === '(' || c === '[') depth++;
      else if (c === '}' || c === ')' || c === ']') depth--;
      else if (c === ';' && depth === 0) return text.slice(start, i).trim();
      i++;
    }
  }
  return null;
}

/** A zero-arg helper function's body text, by name (one hop for rows locals). */
function helperBody(pageSrc, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{`);
  const m = re.exec(pageSrc);
  if (!m || m[1].trim() !== '') return null;
  const sp = balancedSpan(pageSrc, m.index + m[0].length - 1);
  return sp ? pageSrc.slice(sp.start + 1, sp.end - 1) : null;
}

/** Detect `for (let i = 1; i <= N; ...)` loops whose body reads indexed ids
 *  `prefix + i + suffix`. Returns { prefix, fields: Map(key->suffix), N } or null. */
function rowsLoopIn(bodyText, pageSrc, dollar) {
  const headRe = /for\s*\(\s*(?:let|var|const)\s+(\w+)\s*=\s*1\s*;/g;
  let m;
  while ((m = headRe.exec(bodyText)) !== null) {
    const ivar = m[1];
    const paren = balancedSpan(bodyText, bodyText.indexOf('(', m.index));
    if (!paren) continue;
    // loop body = the statement after the header: a `{...}` block
    let j = paren.end;
    while (j < bodyText.length && /\s/.test(bodyText[j])) j++;
    if (bodyText[j] !== '{') continue;
    const bspan = balancedSpan(bodyText, j);
    if (!bspan) continue;
    const body = bodyText.slice(bspan.start + 1, bspan.end - 1);
    // every indexed read in the body must share ONE prefix
    const readRe = new RegExp(
      `(?:document\\.getElementById|${dollar ? '\\$' : '\\u0000'})\\(\\s*([\\s\\S]*?)\\s*\\)`, 'g');
    let r;
    const prefixes = new Set();
    const reads = [];
    while ((r = readRe.exec(body)) !== null) {
      const argParts = splitConcat(r[1], ivar);
      if (!argParts) continue;
      prefixes.add(argParts.prefix);
      reads.push({ ...argParts });
    }
    if (prefixes.size !== 1 || reads.length === 0) continue;
    const prefix = [...prefixes][0];
    // fields from the pushed object literal: key: <read-with-suffix>
    const push = body.match(/push\s*\(\s*\{([\s\S]*)\}\s*\)/);
    if (!push) continue;
    const lit = parseObjectLiteralProps(push[1]);
    if (!lit || lit.bad.length > 0) continue;
    const fields = new Map();
    const rawRead = (e) => {
      const mm2 = e.match(/(?:document\.getElementById|\$)\s*\(\s*([\s\S]*?)\s*\)/g);
      if (!mm2 || mm2.length !== 1) return null;
      const one = e.match(/(?:document\.getElementById|\$)\s*\(\s*([\s\S]*?)\s*\)/);
      return one ? one[1] : null;
    };
    for (const [key, expr] of lit.props) {
      const raw = rawRead(expr);
      if (raw === null) { fields.clear(); break; }
      const argParts = splitConcat(raw, ivar);
      if (!argParts || argParts.prefix !== prefix) { fields.clear(); break; }
      fields.set(key, argParts.suffix);
    }
    if (fields.size === 0) continue;
    // N: numeric bound if literal, else max index seen on the PAGE per suffix
    let N = null;
    const bound = paren && /<=\s*(\d+)\s*;/.test(bodyText.slice(paren.start, paren.end));
    if (bound) N = parseInt(bodyText.slice(paren.start, paren.end).match(/<=\s*(\d+)\s*;/)[1], 10);
    const idMax = (sfx) => {
      const re = new RegExp(`id=["']${prefix}(\\d+)${sfx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g');
      let mx = 0;
      let im;
      while ((im = re.exec(pageSrc)) !== null) mx = Math.max(mx, parseInt(im[1], 10));
      return mx;
    };
    if (N === null) {
      const perField = [...fields.values()].map(idMax);
      if (perField.some((v) => v === 0)) continue;
      N = Math.min(...perField);
    }
    if (N < 1) continue;
    return { prefix, fields, N };
  }
  return null;
}

/** Split `'pre' + i + '_suf'` / `` `pre${i}suf` `` into { prefix, suffix }. */
function splitConcat(expr, ivar) {
  const t = expr.trim();
  const tpl = t.match(/^`([^`{}]*?)\$\{\s*${ivar}\s*\}([^`{}]*?)`$/);
  if (tpl) return { prefix: tpl[1], suffix: tpl[2] };
  const parts = splitTopLevel(t, '+');
  if (!parts) return null;
  let seenVar = false;
  let prefix = '';
  let suffix = '';
  for (const p of parts) {
    const q = p.trim();
    if (q === ivar) { if (seenVar) return null; seenVar = true; continue; }
    const sm = q.match(/^(['"])([^'"]*)\1$/);
    if (!sm) return null;
    if (seenVar) suffix += sm[2]; else prefix += sm[2];
  }
  return seenVar ? { prefix, suffix } : null;
}

/** The getElementById/$ argument text of a single-read expression. */
function argTextOf(expr, dollar) {
  const reads = domReads(expr, dollar);
  return reads.length === 1 ? expr.slice(reads[0].start, reads[0].end).replace(/^(?:document\.getElementById|document\.querySelector)\(\s*|\$\(\s*/g, '').replace(/\)\s*$/, '').replace(/^['"]|['"]$/g, '') : '';
}

/** Rows binding: `prop: V.map((rv) => ({ sf: rv.key, ... }))` (arrow OR
 *  `V.map(function (rv) { return { ... }; })`) with V one hop to an indexed-id
 *  loop (in the wrapper, or in a zero-arg page helper V calls). */
function rowsBinding(expr, bodyText, pageSrc, dollar) {
  const mapAt = expr.search(/[\s\S]\.map\s*\(/);
  if (mapAt === -1) return null;
  const v = expr.slice(0, mapAt + 1).trim();
  if (!/^[A-Za-z_$][\w$]*$/.test(v)) return null;
  const openIdx = expr.indexOf('(', mapAt + 1);
  const span = balancedSpan(expr, openIdx);
  if (!span) return null;
  const cb = expr.slice(span.start + 1, span.end - 1).trim();
  let rv = null;
  let m = cb.match(/^(?:async\s+)?\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*([\s\S]+)$/);
  let body;
  if (m) {
    rv = m[1];
    body = m[2].trim();
  } else {
    const fm = cb.match(/^(?:async\s+)?function\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*\{([\s\S]*)\}$/);
    if (!fm) return null;
    rv = fm[1];
    body = fm[2].trim();
  }
  // extract the object literal: a parenthesized literal, a bare literal, or a
  // `return { ... }` statement
  let lit = body.trim();
  if (lit.startsWith('(') && lit.endsWith(')')) lit = lit.slice(1, -1).trim();
  const retm = lit.match(/^return\s*\{([\s\S]*)\}\s*;?$/);
  if (retm) lit = retm[1];
  else if (lit.startsWith('{') && lit.endsWith('}')) lit = lit.slice(1, -1);
  else return null;
  if (!rv) return null;
  const litProps = parseObjectLiteralProps(lit);
  if (!litProps || litProps.bad.length > 0) return null;
  let init = assignmentRhs(bodyText, v);
  if (!init) return null;
  let loop = rowsLoopIn(init, pageSrc, dollar);
  if (!loop) {
    const hc = init.match(/^([A-Za-z_$][\w$]*)\(\)$/);
    if (hc) {
      const hb = helperBody(pageSrc, hc[1]);
      if (hb) loop = rowsLoopIn(hb, pageSrc, dollar);
    }
  }
  if (!loop) return null;
  // schema field ← row key (the .map callback is a pure rename)
  const fields = {};
  for (const [sf, rexpr] of litProps.props) {
    const rm = rexpr.trim().match(new RegExp(`^${rv}\\s*\\.\\s*([A-Za-z_$][\\w$]*)$`));
    if (!rm) return null;
    const suffix = loop.fields.get(rm[1]);
    if (!suffix) return null;
    fields[sf] = suffix;
  }
  const index = [];
  for (let i = 1; i <= loop.N; i++) index.push(i);
  return { rows: { prefix: loop.prefix, index, fields } };
}

/**
 * parseWrapperBindings — the row's named entry point. Pure. Returns
 *   { ok: true,  entries, wrapperDigest }
 *   { ok: false, unbound: [props], reason, wrapperDigest? }
 * where `entries` maps each inputSchema property to a typed entry:
 *   { id } | { id, coerce: 'number'|'boolean' } | { json: <textarea id> }
 *   | { rows: { prefix, index: [1..N], fields: { schemaField: suffix } } }
 * Any computed value, multi-read prop, or prop with no binding leaves the page
 * unemitted (unbound names the props — per-page verdict, never a halt).
 */
export function parseWrapperBindings(pageSrc, wrapperName, manifest) {
  const schemaProps = Object.keys(manifest.mcp_tool_definition.inputSchema.properties);
  const fn = manifest.execution.function_name;
  const digest = createHash('sha256').update(wrapperName + '\u0000' + (wrapperSpan(pageSrc, wrapperName) ? pageSrc.slice(wrapperSpan(pageSrc, wrapperName).start, wrapperSpan(pageSrc, wrapperName).end) : ''), 'utf8').digest('hex');
  const span = wrapperSpan(pageSrc, wrapperName);
  if (!span) return { ok: false, unbound: schemaProps, reason: `wrapper ${wrapperName} not found`, wrapperDigest: digest };
  const bodyText = pageSrc.slice(span.start + 1, span.end - 1);
  const dollar = dollarHelperDetected(pageSrc);
  const call = resolveCallArg(bodyText, fn);
  if (!call) {
    // Zero-arg fn is its own wrapper: no `fn(...)` invocation exists. The
    // params object is the argument handed across SOME call boundary (the
    // compute/hash seam) — candidate = any single-identifier argument whose
    // name resolves (assignment to an object literal, or a zero-arg helper
    // whose body returns one). Structural; the probe remains the oracle.
    const identCallRe = /(?:^|[^\w$.'"`])([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g;
    let c;
    let tried = null;
    const seen = new Set();
    while ((c = identCallRe.exec(bodyText)) !== null) {
      const cand = c[2];
      if (seen.has(cand)) continue;
      seen.add(cand);
      tried = resolveIdentParams(cand, bodyText, pageSrc);
      if (tried) break;
    }
    if (!tried) return { ok: false, unbound: schemaProps, reason: `no params-object assembly found inside wrapper ${wrapperName} (no object literal, helper literal, or property assignments)`, wrapperDigest: digest };
    return finishBinding(tried.props, tried.scope);
  }
  let propExprs = null;
  let scope = bodyText; // the scope params assignments/literals resolve against (hops into a helper at most once)
  if (call.kind === 'literal') {
    const lit = parseObjectLiteralProps(call.arg);
    if (!lit || lit.bad.length > 0) {
      return { ok: false, unbound: schemaProps, reason: `object literal passed to ${fn} has non-literal members: ${(lit ? lit.bad : []).join('; ')}`, wrapperDigest: digest };
    }
    propExprs = lit.props;
  } else if (call.kind === 'ident') {
    const tried = resolveIdentParams(call.arg, bodyText, pageSrc);
    if (!tried) return { ok: false, unbound: schemaProps, reason: `argument ${call.arg} to ${fn} is neither an object literal, a helper literal, nor an assignment-built object`, wrapperDigest: digest };
    propExprs = tried.props;
    scope = tried.scope;
  }
  return finishBinding(propExprs, scope);

  function finishBinding(propExprs2, scope2) {
    if (!propExprs2) return { ok: false, unbound: schemaProps, reason: `argument to ${fn} is neither an object literal nor an assignment-built object`, wrapperDigest: digest };
    const entries = {};
    const unbound = [];
    for (const prop of schemaProps) {
      const expr = propExprs2.get(prop);
      if (expr === undefined) { unbound.push(prop); continue; }
      const nested = nestedLiteral(expr);
      if (nested) {
        // Nested param group (the dominant real-page shape: `pp = { report: { … } }`).
        // Structural extension of the single-read rule into the group's own
        // sub-literals — deviation from the row's four flat entry types, recorded in the row report.
        const deeper = bindLiteral(nested, scope2, 0);
        if (deeper && Object.keys(deeper).length > 0) { entries[prop] = { object: deeper }; continue; }
        unbound.push(prop);
        continue;
      }
      const rows = rowsBinding(expr, scope2, pageSrc, dollar);
      if (rows) { entries[prop] = { ...rows }; continue; }
      const cls = classifyValueExpr(expr, dollar, scope2);
      if (cls.kind === 'bind') { entries[prop] = cls.entry; continue; }
      unbound.push(prop);
    }
    if (unbound.length > 0) {
      return { ok: false, unbound, reason: 'props with no single-read DOM binding (constant, computed, multi-read, or absent)', wrapperDigest: digest };
    }
    return { ok: true, entries, wrapperDigest: digest };
  }

  /** The inner text of an expression that is exactly one object literal. */
  function nestedLiteral(expr) {
    const t = expr.trim();
    if (!t.startsWith('{')) return null;
    const sp = balancedSpan(t, 0);
    if (!sp || sp.end !== t.length) return null;
    return t.slice(1, -1);
  }
  /** Bind a (possibly nested) object literal: scalar/rows/json entries per
   *  subproperty, recursively; produces { object: { sub: entry } }. */
  function bindLiteral(inner, scopeRef, depth) {
    if (depth > 3) return null;
    const lit = parseObjectLiteralProps(inner);
    if (!lit || lit.bad.length > 0) return null;
    const sub = {};
    for (const [k, sube] of lit.props) {
      const rows = rowsBinding(sube, scopeRef, pageSrc, dollar);
      if (rows) { sub[k] = { ...rows }; continue; }
      const nested = nestedLiteral(sube);
      if (nested) {
        const deeper = bindLiteral(nested, scopeRef, depth + 1);
        if (deeper) { sub[k] = { object: deeper }; continue; }
        return null;
      }
      const cls = classifyValueExpr(sube, dollar, scopeRef);
      if (cls.kind === 'bind') { sub[k] = cls.entry; continue; }
      return null;
    }
    return sub;
  }
}

/** The params object for a call-argument identifier: `const pp = { ... }`, a
 *  zero-arg helper hop (`pp = getParams()` whose body returns/assigns the
 *  literal), or successive `pp.prop = expr;` assignments. One helper hop max. */
function resolveIdentParams(arg, bodyText, pageSrc) {
  let scope = bodyText;
  let rhs = assignmentRhs(bodyText, arg);
  if (rhs) {
    const hc = rhs.match(/^([A-Za-z_$][\w$]*)\(\)$/);
    if (hc) {
      const hb = helperBody(pageSrc, hc[1]);
      if (hb) {
        scope = hb;
        const rh2 = assignmentRhs(hb, arg);
        if (rh2 && rh2.startsWith('{') && rh2.endsWith('}')) rhs = rh2;
        else {
          const ret = hb.match(/return\s*\{([\s\S]*)\}\s*;?\s*$/);
          if (ret) rhs = '{' + ret[1] + '}';
        }
      }
    }
  }
  if (rhs && rhs.startsWith('{') && rhs.endsWith('}')) {
    const lit = parseObjectLiteralProps(rhs.slice(1, -1));
    if (!lit || lit.bad.length > 0) return null;
    return { props: lit.props, scope };
  }
  // successive property assignments: `V.prop = expr;` in the wrapper body
  const re = new RegExp(`(?:^|\\n|;)\\s*${arg}\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*=\\s*`, 'g');
  const propExprs = new Map();
  let m;
  while ((m = re.exec(scope)) !== null) {
    const valStart = m.index + m[0].length;
    let depth = 0;
    let i = valStart;
    while (i < scope.length) {
      const c = scope[i];
      if (c === '"' || c === "'" || c === '`') { i = skipStr(scope, i); continue; }
      if (c === '{' || c === '(' || c === '[') depth++;
      else if (c === '}' || c === ')' || c === ']') depth--;
      else if ((c === ';' || c === '\n') && depth === 0) break;
      i++;
    }
    propExprs.set(m[1], scope.slice(valStart, i).trim());
  }
  return propExprs.size > 0 ? { props: propExprs, scope } : null;
}

function resolveCallArg(bodyText, fnName) {
  const re = new RegExp(`(?:^|[^\\w$.])${fnName}\\s*\\(`, 'g');
  let m;
  let first = null;
  while ((m = re.exec(bodyText)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    const span = balancedSpan(bodyText, openIdx);
    if (!span) continue;
    const arg = bodyText.slice(span.start + 1, span.end - 1).trim();
    const shaped = arg.startsWith('{') ? 'literal' : (/^[A-Za-z_$][\w$]*$/.test(arg) ? 'ident' : 'other');
    if (!first) first = { arg, kind: shaped };
    if (shaped !== 'other') return { arg, kind: shaped };
  }
  return first;
}

// ── Derived-page probe (the fixture-hash gate) ───────────────────────────────
/**
 * The headless harness pattern is check-deeplink-contract.mjs's (vm context with
 * a minimal DOM, page scripts in document order) — reimplemented here minus the
 * generated-reader plumbing because derived pages carry NO generated region.
 * The probe prefills the controls from fixture 0's policy_parameters THROUGH the
 * derived entries, calls the page's own wrapper, and asserts the result global's
 * execution_hash equals the fixture's golden_hash — the preimage oracle.
 */
function probeElementStub(id) {
  return {
    id, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
    href: '', download: '', type: '', style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, remove() {}, click() {}, focus() {}, blur() {}, select() {},
    scrollIntoView() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, insertAdjacentHTML() {},
    getContext() { return null; },
  };
}

export function probeSandbox(seedElements) {
  const elements = new Map();
  for (const [id, text] of seedElements) elements.set(id, probeElementStub(id));
  const warns = [];
  const documentStub = {
    readyState: 'complete', title: '',
    body: Object.assign(probeElementStub('body'), { appendChild() {} }),
    documentElement: probeElementStub('html'), head: probeElementStub('head'),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, probeElementStub(id));
      return elements.get(id);
    },
    createElement(tag) { return probeElementStub(tag); },
    createTextNode() { return {}; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
  };
  const sandbox = {
    document: documentStub,
    location: { hash: '', search: '', pathname: '/', host: 'ainumbers.co', href: 'https://ainumbers.co/', origin: 'https://ainumbers.co', protocol: 'https:' },
    navigator: { userAgent: 'gen-webmcp-derived-probe', language: 'en' },
    console: { log() {}, warn: (...a) => warns.push(a.map(String).join(' ')), error: (...a) => warns.push(a.map(String).join(' ')), info() {}, debug() {} },
    alert() {}, confirm() { return false; }, prompt() { return null; },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    requestAnimationFrame() { return 0; },
    matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
    MutationObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    URL: { createObjectURL() { return 'blob:probe'; }, revokeObjectURL() {} },
    Blob: class {}, FileReader: class { readAsText() {} },
    crypto: webcrypto, performance: { now: () => 0 },
    history: { replaceState() {}, pushState() {} },
    localStorage: (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; })(),
    sessionStorage: (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; })(),
    TextEncoder, TextDecoder, URLSearchParams, Promise, Date, JSON, Math,
    atob, btoa, CompressionStream, DecompressionStream, structuredClone,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.addEventListener = () => {};
  return { sandbox, elements, warns };
}

export function probeExtractScripts(html) {
  const scripts = [];
  const seedElements = new Map();
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\stype\s*=\s*["'](application\/ld\+json|importmap|application\/json)["']/.test(attrs)) {
      const idm = attrs.match(/\sid\s*=\s*["']([^"']+)["']/);
      if (idm) seedElements.set(idm[1], m[2]);
      continue;
    }
    if (/\ssrc\s*=/.test(attrs)) continue;
    scripts.push(m[2]);
  }
  return { scripts, seedElements };
}

/** Prefill the sandbox controls from `pp` THROUGH the derived entries.
 *  `doc` is the harness's document stub — getElementById creates on demand,
 *  so the prefilled element and the page-read element are the SAME object. */
export function prefillFromEntries(doc, entries, pp) {
  for (const [prop, e] of Object.entries(entries)) {
    if (e.source !== 'parsed-from-wrapper') continue;
    const val = pp[prop];
    if (e.json !== undefined) {
      doc.getElementById(e.json).value = JSON.stringify(val);
    } else if (e.object) {
      const sub = (val && typeof val === 'object' && !Array.isArray(val)) ? val : {};
      for (const [subProp, subEntry] of Object.entries(e.object)) {
        const subEntries = { [subProp]: { source: 'parsed-from-wrapper', ...subEntry } };
        prefillFromEntries(doc, subEntries, sub);
      }
    } else if (e.rows) {
      const arr = Array.isArray(val) ? val : [];
      for (const i of e.rows.index) {
        const row = arr[i - 1] || {};
        for (const [field, suffix] of Object.entries(e.rows.fields)) {
          doc.getElementById(e.rows.prefix + i + suffix).value = String(row[field] ?? '');
        }
      }
    } else if (e.id !== undefined) {
      const el = doc.getElementById(e.id);
      if (e.coerce === 'boolean') el.checked = val === true;
      else el.value = String(val ?? '');
    } else {
      throw new Error(`prefillFromEntries: entry for '${prop}' has neither id, json nor rows`);
    }
  }
}

/** Run the probe. `fx` is fixture 0 ({ policy_parameters, golden_hash }). */
export async function probeDerivedPage(pageSrc, pageLabel, entries, wrapper, fx) {
  const { scripts, seedElements } = probeExtractScripts(pageSrc);
  if (scripts.length === 0) return { ok: false, error: 'probe-error: no inline scripts' };
  const { sandbox, elements, warns } = probeSandbox(seedElements);
  const context = vm.createContext(sandbox);
  for (let i = 0; i < scripts.length; i++) {
    try {
      new vm.Script(scripts[i], { filename: `${pageLabel}#probe-${i}` }).runInContext(context);
    } catch (e) {
      return { ok: false, error: `probe-error: inline script ${i} threw at load: ${e.message}` };
    }
  }
  let pp;
  try {
    prefillFromEntries(sandbox.document, entries, fx.policy_parameters);
  } catch (e) {
    return { ok: false, error: `probe-error: prefill failed: ${e.message}` };
  }
  pp = null;
  try {
    const ret = sandbox[wrapper];
    if (typeof ret !== 'function') return { ok: false, error: `probe-error: wrapper ${wrapper} is not a callable global after page load` };
    await ret();
  } catch (e) {
    return { ok: false, error: `probe-error: wrapper ${wrapper} threw: ${e.message}` };
  }
  // Pages declare result globals with let/const in some scripts — vm context
  // script-level lexical bindings are shared across scripts but not visible as
  // sandbox properties; read the result with an IN-CONTEXT script (matches the
  // check-deeplink-contract harness posture).
  const artifact = new vm.Script(
    '(typeof _lastArtifact !== "undefined" && _lastArtifact) ? _lastArtifact : ((typeof _lastResult !== "undefined" && _lastResult) ? _lastResult : (globalThis._lastArtifact || globalThis._lastResult || null))',
    { filename: `${pageLabel}#probe-result` }).runInContext(context);
  if (!artifact || typeof artifact !== 'object') {
    const why = warns.join(' | ') || 'no diagnostic';
    return { ok: false, error: `probe-error: no result global produced (${why})` };
  }
  if (!artifact.execution_hash) return { ok: false, error: 'probe-error: result carries no execution_hash' };
  const produced = String(artifact.execution_hash).replace(/^sha256:/, '');
  const expected = String(fx.golden_hash).replace(/^sha256:/, '');
  if (produced !== expected) {
    return { ok: false, error: `wrapper-parse: hash-mismatch (produced ${produced.slice(0, 16)}…, fixture golden ${expected.slice(0, 16)}…)` };
  }
  return { ok: true, executionHash: produced };
}

// ── --derive-map (derive + probe + write the derived region) ─────────────────

function derivedEntriesOf(mapEntry) {
  return Object.values(mapEntry || {}).filter((e) => e && e.source === 'parsed-from-wrapper');
}

function renderDerivedEntries(proven) {
  const lines = [];
  for (const { id, wrapper, entries, digest } of [...proven].sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(`  '${jsStr(id)}': {`);
    lines.push(`    // wrapper: ${wrapper} (sha256 ${digest.slice(0, 12)}…, WEBMCP-WRAPPER-PARSE-1 probe-verified)`);
    for (const prop of Object.keys(entries).sort()) {
      lines.push(`    ${JSON.stringify(prop)}: ${JSON.stringify(entries[prop])},`);
    }
    lines.push('  },');
  }
  return lines.join('\n') + '\n';
}

function writeDerivedRegion(proven) {
  const selfPath = fileURLToPath(import.meta.url);
  let src = readFileSync(selfPath, 'utf8');
  const b = src.indexOf(DERIVED_MAP_BEGIN);
  const e = src.indexOf(DERIVED_MAP_END);
  if (b === -1 || e === -1 || e < b) fail('derived-map markers missing from propertyIdMap — cannot write');
  const body = proven.length === 0 ? '' : renderDerivedEntries(proven);
  src = src.slice(0, b + DERIVED_MAP_BEGIN.length) + '\n' + body + '  ' + src.slice(e);
  writeFileSync(selfPath, src, 'utf8');
}

async function loadFixture0(id) {
  const p = resolve(REPO, 'chaingraph', 'kernels', 'fixtures', `${id}.fixtures.json`);
  if (!existsSync(p)) return { error: 'probe-error: no fixture 0 (no fixtures file)' };
  let fixture;
  try { fixture = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { return { error: `probe-error: fixture unparseable: ${e.message}` }; }
  const vectors = fixture.vectors || fixture.fixtures || [];
  const fx = vectors[0];
  if (!fx || !fx.policy_parameters || !fx.golden_hash) return { error: 'probe-error: fixture 0 lacks policy_parameters/golden_hash' };
  return { fx };
}

async function runDeriveMap({ write, report }) {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(REPO);
  const proven = [];
  const probeFailed = [];
  const unboundPages = [];
  let considered = 0;
  for (const id of cleared) {
    const d = adjudicateTool(id, REPO, manifestIndex, mcpNameByTool);
    if (d.ok) continue; // already emittable — this row never touches registered pages
    if (!/form-element mapping incomplete/.test(d.reason)) continue;
    considered++;
    const loaded = loadManifestFor(id, manifestIndex, mcpNameByTool, REPO);
    if (loaded.error) continue;
    const manifest = loaded.m;
    const pageSrc = readRepoFile(`chaingraph/${id}.html`, REPO);
    const fn = manifest.execution.function_name;
    const wrapper = findWrapperName(pageSrc, fn);
    if (!wrapper) {
      // Per-page verdict, never a halt: the page's own execution fn is not
      // declared zero-arg (often a manifest TODO_FUNCTION_NAME_REVIEW
      // placeholder) or has no unique zero-arg caller — nothing to parse.
      unboundPages.push({ id, unbound: [], reason: `no detectable zero-arg wrapper for fn ${fn} (fn not declared on the page, or no unique zero-arg caller)` });
      continue;
    }
    const parsed = parseWrapperBindings(pageSrc, wrapper, manifest);
    if (!parsed.ok) {
      unboundPages.push({ id, unbound: parsed.unbound, reason: parsed.reason });
      continue;
    }
    const fxRes = await loadFixture0(id);
    if (fxRes.error) { probeFailed.push({ id, error: fxRes.error }); continue; }
    const probe = await probeDerivedPage(pageSrc, `chaingraph/${id}.html`, wrapEntries(parsed.entries, parsed.wrapperDigest), wrapper, fxRes.fx);
    if (probe.ok) proven.push({ id, wrapper, entries: wrapEntries(parsed.entries, parsed.wrapperDigest), digest: parsed.wrapperDigest });
    else probeFailed.push({ id, error: probe.error });
  }
  const buckets = { proven: proven.length, probeFailed: probeFailed.length, unbound: unboundPages.length, considered };
  if (write) writeDerivedRegion(proven);
  console.log(`--derive-map over ${considered} mapping-incomplete page(s) with a detectable wrapper:`);
  console.log(`  derived-and-proven:   ${buckets.proven}${write ? ' (written into propertyIdMap)' : ' (dry run — use --write)'}`);
  console.log(`  derived-but-probe-failed: ${buckets.probeFailed}`);
  console.log(`  unbound:              ${buckets.unbound}`);
  if (report) {
    for (const p of probeFailed) console.log(`  PROBE-FAILED ${p.id}: ${p.error}`);
    for (const u of unboundPages) console.log(`  UNBOUND ${u.id}: [${u.unbound.join(', ')}] — ${u.reason}`);
    for (const p of proven) console.log(`  PROVEN ${p.id}: ${Object.keys(p.entries).length} prop(s) via wrapper ${p.wrapper}`);
  }
  return buckets;
}

/** Stamp the source/wrapper_digest provenance onto parsed entries. */
function wrapEntries(entries, digest) {
  const out = {};
  for (const [prop, e] of Object.entries(entries)) {
    out[prop] = { source: 'parsed-from-wrapper', wrapper_digest: digest, ...e };
  }
  return out;
}

/** --check section 4: committed derived entries are re-parsed and re-probed —
 *  wrapper-byte drift, entry drift, or a failed probe is RED, never silent. */
async function checkDerivedEntries(manifestIndex, mcpNameByTool, pushProblem) {
  for (const [toolId, mapEntry] of Object.entries(propertyIdMap)) {
    if (!derivedEntriesOf(mapEntry).length) continue;
    const label = `chaingraph/${toolId}.html`;
    let pageSrc;
    try { pageSrc = readRepoFile(label, REPO); } catch (e) { pushProblem(`${label}: derived map unreadable page: ${e.message}`); continue; }
    const loaded = loadManifestFor(toolId, manifestIndex, mcpNameByTool, REPO);
    if (loaded.error) { pushProblem(`${label}: derived map has no manifest: ${loaded.error}`); continue; }
    const fn = loaded.m.execution.function_name;
    const wrapper = findWrapperName(pageSrc, fn);
    if (!wrapper) { pushProblem(`${label}: derived entries committed but no detectable wrapper for ${fn} — mapping is stale`); continue; }
    const parsed = parseWrapperBindings(pageSrc, wrapper, loaded.m);
    const committed = {};
    for (const [prop, e] of Object.entries(mapEntry)) if (e && e.source === 'parsed-from-wrapper') committed[prop] = e;
    if (!parsed.ok) {
      pushProblem(`${label}: derived entries no longer derivable (unbound: [${parsed.unbound.join(', ')}]; ${parsed.reason}) — wrapper bytes changed; re-run node scripts/gen-webmcp-registrations.mjs --derive-map --write`);
      continue;
    }
    const rederived = wrapEntries(parsed.entries, parsed.wrapperDigest);
    if (JSON.stringify(rederived) !== JSON.stringify(committed)) {
      pushProblem(`${label}: derived entries drifted from a re-parse of the current wrapper (digest ${parsed.wrapperDigest.slice(0, 12)}…) — re-run node scripts/gen-webmcp-registrations.mjs --derive-map --write`);
      continue;
    }
    const fxRes = await loadFixture0(toolId);
    if (fxRes.error) { pushProblem(`${label}: derived probe cannot run: ${fxRes.error}`); continue; }
    const probe = await probeDerivedPage(pageSrc, label, committed, wrapper, fxRes.fx);
    if (!probe.ok) pushProblem(`${label}: derived-page probe RED: ${probe.error}`);
  }
}

// ── Selftest (synthetic fixture repo; the real tree is never written) ─────────

async function selftest(){
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

    // 3b. TOOLPAGE-DEEPLINK-1: the same region carries the chrome-sourced deep-link reader.
    check('deep-link reader present, sourced from _page-chrome.mjs', block.includes(DEEPLINK_MARKER) && block.includes('#p=v1.'));
    check('deep-link prefill table mirrors the mapping decisions', block.includes('"principal":["principal","string"]') && block.includes('"flag":["flag","checked"]') && block.includes('"rows":["rows","json"]'));
    check('deep-link reader targets the page-verified wrapper', block.includes('var RUN_TARGET = "run"'));
    check('deep-link budget constant carried from the ledger cap', block.includes('var BUDGET = 30000'));
    // 3c. TOOLPAGE-FILE-IMPORT-1: the same region carries the chrome-sourced
    // zero-upload file-import reader (drop zone + picker), sharing the prefill
    // table and the verified run target with the deep-link reader.
    check('file-import reader present, sourced from _page-chrome.mjs', block.includes(FILE_IMPORT_MARKER) && block.includes('__ocgFileImport'));
    check('file-import reader shares the deep-link run target', block.includes('var RUN_TARGET = "run"'));
    check('file-import reader declares json/csv acceptance and no-upload posture', block.includes(".csv") && block.includes(".json") && block.includes("no storage, no network"));

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

    // 6d. MCP-SCHEMA-CONFORMANCE-1 type law (RULINGS 2026-09-10T20:30:44Z).
    // GREEN: a property with NO `type` keyword is legal and takes the 'string'
    // via (`.value = String(params.p)`) — exactly as the legacy `unknown` did.
    const typeless = JSON.parse(JSON.stringify(manifest));
    typeless.mcp_tool_definition.inputSchema.properties.label = { description: 'type not evidenced by kernel source' };
    const typelessShapeErr = checkManifestShape(typeless);
    const typelessBlock = buildBlockForPage(typeless, 'manifests/950-fx-100-selftest.manifest.json', '_lastArtifact', undefined, 'run');
    check('typeless property is legal (G1) and registers with the string via',
      typelessShapeErr === null
        && typelessBlock.includes("document.getElementById('label').value = String(params.label);"),
      `shapeErr=${JSON.stringify(typelessShapeErr)}`);
    // RED: the legacy `"type": "unknown"` (not one of the seven legal names) is
    // rejected by the G-gate. (During the transition, adjudicateTool tolerates it
    // ONLY for provenance-owned manifests so the sweep cannot drop the registered
    // set mid-flight; the pure law here is strict.)
    const unknownTyped = JSON.parse(JSON.stringify(manifest));
    unknownTyped.mcp_tool_definition.inputSchema.properties.label = { type: 'unknown' };
    const unknownShapeErr = checkManifestShape(unknownTyped);
    check('G1 refusal: "type": "unknown" rejected (illegal type name)',
      unknownShapeErr !== null && unknownShapeErr.includes('illegal type name') && unknownShapeErr.includes("'label'"),
      `got ${JSON.stringify(unknownShapeErr)}`);

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

    // 13. Triage buckets (WEBMCP-EXCLUSION-TRIAGE-1): one fixture page per
    // bucket asserts the verdict; RED-then-GREEN by flipping a fixture id.
    const tManifest = {
      tool_id: 'fx-100-selftest',
      input_schema: {},
      mcp_tool_definition: {
        name: 'run_fx_100_selftest',
        description: 'Selftest fixture tool that exercises the registration generator end to end.',
        inputSchema: { type: 'object', required: [], properties: {
          spot: { type: 'number' },
          vol: { type: 'number' },
          trades: { type: 'array' },
          cn_code: { type: 'string' },
          mode: { type: 'string' }
        } }
      },
      execution: { entry: 'chaingraph/fx-100-selftest.html', function_name: 'run' }
    };
    const tPage = (ids, fnDecl) => [
      '<html><body>',
      ids.map((i) => `<input id="${i}">`).join(''),
      '<textarea id="json_blob"></textarea>',
      '<script>var _lastResult=null;' + (fnDecl || 'function run(){_lastResult=null;}') + '</script>',
      '</body></html>'
    ].join('\n');
    const without = (mf, ...props) => {
      const c = JSON.parse(JSON.stringify(mf));
      for (const p of props) delete c.mcp_tool_definition.inputSchema.properties[p];
      return c;
    };
    // RENAME-ONLY fixture: every missing scalar has exactly one renamed candidate.
    const full = without(tManifest, 'trades'); // trades already bound? no — remove array prop to isolate rename class
    const recRename = triagePage(full, tPage(['inSpot', 'inVol', 'cn_code', 'mode']));
    check('triage RENAME-ONLY fixture: spot/vol each match exactly one renamed control', recRename.bucket === 'RENAME-ONLY');
    check('triage RENAME-ONLY fixture: candidate ids are the renamed controls', JSON.stringify(recRename.missing_props.find((p) => p.prop === 'spot').candidates) === '["inSpot"]');
    // RED-then-GREEN: flip the inSpot fixture id.
    const recRed = triagePage(full, tPage(['unrelated', 'inVol', 'cn_code', 'mode']));
    check('triage RED: flipping inSpot to an unrelated id leaves spot zero candidates -> VOCAB-DIVERGENT', recRed.bucket === 'VOCAB-DIVERGENT');
    const recGreen = triagePage(full, tPage(['inSpot', 'inVol', 'cn_code', 'mode']));
    check('triage GREEN: restored inSpot returns the bucket to RENAME-ONLY', recGreen.bucket === 'RENAME-ONLY');
    // AGGREGATE fixture: any array/object prop present.
    const recAgg = triagePage(tManifest, tPage(['inSpot', 'inVol', 'cn_code', 'mode']));
    check('triage AGGREGATE fixture: array prop (trades) present -> AGGREGATE', recAgg.bucket === 'AGGREGATE');
    check('triage AGGREGATE fixture: array prop carries no candidates (never heuristically bound)', recAgg.missing_props.find((p) => p.prop === 'trades').candidates.length === 0);
    // VOCAB-DIVERGENT fixture: a scalar prop with zero candidates.
    const vocab = without(tManifest, 'trades', 'spot', 'vol', 'mode');
    const recVocab = triagePage(vocab, tPage(['good_category', 'country_of_origin']));
    check('triage VOCAB-DIVERGENT fixture: cn_code has zero candidates', recVocab.bucket === 'VOCAB-DIVERGENT');
    // MIXED fixture: one scalar prop with two candidates.
    const recMixed = triagePage(full, tPage(['inSpot', 'inVol', 'cn_code', 'mode_a', 'mode_b']));
    check('triage MIXED fixture: mode has two candidates -> MIXED', recMixed.bucket === 'MIXED');
    // Flags.
    check('triage: fn_is_parametered false for the argumentless run()', recGreen.fn_is_parametered === false);
    const recParam = triagePage(full, tPage(['inSpot', 'inVol', 'cn_code', 'mode'], 'function run(pp){_lastResult=pp;}'));
    check('triage: fn_is_parametered true when the declared function has a parameter', recParam.fn_is_parametered === true);
    check('triage: has_json_textarea true for id containing json', recGreen.has_json_textarea === true);
    const recNoTa = triagePage(full, tPage(['inSpot', 'inVol', 'cn_code', 'mode']).replace('<textarea id="json_blob"></textarea>', ''));
    check('triage: has_json_textarea false without one', recNoTa.has_json_textarea === false);
    check('triage: report-only — plain data out, nothing bound', Array.isArray(recGreen.missing_props) && recGreen.bucket === 'RENAME-ONLY');

    // 14. Directory manifest emitter (WEBMCP-MANIFEST-1): pure halves against the
    // fixture — entry shape, sha256 correctness, truthful OT status, drift RED.
    const fxEntry = {
      url: `${SITE_ORIGIN}/chaingraph/fx-100-selftest.html`,
      name: manifest.mcp_tool_definition.name,
      description: manifest.mcp_tool_definition.description,
      input_schema_sha256: inputSchemaSha256(manifest.mcp_tool_definition.inputSchema),
      annotations: { readOnlyHint: true },
    };
    const fxJson = directoryJsonFromEntries([fxEntry], tmp);
    check('manifest emitter: fixture has NO OT token -> origin_trial "absent"', JSON.parse(fxJson).origin_trial === 'absent');
    writeFileSync(join(tmp, 'chaingraph', 'webmcp-ot-token.txt'), 'dummy-token\n');
    const fxJsonTok = directoryJsonFromEntries([fxEntry], tmp);
    check('manifest emitter: token file present -> origin_trial "first-party token present"', JSON.parse(fxJsonTok).origin_trial === 'first-party token present');
    check('manifest emitter: input_schema_sha256 equals sha256 of compact inputSchema JSON',
      fxEntry.input_schema_sha256 === createHash('sha256').update(JSON.stringify(schema), 'utf8').digest('hex'));
    check('manifest emitter: entry carries url/name/description/annotations',
      fxEntry.url.endsWith('/fx-100-selftest.html') && fxEntry.annotations.readOnlyHint === true && fxEntry.name === 'run_fx_100_selftest');
    // RED-then-GREEN by mutation: a drifted file (extra tool) fails byte equality.
    const driftedManifest = JSON.parse(fxJson); driftedManifest.tools.push({ ...fxEntry, name: 'extra_tool' });
    check('manifest emitter: drift (extra entry) is detectable by byte compare', driftedManifest.tools.length !== JSON.parse(fxJson).tools.length);
    // Idempotency: two builds over the same fixture bytes are identical.
    check('manifest emitter: deterministic (two builds byte-identical)', directoryJsonFromEntries([fxEntry], tmp) === fxJsonTok);

    // 15. Wrapper-binding parser + fixture-hash probe (WEBMCP-WRAPPER-PARSE-1):
    // one fixture page per entry type (scalar, coerce number/boolean, json,
    // rows), a computed-value page refused, and RED-then-GREEN by flipping a
    // fixture element id.
    const wSchema = { properties: {
      spot: { type: 'number' },
      label: { type: 'string' },
      flag: { type: 'boolean' },
      cfg: { type: 'object' },
      report: { type: 'object' },
      trades: { type: 'array' },
    }, required: [] };
    const wManifest = {
      tool_id: 'fx-200-wrap',
      input_schema: wSchema,
      mcp_tool_definition: {
        name: 'run_fx_200_wrap',
        description: 'Selftest fixture tool exercising the wrapper-binding parser and probe end to end.',
        inputSchema: { type: 'object', required: [], properties: {
          spot: { type: 'number' },
          label: { type: 'string' },
          flag: { type: 'boolean' },
          cfg: { type: 'object' },
          report: { type: 'object' },
          trades: { type: 'array' },
        } },
      },
      execution: { type: 'browser-javascript', entry: 'chaingraph/fx-200-wrap.html', function_name: 'compute', timeout_ms: 3000 },
    };
    const wPageSrc = [
      '<html><body>',
      '<input id="spot" value="9"><input id="label"><input id="flag"><textarea id="cfg"></textarea>',
      '<input id="t1_ssi"><input id="t1_liq"><input id="t2_ssi"><input id="t2_liq">',
      '<input id="action_type"><input id="notional">',
      '<script>',
      'var _lastResult = null;',
      'function getRows(){ var out=[]; for (var i=1;i<=2;i++){ out.push({ ssi: document.getElementById("t"+i+"_ssi")?.value ?? "x", liq: document.getElementById("t"+i+"_liq")?.value ?? "y" }); } return out; }',
      'function compute(pp){ return { output_payload: { echo: pp }, compliance_flags: {} }; }',
      'async function computeHash(pp, op){',
      '  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([pp, op])));',
      '  return "sha256:" + Array.from(new Uint8Array(b)).map(function(x){ return x.toString(16).padStart(2, "0"); }).join("");',
      '}',
      'async function run(){',
      '  var rows = getRows();',
      '  var pp = {',
      '    spot: Number(document.getElementById("spot").value),',
      '    label: document.getElementById("label")?.value,',
      '    flag: document.getElementById("flag").checked,',
      '    cfg: JSON.parse(document.getElementById("cfg").value),',
      '    report: {',
      '      action_type: document.getElementById("action_type").value.trim() || undefined,',
      '      notional: document.getElementById("notional").value !== "" ? Number(document.getElementById("notional").value) : undefined,',
      '    },',
      '    trades: rows.map(function(t){ return { ssi_match_status: t.ssi, liquidity_tier: t.liq }; }),',
      '  };',
      '  const result = compute(pp);',
      '  const hash = await computeHash(pp, result.output_payload);',
      '  _lastResult = { execution_hash: hash, policy_parameters: pp, output_payload: result.output_payload };',
      '}',
      '</script>',
      '</body></html>',
    ].join('\n');
    mkdirSync(join(tmp, 'chaingraph', 'kernels', 'fixtures'), { recursive: true });
    writeFileSync(join(tmp, 'chaingraph', 'fx-200-wrap.html'), wPageSrc);
    writeFileSync(join(tmp, 'manifests', '952-fx-200-wrap.manifest.json'), JSON.stringify(wManifest, null, 2));
    writeFileSync(join(tmp, 'chaingraph', 'kernels', 'fx-200-wrap.kernel.mjs'), [
      "export const meta = { mcp_name: 'run_fx_200_wrap' };",
      'export function compute(pp) {',
      '  return { output_payload: { echo: [pp.spot, pp.label, pp.flag, pp.cfg, (pp.trades || []).length] }, compliance_flags: {} };',
      '}',
    ].join('\n'));
    const pp0 = {
      spot: 101.5,
      label: 'wrap-fixture',
      flag: true,
      cfg: { tier: 'A' },
      report: { action_type: 'MODIFY', notional: 2500 },
      trades: [
        { ssi_match_status: 'matched', liquidity_tier: 'liquid' },
        { ssi_match_status: 'mismatched', liquidity_tier: 'illiquid' },
      ],
    };
    const expectedHash = 'sha256:' + createHash('sha256').update(JSON.stringify([pp0, { echo: pp0 }]), 'utf8').digest('hex');
    writeFileSync(join(tmp, 'chaingraph', 'kernels', 'fixtures', 'fx-200-wrap.fixtures.json'), JSON.stringify({
      vectors: [{ policy_parameters: pp0, golden_hash: expectedHash }],
    }, null, 2));

    const parsed = parseWrapperBindings(wPageSrc, 'run', wManifest);
    check('parse: all five entry types bound from the page wrapper', parsed.ok === true);
    check('parse: scalar entry {id}', parsed.ok && parsed.entries.label && parsed.entries.label.id === 'label');
    check('parse: coerce number entry (Number(...))', parsed.ok && parsed.entries.spot && parsed.entries.spot.id === 'spot' && parsed.entries.spot.coerce === 'number');
    check('parse: coerce boolean entry (.checked)', parsed.ok && parsed.entries.flag && parsed.entries.flag.coerce === 'boolean');
    check('parse: json entry (JSON.parse(textarea))', parsed.ok && parsed.entries.cfg && parsed.entries.cfg.json === 'cfg');
    check('parse: nested object entry (report.{action_type,notional} with benign tails)',
      parsed.ok && parsed.entries.report && parsed.entries.report.object
      && parsed.entries.report.object.action_type && parsed.entries.report.object.action_type.id === 'action_type'
      && parsed.entries.report.object.notional && parsed.entries.report.object.notional.coerce === 'number');
    check('parse: rows entry (helper loop t<1..2>_ssi/_liq, schema-field keys)',
      parsed.ok && parsed.entries.trades && parsed.entries.trades.rows
      && parsed.entries.trades.rows.prefix === 't'
      && JSON.stringify(parsed.entries.trades.rows.index) === '[1,2]'
      && parsed.entries.trades.rows.fields.ssi_match_status === '_ssi'
      && parsed.entries.trades.rows.fields.liquidity_tier === '_liq');

    // Computed value from two reads → refused (unbound), page never emitted.
    const twoReadPage = wPageSrc.replace(
      'spot: Number(document.getElementById("spot").value),',
      'spot: Number(document.getElementById("spot").value) + Number(document.getElementById("t1_ssi").value),');
    const parsedTwo = parseWrapperBindings(twoReadPage, 'run', wManifest);
    check('parse RED: a prop computed from two reads is refused (unbound: spot)', !parsedTwo.ok && parsedTwo.unbound.includes('spot'));
    // A constant (no DOM read) is equally unbound — never guessed.
    const constPage = wPageSrc.replace('label: document.getElementById("label")?.value,', 'label: "hard-coded",');
    const parsedConst = parseWrapperBindings(constPage, 'run', wManifest);
    check('parse RED: a constant prop is unbound', !parsedConst.ok && parsedConst.unbound.includes('label'));

    // Probe: prefill from fixture 0 through the derived entries, call the
    // wrapper, reproduce the fixture's execution_hash.
    const fx0 = { policy_parameters: pp0, golden_hash: expectedHash };
    const stamped = wrapEntries(parsed.entries, parsed.wrapperDigest);
    const probeGreen = await probeDerivedPage(wPageSrc, 'fx-200-wrap.html', stamped, 'run', fx0);
    check('probe GREEN: derived entries reproduce fixture 0 execution_hash', probeGreen.ok === true && probeGreen.executionHash === expectedHash.replace(/^sha256:/, ''));
    // RED-then-GREEN: point ONE committed entry at a wrong id (a drifted/renamed
    // control) — the probe must go RED, then GREEN when the binding is restored.
    const wrongId = JSON.parse(JSON.stringify(stamped));
    wrongId.label.id = 'labelX';
    const probeRed = await probeDerivedPage(wPageSrc, 'fx-200-wrap.html', wrongId, 'run', fx0);
    check('probe RED: a wrong bound id fails the fixture-hash probe (hash-mismatch)', !probeRed.ok && /hash-mismatch/.test(probeRed.error));
    const probeRegreen = await probeDerivedPage(wPageSrc, 'fx-200-wrap.html', stamped, 'run', fx0);
    check('probe GREEN: restored binding re-passes', probeRegreen.ok === true);
    // Wrapper-byte drift: flipping the id in the PAGE's own wrapper changes the
    // digest and re-derivation no longer matches the committed entries — drift
    // is red, never silent (the staleness guard).
    const driftedPage = wPageSrc.replace('document.getElementById("label")?.value', 'document.getElementById("labelX")?.value');
    const parsedDrift = parseWrapperBindings(driftedPage, 'run', wManifest);
    check('staleness RED: drifted wrapper re-parses to a different binding+digest',
      parsedDrift.ok === true && parsedDrift.entries.label.id === 'labelX' && parsedDrift.wrapperDigest !== parsed.wrapperDigest);
    check('staleness RED: digest differs implies --check entry-drift refusal would fire',
      JSON.stringify(wrapEntries(parsedDrift.entries, parsedDrift.wrapperDigest)) !== JSON.stringify(stamped));
    // Probe failure is a per-page verdict, not a halt: a page whose wrapper
    // corrupts a value (e.g. trims the JSON textarea) is probe-failed.
    const corruptPage = wPageSrc.replace('cfg: JSON.parse(document.getElementById("cfg").value),', 'cfg: JSON.parse(document.getElementById("label").value),');
    const parsedCorrupt = parseWrapperBindings(corruptPage, 'run', wManifest);
    const probeCorrupt = parsedCorrupt.ok
      ? await probeDerivedPage(corruptPage, 'fx-200-wrap.html', wrapEntries(parsedCorrupt.entries, parsedCorrupt.wrapperDigest), 'run', fx0)
      : { ok: false };
    check('probe RED: a corrupted binding path fails (parse or probe)', !probeCorrupt.ok);

    // 15. OT token gate + meta emitter (WEBMCP-OT-META-1). RED-then-GREEN on the
    // pure gate, byte-identity on the head writer.
    const b64tok = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
    const DAY = 86400; // expiry is seconds since epoch
    const past = b64tok({ origin: 'https://ainumbers.co:443', feature: 'WebMCP', expiry: Math.floor(Date.now() / 1000) - DAY, isSubdomain: true });
    const expiredFix = b64tok({ origin: 'https://ainumbers.co:443', feature: 'WebMCP', expiry: Math.floor(Date.now() / 1000) + 1, isSubdomain: true });
    const wrongOrigin = b64tok({ origin: 'https://evil.example', feature: 'WebMCP', expiry: Math.floor(Date.now() / 1000) + 45 * DAY });
    const wrongFeature = b64tok({ origin: 'https://ainumbers.co:443', feature: 'NotWebMCP', expiry: Math.floor(Date.now() / 1000) + 45 * DAY });
    const shortExpiry = b64tok({ origin: 'https://ainumbers.co:443', feature: 'WebMCP', expiry: Math.floor(Date.now() / 1000) + 5 * DAY });
    const good = b64tok({ origin: 'https://ainumbers.co:443', feature: 'WebMCP', expiry: Math.floor(Date.now() / 1000) + 45 * DAY, isSubdomain: true });
    check('OT gate: past-expiry fixture token is RED', otTokenGateErrors(past).length > 0);
    check('OT gate: token expiring in 1 second is RED (expired)', otTokenGateErrors(expiredFix).some((r) => r.includes('expires')));
    check('OT gate: wrong origin is RED', otTokenGateErrors(wrongOrigin).some((r) => r.includes('origin')));
    check('OT gate: wrong feature is RED', otTokenGateErrors(wrongFeature).some((r) => r.includes('feature')));
    check('OT gate: expiry below the 14-day floor is RED (renewal alarm)', otTokenGateErrors(shortExpiry).some((r) => r.includes('14-day')));
    check('OT gate: :443 origin + future expiry GREEN (the port normalizes)', otTokenGateErrors(good).length === 0);
    const headPage = '<html><head>\n<title>t</title>\n</head><body>x</body></html>';
    const metaBlock = otMetaBlock('tok-fixture');
    const withMeta = applyOtMeta(headPage, metaBlock);
    check('OT meta: region inserted on the first line after <head>', withMeta.startsWith('<html><head>\n' + metaBlock + '\n'));
    check('OT meta: insert is idempotent', applyOtMeta(withMeta, metaBlock) === withMeta);
    check('OT meta: placeholder strips back to byte-identical', applyOtMeta(withMeta, null) === headPage);
    check('OT meta: no <head> is refused, never guessed', (() => { try { applyOtMeta('<html><body></body></html>', metaBlock); return false; } catch { return true; } })());
    writeFileSync(join(tmp, 'chaingraph', 'webmcp-ot-token.txt'), OT_TOKEN_PLACEHOLDER + '\n');
    check('OT read: the placeholder classifies ABSENT (no meta emitted)', readOtToken(tmp).present === false && readOtToken(tmp).placeholder === true);
    writeFileSync(join(tmp, 'chaingraph', 'webmcp-ot-token.txt'), 'real-token-shape\n');
    check('OT read: a non-placeholder token classifies present', readOtToken(tmp).present === true && readOtToken(tmp).placeholder === false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(failures === 0 ? 'GEN-WEBMCP-REGISTRATIONS SELFTEST: PASS' : 'GEN-WEBMCP-REGISTRATIONS SELFTEST: FAIL');
  process.exit(failures === 0 ? 0 : 1);
}

// ── CLI ───────────────────────────────────────────────────────────────────────
// Main-guard: importing this module (e.g. session-root-parity.test.mjs importing
// SESSION_ROOT_SOURCE) must not run the CLI.
const invokedAsMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const args = process.argv.slice(2);
if (!invokedAsMain) {
  // imported for its pure exports; no CLI side effects
} else if (args.includes('--self-test') || args.includes('--selftest')) {
  selftest().catch((e) => { console.error('✗ selftest exception:', e); process.exit(1); });
} else if (args.includes('--derive-map')) {
  runDeriveMap({ write: args.includes('--write'), report: args.includes('--report') }).catch((e) => { console.error('✗ derive-map exception:', e); process.exit(1); });
} else if (args.includes('--triage')) {
  const oIdx = args.indexOf('--out');
  runTriage(oIdx !== -1 ? args[oIdx + 1] : null);
} else if (args.includes('--manifest')) {
  runManifest(args.includes('--write'), args.includes('--check'));
} else if (args.includes('--chains')) {
  // Chain composer mode (COMPOSER-PLAN-AND-ROOT-WEBMCP-1): --chains --write inserts;
  // --chains --check (or plain --chains) verifies byte-exact regions.
  runChainMode(args.includes('--write'));
} else if (args.includes('--check')) {
  runCheck().catch((e) => { console.error('✗ check exception:', e); process.exit(1); });
} else {
  const write = args.includes('--write');
  const all = args.includes('--all');
  const tIdx = args.indexOf('--tool');
  const onlyTool = tIdx !== -1 ? args[tIdx + 1] : null;
  runReportOrWrite(write, onlyTool);
}
