---
name: agent-identity-gate
description: "Verify a bot’s RFC 9421 signature, replay window, and pinned JWKS before letting it in. Use when the task is an agentic commerce or payments question. Written for the platform security audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "agent-identity-gate"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# Agent identity gate

Verify a bot’s RFC 9421 signature, replay window, and pinned JWKS before letting it in.

## Prompt

Decide whether an automated client may enter, and keep the decision receipt.

1. Capture the client's request signature headers (RFC 9421 signature-input, signature, and the webbotauth document).
2. Call verify_webbotauth_signature on the captured headers and the served webbotauth document. Record pass/fail and the key id used.
3. Call check_webbotauth_nonce_replay with the nonce and timestamp window. Record whether the nonce was seen before.
4. Call check_jwks_pinned_directory to confirm the signing key is the key the operator pinned in the directory. Record the pin match.
5. Run the chain visa-tap-agent-verification with run_chain, which composes the three checks. Record the chain verdict and execution_hash.
6. Negative test: replay step 2 with a one-byte-changed signature and confirm it fails. Quote the error.
7. Give me the ledger link for the chain receipt.
8. Write the gate note for your security log: client identity, which checks passed, the one negative test, and the ledger link. State what the gate does not cover (authorization and rate limits are your edge's job, not the signature's).
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
