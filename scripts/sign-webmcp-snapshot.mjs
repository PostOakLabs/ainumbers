#!/usr/bin/env node
/**
 * scripts/sign-webmcp-snapshot.mjs: WEBMCP-SIGNED-SNAPSHOT-1
 *
 * Writes /.well-known/webmcp-signed.json: a dated snapshot of the WebMCP tool surface
 * (per tool: name, description_sha256, input_schema_sha256, annotations_sha256),
 * signed with a DETACHED EdDSA JWS over the JCS-canonicalised snapshot
 * (jcsStringify from chaingraph/kernels/_hash.mjs). The JWS implementation is the
 * single shared one in scripts/lib/detached-jws.mjs (also used by sign-agent-card.mjs).
 *
 * The protected header carries typ "webmcp-snapshot+jws", so a signature over the agent
 * card (typ "JOSE") can never verify as a snapshot, and vice versa.
 *
 * WEBMCP-SIGNED-EXPIRY-1: the signed payload also carries `expires` (generated_at + 30
 * days) and `version` (previous published value + 1, derived by
 * nextSnapshotVersion() in scripts/lib/webmcp-snapshot.mjs). Verifiers reject an
 * expired snapshot and a version lower than the highest seen this session, so a
 * frozen or rolled-back old snapshot no longer verifies. Key handling is UNCHANGED.
 *
 * KEY LAW (read before editing): the signing key is the estate's EXISTING section-16
 * signer (mcp-apps-poc/key.pem). NEVER a new key, NEVER a key inside the site repo,
 * NEVER on CI, and NEVER any key material in a commit, log, or PR body: this script
 * logs only the key PATH. Not a derived artifact (see the EXCLUDED entry in
 * scripts/derived-artifacts.mjs); the only writer is this script, run locally.
 *
 * Usage:
 *   node scripts/sign-webmcp-snapshot.mjs                      # default sibling key path
 *   node scripts/sign-webmcp-snapshot.mjs --key <path-to-pem>
 *   WEBMCP_SNAPSHOT_KEY_PATH=<path> node scripts/sign-webmcp-snapshot.mjs
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadSigningKey, signDetached } from './lib/detached-jws.mjs';
import { gitEnv } from './_git-env-lib.mjs';
import {
  buildSnapshotTools, SNAPSHOT_TYP, SNAPSHOT_SCHEMA, SNAPSHOT_REL,
  expiryFrom, nextSnapshotVersion, SNAPSHOT_TTL_DAYS,
} from './lib/webmcp-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// Key path resolution: --key flag > WEBMCP_SNAPSHOT_KEY_PATH env > the sibling
// mcp-apps-poc/key.pem (same candidate list as sign-agent-card.mjs; covers repo/ and repo/.wt/<row>/).
const keyFlagIdx = process.argv.indexOf('--key');
const keyCandidates = [
  resolve(REPO, '..', 'mcp-apps-poc', 'key.pem'),
  resolve(REPO, '..', '..', 'mcp-apps-poc', 'key.pem'),
  resolve(REPO, '..', '..', '..', 'mcp-apps-poc', 'key.pem'),
];
const KEY_PATH = resolve(
  process.cwd(),
  keyFlagIdx > -1 ? process.argv[keyFlagIdx + 1]
  : process.env.WEBMCP_SNAPSHOT_KEY_PATH
    ? process.env.WEBMCP_SNAPSHOT_KEY_PATH
    : keyCandidates.find((p) => existsSync(p)) ?? keyCandidates[0],
);

function fail(msg) {
  console.error(`sign-webmcp-snapshot: ${msg}`);
  process.exit(1);
}
if (!existsSync(KEY_PATH)) fail(`signing key not found at ${KEY_PATH} (path only; contents are never read into output)`);

let sourceCommit;
try {
  sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, env: gitEnv(), encoding: 'utf8' }).trim();
} catch (e) {
  fail(`cannot resolve source_commit via git rev-parse HEAD (${e.message})`);
}

const tools = buildSnapshotTools(REPO);
if (tools.length === 0) fail('registration set is empty; refusing to sign an empty snapshot');

// WEBMCP-SIGNED-EXPIRY-1: expiry + monotonic version, both INSIDE the signed payload.
// version = previous published value + 1 (never wall-clock-derived), so a frozen or
// rolled-back old snapshot is rejectable by any verifier that tracks the highest
// version it has seen this session (in-memory only; CONTRACT §0 allows no storage).
const generatedMs = Date.now();
let prevSnapshot = null;
if (existsSync(resolve(REPO, SNAPSHOT_REL))) {
  try { prevSnapshot = JSON.parse(readFileSync(resolve(REPO, SNAPSHOT_REL), 'utf8')); }
  catch (e) { fail(`existing ${SNAPSHOT_REL} is not valid JSON (${e.message}); cannot derive the next version from it`); }
}
let version;
try { version = nextSnapshotVersion(prevSnapshot); }
catch (e) { fail(e.message); }

const snapshot = {
  schema: SNAPSHOT_SCHEMA,
  generated_at: new Date(generatedMs).toISOString(),
  expires: expiryFrom(generatedMs),
  version,
  source_commit: sourceCommit,
  tools,
};

const { privKey, kid } = await loadSigningKey(KEY_PATH);
snapshot.signatures = [await signDetached(snapshot, { privKey, kid, typ: SNAPSHOT_TYP })];

writeFileSync(resolve(REPO, SNAPSHOT_REL), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`✓ signed ${SNAPSHOT_REL} (detached JWS, EdDSA over JCS, typ ${SNAPSHOT_TYP})`);
console.log(`  tools: ${tools.length}  source_commit: ${sourceCommit}`);
console.log(`  expires: ${snapshot.expires} (+${SNAPSHOT_TTL_DAYS} days)  version: ${version}${prevSnapshot?.version !== undefined ? ` (prev ${prevSnapshot.version})` : ' (first expiry-bearing publish)'}`);
console.log(`  kid: ${kid}`);
console.log(`  key: ${KEY_PATH} (path only; no key material emitted)`);
