-- 002_add_issue_number_up.sql
ALTER TABLE controlled_copy_instances ADD COLUMN issue_number VARCHAR(10) DEFAULT '01';
