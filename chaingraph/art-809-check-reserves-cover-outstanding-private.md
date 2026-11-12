# Private-Input Reserves Cover Outstanding Check

Pilot private-input predicate: 16 committed reserve slots, tagged by the eight GENIUS Act 4(a)(1)(A) categories, must cover the committed payment stablecoins outstanding. OCG section 25: inputs are sha256-salted@1 commitments, the receipt holds only the yes/no verdict. Integer only, no haircut, witness is 16 slots of 20 digits. Not proof reserves exist, are unencumbered, approved, or free of 4(a)(2) rehypothecation, nor the Act monthly report. Proof deferred; result is a preview, not a receipt.

- Page: https://ainumbers.co/chaingraph/art-809-check-reserves-cover-outstanding-private.html
- Markdown twin: https://ainumbers.co/chaingraph/art-809-check-reserves-cover-outstanding-private.md
- MCP tool: check_reserves_cover_private (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- unit (any, optional): type not evidenced by kernel source

## Outputs

- basis (string, required)
- not_legal_advice (string, required)
- privacy_note (string, required)
- reserves_cover_outstanding (boolean, required)

## Sample

```json
{
  "reserves_commitment": "sha256:664c25bf9c80224db5a7c60381848bc9c7873fa5eaed7c89ef961edcb274e627",
  "outstanding_commitment": "sha256:4fd2372a5f01790e4056e22d5e2e2f326f08db6df20767bfc87d23472bf106cb",
  "unit": "USD_cents",
  "as_of": "2026-10-31",
  "citation": "GENIUS Act (Pub. L. 119-27) section 4(a)(1)(A): reserves backing outstanding payment stablecoins on an at least 1 to 1 basis, in the reserve categories listed in (i) to (viii)."
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_reserves_cover_private` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
