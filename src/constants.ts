export const GRAPH_API_VERSION = "v22.0";
export const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
export const CHARACTER_LIMIT = 50000;
export const DEFAULT_INSIGHTS_FIELDS = [
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "reach",
  "frequency",
  "actions",
  "cost_per_action_type",
  "conversions",
  "cost_per_conversion",
  "conversion_values",
  "purchase_roas",
  "outbound_clicks",
  "inline_link_clicks",
  "inline_link_click_ctr",
];

export const VIDEO_METRICS_FIELDS = [
  "video_play_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p95_watched_actions",
  "video_p100_watched_actions",
  "video_30_sec_watched_actions",
  "video_avg_time_watched_actions",
];

export const QUALITY_RANKING_FIELDS = [
  "quality_ranking",
  "engagement_rate_ranking",
  "conversion_rate_ranking",
];
