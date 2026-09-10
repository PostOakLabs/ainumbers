# CCP Default Waterfall Recompute to Cover-2 Sizing

Recomputes a CCP's sequential default-waterfall loss allocation for a caller-declared defaulting-member loss, then checks whether the recomputed allocation stays within the CCP's Cover-2 default fund sizing or breaches it.

- Page: https://ainumbers.co/chaingraph/chains/chain-ccp-default-waterfall.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/chain-ccp-default-waterfall.md

## Workflow chain: CCP Default Waterfall Recompute to Cover-2 Sizing

Recomputes a CCP's sequential default-waterfall loss allocation for a caller-declared defaulting-member loss, then checks whether the recomputed allocation stays within the CCP's Cover-2 default fund sizing or breaches it.

Domain: Treasury Clearing

### Steps

1. art-529-ccp-default-waterfall-recompute
   stage-by-stage loss absorption and any unallocated residual feed Stage 2's fund-size adequacy check against the same declared loss amount
2. art-530-default-fund-cover2-sizing
   checks the declared default fund size against the worst-case Cover-2 stress scenario; terminal check

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
