"""ZG-1: offline synthetic credit-decisioning logistic regression + int8 quantization.

Not committed to the deployed guest kernel — offline prep artifact only, per
ZKML-GUEST-1-BUILD-SPEC.md ZG-1. Produces reference_model.json, test_vectors.json,
and prints digests + agreement for the WU row.

Synthetic data only (UCI German-credit-style feature shape), NO real PII.
"""
import json
import hashlib
import numpy as np

rng = np.random.default_rng(2026)

FEATURES = [
    "duration_months", "credit_amount", "installment_rate_pct",
    "age_years", "existing_credits", "num_dependents",
    "checking_status_score", "savings_status_score",
    "employment_years", "credit_history_score",
]
N_FEATURES = len(FEATURES)
N_TRAIN = 5000
N_TEST = 1000

def synth_rows(n):
    duration = rng.uniform(4, 72, n)
    amount = rng.uniform(250, 20000, n)
    installment = rng.uniform(1, 4, n)
    age = rng.uniform(18, 75, n)
    existing_credits = rng.integers(1, 4, n).astype(float)
    dependents = rng.integers(0, 2, n).astype(float)
    checking = rng.uniform(0, 3, n)
    savings = rng.uniform(0, 4, n)
    employment = rng.uniform(0, 30, n)
    history = rng.uniform(0, 4, n)
    X = np.stack([duration, amount, installment, age, existing_credits,
                  dependents, checking, savings, employment, history], axis=1)
    return X

def normalize(X, mu, sigma):
    return (X - mu) / sigma

def true_weights():
    # Fixed synthetic "ground truth" generative weights (not learned — deterministic
    # offline construction is sufficient for a demand-test kernel per spec ZG-1).
    return np.array([-0.35, -0.30, -0.20, 0.15, -0.10, -0.05, 0.55, 0.45, 0.25, 0.50])

def main():
    X_train = synth_rows(N_TRAIN)
    mu = X_train.mean(axis=0)
    sigma = X_train.std(axis=0)
    Xn_train = normalize(X_train, mu, sigma)

    w_true = true_weights()
    bias_true = -0.2
    logits_train = Xn_train @ w_true + bias_true
    noise = rng.normal(0, 0.4, N_TRAIN)
    y_train = (logits_train + noise > 0).astype(int)

    # gradient descent logistic regression (pure numpy, no sklearn dependency)
    w = np.zeros(N_FEATURES)
    b = 0.0
    lr = 0.5
    for epoch in range(2000):
        z = Xn_train @ w + b
        p = 1.0 / (1.0 + np.exp(-z))
        grad_w = Xn_train.T @ (p - y_train) / N_TRAIN
        grad_b = np.mean(p - y_train)
        w -= lr * grad_w
        b -= lr * grad_b

    # --- quantize: static-linear per-tensor int8 weights, int32 accumulator ---
    w_max = np.max(np.abs(w))
    scale = w_max / 127.0 if w_max > 0 else 1.0
    zero_point = 0  # symmetric quantization
    w_q = np.clip(np.round(w / scale), -127, 127).astype(np.int32)
    # bias quantized in the accumulator's fixed-point domain (input_scale=1 since
    # inputs are pre-normalized float32->int32 fixed-point at FIXP_SHIFT below)
    FIXP_SHIFT = 16  # inputs represented as int32 fixed-point, 16 fractional bits
    bias_q = int(np.round(b / scale * (1 << FIXP_SHIFT)))
    threshold_q = 0  # decision boundary at logit 0 in quantized domain

    def quantized_infer(x_row_norm):
        x_fixp = np.round(x_row_norm * (1 << FIXP_SHIFT)).astype(np.int64)
        acc = int(np.dot(x_fixp, w_q)) + bias_q
        return 1 if acc > threshold_q else 0

    def float_infer(x_row_norm):
        z = float(np.dot(x_row_norm, w)) + b
        return 1 if z > 0 else 0

    # --- test vectors: fresh synthetic draw, independent seed stream ---
    X_test = synth_rows(N_TEST)
    Xn_test = normalize(X_test, mu, sigma)

    vectors = []
    matches = 0
    for i in range(N_TEST):
        row_norm = Xn_test[i]
        f_pred = float_infer(row_norm)
        q_pred = quantized_infer(row_norm)
        if f_pred == q_pred:
            matches += 1
        vectors.append({
            "id": i,
            "raw_features": {FEATURES[j]: round(float(X_test[i][j]), 6) for j in range(N_FEATURES)},
            "normalized_fixp16": [int(round(v * (1 << FIXP_SHIFT))) for v in row_norm],
            "float_prediction": f_pred,
            "quantized_prediction": q_pred,
        })

    agreement = matches / N_TEST

    reference_model = {
        "model_type": "logistic_regression_credit_decisioning_synthetic",
        "features": FEATURES,
        "normalization": {"mu": mu.round(6).tolist(), "sigma": sigma.round(6).tolist()},
        "float_weights": w.round(8).tolist(),
        "float_bias": round(float(b), 8),
        "quantization": {
            "quant_method": "static-linear",
            "bits": 8,
            "scale": scale,
            "zero_point": zero_point,
            "granularity": "per-tensor",
            "fixp_shift": FIXP_SHIFT,
            "int8_weights": w_q.tolist(),
            "int32_bias_fixp": bias_q,
            "threshold_fixp": threshold_q,
        },
        "disclosure": "Synthetic demand-test model. NOT fit for regulatory credit decisioning use. Proves only that THIS fixed quantized model produced THIS score from THESE inputs.",
    }

    test_vectors_doc = {
        "n_vectors": N_TEST,
        "fixp_shift": FIXP_SHIFT,
        "vectors": vectors,
    }

    def digest(obj):
        canonical = json.dumps(obj, sort_keys=True, separators=(",", ":"))
        return "sha256:" + hashlib.sha256(canonical.encode()).hexdigest()

    ref_digest = digest(reference_model)
    vec_digest = digest(test_vectors_doc)

    with open("reference_model.json", "w") as f:
        json.dump(reference_model, f, indent=2)
    with open("test_vectors.json", "w") as f:
        json.dump(test_vectors_doc, f, indent=2)

    print(f"reference_model_digest: {ref_digest}")
    print(f"test_vectors_digest: {vec_digest}")
    print(f"n_vectors: {N_TEST}")
    print(f"agreement (top1-match): {agreement:.4f}")

if __name__ == "__main__":
    main()
