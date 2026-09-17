# FR Y-9C Schedule HC to HC-R Capital Chain

Gated three-step chain for top-tier bank holding companies (Y-9C panel, total consolidated assets >= $3B). Step 1 maps caller-declared Schedule HC balance-sheet line items into Schedule HC totals and checks the balance-sheet identity. Step 2 consumes those totals alongside caller-supplied capital components to compute Schedule HC-R capital ratios and the supplementary leverage ratio, gated dual_control(2) before the capital-adequacy result is treated as final - any failed capital-ratio or SLR threshold requires two distinct approver sign-offs (recorded, not yet runtime-gated pending HA-RETRO-1 wiring). Step 3, reached only on a passing capital-adequacy result, rolls forward the caller-declared FR Y-14A/Q capital worksheet and cross-checks its ending total capital against Step 2's reported total-capital figure.

- Page: https://ainumbers.co/chaingraph/chains/y9c-schedule-hc-hcr-capital.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/y9c-schedule-hc-hcr-capital.md

## Workflow chain: FR Y-9C Schedule HC to HC-R Capital Chain

Gated three-step chain for top-tier bank holding companies (Y-9C panel, total consolidated assets >= $3B). Step 1 maps caller-declared Schedule HC balance-sheet line items into Schedule HC totals and checks the balance-sheet identity. Step 2 consumes those totals alongside caller-supplied capital components to compute Schedule HC-R capital ratios and the supplementary leverage ratio, gated dual_control(2) before the capital-adequacy result is treated as final - any failed capital-ratio or SLR threshold requires two distinct approver sign-offs (recorded, not yet runtime-gated pending HA-RETRO-1 wiring). Step 3, reached only on a passing capital-adequacy result, rolls forward the caller-declared FR Y-14A/Q capital worksheet and cross-checks its ending total capital against Step 2's reported total-capital figure.

Domain: Bank Capital & Credit Risk

### Steps

1. art-435-bhc-schedule-hc-balance-sheet
   Schedule HC totals (total assets, total liabilities, total equity capital) feed Schedule HC-R capital-ratio computation
2. art-436-bhc-schedule-hcr-capital
   CET1/Tier1/Total capital ratios and SLR against caller-declared, version-pinned minimums. On pass, reported total capital feeds Stage 3's Y-14 worksheet roll-forward cross-check.
3. art-439-y14-capital-worksheet-rollforward
   FR Y-14A/Q capital worksheet roll-forward and cross-check against Stage 2's reported total capital. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
