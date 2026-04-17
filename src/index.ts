#!/usr/bin/env node
/**
 * Facebook Ads Pro MCP Server
 *
 * Full Graph API control with pagination, sorting, filtering, batch requests,
 * targeting search, creative metrics, and rate limit monitoring.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FacebookGraphClient } from "./services/api-client.js";
import { registerInsightsTools } from "./tools/insights.js";
import { registerCampaignTools } from "./tools/campaigns.js";
import { registerTargetingTools } from "./tools/targeting.js";
import { registerAccountTools } from "./tools/account.js";
import { registerMutationTools } from "./tools/mutations.js";
import fs from "fs";
import path from "path";

function loadEnvFile(): void {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // .env file is optional
  }
}

async function main(): Promise<void> {
  await loadEnvFile();

  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!accessToken) {
    console.error(
      "ERROR: FACEBOOK_ACCESS_TOKEN environment variable is required."
    );
    console.error("Set it in .env or export it before running this server.");
    process.exit(1);
  }

  const client = new FacebookGraphClient(accessToken);

  const server = new McpServer({
    name: "facebook-ads-pro-mcp-server",
    version: "1.0.0",
  });

  // Register all tool groups
  registerInsightsTools(server, client);
  registerCampaignTools(server, client);
  registerTargetingTools(server, client);
  registerAccountTools(server, client);
  registerMutationTools(server, client);

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Facebook Ads Pro MCP server running via stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
