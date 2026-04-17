import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FacebookGraphClient } from "../services/api-client.js";
import {
  ObjectIdSchema,
  FieldsSchema,
  LimitSchema,
  DatePresetSchema,
  TimeRangeSchema,
  FilteringSchema,
  LevelSchema,
  SortSchema,
  AutoPaginateSchema,
  AfterCursorSchema,
  AdAccountIdSchema,
} from "../schemas/common.js";
import { DEFAULT_INSIGHTS_FIELDS } from "../constants.js";

const GetInsightsSchema = z
  .object({
    object_id: ObjectIdSchema,
    level: LevelSchema,
    fields: FieldsSchema,
    breakdowns: z
      .array(z.string())
      .optional()
      .describe(
        "Break results by dimensions: age, gender, country, placement, device_platform, etc."
      ),
    date_preset: DatePresetSchema,
    time_range: TimeRangeSchema,
    filtering: FilteringSchema,
    sort: SortSchema,
    limit: LimitSchema,
    action_attribution_windows: z
      .array(z.string())
      .optional()
      .describe(
        'Attribution windows. Example: ["1d_click", "7d_click", "28d_click", "1d_view"]'
      ),
    auto_paginate: AutoPaginateSchema,
    after: AfterCursorSchema,
  })
  .strict();

const BatchInsightsSchema = z
  .object({
    requests: z
      .array(
        z.object({
          object_id: z.string(),
          fields: z.array(z.string()).optional(),
          breakdowns: z.array(z.string()).optional(),
          date_preset: z.string().optional(),
          time_range: z
            .object({ since: z.string(), until: z.string() })
            .optional(),
          filtering: z
            .array(
              z.object({
                field: z.string(),
                operator: z.string(),
                value: z.union([z.string(), z.number(), z.array(z.string())]),
              })
            )
            .optional(),
          level: z.string().optional(),
          sort: z.array(z.string()).optional(),
          limit: z.number().optional(),
        })
      )
      .min(1)
      .max(50)
      .describe("Array of insight requests (1-50)"),
  })
  .strict();

const ComputeCreativeMetricsSchema = z
  .object({
    ad_id: z.string().describe("The ad ID to compute creative metrics for"),
    date_preset: DatePresetSchema,
    time_range: TimeRangeSchema,
  })
  .strict();

export function registerInsightsTools(
  server: McpServer,
  client: FacebookGraphClient
): void {
  server.registerTool(
    "fb_get_insights",
    {
      title: "Get Facebook Ads Insights",
      description: `Get performance metrics for campaigns, ad sets, or ads with FULL pagination, sorting, and filtering support.

Key features vs managed connector:
- limit parameter (1-500, default 100)
- sort parameter (e.g. ["spend_descending"])
- auto_paginate: true follows all pages automatically (up to 20 pages)
- filtering with field/operator/value
- action_attribution_windows support
- Returns _pagination metadata and _rate_limit info

Common fields: spend, impressions, clicks, ctr, cpc, cpm, reach, frequency, actions, cost_per_action_type, conversions, purchase_roas
Breakdown options: age, gender, country, region, placement, device_platform, platform_position, impression_device`,
      inputSchema: GetInsightsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const queryParams: Record<string, string | number | boolean> = {};
        const fields = params.fields || DEFAULT_INSIGHTS_FIELDS;
        queryParams.fields = fields.join(",");
        queryParams.level = params.level;

        if (params.time_range) {
          queryParams.time_range = JSON.stringify(params.time_range);
        } else {
          queryParams.date_preset = params.date_preset;
        }

        if (params.breakdowns) {
          queryParams.breakdowns = params.breakdowns.join(",");
        }
        if (params.filtering) {
          queryParams.filtering = JSON.stringify(params.filtering);
        }
        if (params.sort) {
          queryParams.sort = JSON.stringify(params.sort);
        }
        if (params.action_attribution_windows) {
          queryParams.action_attribution_windows = JSON.stringify(
            params.action_attribution_windows
          );
        }
        if (params.after) {
          queryParams.after = params.after;
        }

        const result = await client.requestList(
          `${params.object_id}/insights`,
          queryParams,
          params.limit,
          params.auto_paginate
        );

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
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

  server.registerTool(
    "fb_get_batch_insights",
    {
      title: "Batch Facebook Ads Insights",
      description: `Combine up to 50 insight requests into a single API call using Facebook's Batch API.
Each request specifies its own object_id, fields, breakdowns, date range, etc.
Returns an array of results matching input order.
Much faster than calling fb_get_insights 50 times sequentially.`,
      inputSchema: BatchInsightsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const batchRequests = params.requests.map((req) => {
          const queryParts: string[] = [];
          const fields = req.fields || DEFAULT_INSIGHTS_FIELDS;
          queryParts.push(`fields=${encodeURIComponent(fields.join(","))}`);

          if (req.time_range) {
            queryParts.push(
              `time_range=${encodeURIComponent(JSON.stringify(req.time_range))}`
            );
          } else if (req.date_preset) {
            queryParts.push(`date_preset=${req.date_preset}`);
          } else {
            queryParts.push("date_preset=last_7d");
          }

          if (req.level) queryParts.push(`level=${req.level}`);
          if (req.breakdowns)
            queryParts.push(`breakdowns=${req.breakdowns.join(",")}`);
          if (req.filtering)
            queryParts.push(
              `filtering=${encodeURIComponent(JSON.stringify(req.filtering))}`
            );
          if (req.sort)
            queryParts.push(
              `sort=${encodeURIComponent(JSON.stringify(req.sort))}`
            );
          if (req.limit) queryParts.push(`limit=${req.limit}`);

          return {
            method: "GET",
            relative_url: `${req.object_id}/insights?${queryParts.join("&")}`,
          };
        });

        const result = await client.batchRequest(batchRequests);

        const parsedResults = result.body.map(
          (resp: { code: number; body: string }, idx: number) => {
            try {
              return {
                request_index: idx,
                object_id: params.requests[idx].object_id,
                status: resp.code,
                data: JSON.parse(resp.body),
              };
            } catch {
              return {
                request_index: idx,
                object_id: params.requests[idx].object_id,
                status: resp.code,
                error: "Failed to parse response",
                raw: resp.body,
              };
            }
          }
        );

        const output = {
          results: parsedResults,
          _rate_limit: result.rateLimit,
        };

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(output, null, 2) },
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

  server.registerTool(
    "fb_compute_creative_metrics",
    {
      title: "Compute Creative Metrics",
      description: `Compute hook rate, hold rate, completion rate, and quality rankings for a specific ad.
Returns:
- hook_rate: video_p25_watched / impressions (% who watched 25%)
- hold_rate: video_p75_watched / video_p25_watched (% retention 25%→75%)
- completion_rate: video_p100_watched / video_play_actions
- quality_ranking, engagement_rate_ranking, conversion_rate_ranking
- ctr, cpc, cpm, frequency`,
      inputSchema: ComputeCreativeMetricsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const fields = [
          "impressions",
          "clicks",
          "spend",
          "ctr",
          "cpc",
          "cpm",
          "reach",
          "frequency",
          "video_play_actions",
          "video_p25_watched_actions",
          "video_p50_watched_actions",
          "video_p75_watched_actions",
          "video_p95_watched_actions",
          "video_p100_watched_actions",
          "video_30_sec_watched_actions",
          "video_avg_time_watched_actions",
          "quality_ranking",
          "engagement_rate_ranking",
          "conversion_rate_ranking",
          "actions",
          "cost_per_action_type",
        ];

        const queryParams: Record<string, string | number | boolean> = {
          fields: fields.join(","),
          level: "ad",
        };

        if (params.time_range) {
          queryParams.time_range = JSON.stringify(params.time_range);
        } else {
          queryParams.date_preset = params.date_preset;
        }

        const result = await client.request<{ data: Record<string, unknown>[] }>(
          `${params.ad_id}/insights`,
          queryParams
        );

        const row = result.body.data?.[0];
        if (!row) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No insight data found for this ad in the selected date range.",
              },
            ],
          };
        }

        const getActionValue = (
          actions: Array<{ action_type: string; value: string }> | undefined,
          type: string
        ): number => {
          if (!actions) return 0;
          const action = actions.find((a) => a.action_type === type);
          return action ? parseFloat(action.value) : 0;
        };

        const impressions = parseFloat(row.impressions as string) || 0;
        const videoPlays = getActionValue(
          row.video_play_actions as Array<{
            action_type: string;
            value: string;
          }>,
          "video_view"
        );
        const p25 = getActionValue(
          row.video_p25_watched_actions as Array<{
            action_type: string;
            value: string;
          }>,
          "video_view"
        );
        const p50 = getActionValue(
          row.video_p50_watched_actions as Array<{
            action_type: string;
            value: string;
          }>,
          "video_view"
        );
        const p75 = getActionValue(
          row.video_p75_watched_actions as Array<{
            action_type: string;
            value: string;
          }>,
          "video_view"
        );
        const p100 = getActionValue(
          row.video_p100_watched_actions as Array<{
            action_type: string;
            value: string;
          }>,
          "video_view"
        );

        const metrics = {
          ad_id: params.ad_id,
          impressions,
          spend: row.spend,
          ctr: row.ctr,
          cpc: row.cpc,
          cpm: row.cpm,
          frequency: row.frequency,
          hook_rate: impressions > 0 ? (p25 / impressions) * 100 : null,
          hold_rate: p25 > 0 ? (p75 / p25) * 100 : null,
          completion_rate: videoPlays > 0 ? (p100 / videoPlays) * 100 : null,
          video_plays: videoPlays,
          p25_watched: p25,
          p50_watched: p50,
          p75_watched: p75,
          p100_watched: p100,
          quality_ranking: row.quality_ranking,
          engagement_rate_ranking: row.engagement_rate_ranking,
          conversion_rate_ranking: row.conversion_rate_ranking,
          _rate_limit: result.rateLimit,
        };

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(metrics, null, 2) },
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
