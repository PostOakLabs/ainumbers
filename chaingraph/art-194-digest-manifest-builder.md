# Digest Manifest Builder

Binds N file digests into one canonical, hash-anchored manifest. manifest_sha256 is SHA-256 over the JCS-canonical sorted entries array. This builds flat manifests with no tree, which is a different job from verify_merkle_batch (cry-04, which verifies Merkle proofs); BrowserChain's log owns Merkle trees. Also serves the plain checksum-tool use case. Returns the manifest plus checks for duplicate names, duplicate digests, malformed hex, and path-like names that are flagged and basenamed. Feeds the conversion receipt builder. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-194-digest-manifest-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-194-digest-manifest-builder.md
- MCP tool: build_digest_manifest (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entries (array, optional)
- purpose (unknown, optional)
- sort (unknown, optional)

## Outputs

- all_checks_pass (boolean, optional)
- checks (array, optional)
- manifest (object, optional)

## Sample

```json
{
  "entries": [
    {
      "name": "report.pdf",
      "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "bytes": 10240,
      "media_type": "application/pdf"
    },
    {
      "name": "data.csv",
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "bytes": 512,
      "media_type": "text/csv"
    }
  ],
  "purpose": "release-bundle",
  "sort": "name"
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_digest_manifest` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
