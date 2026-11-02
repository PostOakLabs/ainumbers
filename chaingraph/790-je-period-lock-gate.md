# Je Period Lock Gate

Evaluates caller-declared journal entries against a caller-declared, time-varying period-lock policy and reports, per entry, whether the declared policy admits it. Periods carry dated lock events (open, soft_locked with exact-match exempt roles, hard_closed); the lock state is evaluated at the entry's entered_on date (or a declared as_of_date) for the period containing the entry's effective date, which is what makes a detective test possible: an entry entered the day before a soft lock began is admitted even if the period is locked today. Reversal entries resolve under one of three declared ERP conventions (original_date, first_open_period, explicit_date) with the resolved date reported per entry. Per-entry output carries decision (allow / allow_exempt / refuse), period_id, lock_state_at_entry, exempt_role_used, resolved_effective_date, refusal_code, and a self_approval flag comparing caller-declared preparer and approver labels (null when either is absent); totals roll up by decision and by period, and the exact policy vintage travels as a canonical policy_digest of the declared period table. A structurally bad policy (overlapping periods, inverted bounds, unknown lock states, non-ascending lock events, a missing or incomplete reversal policy, or more than 500 entries) refuses the whole run with execution_state did_not_run - never a silent allow. Scope limits, stated plainly: this node does not prevent or block any posting anywhere - it evaluates declared facts against a declared policy; the lock history and entered_on timestamps are caller-declared and are not verified by this node (the receipt proves recomputation only); a refused or exempt entry is not, by itself, evidence of fraud, and nothing here states whether any control is effective under SOX or ISA; and none of the three reversal policies is required by an accounting standard - all three are common ERP conventions. Dates are strict integer civil dates (2026-02-29 refuses; 2028-02-29 is valid); entry_id, prepared_by and approved_by are opaque synthetic labels; zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/790-je-period-lock-gate.html
- Markdown twin: https://ainumbers.co/chaingraph/790-je-period-lock-gate.md
- MCP tool: gate_je_period_lock (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- policy_version (string, required)
- periods (array, required)
- soft_lock_exempt_roles (array, optional)
- reversal_policy (string, optional)
- explicit_reversal_date (string, optional)
- as_of_date (string, optional)
- entries (array, required)

## Outputs

- entries (array, required)
- entry_count (number, required)
- execution_state (string, required)
- policy_digest (string, required)
- policy_version (string, required)
- reason (null,string, required)
- totals_by_decision (object, required)
- totals_by_period (object, required)
- warnings (array, required)

## Sample

```json
{
  "policy_version": "close-policy-2026Q1",
  "periods": [
    {
      "period_id": "FY26-01",
      "start_date": "2026-01-01",
      "end_date": "2026-01-31",
      "lock_events": []
    },
    {
      "period_id": "FY26-02",
      "start_date": "2026-02-01",
      "end_date": "2026-02-28",
      "lock_events": [
        {
          "from_date": "2026-02-05",
          "state": "soft_locked"
        }
      ]
    },
    {
      "period_id": "FY26-03",
      "start_date": "2026-03-01",
      "end_date": "2026-03-31",
      "lock_events": [
        {
          "from_date": "2026-03-10",
          "state": "soft_locked"
        },
        {
          "from_date": "2026-03-20",
          "state": "hard_closed"
        }
      ]
    },
    {
      "period_id": "FY27-01",
      "start_date": "2027-01-01",
      "end_date": "2027-12-31",
      "lock_events": [
        {
          "from_date": "2027-06-01",
          "state": "hard_closed"
        }
      ]
    }
  ],
  "soft_lock_exempt_roles": [
    "controller"
  ],
  "reversal_policy": "original_date",
  "entries": [
    {
      "entry_id": "E1",
      "effective_date": "2026-01-15",
      "roles": [
        "staff"
      ],
      "entered_on": "2026-01-10"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `gate_je_period_lock` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
