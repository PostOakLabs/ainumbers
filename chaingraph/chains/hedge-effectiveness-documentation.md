# Hedge Effectiveness Documentation

Gated two-step chain for ASC 815 hedge accounting designation. Step 1 applies the dollar-offset test (80-125%) and OLS R-squared regression (>=0.8) for retrospective effectiveness. Gate on /is_effective: if false (INEFFECTIVE), the chain ends - hedge accounting not permitted. Default (true, EFFECTIVE): Step 2 scores AFP 2024 cash-flow forecast accuracy for prospective effectiveness documentation required by ASC 815-20-35. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/hedge-effectiveness-documentation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/hedge-effectiveness-documentation.md

## Workflow chain: Hedge Effectiveness Documentation

Gated two-step chain for ASC 815 hedge accounting designation. Step 1 applies the dollar-offset test (80-125%) and OLS R-squared regression (>=0.8) for retrospective effectiveness. Gate on /is_effective: if false (INEFFECTIVE), the chain ends - hedge accounting not permitted. Default (true, EFFECTIVE): Step 2 scores AFP 2024 cash-flow forecast accuracy for prospective effectiveness documentation required by ASC 815-20-35. ZERO PII BY CONSTRUCTION.

Domain: Corporate Treasury & FX

### Steps

1. art-261-test-hedge-effectiveness
   ASC 815 dollar-offset ratio (80-125%) + OLS R-squared (>=0.8). Emits is_effective (bool), offset_ratio_pct, r_squared, compliance_flags. GATE: is_effective=false -> END (INEFFECTIVE). Default -> Step 2.
2. art-263-score-cash-forecast-accuracy
   AFP 2024 MAPE/bias scoring of hedged cash-flow forecasts for prospective effectiveness evidence. Returns accuracy_tier and by_horizon breakdown. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Auditing the hedge file before sign-off: does the designated hedge ratio sit inside the IFRS 9 band for hedge accounting?
Run the AINumbers MCP tool `run_chain` with {"chain":"hedge-effectiveness-documentation"} and read `art-261-test-hedge-effectiveness.ifrs9_hedge_ratio_passes`.
Re-run with `inputs` for `art-261-test-hedge-effectiveness`, reusing the values that result echoed, with `hedge_ratio` set to 1.3. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/hedge-effectiveness-documentation.html
