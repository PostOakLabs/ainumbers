# Digital Trade Corridor Fit Diagnostic

Single-node D0 diagnostic grading a firm/corridor A–F across legality, document digitisation, platform connectivity, trade-rule basis (eUCP/URDTT), financing, and AML/TBML for digital trade (MLETR); routes to the right chain.

- Page: https://ainumbers.co/chaingraph/chains/digital-trade-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/digital-trade-fit.md

## Workflow chain: Digital Trade Corridor Fit Diagnostic

Single-node D0 diagnostic grading a firm/corridor A–F across legality, document digitisation, platform connectivity, trade-rule basis (eUCP/URDTT), financing, and AML/TBML for digital trade (MLETR); routes to the right chain.

Domain: Digital Trade

### Steps

1. art-52-digital-trade-fit-diagnostic
   dim_scores and primary_recommendation route to dtc-ebl-enforceability / dtc-digital-lc / dtc-doc-integrity / dtc-counterparty-aml / dtc-trade-finance / dtc-tbml-surveillance / dtc-audit-pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our corridor is paper-heavy and the bank wants to know if an electronic bill of lading is worth piloting between these two jurisdictions. What lifts the readiness grade first?
Run the AINumbers MCP tool `run_chain` with {"chain":"digital-trade-fit"} and read `art-52-digital-trade-fit-diagnostic.dim_scores.legality.score`.
Re-run with `inputs` for `art-52-digital-trade-fit-diagnostic`, reusing the values that result echoed, with `origin_jurisdiction` set to "mletr-adopted". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/digital-trade-fit.html
