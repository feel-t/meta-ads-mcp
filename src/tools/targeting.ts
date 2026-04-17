import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FacebookGraphClient } from "../services/api-client.js";
import { AdAccountIdSchema, LimitSchema } from "../schemas/common.js";

export function registerTargetingTools(
  server: McpServer,
  client: FacebookGraphClient
): void {
  // SEARCH INTERESTS
  server.registerTool(
    "fb_search_interests",
    {
      title: "Search Facebook Interests",
      description: `Search for targetable interests by keyword. Returns interest ID, name, path, topic, description, and audience_size_lower/upper_bound.
Use these IDs in targeting.flexible_spec[].interests when creating ad sets.`,
      inputSchema: z
        .object({
          query: z.string().min(1).describe("Search keyword (e.g. 'yoga', 'coffee')"),
          limit: z.number().int().min(1).max(1000).default(100).describe("Max results (default 100)"),
          locale: z.string().optional().describe("Locale code (e.g. 'en_US')"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number | boolean> = {
          type: "adinterest",
          q: params.query,
          limit: params.limit,
        };
        if (params.locale) queryParams.locale = params.locale;

        const result = await client.request("search", queryParams);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result.body, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // VALIDATE INTERESTS
  server.registerTool(
    "fb_validate_interests",
    {
      title: "Validate Facebook Interests",
      description: `Validate a list of interest names. Returns whether each exists, its ID, and audience size.
Useful for verifying interest names before using them in targeting.`,
      inputSchema: z
        .object({
          interest_list: z
            .array(z.string())
            .min(1)
            .max(50)
            .describe("Array of interest names to validate"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number | boolean> = {
          type: "adinterestvalid",
          interest_list: JSON.stringify(params.interest_list),
        };
        const result = await client.request("search", queryParams);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result.body, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // SUGGEST INTERESTS
  server.registerTool(
    "fb_suggest_interests",
    {
      title: "Suggest Related Interests",
      description: `Given a list of interest IDs, returns related interests with audience sizes.
Great for expanding targeting and discovering new audience segments.`,
      inputSchema: z
        .object({
          interest_list: z
            .array(z.string())
            .min(1)
            .max(50)
            .describe("Array of interest IDs to find suggestions for"),
          limit: z.number().int().min(1).max(1000).default(50).describe("Max suggestions"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number | boolean> = {
          type: "adinterestsuggestion",
          interest_list: JSON.stringify(params.interest_list),
          limit: params.limit,
        };
        const result = await client.request("search", queryParams);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result.body, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // SEARCH GEOLOCATIONS
  server.registerTool(
    "fb_search_geolocations",
    {
      title: "Search Geolocations",
      description: `Search for targetable geographic locations (countries, regions, cities, zip codes).
Use the returned keys in targeting.geo_locations.`,
      inputSchema: z
        .object({
          query: z.string().min(1).describe("Location search query"),
          location_types: z
            .array(
              z.enum(["country", "region", "city", "zip", "geo_market", "electoral_district"])
            )
            .default(["country", "region", "city"])
            .describe("Location types to search"),
          limit: z.number().int().min(1).max(100).default(25).describe("Max results"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number | boolean> = {
          type: "adgeolocation",
          q: params.query,
          location_types: JSON.stringify(params.location_types),
          limit: params.limit,
        };
        const result = await client.request("search", queryParams);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result.body, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // SEARCH TARGETING CATEGORIES (behaviors, demographics)
  server.registerTool(
    "fb_search_targeting_categories",
    {
      title: "Search Targeting Categories",
      description: `Browse targetable behaviors, demographics, life events, industries, etc.
Class options: behaviors, demographics, life_events, industries, income, family_statuses, user_device, user_os, interests, work_positions, work_employers, education_schools, education_majors`,
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
          class: z
            .enum([
              "behaviors",
              "demographics",
              "life_events",
              "industries",
              "income",
              "family_statuses",
              "user_device",
              "user_os",
              "interests",
              "work_positions",
              "work_employers",
              "education_schools",
              "education_majors",
            ])
            .describe("Category class to browse"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const result = await client.requestList(
          `${params.ad_account_id}/targetingbrowse`,
          { class: params.class },
          500,
          true
        );
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // REACH ESTIMATE
  server.registerTool(
    "fb_get_reach_estimate",
    {
      title: "Get Reach Estimate",
      description: `Estimate audience size for a targeting spec. Returns daily reach estimate range.
Useful for validating targeting before creating ad sets.`,
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
          targeting_spec: z
            .record(z.unknown())
            .describe(
              'Targeting spec object. Example: {"geo_locations":{"countries":["US"]},"age_min":25,"age_max":54,"interests":[{"id":"6003139266461","name":"Yoga"}]}'
            ),
          optimization_goal: z
            .string()
            .optional()
            .describe("Optimization goal (e.g. LINK_CLICKS, OFFSITE_CONVERSIONS)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number | boolean> = {
          targeting_spec: JSON.stringify(params.targeting_spec),
        };
        if (params.optimization_goal) {
          queryParams.optimize_for = params.optimization_goal;
        }
        const result = await client.request(
          `${params.ad_account_id}/reachestimate`,
          queryParams
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result.body, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
