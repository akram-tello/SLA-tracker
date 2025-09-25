import { NextResponse } from 'next/server';
import { getAnalyticsDb } from '../../../../lib/db';

export async function GET() {
  try {
    const db = await getAnalyticsDb();
    
    // Check if users table exists
    const [tables] = await db.execute(
      "SHOW TABLES LIKE 'users'"
    );
    
    if ((tables as any[]).length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Users table does not exist. Please run the database migration.',
        needsMigration: true
      });
    }
    
    // Check if admin user exists
    const [users] = await db.execute(
      "SELECT id, username, email, role FROM users WHERE username = 'admin'"
    );
    
    const adminUser = (users as any[])[0];
    
    if (!adminUser) {
      return NextResponse.json({
        success: false,
        message: 'Admin user not found. Please run the database migration.',
        needsMigration: true
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Authentication system is ready',
      adminUser: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      }
    });
    
  } catch (error) {
    console.error('Auth test error:', error);
    return NextResponse.json({
      success: false,
      message: 'Database connection error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 