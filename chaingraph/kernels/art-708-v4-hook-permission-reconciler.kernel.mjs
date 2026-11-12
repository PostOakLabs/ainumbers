import { executionHash } from './_hash.mjs';

// art-708-v4-hook-permission-reconciler — decodes a Uniswap v4 hook address's 14 permission
// bits (the low 14 bits of the address) against a caller-declared callback set, and reconciles
// the two: per flag MATCH / DECLARED_NOT_SET / SET_NOT_DECLARED, plus a replica of v4-core's
// isValidHookAddress validity rule (including the dynamic-fee escape via pool fee 0x800000).
//
// The bit table and the validity rule are pinned to Uniswap v4-core
// src/libraries/Hooks.sol at commit a7cf038cd568801a79a9b4cf92cd5b52c95c8585
// (flag constants L31-47, isValidHookAddress L109-127 at that revision; re-verified
// byte-identical at main 46c6834698c48bc4a463a86d8420f4eb1d7f3b75 on 2026-10-12).
// The commit travels in the output as v4_core_commit. Node-level citations live in the
// node metadata per KERNEL-CITATION-CLASS-1.
//
// Validity rule (replica):
//   R1 a return-delta flag requires its base flag (beforeSwap<-beforeSwapReturnDelta,
//      afterSwap<-afterSwapReturnDelta, afterAddLiquidity<-afterAddLiquidityReturnDelta,
//      afterRemoveLiquidity<-afterRemoveLiquidityReturnDelta);
//   R2 the zero address must NOT carry a dynamic fee;
//   R3 a non-zero hook must have at least one permission bit set OR a dynamic fee
//      (pool_fee == 0x800000 exactly; any other value, flag bit set or not, is a static fee).
//
// Input shape (step 4b): declared_permissions is accepted either as a flat object with all
// 14 flag booleans, or in the Uniswap hooklist entry shape { hook: { address }, flags: {...},
// properties: { dynamicFee } }. When properties.dynamicFee is supplied it is reconciled with
// the caller's pool_fee (dynamic iff pool_fee == 0x800000). No entry names or descriptions are
// read or emitted (the hooklist registry carries no license); an address plus its flag
// booleans are used as a fact with the entry URL cited in the fixture.
//
// Zero network: the node never reads a chain; it decodes only what the caller supplies.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network,
// no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, where
// TextEncoder/atob/btoa/URL are ABSENT (GUEST-BUILTIN-GATE-1). BigInt is available and used
// for all bit arithmetic. No UTF-8 encoding is needed, so no encoder is carried.

const TOOL_ID = 'art-708-v4-hook-permission-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'reconcile_v4_hook_permissions',
  mandate_type: 'compliance_control', gpu: false,
};

export const V4_CORE_COMMIT = 'a7cf038cd568801a79a9b4cf92cd5b52c95c8585';

// Pinned flag table: [flag, bit] — bit 13 (0x2000) down to bit 0 (0x1).
export const FLAGS = [
  ['beforeInitialize', 13],
  ['afterInitialize', 12],
  ['beforeAddLiquidity', 11],
  ['afterAddLiquidity', 10],
  ['beforeRemoveLiquidity', 9],
  ['afterRemoveLiquidity', 8],
  ['beforeSwap', 7],
  ['afterSwap', 6],
  ['beforeDonate', 5],
  ['afterDonate', 4],
  ['beforeSwapReturnDelta', 3],
  ['afterSwapReturnDelta', 2],
  ['afterAddLiquidityReturnDelta', 1],
  ['afterRemoveLiquidityReturnDelta', 0],
];
export const FLAG_NAMES = FLAGS.map(([f]) => f);
const ALL_HOOK_MASK = 0x3fffn; // (1 << 14) - 1, v4-core ALL_HOOK_MASK
const DYNAMIC_FEE_FLAG = 0x800000n; // LPFeeLibrary dynamic-fee flag
const HEX40 = /^0x[0-9a-fA-F]{40}$/;

function deNull(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const c = { ...o };
  for (const k of Object.keys(c)) if (c[k] === null) c[k] = undefined;
  return c;
}

function refusal(code, detail) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      flags: [],
      mismatches: [],
      valid_hook_address: null,
      failing_rule: null,
      v4_core_commit: V4_CORE_COMMIT,
      declaration_source: null,
      dynamic_fee_declaration: null,
      assumptions: [],
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

// Hooklist-entry shape detection: an object carrying a `flags` object counts as the
// registry-entry form regardless of whether `hook`/`properties` are present.
function isHooklistEntry(v) {
  return !!(v && typeof v === 'object' && !Array.isArray(v)
    && v.flags && typeof v.flags === 'object' && !Array.isArray(v.flags));
}

function hasPermission(bits, bit) {
  return (bits & (1n << BigInt(bit))) !== 0n;
}


/**
 * compute(pp) — pure decision kernel. Zero network; decodes only caller-supplied values.
 *
 * pp: {
 *   hook_address: '0x' + 40 hex (checksum not required, normalised to lowercase),
 *   declared_permissions: 14 required booleans — flat, or hooklist entry
 *     { hook: { address }, flags, properties: { dynamicFee } },
 *   pool_fee?: uint24 (dynamic fee iff pool_fee == 0x800000 exactly),
 *   declaration_source?: string (free text, e.g. "TSV Notice item (p)"),
 * }
 */
export function compute(pp) {
  pp = deNull(pp || {});

  // ---- resolve the hooklist-entry form (step 4b) ----
  let entry = null;
  let declared = pp.declared_permissions;
  if (isHooklistEntry(declared)) {
    entry = declared;
    declared = entry.flags;
  }

  // ---- hook address ----
  let addrHex = pp.hook_address;
  if (addrHex === undefined && entry && entry.hook && typeof entry.hook.address === 'string') {
    addrHex = entry.hook.address;
  }
  if (typeof addrHex !== 'string' || !HEX40.test(addrHex)) {
    return refusal('HOOK_ADDRESS_INVALID',
      'hook_address must be a 0x-prefixed 40-hex-digit address (checksum not required); got '
      + JSON.stringify(addrHex ?? null) + '.');
  }
  addrHex = addrHex.toLowerCase();

  // ---- declared permissions: every one of the 14 booleans required, never defaulted ----
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) {
    return refusal('DECLARED_PERMISSIONS_INVALID',
      'declared_permissions must be an object carrying all 14 flag booleans (flat, or a Uniswap hooklist entry with a flags object); got '
      + JSON.stringify(declared ?? null) + '.');
  }
  const missing = FLAG_NAMES.filter((f) => typeof declared[f] !== 'boolean');
  if (missing.length > 0) {
    return refusal('DECLARED_PERMISSIONS_INCOMPLETE',
      'declared_permissions is missing a required boolean for: ' + missing.join(', ')
      + '. Every one of the 14 flags must be declared explicitly; nothing is defaulted.');
  }

  // ---- pool_fee ----
  let poolFee;
  if (pp.pool_fee !== undefined) {
    if (typeof pp.pool_fee !== 'number' || !Number.isInteger(pp.pool_fee)
      || pp.pool_fee < 0 || pp.pool_fee > 0xffffff) {
      return refusal('POOL_FEE_INVALID',
        'pool_fee, when present, must be a uint24 integer (0..16777215); got '
        + JSON.stringify(pp.pool_fee) + '.');
    }
    poolFee = BigInt(pp.pool_fee);
  }

  // ---- declaration_source ----
  let declarationSource = null;
  if (pp.declaration_source !== undefined) {
    if (typeof pp.declaration_source !== 'string') {
      return refusal('DECLARATION_SOURCE_INVALID',
        'declaration_source, when present, must be a string; got ' + JSON.stringify(pp.declaration_source) + '.');
    }
    declarationSource = pp.declaration_source;
  }

  // ---- decode (BigInt only) ----
  const addr = BigInt(addrHex);
  const bits = addr & ALL_HOOK_MASK;

  const flags = FLAGS.map(([flag, bit]) => {
    const actual = hasPermission(bits, bit);
    const dec = declared[flag];
    return {
      flag,
      bit,
      declared: dec,
      actual,
      status: dec === actual ? 'MATCH' : (dec && !actual ? 'DECLARED_NOT_SET' : 'SET_NOT_DECLARED'),
    };
  });
  const mismatches = flags.filter((f) => f.status !== 'MATCH')
    .map(({ flag, bit, declared: d, actual, status }) => ({ flag, bit, declared: d, actual, status }));

  // ---- isValidHookAddress replica (v4-core L109-127 at the pin) ----
  const poolDynamic = poolFee !== undefined && poolFee === DYNAMIC_FEE_FLAG;
  let valid = true;
  let failingRule = null;
  const baseOf = { beforeSwapReturnDelta: 'beforeSwap', afterSwapReturnDelta: 'afterSwap',
    afterAddLiquidityReturnDelta: 'afterAddLiquidity', afterRemoveLiquidityReturnDelta: 'afterRemoveLiquidity' };
  const actualByFlag = {};
  for (const f of flags) actualByFlag[f.flag] = f.actual;
  for (const [delta, base] of Object.entries(baseOf)) {
    if (!actualByFlag[base] && actualByFlag[delta]) {
      valid = false;
      failingRule = delta.toUpperCase() + '_REQUIRES_' + base.toUpperCase();
      break;
    }
  }
  if (valid && addr === 0n && poolDynamic) {
    valid = false;
    failingRule = 'ZERO_ADDRESS_WITH_DYNAMIC_FEE';
  }
  if (valid && addr !== 0n && bits === 0n && !poolDynamic) {
    valid = false;
    failingRule = 'NO_FLAG_SET_AND_STATIC_FEE';
  }

  // ---- dynamic-fee declaration reconciliation (step 4b) ----
  let dynamicFeeDeclaration = null;
  const declaredDynamic = entry && entry.properties
    && typeof entry.properties === 'object' && !Array.isArray(entry.properties)
    && typeof entry.properties.dynamicFee === 'boolean'
    ? entry.properties.dynamicFee : undefined;
  if (declaredDynamic !== undefined) {
    dynamicFeeDeclaration = {
      declared_dynamic: declaredDynamic,
      pool_fee_dynamic: poolFee === undefined ? null : poolDynamic,
      agrees: poolFee === undefined ? null : declaredDynamic === poolDynamic,
    };
  }

  return {
    output_payload: {
      hook_address: addrHex,
      decoded_bits: '0x' + bits.toString(16),
      flags,
      mismatches,
      mismatch_count: mismatches.length,
      valid_hook_address: valid,
      failing_rule: failingRule,
      pool_fee: poolFee === undefined ? null : Number(poolFee),
      v4_core_commit: V4_CORE_COMMIT,
      declaration_source: declarationSource,
      dynamic_fee_declaration: dynamicFeeDeclaration,
      assumptions: [
        'Flag table and validity rule pinned to Uniswap v4-core src/libraries/Hooks.sol at commit '
          + V4_CORE_COMMIT + ' (all 14 permission bits are the low 14 bits of the hook address).',
        'Zero network: the node never reads a chain and decodes only the caller-supplied address, declaration and fee.',
        'Checksummed addresses are accepted and normalised to lowercase; decoding uses BigInt arithmetic over the low 14 bits only.',
        'A missing declared boolean is a refusal, never a default: an undisclosed callback cannot be guessed.',
      ],
    },
    compliance_flags: [],
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
