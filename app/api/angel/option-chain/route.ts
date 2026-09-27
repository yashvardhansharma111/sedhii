import { NextRequest, NextResponse } from "next/server";
import { angelPost, circuitOpen } from "@/lib/angelone/session";
import {
  getOptionChainInstruments,
  getExpiries,
  INDEX_TOKENS,
} from "@/lib/angelone/instruments";
import { fetchYahooSpot, toYahooSymbol } from "@/lib/yahoo";

/** NFO/BFO option legs price off a cash underlying; MCX off its own board. */
function underlyingExchangeFor(exchange: string): string {
  return exchange === "NFO" ? "NSE" : exchange === "BFO" ? "BSE" : "MCX";
}

/**
 * Underlying spot from Yahoo, for when Angel's quote API is unavailable.
 *
 * This only recovers the SPOT — Yahoo publishes no option chains for Indian
 * instruments (`/v7/finance/options` returns empty strikes for ^NSEI and
 * RELIANCE.NS alike), so per-strike premiums and OI cannot be backfilled.
 * A spot is still worth fetching: it is what centres the chain on the ATM
 * strike, so the table comes back on the right rows instead of at index 0.
 */
async function yahooSpot(
  symbol: string,
  exchange: string,
): Promise<{ price: number; asOf: string | null }> {
  const miss = { price: 0, asOf: null };
  const yahooSymbol = toYahooSymbol(symbol, underlyingExchangeFor(exchange));
  if (!yahooSymbol) return miss;
  try {
    const { price, asOf } = await fetchYahooSpot(yahooSymbol);
    if (!price) return miss;
    const ageMin = asOf ? Math.round((Date.now() / 1000 - asOf) / 60) : null;
    console.log(
      `[angel/option-chain] spot ${price} from Yahoo (${yahooSymbol}) — ` +
        `DELAYED, quoted ${ageMin ?? "?"} min ago`,
    );
    return { price, asOf: asOf ? new Date(asOf * 1000).toISOString() : null };
  } catch (e) {
    console.error("[angel/option-chain] Yahoo spot failed —", (e as Error).message);
    return miss;
  }
}

/** Pick the strike nearest to spot, and a window of strikes centred on it. */
function centreOnSpot(strikes: number[], spot: number, window: number) {
  if (!strikes.length) return { atmStrike: 0, windowed: [] as number[] };
  if (!(spot > 0)) return { atmStrike: 0, windowed: strikes.slice(0, window * 2) };
  const atmIdx = strikes.reduce(
    (best, _, idx) =>
      Math.abs(strikes[idx] - spot) < Math.abs(strikes[best] - spot) ? idx : best,
    0,
  );
  return {
    atmStrike: strikes[atmIdx],
    windowed: strikes.slice(
      Math.max(0, atmIdx - window),
      Math.min(strikes.length, atmIdx + window + 1),
    ),
  };
}

const QUOTE_CACHE_TTL_MS = 60_000; // 60 s — keep Angel One under rate limit
declare global {
  // eslint-disable-next-line no-var
  var __optionQuoteCache: Map<string, { data: unknown; fetchedAt: number }> | undefined;
}
const quoteCache: Map<string, { data: unknown; fetchedAt: number }> =
  globalThis.__optionQuoteCache ||
  (globalThis.__optionQuoteCache = new Map());

/**
 * GET /api/angel/option-chain?symbol=NIFTY&expiry=25APR2026
 * GET /api/angel/option-chain?symbol=NIFTY  (returns nearest expiry)
 *
 * Returns CE/PE option chain with live LTP for each strike.
 */
export async function GET(request: NextRequest) {
  // Held outside the try so the catch can still find the cache entry — the
  // key depends on the resolved expiry, which the raw query string may omit.
  let cacheKey: string | null = null;

  try {
    const sp = request.nextUrl.searchParams;
    const symbol = (sp.get("symbol") || "NIFTY").toUpperCase();
    let expiry = sp.get("expiry") || "";
    const exchange = sp.get("exchange") || "NFO";

    // If no expiry, find nearest
    if (!expiry) {
      const expiries = await getExpiries(symbol, exchange);
      if (!expiries.length) {
        return NextResponse.json(
          { error: `No options found for ${symbol}` },
          { status: 404 },
        );
      }
      expiry = expiries[0]; // Nearest expiry
    }

    // Full-response cache keyed by symbol+expiry+exchange — avoids hammering Angel One
    cacheKey = `${symbol}:${exchange}:${expiry}`;
    const cached = quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < QUOTE_CACHE_TTL_MS) {
      console.log("[angel/option-chain] cache hit —", cacheKey, `age=${Math.round((Date.now() - cached.fetchedAt) / 1000)}s`);
      return NextResponse.json(cached.data);
    }
    // Circuit open — serve stale cache rather than error
    if (circuitOpen() && cached) {
      console.log("[angel/option-chain] circuit open, serving stale cache —", cacheKey);
      return NextResponse.json(cached.data);
    }
    console.log("[angel/option-chain] cache miss —", cacheKey);

    // Get all CE/PE instruments for this expiry
    const { calls: allCalls, puts: allPuts } = await getOptionChainInstruments(
      symbol,
      expiry,
      exchange,
    );

    if (!allCalls.length && !allPuts.length) {
      return NextResponse.json(
        { error: `No options for ${symbol} expiry ${expiry}` },
        { status: 404 },
      );
    }

    // Circuit open with no cache — return skeleton chain (strikes from scrip master, LTP=0)
    // so the app renders the table instead of an error screen.
    if (circuitOpen()) {
      // Prefer any previously cached quotes over a zeroed skeleton flash.
      if (cached?.data) {
        console.log("[angel/option-chain] circuit open — serving stale cache", cacheKey);
        return NextResponse.json(cached.data);
      }
      const strikeSet = new Set([...allCalls.map((c) => c.strike), ...allPuts.map((p) => p.strike)]);
      const sortedStrikes = [...strikeSet].sort((a, b) => a - b);
      // Strikes and expiries come from the scrip master (a public download,
      // unaffected by the rate limit), so the only thing missing is prices.
      // Borrow the spot from Yahoo so the skeleton opens on the ATM rows.
      const { price: spot, asOf: spotAsOf } = await yahooSpot(symbol, exchange);
      const { atmStrike, windowed } = centreOnSpot(sortedStrikes, spot, 10);
      const allStrikes = windowed;
      const expiries = await getExpiries(symbol, exchange);
      const chain = allStrikes.map((strike) => {
        const ce = allCalls.find((c) => c.strike === strike);
        const pe = allPuts.find((p) => p.strike === strike);
        const row: Record<string, unknown> = { strike };
        const empty = { ltp: 0, change: 0, changePct: 0, oi: 0, oiChange: 0, volume: 0, bidPrice: 0, askPrice: 0, iv: 0, lotSize: ce?.lotsize ?? pe?.lotsize ?? 1 };
        if (ce) row.CE = { ...empty, symbol: ce.symbol, token: ce.token };
        if (pe) row.PE = { ...empty, symbol: pe.symbol, token: pe.token };
        return row;
      });
      console.log("[angel/option-chain] circuit open — returning skeleton chain", cacheKey);
      return NextResponse.json({
        symbol,
        expiry,
        exchange,
        spotPrice: spot,
        atmStrike,
        expiries,
        chain,
        source: spot > 0 ? "yahoo-spot" : "skeleton",
        // Yahoo's NSE/BSE feed lags ~15 min, so the ATM strike derived from
        // it can sit a strike or two off in a fast market. Label, don't hide.
        spotSource: spot > 0 ? "yahoo" : "none",
        spotDelayed: spot > 0,
        spotAsOf,
        // Angel is the only source of Indian option premiums; Yahoo has none.
        quotesUnavailable: true,
      });
    }

    // Fetch spot price first (needed to pick ATM strikes).
    // A throw here used to take the whole route down with a 500; now it just
    // leaves spotPrice at 0 and we recover it from Yahoo below.
    let spotPrice = 0;
    let spotSource: "angel" | "yahoo" | "none" = "none";
    /** Yahoo's own quote time when the spot came from the delayed feed. */
    let spotAsOf: string | null = null;
    const idxInfo = INDEX_TOKENS[symbol];
    try {
      if (idxInfo) {
        const spotResult = await angelPost(
          "/rest/secure/angelbroking/market/v1/quote/",
          {
            mode: "LTP",
            exchangeTokens: { [idxInfo.exchange]: [idxInfo.token] },
          },
        );
        if (spotResult.status && spotResult.data?.fetched?.[0]) {
          spotPrice = Number(spotResult.data.fetched[0].ltp);
        }
      } else {
        // For stocks/commodities — spot = underlying equity/futures LTP
        const { findBySymbol, resolveTradable } = await import("@/lib/angelone/instruments");
        const underlyingExchange = underlyingExchangeFor(exchange);
        // For MCX, use resolveTradable to find the nearest futures contract (FUTCOM).
        // findBySymbol won't work because MCX symbols include expiry (e.g. "CRUDEOIL25APR2026FUT").
        const inst =
          underlyingExchange === "MCX"
            ? await resolveTradable("MCX", symbol)
            : (await findBySymbol(underlyingExchange, symbol)) ||
              (await findBySymbol(underlyingExchange, `${symbol}-EQ`));
        if (inst) {
          const spotResult = await angelPost(
            "/rest/secure/angelbroking/market/v1/quote/",
            { mode: "LTP", exchangeTokens: { [inst.exch_seg]: [inst.token] } },
          );
          if (spotResult.status && spotResult.data?.fetched?.[0]) {
            spotPrice = Number(spotResult.data.fetched[0].ltp);
          }
        }
      }
      if (spotPrice > 0) spotSource = "angel";
    } catch (e) {
      console.warn("[angel/option-chain] Angel spot failed —", (e as Error).message);
    }

    // Angel gave us nothing for the spot — fall back to Yahoo so the chain
    // still centres on the right ATM strike.
    if (!(spotPrice > 0)) {
      const fallbackSpot = await yahooSpot(symbol, exchange);
      spotPrice = fallbackSpot.price;
      if (spotPrice > 0) {
        spotSource = "yahoo";
        spotAsOf = fallbackSpot.asOf;
      }
    }

    // Limit to strikes near ATM — huge perf win (200+ strikes → ~40)
    // Use all unique strikes, sorted, pick ~20 on each side of spot
    const STRIKE_WINDOW = Number(sp.get("strikes")) || 8; // 8 each side = 16 strikes = 32 tokens → 1 batch
    const allStrikes = [...new Set([...allCalls.map((c) => c.strike), ...allPuts.map((p) => p.strike)])].sort(
      (a, b) => a - b,
    );
    let strikeFilter: Set<number>;
    if (spotPrice > 0 && allStrikes.length > STRIKE_WINDOW * 2) {
      const atmIdx = allStrikes.reduce(
        (best, _, idx) =>
          Math.abs(allStrikes[idx] - spotPrice) < Math.abs(allStrikes[best] - spotPrice) ? idx : best,
        0,
      );
      const start = Math.max(0, atmIdx - STRIKE_WINDOW);
      const end = Math.min(allStrikes.length, atmIdx + STRIKE_WINDOW + 1);
      strikeFilter = new Set(allStrikes.slice(start, end));
    } else {
      strikeFilter = new Set(allStrikes);
    }

    const calls = allCalls.filter((c) => strikeFilter.has(c.strike));
    const puts = allPuts.filter((p) => strikeFilter.has(p.strike));

    // Collect all option tokens for batch quote
    const nfoTokens: string[] = [];
    const tokenToInstrument = new Map<string, any>();

    for (const c of calls) {
      nfoTokens.push(c.token);
      tokenToInstrument.set(c.token, { ...c, optionType: "CE" });
    }
    for (const p of puts) {
      nfoTokens.push(p.token);
      tokenToInstrument.set(p.token, { ...p, optionType: "PE" });
    }

    // Batch quote (max 50 per request for Angel).
    // Yahoo has no Indian option premiums, so there is nothing to fall back to
    // here — a failed batch just leaves those strikes unquoted, and the merge
    // below keeps the previous cached LTPs rather than flashing zeroes.
    const quoteMap = new Map<string, any>();
    const BATCH = 50;
    let quoteBatchFailed = false;
    for (let i = 0; i < nfoTokens.length; i += BATCH) {
      const batch = nfoTokens.slice(i, i + BATCH);
      try {
        const qResult = await angelPost(
          "/rest/secure/angelbroking/market/v1/quote/",
          {
            mode: "FULL",
            exchangeTokens: { [exchange]: batch },
          },
        );
        if (qResult.status && qResult.data?.fetched) {
          for (const q of qResult.data.fetched) {
            quoteMap.set(q.symbolToken || q.symboltoken, q);
          }
        } else {
          quoteBatchFailed = true;
        }
      } catch (e) {
        // Rate limit mid-way through. Stop asking, keep what we already have.
        quoteBatchFailed = true;
        console.warn("[angel/option-chain] quote batch failed —", (e as Error).message);
        break;
      }
    }

    // Build strike-indexed chain
    const strikeMap = new Map<number, Record<string, any>>();

    for (const [tok, inst] of tokenToInstrument.entries()) {
      const quote = quoteMap.get(tok);
      const row: Record<string, any> = strikeMap.get(inst.strike) || {
        strike: inst.strike,
      };

      const entry = {
        symbol: inst.symbol,
        token: inst.token,
        ltp: quote?.ltp ?? 0,
        change: quote?.netChange ?? 0,
        changePct: quote?.percentChange ?? 0,
        oi: quote?.opnInterest ?? 0,
        oiChange: quote?.oiChange ?? 0,
        volume: quote?.tradeVolume ?? 0,
        bidPrice: quote?.bestBidPrice ?? 0,
        askPrice: quote?.bestAskPrice ?? 0,
        iv: 0,
        lotSize: inst.lotsize,
      };

      if (inst.optionType === "CE") row.CE = entry;
      else row.PE = entry;

      strikeMap.set(inst.strike, row);
    }

    // Sort by strike
    const chain = [...strikeMap.values()].sort(
      (a, b) => a.strike - b.strike,
    );

    // Find ATM strike
    let atmStrike = 0;
    if (spotPrice > 0 && chain.length) {
      atmStrike = chain.reduce((prev, curr) =>
        Math.abs(curr.strike - spotPrice) < Math.abs(prev.strike - spotPrice)
          ? curr
          : prev,
      ).strike;
    }

    // Get all available expiries for the dropdown
    const expiries = await getExpiries(symbol, exchange);

    // If quotes came back empty/zero (rate-limit / partial failure), keep prior
    // LTPs so clients don't flash 0 between refreshes.
    const prev = cached?.data as
      | {
          spotPrice?: number;
          atmStrike?: number;
          chain?: Array<{
            strike: number;
            CE?: Record<string, number>;
            PE?: Record<string, number>;
          }>;
        }
      | undefined;
    const mergedChain = chain.map((row) => {
      const prevRow = prev?.chain?.find((r) => r.strike === row.strike);
      const keepSide = (
        next: Record<string, any> | undefined,
        old: Record<string, any> | undefined,
      ) => {
        if (!next) return next;
        const nextLtp = Number(next.ltp ?? 0);
        const oldLtp = Number(old?.ltp ?? 0);
        if (nextLtp > 0 || !(oldLtp > 0)) return next;
        return {
          ...next,
          ltp: oldLtp,
          change: Number(old?.change ?? next.change ?? 0),
          changePct: Number(old?.changePct ?? next.changePct ?? 0),
          oi: Number(next.oi || old?.oi || 0),
          oiChange: Number(next.oiChange || old?.oiChange || 0),
          volume: Number(next.volume || old?.volume || 0),
          bidPrice: Number(next.bidPrice || old?.bidPrice || 0),
          askPrice: Number(next.askPrice || old?.askPrice || 0),
        };
      };
      return {
        ...row,
        CE: keepSide(row.CE, prevRow?.CE),
        PE: keepSide(row.PE, prevRow?.PE),
      };
    });

    const liveQuoteCount = mergedChain.reduce((n, row) => {
      const ce = Number(row.CE?.ltp ?? 0) > 0 ? 1 : 0;
      const pe = Number(row.PE?.ltp ?? 0) > 0 ? 1 : 0;
      return n + ce + pe;
    }, 0);
    const prevQuoteCount = (prev?.chain || []).reduce((n, row) => {
      const ce = Number(row.CE?.ltp ?? 0) > 0 ? 1 : 0;
      const pe = Number(row.PE?.ltp ?? 0) > 0 ? 1 : 0;
      return n + ce + pe;
    }, 0);

    // Don't replace a healthy cache with an all-zero refresh.
    if (liveQuoteCount === 0 && prevQuoteCount > 0 && prev) {
      console.log("[angel/option-chain] zero quotes — keeping stale cache", cacheKey);
      return NextResponse.json(prev);
    }

    const responseData = {
      symbol,
      expiry,
      exchange,
      spotPrice: spotPrice > 0 ? spotPrice : Number(prev?.spotPrice ?? 0),
      atmStrike: atmStrike > 0 ? atmStrike : Number(prev?.atmStrike ?? 0),
      expiries,
      chain: mergedChain,
      /** Where the underlying spot came from: "angel", "yahoo", or "none". */
      spotSource,
      /** True when the spot came from Yahoo's ~15-min delayed feed. */
      spotDelayed: spotSource === "yahoo",
      spotAsOf,
      /** True when some or all option quotes could not be refreshed. */
      quotesStale: quoteBatchFailed || liveQuoteCount === 0,
    };
    quoteCache.set(cacheKey, { data: responseData, fetchedAt: Date.now() });
    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error("[angel/option-chain]", err);
    // Stale chain beats an error screen. Yahoo can't stand in here — it
    // publishes no option chains for Indian instruments.
    const stale = cacheKey ? quoteCache.get(cacheKey) : undefined;
    if (stale) {
      console.log("[angel/option-chain] threw — serving stale cache");
      return NextResponse.json(stale.data);
    }
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 },
    );
  }
}
