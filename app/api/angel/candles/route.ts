import { NextRequest, NextResponse } from "next/server";
import { angelPost, circuitOpen } from "@/lib/angelone/session";
import { INDEX_TOKENS, resolveTradable } from "@/lib/angelone/instruments";
import {
  fetchYahooCandles,
  toYahooSymbol,
  YAHOO_DELAY_MINUTES,
  YAHOO_DELAY_MS,
} from "@/lib/yahoo";

/**
 * GET /api/angel/candles?symbol=RELIANCE&exchange=NSE&interval=ONE_DAY&range=1M
 *
 * Returns OHLCV candle array from Angel One historical API.
 * Supports: ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, THIRTY_MINUTE, ONE_HOUR, ONE_DAY
 *
 * When Angel One fails — rate-limited, login error, symbol unresolvable — we
 * fall back to Yahoo Finance for indices and cash equities.
 * MCX has no Yahoo equivalent, so it still surfaces the Angel error.
 *
 * Yahoo's NSE/BSE feed is DELAYED ~15 min, so the fallback is not equivalent
 * to Angel. Two consequences, both handled below:
 *   1. A cached Angel response younger than that delay is genuinely fresher
 *      than Yahoo, so it wins over falling back.
 *   2. Anything served from Yahoo is labelled `delayed: true` with an `asOf`
 *      timestamp, so the client can badge the chart instead of implying live.
 *
 * Response fields: `source` ("angel" | "yahoo"), and when source is "yahoo",
 * `delayed`, `delayMinutes` and `asOf` (ISO 8601 of the newest candle's OPEN
 * time — on daily ranges that is this morning's bar, not extra delay, so
 * badge from `delayMinutes` rather than from the age of `asOf`).
 */

// Cache candle responses to avoid hammering Angel One on every chart view.
// Intraday (1D) refreshes every 60s; longer ranges (daily candles) refresh every 10min.
interface CacheEntry {
  data: unknown;
  fetchedAt: number;
  /** True when this entry came from Yahoo's delayed feed rather than Angel. */
  delayed?: boolean;
}
declare global {
  // eslint-disable-next-line no-var
  var __candleCache: Map<string, CacheEntry> | undefined;
}
const candleCache: Map<string, CacheEntry> =
  globalThis.__candleCache || (globalThis.__candleCache = new Map());

/**
 * Delayed entries expire fast so a recovered Angel feed takes over within a
 * minute, instead of a Yahoo snapshot holding the cache for the range TTL
 * (up to 10 min on the longer ranges).
 */
const DELAYED_CACHE_TTL = 60_000;

const CANDLE_CACHE_TTL: Record<string, number> = {
  "1D": 60_000,       // 1 min — intraday, 5-min candles
  "1W": 300_000,      // 5 min
  "1M": 600_000,      // 10 min
  "3M": 600_000,
  "6M": 600_000,
  "1Y": 600_000,
};

const RANGE_MAP: Record<string, { days: number; interval: string }> = {
  // Look back 5 calendar days, not 1, so weekends and holidays still contain a
  // real session. The result is trimmed to the latest trading day below, so the
  // chart stays a single intraday session instead of a lone stale candle.
  "1D": { days: 5, interval: "FIVE_MINUTE" },
  "1W": { days: 7, interval: "FIFTEEN_MINUTE" },
  "1M": { days: 30, interval: "ONE_DAY" },
  "3M": { days: 90, interval: "ONE_DAY" },
  "6M": { days: 180, interval: "ONE_DAY" },
  "1Y": { days: 365, interval: "ONE_DAY" },
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const symbolName = sp.get("symbol") || "NIFTY";
  const exchange = sp.get("exchange") || "NSE";
  const range = sp.get("range") || "1D";
  const intervalOverride = sp.get("interval");

  const rangeConfig = RANGE_MAP[range] || RANGE_MAP["1D"];
  const interval = intervalOverride || rangeConfig.interval;

  // Symbol-keyed (not token-keyed) so the cache still answers when symbol
  // resolution itself is what failed, and so both sources share one entry.
  const cacheKey = `${exchange.toUpperCase()}:${symbolName.toUpperCase()}:${range}:${interval}`;
  const cached = candleCache.get(cacheKey);
  const cacheTtl = cached?.delayed
    ? DELAYED_CACHE_TTL
    : CANDLE_CACHE_TTL[range] ?? 60_000;

  if (cached && Date.now() - cached.fetchedAt < cacheTtl) {
    console.log("[angel/candles] cache hit —", cacheKey, `age=${Math.round((Date.now() - cached.fetchedAt) / 1000)}s`);
    return NextResponse.json(cached.data);
  }

  /** Last resort before erroring: stale cache beats no chart at all. */
  const serveStale = (why: string) => {
    if (!cached) return null;
    console.log(`[angel/candles] ${why} — serving stale cache`, cacheKey);
    return NextResponse.json(cached.data);
  };

  /**
   * Yahoo Finance fallback — DELAYED data, labelled as such.
   * Returns null when Yahoo can't serve this symbol.
   */
  const tryYahoo = async (why: string) => {
    const yahooSymbol = toYahooSymbol(symbolName, exchange);
    if (!yahooSymbol) {
      console.warn(`[angel/candles] ${why} — no Yahoo mapping for ${exchange}:${symbolName}`);
      return null;
    }
    try {
      const { candles, asOf } = await fetchYahooCandles(yahooSymbol, range, intervalOverride);
      if (!candles.length) {
        console.warn(`[angel/candles] ${why} — Yahoo returned no candles for ${yahooSymbol}`);
        return null;
      }
      const ageMin = asOf ? Math.round((Date.now() / 1000 - asOf) / 60) : null;
      console.log(
        `[angel/candles] ${why} — served ${candles.length} DELAYED candles from Yahoo ` +
          `(${yahooSymbol}, newest is ${ageMin ?? "?"} min old)`,
      );
      const data = {
        symbol: symbolName,
        exchange,
        range,
        interval,
        candles,
        source: "yahoo" as const,
        // Yahoo's NSE/BSE feed lags real time — never render this as live.
        delayed: true,
        delayMinutes: YAHOO_DELAY_MINUTES,
        asOf: asOf ? new Date(asOf * 1000).toISOString() : null,
      };
      // Tagged delayed so it expires on DELAYED_CACHE_TTL, not the range TTL.
      candleCache.set(cacheKey, { data, fetchedAt: Date.now(), delayed: true });
      return NextResponse.json(data);
    } catch (e) {
      console.error("[angel/candles] Yahoo fallback failed —", (e as Error).message);
      return null;
    }
  };

  /**
   * Choose the best recovery when Angel is unusable.
   *
   * A cached Angel response younger than Yahoo's delay window is more current
   * than anything Yahoo would return, so it wins; otherwise we fall back and
   * accept delayed data over no data.
   */
  const recover = async (why: string) => {
    if (cached && !cached.delayed && Date.now() - cached.fetchedAt < YAHOO_DELAY_MS) {
      return serveStale(`${why} (cache is fresher than Yahoo's ${YAHOO_DELAY_MINUTES}-min feed)`);
    }
    return (await tryYahoo(why)) ?? serveStale(why);
  };

  try {
    // Resolve symbol token (handles indices, equities, options, MCX futures)
    let token: string | undefined;
    let resolvedExchange = exchange;
    const idxEntry = INDEX_TOKENS[symbolName.toUpperCase()];
    if (idxEntry) {
      token = idxEntry.token;
      resolvedExchange = idxEntry.exchange;
    } else {
      const inst = await resolveTradable(exchange, symbolName);
      if (inst) {
        token = inst.token;
        resolvedExchange = inst.exch_seg;
      }
    }

    if (!token) {
      // Scrip master may be down, or the symbol genuinely isn't on Angel.
      return (
        (await recover("symbol unresolved")) ??
        NextResponse.json(
          { error: `Symbol not found: ${exchange}:${symbolName}` },
          { status: 404 },
        )
      );
    }

    // Circuit open (rate-limited) — prefer stale cache, then Yahoo, over a 500.
    if (circuitOpen()) {
      return (
        (await recover("circuit open")) ??
        NextResponse.json(
          { error: "Angel One rate-limited and no fallback available" },
          { status: 503 },
        )
      );
    }

    const toDate = new Date();
    const fromDate = new Date(
      toDate.getTime() - rangeConfig.days * 24 * 60 * 60 * 1000,
    );

    // Intraday start-of-day floor: for the 5-day 1D window, start at the open
    // of the earliest day. MCX opens 09:00 IST, NSE/BSE 09:15 IST (UTC+5:30).
    // MCX 09:00 IST = 03:30 UTC | NSE 09:15 IST = 03:45 UTC
    if (range === "1D") {
      const mcx = resolvedExchange === "MCX";
      fromDate.setUTCHours(3, mcx ? 30 : 45, 0, 0);
    }

    const body = {
      exchange: resolvedExchange,
      symboltoken: token,
      interval,
      fromdate: formatDate(fromDate),
      todate: formatDate(toDate),
    };

    const result = await angelPost(
      "/rest/secure/angelbroking/historical/v1/getCandleData",
      body,
    );

    if (!result.status || !result.data) {
      const why = result.message || "no candle data";
      console.warn("[angel/candles] Angel One error —", why);
      return (
        (await recover(`angel error: ${why}`)) ??
        NextResponse.json({ error: why }, { status: 502 })
      );
    }

    // Angel returns [[timestamp, O, H, L, C, V], ...]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candles = (result.data as any[]).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ([time, open, high, low, close, volume]: any[]) => ({
        time: new Date(time).getTime() / 1000, // Unix seconds
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
      }),
    );

    // An empty array is a soft failure — Angel says OK but has nothing.
    if (!candles.length) {
      const fallback = await recover("angel returned empty candles");
      if (fallback) return fallback;
    }

    // For 1D, keep only the most recent trading day's candles. The 5-day window
    // above guarantees a real session even on weekends/holidays; trimming to the
    // last IST date turns it back into a clean single-session intraday chart
    // (and keeps the open/change % anchored to that day, not 5 days ago).
    let outCandles = candles;
    if (range === "1D" && candles.length > 1) {
      const istDay = (unixSec: number) =>
        new Date(unixSec * 1000 + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
      const lastDay = istDay(candles[candles.length - 1].time);
      const sameDay = candles.filter((c) => istDay(c.time) === lastDay);
      if (sameDay.length > 1) outCandles = sameDay;
    }

    const responseData = { symbol: symbolName, exchange, range, interval, candles: outCandles, source: "angel" as const };
    candleCache.set(cacheKey, { data: responseData, fetchedAt: Date.now() });
    return NextResponse.json(responseData);
  } catch (err) {
    const msg = (err as Error).message || "Internal error";
    console.error("[angel/candles]", err);
    return (
      (await recover(`threw: ${msg}`)) ??
      NextResponse.json({ error: msg }, { status: 500 })
    );
  }
}
