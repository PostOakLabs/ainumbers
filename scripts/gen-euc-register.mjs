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

// One resolution of proof status, read by BOTH the trust label and the exported
// compute_proof_ready field. A node carrying a real compute_proof but no explicit
// compute_proof_ready flag is ready: the attached receipt is the fact and the flag only
// restates it (SPEC.md §18.6 -- a live gpu:false node either carries a verifying
// compute_proof or declares "deferred" with a reason). A live gpu:true node with no
// compute_proof is a THIRD state -- verify-only, out of the §18.6 profile's scope
// entirely (SIGKERNEL-VERIFYONLY-RECLASS-1) -- never "deferred": that word is reserved
// for a gpu:false node parked in the proving queue, and a gpu:true node was never in it.
// Resolving these two through different rules is what put "PROOF READY" beside
// "zkVM proof not yet generated" on the same register card.
function proofState(node) {
  if (node.compute_proof) return "ready";
  if (node.compute_proof_ready === "deferred") return "deferred";
  if (node.gpu === true) return "verify_only";
  return "deferred";
}

function trustLabel(node) {
  const state = proofState(node);
  if (state === "ready") {
    const sys = node.compute_proof?.system ?? "risc0";
    const fmt = node.compute_proof?.receiptFormat ?? "groth16-bn254";
    return `independently verified: zkVM execution proof (${sys}/${fmt})`;
  }
  if (state === "verify_only") {
    return "verify-only: callable in chains, carries no compute-proof claim (out of the §18.6 deterministic-node profile's scope)";
  }
  const reason = node.deferred_reason ? `; ${node.deferred_reason}` : "";
  return `deferred: deterministic source published, zkVM proof not yet generated${reason}`;
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
    compute_proof_ready: proofState(node),
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
    // Filename presence is not freshness. Comparing only the file SET let 250 entries
    // sit on main carrying a trust_label, data_vintage and purpose that no longer
    // matched chaingraph.json, with this gate green the whole time. Compare content
    // too, minus generated_at (a wall-clock stamp that differs on every run by design).
    const withoutStamp = (entry) => {
      const { generated_at, ...rest } = entry;
      return JSON.stringify(rest);
    };
    const drifted = [];
    for (const entry of entries) {
      const file = `${entry.tool_id}.register.json`;
      if (!existing.has(file)) continue;
      let onDisk;
      try {
        onDisk = JSON.parse(readFileSync(join(OUT_DIR, file), "utf8"));
      } catch {
        drifted.push(file);
        continue;
      }
      if (withoutStamp(onDisk) !== withoutStamp(entry)) drifted.push(file);
    }
    if (missing.length || stale.length || drifted.length) {
      if (missing.length) console.error(`gen-euc-register --check: ${missing.length} missing entries, e.g. ${missing.slice(0, 5).join(", ")}`);
      if (stale.length) console.error(`gen-euc-register --check: ${stale.length} stale entries (node no longer live), e.g. ${stale.slice(0, 5).join(", ")}`);
      if (drifted.length) console.error(`gen-euc-register --check: ${drifted.length} entries drifted from chaingraph.json, e.g. ${drifted.slice(0, 5).join(", ")} -- re-run \`node scripts/gen-euc-register.mjs\``);
      process.exit(1);
    }
    console.log(`gen-euc-register --check: OK, ${entries.length} entries in sync (set + content).`);
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
