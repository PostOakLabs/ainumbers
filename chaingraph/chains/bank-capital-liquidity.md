# Bank Capital & Liquidity (Basel III)

Full Basel III capital and liquidity workflow: RWA calculation > LCR > NSFR > leverage ratio > Pillar 3 disclosure.

- Page: https://ainumbers.co/chaingraph/chains/bank-capital-liquidity.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/bank-capital-liquidity.md

## Workflow chain: Bank Capital & Liquidity (Basel III)

Full Basel III capital and liquidity workflow: RWA calculation > LCR > NSFR > leverage ratio > Pillar 3 disclosure.

Domain: Bank Capital & Credit Risk

### Steps

1. 201-basel-rwa-calculator
   rwa_total and credit/market/ops breakdown feed Stage 2 LCR
2. 469-lcr-calculator
   hqla_total and nco feed Stage 3 NSFR
3. 470-nsfr-calculator
   asf and rsf totals feed Stage 4 leverage ratio
4. 471-leverage-ratio-calculator
   tier1 and exposure measure feed Stage 5 Pillar 3 disclosure
5. 472-pillar-3-disclosure-builder
   Exports composite Basel III capital & liquidity Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
