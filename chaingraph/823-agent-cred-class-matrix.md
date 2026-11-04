# Agent Cred Class Matrix

Maps five agent payment credential classes (ACP shared payment token, Visa VIC / Mastercard agentic network token, API-key card proxy, x402 EIP-3009 permit, wallet delegated session key) across five columns: scope, expiry, replay protection, revocability, and what the agent can learn. Scope, expiry and replay cells for the three covered classes chain to sibling verdicts from closed per-column sets (SPT chains to the ACP shared payment token linter; network tokens chain to the Visa VIC or Mastercard agentic token builders; x402 scope chains to the agent token scope checker, expiry to the mandate authorization gate or the permit2 evidence recomputer, replay to the recomputer) and the kernel refuses any id outside the closed set rather than emitting it. The two classes no sibling covers (the card proxy and the wallet session key) carry declared local facts from closed per-class vocabularies traced to a registered clause-snapshot pin set: the proxy's container-scoped token use and fail-closed at-most-once forwarding, the session key's counterparty-and-chain-scoped grant and unix-timestamp expiry rule. Two columns are settled by no cited source (the proxy's expiry and the session key's replay protection), so the honest `unpinned_in_cited_sources` marker exists and always raises LOCAL_FACT_UNPINNED, mirroring into the review list. Revocability and learn are declared columns for every class, validated for closed vocabulary and completeness only: refusals never throw, they raise a flag in compliance_flags and mirror into output_payload.manual_review_required. The rail verdict input consumes the art-133 payment rail trust crosswalk output shape, and rail_acceptance_summary is emitted only when any_accepted equals the OR of rail acceptances. Declared limits: the matrix cites sibling verdicts and never recomputes them, and the kernel validates declarations for vocabulary, not truth.

- Page: https://ainumbers.co/chaingraph/823-agent-cred-class-matrix.html
- Markdown twin: https://ainumbers.co/chaingraph/823-agent-cred-class-matrix.md
- MCP tool: compute_agent_cred_class_matrix (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- rail_verdict (object, required)
- classes (object, required)
- revocation (object, optional)
- learn (object, optional)

## Outputs

- matrix (array, optional)
- rail_acceptance_summary (object, optional)
- manual_review_required (array, optional)

## Sample

```json
{
  "rail_verdict": {
    "any_accepted": true,
    "rails": {
      "mastercard_agent_pay": { "accepted": false, "gaps": ["testnet-only-integration"] },
      "visa_tap": { "accepted": true, "gaps": [] },
      "web_bot_auth": { "accepted": false, "gaps": [] }
    }
  },
  "classes": {
    "shared_payment_token": { "chain_sources": { "scope": "acp-checkout-shared-payment-token-linter", "expiry": "acp-checkout-shared-payment-token-linter", "replay_protection": "acp-checkout-shared-payment-token-linter" } },
    "network_agent_token": { "chain_sources": { "scope": "visa-vic-agent-token-scope-builder", "expiry": "mastercard-agentic-token-builder", "replay_protection": "mastercard-agentic-token-builder" } },
    "x402_permit": { "chain_sources": { "scope": "art-385-agent-token-scope-checker", "expiry": "art-703-mandate-authorization-gate", "replay_protection": "art-699-x402-permit2-evidence-recomputer" } },
    "api_key_card_proxy": { "local_facts": { "scope": "container_scoped_token_use", "expiry": "unpinned_in_cited_sources", "replay_protection": "fail_closed_single_forward" } },
    "wallet_session_key": { "local_facts": { "scope": "counterparty_and_chain_scoped_grant", "expiry": "expiry_rule_unix_timestamp", "replay_protection": "unpinned_in_cited_sources" } }
  },
  "revocation": {
    "shared_payment_token": { "mechanism": "declared_not_revocable", "time_bound": true },
    "network_agent_token": { "mechanism": "authoritative_party_revoke_call", "time_bound": true },
    "x402_permit": { "mechanism": "authoritative_party_revoke_call", "time_bound": true },
    "api_key_card_proxy": { "mechanism": "authoritative_party_revoke_call", "time_bound": false },
    "wallet_session_key": { "mechanism": "authoritative_party_revoke_call", "time_bound": true }
  },
  "learn": {
    "shared_payment_token": { "opaque_credential": false, "learns_identity": false, "learns_action": true, "publicly_visible": false, "credential_persisted_or_logged": false },
    "network_agent_token": { "opaque_credential": false, "learns_identity": false, "learns_action": true, "publicly_visible": false, "credential_persisted_or_logged": false },
    "x402_permit": { "opaque_credential": false, "learns_identity": true, "learns_action": true, "publicly_visible": true, "credential_persisted_or_logged": false },
    "api_key_card_proxy": { "opaque_credential": false, "learns_identity": false, "learns_action": true, "publicly_visible": true, "credential_persisted_or_logged": false },
    "wallet_session_key": { "opaque_credential": true, "learns_identity": false, "learns_action": true, "publicly_visible": false, "credential_persisted_or_logged": false }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_agent_cred_class_matrix` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
