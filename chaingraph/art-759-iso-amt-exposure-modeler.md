# ISO AMT Exposure Modeler

AMT liability from an ISO exercise spread using the 2026 exemption amounts and phase-out thresholds, ported from ApexLogics Apex #109 (AL-116). For shares, strike price, FMV at exercise, ordinary income, other AMT preference items and a single/mfj filing status, the node computes the ISO spread (an AMT preference under IRC sec. 56(b)(3)), AMTI, the phased-out exemption (90100/140200 reduced by 25 percent above 500000/1000000), tentative minimum tax at 26/28 percent split at the 244500 breakpoint, the regular-tax comparison over the 2026 Rev. Proc. 2025-32 brackets, the AMT owed as the excess of TMT over regular tax, the credit generated, the maximum shares exercisable without triggering AMT (fixed 60-iteration binary search over 0..shares x 10) and a 5-step exercise-quantity scenario ladder. Unknown filing_status or a non-finite input is refused with a named code, never a silent guess. Apex folds MFS into its single option and models the credit as the full AMT owed; both are Apex-value-kept report items (payload DIFFERS.md D2, D6), flagged in the kernel, never silently diverged.

- Page: https://ainumbers.co/chaingraph/art-759-iso-amt-exposure-modeler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-759-iso-amt-exposure-modeler.md
- MCP tool: estimate_iso_amt_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- shares (integer, required): Shares to exercise this year. Integer, min 1, max 10000000.
- strike_price (number, required): ISO strike price in USD per share; min 0.01.
- fmv (number, required): Fair market value per share at exercise in USD; min 0.01.
- ordinary_income (number, required): W-2 and other ordinary income for the year in USD; min 0.
- other_amt_adjustments (number, optional): Other AMT preference items in USD; min 0. Optional; defaults to 0.
- filing_status (string, required): Filing status: 'single' (Single / MFS) or 'mfj' (Married Filing Jointly).

## Sample

```json
{
  "shares": 10000,
  "strike_price": 2.5,
  "fmv": 18,
  "ordinary_income": 175000,
  "other_amt_adjustments": 0,
  "filing_status": "single"
}
```

## Verify

Run the sample policy_parameters through MCP tool `estimate_iso_amt_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
