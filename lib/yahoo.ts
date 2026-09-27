/**
 * Yahoo Finance fallback for when Angel One SmartAPI is unavailable —
 * rate-limited (circuit open), login failure, or a non-200/garbage response.
 *
 * Scope, deliberately: Yahoo serves CHARTS and SPOT PRICES for Indian
 * indices and cash equities. It does NOT publish option chains for Indian
 * instruments — `/v7/finance/options` returns empty `expirationDates` and
 * `strikes` for ^NSEI and RELIANCE.NS alike (it only covers US listings).
 * So the option-chain route can borrow a spot price from here to place the
 * ATM strike, but per-strike premiums/OI have no Yahoo source and stay
 * whatever Angel last gave us.
 *
 * No API key and no crumb/cookie handshake is needed for the chart endpoint.
 *
 * IMPORTANT — THIS DATA IS DELAYED. Yahoo carries NSE/BSE on a delayed feed
 * (~15 minutes); real-time Indian market data requires a licensed exchange
 * feed, which is what Angel One is for. Everything returned from here is
 * therefore stamped with `asOf` and must be surfaced to the user as delayed,
 * never presented as live. Practical consequences:
 *   - 1M/3M/6M/1Y daily candles: a 15-minute lag is immaterial.
 *   - 1D/1W intraday candles: the right-hand edge lags noticeably.
 *   - Option-chain spot: the ATM strike can sit a strike or two off in a
 *     fast-moving market.
 * A cached Angel response younger than DELAY_MS is genuinely fresher than
 * Yahoo, so callers should prefer it over falling back.
 */

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const TIMEOUT_MS = 8_000;

/** Yahoo's quoted delay for NSE/BSE. */
export const YAHOO_DELAY_MINUTES = 15;
export const YAHOO_DELAY_MS = YAHOO_DELAY_MINUTES * 60_000;

// Yahoo 403s the default fetch agent.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Angel index name → Yahoo ticker. Each verified against Yahoo's chart API. */
const INDEX_SYMBOLS: Record<string, string> = {
  NIFTY: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  FINNIFTY: "NIFTY_FIN_SERVICE.NS",
  SENSEX: "^BSESN",
  MIDCPNIFTY: "NIFTY_MIDCAP_100.NS",
};

/** Our range codes → Yahoo's (range, interval) pair. */
const RANGE_MAP: Record<string, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
};

/** Angel interval names → Yahoo interval names, for the `interval` override. */
const INTERVAL_MAP: Record<string, string> = {
  ONE_MINUTE: "1m",
  FIVE_MINUTE: "5m",
  FIFTEEN_MINUTE: "15m",
  THIRTY_MINUTE: "30m",
  ONE_HOUR: "60m",
  ONE_DAY: "1d",
};

export interface Candle {
  time: number; // Unix seconds — same shape the Angel path emits
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Map an Angel symbol + exchange to a Yahoo ticker.
 *
 * Returns null when Yahoo has no equivalent — MCX commodity contracts and
 * individual NFO/BFO option legs. We deliberately do NOT proxy MCX to the
 * US futures (CL=F, GC=F): those are different contracts in a different
 * currency, so the prices would be quietly wrong rather than merely absent.
 */
export function toYahooSymbol(symbol: string, exchange: string): string | null {
  const s = symbol.toUpperCase().trim();
  if (INDEX_SYMBOLS[s]) return INDEX_SYMBOLS[s];

  const base = s.replace(/-EQ$/, "");
  switch (exchange.toUpperCase()) {
    case "NSE":
      return `${base}.NS`;
    case "BSE":
      return `${base}.BO`;
    default:
      return null;
  }
}

interface YahooChartResult {
  meta?: { regularMarketPrice?: number; regularMarketTime?: number };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
      close?: (number | null)[];
      volume?: (number | null)[];
    }>;
  };
}

async function fetchChart(
  yahooSymbol: string,
  range: string,
  interval: string,
): Promise<YahooChartResult | null> {
  const url =
    `${CHART_BASE}/${encodeURIComponent(yahooSymbol)}` +
    `?interval=${interval}&range=${range}`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);

  const json = await res.json();
  const err = json?.chart?.error;
  if (err) throw new Error(`Yahoo: ${err.code || "error"} ${err.description || ""}`);
  return json?.chart?.result?.[0] ?? null;
}

/**
 * OHLCV candles for a symbol, in the same shape the Angel path returns.
 * `intervalOverride` accepts an Angel interval name (e.g. FIVE_MINUTE).
 *
 * `asOf` is the timestamp of the newest candle (Unix seconds). Note this is
 * the bar's OPEN time, so on daily intervals it reads as hours old simply
 * because the session bar opened this morning — it is not extra delay. For a
 * "delayed" badge use YAHOO_DELAY_MINUTES; use `asOf` for intraday staleness
 * or to label the chart's right-hand edge.
 * `candles` is [] when Yahoo has nothing usable; callers treat that as a miss.
 */
export async function fetchYahooCandles(
  yahooSymbol: string,
  range: string,
  intervalOverride?: string | null,
): Promise<{ candles: Candle[]; asOf: number | null }> {
  const mapped = RANGE_MAP[range] || RANGE_MAP["1D"];
  const interval = intervalOverride
    ? INTERVAL_MAP[intervalOverride] || mapped.interval
    : mapped.interval;

  const result = await fetchChart(yahooSymbol, mapped.range, interval);
  const stamps = result?.timestamp;
  const q = result?.indicators?.quote?.[0];
  if (!stamps?.length || !q) return { candles: [], asOf: null };

  const candles: Candle[] = [];
  for (let i = 0; i < stamps.length; i++) {
    const close = q.close?.[i];
    // Yahoo pads holidays and halted minutes with nulls — drop those rows
    // rather than charting them as zeroes.
    if (close == null) continue;
    candles.push({
      time: stamps[i],
      open: Number(q.open?.[i] ?? close),
      high: Number(q.high?.[i] ?? close),
      low: Number(q.low?.[i] ?? close),
      close: Number(close),
      volume: Number(q.volume?.[i] ?? 0),
    });
  }
  return {
    candles,
    asOf: candles.length ? candles[candles.length - 1].time : null,
  };
}

/**
 * Last traded price for a symbol. `asOf` is Yahoo's own quote timestamp
 * (Unix seconds), so callers can report how stale the price actually is.
 * `price` is null when Yahoo can't serve the symbol.
 */
export async function fetchYahooSpot(
  yahooSymbol: string,
): Promise<{ price: number | null; asOf: number | null }> {
  const result = await fetchChart(yahooSymbol, "1d", "5m");
  const price = Number(result?.meta?.regularMarketPrice);
  const asOf = Number(result?.meta?.regularMarketTime);
  return {
    price: Number.isFinite(price) && price > 0 ? price : null,
    asOf: Number.isFinite(asOf) && asOf > 0 ? asOf : null,
  };
}
