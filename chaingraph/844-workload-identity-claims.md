# Workload Identity Claims Lint

Lints the DECODED claims of a workload-identity token and, optionally, of a token produced by an exchange, against a policy you declare: a maximum lifetime in seconds, a maximum actor-chain depth, required audience values, an allowed trust-domain list, and whether the exchanged scope must narrow. Checks that the subject is a well-formed SPIFFE identifier in an allowed trust domain, that the audience is present and matches, that expiry is present and the lifetime stays within the declared maximum, that issued-at and not-before are sane against a clock you supply, that every actor in the actor chain is an identifier and the chain is not deeper than allowed, that a may-act claim is consistent with the first actor of the exchanged token, and that an exchanged scope is a subset of the subject scope and the exchanged audience or resource is not wider. The verdict is within policy, outside policy, or indeterminate when a claim the policy needs is absent; an absent claim is never guessed. Values only: names, e-mail addresses, free text, unknown claims, signature material and anything shaped like a compact signed token are refused with an explicit code and never echoed, as are claim values of the wrong type, negative numeric dates, and a may-act claim that is not one well-formed actor object. Lints claims you paste against a policy you declare. It does not verify signatures, does not contact an identity provider and does not prove the token is genuine.

- Page: https://ainumbers.co/chaingraph/844-workload-identity-claims.html
- Markdown twin: https://ainumbers.co/chaingraph/844-workload-identity-claims.md
- MCP tool: lint_workload_identity_token_claims (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "policy": {
    "max_lifetime_seconds": 3600,
    "max_actor_depth": 2,
    "required_audiences": [
      "svc-a"
    ],
    "allowed_trust_domains": [
      "example.org"
    ],
    "scope_must_narrow": true,
    "clock_now_epoch_seconds": 1700000100
  },
  "subject_claims": {
    "sub": "spiffe://example.org/ns/prod/sa/api",
    "aud": [
      "svc-a"
    ],
    "iat": 1700000000,
    "nbf": 1700000000,
    "exp": 1700003000,
    "scope": "read write"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_workload_identity_token_claims` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
