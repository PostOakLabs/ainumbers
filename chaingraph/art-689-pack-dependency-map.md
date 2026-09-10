# Pack Dependency Map

Maps the blast radius of a changed component across caller-declared pack-to-component usage lists: each declared pack carries the component identifiers it declares, and the kernel emits the impacted-pack set (in declared order), the impact count, a trace restating the membership count, and an overall verdict (IMPACT_MAPPED when at least one declared usage list contains the changed component; NO_IMPACT when none does). Every impacted pack is a direct (depth-1) consumer: the kernel maps membership in the declared lists only; it computes no transitive closure and claims no observation of any real repository, registry, or build system. The impacted-pack export is a registry export intended for the drift sweep's allowlist decisions. Zero storage, zero network, no runtime clock.

- Page: https://ainumbers.co/chaingraph/art-689-pack-dependency-map.html
- Markdown twin: https://ainumbers.co/chaingraph/art-689-pack-dependency-map.md
- MCP tool: compute_pack_dependency_map (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "packs": [
    {
      "pack": "exam-readiness",
      "uses": [
        "kern-roll",
        "kern-date"
      ]
    },
    {
      "pack": "close-center",
      "uses": [
        "kern-date"
      ]
    }
  ],
  "changed_component": "kern-date"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_pack_dependency_map` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
