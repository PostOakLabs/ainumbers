#!/usr/bin/env node
/**
 * scripts/gen-wellknown-catalogs.mjs — AI-CATALOG-1 (AGENT-REACH-BUILD-SPEC §3.2)
 *
 * Emits BOTH well-known catalogs from one generator (generator law: one source,
 * two surfaces), derived from data/suite-map.json + .well-known/mcp.json +
 * .well-known/agent-card.json:
 *
 *   (a) .well-known/ai-catalog.json  — Google's Agentic Resource Discovery
 *       "AI Catalog" (application/ai-catalog+json; spec pinned and vendored at
 *       chaingraph/standard/vendor/ai-catalog.schema.json, which
 *       chaingraph/standard/schema-validate.mjs enforces).
 *   (b) .well-known/api-catalog      — RFC 9727 API Catalog as
 *       application/linkset+json (api-catalog → docs/openapi.json,
 *       service-doc → mcp.html).
 *   (c) .well-known/jwks.json        — the A2A Signed Agent Card's public key
 *       (A2A-CARD-SIGN-1, AGENT-REACH-BUILD-SPEC §3.8). Derived from the card's
 *       own signatures[] protected header `kid` (a did:key, the §16 fingerprint
 *       convention) — PUBLIC material only, no private key anywhere near this
 *       generator (the card is signed locally by scripts/sign-agent-card.mjs and
 *       committed; that commit is this file's input).
 *
 * DETERMINISM: no wall-clock values anywhere (the EXCLUDED list in
 * scripts/derived-artifacts.mjs bans non-idempotent wall-clock generators from
 * the derived set). Output is a pure function of the tracked inputs, so the
 * twice-run byte-identical idempotency proof (SO #35) holds by construction.
 *
 * Single-writer (SO #35): this generator is registered in
 * scripts/derived-artifacts.mjs (COVERED ids ai-catalog, api-catalog); the
 * files are written by derived-artifacts-regen.yml on main, never committed in
 * a PR.
 *
 * Usage:
 *   node scripts/gen-wellknown-catalogs.mjs          # write both files
 *   node scripts/gen-wellknown-catalogs.mjs --check  # freshness gate (exit 1 if stale or missing)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const SITE = 'https://ainumbers.co';
const OUT_AI = resolve(REPO, '.well-known', 'ai-catalog.json');
const OUT_API = resolve(REPO, '.well-known', 'api-catalog');
const OUT_JWKS = resolve(REPO, '.well-known', 'jwks.json');

const mcp = JSON.parse(readFileSync(resolve(REPO, '.well-known', 'mcp.json'), 'utf8'));
const agentCard = JSON.parse(readFileSync(resolve(REPO, '.well-known', 'agent-card.json'), 'utf8'));
// suite-map.json is part of the declared input set (AGENT-REACH-BUILD-SPEC §3.2);
// it is read and its rail surfaces sanity-checked so a suite-map restructure that
// removes the surfaces these catalogs point at fails here rather than publishing
// a catalog full of dead URLs.
const suiteMap = JSON.parse(readFileSync(resolve(REPO, 'data', 'suite-map.json'), 'utf8'));
if (!Array.isArray(suiteMap.rail) || suiteMap.rail.length === 0)
  fail('data/suite-map.json has no rail[] surfaces — refusing to emit a dead catalog');

const suiteServer = mcp.servers.find((s) => s.id === 'ainumbers-fintech-suite');
const appsServer = mcp.servers.find((s) => s.id === 'ainumbers-apps');
if (!suiteServer || !appsServer) fail('.well-known/mcp.json is missing an expected server entry');

// webmcp.json is included ONLY if it exists (row §2: conditional entry). The
// existence probe makes the output a pure function of the tree, so idempotency
// still holds.
const webmcpExists = existsSync(resolve(REPO, '.well-known', 'webmcp.json'));

const entries = [
  {
    identifier: 'urn:air:ainumbers.co:mcp:apps',
    type: 'application/mcp-server-card+json',
    url: appsServer.endpoint_url,
    description: appsServer.description,
  },
  {
    identifier: 'urn:air:ainumbers.co:mcp:fintech-suite',
    type: 'application/mcp-server-card+json',
    url: suiteServer.server_url,
    description: suiteServer.description,
  },
  {
    identifier: 'urn:air:ainumbers.co:agent:openchain-graph-suite',
    type: 'application/a2a-agent-card+json',
    url: `${SITE}/.well-known/agent-card.json`,
  },
  {
    identifier: 'urn:air:ainumbers.co:api:openapi',
    type: 'application/openapi+json',
    url: `${SITE}/docs/openapi.json`,
    description: 'OpenAPI description of the suite surfaces.',
  },
  {
    identifier: 'urn:air:ainumbers.co:doc:llms-txt',
    type: 'text/plain',
    url: mcp.llms_txt,
  },
  {
    identifier: 'urn:air:ainumbers.co:doc:llms-full-txt',
    type: 'text/plain',
    url: `${SITE}/llms-full.txt`,
  },
  {
    identifier: 'urn:air:ainumbers.co:mcp:anchor',
    type: 'application/mcp-server-card+json',
    url: 'https://anchor.ainumbers.co/mcp',
    description: 'Anchor MCP server (anchor-suite).',
  },
];
if (webmcpExists)
  entries.push({
    identifier: 'urn:air:ainumbers.co:agent:webmcp',
    type: 'application/webmcp+json',
    url: `${SITE}/.well-known/webmcp.json`,
    description: 'WebMCP page registrations (model context for browser agents).',
  });

const aiCatalog = {
  specVersion: '1.0',
  host: {
    displayName: 'AINumbers',
    identifier: 'did:web:ainumbers.co',
    documentationUrl: `${SITE}/mcp.html`,
  },
  entries,
};

// RFC 9727 application/linkset+json. The `api-catalog` relation is the machine
// API description; `service-doc` is the human/service documentation. Serving
// the RFC 9727 `Link` header on HEAD requests is a Cloudflare header rule
// (Tim item, recorded in research/AGENT-REACH-MASTER-DISPATCH-2026-09-05.md).
const apiCatalog = {
  linkset: [
    {
      anchor: `${SITE}/.well-known/api-catalog`,
      item: [
        {
          href: `${SITE}/docs/openapi.json`,
          rel: 'api-catalog',
          type: 'application/openapi+json',
        },
        {
          href: `${SITE}/mcp.html`,
          rel: 'service-doc',
          type: 'text/html',
        },
      ],
    },
  ],
};

const aiText = JSON.stringify(aiCatalog, null, 2) + '\n';
const apiText = JSON.stringify(apiCatalog, null, 2) + '\n';

// ── .well-known/jwks.json (A2A-CARD-SIGN-1) ───────────────────────────────────
// The signed card's signatures[0].protected header carries `kid` = did:key:z…
// (multicodec ed25519-pub 0xed 0x01, base58btc — the rawPubkeyToDidKey
// convention). Decoding it back to the raw 32-byte public key is pure public
// math, so the JWKS is a deterministic function of the committed card.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58decode(str) {
  // verbatim from chaingraph/kernels/_proof.mjs (single canon for did:key math)
  let zeros = 0; while (zeros < str.length && str[zeros] === '1') zeros++;
  const bytes = [0];
  for (let i = zeros; i < str.length; i++) {
    let carry = B58.indexOf(str[i]);
    if (carry < 0) throw new Error('bad base58 char');
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let k = 0; k < bytes.length; k++) out[zeros + bytes.length - 1 - k] = bytes[k];
  return out;
}
let jwksText = null;
{
  const sig = agentCard.signatures && agentCard.signatures[0];
  if (!sig || typeof sig.protected !== 'string')
    fail('.well-known/agent-card.json has no signatures[] — run scripts/sign-agent-card.mjs locally and commit the signed card (A2A-CARD-SIGN-1)');
  let kid;
  try {
    kid = JSON.parse(Buffer.from(sig.protected, 'base64url').toString('utf8')).kid;
  } catch {
    fail('agent-card signatures[0].protected is not decodable JSON');
  }
  if (typeof kid !== 'string' || !kid.startsWith('did:key:z'))
    fail(`agent-card signature kid is not a did:key (got ${JSON.stringify(kid).slice(0, 40)})`);
  const prefixed = b58decode(kid.slice('did:key:z'.length));
  if (prefixed.length !== 34 || prefixed[0] !== 0xed || prefixed[1] !== 0x01)
    fail('signature kid does not decode to a 32-byte Ed25519 multicodec key');
  const raw = prefixed.slice(2);
  const jwk = { kty: 'OKP', crv: 'Ed25519', kid, x: Buffer.from(raw).toString('base64url') };
  jwksText = JSON.stringify({ keys: [jwk] }, null, 2) + '\n';
}

function fail(msg) {
  console.error(`gen-wellknown-catalogs: ${msg}`);
  process.exit(1);
}

if (process.argv.includes('--check')) {
  let red = false;
  for (const [path, want, label] of [
    [OUT_AI, aiText, '.well-known/ai-catalog.json'],
    [OUT_API, apiText, '.well-known/api-catalog'],
    [OUT_JWKS, jwksText, '.well-known/jwks.json'],
  ]) {
    if (!existsSync(path)) {
      console.error(`✗ ${label}: MISSING (main-side regen writes it; run without --check locally)`);
      red = true;
      continue;
    }
    const have = readFileSync(path, 'utf8');
    if (have === want) console.log(`✓ ${label} fresh`);
    else {
      console.error(`✗ ${label} STALE — regenerated bytes differ from disk`);
      red = true;
    }
  }
  process.exit(red ? 1 : 0);
}

writeFileSync(OUT_AI, aiText);
console.log(`wrote ${resolve(REPO, '.well-known', 'ai-catalog.json')} (${aiCatalog.entries.length} entries)`);
writeFileSync(OUT_API, apiText);
console.log(`wrote ${OUT_API}`);
writeFileSync(OUT_JWKS, jwksText);
console.log(`wrote ${OUT_JWKS}`);
