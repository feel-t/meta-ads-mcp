import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FacebookGraphClient } from "../services/api-client.js";
import { AdAccountIdSchema } from "../schemas/common.js";

const StatusSchema = z
  .enum(["ACTIVE", "PAUSED"])
  .default("PAUSED")
  .describe("Status (default: PAUSED)");

const UpdateStatusSchema = z
  .enum(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"])
  .optional()
  .describe("New status. WARNING: DELETED is irreversible.");

function successResponse(body: unknown, rateLimit?: unknown) {
  const result = rateLimit ? { ...toObj(body), _rate_limit: rateLimit } : body;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

function errorResponse(error: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
  };
}

function toObj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : { result: v };
}

/** Build a params record for a POST, stringifying objects/arrays. */
function buildPostParams(
  fields: Record<string, unknown>
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      params[key] = value;
    } else {
      params[key] = JSON.stringify(value);
    }
  }
  return params;
}

export function registerMutationTools(
  server: McpServer,
  client: FacebookGraphClient
): void {
  // ─── TOOL 1: CREATE CAMPAIGN ────────────────────────────────────────
  server.registerTool(
    "fb_create_campaign",
    {
      title: "Create Facebook Campaign",
      description: `Create a new campaign in an ad account.
Budgets are in CENTS (e.g. 5000 = $50.00).
Campaign is created as PAUSED by default — set status to ACTIVE to launch immediately.`,
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
          name: z.string().describe("Campaign name"),
          objective: z.enum([
            "OUTCOME_AWARENESS",
            "OUTCOME_ENGAGEMENT",
            "OUTCOME_LEADS",
            "OUTCOME_SALES",
            "OUTCOME_TRAFFIC",
          ]).describe("Campaign objective"),
          status: StatusSchema,
          special_ad_categories: z
            .array(z.string())
            .default([])
            .describe('Special ad categories. Use [] if none. Options: "EMPLOYMENT", "HOUSING", "CREDIT", "ISSUES_ELECTIONS_POLITICS"'),
          daily_budget: z
            .number()
            .int()
            .optional()
            .describe("Daily budget in cents (5000 = $50.00)"),
          lifetime_budget: z
            .number()
            .int()
            .optional()
            .describe("Lifetime budget in cents"),
          bid_strategy: z
            .enum([
              "LOWEST_COST_WITHOUT_CAP",
              "LOWEST_COST_WITH_BID_CAP",
              "COST_CAP",
            ])
            .optional()
            .describe("Bid strategy"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const postParams = buildPostParams({
          name: params.name,
          objective: params.objective,
          status: params.status,
          special_ad_categories: params.special_ad_categories,
          daily_budget: params.daily_budget,
          lifetime_budget: params.lifetime_budget,
          bid_strategy: params.bid_strategy,
        });
        const result = await client.request(
          `${params.ad_account_id}/campaigns`,
          postParams,
          "POST"
        );
        return successResponse(result.body, result.rateLimit);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ─── TOOL 2: CREATE ADSET ──────────────────────────────────────────
  server.registerTool(
    "fb_create_adset",
    {
      title: "Create Facebook Ad Set",
      description: `Create a new ad set within a campaign.
Budgets are in CENTS (e.g. 5000 = $50.00).
The targeting parameter accepts the full Facebook targeting spec as a JSON object.

Example targeting: {"geo_locations":{"countries":["US"]},"age_min":25,"age_max":65}
Example promoted_object (for OUTCOME_SALES): {"pixel_id":"858383818084326","custom_event_type":"PURCHASE"}`,
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
          campaign_id: z.string().describe("Parent campaign ID"),
          name: z.string().describe("Ad set name"),
          optimization_goal: z.enum([
            "OFFSITE_CONVERSIONS",
            "LINK_CLICKS",
            "IMPRESSIONS",
            "REACH",
            "VALUE",
            "LANDING_PAGE_VIEWS",
          ]).describe("Optimization goal"),
          targeting: z
            .record(z.unknown())
            .describe('Full targeting spec. Example: {"geo_locations":{"countries":["US"]},"age_min":25,"age_max":65}'),
          status: StatusSchema,
          billing_event: z
            .enum(["IMPRESSIONS", "LINK_CLICKS"])
            .default("IMPRESSIONS")
            .describe("Billing event (default: IMPRESSIONS)"),
          bid_strategy: z
            .enum([
              "LOWEST_COST_WITHOUT_CAP",
              "LOWEST_COST_WITH_BID_CAP",
              "COST_CAP",
            ])
            .optional()
            .describe("Bid strategy"),
          bid_amount: z
            .number()
            .int()
            .optional()
            .describe("Bid amount in cents. Required if bid_strategy is BID_CAP or COST_CAP."),
          daily_budget: z
            .number()
            .int()
            .optional()
            .describe("Daily budget in cents (5000 = $50.00)"),
          lifetime_budget: z
            .number()
            .int()
            .optional()
            .describe("Lifetime budget in cents"),
          promoted_object: z
            .record(z.unknown())
            .optional()
            .describe('For conversion campaigns. Example: {"pixel_id":"858383818084326","custom_event_type":"PURCHASE"}'),
          start_time: z.string().optional().describe("Start time (ISO 8601)"),
          end_time: z.string().optional().describe("End time (ISO 8601)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const postParams = buildPostParams({
          campaign_id: params.campaign_id,
          name: params.name,
          optimization_goal: params.optimization_goal,
          targeting: params.targeting,
          status: params.status,
          billing_event: params.billing_event,
          bid_strategy: params.bid_strategy,
          bid_amount: params.bid_amount,
          daily_budget: params.daily_budget,
          lifetime_budget: params.lifetime_budget,
          promoted_object: params.promoted_object,
          start_time: params.start_time,
          end_time: params.end_time,
        });
        const result = await client.request(
          `${params.ad_account_id}/adsets`,
          postParams,
          "POST"
        );
        return successResponse(result.body, result.rateLimit);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ─── TOOL 3: CREATE AD CREATIVE ────────────────────────────────────
  server.registerTool(
    "fb_create_ad_creative",
    {
      title: "Create Facebook Ad Creative",
      description: `Create an ad creative (image or video) for use in ads.

IMAGE example object_story_spec:
{
  "page_id": "100745681950404",
  "link_data": {
    "image_hash": "abc123",
    "link": "https://example.com",
    "message": "Ad copy text",
    "name": "Headline",
    "call_to_action": {"type": "LEARN_MORE"}
  }
}

VIDEO example object_story_spec:
{
  "page_id": "100745681950404",
  "video_data": {
    "video_id": "123456",
    "image_hash": "thumbnail_hash",
    "title": "Headline",
    "message": "Ad copy text",
    "call_to_action": {
      "type": "LEARN_MORE",
      "value": {"link": "https://example.com"}
    }
  }
}`,
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
          name: z.string().describe("Creative name (typically the filename)"),
          page_id: z.string().describe("Facebook Page ID"),
          object_story_spec: z
            .record(z.unknown())
            .describe("The creative spec — see description for IMAGE and VIDEO examples"),
          url_tags: z
            .string()
            .optional()
            .describe('UTM parameters. Example: "utm_source=facebook&utm_medium=paid"'),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const postParams = buildPostParams({
          name: params.name,
          object_story_spec: params.object_story_spec,
          url_tags: params.url_tags,
        });
        const result = await client.request(
          `${params.ad_account_id}/adcreatives`,
          postParams,
          "POST"
        );
        return successResponse(result.body, result.rateLimit);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ─── TOOL 4: CREATE AD ─────────────────────────────────────────────
  server.registerTool(
    "fb_create_ad",
    {
      title: "Create Facebook Ad",
      description: `Create an ad by attaching a creative to an ad set. Final step in the campaign creation flow.
The creative_id comes from a prior fb_create_ad_creative call.
tracking_specs example: [{"action.type":["offsite_conversion"],"fb_pixel":["858383818084326"]}]`,
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
          adset_id: z.string().describe("Target ad set ID"),
          name: z.string().describe("Ad name (typically the filename)"),
          creative_id: z.string().describe("Creative ID from fb_create_ad_creative"),
          status: StatusSchema,
          tracking_specs: z
            .array(z.record(z.unknown()))
            .optional()
            .describe('Pixel tracking. Example: [{"action.type":["offsite_conversion"],"fb_pixel":["858383818084326"]}]'),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const postParams = buildPostParams({
          adset_id: params.adset_id,
          name: params.name,
          creative: { creative_id: params.creative_id },
          status: params.status,
          tracking_specs: params.tracking_specs,
        });
        const result = await client.request(
          `${params.ad_account_id}/ads`,
          postParams,
          "POST"
        );
        return successResponse(result.body, result.rateLimit);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ─── TOOL 5: UPDATE CAMPAIGN ────────────────────────────────────────
  server.registerTool(
    "fb_update_campaign",
    {
      title: "Update Facebook Campaign",
      description: `Update an existing campaign's name, status, or budget.
Budgets are in CENTS (e.g. 5000 = $50.00).
WARNING: Setting status to DELETED is irreversible.`,
      inputSchema: z
        .object({
          campaign_id: z.string().describe("Campaign ID to update"),
          name: z.string().optional().describe("New campaign name"),
          status: UpdateStatusSchema,
          daily_budget: z.number().int().optional().describe("New daily budget in cents"),
          lifetime_budget: z.number().int().optional().describe("New lifetime budget in cents"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const postParams = buildPostParams({
          name: params.name,
          status: params.status,
          daily_budget: params.daily_budget,
          lifetime_budget: params.lifetime_budget,
        });
        const result = await client.request(
          params.campaign_id,
          postParams,
          "POST"
        );
        return successResponse(result.body, result.rateLimit);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ─── TOOL 6: UPDATE ADSET ──────────────────────────────────────────
  server.registerTool(
    "fb_update_adset",
    {
      title: "Update Facebook Ad Set",
      description: `Update an existing ad set's name, status, budget, targeting, or bid.
Budgets and bid_amount are in CENTS.
WARNING: Setting status to DELETED is irreversible.`,
      inputSchema: z
        .object({
          adset_id: z.string().describe("Ad set ID to update"),
          name: z.string().optional().describe("New ad set name"),
          status: UpdateStatusSchema,
          daily_budget: z.number().int().optional().describe("New daily budget in cents"),
          targeting: z
            .record(z.unknown())
            .optional()
            .describe("Full replacement targeting spec"),
          bid_amount: z.number().int().optional().describe("New bid amount in cents"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const postParams = buildPostParams({
          name: params.name,
          status: params.status,
          daily_budget: params.daily_budget,
          targeting: params.targeting,
          bid_amount: params.bid_amount,
        });
        const result = await client.request(
          params.adset_id,
          postParams,
          "POST"
        );
        return successResponse(result.body, result.rateLimit);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ─── TOOL 7: UPDATE AD ─────────────────────────────────────────────
  server.registerTool(
    "fb_update_ad",
    {
      title: "Update Facebook Ad",
      description: `Update an existing ad's name, status, or creative.
WARNING: Setting status to DELETED is irreversible.`,
      inputSchema: z
        .object({
          ad_id: z.string().describe("Ad ID to update"),
          name: z.string().optional().describe("New ad name"),
          status: UpdateStatusSchema,
          creative_id: z
            .string()
            .optional()
            .describe("New creative ID to swap onto this ad"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const fields: Record<string, unknown> = {};
        if (params.name !== undefined) fields.name = params.name;
        if (params.status !== undefined) fields.status = params.status;
        if (params.creative_id !== undefined) {
          fields.creative = { creative_id: params.creative_id };
        }
        const postParams = buildPostParams(fields);
        const result = await client.request(
          params.ad_id,
          postParams,
          "POST"
        );
        return successResponse(result.body, result.rateLimit);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ─── TOOL 8: COPY ADSET ────────────────────────────────────────────
  server.registerTool(
    "fb_copy_adset",
    {
      title: "Copy Facebook Ad Set",
      description: `Duplicate an existing ad set with all its settings (targeting, budget, optimization).
If include_ads is true, all ads in the ad set are also duplicated.`,
      inputSchema: z
        .object({
          adset_id: z.string().describe("Source ad set ID to copy"),
          new_name: z.string().optional().describe("Name for the copy. If omitted, appends '- Copy'."),
          status: StatusSchema,
          include_ads: z
            .boolean()
            .default(false)
            .describe("If true, also copy all ads in the ad set (deep copy)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const postFields: Record<string, unknown> = {
          status_option: params.status,
        };

        if (params.new_name) {
          postFields.rename_options = { rename_suffix: "" };
        } else {
          postFields.rename_options = { rename_suffix: " - Copy" };
        }

        if (params.include_ads) {
          postFields.deep_copy = true;
        }

        const postParams = buildPostParams(postFields);
        const result = await client.request(
          `${params.adset_id}/copies`,
          postParams,
          "POST"
        );

        // If a new_name was given, update the copy with the desired name
        const copyId =
          (result.body as Record<string, unknown>)?.copied_adset_id ||
          (result.body as Record<string, unknown>)?.id;

        if (params.new_name && copyId) {
          await client.request(
            String(copyId),
            buildPostParams({ name: params.new_name }),
            "POST"
          );
        }

        return successResponse(result.body, result.rateLimit);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ─── TOOL 9: COPY AD ───────────────────────────────────────────────
  server.registerTool(
    "fb_copy_ad",
    {
      title: "Copy Facebook Ad",
      description: `Duplicate an existing ad. Can optionally move the copy to a different ad set or swap in a new creative.`,
      inputSchema: z
        .object({
          ad_id: z.string().describe("Source ad ID to copy"),
          new_name: z.string().optional().describe("Name for the copy"),
          new_adset_id: z
            .string()
            .optional()
            .describe("Move the copy to a different ad set (optional)"),
          new_creative_id: z
            .string()
            .optional()
            .describe("Use a different creative for the copy (optional)"),
          status: StatusSchema,
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const postFields: Record<string, unknown> = {
          status_option: params.status,
        };

        if (params.new_name) {
          postFields.rename_options = { rename_suffix: "" };
        } else {
          postFields.rename_options = { rename_suffix: " - Copy" };
        }

        if (params.new_adset_id) {
          postFields.adset_id = params.new_adset_id;
        }

        const postParams = buildPostParams(postFields);
        const result = await client.request(
          `${params.ad_id}/copies`,
          postParams,
          "POST"
        );

        const copyId =
          (result.body as Record<string, unknown>)?.copied_ad_id ||
          (result.body as Record<string, unknown>)?.id;

        // Apply name and/or creative changes to the copy
        if (copyId && (params.new_name || params.new_creative_id)) {
          const updateFields: Record<string, unknown> = {};
          if (params.new_name) updateFields.name = params.new_name;
          if (params.new_creative_id) {
            updateFields.creative = { creative_id: params.new_creative_id };
          }
          await client.request(
            String(copyId),
            buildPostParams(updateFields),
            "POST"
          );
        }

        return successResponse(result.body, result.rateLimit);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
