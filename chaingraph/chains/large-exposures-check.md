# Large Exposures Limit Check (Basel III / Regulation YY)

Single-node check aggregating each counterparty group's exposure against the Basel III / Regulation YY 25% (general) or 15% (GSIB-to-GSIB) single-counterparty limit, emitting a breach-list artifact.

- Page: https://ainumbers.co/chaingraph/chains/large-exposures-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/large-exposures-check.md

## Workflow chain: Large Exposures Limit Check (Basel III / Regulation YY)

Single-node check aggregating each counterparty group's exposure against the Basel III / Regulation YY 25% (general) or 15% (GSIB-to-GSIB) single-counterparty limit, emitting a breach-list artifact.

Domain: Bank Capital & Credit Risk

### Steps

1. art-425-large-exposures-limit-check
   breach-list artifact feeds Basel III / Regulation YY large-exposures reporting and routes any breaching group to the §27 review gate; standalone recurring check per reporting date

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
