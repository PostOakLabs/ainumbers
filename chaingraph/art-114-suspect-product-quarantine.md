# DSCSA Suspect/Illegitimate Product Quarantine Assessor

Determine suspect vs illegitimate product status and required actions (quarantine, investigate, 72-hour FDA Form 3911 notification, trading partner notification). Terminal stage of pharma-serialization-custody chain.

- Page: https://ainumbers.co/chaingraph/art-114-suspect-product-quarantine.html
- Markdown twin: https://ainumbers.co/chaingraph/art-114-suspect-product-quarantine.md
- MCP tool: assess_suspect_product_status (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- counterfeit_indicators (any, optional): type not evidenced by kernel source
- fda_notified (any, optional): type not evidenced by kernel source
- identifier_unmatched (any, optional): type not evidenced by kernel source
- quarantined (any, optional): type not evidenced by kernel source
- verification_failed (any, optional): type not evidenced by kernel source

## Outputs

- required_actions (array, optional)
- status (string, optional)

## Sample

```json
{
  "verification_failed": false,
  "identifier_unmatched": false,
  "counterfeit_indicators": [],
  "quarantined": false,
  "fda_notified": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_suspect_product_status` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
