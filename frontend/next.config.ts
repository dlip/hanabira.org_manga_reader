import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  async rewrites() {
    // Use environment variable for backend URL to support both local and Docker
    // BACKEND_URL is for server-side rewrites (inside Docker: http://backend:5000)
    // Falls back to localhost for local development
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    return [
      // Allow API calls to translation backend
      {
        source: '/api/translate/:path*',
        destination: `${backendUrl}/:path*`,
      },
      // Flashcards persistence API
      {
        source: '/api/flashcards/:path*',
        destination: `${backendUrl}/flashcards/:path*`,
      },
      // Series endpoints (fallback if route handlers not used)
      {
        source: '/api/series',
        destination: `${backendUrl}/series`,
      },
      {
        source: '/api/series/:path*',
        destination: `${backendUrl}/series/:path*`,
      },
      // Media proxy (images stored by backend)
      {
        source: '/api/media/:path*',
        destination: `${backendUrl}/media/:path*`,
      },
    ];
  },
  // Allow images from any domain for manga pages
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

export default nextConfig;
