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
