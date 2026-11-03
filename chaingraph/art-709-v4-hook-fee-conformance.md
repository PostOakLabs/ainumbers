# V4 Hook Fee Conformance

Recomputes a Uniswap v4 pool's per-swap fee from v4-core's own fee rules at the pinned commit a7cf038cd568801a79a9b4cf92cd5b52c95c8585 (ProtocolFeeLibrary.sol calculateSwapFee: swapFee = protocolFee + lpFee - protocolFee*lpFee/1e6; Pool.sol L307 the protocol-fee-zero pass-through and L310-316 the MAX_SWAP_FEE revert, which applies to exact-out swaps only; LPFeeLibrary.sol the 0x400000 override flag, the 0x800000 dynamic flag and MAX_LP_FEE 1,000,000) and checks each swap's emitted fee against that recomposition: per-swap CONFORMS, OUT_OF_BOUNDS (LP fee outside the declared bounds or over MAX_LP_FEE) or FEE_MISMATCH (the declared fee story does not explain what the pool charged). Validates the packed two-direction protocol fee with isValidProtocolFee (each direction <= 1000 pips), decodes a per-swap LP-fee override by stripping its flag per REMOVE_OVERRIDE_MASK (read only on a dynamic pool, per Hooks.sol beforeSwap; on a static pool it is ignored), enforces the declared total fee cap (swap fee + hook charge), accrues a separately declared hook charge per swap and per recipient in integer floor arithmetic with every remainder reported, and reports LP revenue (amount_in * lpFee / 1e6) side by side, never netted against the hook charge; LP revenue stays LP revenue. An exact-out swap whose composed fee is at or above MAX_SWAP_FEE (where v4 reverts) and a dynamic pool fee (0x800000) without a per-swap override are reported INDETERMINATE rather than guessed; an exact-in swap at that fee is checked like any other. Evidence artifact only: it states no opinion on whether a fee is lawful. Zero network: the node never reads a chain and recomputes only what the caller supplies.

- Page: https://ainumbers.co/chaingraph/art-709-v4-hook-fee-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/art-709-v4-hook-fee-conformance.md
- MCP tool: check_v4_hook_fee_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- protocol_fee (integer, required): uint24, both directions packed as v4 stores it: low 12 bits zeroForOne, bits 12-23 oneForZero; each direction <= 1000 pips (isValidProtocolFee).
- pool_fee (integer, required): uint24: static LP fee in pips, or 0x800000 (8388608) for a dynamic-fee pool.
- declared_lp_fee_bounds (object, required): { min_pips, max_pips }: the LP-fee band the declared story permits (0..1000000).
- declared_total_fee_cap_pips (integer, optional): Optional total cap in pips; the composed swap fee plus the hook-charge rate is checked against it.
- declared_hook_charge (object, required): { rate_pips, splits: [{ recipient_label, share_bps }] }: the separately declared hook charge; shares reported as declared, never coerced.
- swaps (array, required): Each swap: { index, zero_for_one, amount_in, emitted_fee_pips, lp_fee_override? (raw uint24 incl. the 0x400000 flag), exact_out? }.

## Outputs

- assumptions (array, required)
- counts (object, optional)
- declared_hook_charge (object, optional)
- declared_lp_fee_bounds (object, optional)
- declared_total_fee_cap_pips (null,number, optional)
- detail (string, optional)
- domain_errors (array, optional)
- error (string, optional)
- fee_story_explained (boolean, optional)
- per_swap (array, required)
- pool_fee (number, optional)
- pool_fee_is_dynamic (boolean, optional)
- protocol_fee (number, optional)
- protocol_fee_one_for_zero_pips (number, optional)
- protocol_fee_valid (boolean,null, required)
- protocol_fee_zero_for_one_pips (number, optional)
- splits_ok (boolean, optional)
- splits_sum_bps (number, optional)
- total_cap_ok (null,boolean, optional)
- totals (object,null, required)
- v4_core_commit (string, required)

## Sample

```json
{
  "protocol_fee": 0,
  "pool_fee": 3000,
  "declared_lp_fee_bounds": {
    "min_pips": 0,
    "max_pips": 1000000
  },
  "declared_hook_charge": {
    "rate_pips": 500,
    "splits": [
      {
        "recipient_label": "treasury",
        "share_bps": 10000
      }
    ]
  },
  "swaps": [
    {
      "index": 0,
      "zero_for_one": true,
      "amount_in": 1000000,
      "emitted_fee_pips": 3000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_v4_hook_fee_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
