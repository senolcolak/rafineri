'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/admin-api';
import {
  LayoutDashboard,
  FileText,
  Newspaper,
  Settings,
  Users,
  BarChart3,
  Shield,
  CheckSquare,
  LogOut,
} from 'lucide-react';

// Get admin URL from env (client-side safe)
const ADMIN_URL = process.env.NEXT_PUBLIC_RAFINERI_ADMIN_URL || 'admin';
const ADMIN_PATH = `/${ADMIN_URL}`;
const ADMIN_LOGIN_PATH = `/${ADMIN_URL}-login`;

const navItems = [
  {
    href: ADMIN_PATH,
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: `${ADMIN_PATH}/stories`,
    label: 'Stories',
    icon: FileText,
  },
  {
    href: `${ADMIN_PATH}/sources`,
    label: 'Sources',
    icon: Newspaper,
  },
  {
    href: `${ADMIN_PATH}/analytics`,
    label: 'Analytics',
    icon: BarChart3,
  },
  {
    href: `${ADMIN_PATH}/approval`,
    label: 'Cross-Check',
    icon: CheckSquare,
  },
  {
    href: `${ADMIN_PATH}/users`,
    label: 'Users',
    icon: Users,
  },
  {
    href: `${ADMIN_PATH}/settings`,
    label: 'Settings',
    icon: Settings,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // Continue with redirect even if API logout fails.
    }
    router.push(ADMIN_LOGIN_PATH);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold">Admin Panel</span>
          <div className="flex-1" />
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to Site
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-64 shrink-0">
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
