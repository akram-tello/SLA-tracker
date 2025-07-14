-- Create sla_tracker database schema
CREATE DATABASE IF NOT EXISTS sla_tracker;
USE sla_tracker;

-- TAT Configuration table
CREATE TABLE IF NOT EXISTS tat_config (
    brand_name VARCHAR(50) NOT NULL,
    brand_code VARCHAR(10) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    processed_tat VARCHAR(20) NOT NULL COMMENT 'Formatted time: e.g., "2h 30m"',
    shipped_tat VARCHAR(20) NOT NULL COMMENT 'Formatted time: e.g., "2d 5h 30m"',
    delivered_tat VARCHAR(20) NOT NULL COMMENT 'Formatted time: e.g., "7d 12h"',
    risk_pct TINYINT NOT NULL DEFAULT 80 COMMENT 'Risk percentage threshold',
    pic VARCHAR(255) DEFAULT NULL COMMENT 'People in charge for this brand/country combination',
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
    stage ENUM('Not Processed', 'Processed', 'Shipped', 'Delivered') NOT NULL,
    orders_total INT NOT NULL DEFAULT 0,
    orders_on_time INT NOT NULL DEFAULT 0,
    orders_on_risk INT NOT NULL DEFAULT 0,
    orders_breached INT NOT NULL DEFAULT 0,
    avg_delay_sec INT NOT NULL DEFAULT 0,
    refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (summary_date, brand_name, country_code, stage),
    INDEX idx_summary_date (summary_date),
    INDEX idx_brand_country (brand_name, country_code),
    INDEX idx_date_brand (summary_date, brand_name),
    INDEX idx_date_country (summary_date, country_code),
    INDEX idx_stage (stage),
    INDEX idx_refreshed_at (refreshed_at)
);

-- target table template for orders (pattern: orders_{brand_code}_{country_code})
-- This is a template - actual tables will be created dynamically by ETL process
/*
Example table: orders_vs_my, orders_bbw_sg, etc.
CREATE TABLE orders_{brand_code}_{country_code} (
    order_no VARCHAR(100) NOT NULL PRIMARY KEY,
    order_status VARCHAR(50),
    shipping_status VARCHAR(50),
    confirmation_status VARCHAR(50),
    placed_time DATETIME,
    processed_time DATETIME,
    shipped_time DATETIME,
    delivered_time DATETIME,
    processed_tat VARCHAR(20) COMMENT 'Formatted time string (e.g., "2h 30m")',
    shipped_tat VARCHAR(20) COMMENT 'Formatted time string (e.g., "2d 5h")',
    delivered_tat VARCHAR(20) COMMENT 'Formatted time string (e.g., "7d 12h")',
    currency VARCHAR(10),
    invoice_no VARCHAR(100),
    brand_name VARCHAR(100),
    country_code VARCHAR(10),
    -- Payment table fields (from {brand_code}_{country_code}_payments)
    card_type VARCHAR(50),
    amount DECIMAL(10,2),
    transactionid VARCHAR(100),
    -- Shipment table fields (from {brand_code}_{country_code}_shipments)
    shipmentid VARCHAR(191),
    shipping_method VARCHAR(191),
    carrier VARCHAR(191),
    tracking_url VARCHAR(191),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_placed_time (placed_time),
    INDEX idx_brand_country (brand_name, country_code),
    INDEX idx_processed_time (processed_time),
    INDEX idx_shipped_time (shipped_time),
    INDEX idx_delivered_time (delivered_time),
    INDEX idx_confirmation_status (confirmation_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
*/

-- Complete TAT configurations for all brand/country combinations with PIC
INSERT INTO tat_config (brand_name, brand_code, country_code, processed_tat, shipped_tat, delivered_tat, risk_pct, pic) VALUES
-- Victoria's Secret
('Victoria''s Secret', 'vs', 'MY', '10m', '2d', '5d', 80, 'Operations Team'),
('Victoria''s Secret', 'vs', 'SG', '10m', '1d', '5d', 80, 'Operations Team'),
('Victoria''s Secret', 'vs', 'AU', '10m', '1d', '5d', 80, 'Operations Team'),
('Victoria''s Secret', 'vs', 'ID', '10m', '3d', '10d', 80, 'Operations Team'),
('Victoria''s Secret', 'vs', 'TH', '10m', '2d', '8d', 80, 'Operations Team'),

-- Bath & Body Works  
('Bath & Body Works', 'bbw', 'MY', '10m', '3d', '10d', 75, 'Operations Team'),
('Bath & Body Works', 'bbw', 'SG', '10m', '2d', '7d', 75, 'Operations Team'),
('Bath & Body Works', 'bbw', 'AU', '10m', '3d', '10d', 75, 'Operations Team'),
('Bath & Body Works', 'bbw', 'HK', '10m', '2d', '7d', 75, 'Operations Team'),
('Bath & Body Works', 'bbw', 'ID', '10m', '3d', '12d', 75, 'Operations Team'),
('Bath & Body Works', 'bbw', 'NZ', '10m', '3d', '10d', 75, 'Operations Team'),
('Bath & Body Works', 'bbw', 'PH', '10m', '4d', '14d', 75, 'Operations Team'),
('Bath & Body Works', 'bbw', 'TH', '10m', '3d', '10d', 75, 'Operations Team'),
('Bath & Body Works', 'bbw', 'VN', '10m', '3d', '12d', 75, 'Operations Team'),

-- Rituals
('Rituals', 'rituals', 'MY', '10m', '2d', '7d', 80, 'Logistics Team'),
('Rituals', 'rituals', 'SG', '10m', '1d', '5d', 80, 'Logistics Team'),
('Rituals', 'rituals', 'AU', '10m', '2d', '7d', 80, 'Logistics Team'),
('Rituals', 'rituals', 'TH', '10m', '2d', '8d', 80, 'Logistics Team');

-- Show all TAT configurations
SELECT 
    brand_name,
    brand_code, 
    country_code,
    processed_tat,
    shipped_tat,
    delivered_tat,
    risk_pct,
    pic
FROM tat_config 
ORDER BY brand_name, country_code;

-- Show summary table structure
DESCRIBE sla_daily_summary;