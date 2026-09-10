# Mortgage High-Cost and HPML Screen

Gated two-step consumer-protection screen: HOEPA high-cost trigger test (§1026.32(a)(1)) with gate on is_high_cost. If any HOEPA trigger fires, chain terminates (HOEPA restrictions are terminal). Otherwise proceeds to HPML escrow test (§1026.35). Covers the full Reg Z consumer-protection spectrum beyond the QM preflight.

- Page: https://ainumbers.co/chaingraph/chains/mortgage-high-cost-and-hpml-screen.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mortgage-high-cost-and-hpml-screen.md

## Workflow chain: Mortgage High-Cost and HPML Screen

Gated two-step consumer-protection screen: HOEPA high-cost trigger test (§1026.32(a)(1)) with gate on is_high_cost. If any HOEPA trigger fires, chain terminates (HOEPA restrictions are terminal). Otherwise proceeds to HPML escrow test (§1026.35). Covers the full Reg Z consumer-protection spectrum beyond the QM preflight.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-234-test-hoepa-high-cost
   is_high_cost feeds HOEPA gate; if true any further HPML check is superseded by HOEPA restrictions
2. art-235-test-hpml-escrow
   is_hpml and escrow_required complete the consumer-protection screen

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
