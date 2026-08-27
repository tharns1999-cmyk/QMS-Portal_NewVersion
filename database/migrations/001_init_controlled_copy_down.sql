-- 001_init_controlled_copy_down.sql
-- Rollback strategy: Drop tables in reverse dependency order

-- 7. Drop print_logs
DROP TABLE IF EXISTS print_logs;

-- 6. Drop controlled_copy_recalls
DROP TABLE IF EXISTS controlled_copy_recalls;

-- 5. Drop controlled_copy_acknowledgements
DROP TABLE IF EXISTS controlled_copy_acknowledgements;

-- 4. Drop controlled_copy_instances
DROP TABLE IF EXISTS controlled_copy_instances;

-- 3. Drop controlled_copy_slots
DROP TABLE IF EXISTS controlled_copy_slots;

-- 2. Drop document_distributions
DROP TABLE IF EXISTS document_distributions;

-- 1. Drop watermark_configs
DROP TABLE IF EXISTS watermark_configs;
