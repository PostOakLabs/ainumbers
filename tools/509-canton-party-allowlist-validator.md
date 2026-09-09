# Canton Party Allowlist Validator

Screen counterparties against FATF Travel Rule, AML/KYA requirements, and canton allowlist rules for Canton Network onboarding. Emits allowlist_verdict, FATF flags, and approved party list.

- Page: https://ainumbers.co/tools/509-canton-party-allowlist-validator.html
- Markdown twin: https://ainumbers.co/tools/509-canton-party-allowlist-validator.md
- MCP tool: validate_canton_party_allowlist (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- parties (array, required)

## Outputs

- party_results (array, optional)
- portfolio_verdict (string, optional)
- compliance_flags (object, optional)
- iso20022_party_identification (array, optional)

## Sample

```json
{
  "parties": [
    {
      "party_name": "Test Bank Ltd",
      "lei": "TEST0000000000000001",
      "daml_party_id": "TestBank::AAAA",
      "daml_party_id_known": true,
      "fatf_status": "clean",
      "pep": false,
      "adverse_media": false,
      "canton_access": "granted"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_canton_party_allowlist` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
