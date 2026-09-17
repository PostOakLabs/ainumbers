# EMIR Trade Report Validation

Validate the required-field subset of an EMIR Refit ISO 20022 auth.030 derivative trade report: action type, counterparty LEIs, UTI, UPI, notional, currency, effective date, and asset class (art-153) -> validate UTI format (ISO 23897, 52 chars max), generating-party identity, and T+1 10:00 CET sharing timing (art-154) -> validate UPI format (ISO 4914, 12-char ANNA DSB) and product classification consistency against asset class and instrument type (art-155). Exports field-level validity verdict with execution_hash.

- Page: https://ainumbers.co/chaingraph/chains/emir-trade-report-validation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/emir-trade-report-validation.md

## Workflow chain: EMIR Trade Report Validation

Validate the required-field subset of an EMIR Refit ISO 20022 auth.030 derivative trade report: action type, counterparty LEIs, UTI, UPI, notional, currency, effective date, and asset class (art-153) -> validate UTI format (ISO 23897, 52 chars max), generating-party identity, and T+1 10:00 CET sharing timing (art-154) -> validate UPI format (ISO 4914, 12-char ANNA DSB) and product classification consistency against asset class and instrument type (art-155). Exports field-level validity verdict with execution_hash.

Domain: EMIR

### Steps

1. art-153-emir-trade-report-field-validator
   Field validity feeds UTI completeness checker
2. art-154-emir-uti-completeness-checker
   UTI completeness feeds UPI validator
3. art-155-emir-upi-validator
   Exports UPI validity verdict with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
