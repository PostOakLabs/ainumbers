# Tempo Validator Readiness Scorer

12-question readiness scorer for prospective Tempo Network validators across 5 dimensions: hardware (CPU/RAM/NVMe), OS/software (Linux x86_64/ARM64 glibc≥2.38, chrony/ntpd, ports 30303/8000/9000), key management (ed25519, on-chain registration), telemetry, and upgrade cadence (7-day SLA). Flags permissioned entry (partners@tempo.xyz required) and unpublished bond/stake/KYC obligations. infrastructure_mandate. iso20022:party-identification profile.

- Page: https://ainumbers.co/chaingraph/art-41-tempo-validator-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/art-41-tempo-validator-readiness.md
- MCP tool: score_tempo_validator_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "q1_cpu_cores": "yes",
  "q2_ram_gb": "yes",
  "q3_nvme_1gbps": "yes",
  "q4_linux_glibc": "yes",
  "q5_ntp_chrony": "yes",
  "q6_ports_open": "yes",
  "q7_ed25519_keypair": "yes",
  "q8_key_tempo_contact": "yes",
  "q9_port9000_scraping": "yes",
  "q10_alerting": "yes",
  "q11_7day_sla": "yes",
  "q12_runbook": "yes"
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_tempo_validator_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
