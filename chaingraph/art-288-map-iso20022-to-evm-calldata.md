# ISO 20022-to-EVM Calldata Mapper

Deterministic bind of an ISO 20022 pacs.008 (customer credit transfer) or pacs.009 (FI credit transfer) payment message to EVM contract-call arguments, plus an OCG receipt of the mapping: resolved call, field bindings, unmapped required fields, and ABI type coercions. Draft-pinned generic ISO-20022-to-EVM profile: Swift blockchain-based shared ledger MVP (Besu/EVM-compatible, live 2026-07-09) has not published a field-binding table or a fixed contract ABI shape. Never queries a chain or RPC.

- Page: https://ainumbers.co/chaingraph/art-288-map-iso20022-to-evm-calldata.html
- Markdown twin: https://ainumbers.co/chaingraph/art-288-map-iso20022-to-evm-calldata.md
- MCP tool: map_iso20022_to_evm_calldata (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- contract_abi_fragment (unknown, required)
- iso_fields (unknown, required)
- iso_message_type (unknown, required)
- mapping_profile (unknown, required)

## Outputs

- abi_type_coercions (array, optional)
- draft_pinned (boolean, optional)
- field_bindings (array, optional)
- iso_message_type (string, optional)
- mapping_ok (boolean, optional)
- mapping_profile (string, optional)
- mapping_profile_version (string, optional)
- resolved_call (object, optional)
- unmapped_required_fields (array, optional)
- warnings (array, optional)

## Sample

```json
{
  "iso_message_type": "pacs.008",
  "iso_fields": {
    "instructedAmount": "1250.50",
    "currency": "USD",
    "debtorAccount": "DE89370400440532013000",
    "creditorAccount": "GB29NWBK60161331926819",
    "endToEndId": "E2E-REF-001",
    "uetr": "8a562df1-2b76-4e8b-9f66-1234567890ab",
    "purposeCode": "TRAD"
  },
  "contract_abi_fragment": {
    "function": "settlePayment",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256"
      },
      {
        "name": "currency",
        "type": "bytes32"
      },
      {
        "name": "creditor",
        "type": "bytes32"
      }
    ]
  },
  "mapping_profile": "draft-generic-evm"
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_iso20022_to_evm_calldata` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
