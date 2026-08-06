#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createRateLimitedApiFetch } from "./canlii-api.js";
import { createCanliiServer } from "./server.js";

const apiKey = process.env.CANLII_API_KEY;

if (!apiKey) {
	console.error("CANLII_API_KEY environment variable is required");
	process.exit(1);
}

async function main(apiKey: string): Promise<void> {
	const apiFetch = createRateLimitedApiFetch();
	const server = createCanliiServer(apiKey, apiFetch);
	const transport = new StdioServerTransport();

	await server.connect(transport);
}

main(apiKey).catch((error: unknown) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
