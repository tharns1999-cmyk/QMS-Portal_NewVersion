-- 003_recall_campaigns_down.sql

ALTER TABLE controlled_copy_recalls DROP COLUMN campaign_id;
DROP TABLE IF EXISTS recall_campaigns;
