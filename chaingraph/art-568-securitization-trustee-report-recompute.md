# Securitization Trustee-Report Waterfall Recomputation

Recomputes a securitization priority-of-payments waterfall for one stated distribution period from a caller-declared tier list and the period's own collections, then compares the recomputed distribution against what the monthly trustee report states was distributed. The tier list, its priority order, every cap and every trigger reference come from the deal's own indenture, which the caller pins in an indenture reference that is carried into the artifact, so a later amendment dates an old receipt rather than falsifying it. Trigger states are caller-declared booleans only: a tier naming a trigger is skipped exactly when the caller declares that trigger breached, and this tool computes no coverage ratio, delinquency rate, or other market figure to decide a trigger's state. The recomputed side of every comparison is derived here by allocating the period collections down the tier list, never lifted from the trustee report, so a divergence is a genuine arithmetic finding rather than a re-adding of a published column. The verdict is MATCHES, DIVERGES, or INDETERMINATE, and INDETERMINATE covers both an empty tier list and a run where no trustee-reported distribution was supplied to compare against; neither case is guessed toward agreement. Money is fixed point in integer minor units throughout with two-decimal display, and zero collections, an empty tier list, and a tier naming a collection type that was not supplied each resolve to a defined result. Cites the OCC's Comptroller's Handbook on Asset Securitization as a mechanics reference only; the deal's own indenture governs, and this tool says so rather than asserting endorsement by any standard-setter. Stated boundary: a divergence against the trustee report is an arithmetic finding about the tier list and figures supplied here. It is never a compliance determination, never an audit opinion, and never a finding that the deal was administered correctly or incorrectly.

- Page: https://ainumbers.co/chaingraph/art-568-securitization-trustee-report-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-568-securitization-trustee-report-recompute.md
- MCP tool: recompute_trustee_report_waterfall (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- currency (string, required)
- deal_ref (unknown, required)
- indenture_ref (unknown, required)
- period_collections (unknown, required)
- period_label (unknown, required)
- tiers (unknown, required)
- triggers (unknown, required)
- trustee_reported_distribution (unknown, required)

## Outputs

- citations (object, optional)
- collections_by_type (array, optional)
- comparison_basis (string, optional)
- currency (string, optional)
- deal_ref (string, optional)
- diff (array, optional)
- fence (string, optional)
- first_unfunded_tier (string, optional)
- indenture_ref (object, optional)
- indeterminate_reason (string, optional)
- minor_unit_exponent (integer, optional)
- not_proven (array, optional)
- note (string, optional)
- period_label (string, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- residual_by_type (array, optional)
- residual_display (string, optional)
- residual_minor_units (integer, optional)
- skipped_tier_count (integer, optional)
- tier_count (integer, optional)
- tiers (array, optional)
- total_collections_display (string, optional)
- total_collections_minor_units (integer, optional)
- total_paid_display (string, optional)
- total_paid_minor_units (integer, optional)
- total_shortfall_display (string, optional)
- total_shortfall_minor_units (integer, optional)
- triggers_evaluated (array, optional)
- trustee_reported_supplied (boolean, optional)
- verdict (string, optional)

## Sample

```json
{
  "deal_ref": "SYNTH-TRUST-2025-A",
  "period_label": "2025-08 distribution period",
  "currency": "USD",
  "indenture_ref": {
    "document_ref": "SYNTHETIC INDENTURE SYNTH-TRUST-2025-A",
    "section_ref": "Priority of Payments, Section 3.02",
    "version": "1.0",
    "dated": "2025-04-01"
  },
  "period_collections": [
    {
      "collection_type": "interest",
      "amount_minor_units": 9000000
    },
    {
      "collection_type": "principal",
      "amount_minor_units": 20000000
    }
  ],
  "triggers": [
    {
      "trigger_id": "delinquency-trigger",
      "label": "Cumulative delinquency trigger",
      "breached": false
    }
  ],
  "tiers": [
    {
      "tier_id": "t1",
      "label": "Trustee and servicing fees",
      "type": "fees",
      "collection_type": "interest",
      "amount_due_minor_units": 200000
    },
    {
      "tier_id": "t2",
      "label": "Class A interest",
      "type": "interest",
      "collection_type": "interest",
      "amount_due_minor_units": 5800000
    },
    {
      "tier_id": "t3",
      "label": "Reserve account replenishment",
      "type": "reserve",
      "collection_type": "interest",
      "amount_due_minor_units": 3000000,
      "cap_minor_units": 3000000,
      "trigger_id": "delinquency-trigger"
    },
    {
      "tier_id": "t4",
      "label": "Class A principal",
      "type": "principal",
      "collection_type": "principal",
      "amount_due_minor_units": 20000000
    },
    {
      "tier_id": "t5",
      "label": "Class B principal",
      "type": "principal",
      "collection_type": "principal",
      "amount_due_minor_units": 4000000
    }
  ],
  "trustee_reported_distribution": [
    {
      "tier_id": "t1",
      "amount_minor_units": 200000
    },
    {
      "tier_id": "t2",
      "amount_minor_units": 5800000
    },
    {
      "tier_id": "t3",
      "amount_minor_units": 3000000
    },
    {
      "tier_id": "t4",
      "amount_minor_units": 20000000
    },
    {
      "tier_id": "t5",
      "amount_minor_units": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_trustee_report_waterfall` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
