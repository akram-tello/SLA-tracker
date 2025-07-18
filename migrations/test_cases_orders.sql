-- Test Cases for SLA Tracker Orders
-- This file contains comprehensive test data covering all edge cases and scenarios

-- Drop existing table and create new one
DROP TABLE IF EXISTS orders_vs_my;

CREATE TABLE IF NOT EXISTS orders_vs_my (
    order_no VARCHAR(50) PRIMARY KEY,
    order_status VARCHAR(20),
    shipping_status VARCHAR(20),
    confirmation_status VARCHAR(20),
    placed_time DATETIME,
    processed_time DATETIME,
    shipped_time DATETIME,
    delivered_time DATETIME,
    processed_tat VARCHAR(50),
    shipped_tat VARCHAR(50),
    delivered_tat VARCHAR(50),
    currency VARCHAR(10),
    invoice_no VARCHAR(50),
    brand_name VARCHAR(100),
    country_code VARCHAR(10),
    card_type VARCHAR(50),
    amount DECIMAL(10,2),
    transactionid VARCHAR(50),
    shipmentid VARCHAR(50),
    shipping_method VARCHAR(100),
    carrier VARCHAR(100),
    tracking_url TEXT,
    updated_at DATETIME
);

INSERT INTO orders_vs_my (order_no,order_status,shipping_status,confirmation_status,placed_time,processed_time,shipped_time,delivered_time,processed_tat,shipped_tat,delivered_tat,currency,invoice_no,brand_name,country_code,card_type,amount,transactionid,shipmentid,shipping_method,carrier,tracking_url,updated_at) VALUES
	 ('VSMY200001','PROCESSING','NOTSHIPPED','NOTCONFIRMED','2025-06-30 06:50:00',NULL,NULL,NULL,NULL,NULL,NULL,'MYR','TESTINV001','Victoria''s Secret','MY','eGHL',100.00,'VSMY200001',NULL,'Standard Delivery',NULL,NULL,'2025-07-16 13:36:10'),
	 ('VSMY200002','PROCESSING','NOTSHIPPED','NOTCONFIRMED','2025-06-30 06:50:00',NULL,NULL,NULL,NULL,NULL,NULL,'MYR','TESTINV002','Victoria''s Secret','MY','eGHL',150.00,'VSMY200002',NULL,'Standard Delivery',NULL,NULL,'2025-07-16 13:36:10'),
	 ('VSMY200003','PROCESSING','NOTSHIPPED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 06:59:00',NULL,NULL,'9 m',NULL,NULL,'MYR','TESTINV003','Victoria''s Secret','MY','eGHL',200.00,'VSMY200003',NULL,'Standard Delivery',NULL,NULL,'2025-07-16 13:36:10'),
	 ('VSMY200004','PROCESSING','NOTSHIPPED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 07:02:00',NULL,NULL,'12 m',NULL,NULL,'MYR','TESTINV004','Victoria''s Secret','MY','eGHL',250.00,'VSMY200004',NULL,'Standard Delivery',NULL,NULL,'2025-07-16 13:36:10'),
	 ('VSMY200005','PROCESSING','NOTSHIPPED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 07:05:00',NULL,NULL,'15 m',NULL,NULL,'MYR','TESTINV005','Victoria''s Secret','MY','eGHL',300.00,'VSMY200005',NULL,'Standard Delivery',NULL,NULL,'2025-07-16 13:36:10'),
	 ('VSMY200006','PROCESSING','SHIPPED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 06:55:00','2025-07-02 06:00:00',NULL,'5 m','1 d, 23 h, 10 m',NULL,'MYR','TESTINV006','Victoria''s Secret','MY','eGHL',350.00,'VSMY200006','TESTSHIP006','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200007','PROCESSING','SHIPPED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 06:55:00','2025-07-02 21:00:00',NULL,'5 m','2 d, 14 h, 10 m',NULL,'MYR','TESTINV007','Victoria''s Secret','MY','eGHL',400.00,'VSMY200007','TESTSHIP007','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200008','PROCESSING','SHIPPED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 06:55:00','2025-07-03 10:00:00',NULL,'5 m','3 d, 3 h, 10 m',NULL,'MYR','TESTINV008','Victoria''s Secret','MY','eGHL',450.00,'VSMY200008','TESTSHIP008','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200009','COMPLETED','DELIVERED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 06:55:00','2025-07-01 07:00:00','2025-07-06 06:50:00','5 m','1 d, 10 m','6 d','MYR','TESTINV009','Victoria''s Secret','MY','eGHL',500.00,'VSMY200009','TESTSHIP009','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200010','COMPLETED','DELIVERED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 06:55:00','2025-07-01 07:00:00','2025-07-08 06:50:00','5 m','1 d, 10 m','8 d','MYR','TESTINV010','Victoria''s Secret','MY','eGHL',550.00,'VSMY200010','TESTSHIP010','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200011','COMPLETED','DELIVERED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 06:55:00','2025-07-01 07:00:00','2025-07-10 06:50:00','5 m','1 d, 10 m','10 d','MYR','TESTINV011','Victoria''s Secret','MY','eGHL',600.00,'VSMY200011','TESTSHIP011','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10');
INSERT INTO orders_vs_my (order_no,order_status,shipping_status,confirmation_status,placed_time,processed_time,shipped_time,delivered_time,processed_tat,shipped_tat,delivered_tat,currency,invoice_no,brand_name,country_code,card_type,amount,transactionid,shipmentid,shipping_method,carrier,tracking_url,updated_at) VALUES
	 ('VSMY200012','COMPLETED','DELIVERED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 07:10:00','2025-07-03 08:00:00','2025-07-07 06:50:00','20 m','2 d, 1 h, 10 m','7 d','MYR','TESTINV012','Victoria''s Secret','MY','eGHL',650.00,'VSMY200012','TESTSHIP012','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200013','PROCESSING','SHIPPED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 07:15:00','2025-07-03 10:00:00',NULL,'25 m','3 d, 3 h, 10 m',NULL,'MYR','TESTINV013','Victoria''s Secret','MY','eGHL',700.00,'VSMY200013','TESTSHIP013','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200014','PROCESSING','SHIPPED','NOTCONFIRMED','2025-06-30 06:50:00',NULL,'2025-07-01 08:00:00',NULL,NULL,'1 d, 1 h, 10 m',NULL,'MYR','TESTINV014','Victoria''s Secret','MY','eGHL',180.00,'VSMY200014','TESTSHIP014','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200015','COMPLETED','DELIVERED','NOTCONFIRMED','2025-06-30 06:50:00',NULL,'2025-07-01 08:00:00','2025-07-05 06:50:00',NULL,'1 d, 1 h, 10 m','5 d','MYR','TESTINV015','Victoria''s Secret','MY','eGHL',220.00,'VSMY200015','TESTSHIP015','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200016','COMPLETED','DELIVERED','NOTCONFIRMED','2025-06-30 06:50:00',NULL,NULL,'2025-07-04 06:50:00',NULL,NULL,'4 d','MYR','TESTINV016','Victoria''s Secret','MY','eGHL',120.00,'VSMY200016','TESTSHIP016','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200017','COMPLETED','DELIVERED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 06:52:00','2025-06-30 07:00:00','2025-07-02 06:50:00','2 m','10 m','2 d','MYR','TESTINV017','Victoria''s Secret','MY','eGHL',80.00,'VSMY200017','TESTSHIP017','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSMY200018','PROCESSING','SHIPPED','CONFIRMED','2025-06-30 06:50:00','2025-07-05 10:30:00','2025-07-10 15:00:00',NULL,'5 d, 3 h, 40 m','10 d, 8 h, 10 m',NULL,'MYR','TESTINV018','Victoria''s Secret','MY','eGHL',900.00,'VSMY200018','TESTSHIP018','Standard Delivery','City Link','https://www.citylinkexpress.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSSG200019','COMPLETED','DELIVERED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 07:00:00','2025-07-01 08:00:00','2025-07-04 06:50:00','10 m','1 d, 1 h, 10 m','4 d','SGD','TESTINV019','Victoria''s Secret','SG','Credit Card',150.00,'VSSG200019','TESTSHIP019','Express Delivery','DHL','https://www.dhl.com/tracking-result/?track0=','2025-07-16 13:36:10'),
	 ('VSTH200020','PROCESSING','NOTSHIPPED','CONFIRMED','2025-06-30 06:50:00','2025-06-30 06:55:00',NULL,NULL,'5 m',NULL,NULL,'THB','TESTINV020','Victoria''s Secret','TH','Visa',200.00,'VSTH200020',NULL,'Standard Delivery',NULL,NULL,'2025-07-16 13:36:10'); 