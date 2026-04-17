# meta-ads-mcp

**A production-grade MCP server for the Facebook / Meta Marketing API.**

Connect Claude (or any MCP-compatible AI) directly to your Meta Ads account. Read campaigns, analyze performance, research audiences, and create ads — all through natural language, with the full power of Graph API v22.0 underneath.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-1.6.1-blue)](https://github.com/modelcontextprotocol/sdk)
[![Meta API](https://img.shields.io/badge/Meta_Graph_API-v22.0-1877F2)](https://developers.facebook.com/docs/marketing-api)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## What it does

31 tools across 5 domains — covering the entire Meta Ads lifecycle from reading your account structure to creating and launching campaigns.

| Domain | Tools | What you can do |
|--------|-------|-----------------|
| **Campaigns** | 6 | List & inspect campaigns, ad sets, ads |
| **Account** | 8 | Account details, pixels, pages, audiences, creatives, images, videos |
| **Insights** | 3 | Performance metrics, batch analytics, creative scoring |
| **Targeting** | 6 | Interest research, geo search, audience size estimation |
| **Mutations** | 9 | Create & update campaigns, ad sets, ads, creatives; duplicate objects |

---

## Requirements

- Node.js ≥ 18
- A Meta access token with `ads_read`, `ads_management`, `business_management` permissions
- Claude Desktop (or any MCP-compatible client)

---

## Installation

```bash
git clone https://github.com/feel-t/meta-ads-mcp.git
cd meta-ads-mcp
npm install
npm run build
npm link          # registers global command: meta-ads-mcp
```

---

## Configuration

**1. Create your `.env` file:**

```bash
cp .env.example .env
```

Edit `.env`:

```env
FACEBOOK_ACCESS_TOKEN=your_access_token_here
FACEBOOK_AD_ACCOUNT_ID=act_your_account_id_here   # optional default
```

Get your token at [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/).  
Required permissions: `ads_read`, `ads_management`, `business_management`.

> For production use, create a [System User Token](https://business.facebook.com/settings/system-users) — it doesn't expire.

**2. Add to Claude Desktop config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "facebook-ads": {
      "command": "meta-ads-mcp"
    }
  }
}
```

**3. Restart Claude Desktop.** The server connects automatically via stdio.

---

## Tools Reference

### 📊 Insights & Analytics

#### `fb_get_insights`
Pull performance metrics for any campaign, ad set, or ad.

```
Default fields: spend, impressions, clicks, CTR, CPC, CPM, reach,
                frequency, actions, conversions, ROAS, outbound_clicks
Video fields:   p25/p50/p75/p95/p100 video views, 3s views, avg watch time
Quality fields: quality_ranking, engagement_rate_ranking, conversion_rate_ranking

Breakdowns: age, gender, country, placement, device, publisher_platform
Date presets: today, yesterday, last_7d, last_14d, last_30d, last_90d,
              this_month, last_month, this_quarter
```

#### `fb_get_batch_insights`
Fetch metrics for up to 50 objects in a single HTTP call using the Facebook Batch API. 50× faster than sequential requests when doing account-wide analysis.

#### `fb_compute_creative_metrics`
Compute creative performance scores from raw video metrics (calculated client-side, no extra API call):

| Metric | Formula | What it measures |
|--------|---------|-----------------|
| `hook_rate` | 3s views ÷ impressions | Did the first 3 seconds stop the scroll? |
| `hold_rate` | ThruPlays ÷ 3s views | Did people keep watching after the hook? |
| `completion_rate` | 100% views ÷ impressions | Did people watch to the end? |

---

### 🎯 Targeting Research

#### `fb_search_interests`
Search Facebook's interest taxonomy by keyword. Returns interest IDs, estimated audience sizes, and topic category paths.

#### `fb_validate_interests`
Check whether interest IDs are still active. Facebook deprecates interests over time — use this to catch silently broken targeting before launch.

#### `fb_suggest_interests`
Get related interests from a seed keyword. Use for audience expansion and discovery.

#### `fb_search_geolocations`
Search countries, regions, cities, and zip codes. Returns the location keys required for targeting specs.

#### `fb_search_targeting_categories`
Browse Facebook's full targeting taxonomy: behaviors, demographics, life events, and more.

#### `fb_get_reach_estimate`
Estimate potential reach for a targeting spec before spending a dollar. Returns min/max reach and estimated daily results.

---

### 📁 Campaign Structure

#### `fb_list_campaigns`
List all campaigns in an account. Filter by status (`ACTIVE`, `PAUSED`, `ARCHIVED`). Auto-paginates through all results.

#### `fb_list_adsets`
List ad sets within a campaign. Returns targeting summary, budget, and optimization goal.

#### `fb_list_ads`
List ads within an ad set or campaign. Returns creative ID, delivery status, and approval status.

#### `fb_get_campaign_details`
Full campaign object: objective, budget, dates, bid strategy, special ad categories.

#### `fb_get_adset_details`
Full ad set object: targeting spec, bid amount, optimization goal, delivery schedule, attribution window.

#### `fb_get_ad_details`
Full ad object: creative, tracking specs, URL parameters, status history.

---

### 🏢 Account

#### `fb_list_ad_accounts`
List all ad accounts the token has access to. Useful for agencies managing multiple clients.

#### `fb_get_ad_account_details`
Balance, spend limits, currency, timezone, billing info, account status.

#### `fb_list_pixels`
All conversion pixels attached to the account (IDs required for purchase-optimized ad sets).

#### `fb_list_pages`
Facebook Pages connected to the account (required for creating ads).

#### `fb_list_custom_audiences`
Custom and Lookalike audiences: name, size, type, and delivery status.

#### `fb_list_ad_images`
Uploaded images with hash values (hashes are required when building ad creatives).

#### `fb_list_ad_videos`
Video library: duration, thumbnail URL, processing status.

#### `fb_list_ad_creatives`
All saved creatives: headline, body, call-to-action, destination URL.

---

### ✏️ Create & Update

> **All create tools default to `status: "PAUSED"`** — set to `"ACTIVE"` to launch immediately.  
> **Budgets are in cents** — `5000` = $50.00.

#### `fb_create_campaign`
Create a campaign with objective, daily or lifetime budget, bid strategy, and special ad categories.

**Supported objectives:** `OUTCOME_AWARENESS` · `OUTCOME_ENGAGEMENT` · `OUTCOME_LEADS` · `OUTCOME_SALES` · `OUTCOME_TRAFFIC`

#### `fb_create_adset`
Create an ad set with full targeting spec, optimization goal, bid amount, and pixel/event for conversion tracking.

Example targeting:
```json
{
  "geo_locations": { "countries": ["US"] },
  "age_min": 25,
  "age_max": 45,
  "interests": [{ "id": "6003139266461", "name": "Fitness and wellness" }]
}
```

#### `fb_create_ad_creative`
Build a creative from an uploaded image (hash) or video (ID) with headline, body text, CTA button, and URL.

#### `fb_create_ad`
Create an ad by linking an ad set + creative. The ad inherits budget and targeting from its parent ad set.

#### `fb_update_campaign`
Change name, status, or budget on an existing campaign.

#### `fb_update_adset`
Update targeting, bid amount, budget, or status.

#### `fb_update_ad`
Change ad status (`ACTIVE`, `PAUSED`, `ARCHIVED`, `DELETED`) or swap the creative.

> ⚠️ `DELETED` is irreversible.

#### `fb_copy_ad`
Duplicate an ad into a different ad set. Preserves creative, tracking specs, and URL parameters.

#### `fb_copy_adset`
Duplicate an entire ad set (with all its ads) into a different campaign. Useful when scaling to new geos.

---

## Architecture

```
meta-ads-mcp/
├── src/
│   ├── index.ts                 # Server entry point, tool registration
│   ├── constants.ts             # API version (v22.0), default fields
│   ├── schemas/
│   │   └── common.ts            # Shared Zod schemas (IDs, dates, cursors)
│   ├── services/
│   │   └── api-client.ts        # FacebookGraphClient
│   │       ├── request()        # Single GET/POST with rate limit parsing
│   │       ├── requestList()    # Auto-pagination via cursor
│   │       └── batchRequest()   # Batch API (up to 50 requests per call)
│   └── tools/
│       ├── campaigns.ts         # Read: campaigns, ad sets, ads
│       ├── account.ts           # Read: account, pixels, audiences, assets
│       ├── insights.ts          # Analytics: metrics, batch, creative scoring
│       ├── targeting.ts         # Research: interests, geos, reach estimation
│       └── mutations.ts         # Write: create, update, copy
├── dist/                        # Compiled output (tsc → generated)
├── .env                         # Your secrets (never committed)
├── .env.example                 # Template
└── claude_desktop_config.example.json
```

### Key design decisions

**Auto-pagination** — `requestList()` follows cursor-based paging automatically. Pass `auto_paginate: false` to get only the first page and handle paging yourself.

**Batch API** — `fb_get_batch_insights` packs up to 50 Graph API requests into a single HTTP call. Analyzing all ads in a large campaign goes from minutes to seconds.

**Rate limit visibility** — Every response surfaces `x-business-use-case-usage` header data so you can see how close you are to your API quota.

**Write safety** — Mutation tools default to `status: "PAUSED"`. You explicitly opt into `ACTIVE`. Destructive operations (`DELETED`) show warnings in the tool description.

**Input validation** — All inputs are validated with Zod before any API call is made. Wrong types, invalid enums, and missing required fields fail fast with clear error messages.

---

## Example prompts

> Ask Claude naturally — it selects the right tool automatically.

```
"List all active campaigns in account act_123456789"

"Show me spend, ROAS, and CTR for the last 30 days broken down by country"

"What's the hook rate and completion rate for each ad in campaign 987654321?"

"Search for fitness and wellness interests, estimated audience 1M+ in the US"

"Estimate reach for women 28–45 in New York interested in yoga"

"Create a campaign called Q2_Retargeting with OUTCOME_SALES objective and $50/day budget"

"Copy ad set 111222333 into campaign 444555666"

"Pause all ads with CTR below 1% in the last 7 days"
```

---

## Development

```bash
npm run dev      # tsx watch mode — hot reload on file changes
npm run build    # compile TypeScript → dist/
npm run clean    # remove dist/
```

**Test without Claude Desktop:**

```bash
node test-live.mjs
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FACEBOOK_ACCESS_TOKEN` | ✅ Yes | Meta API access token |
| `FACEBOOK_AD_ACCOUNT_ID` | No | Default account ID (`act_XXXXXXXXX`) used when not passed per-request |

---

## Security

- `.env` and token files are in `.gitignore` — never committed
- Use a System User Token in production (doesn't expire, scoped to your business)
- Grant the token only the permissions it actually needs

---

## Contributing

PRs welcome. To add a new tool:

1. Add the Zod input schema + handler to the relevant `tools/*.ts` file
2. Set `readOnlyHint` / `destructiveHint` annotations correctly
3. Call the registration function from `src/index.ts`
4. Document the tool in this README

---

## License

MIT — use freely, attribution appreciated.

---

Built with [MCP SDK](https://github.com/modelcontextprotocol/sdk) · [Meta Marketing API v22.0](https://developers.facebook.com/docs/marketing-api) · [Zod](https://github.com/colinhacks/zod) · [TypeScript](https://www.typescriptlang.org)

---

[github.com/feel-t/meta-ads-mcp](https://github.com/feel-t/meta-ads-mcp)
