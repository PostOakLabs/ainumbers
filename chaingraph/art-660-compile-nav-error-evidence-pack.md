# Compile NAV-Error Evidence Pack

Packages one already-produced recompute_fund_nav receipt and one already-produced test_nav_error_materiality receipt into a CSSF Circular 24/856-shaped NAV-error disclosure bundle: what happened, when it was detected, the materiality threshold applied, the affected period, and the correction. The materiality verdict and error/policy figures are echoed verbatim from the cited materiality receipt's own output, never recomputed here. HARD FENCE: this pack cites the referenced receipts by execution_hash and tool_id; it performs zero NAV recomputation and zero materiality-threshold arithmetic of its own, and it makes no claim of CSSF Circular 24/856 compliance, informative citation only. The affected_period, correction and notification fields are caller-supplied and asserted (zero-egress, no CSSF submission of any kind). Fourth entry of the NAV / Fund-Administration Computation Lineage family, alongside recompute_fund_nav, test_nav_error_materiality and compute_fund_expense_ratios.

- Page: https://ainumbers.co/chaingraph/art-660-compile-nav-error-evidence-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/art-660-compile-nav-error-evidence-pack.md
- MCP tool: compile_nav_error_evidence_pack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- affected_period (unknown, required)
- correction (unknown, required)
- detection_date (unknown, required)
- fund_id (unknown, required)
- materiality_ref (unknown, required)
- nav_ref (unknown, required)
- notification (unknown, required)
- supplementary_receipts (unknown, required)

## Outputs

- affected_period (object, required)
- cited_receipts (array, required)
- correction (object, required)
- declared_policy (object,null, required)
- detection_date (string, required)
- error (object,null, required)
- fence (string, required)
- fund_id (string,null, required)
- industry_convention (object,null, required)
- materiality_verdict (string,null, required)
- not_proven (array, required)
- notification (object, required)
- regulatory_framework (string, required)
- reprocessing_need_indicated (boolean,null, required)
- structural_error (null,string, required)
- warnings (array, required)

## Sample

```json
{
  "fund_id": "LU-FUND-ALPHA-01",
  "detection_date": "2026-03-14",
  "nav_ref": {
    "execution_hash": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678901234567890abcdef012345",
    "tool_id": "art-373-recompute-fund-nav"
  },
  "materiality_ref": {
    "execution_hash": "b2c3d4e5f60718293a4b5c6d7e8f9012345678901234567890abcdef01234561",
    "tool_id": "art-374-test-nav-error-materiality",
    "output_payload": {
      "materiality_verdict": "MATERIAL",
      "error": {
        "erroneous_nav_per_share": "10.20000000",
        "corrected_nav_per_share": "10.05000000",
        "error_amount": "0.15000000",
        "error_amount_abs": "0.15000000",
        "error_direction": "overstated",
        "error_pct_abs": "1.492537"
      },
      "declared_policy": {
        "absolute_threshold": "0.00500000",
        "percent_threshold": "1",
        "policy_source": "industry_default",
        "absolute_breach": true,
        "percent_breach": true,
        "material": true
      },
      "industry_convention": {
        "absolute_threshold": "0.005",
        "percent_threshold": "1",
        "absolute_breach": true,
        "percent_breach": true,
        "material": true
      },
      "reprocessing_need_indicated": true
    }
  },
  "affected_period": {
    "start_date": "2026-03-01",
    "end_date": "2026-03-14",
    "days": 14
  },
  "correction": {
    "correction_method": "accounting",
    "compensation_paid_without_delay": true,
    "de_minimis_applied": false,
    "financial_intermediary_pass_through": true
  },
  "notification": {
    "notified_to_cssf": true,
    "notification_date": "2026-03-20"
  },
  "supplementary_receipts": [
    {
      "role": "positions",
      "execution_hash": "c3d4e5f60718293a4b5c6d7e8f9012345678901234567890abcdef012345612",
      "tool_id": "art-NN-record-fund-positions"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compile_nav_error_evidence_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
