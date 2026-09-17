# Content Credential Signature Verifier

Deterministic policy core over a caller-attested signature result. The caller performs the COSE_Sign1 signature check over the manifest bytes with the declared alg (Ed25519/ES256/ES384/PS256) and attests the outcome via the required signature_verified input; the kernel does not re-verify. Trust-anchor membership, cert validity window, and revocation status are caller-supplied policy inputs: zero network, no OCSP. Emits ACCEPT or REFUSE verdict. The signature caveat travels inside the hashed output_payload (signature_verification: caller_attested); full in-guest verification returns in a separate accelerated-guest row.

- Page: https://ainumbers.co/chaingraph/art-124-content-credential-signature-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-124-content-credential-signature-verifier.md
- MCP tool: verify_content_credential_signature (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "alg": "Ed25519",
  "signature_verified": true,
  "trust_anchor_match": true,
  "cert_not_expired": true,
  "revocation_status": "good"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_content_credential_signature` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
