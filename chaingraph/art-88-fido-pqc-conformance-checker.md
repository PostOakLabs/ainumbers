# FIDO2 / WebAuthn PQC Conformance Checker

Validates FIDO2/WebAuthn authenticator ML-DSA conformance vs IANA COSE algorithm registry identifiers and CTAP2.3 minimum version. Checks COSE identifier presence and CTAP version. Scoped to credential crypto-suite migration - credential FORMAT/protocol conformance belongs to any future EUDI wave.

- Page: https://ainumbers.co/chaingraph/art-88-fido-pqc-conformance-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-88-fido-pqc-conformance-checker.md
- MCP tool: check_fido_pqc_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- authenticator (unknown, optional)
- target_pqc (unknown, optional)

## Outputs

- attestation_format (string, optional)
- conformant (boolean, optional)
- cose_pqc_registry (object, optional)
- ctap_pqc_ready (boolean, optional)
- ctap_version (string, optional)
- gaps (array, optional)
- hybrid_status (string, optional)
- note (string, optional)
- reference_version (string, optional)
- supported_pqc_cose_ids (array, optional)
- target_cose_id (integer, optional)
- target_pqc (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_fido_pqc_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
