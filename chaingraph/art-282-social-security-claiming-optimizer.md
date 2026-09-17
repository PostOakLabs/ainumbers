# Social Security Claiming-Age Optimizer

Models Social Security claiming-age tradeoffs from a claimant's own PIA/FRA statement figures: early-claim reduction and delayed-retirement-credit factors, earnings-test withholding below FRA, lifetime present value at 62/FRA/70/chosen age, and the 62-vs-70 undiscounted break-even age. The annual earnings-test exempt amount defaults to the 2026 figure of $24,480 (SSA, Exempt Amounts Under the Earnings Test) and is overridable via claimant.earningsTestAnnualLimit, so a claimant can supply the amount from their own statement. Only the $1-for-$2 withholding below full retirement age is modeled; the year-of-attainment $1-for-$3 rule is out of scope. Root node of the retirement-decumulation-decisions chain. No SSA API, no PII stored. NaN-safe. Zero network.

- Page: https://ainumbers.co/chaingraph/art-282-social-security-claiming-optimizer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-282-social-security-claiming-optimizer.md
- MCP tool: optimize_social_security_claim_age (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- claimant (unknown, optional)

## Outputs

- birthYear (integer, optional)
- breakEvenAge62vs70 (integer, optional)
- claimAge (integer, optional)
- earningsTestAnnualLimit (integer, optional)
- earningsTestLimitSource (string, optional)
- fullRetirementAge (integer, optional)
- lifetimePV (number, optional)
- longevityAge (integer, optional)
- monthlyBenefitAtClaimAge (integer, optional)
- pia (integer, optional)
- recommendedClaimAge (integer, optional)

## Sample

```json
{
  "claimant": {
    "birthYear": 1960,
    "pia": 2000,
    "claimAge": 62,
    "earningsIfWorking": 0,
    "discountRatePct": 3,
    "longevityAge": 85
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `optimize_social_security_claim_age` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
