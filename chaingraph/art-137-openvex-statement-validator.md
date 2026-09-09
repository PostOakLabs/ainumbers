# OpenVEX Statement Validator

Validates an OpenVEX document: @context includes openvex.dev, every statement carries vulnerability, products[], status in [not_affected,affected,fixed,under_investigation], and not_affected statements must include justification. Emits vex_valid verdict and per-statement gap list. Terminal stage of sbom-provenance-attestation chain.

- Page: https://ainumbers.co/chaingraph/art-137-openvex-statement-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-137-openvex-statement-validator.md
- MCP tool: validate_openvex_statement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- vex (unknown, optional)

## Outputs

- context_ok (boolean, optional)
- invalid_statements (array, optional)
- statement_count (integer, optional)
- vex_valid (boolean, optional)

## Sample

```json
{
  "vex": {
    "@context": "https://openvex.dev/ns/v0.2.0",
    "statements": [
      {
        "vulnerability": {
          "name": "CVE-2026-0001"
        },
        "products": [
          "pkg:generic/app@1.0"
        ],
        "status": "not_affected",
        "justification": "vulnerable_code_not_in_execute_path"
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_openvex_statement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
