# Content Credential Signature Verifier

Verify-only node: callable in chains, carrying no compute-proof claim. Verify the COSE_Sign1 claim signature against a caller-supplied signer public key using crypto.subtle.verify (Ed25519/ES256/ES384/PS256). Trust-anchor membership, cert validity window, and revocation status are caller-supplied policy inputs: zero network, no OCSP. Emits ACCEPT or REFUSE verdict. PS256 (RSA-PSS) support means this kernel has no faithful sync in-guest verifier today, so its zkVM compute-integrity proof is out of the ocg-p18-deterministic profile's scope: not counted as proven.

- Page: https://ainumbers.co/chaingraph/art-124-content-credential-signature-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-124-content-credential-signature-verifier.md
- MCP tool: verify_content_credential_signature (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "alg": "Ed25519",
  "signer_public_key_jwk": {
    "key_ops": [
      "verify"
    ],
    "ext": true,
    "alg": "Ed25519",
    "crv": "Ed25519",
    "x": "UCJluj4JmGYxBS1ecl_Q8kHKgd4ASBu6Hx6sHgfb0kk",
    "kty": "OKP"
  },
  "signed_bytes_b64": "YzJwYS10ZXN0LXNpZ25lZC1jbGFpbS1ieXRlcy0yMDI2LTA2LTI1",
  "signature_b64": "BSIkzTIAjJ2YVc347NUIBXJZAtx9uE5oSdhMIvA5LrL4UDdBkvpx2KSL5J8SJQOZro6M2m3iHAXbK+b7/YEBAQ==",
  "trust_anchor_match": true,
  "cert_not_expired": true,
  "revocation_status": "good"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_content_credential_signature` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
