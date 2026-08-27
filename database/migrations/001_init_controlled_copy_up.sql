-- 001_init_controlled_copy_up.sql
-- Database Dialect: PostgreSQL

-- 1. watermark_configs
-- Replaces legacy giant watermarks with precise configurations
CREATE TABLE IF NOT EXISTS watermark_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL, -- Assuming documents table exists
    department_id VARCHAR(50) NOT NULL, -- The target department this watermark configuration applies to
    header_text VARCHAR(255),
    footer_text VARCHAR(255),
    diagonal_watermark VARCHAR(255), -- Fallback for legacy support or highly confidential docs
    color_hex VARCHAR(10) DEFAULT '#FF0000',
    opacity NUMERIC(3,2) DEFAULT 0.50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE (document_id, department_id)
);

-- 2. document_distributions
-- Maps a document revision to target departments (replacing simple array of strings)
CREATE TABLE IF NOT EXISTS document_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    department_id VARCHAR(50) NOT NULL,
    distribution_mode VARCHAR(20) DEFAULT 'SOFT_COPY', -- e.g., 'SOFT_COPY', 'HARD_COPY', 'BOTH'
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE (document_id, department_id)
);

-- 3. controlled_copy_slots
-- Defines the allowed slot per department (1 row = 1 CC Number)
CREATE TABLE IF NOT EXISTS controlled_copy_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_id UUID NOT NULL REFERENCES document_distributions(id) ON DELETE CASCADE,
    copy_type VARCHAR(20) NOT NULL, -- 'HARD_COPY' or 'SOFT_COPY'
    cc_number VARCHAR(50) NOT NULL, -- e.g., "CC-001"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE (distribution_id, cc_number)
);

-- 4. controlled_copy_instances
-- Tracks the actual generated copies with unique identifiers tied to a slot
CREATE TABLE IF NOT EXISTS controlled_copy_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES controlled_copy_slots(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'GENERATED', -- 'GENERATED', 'DISTRIBUTED', 'RECALLED', 'DESTROYED'
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 5. controlled_copy_acknowledgements
-- Tracks receipt acknowledgement for specific copies
CREATE TABLE IF NOT EXISTS controlled_copy_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES controlled_copy_instances(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    signature_hash TEXT, -- Digital proof of acknowledgement
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE (instance_id, user_id)
);

-- 6. controlled_copy_recalls
-- Tracks the return or destruction of superseded physical copies
CREATE TABLE IF NOT EXISTS controlled_copy_recalls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES controlled_copy_instances(id) ON DELETE CASCADE,
    recalled_by_user_id VARCHAR(50) NOT NULL,
    recall_reason VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_RETURN', -- 'PENDING_RETURN', 'RETURNED', 'DESTROYED'
    recalled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 7. print_logs
-- Audit trail for physical print executions
CREATE TABLE IF NOT EXISTS print_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES controlled_copy_instances(id) ON DELETE CASCADE,
    printed_by_user_id VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    printer_name VARCHAR(255),
    print_reason VARCHAR(255),
    printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for performance on soft deletes
CREATE INDEX idx_document_distributions_deleted_at ON document_distributions(deleted_at);
CREATE INDEX idx_controlled_copy_slots_deleted_at ON controlled_copy_slots(deleted_at);
CREATE INDEX idx_controlled_copy_instances_deleted_at ON controlled_copy_instances(deleted_at);
