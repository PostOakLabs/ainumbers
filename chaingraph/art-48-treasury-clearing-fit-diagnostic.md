# Treasury Clearing Fit Diagnostic

12-question A-F readiness diagnostic for the SEC US Treasury clearing mandate (cash Dec 31 2026 / repo Jun 30 2027). Grades scope, access, margin capacity, capital, ops/docs, and liquidity; routes to the right treasury-clearing chain and emits a remediation checklist.

- Page: https://ainumbers.co/chaingraph/art-48-treasury-clearing-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-48-treasury-clearing-fit-diagnostic.md
- MCP tool: run_treasury_clearing_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- activity_cash (unknown, optional)
- activity_repo (unknown, optional)
- agreements_status (unknown, optional)
- capital_constrained (unknown, optional)
- connectivity (unknown, optional)
- cross_product_hedges (unknown, optional)
- current_access (unknown, optional)
- execution_breadth (unknown, optional)
- exemption_claimed (unknown, optional)
- hqla_inventory_pct (unknown, optional): Percentage value
- im_funding_ready (unknown, optional)
- intraday_liquidity (unknown, optional)
- primary_product (unknown, optional)

## Outputs

- compliance_deadline (string, optional)
- dim_scores (object, optional)
- note (string, optional)
- overall_grade (string, optional)
- overall_score (number, optional)
- primary_recommendation (string, optional)
- remediation_checklist (array, optional)
- secondary_recommendations (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_treasury_clearing_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
