#!/usr/bin/env node
// scripts/gen-install-links.mjs - MCP-INSTALL-LINKS-1.
// Computes the one-click "Add to <host>" install links for the AINumbers MCP
// server from the canonical endpoint. TODO-SSOT: AIN-AGENT-KIT-1's
// gen-agent-kit.mjs will absorb this (read agent-kit/install-links.json once
// the kit lands) - until then this module is the only derivation.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const ENDPOINT = 'https://mcp.ainumbers.co/mcp'; // canonical; matches regen_catalog.py / .well-known/mcp.json

const cursor = 'cursor://anysphere.cursor-deeplink/mcp/install?name=ainumbers&config='
  + Buffer.from(JSON.stringify({ url: ENDPOINT })).toString('base64');
const vscode = 'vscode:mcp/install?' + encodeURIComponent(JSON.stringify({ name: 'ainumbers', type: 'http', url: ENDPOINT }));
const goose = 'goose://extension?' + new URLSearchParams({
  url: ENDPOINT, type: 'streamable_http', id: 'ainumbers', name: 'AINumbers', description: 'AINumbers fintech MCP server',
}).toString();

export const installLinks = { endpoint: ENDPOINT, cursor, vscode, goose };

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(installLinks, null, 2));
}
