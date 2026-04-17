import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FacebookGraphClient } from "../services/api-client.js";
import {
  AdAccountIdSchema,
  FieldsSchema,
  LimitSchema,
  FilteringSchema,
  AfterCursorSchema,
  AutoPaginateSchema,
} from "../schemas/common.js";

const DEFAULT_CAMPAIGN_FIELDS =
  "id,name,status,objective,daily_budget,lifetime_budget,budget_remaining,buying_type,bid_strategy,created_time,updated_time,start_time,stop_time,effective_status,configured_status,spend_cap";
const DEFAULT_ADSET_FIELDS =
  "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,budget_remaining,bid_amount,bid_strategy,billing_event,optimization_goal,targeting,start_time,end_time,created_time,updated_time,promoted_object";
const DEFAULT_AD_FIELDS =
  "id,name,adset_id,campaign_id,status,effective_status,creative{id,name,thumbnail_url,object_story_spec,asset_feed_spec},created_time,updated_time,tracking_specs,conversion_specs";

function buildListParams(params: {
  fields?: string[];
  filtering?: Array<{ field: string; operator: string; value: string | number | string[] }>;
  after?: string;
  defaultFields: string;
}): Record<string, string | number | boolean> {
  const queryParams: Record<string, string | number | boolean> = {};
  queryParams.fields = params.fields
    ? params.fields.join(",")
    : params.defaultFields;
  if (params.filtering) {
    queryParams.filtering = JSON.stringify(params.filtering);
  }
  if (params.after) {
    queryParams.after = params.after;
  }
  return queryParams;
}

export function registerCampaignTools(
  server: McpServer,
  client: FacebookGraphClient
): void {
  // LIST CAMPAIGNS
  server.registerTool(
    "fb_list_campaigns",
    {
      title: "List Facebook Campaigns",
      description: `List campaigns for an ad account with full pagination support.
Default fields include: id, name, status, objective, budgets, bid_strategy, dates.
Use filtering to narrow results, e.g. [{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]`,
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
          fields: FieldsSchema,
          filtering: FilteringSchema,
          limit: LimitSchema,
          after: AfterCursorSchema,
          auto_paginate: AutoPaginateSchema,
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
        const queryParams = buildListParams({
          fields: params.fields,
          filtering: params.filtering,
          after: params.after,
          defaultFields: DEFAULT_CAMPAIGN_FIELDS,
        });
        const result = await client.requestList(
          `${params.ad_account_id}/campaigns`,
          queryParams,
          params.limit,
          params.auto_paginate
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

  // LIST ADSETS
  server.registerTool(
    "fb_list_adsets",
    {
      title: "List Facebook Ad Sets",
      description: `List ad sets. Provide campaign_id to get ad sets for one campaign, or ad_account_id for all ad sets in the account.
Default fields: id, name, status, budget, bid, targeting, optimization_goal, promoted_object, dates.`,
      inputSchema: z
        .object({
          campaign_id: z
            .string()
            .optional()
            .describe("Campaign ID to list ad sets for"),
          ad_account_id: z
            .string()
            .optional()
            .describe(
              "Ad account ID. Required if campaign_id is not provided."
            ),
          fields: FieldsSchema,
          filtering: FilteringSchema,
          limit: LimitSchema,
          after: AfterCursorSchema,
          auto_paginate: AutoPaginateSchema,
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
        const parentId = params.campaign_id || params.ad_account_id;
        if (!parentId) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Provide either campaign_id or ad_account_id.",
              },
            ],
          };
        }
        const queryParams = buildListParams({
          fields: params.fields,
          filtering: params.filtering,
          after: params.after,
          defaultFields: DEFAULT_ADSET_FIELDS,
        });
        const result = await client.requestList(
          `${parentId}/adsets`,
          queryParams,
          params.limit,
          params.auto_paginate
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

  // LIST ADS
  server.registerTool(
    "fb_list_ads",
    {
      title: "List Facebook Ads",
      description: `List ads. Provide adset_id, campaign_id, or ad_account_id as the parent.
Default fields: id, name, status, creative (with thumbnail), tracking_specs, dates.`,
      inputSchema: z
        .object({
          adset_id: z
            .string()
            .optional()
            .describe("Ad set ID to list ads for"),
          campaign_id: z
            .string()
            .optional()
            .describe("Campaign ID to list ads for"),
          ad_account_id: z
            .string()
            .optional()
            .describe("Ad account ID to list all ads"),
          fields: FieldsSchema,
          filtering: FilteringSchema,
          limit: LimitSchema,
          after: AfterCursorSchema,
          auto_paginate: AutoPaginateSchema,
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
        const parentId =
          params.adset_id || params.campaign_id || params.ad_account_id;
        if (!parentId) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Provide adset_id, campaign_id, or ad_account_id.",
              },
            ],
          };
        }
        const queryParams = buildListParams({
          fields: params.fields,
          filtering: params.filtering,
          after: params.after,
          defaultFields: DEFAULT_AD_FIELDS,
        });
        const result = await client.requestList(
          `${parentId}/ads`,
          queryParams,
          params.limit,
          params.auto_paginate
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

  // GET CAMPAIGN DETAILS
  server.registerTool(
    "fb_get_campaign_details",
    {
      title: "Get Campaign Details",
      description:
        "Get detailed information about a specific campaign by ID.",
      inputSchema: z
        .object({
          campaign_id: z.string().describe("Campaign ID"),
          fields: FieldsSchema,
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
        const fields = params.fields
          ? params.fields.join(",")
          : DEFAULT_CAMPAIGN_FIELDS;
        const result = await client.request(params.campaign_id, { fields });
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

  // GET ADSET DETAILS
  server.registerTool(
    "fb_get_adset_details",
    {
      title: "Get Ad Set Details",
      description:
        "Get detailed information about a specific ad set by ID.",
      inputSchema: z
        .object({
          adset_id: z.string().describe("Ad set ID"),
          fields: FieldsSchema,
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
        const fields = params.fields
          ? params.fields.join(",")
          : DEFAULT_ADSET_FIELDS;
        const result = await client.request(params.adset_id, { fields });
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

  // GET AD DETAILS
  server.registerTool(
    "fb_get_ad_details",
    {
      title: "Get Ad Details",
      description:
        "Get detailed information about a specific ad by ID, including creative details.",
      inputSchema: z
        .object({
          ad_id: z.string().describe("Ad ID"),
          fields: FieldsSchema,
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
        const fields = params.fields
          ? params.fields.join(",")
          : DEFAULT_AD_FIELDS;
        const result = await client.request(params.ad_id, { fields });
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
