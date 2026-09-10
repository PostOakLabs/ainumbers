# Member Margin Call Lifecycle

Tracks a clearing member's margin call through its declared lifecycle states - issued, confirmed, funded, or disputed and escalated as a contingency path - against a caller-declared SLA window, and attests whether the call was funded within the CCP's own published timing rule. Checks that the declared state timestamps are chronologically consistent and, for a still-open call, whether it has already run past its SLA as of a caller-declared evaluation point. Emits an informational suggested gate route (end, escalate, or hold) without itself implementing any escalation workflow. Region-portable: currency and the SLA window are caller-declared inputs, with no CCP or jurisdiction hardcoded. Deterministic arithmetic only. Zero network, zero PII - the member reference is an opaque caller-supplied string, never a raw identity.

- Page: https://ainumbers.co/chaingraph/art-531-member-margin-call-lifecycle.html
- Markdown twin: https://ainumbers.co/chaingraph/art-531-member-margin-call-lifecycle.md
- MCP tool: attest_margin_call_lifecycle (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "call_id": "MC-0001",
  "member_ref": "MEMBER-REF-1042",
  "currency": "USD",
  "amount_minor_units": 250000000,
  "sla_minutes": 60,
  "issued_at": "2026-07-31T14:00:00Z",
  "as_of": "2026-07-31T15:30:00Z",
  "confirmed_at": "2026-07-31T14:10:00Z",
  "funded_at": "2026-07-31T14:45:00Z"
}
```

## Verify

Run the sample policy_parameters through MCP tool `attest_margin_call_lifecycle` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
