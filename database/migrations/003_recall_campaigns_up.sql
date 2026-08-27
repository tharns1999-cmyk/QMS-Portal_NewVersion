-- 003_recall_campaigns_up.sql

-- 1. Create recall_campaigns table
CREATE TABLE IF NOT EXISTS recall_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    superseded_doc_id VARCHAR(50) NOT NULL, -- ID of the old revision (e.g. doc-123-R01)
    new_doc_id VARCHAR(50) NOT NULL,        -- ID of the new revision (e.g. doc-123-R02)
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 2. Alter controlled_copy_recalls to link to campaigns
ALTER TABLE controlled_copy_recalls ADD COLUMN campaign_id UUID REFERENCES recall_campaigns(id) ON DELETE SET NULL;
