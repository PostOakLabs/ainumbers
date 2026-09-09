# Control-Test Evidence Composer

Composes a SOX 404 / ICFR control-test evidence artifact: reconciles a caller-declared attribute sample (item ids, e.g. from art-458) against a per-item pass/fail test-result set into one test-conclusion record - sample coverage, exception count vs a caller-set tolerable-deviation threshold, and a test conclusion (operating effectively / exception noted / incomplete). The tester is recorded under the SOX 404 / PCAOB AS 1215 preparer role; every test carries a fixed review_required gate for reviewer sign-off. An exception count above zero flags a deficiency CANDIDATE only - severity classification and its reason_code are a separate human reviewer approval record, never computed here. Deterministic reconciliation only. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-461-control-test-evidence-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-461-control-test-evidence-composer.md
- MCP tool: compose_control_test_evidence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- control_id (unknown, required)
- population_hash (unknown, required)
- reporting_period (unknown, required)
- sample (array, required)
- test_results (array, required)
- tester_id (unknown, required)
- tolerable_exception_count (unknown, required): Count

## Outputs

- control_id (string, optional)
- coverage_complete (boolean, optional)
- deficiency (string, optional)
- exception_count (integer, optional)
- exception_rate (integer, optional)
- extra_results (array, optional)
- fail_count (integer, optional)
- gate_status (string, optional)
- missing_results (array, optional)
- not_a_severity_judgment (string, optional)
- pass_count (integer, optional)
- population_hash (string, optional)
- reporting_period (string, optional)
- sample_size (integer, optional)
- test_conclusion (string, optional)
- tested_count (integer, optional)
- tester_id (string, optional)
- tester_role (string, optional)
- tolerable_exception_count (integer, optional)
- within_tolerance (boolean, optional)

## Sample

```json
{
  "control_id": "CTRL-AP-014",
  "population_hash": "sha256:pop-aaa111",
  "reporting_period": "2026-Q2",
  "tester_id": "tester-jsmith",
  "tolerable_exception_count": 0,
  "sample": [
    {
      "item_id": "INV-1001"
    },
    {
      "item_id": "INV-1002"
    },
    {
      "item_id": "INV-1003"
    },
    {
      "item_id": "INV-1004"
    }
  ],
  "test_results": [
    {
      "item_id": "INV-1001",
      "result": "pass"
    },
    {
      "item_id": "INV-1002",
      "result": "pass"
    },
    {
      "item_id": "INV-1003",
      "result": "pass"
    },
    {
      "item_id": "INV-1004",
      "result": "pass"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compose_control_test_evidence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
