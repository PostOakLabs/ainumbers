# Total Cost of Homeownership

Total cost of homeownership comparator ported from ApexLogics Apex #153 (AL-167). Given purchase price, loan terms, recurring costs, growth assumptions and a hold period, the node amortizes the mortgage month by month (art-332/626 pattern), charges mortgage insurance while the post-payment loan-to-value is strictly above a drop threshold (art-336 pattern), grows property tax, insurance, maintenance, HOA and utilities year by year, applies the interest-plus-SALT deduction offset at the caller's marginal rate, compounds the opportunity cost of cash at close (art-661 pattern), and returns gross and net cost of ownership over the hold, break-even monthly rent and a cost-composition breakdown in basis points. Only a hold under one year is refused (REFUSED_BAD_HOLD_YEARS); a refusal carries the same payload keys as a success. Declared divergences from the ported page: the SALT cap fallback stays at the Apex $10,000 for vector fidelity while the official 2026 figure is $40,400 (26 USC 164(b)(7)); the 78 percent automatic MI-termination leg of the Homeowners Protection Act is not modeled (80 percent borrower cancellation only); the deduction benefit omits the itemize-versus-standard threshold and the acquisition-indebtedness limit (payload DIFFERS.md D1-D4, H0-H3).

- Page: https://ainumbers.co/chaingraph/art-770-total-cost-of-homeownership.html
- Markdown twin: https://ainumbers.co/chaingraph/art-770-total-cost-of-homeownership.md
- MCP tool: total_cost_of_homeownership (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- price (number, required): Purchase price (Apex input price, default 450000). Clamped to [0, 50000000].
- downPct (number, required): Down payment, percent of price (Apex downPct, default 20). Clamped to [0,100]; below 20 the LTV starts above 80 so MI accrues.
- annualRate (number, required): Mortgage interest rate, percent APR (Apex rate, default 6.5). Negative becomes 0 (interest-free branch).
- termYears (number, required): Loan term in years (Apex termYears, default 30). Under 1 becomes 30; capped at 40; months capped at 480.
- closingPct (number, required): Closing costs, percent of price (Apex closingPct, default 2.5). Negative becomes 0.
- miRatePct (number, required): Mortgage insurance rate, percent of the original loan per year while post-payment LTV is strictly above the drop threshold (Apex miRate).
- propertyTaxRate (number, required): Property tax, percent of purchase value per year (Apex propertyTaxRate, default 1.1). Negative becomes 0.
- insuranceAnnual (number, required): Annual homeowners insurance in USD (Apex insuranceAnnual, default 1800). Grown yearly by inflationPct.
- hoaMonthly (number, required): Monthly HOA dues in USD (Apex hoaMonthly, default 0). Annualized then grown yearly by inflationPct.
- maintenancePct (number, required): Annual maintenance, percent of price (Apex maintenancePct, default 1.0). This input drives the math.
- extraUtilities (number, required): Annual utilities beyond what you pay renting, USD (Apex extraUtilities, default 1200). Grown yearly by inflationPct.
- appreciationPct (number, required): Home appreciation, percent per year (Apex appreciation, default 3.0). May be negative; negativeAppreciation flags it.
- taxGrowthPct (number, required): Property-tax growth, percent per year (Apex taxGrowth, default 2.0).
- inflationPct (number, required): Insurance/maintenance/HOA/utilities inflation, percent per year (Apex inflationRate, default 3.0).
- holdYears (integer, required): Years you plan to stay (Apex holdYears, default 7). Under 1 is refused: REFUSED_BAD_HOLD_YEARS.
- sellingPct (number, required): Selling costs at exit, percent of sale price (Apex sellingPct, default 6.0). Clamped to [0,20].
- oppRatePct (number, required): Opportunity-cost rate on cash invested, percent per year, annual compounding (Apex oppRate, default 5.0).
- marginalRatePct (number, required): Marginal income-tax rate for the interest+SALT benefit (Apex marginalRate, default 0). Enter 0 on the standard deduction.
- cMiDropLTVPct (number, required): LTV percent at which MI drops (Apex cMiDropLTV, default 80; HPA cancellation date). Non-finite falls back to 80; MI charges strictly above it.
- cSaltCap (number, required): SALT deduction cap per year, USD (Apex cSaltCap, default 10000). Falsy input falls back to 10000; official 2026 figure is 40400 (26 USC 164(b)(7)).

## Outputs

- grossCost (number,null, optional)
- netCost (number,null, optional)
- breakEvenMonthlyRent (number,null, optional)
- costPerMonth (number,null, optional)
- netCostPerMonth (number,null, optional)
- monthlyPayment (number,null, optional)
- loanAmount (number,null, optional)
- cashAtClose (number,null, optional)
- downPayment (number,null, optional)
- closingCosts (number,null, optional)
- totalInterest (number,null, optional)
- totalPrincipal (number,null, optional)
- totalMI (number,null, optional)
- totalPropertyTax (number,null, optional)
- totalInsurance (number,null, optional)
- totalMaintenance (number,null, optional)
- totalHOA (number,null, optional)
- totalUtilities (number,null, optional)
- deductibleBenefit (number,null, optional)
- oppCost (number,null, optional)
- homeValueAtExit (number,null, optional)
- sellingCosts (number,null, optional)
- loanBalanceAtExit (number,null, optional)
- netSaleProceeds (number,null, optional)
- equityFromPrincipal (number,null, optional)
- equityFromAppreciation (number,null, optional)
- shareBps (object,null, optional)
- negativeAppreciation (boolean,null, optional)
- inputs (object,null, optional)
- refusal (string,null, optional)
- message (string,null, optional)
- domain_errors (array, optional)

## Sample

```json
{
  "price": 450000,
  "downPct": 20,
  "annualRate": 6.5,
  "termYears": 30,
  "closingPct": 2.5,
  "miRatePct": 0.55,
  "propertyTaxRate": 1.1,
  "insuranceAnnual": 1800,
  "hoaMonthly": 0,
  "maintenancePct": 1,
  "extraUtilities": 1200,
  "appreciationPct": 3,
  "taxGrowthPct": 2,
  "inflationPct": 3,
  "holdYears": 7,
  "sellingPct": 6,
  "oppRatePct": 5,
  "marginalRatePct": 0,
  "cMiDropLTVPct": 80,
  "cSaltCap": 10000
}
```

## Verify

Run the sample policy_parameters through MCP tool `total_cost_of_homeownership` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
