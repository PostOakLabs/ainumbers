# JWKS Pinned-Directory Check

Confirm a caller-supplied JWKS directory document matches a caller-pinned SHA-256 digest (sha256(canonicalize(directory_jwks)) === pinned_digest) before art-130 trusts its shape. Zero network, zero key hosting - both the document and the digest are caller-supplied. Chains before art-130 in visa-tap-agent-verification.

- Page: https://ainumbers.co/chaingraph/art-609-jwks-pinned-directory-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-609-jwks-pinned-directory-check.md
- MCP tool: check_jwks_pinned_directory (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- directory_jwks (object, required)
- pinned_digest (string, required)

## Outputs

- computed_digest (string, optional)
- pinned_digest (string,null, optional)
- pinned_digest_well_formed (boolean, optional)
- digest_match (boolean, optional)
- key_count (number, optional)

## Sample

```json
{
  "directory_jwks": {
    "keys": [
      {
        "kty": "OKP",
        "crv": "Ed25519",
        "kid": "key-2026-06",
        "x": "WrHvnND7oaWfvrGxUU3FNeJaQDwYj4K3e5fl0fH5p2g"
      }
    ]
  },
  "pinned_digest": "45d28be3698cb02c2a658ecb15c292076254ca24cd797bc75a39dacd244a028d"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_jwks_pinned_directory` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
