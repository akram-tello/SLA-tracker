import { NextRequest, NextResponse } from 'next/server';
import { 
  getUserByCredentials, 
  verifyPassword, 
  generateTokens, 
  createUserSession,
  AuthError 
} from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    console.log('Login request received');
    const body = await request.json();
    const { username, password } = body;

    console.log('👤 Login attempt for username:', username);

    // Validate input
    if (!username || !password) {
      console.log('Missing username or password');
      return NextResponse.json(
        { success: false, message: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Get user from database
    console.log('Looking up user in database...');
    const user = await getUserByCredentials(username);
    if (!user) {
      console.log('User not found:', username);
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('User found:', user.username);

    // Verify password
    console.log('Verifying password...');
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      console.log('Password verification failed');
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('Password verified successfully');

    // Generate tokens
    console.log('Generating tokens...');
    const tokens = generateTokens(user);

    // Create session
    console.log('💾 Creating user session...');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await createUserSession(
      user.id,
      tokens.access_token,
      tokens.refresh_token,
      expiresAt,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    console.log('Session created successfully');

    // Remove sensitive data from user object
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, salt, ...safeUser } = user;

    console.log('Login successful for user:', safeUser.username);
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: safeUser,
      tokens
    });

  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 