# FR 2052a Inflow/Outflow Bucket Classifier

FR 2052a complex-institution liquidity monitoring filing-layer kernel, scoped to the inflow/outflow section: product/maturity-bucket classification against a caller-supplied Appendix IV-style boundary table (versioned policy input, not hardcoded), intercompany elimination (excluded from external aggregation, reported separately), and form-shaped JSON export by bucket (inflow/outflow/net). A bucket override without a reason_code is flagged - the row-level basis for a separate signed §27 human_accountability_record, not minted by this kernel. Not a filing tool - evidence artifact and form-shaped export only, never regulator-submittable. Not check_conforming_loan_limit or a Call Report/Y-9C schedule kernel.

- Page: https://ainumbers.co/chaingraph/art-437-fr2052a-inflow-outflow-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-437-fr2052a-inflow-outflow-classifier.md
- MCP tool: compute_fr2052a_inflow_outflow_classification (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- boundary_table_version (unknown, required)
- bucket_boundaries (unknown, required)
- rows (unknown, required)

## Outputs

- boundary_table_version (string, optional)
- elimination_total_musd (integer, optional)
- form_2052a (array, optional)
- note (string, optional)
- override_count (integer, optional)
- override_missing_reason_count (integer, optional)
- row_count (integer, optional)
- rows (array, optional)
- total_inflow_musd (integer, optional)
- total_net_musd (integer, optional)
- total_outflow_musd (integer, optional)

## Sample

```json
{
  "boundary_table_version": "2026-07-01",
  "bucket_boundaries": [
    {
      "bucket_label": "Overnight",
      "max_days": 1
    },
    {
      "bucket_label": "2-30 days",
      "max_days": 30
    },
    {
      "bucket_label": "31-90 days",
      "max_days": 90
    },
    {
      "bucket_label": ">90 days",
      "max_days": 9999
    }
  ],
  "rows": [
    {
      "row_id": "r0",
      "flow_type": "inflow",
      "amount_musd": 1200,
      "maturity_days": 1,
      "is_intercompany": false
    },
    {
      "row_id": "r1",
      "flow_type": "outflow",
      "amount_musd": 900,
      "maturity_days": 45,
      "is_intercompany": false
    },
    {
      "row_id": "r2",
      "flow_type": "outflow",
      "amount_musd": 400,
      "maturity_days": 7,
      "is_intercompany": false
    },
    {
      "row_id": "r3",
      "flow_type": "inflow",
      "amount_musd": 650,
      "maturity_days": 90,
      "is_intercompany": false
    },
    {
      "row_id": "r4",
      "flow_type": "outflow",
      "amount_musd": 300,
      "maturity_days": 30,
      "is_intercompany": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_fr2052a_inflow_outflow_classification` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
