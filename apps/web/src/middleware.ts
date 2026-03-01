import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Get admin URL from environment (default to 'admin')
function getAdminUrl(): string {
  return process.env.RAFINERI_ADMIN_URL || 'admin';
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

// Check if path is admin login
function isAdminLoginPath(pathname: string, adminUrl: string): boolean {
  return pathname === `/${adminUrl}-login`;
}

// Check if path matches the configured admin URL pattern
function isValidAdminPath(pathname: string, adminUrl: string): boolean {
  return pathname.startsWith(`/${adminUrl}`) || pathname === `/${adminUrl}-login`;
}

// Convert public admin path to internal path for rewrite
function toInternalPath(pathname: string, adminUrl: string): string {
  const publicBase = `/${adminUrl}`;
  return pathname.replace(publicBase, '/admin');
}

export function middleware(request: NextRequest) {
  const adminUrl = getAdminUrl();
  const { pathname } = request.nextUrl;

  // Rewrite login URLs to auth folder
  if (pathname === `/${adminUrl}-login` || pathname === '/admin-login') {
    const loginPath = pathname === '/admin-login' && adminUrl !== 'admin' 
      ? `/${adminUrl}-login` 
      : pathname;
    
    // Check if already authenticated
    const adminToken = request.cookies.get('admin_token');
    if (adminToken) {
      const adminBaseUrl = new URL(`/${adminUrl}`, request.url);
      return NextResponse.redirect(adminBaseUrl);
    }
    
    // Rewrite to internal auth path
    const url = request.nextUrl.clone();
    url.pathname = `/auth${loginPath}`;
    return NextResponse.rewrite(url);
  }

  // Handle old /admin-login redirect to custom login URL
  if (adminUrl !== 'admin' && pathname === '/admin-login') {
    const redirectUrl = new URL(`/${adminUrl}-login`, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Handle old /admin paths redirect to custom admin URL
  if (adminUrl !== 'admin' && pathname.startsWith('/admin')) {
    const publicPath = pathname.replace('/admin', `/${adminUrl}`);
    const redirectUrl = new URL(publicPath, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Check if this is a valid admin path for the configured admin URL
  const isAdminRelatedPath = pathname.startsWith(`/${adminUrl}`) || 
                             pathname === `/${adminUrl}-login`;

  // If using custom admin URL, validate the path matches
  if (adminUrl !== 'admin' && !isAdminRelatedPath) {
    // Check if someone is trying to access a different pattern like /other-admin
    if (pathname.match(/^\/[^/]+-login$/) || pathname.match(/^\/[^/]+\/stories/)) {
      // This looks like an attempt to access admin with wrong URL - 404
      return NextResponse.next();
    }
  }

  // Handle public admin paths - rewrite to internal paths
  if (pathname.startsWith(`/${adminUrl}`) && adminUrl !== 'admin') {
    // Validate this is the correct admin URL before rewriting
    if (!isValidAdminPath(pathname, adminUrl)) {
      return NextResponse.next();
    }

    const internalPath = toInternalPath(pathname, adminUrl);
    const url = request.nextUrl.clone();
    url.pathname = internalPath;

    // Check authentication for protected paths
    if (isProtectedAdminPath(pathname, adminUrl)) {
      const adminToken = request.cookies.get('admin_token');
      
      if (!adminToken) {
        // Redirect to login page
        const loginUrl = new URL(`/${adminUrl}-login`, request.url);
        return NextResponse.redirect(loginUrl);
      }
    }

    return NextResponse.rewrite(url);
  }

  // Check if accessing protected admin route with default 'admin' URL
  if (adminUrl === 'admin' && isProtectedAdminPath(pathname, adminUrl)) {
    const adminToken = request.cookies.get('admin_token');
    
    if (!adminToken) {
      // Redirect to login page
      const loginUrl = new URL(`/${adminUrl}-login`, request.url);
      return NextResponse.redirect(loginUrl);
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
