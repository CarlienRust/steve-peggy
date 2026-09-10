/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/gaps", destination: "/study-design/gap-analysis", permanent: true },
      { source: "/findings", destination: "/results/findings", permanent: true },
      { source: "/compare", destination: "/results/comparison", permanent: true },
    ];
  },
};

module.exports = nextConfig;
