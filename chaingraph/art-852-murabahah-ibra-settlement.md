# Murabahah Ibra' Settlement

Computes the disclosed instalment schedule of a deferred-price sale (cost plus a mark-up fixed at contract) in integer minor units: each period's profit and principal split, the outstanding cost and selling price, and the deferred (unaccrued) profit. It computes the rebate on early settlement as that deferred profit less permitted recovery costs, the settlement amount with late-payment charges shown separately, the variable-rate case with the per-period rebate between the contracted and prevailing profit bases, and the non-delivery case where the rebate also covers undisbursed principal. A conventional-loan side-by-side is available with compensation and penalty lines kept separate. Outputs are arithmetic and rule checks against the cited regulator paragraphs, not a fatwa, Shariah certification, legal opinion or regulatory approval. Explicitly out of scope: buy-now-pay-later and credit-card rebate treatments, and any cap on late-payment charges (amounts are pass-through only). No personal data is accepted.

- Page: https://ainumbers.co/chaingraph/art-852-murabahah-ibra-settlement.html
- Markdown twin: https://ainumbers.co/chaingraph/art-852-murabahah-ibra-settlement.md
- MCP tool: compute_murabahah_ibra_settle (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- authority (string, optional): Pinned authority profile.
- cost_of_purchase_minor (number, optional): Acquisition cost in minor units.
- cpr_bp (number, optional): Contracted rate in basis points.
- tenor_months (number, optional): Number of months.
- instalment_minor (number, optional): Monthly instalment in minor units.
- selling_price_minor (number, optional): Contracted selling price in minor units.
- selling_price_stated_minor (number, optional): Optional stated selling price.
- epr_periods (array, optional): Optional prevailing-rate periods.
- settlement_month (number, optional): Optional early settlement month.
- instalment_due_minor (number, optional): Optional unpaid instalment.
- early_settlement_charges (array, optional): Optional permitted recovery costs.
- late_payment_minor (number, optional): Optional pass-through late charge.
- non_delivery (object, optional): Optional non-delivery case.
- conventional_loan (object, optional): Optional conventional comparison.

## Outputs

- authority (string,null, required)
- authority_profile (string,null, required)
- contracted_rate_bp (number,null, required)
- conventional_comparison (null,object, required)
- cost_of_purchase_minor (number,null, required)
- domain_errors (array, required)
- instalment_minor (number,null, required)
- markup_minor (number,null, required)
- non_delivery (null,object, required)
- not_a_shariah_ruling (boolean, required)
- profit_rounding (string, required)
- refusal_code (null,string, required)
- refused_cost_types (array, required)
- schedule (array, required)
- selling_price_minor (number,null, required)
- selling_price_residual_minor (number,null, required)
- selling_price_stated_minor (number,null, required)
- settlement (null,object, required)
- tenor_months (number,null, required)
- valid_input (boolean, required)
- variable_rate_applied (boolean, required)
- warnings (array, required)

## Sample

```json
{
  "authority": "bnm",
  "cost_of_purchase_minor": 20000000,
  "cpr_bp": 900,
  "tenor_months": 180,
  "instalment_minor": 202853,
  "selling_price_minor": 36513597,
  "selling_price_stated_minor": 36513600
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_murabahah_ibra_settle` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
