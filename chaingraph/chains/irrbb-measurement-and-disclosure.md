# IRRBB Measurement and Disclosure

Map non-maturing deposit positions to EBA standardised-approach behavioural caps (art-186) -> identify Credit Spread Risk in the Banking Book (CSRBB) scope and governance gaps (art-187) -> A-F IRRBB disclosure readiness diagnostic across shock calc, SOT, standardised approach, CSRBB, and Pillar 3 IRRBB1 dimensions (art-188). Full IRRBB measurement and disclosure pipeline. BCBS d368 + EBA GL/2022/14 + Pillar 3 IRRBB1.

- Page: https://ainumbers.co/chaingraph/chains/irrbb-measurement-and-disclosure.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/irrbb-measurement-and-disclosure.md

## Workflow chain: IRRBB Measurement and Disclosure

Map non-maturing deposit positions to EBA standardised-approach behavioural caps (art-186) -> identify Credit Spread Risk in the Banking Book (CSRBB) scope and governance gaps (art-187) -> A-F IRRBB disclosure readiness diagnostic across shock calc, SOT, standardised approach, CSRBB, and Pillar 3 IRRBB1 dimensions (art-188). Full IRRBB measurement and disclosure pipeline. BCBS d368 + EBA GL/2022/14 + Pillar 3 IRRBB1.

Domain: IRRBB

### Steps

1. art-186-irrbb-standardised-approach-mapper
   NMD core/maturity mapping feeds CSRBB scope checker
2. art-187-irrbb-csrbb-scope-checker
   CSRBB scope and governance gaps feed disclosure readiness diagnostic
3. art-188-irrbb-disclosure-readiness-diagnostic
   Exports A-F IRRBB disclosure readiness grade with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
