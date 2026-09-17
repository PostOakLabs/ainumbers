# Control Attestation Campaign Roll Up

Roll-up of a caller-declared control-attestation campaign: completion percentage (attested / controls_total, 2dp half-up), exception rate, a below_threshold flag against a declared escalation_threshold_pct, and an overall verdict (ESCALATION_FLAGGED iff below threshold OR exceptions>0 OR unresponded>0; else NO_ESCALATION). Declared-count discipline: attested, exception, and unresponded are the caller declarations, never observations this kernel makes; no register, GRC system, or control repository is read. Absent, non-integer, or out-of-range counts or threshold fail closed with each offending input named. The exam pack evidence leg is fed by pointer on the tool page, never in this kernel. Zero network, zero storage, zero clock.

- Page: https://ainumbers.co/tools/680-control-attestation-campaign-roll-up.html
- Markdown twin: https://ainumbers.co/tools/680-control-attestation-campaign-roll-up.md
- MCP tool: compute_control_attestation_campaign_roll_up (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "controls_total": 20,
  "attested": 17,
  "exceptions": 2,
  "unresponded": 1,
  "escalation_threshold_pct": 90
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_control_attestation_campaign_roll_up` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
