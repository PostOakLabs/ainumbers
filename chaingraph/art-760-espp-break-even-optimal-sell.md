# ESPP Break-Even & Optimal Sell

ESPP disposition comparator ported from ApexLogics Apex #110 (AL-117). For an ESPP purchase (price paid after the 15% statutory discount, offering-price FMV at grant, current price, shares, grant and purchase dates) and a tax profile (ordinary income, single/MFJ filing, optional as-of date), the node computes the disqualifying and qualifying disposition outcomes side by side: ordinary income (the discount, or its IRC 423(c)-capped qualifying analog), LTCG tax at the 2026 section 1(h) thresholds layered on ordinary income, the marginal ordinary rate from the 2026 section 1 tables, the break-even qualifying-disposition date (later of grant + 2 years + 1 day and purchase + 1 year + 1 day), and after-tax proceeds under each path. Tax constants are Rev. Proc. 2025-32 and IRC 423, fetched and quoted in the payload CITES.md. Out of scope: state tax, AMT, employment-tax treatment, wash-sale rules.

- Page: https://ainumbers.co/chaingraph/art-760-espp-break-even-optimal-sell.html
- Markdown twin: https://ainumbers.co/chaingraph/art-760-espp-break-even-optimal-sell.md
- MCP tool: analyze_espp_disposition (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- purchase_price (number, required): Price actually paid per share after the 15% ESPP discount; min 0.01.
- offering_price (number, required): FMV per share at grant / offering start; min 0.01.
- current_price (number, required): Current or sale price per share; min 0.01.
- shares (number, required): Shares purchased under the ESPP; min 1.
- grant_date (string, required): Grant date / offering start, YYYY-MM-DD.
- purchase_date (string, required): Date shares were purchased, YYYY-MM-DD.
- ordinary_income (number, required): W-2 and other ordinary income for the year in USD; min 0.
- filing_status (string, required): Filing status: 'single' (Single / MFS) or 'mfj' (Married Filing Jointly).
- as_of_date (string, optional): Optional YYYY-MM-DD; fixes already_qualified for a reproducible run.

## Sample

```json
{
  "purchase_price": 29.75,
  "offering_price": 35,
  "current_price": 48,
  "shares": 500,
  "grant_date": "2024-01-01",
  "purchase_date": "2024-07-01",
  "ordinary_income": 180000,
  "filing_status": "single",
  "as_of_date": "2026-10-08"
}
```

## Verify

Run the sample policy_parameters through MCP tool `analyze_espp_disposition` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
