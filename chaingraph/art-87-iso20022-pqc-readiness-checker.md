# SWIFT / ISO 20022 PQC Readiness Checker

Scores SWIFT/ISO 20022 PQC readiness with BAH signature-bloat sizing per the BIS Project Leap Phase 2 model (ML-DSA ~12.9x RSA payload at BAH level). Models new message sizes against current limits and flags size breaches. Reuses HNDL priority from tool 500.

- Page: https://ainumbers.co/chaingraph/art-87-iso20022-pqc-readiness-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-87-iso20022-pqc-readiness-checker.md
- MCP tool: check_iso20022_pqc_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- hndl_priority_ref (unknown, optional)
- messaging (unknown, optional)
- pqc_algorithm (unknown, optional)

## Outputs

- affected_message_types (array, optional)
- algorithm_refs (object, optional)
- bis_leap_bloat_factor (number, optional)
- bis_leap_ref (string, optional)
- bloat_factor (number, optional)
- current_sig_bytes (integer, optional)
- hndl_priority_ref (string, optional)
- new_message_size_bytes (integer, optional)
- new_sig_bytes (integer, optional)
- note (string, optional)
- readiness_score (integer, optional)
- reference_version (string, optional)
- size_breach (boolean, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_iso20022_pqc_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
