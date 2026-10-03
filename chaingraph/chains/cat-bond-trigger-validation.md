# Cat Bond Trigger Validation

Linear two-step chain for cat bond due diligence: validate trigger terms before running the trigger evaluation. Step 1 validates the attachment/exhaustion point structure and pro-rata arithmetic (cat bond terms). Step 2 evaluates the parametric trigger against the validated structure and computes payout. Designed for pre-issuance term review and post-event payout calculation where bond terms must be validated first. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/cat-bond-trigger-validation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cat-bond-trigger-validation.md

## Workflow chain: Cat Bond Trigger Validation

Linear two-step chain for cat bond due diligence: validate trigger terms before running the trigger evaluation. Step 1 validates the attachment/exhaustion point structure and pro-rata arithmetic (cat bond terms). Step 2 evaluates the parametric trigger against the validated structure and computes payout. Designed for pre-issuance term review and post-event payout calculation where bond terms must be validated first. ZERO PII BY CONSTRUCTION.

Domain: Insurance & Reinsurance

### Steps

1. art-252-validate-cat-bond-trigger-terms
   Validated layer structure: attachment/exhaustion ordering, layer_width, terms_valid. Passes to trigger evaluation.
2. art-251-compute-parametric-trigger-payout
   Trigger evaluation: trigger_hit, payout_amount, trigger_fraction, trigger_receipt. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The declared index value for this parametric tranche sits near its trigger. Does the payout register a hit?
Run the AINumbers MCP tool `run_chain` with {"chain":"cat-bond-trigger-validation"} and read `art-251-compute-parametric-trigger-payout.trigger_hit`.
Re-run with `inputs` for `art-251-compute-parametric-trigger-payout`, reusing the values that result echoed, with `index_value` changed so index_value is 90, below the 100 trigger threshold. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cat-bond-trigger-validation.html
