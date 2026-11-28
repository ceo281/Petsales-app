/** @type {import('next').NextConfig} */
const cors = [{ key: "Access-Control-Allow-Origin", value: process.env.WEATHER_ALLOWED_ORIGIN || "*" }];
const nextConfig = {
  serverExternalPackages: ["cheerio"],
  // The weather widget is embedded on other PetSales sites, so its API, script, fonts and art must load cross-origin.
  async headers() {
    return [
      { source: "/api/weather", headers: cors },
      { source: "/fonts/:file*", headers: [...cors, { key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/weather-widget.js", headers: [...cors, { key: "Cache-Control", value: "public, max-age=3600" }] },
      { source: "/weather-cloud.webp", headers: [...cors, { key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
};
export default nextConfig;
