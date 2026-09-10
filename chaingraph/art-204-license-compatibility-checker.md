# License Compatibility Checker

Checks whether a child license can derive from a parent asset license. Returns compatible flag, reason codes (ND_BLOCKS_DERIVATIVE, SA_REQUIRES_SAME_LICENSE, NC_BLOCKS_COMMERCIAL, PIL_RECIPROCAL_MISMATCH, CBE_PERSONAL_NO_DERIVATIVE), required_child_license when ShareAlike or reciprocal forces a specific choice, and an SPDX-satisfies result for Creative Commons families. Not legal advice. Selection only.

- Page: https://ainumbers.co/chaingraph/art-204-license-compatibility-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-204-license-compatibility-checker.md
- MCP tool: check_license_compatibility (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- child_license (string, required)
- parent_license (string, required)

## Outputs

- checks (array, optional)
- child_license (string, optional)
- compatible (string, optional)
- disclaimer (string, optional)
- parent_license (string, optional)
- reason_codes (array, optional)
- required_child_license (string, optional)
- spdx_satisfies (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_license_compatibility` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
