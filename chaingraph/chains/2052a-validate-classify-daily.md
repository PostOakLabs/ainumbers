# FR 2052a Validate then Classify Daily

Linear two-step chain for FR 2052a daily liquidity reporting. Step 1 runs the Appendix II-a/II-b/II-c/II-d edit-check rule set against caller-supplied rows, producing a gate_status and a named list of failing edit_ids. Step 2 buckets inflows/outflows by product/maturity against a caller-supplied Appendix IV-style boundary table. Both steps always run; the edit-check result is advisory context for the classification, not a routing gate.

- Page: https://ainumbers.co/chaingraph/chains/2052a-validate-classify-daily.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/2052a-validate-classify-daily.md

## Workflow chain: FR 2052a Validate then Classify Daily

Linear two-step chain for FR 2052a daily liquidity reporting. Step 1 runs the Appendix II-a/II-b/II-c/II-d edit-check rule set against caller-supplied rows, producing a gate_status and a named list of failing edit_ids. Step 2 buckets inflows/outflows by product/maturity against a caller-supplied Appendix IV-style boundary table. Both steps always run; the edit-check result is advisory context for the classification, not a routing gate.

Domain: Corporate Treasury & FX

### Steps

1. art-484-regrpt-editcheck-runner
   Computes gate_status and a named list of failing edit_ids against the FR 2052a Appendix II-a/b/c/d rule set.
2. art-437-fr2052a-inflow-outflow-classifier
   Bucket-classified inflow/outflow export for the daily FR 2052a filing layer; a bucket override without a reason_code triggers the §27 human_accountability_record. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
