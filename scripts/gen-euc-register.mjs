#!/usr/bin/env node
// EUC-register export generator (EUC-SITE-1, board row anchor + BANKING-OCG-BUILD-SPEC.md §5.7).
// Site-side twin of Helm's HELM-P3-E12 (helm/hub/euc-register.mjs) -- same field intent
// (name, purpose, kernel version+hash, declared inputs/outputs, control description,
// last-validated date), reshaped for one-node-per-tool_id instead of Helm's multi-node
// packs. Reads ONLY existing chaingraph.json node metadata -- no new persisted fields,
// no caller-supplied inputs, batch-generated so every run reflects current live state.
//
// Trust label / data-vintage / last-validated are derived from compute_proof_ready +
// compute_images each run (never hardcoded) so a deferred->ready proof-status flip
// (e.g. art-454..467/472/473 when PROVE-ASSURANCE-LAND-1 lands) is picked up by
// re-running this script, not by hand-editing an entry.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CHAINGRAPH = JSON.parse(readFileSync(join(ROOT, "chaingraph", "chaingraph.json"), "utf8"));
const OUT_DIR = join(ROOT, "chaingraph", "register");
const CHECK = process.argv.includes("--check");

function latestVintage(node) {
  const dates = (node.compute_images ?? []).map((img) => img.valid_from).filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null;
}

function kernelDigest(node) {
  const journalDigest = node.compute_proof?.journal?.kernel_digest;
  if (journalDigest) return journalDigest;
  const source = (node.compute_images ?? []).find((img) => img.system === "sha256-source");
  return source?.image_id ?? null;
}

function trustLabel(node) {
  if (node.compute_proof_ready === "ready") {
    const sys = node.compute_proof?.system ?? "risc0";
    const fmt = node.compute_proof?.receiptFormat ?? "groth16-bn254";
    return `independently verified -- zkVM execution proof (${sys}/${fmt})`;
  }
  const reason = node.deferred_reason ? ` -- ${node.deferred_reason}` : "";
  return `deferred -- deterministic source published, zkVM proof not yet generated${reason}`;
}

// Site nodes are one kernel per tool_id (no multi-node workflow packs like Helm),
// so "declared outputs" = the node's own downstream feeds, and there is no separate
// terminal-node computation to do (parity note: Helm's terminalNode() has no analog here).
function buildRegisterEntry(node, generatedAt) {
  return {
    tool_id: node.tool_id,
    kernel_id: node.tool_id,
    display_name: node.display_name,
    tool_version: node.tool_version ?? null,
    mandate_type: node.mandate_type ?? null,
    purpose: node.description ?? null,
    control_description: node.description ?? null,
    declared_inputs: node.consumes ?? [],
    declared_outputs: node.feeds ?? [],
    kernel_digest: kernelDigest(node),
    trust_label: trustLabel(node),
    data_vintage: latestVintage(node),
    last_validated: latestVintage(node),
    conformance_fixtures_vendored: node.conformance_fixtures === true,
    compute_proof_ready: node.compute_proof_ready ?? (node.compute_proof ? "ready" : "deferred"),
    wave: node.wave ?? null,
    source_url: node.url ?? null,
    generated_at: generatedAt,
  };
}

function main() {
  const generatedAt = process.env.EUC_REGISTER_TIMESTAMP ?? new Date().toISOString();
  const liveNodes = CHAINGRAPH.nodes.filter((n) => n.status === "live");
  const entries = liveNodes.map((n) => buildRegisterEntry(n, generatedAt));

  if (CHECK) {
    const existing = new Set(
      (() => {
        try {
          return readdirSync(OUT_DIR).filter((f) => f.endsWith(".register.json"));
        } catch {
          return [];
        }
      })()
    );
    const expected = new Set(entries.map((e) => `${e.tool_id}.register.json`));
    const missing = [...expected].filter((f) => !existing.has(f));
    const stale = [...existing].filter((f) => !expected.has(f));
    if (missing.length || stale.length) {
      if (missing.length) console.error(`gen-euc-register --check: ${missing.length} missing entries, e.g. ${missing.slice(0, 5).join(", ")}`);
      if (stale.length) console.error(`gen-euc-register --check: ${stale.length} stale entries (node no longer live), e.g. ${stale.slice(0, 5).join(", ")}`);
      process.exit(1);
    }
    console.log(`gen-euc-register --check: OK, ${entries.length} entries in sync.`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const entry of entries) {
    writeFileSync(join(OUT_DIR, `${entry.tool_id}.register.json`), JSON.stringify(entry, null, 2) + "\n");
  }
  const index = entries.map((e) => ({
    tool_id: e.tool_id,
    display_name: e.display_name,
    wave: e.wave,
    compute_proof_ready: e.compute_proof_ready,
    trust_label: e.trust_label,
    data_vintage: e.data_vintage,
  }));
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify({ generated_at: generatedAt, count: index.length, entries: index }, null, 2) + "\n");
  console.log(`gen-euc-register: wrote ${entries.length} entries + index.json to chaingraph/register/`);
}

main();
