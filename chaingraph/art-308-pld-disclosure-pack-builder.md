# PLD Disclosure Pack Builder

Assembles a disclosure/rebuttal pack for a disputed window under EU Product Liability Directive 2024/2853 (transposes 2026-12-09; AI is a "product"; non-disclosure or an AI Act breach triggers a rebuttable presumption of defectiveness). Collects the receipt set for the disputed window into a hash-anchored trace with replay instructions and a defectiveness-rebuttal mapping (which receipts rebut which presumption trigger: non-disclosure vs AI-Act-breach), flagging any gap in window coverage. Asserts the inputs replay to this trace; never a legal conclusion of non-defectiveness. AILD is confirmed withdrawn (Oct 2025); PLD is the only surviving EU frame this maps to. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-308-pld-disclosure-pack-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-308-pld-disclosure-pack-builder.md
- MCP tool: build_pld_disclosure_pack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- alleged_defect (unknown, optional)
- anchor_document_integrity (unknown, required)
- disputed_window (unknown, required)
- product_ref (unknown, optional)
- receipts (unknown, required)

## Outputs

- alleged_defect (string, optional)
- anchor (string, optional)
- disputed_window (object, optional)
- gap_in_window (boolean, optional)
- insufficient_evidence (boolean, optional)
- product_ref (string, optional)
- rebuttal_mapping (array, optional)
- replay_instructions (string, optional)
- trace_digest (string, optional)

## Sample

```json
{
  "disputed_window": {
    "from": "2026-01-01",
    "to": "2026-06-30"
  },
  "product_ref": "agent-checkout-v3",
  "receipts": [
    {
      "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "rebuts": [
        "non_disclosure"
      ]
    },
    {
      "receipt_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "rebuts": [
        "ai_act_breach"
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_pld_disclosure_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
