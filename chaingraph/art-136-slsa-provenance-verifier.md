# SLSA Provenance Verifier

Verifies an in-toto SLSA provenance statement: validates _type (in-toto.io/Statement) and predicateType (slsa.dev/provenance), checks subject SHA-256 digest against caller-supplied artifact_digest_sha256, asserts builder.id present via runDetails.builder.id or predicate.builder.id, reports claimed_build_level 0-3. Middle stage of sbom-provenance-attestation chain.

- Page: https://ainumbers.co/chaingraph/art-136-slsa-provenance-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-136-slsa-provenance-verifier.md
- MCP tool: verify_slsa_provenance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- artifact_digest_sha256 (unknown, optional)
- claimed_build_level (unknown, optional)
- statement (unknown, optional)

## Outputs

- builder_id_present (boolean, optional)
- pred_ok (boolean, optional)
- provenance_valid (boolean, optional)
- slsa_build_level (integer, optional)
- subject_digest_match (boolean, optional)
- type_ok (boolean, optional)

## Sample

```json
{
  "statement": {
    "_type": "https://in-toto.io/Statement/v0.1",
    "predicateType": "https://slsa.dev/provenance/v1",
    "subject": [
      {
        "name": "app.tar.gz",
        "digest": {
          "sha256": "abc123def456"
        }
      }
    ],
    "predicate": {
      "runDetails": {
        "builder": {
          "id": "https://github.com/actions/runner/ubuntu-22.04@v2"
        }
      }
    }
  },
  "artifact_digest_sha256": "abc123def456",
  "claimed_build_level": 2
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_slsa_provenance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
