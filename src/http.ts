#!/usr/bin/env node

import type { Request, Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createRateLimitedApiFetch } from "./canlii-api.js";
import { createCanliiServer } from "./server.js";

const apiKey = process.env.CANLII_API_KEY;

if (!apiKey) {
	console.error("CANLII_API_KEY environment variable is required");
	process.exit(1);
}

const host = process.env.HOST?.trim() || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3000", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
	console.error("PORT must be an integer between 1 and 65535");
	process.exit(1);
}

const allowedHosts = (process.env.ALLOWED_HOSTS || "")
	.split(",")
	.map((value) => value.trim())
	.filter((value) => value.length > 0);

const app = createMcpExpressApp({
	host,
	...(allowedHosts.length > 0 ? { allowedHosts } : {}),
});

const apiFetch = createRateLimitedApiFetch();

app.get("/health", (_req: Request, res: Response) => {
	res.status(200).json({
		status: "ok",
		service: "optillium-canadian-legal-mcp",
		transport: "streamable-http",
	});
});

app.post("/mcp", async (req: Request, res: Response) => {
	const server = createCanliiServer(apiKey, apiFetch);
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});

	res.on("close", () => {
		void transport.close();
		void server.close();
	});

	try {
		await server.connect(transport);
		await transport.handleRequest(req, res, req.body);
	} catch (error: unknown) {
		console.error("Error handling MCP request:", error);

		if (!res.headersSent) {
			res.status(500).json({
				jsonrpc: "2.0",
				error: {
					code: -32603,
					message: "Internal server error",
				},
				id: null,
			});
		}
	}
});

function methodNotAllowed(_req: Request, res: Response): void {
	res.status(405).json({
		jsonrpc: "2.0",
		error: {
			code: -32000,
			message: "Method not allowed.",
		},
		id: null,
	});
}

app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

const httpServer = app.listen(port, host, () => {
	console.log(
		`Optillium Canadian Legal MCP listening at http://${host}:${port}/mcp`,
	);
});

httpServer.on("error", (error: Error) => {
	console.error("HTTP server error:", error);
	process.exitCode = 1;
});

function shutdown(signal: string): void {
	console.log(`Received ${signal}; shutting down HTTP server`);

	httpServer.close((error?: Error) => {
		if (error) {
			console.error("Error closing HTTP server:", error);
			process.exit(1);
		}

		process.exit(0);
	});
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
