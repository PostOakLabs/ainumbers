#!/usr/bin/env python3
"""
OpenChainGraph receipt conformance verifier — pure Python standard library.

Verifies that this directory's vector corpus (vectors/manifest.json) is
internally consistent with the execution_hash algorithm documented in
README.md:

    execution_hash = SHA-256( JCS-canonicalize( { policy_parameters, output_payload } ) )

No third-party dependencies, no network calls, no AINumbers code. A
conforming implementation in any language should reproduce the same
four checks per vector that this script runs:

  1. input_file bytes match input_file_sha256          (fetch integrity)
  2. expected_output_file bytes match expected_output_file_sha256
  3. canonicalizing each file's JSON reproduces its *_canonical_sha256
     (isolates canonicalization bugs from hashing bugs)
  4. SHA-256 of the canonicalized preimage
     { "policy_parameters": <input>, "output_payload": <expected_output> }
     equals expected_execution_hash

Usage:
    python3 verify.py                 # verify every vector in vectors/manifest.json
    python3 verify.py --vectors-dir X # point at a different corpus copy
    python3 verify.py --quiet         # only print the summary line

Exit code 0 = every vector passed all four checks. Exit code 1 = at least
one check failed anywhere, or the manifest/corpus could not be read.
"""

import argparse
import hashlib
import json
import os
import sys
from decimal import Decimal


def _format_number(x):
    """Render a float the way ECMAScript's Number::toString / JSON.stringify
    would (ECMA-262 7.1.12.1). Plain `json.dumps` does NOT do this — e.g.
    Python renders 0.000001 as "1e-06" while JS renders it "0.000001" — so a
    naive Python canonicalizer silently disagrees with a JS one on any vector
    using small decimals. JCS (RFC 8785) mandates the JS algorithm, so this
    is required for correctness, not cosmetic.
    """
    if x == 0:
        return "0"  # JSON.stringify(-0) === "0"
    neg = x < 0
    x = abs(x)
    # repr() is the shortest decimal string that round-trips to the same
    # float (guaranteed since Python 3.1) — the same "shortest digits" input
    # ECMA-262's algorithm requires. Decimal() then gives clean digit/exponent
    # access without re-introducing binary float noise.
    sign, digit_tuple, exponent = Decimal(repr(x)).as_tuple()
    digits = "".join(str(d) for d in digit_tuple)
    k = len(digits)
    n = exponent + k  # value == 0.<digits> * 10**n, per the ECMA-262 definition

    if k <= n <= 21:
        s = digits + ("0" * (n - k))
    elif 0 < n <= 21:
        s = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        s = "0." + ("0" * -n) + digits
    else:
        exp = n - 1
        mantissa = digits[0] if k == 1 else digits[0] + "." + digits[1:]
        s = mantissa + "e" + ("+" if exp >= 0 else "-") + str(abs(exp))

    return ("-" if neg else "") + s


def canonicalize(value):
    """Serialize `value` per RFC 8785 (JCS) for the practical JSON subset
    this corpus uses: finite numbers, no integers past 2**53, no NaN/Inf.

    - object keys sorted by Unicode code point
    - array order preserved
    - minimal whitespace (no spaces after ':' or ',')
    - UTF-8, no ASCII-escaping of non-ASCII characters beyond what JSON
      itself requires
    - numbers formatted per ECMA-262 Number::toString (see _format_number)
    """
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return _format_number(value)
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(v) for v in value) + "]"
    if isinstance(value, dict):
        items = sorted(value.items(), key=lambda kv: kv[0])
        return "{" + ",".join(
            json.dumps(k, ensure_ascii=False) + ":" + canonicalize(v) for k, v in items
        ) + "}"
    raise TypeError(f"cannot canonicalize value of type {type(value)!r}")


def sha256_hex(data_bytes):
    return hashlib.sha256(data_bytes).hexdigest()


def strip_sha256_prefix(value):
    if value.startswith("sha256:"):
        return value[len("sha256:"):]
    return value


def read_json_file(path):
    with open(path, "rb") as f:
        raw_bytes = f.read()
    return raw_bytes, json.loads(raw_bytes.decode("utf-8"))


class VectorResult:
    def __init__(self, vector_id):
        self.vector_id = vector_id
        self.checks = []  # list of (name, passed, detail)

    def record(self, name, passed, detail=""):
        self.checks.append((name, passed, detail))

    @property
    def passed(self):
        return all(passed for _, passed, _ in self.checks)


def verify_vector(entry, corpus_dir):
    result = VectorResult(entry["id"])

    input_path = os.path.join(corpus_dir, entry["input_file"])
    output_path = os.path.join(corpus_dir, entry["expected_output_file"])

    if not os.path.isfile(input_path):
        result.record("input_file exists", False, f"missing: {input_path}")
        return result
    if not os.path.isfile(output_path):
        result.record("expected_output_file exists", False, f"missing: {output_path}")
        return result

    input_bytes, input_obj = read_json_file(input_path)
    output_bytes, output_obj = read_json_file(output_path)

    # Check 1 + 2: raw file bytes match the declared fetch-integrity hash.
    input_file_hash = sha256_hex(input_bytes)
    result.record(
        "input_file_sha256",
        input_file_hash == entry["input_file_sha256"],
        f"got {input_file_hash}",
    )

    output_file_hash = sha256_hex(output_bytes)
    result.record(
        "expected_output_file_sha256",
        output_file_hash == entry["expected_output_file_sha256"],
        f"got {output_file_hash}",
    )

    # Check 3: canonicalizer agreement, isolated from hashing.
    input_canonical = canonicalize(input_obj)
    input_canonical_hash = sha256_hex(input_canonical.encode("utf-8"))
    result.record(
        "input_canonical_sha256",
        input_canonical_hash == entry["input_canonical_sha256"],
        f"got {input_canonical_hash}",
    )

    output_canonical = canonicalize(output_obj)
    output_canonical_hash = sha256_hex(output_canonical.encode("utf-8"))
    result.record(
        "expected_output_canonical_sha256",
        output_canonical_hash == entry["expected_output_canonical_sha256"],
        f"got {output_canonical_hash}",
    )

    # Check 4: the actual execution_hash claim.
    preimage = {"policy_parameters": input_obj, "output_payload": output_obj}
    preimage_canonical = canonicalize(preimage)
    execution_hash = sha256_hex(preimage_canonical.encode("utf-8"))
    expected_execution_hash = strip_sha256_prefix(entry["expected_execution_hash"])
    result.record(
        "execution_hash",
        execution_hash == expected_execution_hash,
        f"got sha256:{execution_hash}",
    )

    return result


def load_manifest(vectors_dir):
    manifest_path = os.path.join(vectors_dir, "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--vectors-dir",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "vectors"),
        help="Directory containing manifest.json, inputs/, outputs/ (default: ./vectors next to this script)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Only print the final summary line.",
    )
    args = parser.parse_args(argv)

    corpus_dir = os.path.dirname(args.vectors_dir)  # manifest paths are relative to the corpus root
    try:
        manifest = load_manifest(args.vectors_dir)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"FAIL: could not read manifest at {args.vectors_dir}/manifest.json: {exc}")
        return 1

    vectors = manifest.get("vectors", [])
    if not vectors:
        print("FAIL: manifest has no vectors")
        return 1

    results = [verify_vector(entry, corpus_dir) for entry in vectors]
    all_passed = all(result.passed for result in results)

    for result in results:
        if not args.quiet or not result.passed:
            status = "PASS" if result.passed else "FAIL"
            print(f"{status}  {result.vector_id}")
            if not args.quiet:
                for name, passed, detail in result.checks:
                    mark = "ok" if passed else "MISMATCH"
                    line = f"    [{mark}] {name}"
                    if not passed and detail:
                        line += f" ({detail})"
                    print(line)

    total = len(results)
    passed_count = sum(1 for result in results if result.passed)
    print(f"\n{passed_count}/{total} vectors passed all checks.")

    if all_passed:
        print("Conforms to the OpenChainGraph execution_hash format.")
        return 0
    print("Does NOT conform — see MISMATCH lines above.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
