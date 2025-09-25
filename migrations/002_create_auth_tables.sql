-- ================================
-- Authentication Tables Migration
-- ================================

USE sla_tracker;

-- ================================
-- 1. USERS TABLE
-- ================================

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    role ENUM('admin', 'user', 'viewer') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_active (is_active),
    INDEX idx_role (role)
);

-- ================================
-- 2. USER SESSIONS TABLE
-- ================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_session_token (session_token),
    INDEX idx_refresh_token (refresh_token),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);

-- ================================
-- 3. USER 2FA TABLE
-- ================================

CREATE TABLE IF NOT EXISTS user_2fa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    backup_codes JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_user_id (user_id),
    INDEX idx_enabled (is_enabled)
);


-- ================================
-- 4. VERIFICATION QUERIES
-- ================================

-- Check if tables were created successfully
SELECT 'Users table' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'User sessions table' as table_name, COUNT(*) as row_count FROM user_sessions
UNION ALL
SELECT 'User 2FA table' as table_name, COUNT(*) as row_count FROM user_2fa;

-- Show table structure
DESCRIBE users;
DESCRIBE user_sessions;
DESCRIBE user_2fa;

-- ================================
-- END OF MIGRATION
-- ================================ 