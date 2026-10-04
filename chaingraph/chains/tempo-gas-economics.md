# Tempo Fee-Sponsorship & Gas-AMM Economics

Model Tempo enshrined-AMM gas cost paid in any major stablecoin plus server-paid fee sponsorship, vs card/SWIFT/ACH baselines. Payments business case (art-35) → gas-AMM slippage, sponsorship break-even, and net per-tx saving (art-107). Distinct from Arc Paymaster: Tempo has no native gas token and uses an enshrined AMM, not ERC-4337.

- Page: https://ainumbers.co/chaingraph/chains/tempo-gas-economics.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/tempo-gas-economics.md

## Workflow chain: Tempo Fee-Sponsorship & Gas-AMM Economics

Model Tempo enshrined-AMM gas cost paid in any major stablecoin plus server-paid fee sponsorship, vs card/SWIFT/ACH baselines. Payments business case (art-35) → gas-AMM slippage, sponsorship break-even, and net per-tx saving (art-107). Distinct from Arc Paymaster: Tempo has no native gas token and uses an enshrined AMM, not ERC-4337.

Domain: Digital-Asset Rails

### Steps

1. art-35-tempo-payments-business-case
   volume, corridor mix, baseline fees feed Stage 2 gas economics
2. art-107-tempo-gas-economics
   Exports composite gas-economics artifact (blended gas cost, sponsorship break-even, per-tx saving) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: If we sponsor gas on every payment, at what monthly volume does sponsorship stop paying for itself?
Run the AINumbers MCP tool `run_chain` with {"chain":"tempo-gas-economics"} and read `art-107-tempo-gas-economics.sponsorship_breakeven_tx`.
Re-run with `inputs` for `art-107-tempo-gas-economics`, reusing the values that result echoed, with `server_paid_pct` set to 100. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/tempo-gas-economics.html
