# AML Lookback Disposition Rollup

Closes the loop art-470 (lookback-completeness-reconciler) and art-471 (disposition-sampling-frame) leave open. Art-470 reconciles that the RE-SCREENING extract was complete; art-471 builds a deterministic sample of the resulting dispositions for independent review; neither checks that a disposition was actually recorded for every sampled item, that a filed or no-SAR determination carries a rationale, or that the sample frame's declared population size still reconciles to the completeness population. This node rolls those three axes up: disposition-coverage against the sample frame's own declared size, disposition-rationale-presence on every filed/no-SAR determination, and a population-to-sample tie-out between art-470's and art-471's declared population sizes. Emits a closed §27.4 gate-policy value: full coverage with rationale present on every filed/no-SAR item yields auto_pass; any missing disposition evaluated as of a caller-declared date on or after the lookback's declared close date yields escalate; a population tie-out failure or an explicit caller-declared sampling-frame discrepancy yields hold; a disposition present without its required rationale yields review_required. Customer id and alert id cross this kernel already salted - callers supply a sha256-salted@1 commitment string, never the plaintext identifier - and the kernel never sees, requests, or computes over the plaintext. Deterministic rollup arithmetic only. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-534-aml-lookback-disposition-rollup.html
- Markdown twin: https://ainumbers.co/chaingraph/art-534-aml-lookback-disposition-rollup.md
- MCP tool: roll_up_aml_lookback_disposition (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- lookback_close_date (unknown, required)
- lookback_id (string, required)
- population_size (unknown, required)
- sample_frame_population_size (unknown, required)
- sample_frame_size (unknown, required)
- sampled_items (array, required)
- sampling_frame_discrepancy_flag (boolean, required)

## Outputs

- as_of (string, optional)
- decision (object, optional)
- disposition_coverage_pct (integer, optional)
- items (array, optional)
- items_missing_rationale (array, optional)
- lookback_close_date (string, optional)
- lookback_id (string, optional)
- missing_disposition_count (integer, optional)
- population_size (integer, optional)
- population_tie_out_holds (boolean, optional)
- rationale_presence_pct (integer, optional)
- rejected_inputs (array, optional)
- sample_frame_population_size (integer, optional)
- sample_frame_size (integer, optional)
- sampled_item_count (integer, optional)
- sampling_frame_discrepancy_flag (boolean, optional)

## Sample

```json
{
  "lookback_id": "LB-2026-CONSENT-ORDER-7",
  "lookback_close_date": "2026-06-30",
  "as_of": "2026-07-15",
  "population_size": 500,
  "sample_frame_population_size": 500,
  "sample_frame_size": 2,
  "sampled_items": [
    {
      "customer_id": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "alert_id": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "disposition": "no_sar",
      "rationale_reference": "REVIEW-NOTE-0001"
    },
    {
      "customer_id": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "alert_id": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "disposition": "sar_filed",
      "rationale_reference": "SAR-FILING-REF-9931"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `roll_up_aml_lookback_disposition` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
