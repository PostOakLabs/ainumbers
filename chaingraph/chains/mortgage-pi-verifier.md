# Mortgage P&I Verifier

Verify a mortgage's monthly principal-and-interest payment in two stages: TVM annuity computation of the level payment (ART-327), then a session receipt aggregating the run's execution hashes (CRY-05). Pure time-value-of-money mathematics; no regulation applies.

- Page: https://ainumbers.co/chaingraph/chains/mortgage-pi-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mortgage-pi-verifier.md

## Workflow chain: Mortgage P&I Verifier

Verify a mortgage's monthly principal-and-interest payment in two stages: TVM annuity computation of the level payment (ART-327), then a session receipt aggregating the run's execution hashes (CRY-05). Pure time-value-of-money mathematics; no regulation applies.

Domain: Consumer & Wealth Compliance

### Steps

1. art-327-tvm-annuity
   Produces pmt, the level monthly principal-and-interest payment via the closed-form annuity factor; rate_pct is the periodic (monthly) rate and nper the total payment count
2. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A $400,000 mortgage at 6.5% annual rate for 30 years. What is the monthly principal-and-interest payment?
Run the AINumbers MCP tool `run_chain` with {"chain":"mortgage-pi-verifier"} and read `art-327-tvm-annuity.pmt`.
Re-run with `inputs` for `art-327-tvm-annuity`, reusing the values that result echoed, with `pv` set to 500000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mortgage-pi-verifier.html
