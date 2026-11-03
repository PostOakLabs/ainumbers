# CBPR+ Address Lint Chain

Linear three-step chain for CBPR+ November 2026 structured address migration. Step 1 lints a PostalAddress24 block for structure type (FULLY_STRUCTURED, HYBRID, UNSTRUCTURED) and silent-fail duplication. Step 2 validates BIS CPMI d218 party completeness (UETR UUIDv4, party names, BIC, LEI format, purpose code format). Step 3 validates originator and beneficiary LEIs via ISO 17442 mod-97 and scores Wolfsberg payment transparency. All three steps always run. ZERO PII BY CONSTRUCTION: addresses are structural fields only, LEIs are public GLEIF registry data.

- Page: https://ainumbers.co/chaingraph/chains/cbpr-address-lint-chain.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cbpr-address-lint-chain.md

## Workflow chain: CBPR+ Address Lint Chain

Linear three-step chain for CBPR+ November 2026 structured address migration. Step 1 lints a PostalAddress24 block for structure type (FULLY_STRUCTURED, HYBRID, UNSTRUCTURED) and silent-fail duplication. Step 2 validates BIS CPMI d218 party completeness (UETR UUIDv4, party names, BIC, LEI format, purpose code format). Step 3 validates originator and beneficiary LEIs via ISO 17442 mod-97 and scores Wolfsberg payment transparency. All three steps always run. ZERO PII BY CONSTRUCTION: addresses are structural fields only, LEIs are public GLEIF registry data.

Domain: Cross-Border & Instant Payments

### Steps

1. art-241-cbpr-structured-address-linter
   PostalAddress24 structure type, silent-fail violations, and per-field lint results. Passes to party completeness validation.
2. art-242-pacs008-party-completeness-validator
   CPMI d218 completeness score, UETR format check, BIC/LEI format checks. Passes to LEI check-digit validation.
3. art-246-lei-payment-binding-linter
   ISO 17442 mod-97 LEI check-digit results and Wolfsberg transparency tier. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Will this debtor address pass the November 2026 CBPR+ structured-address rules, or will the bank reject the payment message?
Run the AINumbers MCP tool `run_chain` with {"chain":"cbpr-address-lint-chain"} and read `art-241-cbpr-structured-address-linter.compliant`.
Re-run with `inputs` for `art-241-cbpr-structured-address-linter`, reusing the values that result echoed, with `address_lines` changed so street_name and building_number are empty and address_lines holds two free-text lines. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cbpr-address-lint-chain.html
