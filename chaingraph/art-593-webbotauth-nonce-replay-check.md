# Web Bot Auth Nonce & Replay-Window Checker

Checks a Visa TAP-shaped nonce for format (minimum entropy, base64url), freshness against a caller-supplied now_unix (created/expires spread capped at TAP's 8-minute limit), and an optional caller-supplied seen-nonce record. This kernel is a pure function invoked fresh per call with zero persistent storage - it cannot itself remember whether a nonce was seen on a prior invocation. Replay prevention depends entirely on the caller supplying an accurate seen-nonce record from its own storage; this verifier is stateless and cannot detect replay on its own. Zero network calls; never a facilitator, proxy, or settlement relay. Feeds the signatures-directory validator (art-130) in the visa-tap-agent-verification chain.

- Page: https://ainumbers.co/chaingraph/art-593-webbotauth-nonce-replay-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-593-webbotauth-nonce-replay-check.md
- MCP tool: check_webbotauth_nonce_replay (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- nonce (string, required)
- created (number, required)
- expires (number, required)
- now_unix (number, required)
- max_age_s (number, optional)
- seen_nonces (array, optional)
- nonce_already_used (boolean, optional)

## Outputs

- format_ok (boolean, optional)
- spread_ok (boolean,null, optional)
- fresh (boolean,null, optional)
- already_used (boolean, optional)
- nonce_valid (boolean, optional)
- verdict (string, optional)

## Sample

```json
{
  "nonce": "aB3dEfGhIjKlMnOpQrStUvWxYz012345",
  "created": 1750000000,
  "expires": 1750000300,
  "now_unix": 1750000060,
  "max_age_s": 3600
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_webbotauth_nonce_replay` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
