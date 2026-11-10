# Quadratic Funding Round Recompute

Recomputes how a quadratic funding round splits a matching pool from contribution amounts you supply, in two modes. Plain mode gives each project a subsidy equal to the square of the summed contributor square roots minus the contributions themselves. Pairwise-bounded mode weights each contributor pair by M over M plus the pair overlap across projects, with M in minor units (the coefficient with alpha equal to 1; the alpha variants and the squared-matrix variant are not implemented). Every amount is an integer of minor units and every square root is an exact integer root floored at a declared number of decimal digits, so the result is a pure function of the input. The matching pool is then split in proportion to subsidy with largest-remainder rounding so the matches sum to the pool exactly, or optionally capped at the raw subsidy when that fits. The output states every rounding step and labels the match as within tolerance of any published round, never identical. Caps: 200 contribution rows, 40 contributors, 20 projects, amounts and pool up to 10^12 minor units. Contributor and project labels are pseudonymous strings restricted to letters, digits, underscore and hyphen. Reproduces the published formula on your data. It does not detect sybils, applies no identity or fraud screening, and does not endorse any round or token.

- Page: https://ainumbers.co/chaingraph/art-814-qf-pairwise-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-814-qf-pairwise-recompute.md
- MCP tool: recompute_quadratic_funding_round (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "mode": "plain",
  "matching_pool": 100,
  "contributions": [
    {
      "project": "p1",
      "contributor": "a",
      "amount": 4
    },
    {
      "project": "p1",
      "contributor": "b",
      "amount": 9
    },
    {
      "project": "p1",
      "contributor": "c",
      "amount": 16
    },
    {
      "project": "p2",
      "contributor": "a",
      "amount": 1
    },
    {
      "project": "p2",
      "contributor": "d",
      "amount": 1
    },
    {
      "project": "p3",
      "contributor": "d",
      "amount": 25
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_quadratic_funding_round` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
