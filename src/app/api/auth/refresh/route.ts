import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, getUserById, generateTokens, createUserSession } from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      return NextResponse.json(
        { success: false, message: 'Refresh token is required' },
        { status: 400 }
      );
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refresh_token);
    
    // Get user from database
    const user = await getUserById(payload.user_id);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 401 }
      );
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    // Create new session
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

    return NextResponse.json({
      success: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    
    return NextResponse.json(
      { success: false, message: 'Invalid refresh token' },
      { status: 401 }
    );
  }
} 