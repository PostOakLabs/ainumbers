# Client Porting Check

Checks whether a client's cleared positions and collateral are portable to a backup clearing member under a caller-declared porting window, given caller-declared position/collateral completeness and backup-member consent status. Evaluates one caller-supplied snapshot: an empty position set, a missed porting window, and a not-yet-consented backup member each resolve to a distinct, defined not-portable outcome rather than a generic failure. A portable verdict is an evaluation of the supplied snapshot, never a guarantee that porting will in fact occur, and this tool does not itself move any position or collateral. Clause: PFMI Principle 14 (Segregation and Portability), 17 CFR 240.15c3-3a where a broker-dealer customer-protection structure is in view.

- Page: https://ainumbers.co/chaingraph/art-532-client-porting-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-532-client-porting-check.md
- MCP tool: check_client_porting (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- backup_member_consent_status (unknown, required)
- backup_member_id (string, required)
- client_ref (string, required)
- collateral (array, required)
- default_event_at (unknown, optional)
- evaluated_at (unknown, optional)
- porting_window_hours (unknown, optional)
- positions (array, required)

## Outputs

- backup_member_consent_status (string, optional)
- backup_member_id (string, optional)
- citations (object, optional)
- client_ref (string, optional)
- collateral (array, optional)
- collateral_complete (boolean, optional)
- collateral_count (integer, optional)
- default_event_at (string, optional)
- elapsed_minutes (integer, optional)
- evaluated_at (string, optional)
- note (string, optional)
- porting_window_hours (integer, optional)
- position_count (integer, optional)
- positions (array, optional)
- positions_complete (boolean, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- total_collateral_display (string, optional)
- total_collateral_minor_units (integer, optional)
- total_notional_display (string, optional)
- total_notional_minor_units (integer, optional)
- verdict (string, optional)
- window_minutes (integer, optional)
- window_missed (boolean, optional)

## Sample

```json
{
  "client_ref": "CLIENT-A1",
  "backup_member_id": "BACKUP-MEMBER-77",
  "backup_member_consent_status": "consented",
  "default_event_at": "2026-08-04T09:00:00Z",
  "evaluated_at": "2026-08-04T15:00:00Z",
  "porting_window_hours": 48,
  "positions": [
    {
      "position_id": "POS-1",
      "product_type": "interest_rate_swap",
      "currency": "USD",
      "notional_minor_units": 5000000000,
      "complete": true
    },
    {
      "position_id": "POS-2",
      "product_type": "repo",
      "currency": "USD",
      "notional_minor_units": 1200000000,
      "complete": true
    }
  ],
  "collateral": [
    {
      "collateral_id": "COLL-1",
      "asset_type": "ust_bill",
      "currency": "USD",
      "amount_minor_units": 600000000,
      "complete": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_client_porting` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
