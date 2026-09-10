# Agentic Mandate Sandbox

Builds a deterministic Agent Guardrail Mandate skeleton from declared spend caps, MCC allowlist/blocklist, velocity rules, time windows, and approval thresholds. Stage 1 of the Agentic Policy Chain. The browser page additionally runs an interactive randomized synthetic-transaction simulator against the mandate for exploration; that non-deterministic step is a UI feature only and is not part of this server artifact's hashed output. Zero PII, client-side compute in the browser tool, deterministic server compute for MCP callers.

- Page: https://ainumbers.co/chaingraph/art-15-agentic-mandate-sandbox.html
- Markdown twin: https://ainumbers.co/chaingraph/art-15-agentic-mandate-sandbox.md
- MCP tool: simulate_agent_spend_policy (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- activeMCCs (array, required)
- allowWeekend (unknown, required)
- approvalTimeout (unknown, required)
- blockHoliday (unknown, required)
- boardSig (unknown, required)
- capDaily (unknown, required)
- capFlag (unknown, required)
- capMonthly (unknown, required)
- capSingle (unknown, required)
- destJurisdiction (unknown, required)
- dualSig (unknown, required)
- kycCheck (unknown, required)
- ofacCheck (unknown, required)
- origJurisdiction (unknown, required)
- rail (unknown, required)
- singleSig (unknown, required)
- timeEnd (unknown, required)
- timeStart (unknown, required)
- velCooldown (unknown, required)
- velDay (unknown, required)
- velHour (unknown, required)

## Outputs

- approval_thresholds (object, optional)
- compliance (object, optional)
- corridor (object, optional)
- mandate_id (string, optional)
- mcc_constraints (object, optional)
- note (string, optional)
- rail (string, optional)
- rejected_inputs (array, optional)
- schema (string, optional)
- spend_caps (object, optional)
- time_windows (object, optional)
- velocity_rules (object, optional)

## Sample

```json
{
  "capSingle": 5000,
  "capDaily": 15000,
  "capMonthly": 100000,
  "capFlag": 2000,
  "velHour": 3,
  "velDay": 20,
  "velCooldown": 5,
  "timeStart": "06:00",
  "timeEnd": "22:00",
  "allowWeekend": true,
  "blockHoliday": false,
  "singleSig": true,
  "dualSig": true,
  "boardSig": false,
  "approvalTimeout": 30,
  "rail": "PIX",
  "origJurisdiction": "BR",
  "destJurisdiction": "US",
  "kycCheck": true,
  "ofacCheck": true,
  "activeMCCs": [
    "5411",
    "5541",
    "5912",
    "5812",
    "5311",
    "7011",
    "4511",
    "7512",
    "4814",
    "7372",
    "8011",
    "4900",
    "6010",
    "5999"
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_agent_spend_policy` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
