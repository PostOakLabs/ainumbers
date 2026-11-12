# SCO60 Group 2 Exposure Limit V2

Book-level Group 2 exposure-limit assessor for banks' cryptoasset exposures (BCBS d545 Prudential treatment of cryptoasset exposures, SCO60.116-119; the corrected successor to the single-position classifier: the 1% figure is a general-expectation threshold, the must-not-exceed limit is 2% of Tier 1). The caller supplies Tier 1 capital in integer minor units and the Group 2 book as per-cryptoasset positions carrying absolute long and short legs already delta-adjusted for derivatives. Legs are aggregated per cryptoasset and each asset is counted at the higher of its absolute long and short totals, never a netted figure; the per-asset figures sum into one aggregate that is assessed against both thresholds by strict cross-multiplied integer comparisons (exposure*100 against tier1*multiplier), so exactly 1% is not crossed and exactly 2% is not breached, and no floating-point rounding can flip a boundary. Below 1%: no finding. Above 1% and at or below 2%: the expectation threshold is crossed - supervisor notification fires and only the excess over 1% of Tier 1 takes the 1250% Group 2b weight, the remainder keeping its own treatment; this band is not a limit breach and the Pillar 3 precheck is unaffected. Above 2%: the limit is breached - the whole aggregate takes the 1250% weight, the precheck fails, and the breach gap and flags fire. The capital input must be a multiple of 100 minor units so 1% and 2% of it and the excess amount are exact integers; zero, negative, fractional or over-cap capital is a typed refusal, never a NaN or Infinity verdict. The caller owns the completeness of the book (every direct holding - cash and derivatives - and indirect holding - funds, ETF/ETN or similar - must be supplied), the delta adjustment of the legs, and the Tier 1 figure; the node classifies no individual asset and applies no infrastructure-risk add-on, which remain the earlier single-position classifier's decisions. National implementation of the standard varies by jurisdiction and no adoption status is asserted.

- Page: https://ainumbers.co/chaingraph/art-711-sco60-crypto-asset-exposure-classifier-v2.html
- Markdown twin: https://ainumbers.co/chaingraph/art-711-sco60-crypto-asset-exposure-classifier-v2.md
- MCP tool: classify_sco60_exposure_v2 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- bank_tier1_capital (integer, required): Tier 1 capital in integer minor units, a positive multiple of 100, at most 1e12. The denominator of both thresholds.
- group2_positions (array, required): Per-cryptoasset positions with absolute, delta-adjusted long_exposure and short_exposure integers; same-asset entries merge before the count.

## Sample

```json
{
  "bank_tier1_capital": 1000,
  "group2_positions": [
    {
      "cryptoasset": "btc",
      "holding_type": "direct_cash",
      "long_exposure": 8,
      "short_exposure": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_sco60_exposure_v2` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
