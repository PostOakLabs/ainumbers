# FR 2052a Inflow/Outflow Daily Classification

Single-node daily FR 2052a complex-institution liquidity monitoring classification: buckets inflows/outflows by product/maturity against a caller-supplied Appendix IV-style boundary table.

- Page: https://ainumbers.co/chaingraph/chains/2052a-classify-daily.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/2052a-classify-daily.md

## Workflow chain: FR 2052a Inflow/Outflow Daily Classification

Single-node daily FR 2052a complex-institution liquidity monitoring classification: buckets inflows/outflows by product/maturity against a caller-supplied Appendix IV-style boundary table.

Domain: Corporate Treasury & FX

### Steps

1. art-437-fr2052a-inflow-outflow-classifier
   bucket-classified inflow/outflow export feeds the daily FR 2052a filing layer; a bucket override without a reason_code routes to the §27 human_accountability_record

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our treasury upload is in. Which maturity bucket catches the largest inflow once the classifier runs?
Run the AINumbers MCP tool `run_chain` with {"chain":"2052a-classify-daily"} and read `art-437-fr2052a-inflow-outflow-classifier.form_2052a.0.net_musd`.
Re-run with `inputs` for `art-437-fr2052a-inflow-outflow-classifier`, reusing the values that result echoed, with `rows` changed so row r0 instead matures in 400 days. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/2052a-classify-daily.html
