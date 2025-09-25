import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByCredentials, AuthError } from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Register request received');
    const body = await request.json();
    const { username, email, password, confirmPassword } = body;

    console.log('👤 Registration attempt for username:', username);

    // Validate input
    if (!username || !email || !password || !confirmPassword) {
      console.log('Missing required fields');
      return NextResponse.json(
        { success: false, message: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      console.log('Passwords do not match');
      return NextResponse.json(
        { success: false, message: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      console.log('Password too short');
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('Invalid email format');
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user already exists
    console.log('🔍 Checking if user already exists...');
    const existingUser = await getUserByCredentials(username);
    if (existingUser) {
      console.log('Username already exists:', username);
      return NextResponse.json(
        { success: false, message: 'Username already exists' },
        { status: 409 }
      );
    }

    // Check if email already exists
    const existingEmail = await getUserByCredentials(email);
    if (existingEmail) {
      console.log('Email already exists:', email);
      return NextResponse.json(
        { success: false, message: 'Email already exists' },
        { status: 409 }
      );
    }

    // Create new user
    console.log('Creating new user...');
    const newUser = await createUser(username, email, password, 'user');

    console.log('Registration successful for user:', newUser.username);
    return NextResponse.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        is_active: newUser.is_active,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 