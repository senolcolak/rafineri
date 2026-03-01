/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@rafineri/shared'],
  output: 'standalone',
  async rewrites() {
    // During build, skip rewrites to avoid connection errors
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return [];
    }
    
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
