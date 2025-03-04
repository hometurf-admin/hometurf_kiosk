/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'; " +
              "img-src 'self' http: https: data: blob:; " +
              "media-src 'self' http: https: data: blob:; " +
              "connect-src 'self' http: https:; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline';",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
