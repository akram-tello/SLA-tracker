#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const readline = require('readline');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.ANALYTICS_DB_HOST || 'localhost',
  port: parseInt(process.env.ANALYTICS_DB_PORT || '3306'),
  user: process.env.ANALYTICS_DB_USER || 'root',
  password: process.env.ANALYTICS_DB_PASSWORD || '',
  database: process.env.ANALYTICS_DB_NAME || 'sla_tracker',
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
function validatePassword(password) {
  if (password.length < 6) {
    return 'Password must be at least 6 characters long';
  }
  return null;
}

// Hash password
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  return { hash, salt };
}

// Check if user already exists
async function checkUserExists(db, identifier) {
  const [rows] = await db.execute(
    'SELECT id, username, email FROM users WHERE username = ? OR email = ?',
    [identifier, identifier]
  );
  return rows.length > 0 ? rows[0] : null;
}

// Create user in database
async function createUser(db, username, email, password, role) {
  const { hash, salt } = await hashPassword(password);
  
  const [result] = await db.execute(
    'INSERT INTO users (username, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)',
    [username, email, hash, salt, role]
  );

  return result.insertId;
}

// Main function
async function createUserCLI() {
  console.log('🚀 SLA Tracker - User Creation Script');
  console.log('=====================================\n');

  try {
    // console.log('Database config:', {
    //   host: dbConfig.host,
    //   port: dbConfig.port,
    //   user: dbConfig.user,
    //   database: dbConfig.database
    // });
    
    const db = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully\n');

    // Get user input
    const username = await askQuestion('👤 Enter username: ');
    if (!username) {
      console.log('❌ Username is required');
      process.exit(1);
    }

    const email = await askQuestion('📧 Enter email: ');
    if (!email) {
      console.log('❌ Email is required');
      process.exit(1);
    }

    if (!isValidEmail(email)) {
      console.log('❌ Invalid email format');
      process.exit(1);
    }

    const password = await askQuestion('🔒 Enter password: ');
    if (!password) {
      console.log('❌ Password is required');
      process.exit(1);
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      console.log(`❌ ${passwordError}`);
      process.exit(1);
    }

    const confirmPassword = await askQuestion('🔐 Confirm password: ');
    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match');
      process.exit(1);
    }

    const role = 'admin';

    console.log('\n🔍 Checking if user already exists...');
    
    // Check if user already exists
    const existingUser = await checkUserExists(db, username);
    if (existingUser) {
      console.log(`❌ User with username "${username}" already exists`);
      process.exit(1);
    }

    const existingEmail = await checkUserExists(db, email);
    if (existingEmail) {
      console.log(`❌ User with email "${email}" already exists`);
      process.exit(1);
    }

    console.log('✅ User does not exist, proceeding with creation...\n');

    // Create user
    console.log('👤 Creating user...');
    const userId = await createUser(db, username, email, password, role);

    console.log('\n🎉 User created successfully!');
    console.log('========================');
    console.log(`ID: ${userId}`);
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}`);
    console.log(`Created: ${new Date().toISOString()}`);
    console.log('\n✅ User can now log in to the system');

    // Close database connection
    await db.end();
    rl.close();

  } catch (error) {
    console.error('🚨 Error creating user:', error.message);
    
    if (error.message.includes('ENOENT') || error.message.includes('.env')) {
      console.log('\n💡 .env file not found. Please create a .env file in your project root with your database configuration.');
      console.log('   Example .env file:');
      console.log('   ANALYTICS_DB_HOST=localhost');
      console.log('   ANALYTICS_DB_PORT=3306');
      console.log('   ANALYTICS_DB_USER=root');
      console.log('   ANALYTICS_DB_PASSWORD=your_password');
      console.log('   ANALYTICS_DB_NAME=sla_tracker');
    }
    
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n👋 Script terminated by user');
  rl.close();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  createUserCLI().catch((error) => {
    console.error('🚨 Fatal error:', error.message);
    process.exit(1);
  });
} 