# S-Corp Election Break-Even Modeler

S-Corp election break-even modeler: from net self-employment income, a reasonable W-2 salary share and an annual admin cost, compute the sole-proprietor SE tax, the S-Corp payroll tax, the SE-tax saving net of admin cost, the five-year saving, and the 500-step-grid break-even income at which electing starts to pay, plus a QBI section 199A trade-off output weighing payroll-tax saved against the 20% deduction value lost on wages paid at the adjudicated 19.8% effective rate, with income-threshold and SSTB caveats as flags. 2026 figures: SS wage base $184,500 with cap logic on both sides (SS legs cap at the base, Medicare 2.9% continues uncapped) and the 92.35% SE factor applied to net earnings from self-employment only, never to W-2 wages (IRS Topic 554). That D4 treatment is the adjudication of record for this port (Tim, 2026-10-06): Apex #111 applies the factor to the wage and carries the error, so the S-Corp-side outputs intentionally differ from the source by the documented amount while the sole-prop side is source-identical. Filing status and the owner health premium are accepted and echoed but excluded from the tax arithmetic (source DIFFERS D1/D2, preserved); the 0.9% Additional Medicare Tax stays a stated caveat, not a modeled term. Admin cost carries a ~$1,500–$3,000/yr guidance band: values outside it are honored, never clamped, and flagged. Ported from ApexLogics display_number #111 (AL-118), CC BY 4.0, per the APEX-PORT fleet plan (payload APEXPORT-SC111, GRADES 8fb2772d).

- Page: https://ainumbers.co/chaingraph/art-713-scorp-election-break-even.html
- Markdown twin: https://ainumbers.co/chaingraph/art-713-scorp-election-break-even.md
- MCP tool: model_scorp_break_even (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- net_se_income (number, required): Net self-employment income in dollars for the year. Default 150000 when absent.
- reasonable_salary_pct (number, optional): Reasonable W-2 salary as a percent of net SE income, 0-100; the compute divides by 100. Default 50.
- annual_admin_cost (number, optional): Annual S-Corp accounting and payroll admin cost in dollars. Typical band $1,500-$3,000/yr; outside values honored and flagged. Default 3000.
- owner_health_premium_annual (number, optional): Owner health premium, annual dollars. Echoed, unused by the compute (DIFFERS D2). Default 0.
- filing_status (string, optional): Filing status. Excluded from the tax math (DIFFERS D1); selects only the section 199A threshold caveat flag. Default single.

## Sample

```json
{
  "net_se_income": 150000,
  "reasonable_salary_pct": 50,
  "annual_admin_cost": 3000,
  "owner_health_premium_annual": 0,
  "filing_status": "single"
}
```

## Verify

Run the sample policy_parameters through MCP tool `model_scorp_break_even` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
