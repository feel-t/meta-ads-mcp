/**
 * Live API test for facebook-ads-pro-mcp
 * Tests: insights with pagination, campaign listing, interest search
 */
import { config } from "dotenv";
config();

import axios from "axios";

const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const AD_ACCOUNT = process.env.FACEBOOK_AD_ACCOUNT_ID;
const BASE = "https://graph.facebook.com/v22.0";

if (!TOKEN) {
  console.error("❌ FACEBOOK_ACCESS_TOKEN not set in .env");
  process.exit(1);
}

async function api(endpoint, params = {}) {
  const url = `${BASE}/${endpoint}`;
  const response = await axios.get(url, {
    params: { access_token: TOKEN, ...params },
    timeout: 30000,
  });
  return {
    data: response.data,
    rateLimit: response.headers["x-business-use-case-usage"],
  };
}

async function testInsightsWithPagination() {
  console.log("\n═══ TEST 1: Insights with country breakdown (pagination test) ═══");
  try {
    // First call — default 25 limit
    const r1 = await api(`${AD_ACCOUNT}/insights`, {
      fields: "campaign_name,spend,impressions,clicks,outbound_clicks",
      date_preset: "last_7d",
      level: "campaign",
      limit: 25,
    });
    console.log(`  Default (25 limit): ${r1.data.data?.length || 0} rows`);
    console.log(`  Has paging.next: ${!!r1.data.paging?.next}`);

    // Second call — higher limit
    const r2 = await api(`${AD_ACCOUNT}/insights`, {
      fields: "campaign_name,spend,impressions,clicks,outbound_clicks",
      date_preset: "last_7d",
      level: "campaign",
      limit: 200,
    });
    console.log(`  Higher (200 limit): ${r2.data.data?.length || 0} rows`);

    // Country breakdown test
    const r3 = await api(`${AD_ACCOUNT}/insights`, {
      fields: "country,spend,impressions",
      date_preset: "last_7d",
      breakdowns: "country",
      limit: 200,
    });
    const countryRows = r3.data.data?.length || 0;
    const hasMore = !!r3.data.paging?.next;
    console.log(`  Country breakdown (200 limit): ${countryRows} rows, has_more: ${hasMore}`);

    // Auto-paginate: follow all pages
    if (hasMore) {
      let allRows = [...r3.data.data];
      let nextUrl = r3.data.paging.next;
      let pages = 1;
      while (nextUrl && pages < 10) {
        const nextResp = await axios.get(nextUrl, { timeout: 30000 });
        const pageData = nextResp.data.data || [];
        if (pageData.length === 0) break;
        allRows = allRows.concat(pageData);
        nextUrl = nextResp.data.paging?.next;
        pages++;
      }
      console.log(`  After auto-pagination: ${allRows.length} total rows (${pages} pages)`);
    }

    // Rate limit header
    if (r1.rateLimit) {
      console.log(`  Rate limit header: ${r1.rateLimit.substring(0, 120)}...`);
    } else {
      console.log(`  Rate limit header: not present (normal for small accounts)`);
    }

    console.log("  ✅ Insights test PASSED");
  } catch (err) {
    console.error(`  ❌ Insights test FAILED: ${err.response?.data?.error?.message || err.message}`);
  }
}

async function testSortParameter() {
  console.log("\n═══ TEST 2: Sort parameter ═══");
  try {
    const r = await api(`${AD_ACCOUNT}/insights`, {
      fields: "campaign_name,spend",
      date_preset: "last_7d",
      level: "campaign",
      sort: JSON.stringify(["spend_descending"]),
      limit: 10,
    });
    const rows = r.data.data || [];
    console.log(`  Got ${rows.length} campaigns sorted by spend desc:`);
    rows.slice(0, 5).forEach((row, i) => {
      console.log(`    ${i + 1}. ${row.campaign_name}: $${row.spend}`);
    });
    console.log("  ✅ Sort test PASSED");
  } catch (err) {
    console.error(`  ❌ Sort test FAILED: ${err.response?.data?.error?.message || err.message}`);
  }
}

async function testNewDefaultFields() {
  console.log("\n═══ TEST 3: New default fields (outbound_clicks) ═══");
  try {
    const r = await api(`${AD_ACCOUNT}/insights`, {
      fields: "campaign_name,spend,outbound_clicks,inline_link_clicks,inline_link_click_ctr,cost_per_action_type",
      date_preset: "last_7d",
      level: "campaign",
      limit: 5,
    });
    const rows = r.data.data || [];
    if (rows.length > 0) {
      const sample = rows[0];
      console.log(`  Sample campaign: ${sample.campaign_name}`);
      console.log(`  outbound_clicks: ${JSON.stringify(sample.outbound_clicks) || "null"}`);

      console.log(`  inline_link_clicks: ${sample.inline_link_clicks || "null"}`);
      console.log(`  inline_link_click_ctr: ${sample.inline_link_click_ctr || "null"}`);
      console.log(`  cost_per_action_type: ${sample.cost_per_action_type ? "present (" + sample.cost_per_action_type.length + " actions)" : "null"}`);
    }
    console.log("  ✅ New fields test PASSED");
  } catch (err) {
    console.error(`  ❌ New fields test FAILED: ${err.response?.data?.error?.message || err.message}`);
  }
}

async function testCampaignListing() {
  console.log("\n═══ TEST 4: Campaign listing with pagination ═══");
  try {
    const r = await api(`${AD_ACCOUNT}/campaigns`, {
      fields: "id,name,status,effective_status,daily_budget,lifetime_budget",
      limit: 200,
    });
    const campaigns = r.data.data || [];
    const hasMore = !!r.data.paging?.next;
    console.log(`  Got ${campaigns.length} campaigns, has_more: ${hasMore}`);
    const statuses = {};
    campaigns.forEach((c) => {
      statuses[c.effective_status] = (statuses[c.effective_status] || 0) + 1;
    });
    console.log(`  Status breakdown: ${JSON.stringify(statuses)}`);
    console.log("  ✅ Campaign listing test PASSED");
  } catch (err) {
    console.error(`  ❌ Campaign listing test FAILED: ${err.response?.data?.error?.message || err.message}`);
  }
}

async function testInterestSearch() {
  console.log("\n═══ TEST 5: Interest search (targeting) ═══");
  try {
    const r = await api("search", {
      type: "adinterest",
      q: "fitness",
      limit: 10,
      locale: "en_US",
    });
    const interests = r.data.data || [];
    console.log(`  Found ${interests.length} interests for "fitness":`);
    interests.slice(0, 5).forEach((i) => {
      console.log(`    - ${i.name} (audience: ${i.audience_size?.toLocaleString() || "N/A"}, id: ${i.id})`);
    });
    console.log("  ✅ Interest search test PASSED");
  } catch (err) {
    console.error(`  ❌ Interest search test FAILED: ${err.response?.data?.error?.message || err.message}`);
  }
}

async function testBatchRequest() {
  console.log("\n═══ TEST 6: Batch request ═══");
  try {
    // First get a couple campaign IDs
    const campaigns = await api(`${AD_ACCOUNT}/campaigns`, {
      fields: "id,name",
      limit: 2,
      filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] }]),
    });
    const ids = (campaigns.data.data || []).map((c) => c.id);
    if (ids.length < 1) {
      console.log("  ⚠️  No campaigns found, skipping batch test");
      return;
    }

    const batchPayload = ids.map((id) => ({
      method: "GET",
      relative_url: `${id}/insights?fields=spend,impressions&date_preset=last_7d`,
    }));

    const response = await axios.post(`${BASE}/`, {
      access_token: TOKEN,
      batch: JSON.stringify(batchPayload),
    }, { timeout: 30000 });

    const results = response.data;
    console.log(`  Batched ${ids.length} requests, got ${results.length} responses`);
    results.forEach((r, i) => {
      const body = JSON.parse(r.body);
      const data = body.data?.[0];
      console.log(`    Campaign ${ids[i]}: status=${r.code}, spend=$${data?.spend || 0}`);
    });
    console.log("  ✅ Batch test PASSED");
  } catch (err) {
    console.error(`  ❌ Batch test FAILED: ${err.response?.data?.error?.message || err.message}`);
  }
}

// Run all tests
console.log("🔧 Facebook Ads Pro MCP — Live API Test");
console.log(`   Account: ${AD_ACCOUNT}`);
console.log(`   API Version: v22.0`);
console.log(`   Token: ${TOKEN.substring(0, 10)}...${TOKEN.substring(TOKEN.length - 6)}`);

(async () => {
  await testInsightsWithPagination();
  await testSortParameter();
  await testNewDefaultFields();
  await testCampaignListing();
  await testInterestSearch();
  await testBatchRequest();
  console.log("\n═══ ALL TESTS COMPLETE ═══\n");
})();
