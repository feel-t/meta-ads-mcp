import axios, { AxiosError, AxiosResponse } from "axios";
import { GRAPH_API_BASE_URL } from "../constants.js";

export interface GraphApiResponse<T = unknown> {
  data: T[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
  summary?: Record<string, unknown>;
}

export interface RateLimitInfo {
  call_count: number;
  total_cputime: number;
  total_time: number;
  type: string;
  estimated_time_to_regain_access?: number;
}

export interface PaginationMeta {
  total_rows: number;
  pages_fetched: number;
  has_more: boolean;
  next_cursor?: string;
}

export interface ApiResult<T = unknown> {
  data: T[];
  _pagination: PaginationMeta;
  _rate_limit?: RateLimitInfo;
}

function parseRateLimitHeaders(
  response: AxiosResponse
): RateLimitInfo | undefined {
  const header = response.headers["x-business-use-case-usage"];
  if (!header) return undefined;
  try {
    const parsed = JSON.parse(header);
    const keys = Object.keys(parsed);
    if (keys.length > 0 && Array.isArray(parsed[keys[0]])) {
      return parsed[keys[0]][0] as RateLimitInfo;
    }
  } catch {
    // ignore parse errors
  }
  return undefined;
}

export class FacebookGraphClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async request<T = unknown>(
    endpoint: string,
    params: Record<string, string | number | boolean> = {},
    method: "GET" | "POST" | "DELETE" = "GET",
    data?: Record<string, unknown>
  ): Promise<{ body: T; rateLimit?: RateLimitInfo }> {
    const url = `${GRAPH_API_BASE_URL}/${endpoint}`;
    const allParams: Record<string, string | number | boolean> = {
      access_token: this.accessToken,
      ...params,
    };

    try {
      const response = await axios({
        method,
        url,
        params: allParams,
        data,
        timeout: 60000,
      });

      const rateLimit = parseRateLimitHeaders(response);
      return { body: response.data as T, rateLimit };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async requestList<T = unknown>(
    endpoint: string,
    params: Record<string, string | number | boolean> = {},
    limit: number = 100,
    autoPaginate: boolean = false,
    maxPages: number = 20
  ): Promise<ApiResult<T>> {
    const allParams = { ...params, limit };
    const firstResult = await this.request<GraphApiResponse<T>>(
      endpoint,
      allParams
    );

    let allData: T[] = firstResult.body.data || [];
    let pagesFetched = 1;
    let nextUrl = firstResult.body.paging?.next;
    let latestRateLimit = firstResult.rateLimit;

    if (autoPaginate && nextUrl) {
      while (nextUrl && pagesFetched < maxPages) {
        try {
          const response: AxiosResponse<GraphApiResponse<T>> = await axios.get(nextUrl, {
            timeout: 60000,
          });
          const pageData = response.data.data || [];
          if (pageData.length === 0) break;
          allData = allData.concat(pageData);
          pagesFetched++;
          nextUrl = response.data.paging?.next;
          const rl = parseRateLimitHeaders(response);
          if (rl) latestRateLimit = rl;
        } catch (error) {
          throw this.formatError(error);
        }
      }
    }

    const hasMore = !!nextUrl;
    const nextCursor = firstResult.body.paging?.cursors?.after;

    return {
      data: allData,
      _pagination: {
        total_rows: allData.length,
        pages_fetched: pagesFetched,
        has_more: hasMore,
        ...(nextCursor && !autoPaginate ? { next_cursor: nextCursor } : {}),
      },
      ...(latestRateLimit ? { _rate_limit: latestRateLimit } : {}),
    };
  }

  async batchRequest(
    requests: Array<{
      method: string;
      relative_url: string;
    }>
  ): Promise<{
    body: Array<{ code: number; body: string }>;
    rateLimit?: RateLimitInfo;
  }> {
    const url = `${GRAPH_API_BASE_URL}/`;
    try {
      const response = await axios.post(
        url,
        {
          access_token: this.accessToken,
          batch: JSON.stringify(requests),
        },
        { timeout: 120000 }
      );
      const rateLimit = parseRateLimitHeaders(response);
      return { body: response.data, rateLimit };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  private formatError(error: unknown): Error {
    if (error instanceof AxiosError) {
      const fbError = error.response?.data?.error;
      if (fbError) {
        return new Error(
          `Facebook API Error ${fbError.code}: ${fbError.message}` +
            (fbError.error_user_title
              ? ` — ${fbError.error_user_title}: ${fbError.error_user_msg}`
              : "")
        );
      }
      if (error.response) {
        return new Error(
          `API request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
        );
      }
      if (error.code === "ECONNABORTED") {
        return new Error(
          "Request timed out. Try reducing the limit or date range."
        );
      }
    }
    return error instanceof Error
      ? error
      : new Error(`Unexpected error: ${String(error)}`);
  }
}
