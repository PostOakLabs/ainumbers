# Ethereum Base Fee and Blob Base Fee Recompute

Recomputes the next Ethereum block's base fee per gas (EIP-1559) and its base fee per blob gas (EIP-4844, with the EIP-7918 reserve-price rule from Osaka on) from parent-header values the caller declares. The base-fee section takes the parent gas limit, gas used and base fee and returns the parent gas target, the new base fee, the change in wei and its direction; given the child block's gas limit it also says whether that limit is within the protocol's adjustment bounds. The blob section takes the parent excess blob gas, blob gas used and, on reserve-price forks, the parent base fee, and returns the new excess blob gas, the blob base fee per gas and per blob, the parent's blob base fee under the same schedule, and whether the reserve-price branch fired. Fork parameters (blob target, blob maximum, update fraction, reserve-price switch, elasticity multiplier and change denominator) default to the named fork's published values for Cancun, Prague, Osaka, BPO1 or BPO2 (BPO2 when no fork is named), and any of them can be declared instead; the output says which were used and whether any were overridden. All arithmetic is integer. Recompute from the published formula and your declared parameters; not a prediction of future fees. The node reads no chain, does not cover the London fork-transition block, priority fees or L2 fee models, and checks no header beyond the values supplied.

- Page: https://ainumbers.co/chaingraph/815-eth-fee-market.html
- Markdown twin: https://ainumbers.co/chaingraph/815-eth-fee-market.md
- MCP tool: recompute_eth_fee_market (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "base_fee": {
    "parent_gas_limit": 36000000,
    "parent_gas_used": 18000000,
    "parent_base_fee_per_gas": 1000000000,
    "block_gas_limit": 36000000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_eth_fee_market` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
