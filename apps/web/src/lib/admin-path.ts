/**
 * Admin path utilities
 * 
 * Uses RAFINERI_ADMIN_URL environment variable for custom admin paths.
 * Default is 'admin' if not set.
 */

// Get the custom admin URL path from environment
export function getAdminUrl(): string {
  return process.env.RAFINERI_ADMIN_URL || 'admin';
}

// Get admin base path
export function getAdminPath(): string {
  return `/${getAdminUrl()}`;
}

// Get admin login path
export function getAdminLoginPath(): string {
  return `/${getAdminUrl()}-login`;
}

// Check if a path is the admin login path
export function isAdminLoginPath(pathname: string): boolean {
  return pathname === getAdminLoginPath();
}

// Check if a path is an admin path
export function isAdminPath(pathname: string): boolean {
  const adminPath = getAdminPath();
  return pathname === adminPath || pathname.startsWith(`${adminPath}/`);
}

// Get the internal admin route (for rewrites)
export function getInternalAdminPath(pathname: string): string {
  const adminPath = getAdminPath();
  return pathname.replace(adminPath, '/admin');
}

// Get the public admin path from internal path
export function getPublicAdminPath(internalPath: string): string {
  const adminPath = getAdminPath();
  return internalPath.replace('/admin', adminPath);
}
