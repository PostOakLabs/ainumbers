# Servicemember Lending Protections

Linear two-step chain covering both servicemember lending protections in sequence. Step 1 computes the MLA MAPR and checks the 36% cap (applies at origination for covered borrowers). Step 2 computes the SCRA 6% rate cap and excess interest forgiveness (applies during active duty on pre-service obligations). Both steps always run.

- Page: https://ainumbers.co/chaingraph/chains/servicemember-lending-protections.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/servicemember-lending-protections.md

## Workflow chain: Servicemember Lending Protections

Linear two-step chain covering both servicemember lending protections in sequence. Step 1 computes the MLA MAPR and checks the 36% cap (applies at origination for covered borrowers). Step 2 computes the SCRA 6% rate cap and excess interest forgiveness (applies during active duty on pre-service obligations). Both steps always run.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-231-compute-mla-mapr
   MAPR percentage, cap compliance flag, and charge breakdown. Passes to SCRA rate cap computation.
2. art-232-compute-scra-rate-cap
   SCRA rate cap result, excess interest forgiven amount, covered-months calculation. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A covered servicemember loan carries 8 percent interest and the cap notice is on file. What rate may we charge now?
Run the AINumbers MCP tool `run_chain` with {"chain":"servicemember-lending-protections"} and read `art-232-compute-scra-rate-cap.exceeds_cap`.
Re-run with `inputs` for `art-232-compute-scra-rate-cap`, reusing the values that result echoed, with `original_rate_pct` set to 5. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/servicemember-lending-protections.html
