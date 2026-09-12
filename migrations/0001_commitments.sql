CREATE TABLE commitments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE CHECK(length(email) <= 254),
    country TEXT NOT NULL CHECK(length(country) = 2),
    would_pay_59 TEXT NOT NULL CHECK(would_pay_59 IN ('yes', 'maybe', 'no')),
    use_case TEXT NOT NULL CHECK(use_case IN ('coding', 'agents', 'api', 'chat', 'team', 'other')),
    model_vote TEXT NOT NULL CHECK(model_vote IN ('glm', 'kimi', 'qwen', 'community', 'other')),
    comment TEXT CHECK(length(comment) <= 500),
    consent INTEGER NOT NULL CHECK(consent = 1),
    consent_version TEXT NOT NULL DEFAULT '2026-09-12',
    edit_token_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_commitments_interest ON commitments(would_pay_59);
CREATE INDEX idx_commitments_model ON commitments(model_vote);
CREATE INDEX idx_commitments_updated ON commitments(updated_at);
