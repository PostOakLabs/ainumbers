# IRRBB CSRBB Scope Checker

Identify Credit Spread Risk in the Banking Book (CSRBB) scope per EBA Guidelines on IRRBB and CSRBB (EBA/GL/2022/14): instruments held at fair value whose credit-spread risk is not fully captured by credit-risk or IRRBB frameworks (FVOCI/AFS bond books, fair-valued loans, liquidity-buffer bonds) put a bank in scope, requiring a defined methodology and ICAAP inclusion. No EU-wide materiality threshold is prescribed - proportionality is a competent-authority / institution judgment. Second node of the irrbb-measurement-and-disclosure chain. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-187-irrbb-csrbb-scope-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-187-irrbb-csrbb-scope-checker.md
- MCP tool: check_irrbb_csrbb_scope (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- governance (unknown, optional)
- instruments (unknown, optional)

## Outputs

- csrbb_conformant (boolean, optional)
- csrbb_included_in_icaap (boolean, optional)
- csrbb_methodology_defined (boolean, optional)
- gaps (array, optional)
- in_scope (boolean, optional)
- in_scope_amount (integer, optional)

## Sample

```json
{
  "instruments": {
    "fvoci_afs_bonds": 500,
    "fair_value_loans": 0,
    "liquidity_buffer_bonds": 200
  },
  "governance": {
    "csrbb_methodology_defined": false,
    "csrbb_included_in_icaap": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_irrbb_csrbb_scope` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
