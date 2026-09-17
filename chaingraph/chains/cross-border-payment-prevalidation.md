# Cross-Border Payment Pre-Validation

Gated two-step chain for CBPR+ payment pre-validation. Step 1 checks whether a purpose code is mandatory for the beneficiary jurisdiction (UAE, India, Bahrain, Jordan, China, Malaysia per BIS CPMI d218) and whether SwiftGo eligibility conditions are met. Step 2 runs aggregate pre-validation (IBAN mod-97, BIC format, LEI format, UETR UUIDv4, PostalAddress24 structure) and emits a /ready boolean. Gate on /ready: both branches terminate, recording in decisions[] which path was taken. ready=true = STP-eligible; ready=false = remediation required. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/cross-border-payment-prevalidation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cross-border-payment-prevalidation.md

## Workflow chain: Cross-Border Payment Pre-Validation

Gated two-step chain for CBPR+ payment pre-validation. Step 1 checks whether a purpose code is mandatory for the beneficiary jurisdiction (UAE, India, Bahrain, Jordan, China, Malaysia per BIS CPMI d218) and whether SwiftGo eligibility conditions are met. Step 2 runs aggregate pre-validation (IBAN mod-97, BIC format, LEI format, UETR UUIDv4, PostalAddress24 structure) and emits a /ready boolean. Gate on /ready: both branches terminate, recording in decisions[] which path was taken. ready=true = STP-eligible; ready=false = remediation required. ZERO PII BY CONSTRUCTION.

Domain: Cross-Border & Instant Payments

### Steps

1. art-243-purpose-code-requirement-checker
   Jurisdiction purpose code requirement and SwiftGo eligibility. Passes to aggregate pre-validation.
2. art-247-prevalidation-readiness-scorer
   Aggregate /ready boolean and per-check detail. Gate: ready=true exits STP-eligible; ready=false exits requiring remediation.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
