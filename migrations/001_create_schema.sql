-- Create sla_tracker database schema
CREATE DATABASE IF NOT EXISTS sla_tracker;
USE sla_tracker;

-- TAT Configuration table
CREATE TABLE tat_config (
    brand_name VARCHAR(50) NOT NULL,
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
CREATE TABLE sla_daily_summary (
    summary_date DATE NOT NULL,
    brand_name VARCHAR(50) NOT NULL,
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
INSERT INTO tat_config (brand_name, country_code, processed_tat, shipped_tat, delivered_tat, risk_pct) VALUES
('Victoria''s Secret', 'MY', 120, 2, 7, 80),
('Victoria''s Secret', 'SG', 90, 1, 5, 80),
('Bath & Body Works', 'MY', 150, 3, 10, 75),
('Bath & Body Works', 'SG', 100, 2, 7, 75);

-- Example: Create orders table for Victoria's Secret Malaysia
-- Note: In production, these tables would be created dynamically via ETL process
CREATE TABLE orders_VS_MY (
    order_no VARCHAR(50) PRIMARY KEY,
    order_status VARCHAR(50),
    shipping_status VARCHAR(50),
    confirmation_status VARCHAR(50),
    processing_time DATETIME,
    shipped_time DATETIME,
    delivered_time DATETIME,
    processed_tat INT COMMENT 'Minutes',
    shipped_tat INT COMMENT 'Days',
    delivered_tat INT COMMENT 'Days',
    order_date DATE NOT NULL,
    brand_name VARCHAR(50) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_covering (order_date, brand_name, country_code, order_status),
    INDEX idx_updated_at (updated_at)
);

-- Sample data for testing
INSERT INTO orders_VS_MY (order_no, order_status, shipping_status, confirmation_status, 
    processing_time, shipped_time, delivered_time, processed_tat, shipped_tat, delivered_tat,
    order_date, brand_name, country_code) VALUES
('VS-MY-001', 'Completed', 'Delivered', 'Confirmed', 
    '2024-01-15 10:30:00', '2024-01-15 14:00:00', '2024-01-18 16:30:00',
    210, 0, 3, '2024-01-15', 'Victoria''s Secret', 'MY'),
('VS-MY-002', 'Processing', 'Pending', 'Confirmed',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '2024-01-16', 'Victoria''s Secret', 'MY'),
('VS-MY-003', 'Shipped', 'In Transit', 'Confirmed',
    '2024-01-14 09:15:00', '2024-01-14 16:45:00', NULL,
    75, 1, NULL, '2024-01-14', 'Victoria''s Secret', 'MY'); 