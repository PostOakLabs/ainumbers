# Pension Lump-Sum vs. Annuity Decision Engine

Compares a defined-benefit pension lump-sum offer against the single-life and joint-survivor annuity streams: present value at the stated discount rate with an optional labeled COLA assumption, survivor-option monthly cost, break-even discount rate, and undiscounted break-even age. Terminal node of the retirement-decumulation-decisions chain. Figures are user-supplied off the claimant's own election paperwork, no PII stored. NaN-safe. Zero network.

- Page: https://ainumbers.co/chaingraph/art-283-pension-lump-sum-vs-annuity-decision-engine.html
- Markdown twin: https://ainumbers.co/chaingraph/art-283-pension-lump-sum-vs-annuity-decision-engine.md
- MCP tool: compare_pension_lump_sum_annuity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- election (unknown, optional)

## Outputs

- annuityPV (number, optional)
- breakEvenAge (integer, optional)
- breakEvenRate (number, optional)
- colaApplied (boolean, optional)
- lumpSum (integer, optional)
- recommendation (string, optional)
- reinvestmentRequiredReturn (number, optional)
- survivorOptionCostMonthly (integer, optional)
- survivorPct (integer, optional)

## Sample

```json
{
  "election": {
    "lumpSum": 300000,
    "monthlyAnnuitySingleLife": 2000,
    "monthlyAnnuityJointSurvivor": 1800,
    "currentAge": 65,
    "lifeExpectancy": 90,
    "discountRatePct": 4,
    "survivorPct": 75,
    "colaToggle": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compare_pension_lump_sum_annuity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
