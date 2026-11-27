# Control Frequency Sample

Applies a table you declare. It ships no table, and is not guidance from any audit firm or standard-setter. The sample size is only as defensible as the table. From a control frequency, a declared population size, a declared population hash, a period in days and a caller-supplied policy table keyed by frequency (expected population range and sample size per row), it returns the sample size from the matching row, whether the declared population falls inside the expected range for that frequency (a mismatch is flagged, never corrected), and a deterministic integer selection (a start offset below the population size, derived from the population hash, and evenly spread indices that can reach any position in the population). A missing table, a wrong-typed frequency or hash, a missing or duplicated frequency row, an invalid row, a sample size above the population or above 100000 is refused with an explicit code. No randomness and no clock. Values only, no personal data.

- Page: https://ainumbers.co/chaingraph/838-control-frequency-sample.html
- Markdown twin: https://ainumbers.co/chaingraph/838-control-frequency-sample.md
- MCP tool: plan_control_frequency_sample (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- control_frequency (string, required): Frequency id matching one policy_table row
- population_size (integer, required): Instances of the control in the period
- population_hash (string, required): Declared hash of the sorted population extract
- period_days (integer, required): Testing period length in days
- policy_table (array, required): Caller-declared rows: frequency, min_population, max_population, sample_size

## Outputs

- outcome (string, optional)
- refusal_reasons (array, optional)
- control_frequency (string,null, optional)
- population_size (integer,null, optional)
- period_days (integer,null, optional)
- frequency_row (object,null, optional)
- sample_size (integer,null, optional)
- within_expected_range (boolean,null, optional)
- start_offset (integer,null, optional)
- selected_indices (array, optional)
- warnings (array, optional)

## Sample

```json
{
  "control_frequency": "annual",
  "population_size": 1,
  "population_hash": "pop-hash-annual-0001",
  "period_days": 365,
  "policy_table": [
    {
      "frequency": "annual",
      "min_population": 1,
      "max_population": 1,
      "sample_size": 1
    },
    {
      "frequency": "quarterly",
      "min_population": 4,
      "max_population": 4,
      "sample_size": 2
    },
    {
      "frequency": "monthly",
      "min_population": 12,
      "max_population": 12,
      "sample_size": 2
    },
    {
      "frequency": "weekly",
      "min_population": 52,
      "max_population": 52,
      "sample_size": 5
    },
    {
      "frequency": "daily",
      "min_population": 250,
      "max_population": 260,
      "sample_size": 25
    },
    {
      "frequency": "multiple_per_day",
      "min_population": 1000,
      "max_population": 100000,
      "sample_size": 60
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `plan_control_frequency_sample` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
