# UCP Capability Negotiation

Intersects the UCP capability sets two pasted profiles advertise: keeps the capabilities named by both sides at their highest mutually supported dated version, applies each extension's requires bounds, prunes extensions whose parents did not survive, and reports profile-shape findings (canonical keys[] placement, namespace authority binding against the reversed schema host, dev.ucp.* release pinning, protocol version format). Verify-only: decides from the two pasted profile objects and never fetches profiles, leaf documents, or schemas.

- Page: https://ainumbers.co/chaingraph/art-820-negotiate-ucp-capabilities.html
- Markdown twin: https://ainumbers.co/chaingraph/art-820-negotiate-ucp-capabilities.md
- MCP tool: negotiate_ucp_capabilities (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- business_profile (object, required)
- platform_profile (object, required)

## Outputs

- agreed_capabilities (object, required)
- dropped (array, required)
- findings (array, required)
- issues (array, required)
- primary_reason (string, required)
- protocol_version (string,null, required)
- verdict (string, required)

## Sample

```json
{
  "business_profile": {
    "ucp": {
      "version": "2026-08-25",
      "services": {},
      "payment_handlers": {},
      "capabilities": {
        "dev.ucp.shopping.checkout": [
          {
            "version": "2026-08-25"
          }
        ]
      }
    }
  },
  "platform_profile": {
    "ucp": {
      "version": "2026-08-25",
      "services": {},
      "payment_handlers": {},
      "capabilities": {
        "dev.ucp.shopping.checkout": [
          {
            "version": "2026-08-25"
          }
        ]
      }
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `negotiate_ucp_capabilities` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
