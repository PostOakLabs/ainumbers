# Freelance Quarterly Estimated Tax Calculator

Quarterly IRS estimated-tax calculator for self-employed income, ported from ApexLogics Apex #116 (AL-123). From gross freelance income, business expenses, other income, a filing status (single/mfj), an elective state bucket (none/low/mid/high = 0/3/5/9.3%, an illustrative assumption rather than a jurisdiction lookup), prior-year federal tax and year-to-date payments, the node computes net SE income, SE tax (12.4% Social Security capped at the 2026 wage base $184,500 plus 2.9% Medicare on 92.35% of net earnings), AGI after the employer-equivalent half of SE tax, federal income tax on the 2026 brackets after the 2026 standard deduction ($16,100 single / $32,200 MFJ), equal quarterly installments of the annual total with the 2026 due dates, and the safe harbor (lesser of 100% prior-year or 90% current-year federal tax). Q2 2026 ships as June 15, 2026 per the official IRS 1040-ES voucher, where Apex listed June 16 (payload DIFFERS.md D1); three Apex omissions ride flagged rather than silently patched: the 0.9% Additional Medicare Tax, the 110% high-earner safe-harbor prong and the $1,000 de minimis exemption (DIFFERS.md D2-D4, report items R2-R3). Numeric inputs coerce with the Apex page's own fallback behaviour (unknown state keys price at rate 0, non-mfj statuses price as single).

- Page: https://ainumbers.co/chaingraph/art-752-freelance-quarterly-estimated-tax.html
- Markdown twin: https://ainumbers.co/chaingraph/art-752-freelance-quarterly-estimated-tax.md
- MCP tool: estimate_quarterly_tax (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- gross_income (number, required): Annual gross freelance / self-employment income in USD (Apex input grossIncome, default 120000, min 1000, max 2000000).
- business_expenses (number, required): Business expenses in USD (Apex input expenses, default 15000, min 0, max 500000). Software, home office, equipment, professional fees, etc.
- other_income (number, required): Other income in USD - W-2 wages, interest, dividends (Apex input otherIncome, default 0, min 0).
- filing_status (string, required): Filing status (Apex select filingStatus). 'single' = Single / Married Filing Separately; 'mfj' = Married Filing Jointly.
- state (string, required): State tax bucket (Apex select state). Illustrative elective rates: none=0, low=0.03, mid=0.05, high=0.093. An assumption, not a jurisdiction lookup.
- prior_year_tax (number, required): Prior-year federal tax in USD (Form 1040 line 24; Apex priorYearTax, default 0). Drives the safe harbor; 0 selects the 90%-of-current fallback.
- ytd_paid (number, required): Year-to-date estimated payments already made in USD (Apex input ytdPaid, default 0, min 0).

## Outputs

- net_se_income (number, required)
- se_tax (number, required)
- ss_tax (number, required)
- mc_tax (number, required)
- agi (number, required)
- taxable_income (number, required)
- federal_income_tax (number, required)
- effective_fed_rate (number, required)
- state_tax (number, required)
- total_federal_tax (number, required)
- total_annual_tax (number, required)
- effective_total_rate (number, required)
- per_quarter (number, required)
- remaining_after_ytd (number, required)
- safe_harbor_total (number, required)
- safe_harbor_quarterly (number, required)
- quarters (array, required)
- warnings (array, required)

## Sample

```json
{
  "gross_income": 120000,
  "business_expenses": 15000,
  "other_income": 0,
  "filing_status": "single",
  "state": "high",
  "prior_year_tax": 0,
  "ytd_paid": 0
}
```

## Verify

Run the sample policy_parameters through MCP tool `estimate_quarterly_tax` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
