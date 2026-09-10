# did:webvh DID Log Verifier

Verifies a did:webvh self-certifying DID log: per-entry self-hash integrity, sequential versionId numbering, update-key-authorized Ed25519 signatures on every entry, deactivation status, and optional resolved-document match. did:webs is superseded by did:webvh (DIF/ToIP, June 2026). Verify-only: never operates witness/registry infrastructure, never resolves a live document over the network.

- Page: https://ainumbers.co/chaingraph/art-284-did-webvh-log-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-284-did-webvh-log-verifier.md
- MCP tool: verify_did_webvh_log (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- did (unknown, optional)
- did_log (array, required)
- expected_document (unknown, optional)
- max_entries (number, required)

## Outputs

- current_version_id (string, optional)
- deactivated (boolean, optional)
- did (string, optional)
- entries_checked (integer, optional)
- failures (array, optional)
- valid (boolean, optional)

## Sample

```json
{
  "did": "did:webvh:{SCID}:example.com:agents:alpha",
  "did_log": [
    {
      "versionId": "1-e42e4191001ee7d68d48609c2f30b141bd0a38da21496378a29108720c435a56",
      "versionTime": "2026-01-01T00:00:00Z",
      "parameters": {
        "method": "did:webvh:1.0",
        "scid": "QmScidPlaceholder1234567890abcdef1234567890abcdef1234567890",
        "updateKeys": [
          "did:key:z6MkfJpX7dP5KqfxbK9nN3ttWptKBjRGrCqJaW28zqBUnRjX"
        ],
        "portable": false
      },
      "state": {
        "id": "did:webvh:{SCID}:example.com:agents:alpha",
        "verificationMethod": [
          {
            "id": "did:webvh:{SCID}:example.com:agents:alpha#key-1",
            "type": "Ed25519VerificationKey2020",
            "controller": "did:webvh:{SCID}:example.com:agents:alpha",
            "publicKeyMultibase": "z6MkfJpX7dP5KqfxbK9nN3ttWptKBjRGrCqJaW28zqBUnRjX"
          }
        ]
      },
      "proof": [
        {
          "type": "DataIntegrityProof",
          "cryptosuite": "eddsa-jcs-2022",
          "verificationMethod": "did:key:z6MkfJpX7dP5KqfxbK9nN3ttWptKBjRGrCqJaW28zqBUnRjX",
          "proofPurpose": "assertionMethod",
          "proofValue": "1Ha0QDlQmx8Ch0H+ARATa1UU6jnghtm2LpqpV11m//W+42YnRwc9Bl8sx43JLmEskTzcSlngUcQdgFgrLK6lBg=="
        }
      ]
    },
    {
      "versionId": "2-81ead391846f6088ddab084e2119b8304224a671b6c3f4b598605661ccd91196",
      "versionTime": "2026-02-01T00:00:00Z",
      "parameters": {
        "updateKeys": [
          "did:key:z6MknN3rKuzKRmKyRQheSZ2n8yBKCwsTfZprYj1HBmF48bp2"
        ]
      },
      "state": {
        "id": "did:webvh:{SCID}:example.com:agents:alpha",
        "verificationMethod": [
          {
            "id": "did:webvh:{SCID}:example.com:agents:alpha#key-1",
            "type": "Ed25519VerificationKey2020",
            "controller": "did:webvh:{SCID}:example.com:agents:alpha",
            "publicKeyMultibase": "z6MkfJpX7dP5KqfxbK9nN3ttWptKBjRGrCqJaW28zqBUnRjX"
          }
        ],
        "service": [
          {
            "id": "did:webvh:{SCID}:example.com:agents:alpha#agent-endpoint",
            "type": "AgentEndpoint",
            "serviceEndpoint": "https://example.com/agents/alpha"
          }
        ]
      },
      "proof": [
        {
          "type": "DataIntegrityProof",
          "cryptosuite": "eddsa-jcs-2022",
          "verificationMethod": "did:key:z6MkfJpX7dP5KqfxbK9nN3ttWptKBjRGrCqJaW28zqBUnRjX",
          "proofPurpose": "assertionMethod",
          "proofValue": "PUj6zxdMWvEQeQhhfCHShlQzgagicFXph2tFcQK9e3RGF6/8yHNr3ASsUTiHySBhfOWv1A7J3PnoVy4qEBVrCg=="
        }
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_did_webvh_log` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
