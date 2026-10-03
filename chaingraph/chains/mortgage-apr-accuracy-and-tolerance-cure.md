# Mortgage APR Accuracy and Tolerance Cure

Actuarial APR solve followed by TRID APR accuracy check and TRID fee tolerance cure calculation. Linear chain: computes APR, verifies it against disclosed APR within §1026.22(a) tolerance, then computes the cure amount required for any fee tolerance violation under §1026.19(e)(3).

- Page: https://ainumbers.co/chaingraph/chains/mortgage-apr-accuracy-and-tolerance-cure.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mortgage-apr-accuracy-and-tolerance-cure.md

## Workflow chain: Mortgage APR Accuracy and Tolerance Cure

Actuarial APR solve followed by TRID APR accuracy check and TRID fee tolerance cure calculation. Linear chain: computes APR, verifies it against disclosed APR within §1026.22(a) tolerance, then computes the cure amount required for any fee tolerance violation under §1026.19(e)(3).

Domain: Consumer Lending & Fair Lending

### Steps

1. art-215-reg-z-appendix-j-apr
   apr_pct and converged flag feed Stage 2 APR accuracy check
2. art-217-trid-apr-accuracy
   verdict and within_tolerance feed Stage 3 tolerance cure calculation
3. art-216-trid-tolerance-cure
   cure_required and cure_amount complete the APR accuracy and tolerance cure report - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The disclosed APR sits a few basis points above our recomputation. Does it stay inside the Reg Z tolerance?
Run the AINumbers MCP tool `run_chain` with {"chain":"mortgage-apr-accuracy-and-tolerance-cure"} and read `art-217-trid-apr-accuracy.verdict`.
Re-run with `inputs` for `art-217-trid-apr-accuracy`, reusing the values that result echoed, with `disclosed_apr_pct` set to 7.5. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mortgage-apr-accuracy-and-tolerance-cure.html
