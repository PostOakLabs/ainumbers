# Treasury Clearing Fit Diagnostic

12-question A-F readiness diagnostic for the SEC US Treasury clearing mandate (cash Dec 31 2026 / repo Jun 30 2027). Grades scope, access, margin capacity, capital, ops/docs, and liquidity; routes to the right treasury-clearing chain and emits a remediation checklist.

- Page: https://ainumbers.co/chaingraph/art-48-treasury-clearing-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-48-treasury-clearing-fit-diagnostic.md
- MCP tool: run_treasury_clearing_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- activity_cash (any, optional): type not evidenced by kernel source
- activity_repo (any, optional): type not evidenced by kernel source
- agreements_status (any, optional): type not evidenced by kernel source
- capital_constrained (any, optional): type not evidenced by kernel source
- connectivity (any, optional): type not evidenced by kernel source
- cross_product_hedges (any, optional): type not evidenced by kernel source
- current_access (any, optional): type not evidenced by kernel source
- execution_breadth (any, optional): type not evidenced by kernel source
- exemption_claimed (any, optional): type not evidenced by kernel source
- hqla_inventory_pct (any, optional): Percentage value; type not evidenced by kernel source
- im_funding_ready (any, optional): type not evidenced by kernel source
- intraday_liquidity (any, optional): type not evidenced by kernel source
- primary_product (any, optional): type not evidenced by kernel source

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
