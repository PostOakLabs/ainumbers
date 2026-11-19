# Payment System MI Pack

Computes a payment system's management-information pack from declared AGGREGATE counts only (no transaction-level records, no personal data): a fixed KPI set covering speed (share of transactions credited within one hour and within one business day), average cost in basis points of transaction value, failure rate, availability from scheduled versus unplanned-downtime minutes, fraud value and count shares, complaint resolution within SLA, adoption (users per 1000 eligible population and accepting locations count), and transparency (share of services disclosing cost and speed). Each KPI carries its definition source in definition_ref: the speed percentage is compared against the pinned 75-percent-within-one-hour cross-border retail speed target on the g20_retail and fast_payment_scheme profiles; the cost, access and transparency KPI families are adapted from the pinned FSB retail KPI definitions; availability is anchored to the pinned operational-risk principle with the 99.9-percent reference level declared as a design convention; the remaining KPIs are declared design conventions. Missing-input KPIs are null with a reason code, never zero; channel totals that do not reconcile, credited counts above the declared total, negative declared values, fractional declared count fields and impossible declared relations (a part above its whole, such as resolved complaints above received, downtime above scheduled minutes, active users above the eligible population or disclosing services above total services) raise data-quality flags and the affected KPI is null with a named reason; inputs the artifact path cannot canonicalize (integers beyond 2 to the power 53, non-finite numbers), malformed channel or failure entries, wrong-typed period or prior-period values and dates that are not real calendar dates are refused; a prior period of the same shape yields per-KPI deltas. Profile-keyed (generic, g20_retail, fast_payment_scheme, gov_payments). Declared scope limit: this node produces KPIs, not verdicts, it does not reconcile individual records and does not audit statements (the reconciliation and audit nodes art-516 and art-517 do that), and it never presents real scheme figures: every figure is computed from caller-declared aggregates.

- Page: https://ainumbers.co/chaingraph/796-payment-system-mi-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/796-payment-system-mi-pack.md
- MCP tool: compute_payment_system_mi_pack (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "profile": "fast_payment_scheme",
  "transactions": {
    "count": 1000000,
    "value": 250000000,
    "by_channel": [
      {
        "channel": "mobile_app",
        "count": 640000,
        "value": 120000000
      },
      {
        "channel": "agent",
        "count": 360000,
        "value": 130000000
      }
    ],
    "credited_within_1h_count": 800000,
    "credited_within_1bd_count": 985000
  },
  "failures": [
    {
      "reason_class": "insufficient_funds",
      "count": 9000
    },
    {
      "reason_class": "timeout",
      "count": 3000
    }
  ],
  "availability": {
    "scheduled_minutes": 43200,
    "unplanned_downtime_minutes": 20,
    "incidents": 2
  },
  "fraud": {
    "count": 120,
    "value": 900000
  },
  "complaints": {
    "received": 450,
    "resolved_within_sla": 400
  },
  "adoption": {
    "active_users": 350000,
    "eligible_population": 700000,
    "accepting_merchants_or_agencies": 42000
  },
  "cost": {
    "fee_value": 1250000
  },
  "transparency": {
    "services_disclosing_cost_and_speed": 9,
    "services_total": 12
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_payment_system_mi_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
