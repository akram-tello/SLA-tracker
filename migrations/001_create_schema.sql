-- Create sla_tracker database schema
CREATE DATABASE IF NOT EXISTS sla_tracker;
USE sla_tracker;

-- TAT Configuration table
CREATE TABLE IF NOT EXISTS tat_config (
    brand_name VARCHAR(50) NOT NULL,
    brand_code VARCHAR(10) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    processed_tat INT NOT NULL COMMENT 'Minutes',
    shipped_tat INT NOT NULL COMMENT 'Days',
    delivered_tat INT NOT NULL COMMENT 'Days',
    risk_pct TINYINT NOT NULL DEFAULT 80 COMMENT 'Risk percentage threshold',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (brand_name, country_code)
);

-- Daily summary table for dashboard performance
CREATE TABLE IF NOT EXISTS sla_daily_summary (
    summary_date DATE NOT NULL,
    brand_name VARCHAR(50) NOT NULL,
    brand_code VARCHAR(10) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    stage ENUM('Processed', 'Shipped', 'Delivered') NOT NULL,
    orders_total INT NOT NULL DEFAULT 0,
    orders_on_time INT NOT NULL DEFAULT 0,
    orders_on_risk INT NOT NULL DEFAULT 0,
    orders_breached INT NOT NULL DEFAULT 0,
    avg_delay_sec INT NOT NULL DEFAULT 0,
    refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (summary_date, brand_name, country_code, stage),
    INDEX idx_summary_date (summary_date),
    INDEX idx_brand_country (brand_name, country_code)
);

-- Sample TAT configurations
INSERT INTO tat_config (brand_name, brand_code, country_code, processed_tat, shipped_tat, delivered_tat, risk_pct) VALUES
('Victoria''s Secret', 'vs', 'my', 120, 2, 7, 80),
('Victoria''s Secret', 'vs', 'sg', 90, 1, 5, 80),
('Bath & Body Works', 'bbw', 'my', 150, 3, 10, 75),
('Bath & Body Works', 'bbw', 'sg', 100, 2, 7, 75);
