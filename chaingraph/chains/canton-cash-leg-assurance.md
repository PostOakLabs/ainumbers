# Canton Cash-Leg Assurance Chain

Stress-test the cash leg: LCR/NSFR liquidity scenario → MiCA reserve adequacy → on-chain finality verification. Assures Canton settlement payments against Basel III, MiCA Art. 36, and PFMI P9.

- Page: https://ainumbers.co/chaingraph/chains/canton-cash-leg-assurance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-cash-leg-assurance.md

## Workflow chain: Canton Cash-Leg Assurance Chain

Stress-test the cash leg: LCR/NSFR liquidity scenario → MiCA reserve adequacy → on-chain finality verification. Assures Canton settlement payments against Basel III, MiCA Art. 36, and PFMI P9.

Domain: Digital-Asset Rails

### Steps

1. sim-01-lcr-nsfr-liquidity-stress-test
   lcr_breach_probability,nsfr_ratio,time_to_breach feed Stage 2 reserve stress
2. rca-02-mica-reserve-stress
   reserve_shortfall_pct,breach_probability feed Stage 3 cash-leg finality
3. 506-onchain-cash-leg-finality-checker
   finality_verdict,genius_status - Exports cash-leg assurance mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
