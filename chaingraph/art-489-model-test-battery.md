# Model Test Battery

Runs the deterministic-given-data quantitative model validation battery: discriminatory power (Gini coefficient, Kolmogorov-Smirnov statistic) from scored outcomes, population and characteristic stability (PSI, CSI) between two declared snapshots using the caller's own bins, back-test outcome-vs-predicted per declared bin, and a calibration comparison (predicted vs actual rate, max absolute diff). Every test is graded against a POLICY-SUPPLIED threshold object - this node never chooses or hardcodes a threshold. If a threshold is missing for a requested test, that test is reported skipped_no_threshold, never silently defaulted; if the underlying data is missing or insufficient (e.g. a single-class scored set for Gini/KS), the test is reported skipped_insufficient_data. Each result carries the test's standard name, its metric value, its threshold, and pass/breach so the artifact reads as a workpaper section, not an opinion. Model inputs and specifications are expected to arrive as a workbook export via the shipped WB-BRIDGE-1 workbook-to-OCG artifact bridge (tool 554); this node itself accepts plain JSON so any upstream source can feed it. Pairs with art-488 model-replication-diff (recompute-and-diff) as the two deterministic legs of a model validation cycle - neither node emits a soundness or fitness-for-use opinion. Inline deterministic transcendental math (no engine Math.exp/log) so the same input always produces the same execution_hash on every surface. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-489-model-test-battery.html
- Markdown twin: https://ainumbers.co/chaingraph/art-489-model-test-battery.md
- MCP tool: run_model_test_battery (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, required)
- backtest (unknown, required)
- discrimination (unknown, required)
- stability (unknown, required)
- threshold_version (unknown, required)
- thresholds (unknown, required)

## Outputs

- as_of_date (string, optional)
- back_test (object, optional)
- tests (array, optional)
- tests_breached (integer, optional)
- tests_passed (integer, optional)
- tests_run (integer, optional)
- tests_skipped_insufficient_data (integer, optional)
- tests_skipped_no_threshold (integer, optional)
- threshold_version (string, optional)
- thresholds_applied (object, optional)

## Sample

```json
{
  "as_of_date": "2026-01-15",
  "threshold_version": "policy-2026-Q1",
  "thresholds": {
    "gini_min": 0.4,
    "ks_min": 0.3,
    "psi_max": 0.25,
    "csi_max": 0.25,
    "calibration_max_diff": 0.05
  },
  "discrimination": {
    "scored_outcomes": [
      {
        "id": "a",
        "score": 0.9,
        "outcome": 1
      },
      {
        "id": "b",
        "score": 0.8,
        "outcome": 1
      },
      {
        "id": "c",
        "score": 0.3,
        "outcome": 0
      },
      {
        "id": "d",
        "score": 0.2,
        "outcome": 0
      },
      {
        "id": "e",
        "score": 0.6,
        "outcome": 1
      },
      {
        "id": "f",
        "score": 0.1,
        "outcome": 0
      }
    ]
  },
  "stability": {
    "population_bins": [
      {
        "bin": "low",
        "expected_count": 100,
        "actual_count": 90
      },
      {
        "bin": "high",
        "expected_count": 100,
        "actual_count": 110
      }
    ],
    "characteristic_bins": [
      {
        "characteristic": "ltv",
        "bin": "low",
        "expected_count": 50,
        "actual_count": 40
      },
      {
        "characteristic": "ltv",
        "bin": "high",
        "expected_count": 50,
        "actual_count": 60
      }
    ]
  },
  "backtest": {
    "bins": [
      {
        "bin": "1",
        "predicted_rate": 0.05,
        "actual_rate": 0.07,
        "n": 100
      },
      {
        "bin": "2",
        "predicted_rate": 0.1,
        "actual_rate": 0.09,
        "n": 80
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_model_test_battery` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
