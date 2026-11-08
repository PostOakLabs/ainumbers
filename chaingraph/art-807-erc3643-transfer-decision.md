# ERC-3643 Transfer Decision Recompute

Recomputes whether one proposed ERC-3643 (T-REX) transfer or mint would go through, from caller-declared state only: identity registry entries (identity present, investor country, claims with caller-declared validity), required claim topics, trusted issuers per topic, bound compliance modules and token state (paused, frozen wallets, frozen token amounts, balances, total supply). Gate order follows the reference implementation pinned at commit 2f0704d: for a transfer the pause gate, then either party frozen, then the amount against the sender's unfrozen balance, then receiver identity verification, then every bound module in declared order as a logical AND; a mint skips the first three. The output names the first failing gate (and the failing module or claim topics) while still reporting every gate. Four module rules are re-implemented from the pinned legacy compliance features: max balance per identity, supply limit on mints, country restriction and country whitelist, reading the receiver's registry country. Any other module can be declared as a pass-through outcome, which the node aggregates but does not judge. An optional fund covenant (jurisdiction allowlist, holder cap, lock-up date) is evaluated separately over the same state and any divergence from the token-level outcome is reported. Declared-state recompute only: no chain is read, claim signatures are not checked, and the node cannot confirm the declared state matches a deployed contract. The output is not legal advice and not a determination that a transfer is lawful. Malformed or missing inputs refuse with INPUT_REFUSED rather than being coerced.

- Page: https://ainumbers.co/chaingraph/art-807-erc3643-transfer-decision.html
- Markdown twin: https://ainumbers.co/chaingraph/art-807-erc3643-transfer-decision.md
- MCP tool: recompute_erc3643_transfer_decision (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "transfer": {
    "from": "0x1111111111111111111111111111111111111111",
    "to": "0x2222222222222222222222222222222222222222",
    "amount": "100"
  },
  "identity_registry": [
    {
      "address": "0x1111111111111111111111111111111111111111",
      "identity_present": true,
      "country": 840,
      "claims": [
        {
          "topic": 1,
          "issuer": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "claim_valid": true
        }
      ]
    },
    {
      "address": "0x2222222222222222222222222222222222222222",
      "identity_present": true,
      "country": 840,
      "claims": [
        {
          "topic": 1,
          "issuer": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "claim_valid": true
        }
      ]
    }
  ],
  "required_claim_topics": [
    1
  ],
  "trusted_issuers": {
    "1": [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    ]
  },
  "compliance_modules": [
    {
      "id": "max_balance",
      "type": "max_balance",
      "params": {
        "max_balance": "1000"
      }
    }
  ],
  "token_state": {
    "paused": false,
    "frozen": {},
    "frozen_tokens": {},
    "balances": {
      "0x1111111111111111111111111111111111111111": "500",
      "0x2222222222222222222222222222222222222222": "0"
    },
    "total_supply": "500"
  },
  "chain_id": 1,
  "network_label": "declared-example"
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_erc3643_transfer_decision` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
