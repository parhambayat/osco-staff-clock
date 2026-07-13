/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    CAFE_WIFI_IP: process.env.CAFE_WIFI_IP || '37.40.226.51',
    // Inlined at build time on Vercel so API routes enforce café Wi-Fi at runtime.
    ...(process.env.VERCEL === '1' ? { OSCO_ENFORCE_WIFI: 'true' } : {}),
  },
};

module.exports = nextConfig;
