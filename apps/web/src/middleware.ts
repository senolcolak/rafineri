import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Get admin URL from environment (default to 'admin')
function getAdminUrl(): string {
  return process.env.RAFINERI_ADMIN_URL || process.env.NEXT_PUBLIC_RAFINERI_ADMIN_URL || 'admin';
}

// Check if the path is a protected admin route
function isProtectedAdminPath(pathname: string, adminUrl: string): boolean {
  const adminPath = `/${adminUrl}`;
  const protectedPaths = [
    adminPath,
    `${adminPath}/stories`,
    `${adminPath}/sources`,
    `${adminPath}/analytics`,
    `${adminPath}/approval`,
    `${adminPath}/users`,
    `${adminPath}/settings`,
  ];
  return protectedPaths.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
}

// Convert public admin path to internal path for rewrite
function toInternalPath(pathname: string, adminUrl: string): string {
  const publicBase = `/${adminUrl}`;
  return pathname.replace(publicBase, '/admin');
}

export function middleware(request: NextRequest) {
  const adminUrl = getAdminUrl();
  const { pathname } = request.nextUrl;

  // Handle login page - rewrite to internal auth/login
  if (pathname === `/${adminUrl}-login` || pathname === '/admin-login') {
    const adminToken = request.cookies.get('admin_token');
    
    // If already authenticated, redirect to admin
    if (adminToken) {
      return NextResponse.redirect(new URL(`/${adminUrl}`, request.url));
    }
    
    // Rewrite to internal login page
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.rewrite(url);
  }

  // Block direct access to internal auth paths
  if (pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Handle old /admin-login redirect to custom login URL
  if (adminUrl !== 'admin' && pathname === '/admin-login') {
    return NextResponse.redirect(new URL(`/${adminUrl}-login`, request.url));
  }

  // Handle old /admin paths redirect to custom admin URL
  if (adminUrl !== 'admin' && pathname.startsWith('/admin')) {
    const publicPath = pathname.replace('/admin', `/${adminUrl}`);
    return NextResponse.redirect(new URL(publicPath, request.url));
  }

  // Handle public admin paths with custom URL - rewrite to internal /admin paths
  if (pathname.startsWith(`/${adminUrl}`) && adminUrl !== 'admin') {
    const internalPath = toInternalPath(pathname, adminUrl);
    const url = request.nextUrl.clone();
    url.pathname = internalPath;

    // Check authentication for protected paths
    if (isProtectedAdminPath(pathname, adminUrl)) {
      const adminToken = request.cookies.get('admin_token');
      if (!adminToken) {
        return NextResponse.redirect(new URL(`/${adminUrl}-login`, request.url));
      }
    }

    return NextResponse.rewrite(url);
  }

  // Check authentication for default 'admin' URL
  if (adminUrl === 'admin' && isProtectedAdminPath(pathname, adminUrl)) {
    const adminToken = request.cookies.get('admin_token');
    if (!adminToken) {
      return NextResponse.redirect(new URL(`/${adminUrl}-login`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/admin-login',
    '/auth/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
