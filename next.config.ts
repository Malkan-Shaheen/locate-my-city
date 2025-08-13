const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'index, follow, max-image-preview:large',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=60',
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/location-from-location',
        destination: '/location-from-location/location-to-location',
        permanent: true,
      },
      {
        source: '/location-from-location/:slug',
        destination: '/:slug',
        permanent: true,
      },
      {
        source: '/location-from-me/:slug((?!locationfromme).*)',
        destination: '/:slug',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
      {
        source: '/:slug*me:rest*',
        destination: '/location-from-me/:slug*me:rest*',
      },
      {
        source: '/how-far-is/:path*',
        destination: '/how-far-is/:path*',
      },
      {
        source: '/location-from-location/:slug',
        destination: '/location-from-location/:slug',
      },
      {
      source: '/location-to-location',
      destination: '/location-from-location/location-to-location',
    },
      {
        source: '/:path*',
        destination: '/404',
      },
    ];
  },

  experimental: {
    // Your experimental config
  },

  images: {
    domains: ['cdnjs.cloudflare.com', 'unpkg.com'],
  },
};

module.exports = nextConfig;

