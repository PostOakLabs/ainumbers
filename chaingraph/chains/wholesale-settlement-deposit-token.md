# Tokenized Deposit / Deposit-Token Compliance

W-B. Deposit-token classification, at-par redemption and holder-eligibility tests (ART-57) -> instrument/regime classification (510) -> Merkle integrity over the issuance/redemption set (cry-04). Distinguishes a redeemable bank-liability deposit token (JPMD/RLN) from a reserve-backed stablecoin or e-money token.

- Page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-deposit-token.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/wholesale-settlement-deposit-token.md

## Workflow chain: Tokenized Deposit / Deposit-Token Compliance

W-B. Deposit-token classification, at-par redemption and holder-eligibility tests (ART-57) -> instrument/regime classification (510) -> Merkle integrity over the issuance/redemption set (cry-04). Distinguishes a redeemable bank-liability deposit token (JPMD/RLN) from a reserve-backed stablecoin or e-money token.

Domain: Wholesale Settlement

### Steps

1. art-57-deposit-token-compliance-validator
   token_class and classification_grade (H1) feed the classifier
2. 510-digital-asset-regulatory-classifier
   regime classification (H2) feeds the integrity verifier
3. cry-04-merkle-batch-verifier
   Exports composite deposit-token artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The issuer calls this coin a deposit token. Does its liability structure actually read as a bank deposit?
Run the AINumbers MCP tool `run_chain` with {"chain":"wholesale-settlement-deposit-token"} and read `art-57-deposit-token-compliance-validator.test_results.liability.result`.
Re-run with `inputs` for `art-57-deposit-token-compliance-validator`, reusing the values that result echoed, with `liability_treatment` set to "on-balance-sheet-deposit". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-deposit-token.html
