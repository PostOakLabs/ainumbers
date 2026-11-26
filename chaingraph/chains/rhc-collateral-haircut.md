# Robinhood Chain Collateral Haircut

Gated three-step chain for accepting Robinhood Chain stock tokens as collateral. Step 1 checks tokenized-collateral eligibility, step 2 computes the base repo haircut, step 3 layers the feed-staleness, sequencer-downtime, and underlying-halt haircut. Gate on /liquidation_risk: blocked halts the chain at the liquidation-risk verdict, default proceeds to the adjusted collateral value.

- Page: https://ainumbers.co/chaingraph/chains/rhc-collateral-haircut.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/rhc-collateral-haircut.md

## Workflow chain: Robinhood Chain Collateral Haircut

Gated three-step chain for accepting Robinhood Chain stock tokens as collateral. Step 1 checks tokenized-collateral eligibility, step 2 computes the base repo haircut, step 3 layers the feed-staleness, sequencer-downtime, and underlying-halt haircut. Gate on /liquidation_risk: blocked halts the chain at the liquidation-risk verdict, default proceeds to the adjusted collateral value.

Domain: Digital-Asset Rails

### Steps

1. 505-tokenized-collateral-eligibility-checker
   DTC/Fed eligibility and Basel HQLA tier feed the repo haircut base.
2. 508-repo-haircut-collateral-calculator
   base_haircut feeds the staleness/halt haircut layer.
3. art-320-rhc-collateral-haircut
   final_haircut, adjusted_collateral_value, and liquidation_risk are the chain output.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our stock tokens sit in a collateral pool. Is the price feed fresh enough to keep the base haircut?
Run the AINumbers MCP tool `run_chain` with {"chain":"rhc-collateral-haircut"} and read `art-320-rhc-collateral-haircut.liquidation_risk`.
Re-run with `inputs` for `art-320-rhc-collateral-haircut`, reusing the values that result echoed, with `current_time` set to 5000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/rhc-collateral-haircut.html
