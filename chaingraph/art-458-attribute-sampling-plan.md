# Attribute Sampling Plan Generator

Computes a SOX 404 / ICFR attribute-sampling plan from confidence level, tolerable deviation rate, and expected deviation rate (all policy inputs) using the standard zero-EDR Poisson attribute-sampling formula with an expansion factor for nonzero EDR. Item selection is deterministic interval sampling over the caller-declared population hash - no randomness, so any auditor can replay the exact same sample from the same declared inputs. If the tolerable deviation rate is at or below the expected deviation rate the plan is statistically indefensible, so the kernel reframes to a full-population census rather than shipping a bad plan. First node in the ICFR control-test evidence chain (feeds art-461 control-test-evidence-composer). NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-458-attribute-sampling-plan.html
- Markdown twin: https://ainumbers.co/chaingraph/art-458-attribute-sampling-plan.md
- MCP tool: plan_attribute_sample (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- confidence_level (unknown, required)
- expected_deviation_rate (unknown, required)
- population_hash (unknown, required)
- population_size (unknown, required)
- tolerable_deviation_rate (unknown, required)

## Outputs

- confidence_level (integer, optional)
- expansion_factor (integer, optional)
- expected_deviation_rate (integer, optional)
- interval (integer, optional)
- method (string, optional)
- population_hash (string, optional)
- population_size (integer, optional)
- sample_size (integer, optional)
- selected_indices (array, optional)
- start_offset (integer, optional)
- tolerable_deviation_rate (integer, optional)

## Sample

```json
{
  "confidence_level": 95,
  "population_size": 1000,
  "tolerable_deviation_rate": 5,
  "expected_deviation_rate": 0,
  "population_hash": "abc123"
}
```

## Verify

Run the sample policy_parameters through MCP tool `plan_attribute_sample` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
