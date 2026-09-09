# Model Replication Diff

Independently recomputes a model's reported outputs from a declared model specification (version, as-of date, transform, intercept, coefficients) and a stated input record set, then diffs the recomputation against the model's own reported outputs within a caller-supplied tolerance. Returns a per-record diff (reported, recomputed, absolute and relative diff, within-tolerance), aggregate tolerance stats, an overall replicated / not-replicated verdict, and the failing segment(s) named when not replicated. If the declared specification cannot be recomputed as stated - unrecognized transform, no coefficients, no tolerance - the honest result is not_replicable_as_specified with a reason, not a forced pass or fail. Deterministic recompute-and-diff only: this node never opines on conceptual soundness, assumption reasonableness, or fitness for use - that judgment belongs in a validator's approval record, not here. Model inputs and specifications are expected to arrive as a workbook export via the shipped WB-BRIDGE-1 workbook-to-OCG artifact bridge (tool 554); this node itself accepts plain JSON records so any upstream source can feed it. Distinct from the shipped model-passport nodes (art-450/451/453), which track a model's inventory tier and revalidation cadence rather than recomputing its numeric output. Inline deterministic transcendental math (no engine Math.exp/log) so the same input always produces the same execution_hash on every surface. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-488-model-replication-diff.html
- Markdown twin: https://ainumbers.co/chaingraph/art-488-model-replication-diff.md
- MCP tool: replicate_model_outputs (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- model_spec (unknown, required)
- records (array, required)
- tolerance (unknown, required)

## Outputs

- aggregate (object, optional)
- failing_segments (array, optional)
- model_spec_as_of_date (string, optional)
- model_spec_version (string, optional)
- per_record (array, optional)
- reason (string, optional)
- tolerance_applied (object, optional)
- transform (string, optional)
- verdict (string, optional)

## Sample

```json
{
  "model_spec": {
    "version": "credit-scorecard-v3.2",
    "as_of_date": "2026-01-01",
    "transform": "linear",
    "intercept": 10,
    "coefficients": {
      "x1": 2,
      "x2": -1
    }
  },
  "tolerance": {
    "abs_tolerance": 0.5,
    "rel_tolerance": null
  },
  "records": [
    {
      "id": "r1",
      "segment": "prime",
      "features": {
        "x1": 5,
        "x2": 3
      },
      "reported_value": 17
    },
    {
      "id": "r2",
      "segment": "prime",
      "features": {
        "x1": 2,
        "x2": 4
      },
      "reported_value": 9.8
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `replicate_model_outputs` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
