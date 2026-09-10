# IFRS 17 CSM Roll-Forward Validator

Validate IFRS 17 Contractual Service Margin (CSM) roll-forward mechanics: opening CSM + new business + interest accretion + experience adjustments - coverage-unit release + FX adjustments = closing CSM. Flags onerous contracts when computed closing falls below zero (IFRS 17 para 47-50: no negative CSM; shortfall recognized as immediate loss component). NaN-safe numeric validation on all inputs. Feeds risk-adjustment checker (art-179). IFRS 17 para 44-50. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-178-ifrs17-csm-rollforward-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-178-ifrs17-csm-rollforward-validator.md
- MCP tool: validate_ifrs17_csm_rollforward (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- csm (unknown, optional)

## Outputs

- closing_csm (integer, optional)
- csm_valid (boolean, optional)
- experience_adjustments (integer, optional)
- fx_adjustments (integer, optional)
- interest_accretion (integer, optional)
- loss_component (integer, optional)
- new_business_csm (integer, optional)
- onerous (boolean, optional)
- opening_csm (integer, optional)
- release_to_profit (integer, optional)

## Sample

```json
{
  "csm": {
    "opening_csm": 1000,
    "new_business_csm": 200,
    "interest_accretion": 50,
    "experience_adjustments": -30,
    "release_to_profit": 100,
    "fx_adjustments": 0
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_ifrs17_csm_rollforward` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
