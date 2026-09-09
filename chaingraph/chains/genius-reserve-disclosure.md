# GENIUS Act Monthly Reserve Disclosure

Single-node D0 diagnostic linting an extracted monthly reserve disclosure against GENIUS Act S.394 §4: composition, tenor, custody, certification, examiner, MoM diff, on-chain supply cross-check.

- Page: https://ainumbers.co/chaingraph/chains/genius-reserve-disclosure.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/genius-reserve-disclosure.md

## Workflow chain: GENIUS Act Monthly Reserve Disclosure

Single-node D0 diagnostic linting an extracted monthly reserve disclosure against GENIUS Act S.394 §4: composition, tenor, custody, certification, examiner, MoM diff, on-chain supply cross-check.

Domain: Digital-Asset Rails

### Steps

1. art-275-genius-reserve-disclosure-checker
   monthly_disclosure_determination and failing_dimensions feed the issuer's compliance record; standalone monthly recurring check

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
