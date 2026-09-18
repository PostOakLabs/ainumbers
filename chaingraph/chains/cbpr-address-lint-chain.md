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
