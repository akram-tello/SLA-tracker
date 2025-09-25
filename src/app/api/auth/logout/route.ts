import { NextRequest, NextResponse } from 'next/server';
import { deleteUserSession } from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_token } = body;

    if (session_token) {
      // Delete the session from database
      await deleteUserSession(session_token);
    }

    return NextResponse.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 