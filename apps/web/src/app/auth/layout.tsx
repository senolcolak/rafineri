/**
 * Auth Layout
 * 
 * Clean layout for authentication pages (login) without sidebar/header.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Login - Rafineri',
  description: 'Admin authentication',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
