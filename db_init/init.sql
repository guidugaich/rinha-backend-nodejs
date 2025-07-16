CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    correlation_id UUID UNIQUE NOT NULL,
    amount INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- e.g., 'pending', 'processed', 'failed'
    processor VARCHAR(20),      -- e.g., 'default', 'fallback'
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    updated_at TIMESTAMP WITHOUT TIME ZONE
);  