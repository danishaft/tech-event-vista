/** @type {import('next').NextConfig} */
const nextConfig = {
	// Enable standalone output for Docker
	output: "standalone",
	// instrumentationHook is now default in Next.js 15, no need to specify
	images: {
		domains: ["images.unsplash.com", "via.placeholder.com"],
	},
	webpack: (config, { isServer }) => {
		// Mark puppeteer and related packages as external for server-side only
		if (isServer) {
			config.externals = config.externals || [];
			config.externals.push({
				puppeteer: "commonjs puppeteer",
				"puppeteer-core": "commonjs puppeteer-core",
				"puppeteer-extra": "commonjs puppeteer-extra",
				"puppeteer-extra-plugin-stealth":
					"commonjs puppeteer-extra-plugin-stealth",
			});
		}
		return config;
	},
};

module.exports = nextConfig;
