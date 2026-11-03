# Modified Premium Calculator

Workers'-compensation modified premium: subject premium (total manual premium plus premium items subject to experience rating) times the experience modification, rounded to whole dollars per the pinned Whole Dollars - Premiums rule. Subject premium composition is the caller's responsibility - this node does not compute manual premium from payrolls and rates and never vendors or reproduces NCCI or state rate tables. Out of scope: premium discount, expense constant, terrorism/catastrophe surcharges, state taxes, schedule rating and assigned-risk surcharge; the NCCI formula does not apply in the monopolistic state funds (Ohio, North Dakota, Washington, Wyoming) or the Puerto Rico and USVI funds. A mod of 0 or less flags and never yields a premium.

- Page: https://ainumbers.co/chaingraph/art-782-modified-premium.html
- Markdown twin: https://ainumbers.co/chaingraph/art-782-modified-premium.md
- MCP tool: compute_modified_premium (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- mod (number, required)
- subject_premium (number, required)

## Outputs

- modified_premium (integer,null, optional)
- mod (number,null, optional)
- subject_premium (number,null, optional)
- regulatory_basis (string, optional)
- note (string, optional)
- gate (string, optional)

## Sample

```json
{
  "mod": 0.9,
  "subject_premium": 10000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_modified_premium` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
