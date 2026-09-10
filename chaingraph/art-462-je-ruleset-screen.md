# Journal-Entry Ruleset Screen

Runs a caller-declared, versioned journal-entry testing ruleset over a caller-declared JE extract and flags each entry that trips one or more rules: weekend/holiday postings, round-number entries, suspense/manual-account postings, post-close entries, and unusual user/account pairings. Every firm-specific convention (which rules are active, what counts as a round number, the weekend day set, the holiday calendar, the suspense-account list, the period-close date, the authorized user/account pairing list) is a caller-declared policy input, never a silent default; the ruleset_version string is echoed verbatim in the output so the artifact records exactly which policy vintage produced the flags. Optionally binds to a caller-declared extract_population_hash for audit-trail linkage to a hashed JE population (soft coupling only, e.g. to an art-460-style extract-integrity record if that node has landed). First of three ARCB-K-1 substantive audit-recalculation kernels. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-462-je-ruleset-screen.html
- Markdown twin: https://ainumbers.co/chaingraph/art-462-je-ruleset-screen.md
- MCP tool: screen_je_ruleset (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- active_rules (unknown, required)
- entries (unknown, required)
- extract_population_hash (unknown, required)
- rule_params (unknown, required)
- rule_severity (unknown, required)
- ruleset_version (unknown, required)

## Outputs

- active_rules (array, optional)
- extract_population_hash (string, optional)
- flagged_count (integer, optional)
- flagged_entries (array, optional)
- missing_policy_inputs (array, optional)
- rule_params_used (object, optional)
- rule_trip_counts (object, optional)
- ruleset_version (string, optional)
- total_entries (integer, optional)

## Sample

```json
{
  "ruleset_version": "2026.1",
  "extract_population_hash": "sha256:abc123",
  "active_rules": [
    "weekend_holiday",
    "round_number",
    "suspense_manual",
    "post_close",
    "unusual_user_account"
  ],
  "rule_params": {
    "weekend_days": [
      0,
      6
    ],
    "holiday_dates": [
      "2026-01-01"
    ],
    "round_number_increment": 1000,
    "suspense_accounts": [
      "9999-SUSPENSE"
    ],
    "post_close_date": "2026-01-31",
    "authorized_user_account_pairs": [
      {
        "user_id": "u1",
        "account_id": "1000-CASH"
      },
      {
        "user_id": "u2",
        "account_id": "2000-AP"
      }
    ]
  },
  "entries": [
    {
      "entry_id": "JE-1",
      "posting_date": "2026-01-10",
      "amount": 5000,
      "account_id": "1000-CASH",
      "user_id": "u1",
      "description": "round posting",
      "is_manual": false
    },
    {
      "entry_id": "JE-2",
      "posting_date": "2026-01-11",
      "amount": 1234.56,
      "account_id": "9999-SUSPENSE",
      "user_id": "u2",
      "description": "suspense clearing",
      "is_manual": false
    },
    {
      "entry_id": "JE-3",
      "posting_date": "2026-02-03",
      "amount": 750,
      "account_id": "3000-EXP",
      "user_id": "u1",
      "description": "post close adj",
      "is_manual": false
    },
    {
      "entry_id": "JE-4",
      "posting_date": "2026-01-12",
      "amount": 420,
      "account_id": "4000-REV",
      "user_id": "u3",
      "description": "unusual pairing",
      "is_manual": false
    },
    {
      "entry_id": "JE-5",
      "posting_date": "2026-01-13",
      "amount": 310,
      "account_id": "1000-CASH",
      "user_id": "u1",
      "description": "clean entry",
      "is_manual": false
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `screen_je_ruleset` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
