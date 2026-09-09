# Creative Commons License Chooser

Deterministic two-question decision tree mapping creator answers (waive all rights, allow commercial, allow adaptations) to the matching Creative Commons 4.0 license (CC0, CC BY, BY-SA, BY-ND, BY-NC, BY-NC-SA, BY-NC-ND). Returns license id, SPDX id, canonical deed URL, required elements, and attribution requirement. Selection only, not legal advice. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-195-creative-commons-license-chooser.html
- Markdown twin: https://ainumbers.co/chaingraph/art-195-creative-commons-license-chooser.md
- MCP tool: choose_cc_license (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- allow_adaptations (unknown, optional)
- allow_commercial (unknown, optional)
- waive_all_rights (unknown, optional)

## Outputs

- attribution_required (boolean, optional)
- disclaimer (string, optional)
- license_id (string, optional)
- license_name (string, optional)
- license_url (string, optional)
- required_elements (array, optional)
- source (string, optional)
- spdx_id (string, optional)

## Sample

```json
{
  "waive_all_rights": "yes",
  "allow_commercial": "yes",
  "allow_adaptations": "yes"
}
```

## Verify

Run the sample policy_parameters through MCP tool `choose_cc_license` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
