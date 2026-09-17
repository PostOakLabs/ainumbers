# Authzen Conformance Fixture

Evaluates the 8-decision AuthZEN Authorization API 1.0 certification fixture (AUTHZEN-CONFORMANCE-BUILD-SPEC.md) through the spec-mandated subject/action/resource/context request envelope (Information Model §5, Access Evaluation API §6.1-6.2), against a local hand-authored FIXTURE_POLICY. AuthZEN is an OpenID Foundation open specification rather than a regulation or legal instrument , standards_basis is implements_standard against a published spec, per SO #38 Step 0. The spec itself is silent on PDP decision logic (§2: 'policy language... beyond the scope of this specification'), so the 8 decision outcomes are mechanical, hand-authored test-fixture policy (role/resource-state/action-parameter rules), not spec-mandated content; what IS spec-mandated and cited below is the request/response envelope shape and the boolean-only Decision semantics the fixture is expressed through. Also checks the §6.1 'context is OPTIONAL and must not change the decision' invariant on every decision.

- Page: https://ainumbers.co/chaingraph/art-651-authzen-conformance-fixture.html
- Markdown twin: https://ainumbers.co/chaingraph/art-651-authzen-conformance-fixture.md
- MCP tool: compute_authzen_conformance_fixture (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- requests (array, optional)

## Outputs

- spec (string, optional)
- decision_count (number, optional)
- decisions (array, optional)
- all_match_expected (boolean,null, optional)
- all_context_invariant (boolean, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_authzen_conformance_fixture` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
