# Replay Witness

Anyone can reproduce the tracked fixture corpus on their own GitHub account and sign the result with that account's GitHub identity. The workflow ships with the repository and runs only in forks.

## Run it

1. On `PostOakLabs/ainumbers`, press **Fork**, then **Create fork**. (1 action)
2. Actions are enabled by default on a new fork of this repository, so there is no setup step. If your fork ever reports Actions as disabled, enable them under Settings. (0 actions on the measured default)
3. Open the **Actions** tab, choose **Replay Witness**, keep `main` as the branch, press **Run workflow**, then press the green **Run workflow** button. (2 actions)

That is three actions from fork to attested result. The job replays the corpus on Linux, Windows and macOS, then stores a signed attestation with two subjects: the beacon and the result.

## Read the result

Each run uploads `replay-result.json` and `replay-env.json` as artifacts. The result file holds deterministic values only. Its digest matches the house line when your run agrees with the published corpus. The attestation is public and can be checked with:

```
gh attestation verify replay-result.json --repo <your-owner>/ainumbers --predicate-type ainumbers.co/replay-witness/v1
```

The workflow refuses to start on the upstream repository, and refuses any run whose checked-out commit is not a commit that exists upstream. An edited fork therefore produces no attestation until its changes are upstream.

No keys, no secrets and no personal data are involved. Signing is GitHub's own OIDC issuance to your fork.
