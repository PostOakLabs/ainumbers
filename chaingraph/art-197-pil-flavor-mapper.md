# Story PIL Flavor Mapper

Maps creator answers (commercial use, derivatives allowed, optional minting fee, revenue share percent) to a Story Protocol Programmable IP License flavor and emits the full PILTerms struct. Three flavors: non_commercial_social_remixing (licenseTermsId=1, the protocol constant), commercial_use, and commercial_remix. Selection only, not legal advice. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-197-pil-flavor-mapper.html
- Markdown twin: https://ainumbers.co/chaingraph/art-197-pil-flavor-mapper.md
- MCP tool: map_pil_flavor (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- commercial_use (unknown, optional)
- derivatives_allowed (unknown, optional)
- minting_fee (unknown, optional)
- rev_share_pct (unknown, optional): Percentage value

## Outputs

- disclaimer (string, optional)
- docs (string, optional)
- flavor (string, optional)
- flavor_label (string, optional)
- license_terms_id (integer, optional)
- pil_terms (object, optional)

## Sample

```json
{
  "commercial_use": "no",
  "derivatives_allowed": "yes"
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_pil_flavor` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
