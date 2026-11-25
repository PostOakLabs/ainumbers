#!/usr/bin/env bash
# gh with bounded retries for transient GitHub API failures.
#
# automerge-label.yml installs this as `gh` at the front of PATH, so every gh
# call in its jobs retries without each call site changing. Measured
# 2026-11-25: on #3285 the enqueue succeeded but the confirming comment call
# got "GraphQL: Something went wrong while executing your query" and the run
# went red; on ainumbers-mcp-apps #646 the same error hit the state read.
#
# A call is retried only when it failed AND its output names a transient
# server-side cause (GraphQL "Something went wrong", HTTP 5xx or 429, a
# secondary rate limit, a network timeout or reset). Anything else (a 404, a
# validation error, "No merge queue found") returns at once with gh's own exit
# code and output. Up to GH_RETRY_ATTEMPTS tries (default 4), sleeping
# GH_RETRY_SLEEP * 2^n seconds between them (default base 2: 2, 4, 8 s).
# Output is buffered per try, so a caller only ever sees the final try's.
#
# The real gh is GH_RETRY_REAL (set by the install step), else /usr/bin/gh.
# This wrapper never reads stdin; no automerge-label.yml call feeds gh stdin.
set -u

REAL="${GH_RETRY_REAL:-/usr/bin/gh}"
ATTEMPTS="${GH_RETRY_ATTEMPTS:-4}"
BASE="${GH_RETRY_SLEEP:-2}"
TRANSIENT='Something went wrong while executing your query|HTTP 5[0-9][0-9]|HTTP 429|secondary rate limit|was submitted too quickly|i/o timeout|TLS handshake timeout|connection reset by peer|unexpected EOF|Bad Gateway|Service Unavailable|Gateway Time-?out'

out="$(mktemp)"
err="$(mktemp)"
trap 'rm -f "$out" "$err"' EXIT

try=1
while :; do
  "$REAL" "$@" >"$out" 2>"$err"
  rc=$?
  if [ "$rc" -eq 0 ] || [ "$try" -ge "$ATTEMPTS" ] || ! grep -qE "$TRANSIENT" "$err" "$out"; then
    cat "$out"
    cat "$err" >&2
    exit "$rc"
  fi
  wait_s=$((BASE * (1 << (try - 1))))
  echo "gh-retry: transient GitHub API failure (try $try of $ATTEMPTS), retrying in ${wait_s}s" >&2
  sleep "$wait_s"
  try=$((try + 1))
done
