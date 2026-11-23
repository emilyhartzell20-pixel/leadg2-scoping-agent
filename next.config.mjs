/** @type {import('next').NextConfig} */
const nextConfig = {
  // pptxgenjs and the HubSpot client are Node-only; keep them out of the bundler.
  serverExternalPackages: ["pptxgenjs", "@hubspot/api-client"],
  // Ship the deck backgrounds + logo with the PPTX function on Vercel.
  outputFileTracingIncludes: {
    "/api/proposals/[id]/pptx": ["./assets/deck/**/*"],
  },
};

export default nextConfig;
