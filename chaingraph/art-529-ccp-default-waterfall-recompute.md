# CCP Default Waterfall Recomputation

Recomputes the sequential loss-allocation order at a CCP defaulting-member event: defaulter's initial margin, then the defaulter's default-fund contribution, then the CCP's own skin-in-the-game, then the surviving members' default-fund pool, then assessment powers - per a caller-declared waterfall structure and a caller-declared loss amount. The structure is not hardcoded to any one CCP's rulebook; a caller supplies its own stage order and subset per PFMI Principle 4 and its own published rulebook. Carries an OCG Standard §25 ocg-private-input@1 declaration: the defaulter's initial margin, the defaulter's default-fund contribution, and the surviving-members' default-fund pool are member-level figures, committed via sha256-salted@1 in policy_parameters.member_figures_commitment, never disclosed in the clear. The CCP's own skin-in-the-game and any assessment-powers cap are the CCP's own already-published figures and stay public inputs. Emits, stage by stage, how much of the declared loss each stage absorbed and whether a residual remains unallocated - a breach of the declared structure at that loss amount. Distinct in domain from art-509-recompute-payment-waterfall, a securitisation cashflow waterfall unrelated to CCP default management. It performs no fund-sizing of its own, no stress-scenario modelling, and makes no determination that any CCP's published resources are adequate.

- Page: https://ainumbers.co/chaingraph/art-529-ccp-default-waterfall-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-529-ccp-default-waterfall-recompute.md
- MCP tool: recompute_ccp_default_waterfall (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- loss_amount_minor_units (unknown, required)

## Outputs

- assessment_powers_cap_declared (boolean, optional)
- assessment_powers_cap_minor_units (integer, optional)
- breach (boolean, optional)
- ccp_skin_in_game_display (string, optional)
- ccp_skin_in_game_minor_units (integer, optional)
- currency (string, optional)
- loss_amount_display (string, optional)
- loss_amount_minor_units (integer, optional)
- loss_fully_absorbed (boolean, optional)
- note (string, optional)
- provenance (string, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- residual_display (string, optional)
- residual_minor_units (integer, optional)
- steps (array, optional)
- waterfall_structure (array, optional)

## Sample

```json
{
  "currency": "USD",
  "waterfall_structure": [
    "defaulter_im",
    "defaulter_default_fund",
    "ccp_skin_in_game",
    "surviving_member_default_fund_pro_rata",
    "assessment_powers"
  ],
  "loss_amount_minor_units": 50000000,
  "ccp_skin_in_game_minor_units": 30000000000,
  "assessment_powers_cap_declared": true,
  "assessment_powers_cap_minor_units": 100000000000,
  "member_figures_commitment": "sha256:abb47369cd5665fa19e76b84c34d54a954002bde70b23fb168d1432647abfccd"
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_ccp_default_waterfall` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
