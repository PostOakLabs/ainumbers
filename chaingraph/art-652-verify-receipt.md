# Verify Receipt

Offline verifier for AINumbers Evidence Envelope v0.1 receipts. Given a receipt JSON, recomputes the RFC 8785 JCS signing preimage, verifies the Ed25519 (EdDSA) signature against the did:key resolved from issuer_id/signatures[].kid, checks hash-field shape (sha256:-prefixed, 64 hex chars), and, when a prior receipt is supplied, recomputes previousReceiptHash to prove the chain link. Verify-only: never issues a receipt, never contacts a transparency log or registry, never resolves a DID document over the network. Every check recomputes from the receipt's own bytes; no self-claimed hash or verdict field is trusted (SO #34).

- Page: https://ainumbers.co/chaingraph/art-652-verify-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/art-652-verify-receipt.md
- MCP tool: compute_verify_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- previous_receipt (unknown, optional)
- receipt (unknown, optional)

## Outputs

- errors (array, optional)

## Sample

```json
{
  "receipt": {
    "schema": "ainumbers.evidence.v0.1",
    "receipt_id": "r-0001",
    "event_type": "policy_decision",
    "source_adapter": "native-tool",
    "issuer_id": "did:key:z6MkwQ66vScU6Hepc1oKGpu5TrMaCDM1oQQsaGSbEzB52pZH",
    "issued_at": "2026-08-20T14:00:00Z",
    "result_status": "success",
    "input_hash": "sha256:e979b29ee8bcaf3f544784e34d467b70c683ab5d09e55c25e3b435245a77ccff",
    "policy_digest": "sha256:ea9ede5814bedf41150053db439d54a24235dd62d18510d5288f6855d26da5b3",
    "execution_hash": "sha256:fa15b56aeacde51aee48abb5342b48d13184689698d40993eab079ac95b8e46e",
    "output_hash": "sha256:b5e78a89b3d010bb4265a4e77a27bf70b2ec13d52200471f35b896f989d0f1cd",
    "links": [],
    "extensions": {},
    "signatures": [
      {
        "alg": "EdDSA",
        "kid": "did:key:z6MkwQ66vScU6Hepc1oKGpu5TrMaCDM1oQQsaGSbEzB52pZH",
        "value": "1h6aJpKXmQZVBwJIrKK9Vm2L--OulcUwORtKcimojjInu8hGo-AMQcQIoSUf9Jk6qB18jldkZ2HsQw612VogBA"
      }
    ],
    "unprotected": {
      "proofs": {},
      "countersignatures": []
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_verify_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
