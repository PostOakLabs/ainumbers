# x402 v2 Wire-Format Migration Linter

Lints a supplied x402 header set / 402 response body against the Protocol Version 2 wire format: flags deprecated v1 headers (X-PAYMENT, X-PAYMENT-RESPONSE) and their v2 replacements (PAYMENT-SIGNATURE, PAYMENT-RESPONSE), flags v1 body-based PaymentRequirements delivery (v2 moves requirements into the PAYMENT-REQUIRED header as a client-selectable array), and checks the network id for CAIP-2 format. Declares protocol_version so a future wire bump is a data re-pin. Pinned to coinbase/x402 specs/x402-specification-v2.md (2025-12-09).

- Page: https://ainumbers.co/chaingraph/art-393-x402-v2-migration-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-393-x402-v2-migration-linter.md
- MCP tool: lint_x402_v2_migration (endpoint https://mcp.ainumbers.co/mcp)

## Outputs

- declared_protocol_version (string, optional)
- deprecated_headers_found (array, optional)
- errors (integer, optional)
- findings (array, optional)
- inferred_wire_version (integer, optional)
- passes (integer, optional)
- protocol_version (integer, optional)
- score (integer, optional)
- spec_note (string, optional)
- v2_headers_found (array, optional)
- warnings (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_x402_v2_migration` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
