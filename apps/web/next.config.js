/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/gaps", destination: "/validate/gap-analysis", permanent: true },
      { source: "/ingest", destination: "/validate/literature", permanent: true },
      { source: "/study-design/gap-analysis", destination: "/validate/gap-analysis", permanent: true },
      { source: "/findings", destination: "/results/findings", permanent: true },
      { source: "/compare", destination: "/results/comparison", permanent: true },
    ];
  },
};

module.exports = nextConfig;
