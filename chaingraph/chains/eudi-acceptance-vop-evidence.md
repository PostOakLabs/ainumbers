# EUDI Credential Acceptance and VoP Session Evidence

Three independent computations a payment service provider runs over the same payee-verification surface. Step 1 scores eIDAS 2.0 credential acceptance readiness against the EUDI Wallet attestation profiles (art-13). Step 2 runs the verification-of-payee readiness diagnostic (art-548). Step 3 builds a hash-chained VoP session receipt over a declared attempt record (art-377). Each step computes from its own declared inputs; the order is analytical. EUDI Wallet member-state rollout is dated November 2026.

- Page: https://ainumbers.co/chaingraph/chains/eudi-acceptance-vop-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/eudi-acceptance-vop-evidence.md

## Workflow chain: EUDI Credential Acceptance and VoP Session Evidence

Three independent computations a payment service provider runs over the same payee-verification surface. Step 1 scores eIDAS 2.0 credential acceptance readiness against the EUDI Wallet attestation profiles (art-13). Step 2 runs the verification-of-payee readiness diagnostic (art-548). Step 3 builds a hash-chained VoP session receipt over a declared attempt record (art-377). Each step computes from its own declared inputs; the order is analytical. EUDI Wallet member-state rollout is dated November 2026.

Domain: EU Digital ID & Consumer Credit

### Steps

1. art-13-eudi-wallet-credential-readiness-checker
   Credential acceptance readiness score, gap list and relying-party obligations for the declared credential format and issuer country. Stage 1 of 3.
2. art-548-vop-readiness-diagnostic
   Verification-of-payee readiness diagnostic over the declared scheme posture and matching configuration. Stage 2 of 3.
3. art-377-build-vop-session-receipt
   Hash-chained VoP session receipt over the declared attempt record, with the session outcome and final receipt hash. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Does the bank's Verification-of-Payee response code agree with the match score we computed for this payee name?
Run the AINumbers MCP tool `run_chain` with {"chain":"eudi-acceptance-vop-evidence"} and read `art-548-vop-readiness-diagnostic.consistent`.
Re-run with `inputs` for `art-548-vop-readiness-diagnostic`, reusing the values that result echoed, with `psp_vop_response_code` changed so psp_vop_response_code is NMTCH while the match score stays 0.97. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/eudi-acceptance-vop-evidence.html
