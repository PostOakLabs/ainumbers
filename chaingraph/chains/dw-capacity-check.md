# Discount Window Borrowing-Capacity Check

Two-step BCBS 248 / Federal Reserve intraday liquidity chain. Step 1 computes daily maximum intraday liquidity usage from a caller-supplied time-stamped transaction list and classifies it against a caller-supplied list of available intraday liquidity sources. Step 2 checks Discount Window borrowing capacity - lendable collateral value against a runnable-liability / uninsured-deposit coverage target - as one of those declared sources.

- Page: https://ainumbers.co/chaingraph/chains/dw-capacity-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/dw-capacity-check.md

## Workflow chain: Discount Window Borrowing-Capacity Check

Two-step BCBS 248 / Federal Reserve intraday liquidity chain. Step 1 computes daily maximum intraday liquidity usage from a caller-supplied time-stamped transaction list and classifies it against a caller-supplied list of available intraday liquidity sources. Step 2 checks Discount Window borrowing capacity - lendable collateral value against a runnable-liability / uninsured-deposit coverage target - as one of those declared sources.

Domain: Corporate Treasury & FX

### Steps

1. art-477-intraday-liquidity-monitoring
   daily maximum intraday usage classified against declared available liquidity sources feeds the Discount Window capacity check for the DW-source leg
2. art-427-discount-window-capacity
   lendable value vs. coverage-target result feeds the Discount Window Preparedness Act evidence pack and LCR pre-positioned-collateral disclosure. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
