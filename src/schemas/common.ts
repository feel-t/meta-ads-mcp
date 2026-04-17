import { z } from "zod";

export const AdAccountIdSchema = z
  .string()
  .describe("Ad account ID (format: act_XXXXXXXXXX)");

export const ObjectIdSchema = z
  .string()
  .describe("Campaign, ad set, ad, or account ID");

export const FieldsSchema = z
  .array(z.string())
  .optional()
  .describe("Fields to return. If omitted, defaults are used.");

export const LimitSchema = z
  .number()
  .int()
  .min(1)
  .max(500)
  .default(100)
  .describe("Maximum results per page (1-500, default: 100)");

export const DatePresetSchema = z
  .enum([
    "today",
    "yesterday",
    "last_3d",
    "last_7d",
    "last_14d",
    "last_28d",
    "last_30d",
    "last_90d",
    "this_month",
    "last_month",
    "lifetime",
  ])
  .default("last_7d")
  .describe("Date range preset (default: last_7d)");

export const TimeRangeSchema = z
  .object({
    since: z.string().describe("Start date YYYY-MM-DD"),
    until: z.string().describe("End date YYYY-MM-DD"),
  })
  .optional()
  .describe("Custom date range. Overrides date_preset if provided.");

export const FilteringSchema = z
  .array(
    z.object({
      field: z.string(),
      operator: z.string(),
      value: z.union([z.string(), z.number(), z.array(z.string())]),
    })
  )
  .optional()
  .describe(
    'Filtering rules. Example: [{"field":"spend","operator":"GREATER_THAN","value":"0"}]'
  );

export const AfterCursorSchema = z
  .string()
  .optional()
  .describe("Cursor for next page (from _pagination.next_cursor)");

export const LevelSchema = z
  .enum(["account", "campaign", "adset", "ad"])
  .default("ad")
  .describe("Reporting level (default: ad)");

export const SortSchema = z
  .array(z.string())
  .optional()
  .describe(
    'Sort order. Example: ["spend_descending", "impressions_descending"]'
  );

export const AutoPaginateSchema = z
  .boolean()
  .default(false)
  .describe(
    "If true, automatically follows all cursor pages (up to 20 pages max). Use for complete data pulls."
  );
