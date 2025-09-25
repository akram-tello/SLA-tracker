-- ================================
-- SLA Tracker Database Initialization and Optimization
-- ================================

-- 1. CREATE DATABASE
CREATE DATABASE IF NOT EXISTS sla_tracker;
USE sla_tracker;

-- ================================
-- 2. CREATE TABLES
-- ================================

-- 2.1 TAT Configuration Table
CREATE TABLE IF NOT EXISTS tat_config (
    brand_name VARCHAR(50) NOT NULL,
    brand_code VARCHAR(10) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    processed_tat VARCHAR(20) NOT NULL COMMENT 'Formatted time: e.g., "2h 30m"',
    shipped_tat VARCHAR(20) NOT NULL COMMENT 'Formatted time: e.g., "2d 5h 30m"',
    delivered_tat VARCHAR(20) NOT NULL COMMENT 'Formatted time: e.g., "7d 12h"',
    risk_pct TINYINT NOT NULL DEFAULT 80 COMMENT 'Risk percentage threshold',
    urgent_pct SMALLINT NOT NULL DEFAULT 100 COMMENT 'Urgent threshold percentage (≥100% to <critical_pct of SLA target)',
    critical_pct SMALLINT NOT NULL DEFAULT 150 COMMENT 'Critical threshold percentage (≥critical_pct of SLA target)',
    pic VARCHAR(255) DEFAULT NULL COMMENT 'People in charge for this brand/country combination',
    -- Pending time thresholds for each stage
    pending_not_processed_time VARCHAR(20) DEFAULT '6h' COMMENT 'Time threshold for pending in not processed stage',
    pending_processed_time VARCHAR(20) DEFAULT '24h' COMMENT 'Time threshold for pending in processed stage', 
    pending_shipped_time VARCHAR(20) DEFAULT '3d' COMMENT 'Time threshold for pending in shipped stage',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (brand_name, country_code)
);

-- 2.2 SLA Daily Summary Table
CREATE TABLE IF NOT EXISTS sla_daily_summary (
    summary_date DATE NOT NULL,
    brand_name VARCHAR(50) NOT NULL,
    brand_code VARCHAR(10) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    stage ENUM('Not Processed', 'Processed', 'Shipped', 'Delivered') NOT NULL,
    orders_total INT NOT NULL DEFAULT 0,
    orders_on_time INT NOT NULL DEFAULT 0,
    orders_on_risk INT NOT NULL DEFAULT 0,
    orders_breached INT NOT NULL DEFAULT 0,
    -- Pending orders tracking
    orders_pending_total INT NOT NULL DEFAULT 0 COMMENT 'Total orders pending in this stage',
    orders_at_risk_pending INT NOT NULL DEFAULT 0 COMMENT 'Orders that are both at risk and pending',
    orders_breached_pending INT NOT NULL DEFAULT 0 COMMENT 'Orders that are both breached and pending',
    avg_pending_hours DECIMAL(10,2) DEFAULT 0 COMMENT 'Average hours orders have been pending in this stage',
    avg_delay_sec INT NOT NULL DEFAULT 0,
    refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (summary_date, brand_name, country_code, stage),
    
    -- Base Indexes
    INDEX idx_summary_date (summary_date),
    INDEX idx_brand_country (brand_name, country_code),
    INDEX idx_date_brand (summary_date, brand_name),
    INDEX idx_date_country (summary_date, country_code),
    INDEX idx_stage (stage),
    INDEX idx_refreshed_at (refreshed_at)
);

-- Template: orders_{brand_code}_{country_code}
-- See original script for detailed field structure
-- These tables will be created dynamically by the ETL process

-- ================================
-- 3. POPULATE TAT CONFIGURATION
-- ================================

INSERT INTO tat_config (brand_name, brand_code, country_code, processed_tat, shipped_tat, delivered_tat, risk_pct, critical_pct, urgent_pct, pic, pending_not_processed_time, pending_processed_time, pending_shipped_time) VALUES
-- Victoria's Secret
('Victoria''s Secret', 'vs', 'MY', '10m', '2d', '5d', 80, 150, 100, 'Operations Team', '6h', '24h', '3d'),
('Victoria''s Secret', 'vs', 'SG', '10m', '1d', '5d', 80, 150, 100, 'Operations Team', '6h', '24h', '3d'),
('Victoria''s Secret', 'vs', 'AU', '10m', '1d', '5d', 80, 150, 100, 'Operations Team', '6h', '24h', '3d'),
('Victoria''s Secret', 'vs', 'ID', '10m', '3d', '10d', 80, 150, 100, 'Operations Team', '6h', '24h', '3d'),
('Victoria''s Secret', 'vs', 'TH', '10m', '2d', '8d', 80, 150, 100, 'Operations Team', '6h', '24h', '3d'),

-- Bath & Body Works  
('Bath & Body Works', 'bbw', 'MY', '10m', '3d', '10d', 75, 160, 110, 'Operations Team', '6h', '24h', '3d'),
('Bath & Body Works', 'bbw', 'SG', '10m', '2d', '7d', 75, 160, 110, 'Operations Team', '6h', '24h', '3d'),
('Bath & Body Works', 'bbw', 'AU', '10m', '3d', '10d', 75, 150, 100, 'Operations Team', '6h', '24h', '3d'),
('Bath & Body Works', 'bbw', 'HK', '10m', '2d', '7d', 75, 150, 100, 'Operations Team', '6h', '24h', '3d'),
('Bath & Body Works', 'bbw', 'ID', '10m', '3d', '12d', 75, 150, 100, 'Operations Team', '6h', '24h', '3d'),
('Bath & Body Works', 'bbw', 'NZ', '10m', '3d', '10d', 75, 150, 100, 'Operations Team', '6h', '24h', '3d'),
('Bath & Body Works', 'bbw', 'PH', '10m', '4d', '14d', 75, 150, 100, 'Operations Team', '6h', '24h', '3d'),
('Bath & Body Works', 'bbw', 'TH', '10m', '3d', '10d', 75, 150, 100, 'Operations Team', '6h', '24h', '3d'),
('Bath & Body Works', 'bbw', 'VN', '10m', '3d', '12d', 75, 150, 100, 'Operations Team', '6h', '24h', '3d'),

-- Rituals
('Rituals', 'rituals', 'MY', '10m', '2d', '7d', 80, 140, 90, 'Logistics Team', '6h', '24h', '3d'),
('Rituals', 'rituals', 'SG', '10m', '1d', '5d', 80, 140, 90, 'Logistics Team', '6h', '24h', '3d'),
('Rituals', 'rituals', 'AU', '10m', '2d', '7d', 80, 150, 100, 'Logistics Team', '6h', '24h', '3d'),
('Rituals', 'rituals', 'TH', '10m', '2d', '8d', 80, 150, 100, 'Logistics Team', '6h', '24h', '3d');

-- ================================
-- 4. INDEX OPTIMIZATION
-- ================================

-- Composite indexes for key query patterns
CREATE INDEX IF NOT EXISTS idx_summary_brand_country_date 
ON sla_daily_summary (brand_code, country_code, summary_date, stage);

CREATE INDEX IF NOT EXISTS idx_summary_date_brand_country 
ON sla_daily_summary (summary_date, brand_code, country_code);

CREATE INDEX IF NOT EXISTS idx_summary_refreshed_brand_country 
ON sla_daily_summary (refreshed_at DESC, brand_name, country_code);

CREATE INDEX IF NOT EXISTS idx_summary_stage_performance 
ON sla_daily_summary (stage, summary_date, orders_total, orders_on_time);

CREATE INDEX IF NOT EXISTS idx_summary_anomaly_detection 
ON sla_daily_summary (summary_date, orders_total, orders_on_time, orders_breached);

-- Covering index for dashboard summaries
CREATE INDEX IF NOT EXISTS idx_summary_dashboard_covering 
ON sla_daily_summary (
    summary_date, brand_code, country_code, stage, 
    orders_total, orders_on_time, orders_on_risk, orders_breached, avg_delay_sec
);

-- ================================
-- 5. VIEWS FOR MONITORING
-- ================================

-- Index usage view
CREATE OR REPLACE VIEW v_sla_summary_index_usage AS
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    CARDINALITY,
    CASE 
        WHEN INDEX_NAME = 'PRIMARY' THEN 'Primary Key'
        WHEN INDEX_NAME LIKE 'idx_summary_%' THEN 'Optimized Index'
        ELSE 'Legacy Index'
    END as index_type
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'sla_tracker' 
AND TABLE_NAME = 'sla_daily_summary'
ORDER BY CARDINALITY DESC;

-- Table performance view
CREATE OR REPLACE VIEW v_sla_summary_performance AS
SELECT 
    TABLE_NAME,
    TABLE_ROWS as estimated_rows,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as total_size_mb,
    ROUND((DATA_LENGTH / 1024 / 1024), 2) as data_size_mb,
    ROUND((INDEX_LENGTH / 1024 / 1024), 2) as index_size_mb,
    ROUND((INDEX_LENGTH / DATA_LENGTH * 100), 2) as index_ratio_percent,
    ENGINE,
    CREATE_TIME,
    UPDATE_TIME
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'sla_tracker' 
AND TABLE_NAME = 'sla_daily_summary';

-- ================================
-- 6. STATISTICS & VERIFICATION
-- ================================

-- Update table statistics
ANALYZE TABLE sla_daily_summary;

-- Confirm optimization
SELECT 'SLA Daily Summary optimization completed' as status,
       COUNT(*) as total_indexes
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'sla_tracker' 
AND TABLE_NAME = 'sla_daily_summary';

-- ================================
-- 7. OPTIONAL: PARTITIONING (COMMENTED OUT)
-- ================================

/*
CREATE TABLE sla_daily_summary_partitioned (
    summary_date DATE NOT NULL,
    brand_name VARCHAR(50) NOT NULL,
    brand_code VARCHAR(10) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    stage ENUM('Not Processed', 'Processed', 'Shipped', 'Delivered') NOT NULL,
    orders_total INT NOT NULL DEFAULT 0,
    orders_on_time INT NOT NULL DEFAULT 0,
    orders_on_risk INT NOT NULL DEFAULT 0,
    orders_breached INT NOT NULL DEFAULT 0,
    avg_delay_sec INT NOT NULL DEFAULT 0,
    refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (summary_date, brand_name, country_code, stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (YEAR(summary_date)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
*/

-- ================================
-- 8. QUERY OPTIMIZATION EXAMPLES
-- ================================

/*
-- 1. KPI Summary
SELECT 
    SUM(orders_total) as total_orders,
    SUM(orders_on_time) as on_time_orders,
    SUM(orders_breached) as breached_orders
FROM sla_daily_summary 
WHERE brand_code = 'vs' 
AND country_code = 'MY' 
AND summary_date BETWEEN '2024-01-01' AND '2024-01-31';

-- 2. Stage Breakdown
SELECT 
    stage,
    SUM(orders_total) as total,
    SUM(orders_on_time) as on_time,
    ROUND((SUM(orders_on_time) * 100.0) / NULLIF(SUM(orders_total), 0), 1) as completion_rate
FROM sla_daily_summary 
WHERE summary_date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY stage;

-- 3. Time Series View
SELECT 
    summary_date,
    SUM(orders_total) as daily_total,
    ROUND((SUM(orders_on_time) * 100.0) / NULLIF(SUM(orders_total), 0), 1) as daily_completion_rate
FROM sla_daily_summary 
WHERE brand_code = 'vs'
AND summary_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY summary_date
ORDER BY summary_date;
*/

-- ================================
-- 9. MAINTENANCE RECOMMENDATIONS
-- ================================

/*
1. Run ANALYZE TABLE monthly
2. Monitor `v_sla_summary_performance` and `v_sla_summary_index_usage`
3. Archive old data (> 2 years) using partitions or backups
4. Use EXPLAIN for slow queries; validate index hits
5. Test backups regularly and ensure PITR is configured
*/

-- ================================
-- END OF SCRIPT
-- ================================
