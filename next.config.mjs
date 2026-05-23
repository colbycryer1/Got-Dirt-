/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Stripe and Google Maps domains for images/content
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
  // Required to allow Stripe webhook body parsing
  api: {
    bodyParser: false,
  },
};

export default nextConfig;
