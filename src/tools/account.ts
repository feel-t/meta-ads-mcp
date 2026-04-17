import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FacebookGraphClient } from "../services/api-client.js";
import {
  AdAccountIdSchema,
  FieldsSchema,
  LimitSchema,
  AfterCursorSchema,
  AutoPaginateSchema,
} from "../schemas/common.js";

export function registerAccountTools(
  server: McpServer,
  client: FacebookGraphClient
): void {
  // LIST AD ACCOUNTS
  server.registerTool(
    "fb_list_ad_accounts",
    {
      title: "List Ad Accounts",
      description:
        "List all Facebook ad accounts the token has access to. Shows account ID, name, status, currency, timezone, spend cap.",
      inputSchema: z
        .object({
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
        const fields =
          params.fields?.join(",") ||
          "id,name,account_id,account_status,currency,timezone_name,spend_cap,amount_spent,balance,business_name,business,funding_source_details";
        const result = await client.requestList("me/adaccounts", { fields });
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

  // GET AD ACCOUNT DETAILS
  server.registerTool(
    "fb_get_ad_account_details",
    {
      title: "Get Ad Account Details",
      description:
        "Get detailed information about a specific ad account including billing, spend limits, and business info.",
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
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
        const fields =
          params.fields?.join(",") ||
          "id,name,account_id,account_status,age,currency,timezone_name,timezone_offset_hours_utc,spend_cap,amount_spent,balance,business_name,business,funding_source_details,disable_reason,created_time,end_advertiser,owner,min_campaign_group_spend_cap,is_prepay_account";
        const result = await client.request(params.ad_account_id, { fields });
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

  // LIST CUSTOM AUDIENCES
  server.registerTool(
    "fb_list_custom_audiences",
    {
      title: "List Custom Audiences",
      description:
        "List custom audiences for an ad account. Shows name, size, type, and delivery status.",
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
          fields: FieldsSchema,
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
        const fields =
          params.fields?.join(",") ||
          "id,name,approximate_count,subtype,delivery_status,operation_status,data_source,description,retention_days,lookalike_spec,time_created,time_updated";
        const result = await client.requestList(
          `${params.ad_account_id}/customaudiences`,
          { fields },
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

  // LIST PIXELS
  server.registerTool(
    "fb_list_pixels",
    {
      title: "List Facebook Pixels",
      description: "List tracking pixels for an ad account.",
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
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
        const fields =
          params.fields?.join(",") ||
          "id,name,code,creation_time,last_fired_time,is_created_by_app,data_use_setting,first_party_cookie_status";
        const result = await client.requestList(
          `${params.ad_account_id}/adspixels`,
          { fields }
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

  // LIST AD CREATIVES
  server.registerTool(
    "fb_list_ad_creatives",
    {
      title: "List Ad Creatives",
      description:
        "List ad creatives for an account or specific ad. Shows creative spec, thumbnails, and story details.",
      inputSchema: z
        .object({
          ad_account_id: z
            .string()
            .optional()
            .describe("Ad account ID to list all creatives"),
          ad_id: z
            .string()
            .optional()
            .describe("Ad ID to get its specific creative"),
          fields: FieldsSchema,
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
        const parentId = params.ad_id || params.ad_account_id;
        if (!parentId) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Provide either ad_account_id or ad_id.",
              },
            ],
          };
        }
        const fields =
          params.fields?.join(",") ||
          "id,name,status,thumbnail_url,object_story_spec,asset_feed_spec,image_url,video_id,call_to_action_type,url_tags";
        const endpoint = params.ad_id
          ? `${params.ad_id}/adcreatives`
          : `${params.ad_account_id}/adcreatives`;
        const result = await client.requestList(
          endpoint,
          { fields },
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

  // LIST AD IMAGES
  server.registerTool(
    "fb_list_ad_images",
    {
      title: "List Ad Images",
      description: "List uploaded images for an ad account with hash and URLs.",
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
          limit: LimitSchema,
          after: AfterCursorSchema,
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
          `${params.ad_account_id}/adimages`,
          {
            fields:
              "id,name,hash,url,url_128,permalink_url,width,height,created_time,updated_time,status",
          },
          params.limit
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

  // LIST AD VIDEOS
  server.registerTool(
    "fb_list_ad_videos",
    {
      title: "List Ad Videos",
      description:
        "List uploaded videos for an ad account with thumbnails and processing status.",
      inputSchema: z
        .object({
          ad_account_id: AdAccountIdSchema,
          limit: LimitSchema,
          after: AfterCursorSchema,
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
          `${params.ad_account_id}/advideos`,
          {
            fields:
              "id,title,description,length,source,picture,permalink_url,created_time,updated_time,status",
          },
          params.limit
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

  // LIST PAGES
  server.registerTool(
    "fb_list_pages",
    {
      title: "List Facebook Pages",
      description:
        "List Facebook pages the token has access to. Needed to get page_id for creatives.",
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const result = await client.requestList("me/accounts", {
          fields: "id,name,category,fan_count,verification_status,link",
        });
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
}
