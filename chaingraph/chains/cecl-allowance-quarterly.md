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

### Ask your agent

Question: The quarterly allowance recompute is ready for review. What provision expense closes the rollforward, and how would higher charge-offs move it?
Run the AINumbers MCP tool `run_chain` with {"chain":"cecl-allowance-quarterly"} and read `art-426-cecl-ecl-calculator.provision_expense_usd`.
Re-run with `inputs` for `art-426-cecl-ecl-calculator`, reusing the values that result echoed, with `charge_offs_usd` set to 120000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cecl-allowance-quarterly.html
