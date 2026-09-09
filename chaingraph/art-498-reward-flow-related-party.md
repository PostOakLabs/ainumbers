# Consortium Validator Reward-Flow Related-Party Classifier

Answers the question a consortium controller faces at quarter-end close on a permissioned Avalanche Evergreen L1: are any of the reward-manager precompile's payment recipients related parties of the reporting entity, and is what they received material. Takes a transcribed recipient list, the caller's own entity-ownership map, per-period reward amounts transcribed from the institution's own accounting export, a materiality threshold and a ruleset_version, and returns a per-recipient classification (same ultimate parent as the issuer, co-consortium member, unrelated, or unresolved), the aggregate related-party amount measured against the threshold, a gap list that names every recipient it could not resolve, and clearly-labelled draft ASC 850 / IAS 24 disclosure-note language. Own versioned ruleset carried in policy_parameters and echoed into the receipt: no ruleset is imported from any other control family, so one family's ruleset edit cannot move this node's hash. Flags, amounts and the pinned ASC 850 and IAS 24 citations are emitted unconditionally; the draft note is a convenience layer on top of them and is labelled DECISION-SUPPORT DRAFT, never legal or accounting advice. No coverage ratio and no percentage of recipients classified: the permitted form is a gap list naming each unresolved recipient. No chain observation, no RPC, no P-Chain query: recipients and amounts are transcribed by the caller. Not X: use art-459 for a segregation-of-duties conflict matrix over role assignments; this node classifies payment recipients against a group ownership structure. compliance_control. Zero PII: every recipient, entity and parent reference is an opaque caller-supplied string, and unmapped fields on caller objects are dropped rather than echoed.

- Page: https://ainumbers.co/chaingraph/art-498-reward-flow-related-party.html
- Markdown twin: https://ainumbers.co/chaingraph/art-498-reward-flow-related-party.md
- MCP tool: classify_reward_flow_related_party (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- consortium_member_refs (array, required)
- currency (unknown, required)
- issuer_ref (unknown, required)
- issuer_ultimate_parent_ref (unknown, required)
- materiality_threshold (unknown, required)
- ownership_map (array, required)
- period_ref (unknown, required)
- recipients (array, required)
- ruleset_version (unknown, required)

## Outputs

- as_of (string, optional)
- citations (object, optional)
- currency (string, optional)
- draft_disclosure_note (object, optional)
- flagged_recipient_count (integer, optional)
- flagged_recipient_refs (array, optional)
- flagged_total (integer, optional)
- gaps (array, optional)
- issuer_ref (string, optional)
- issuer_ultimate_parent_ref (string, optional)
- materiality_status (string, optional)
- materiality_threshold (integer, optional)
- period_ref (string, optional)
- recipient_count (integer, optional)
- recipients (array, optional)
- ruleset_version (string, optional)
- unquantified_related_recipient_count (integer, optional)
- unresolved_recipient_count (integer, optional)

## Sample

```json
{
  "ruleset_version": "avax-rparty-2026.07",
  "issuer_ref": "ISS-1",
  "issuer_ultimate_parent_ref": "UP-1",
  "period_ref": "FY2026-Q2",
  "as_of": "2026-07-30",
  "currency": "USD",
  "materiality_threshold": 25000,
  "consortium_member_refs": [
    "ENT-B"
  ],
  "ownership_map": [
    {
      "entity_ref": "ENT-A",
      "ultimate_parent_ref": "UP-1"
    },
    {
      "entity_ref": "ENT-B",
      "ultimate_parent_ref": "UP-2",
      "consortium_member": true
    },
    {
      "entity_ref": "ENT-C",
      "ultimate_parent_ref": "UP-3"
    },
    {
      "entity_ref": "ENT-D",
      "ultimate_parent_ref": "UP-4"
    }
  ],
  "recipients": [
    {
      "recipient_ref": "RCP-A",
      "entity_ref": "ENT-A",
      "reward_amount": 30000
    },
    {
      "recipient_ref": "RCP-B",
      "entity_ref": "ENT-B",
      "reward_amount": 12000
    },
    {
      "recipient_ref": "RCP-C",
      "entity_ref": "ENT-C",
      "reward_amount": 8000
    },
    {
      "recipient_ref": "RCP-D",
      "entity_ref": "ENT-D",
      "reward_amount": 1500.55
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_reward_flow_related_party` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
