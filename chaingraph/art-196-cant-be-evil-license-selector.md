# Can't Be Evil License Selector

Rights-matrix lookup for a16z's six Can't Be Evil NFT licenses. Maps creator answers (waive all, commercial use, exclusivity, objectionable-use restriction) to the matching license. Returns both on-chain enum names (launch alias and current Oct 2022 name), Solidity LicenseVersion ordinal, both Arweave manifest URIs, full rights matrix, and normative caveats verified against canonical license PDFs. Selection only, not legal advice. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-196-cant-be-evil-license-selector.html
- Markdown twin: https://ainumbers.co/chaingraph/art-196-cant-be-evil-license-selector.md
- MCP tool: select_cbe_license (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- commercial (unknown, optional)
- exclusive (unknown, optional)
- hate_speech_termination (unknown, optional)
- waive_all (unknown, optional)

## Outputs

- arweave_uri (string, optional)
- arweave_uri_legacy (string, optional)
- caveats (array, optional)
- cbe_id (string, optional)
- commercial (boolean, optional)
- creator_retains (boolean, optional)
- current_enum_name (string, optional)
- derivatives (boolean, optional)
- disclaimer (string, optional)
- exclusivity (string, optional)
- launch_alias (string, optional)
- license_version_index (integer, optional)
- matrix_verified (string, optional)
- objectionable_use_restriction (boolean, optional)
- reference_url (string, optional)
- sublicense (string, optional)

## Sample

```json
{
  "waive_all": "yes"
}
```

## Verify

Run the sample policy_parameters through MCP tool `select_cbe_license` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
