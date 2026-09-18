# CECL Allowance Calculation & Rollforward (Quarterly)

Single-node quarterly ASC 326 CECL allowance run: computes per-segment expected credit loss from caller-supplied PD/LGD/EAD curves and reconciles the allowance rollforward against the prior period balance. Carries a terminal §27 review_required accountability gate; an unbalanced rollforward (reconciliation_balanced false) routes to the reserved escalate target.

- Page: https://ainumbers.co/chaingraph/chains/cecl-allowance-quarterly.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cecl-allowance-quarterly.md

## Workflow chain: CECL Allowance Calculation & Rollforward (Quarterly)

Single-node quarterly ASC 326 CECL allowance run: computes per-segment expected credit loss from caller-supplied PD/LGD/EAD curves and reconciles the allowance rollforward against the prior period balance. Carries a terminal §27 review_required accountability gate; an unbalanced rollforward (reconciliation_balanced false) routes to the reserved escalate target.

Domain: Bank Capital & Credit Risk

### Steps

1. art-426-cecl-ecl-calculator
   per-segment ECL and the reconciled allowance rollforward feed the quarterly ASC 326 disclosure and audit workpaper; an unbalanced rollforward routes to the reserved escalate target; recurring quarterly cadence

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
