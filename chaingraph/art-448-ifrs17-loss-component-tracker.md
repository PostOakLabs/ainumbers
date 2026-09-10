# IFRS 17 Loss Component Roll-Forward Tracker

Tracks the IFRS 17 para 50 loss-component roll-forward across periods: opening balance, additional loss recognised on new onerous contracts, reversal from subsequent favourable experience (capped so it never reverses more than the available balance), other adjustments, and release to profit or loss (capped at the pre-release balance). Delta over validate_ifrs17_csm_rollforward (art-178), which resets the loss component to a single period's shortfall and does not track the component's own multi-period roll-forward or its release pattern. IFRS 17 para 50, BC323-BC326. NaN-safe numeric validation on all inputs. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-448-ifrs17-loss-component-tracker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-448-ifrs17-loss-component-tracker.md
- MCP tool: track_ifrs17_loss_component_rollforward (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- loss_component (unknown, optional)

## Outputs

- additional_lc (integer, optional)
- closing_lc (integer, optional)
- fully_reversed (boolean, optional)
- lc_valid (boolean, optional)
- opening_lc (integer, optional)
- other_adj (integer, optional)
- pre_release (integer, optional)
- release_to_pnl (integer, optional)
- reversal_lc (integer, optional)

## Sample

```json
{
  "loss_component": {
    "opening_lc": 100,
    "additional_lc": 50,
    "reversal_lc": 0,
    "release_to_pnl": 0,
    "other_adj": 0
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `track_ifrs17_loss_component_rollforward` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
