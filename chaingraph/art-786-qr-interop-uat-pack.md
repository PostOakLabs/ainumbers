# Qr Interop Uat Pack

Generates a QR payment scheme participant user-acceptance test pack from a declared participant list (pseudonymous codes and issuer/acquirer/wallet/aggregator roles) and a scheme profile (generic, fjqr, pix_brcode). The interoperability matrix covers every ordered presenter/payer pair whose roles can transact, at most N x (N-1), with self-pairs and role-impossible pairs excluded and counted with reasons. Each transactable pair gets positive static and dynamic cases and negative cases described as mutations only (bad CRC including the excluded-6304 generator bug, wrong profile-pinned currency, missing merchant account template, malformed tag 62, static payload carrying an amount where the profile forbids it), plus optional reversal, refund, dispute and payee-name outcome cases, phased domestic first and then cross-border when foreign link profiles are declared. Case ids are content-derived and stable, counts are per phase and kind, and per-phase exit criteria are emitted. Scope limits: no payloads with real participant, merchant or account data are accepted or emitted; negative cases are described as mutations, never emitted as live QR strings; no network, no signature verification, no endorsement by EMVCo, any central bank or the World Bank is implied.

- Page: https://ainumbers.co/chaingraph/art-786-qr-interop-uat-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/art-786-qr-interop-uat-pack.md
- MCP tool: build_qr_interop_uat_pack (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "scheme_profile": "generic",
  "participants": [
    {
      "code": "P1",
      "roles": [
        "issuer",
        "wallet"
      ]
    },
    {
      "code": "P2",
      "roles": [
        "acquirer"
      ]
    },
    {
      "code": "P3",
      "roles": [
        "wallet"
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_qr_interop_uat_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
