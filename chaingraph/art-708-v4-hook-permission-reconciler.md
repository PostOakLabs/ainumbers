# V4 Hook Permission Reconciler

Decodes a Uniswap v4 hook address's 14 permission bits (the low 14 bits of the address, per v4-core at the pinned commit a7cf038cd568801a79a9b4cf92cd5b52c95c8585, src/libraries/Hooks.sol) against a caller-declared callback set, and reconciles the two: each of the 14 flags (beforeInitialize through afterRemoveLiquidityReturnDelta) is reported MATCH, DECLARED_NOT_SET (the callback will never fire) or SET_NOT_DECLARED (the PoolManager calls an undisclosed function), with the mismatch count equal to the popcount of declared XOR actual. The node also replicates v4-core's isValidHookAddress validity rule: each return-delta flag requires its base flag, the zero address must not carry a dynamic fee, and a non-zero hook must have at least one flag set or a dynamic pool fee (pool_fee 0x800000), reporting valid_hook_address plus the failing rule. declared_permissions is accepted flat (all 14 booleans required; a missing key is a refusal, never a default) or in the Uniswap hooklist entry shape { hook.address, flags, properties.dynamicFee }; when a registry dynamicFee declaration is supplied it is reconciled with the caller's pool_fee (dynamic iff pool_fee equals 0x800000 exactly, per LPFeeLibrary.sol isDynamicFee; any other value is a static fee) and the declaration_source is emitted. standards_basis names the pinned v4-core commit. Zero network: the node never reads a chain and decodes only what the caller supplies; it states no opinion on whether a hook is safe or compliant.

- Page: https://ainumbers.co/chaingraph/art-708-v4-hook-permission-reconciler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-708-v4-hook-permission-reconciler.md
- MCP tool: reconcile_v4_hook_permissions (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- hook_address (string, required): 0x-prefixed 40-hex-digit Uniswap v4 hook address; checksum not required, normalised to lowercase. Its low 14 bits are the permission bitmap.
- declared_permissions (object, required): All 14 callback booleans, required, never defaulted; a missing key is refused. A Uniswap hooklist entry { hook, flags, properties } also accepted.
- pool_fee (integer, optional): Optional uint24 pool fee; the fee is dynamic iff pool_fee & 0x800000 (8388608).
- declaration_source (string, optional): Optional free text naming where the declaration comes from, e.g. a registry entry or notice item; emitted unchanged in the output.

## Outputs

- hook_address (string, optional)
- decoded_bits (string, optional)
- flags (array, optional)
- mismatches (array, optional)
- mismatch_count (integer, optional)
- valid_hook_address (boolean,null, optional)
- failing_rule (string,null, optional)
- pool_fee (integer,null, optional)
- v4_core_commit (string, optional)
- declaration_source (string,null, optional)
- dynamic_fee_declaration (object,null, optional)
- assumptions (array, optional)
- error (string, optional)
- detail (string, optional)
- domain_errors (array, optional)

## Sample

```json
{
  "hook_address": "0x0000000000000000000000000000000000000000",
  "declared_permissions": {
    "beforeInitialize": false,
    "afterInitialize": false,
    "beforeAddLiquidity": false,
    "afterAddLiquidity": false,
    "beforeRemoveLiquidity": false,
    "afterRemoveLiquidity": false,
    "beforeSwap": false,
    "afterSwap": false,
    "beforeDonate": false,
    "afterDonate": false,
    "beforeSwapReturnDelta": false,
    "afterSwapReturnDelta": false,
    "afterAddLiquidityReturnDelta": false,
    "afterRemoveLiquidityReturnDelta": false
  },
  "pool_fee": 0
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_v4_hook_permissions` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
