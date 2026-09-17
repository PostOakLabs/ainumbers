# PQC Migration Evidence Workflow

Structural CBOM lint and CNSA-2.0 classification feeding a per-row CNSA-2.0 deadline calculation: two receipts binding a declared cryptography inventory to its asserted quantum-vulnerable findings and its migration deadlines.

- Page: https://ainumbers.co/chaingraph/chains/pqc-migration-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pqc-migration-evidence.md

## Workflow chain: PQC Migration Evidence Workflow

Structural CBOM lint and CNSA-2.0 classification feeding a per-row CNSA-2.0 deadline calculation: two receipts binding a declared cryptography inventory to its asserted quantum-vulnerable findings and its migration deadlines.

Domain: Post-Quantum Cryptography

### Steps

1. art-386-lint-cbom-structure
   Components classified quantum_vulnerable or cnsa2_ready feed Stage 2 as declared inventory rows - asset_type mapped from each finding's primitive (key-encapsulation/key-establishment -> key-establishment, signature -> signature), system_class and deployment_date supplied per system alongside the CBOM.
2. art-387-pqc-deadline-ladder-calculator
   Returns the applicable CNSA-2.0 deadline, days remaining, earliest binding constraint, and FIPS 140-2 Historical-list exposure flag per inventory row - the terminal migration-evidence receipt.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
