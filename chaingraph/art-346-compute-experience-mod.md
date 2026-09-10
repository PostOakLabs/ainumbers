# NCCI Experience Modification Calculator

Workers'-compensation experience rating modification (NCCI Experience Rating Plan Manual published national formula): per-claim primary/excess loss split at the state split point, then Mod = (Ap + W×Ae + (1-W)×Ee + B) / (Ep + B). Split point, expected losses, expected primary losses, weighting value, and ballast value are licensed NCCI/state rating-bureau table values supplied by the caller from their own experience rating worksheet - this node never vendors or reproduces those tables, only the published split-and-mod formula.

- Page: https://ainumbers.co/chaingraph/art-346-compute-experience-mod.html
- Markdown twin: https://ainumbers.co/chaingraph/art-346-compute-experience-mod.md
- MCP tool: compute_experience_mod (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- ballast_value (number, optional)
- claims (array, required)
- expected_losses (number, optional)
- expected_primary_losses (number, optional)
- split_point (number, optional)
- weighting_value (number, optional)

## Outputs

- actual_excess_losses (integer, optional)
- actual_primary_losses (integer, optional)
- actual_total_losses (integer, optional)
- ballast_value (integer, optional)
- claim_count (integer, optional)
- expected_excess_losses (integer, optional)
- expected_losses (integer, optional)
- expected_primary_losses (integer, optional)
- mod (number, optional)
- note (string, optional)
- rating_class (string, optional)
- regulatory_basis (string, optional)
- split_point (integer, optional)
- weighting_value (number, optional)

## Sample

```json
{
  "claims": [
    {
      "incurred_losses": 25000
    },
    {
      "incurred_losses": 8000
    },
    {
      "incurred_losses": 40000
    }
  ],
  "split_point": 15000,
  "expected_losses": 60000,
  "expected_primary_losses": 24000,
  "weighting_value": 0.25,
  "ballast_value": 12000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_experience_mod` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
