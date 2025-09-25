import { getBasePath } from '@/lib/utils';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for API routes and static files

  if (pathname.startsWith(`${getBasePath()}/api/`) || pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }
  
  // Skip middleware for auth pages (login and register)
  if (pathname.startsWith(`${getBasePath()}/auth/`)) {
    return NextResponse.next();
  }

  // This prevents issues with SSR and localStorage
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 