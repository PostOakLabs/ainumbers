# AML Disposition Sampling Frame Builder

Builds a deterministic sampling frame over an AML consent-order lookback's historical alert dispositions for independent-validator review, plus a reviewer workload allocation. Reuses the shipped art-458-attribute-sampling-plan kernel's compute() directly for the statistical core (sample size, deterministic interval selection over a caller-declared population hash) rather than reimplementing it - no randomness, fully replayable by an independent reviewer from the same declared inputs. Adds only the AML-specific layer: labeling the frame as a disposition sample and deterministically fanning the selected indices out round-robin across a caller-declared reviewer roster. Deterministic only. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-471-disposition-sampling-frame.html
- Markdown twin: https://ainumbers.co/chaingraph/art-471-disposition-sampling-frame.md
- MCP tool: plan_aml_disposition_sample (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- confidence_level (unknown, required)
- disposition_population_hash (unknown, required)
- disposition_population_size (unknown, required)
- expected_deviation_rate (unknown, required)
- population_hash (unknown, required)
- population_size (unknown, required)
- reviewer_roster (array, required)
- tolerable_deviation_rate (unknown, required)

## Outputs

- confidence_level (integer, optional)
- disposition_population_hash (string, optional)
- disposition_population_size (integer, optional)
- expansion_factor (integer, optional)
- expected_deviation_rate (integer, optional)
- interval (integer, optional)
- method (string, optional)
- reviewer_roster (array, optional)
- reviewer_workload (array, optional)
- sample_size (integer, optional)
- selected_indices (array, optional)
- start_offset (integer, optional)
- tolerable_deviation_rate (integer, optional)

## Sample

```json
{
  "confidence_level": 95,
  "disposition_population_size": 1000,
  "tolerable_deviation_rate": 5,
  "expected_deviation_rate": 0,
  "disposition_population_hash": "abc123",
  "reviewer_roster": [
    "reviewer_1"
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `plan_aml_disposition_sample` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
