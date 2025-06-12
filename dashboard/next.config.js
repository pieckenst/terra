const { resolve } = require('path');
const { execSync } = require('child_process');

// Try to require the debug module, but don't fail if it's not available
let debug = {
  info: console.log.bind(console, '[INFO]'),
  debug: () => {},
  error: console.error.bind(console, '[ERROR]')
};

try {
  // Try to load the debug module
  debug = require('./debug');
  e
  // Log startup information
  debug.info('Next.js configuration loaded');
  debug.debug('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    DEBUG: process.env.DEBUG,
    NODE_OPTIONS: process.env.NODE_OPTIONS,
    path: resolve(process.cwd(), 'dashboard')
  });
} catch (error) {
  console.warn('Could not load debug module, using console fallback');
  console.warn('Error:', error.message);
}

const dashboardPath = resolve(process.cwd(), 'dashboard');

/** @type {import('next').NextConfig} */
// Load environment variables
const debugEnabled = process.env.NEXT_PUBLIC_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

const nextConfig = {
  env: {
    NEXT_PUBLIC_DEBUG: debugEnabled ? 'true' : 'false',
    DEBUG: process.env.DEBUG || '',
  },
  experimental: {
    nodeMiddleware: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com'
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com'
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com'
      }
    ]
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
      };
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': dashboardPath,
    };
    return config;
  },
  sassOptions: {
    includePaths: [resolve(dashboardPath, 'styles')],
  },
  experimental: {
    serverSourceMaps: true,
    logging: {
      level: 'verbose',
      fullUrl: true
    },
    nodeMiddleware: true,
  },
};

module.exports = nextConfig;