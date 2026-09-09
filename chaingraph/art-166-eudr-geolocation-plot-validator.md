# EUDR Geolocation Plot Validator

Validate GeoJSON plot geolocation for EUDR compliance: geometry type (Point or Polygon), coordinate range validity, EUDR size rule (plots >=4 ha require Polygon, Art. 9(1)(d)), polygon ring closure, and micro-operator postal-address exemption path. Returns valid verdict and issues list. Feeds commodity scope classifier (art-167). Zero network, zero PII. Reg. EU 2023/1115.

- Page: https://ainumbers.co/chaingraph/art-166-eudr-geolocation-plot-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-166-eudr-geolocation-plot-validator.md
- MCP tool: validate_eudr_geolocation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- geo (unknown, optional)

## Outputs

- area_ha (number, optional)
- coordinates_valid (boolean, optional)
- geo_type (string, optional)
- issues (array, optional)
- micro_operator_exemption (boolean, optional)
- polygon_closed (string, optional)
- size_rule_met (boolean, optional)
- valid (boolean, optional)

## Sample

```json
{
  "geo": {
    "type": "Point",
    "coordinates": [
      -47.8762,
      -15.7942
    ],
    "area_ha": 2.5,
    "declared_country": "BR"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_eudr_geolocation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
