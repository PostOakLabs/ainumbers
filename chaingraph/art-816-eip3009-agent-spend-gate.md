# EIP-3009 Agent Spend Gate

Pre-sign gate for one EIP-3009 (ERC-3009, Draft) transferWithAuthorization or receiveWithAuthorization intent, decided against a caller-declared spend policy and a caller-pasted authorization ledger. Returns exactly one decision: SPEND (within the declared policy), DENY (outside the declared policy: structural authorization defects, signer mismatch, disallowed domain, zero or replayed nonce, invalid or expired validity window, denied or unlisted payee, missing receive-variant contract), OVER_LIMIT (per-transaction cap, window cap or velocity count exceeded, or a same-economics duplicate inside the declared duplicate window), or INDETERMINATE (the policy does not declare enough to decide, for example no per-transaction cap or no window caps, or a domain without verifying_contract or chain_id so the nonce-replay rule cannot run). SPEND requires the nonce-replay rule to have been evaluated. DENY outranks OVER_LIMIT, every failing rule is listed, and the first failing rule in the fixed thirteen-rule order is primary. Rules that cannot run because their policy input is absent are reported as not evaluated rather than guessed. Arithmetic is pure decimal-string uint256 with fixed scan bounds. Counting follows the ruled classes: settled entries count toward window totals from their signed_at, signed-unexpired entries count regardless of age, canceled entries never count in sums but still match the nonce-replay check. Zero network calls, no signature recovery, no digest recomputation, no chain reads: the nonce check runs against the pasted ledger only, and on-chain nonce uniqueness is enforced by the token contract at settlement time. SPEND means within the declared policy; it is not an authorization to move funds and is not proof that funds moved.

- Page: https://ainumbers.co/chaingraph/art-816-eip3009-agent-spend-gate.html
- Markdown twin: https://ainumbers.co/chaingraph/art-816-eip3009-agent-spend-gate.md
- MCP tool: decide_eip3009_agent_spend (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "authorization": {
    "variant": "transfer",
    "from": "0x1111111111111111111111111111111111111111",
    "to": "0x2222222222222222222222222222222222222222",
    "value": "12x4",
    "validAfter": "1700000000",
    "validBefore": "1700003600",
    "nonce": "0xabababababababababababababababababababababababababababababababab"
  },
  "domain": {
    "name": "USD Coin",
    "version": "2",
    "chain_id": "84532",
    "verifying_contract": "0x31c8eacbff8e47cfbefd98d63ab04cbaff51c9cc"
  },
  "policy": {
    "agent_address": "0x1111111111111111111111111111111111111111",
    "allowed_chain_ids": [
      "84532"
    ],
    "allowed_tokens": [
      "0x31c8eacbff8e47cfbefd98d63ab04cbaff51c9cc"
    ],
    "payee_allowlist": [
      "0x2222222222222222222222222222222222222222"
    ],
    "payee_denylist": [
      "0x4444444444444444444444444444444444444444"
    ],
    "per_tx_cap": "1000",
    "window_caps": [
      {
        "window_seconds": 3600,
        "cap": "2000"
      }
    ],
    "velocity": [
      {
        "window_seconds": 600,
        "max_count": 3
      }
    ],
    "max_validity_seconds": 7200,
    "max_future_start_seconds": 300,
    "duplicate_window_seconds": 1800,
    "require_receive_for": []
  },
  "ledger": [],
  "now_unix": 1700000100
}
```

## Verify

Run the sample policy_parameters through MCP tool `decide_eip3009_agent_spend` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
