import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { TopBar } from '@/components/layout/top-bar';
import { Sidebar } from '@/components/layout/sidebar';

export const metadata: Metadata = {
  title: 'Rafineri - Verify Everything',
  description: 'AI-powered fact verification and news analysis platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <div className="min-h-screen bg-background">
            <TopBar />
            <div className="flex pt-14">
              <Sidebar />
              <main className="flex-1 lg:ml-64 min-h-[calc(100vh-3.5rem)]">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
