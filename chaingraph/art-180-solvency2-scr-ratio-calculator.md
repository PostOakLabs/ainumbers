# Solvency II SCR Ratio Calculator

Calculate Solvency II SCR and MCR coverage ratios from eligible own funds and capital requirements. Checks the own-funds SCR tiering limits per Delegated Regulation (EU) 2015/35 Art. 82(1): Tier 1 at least 50% of SCR, Tier 3 less than 15% of SCR, Tier 2 plus Tier 3 at most 50% of SCR, and restricted Tier 1 less than 20% of total Tier 1 (Art. 82(3)). An omitted tier2 is treated as 0, which makes the Tier 2 plus Tier 3 test lenient. The 80% Tier 1 floor is the MCR rule (Art. 82(2)) and is not applied to the SCR; MCR tiering limits and the transitional Tier 1 items are not modelled. Returns scr_coverage_ratio, mcr_coverage_ratio, scr_breached, mcr_breached, tiering_ok, and per-tier percentages. Sec. 16 proof candidate. Root node of the solvency-ii-reconciliation-and-capital chain. Solvency II Dir. 2009/138/EC + Del. Reg. 2015/35. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-180-solvency2-scr-ratio-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-180-solvency2-scr-ratio-calculator.md
- MCP tool: calculate_solvency2_scr_ratio (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- capital (object, optional): Own-funds and capital-requirement amounts. An omitted tier2 is treated as 0, which makes the Tier 2 plus Tier 3 test lenient.

## Outputs

- scr_coverage_ratio (number, optional)
- mcr_coverage_ratio (number, optional)
- scr_breached (boolean, optional)
- mcr_breached (boolean, optional)
- tiering_ok (boolean, optional)
- tier1_unrestricted_pct_of_scr (number, optional)
- tier1_total_pct_of_scr (number, optional)
- tier3_pct_of_scr (number, optional)
- tier1_total_limit_ok (boolean, optional)
- tier3_limit_ok (boolean, optional)
- tier2_tier3_pct_of_scr (number, optional)
- tier2_tier3_limit_ok (boolean, optional)
- tier1_restricted_pct_of_tier1 (number, optional)
- tier1_restricted_share_ok (boolean, optional)
- eligible_own_funds (number, optional)
- scr (number, optional)
- mcr (number, optional)

## Sample

```json
{
  "capital": {
    "eligible_own_funds": 1500,
    "tier1_unrestricted": 850,
    "tier1_restricted": 150,
    "tier2": 400,
    "tier3": 100,
    "scr": 1000,
    "mcr": 250
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_solvency2_scr_ratio` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
