import Link from "next/link";
import { BrandMark } from "@/components/site/BrandMark";
import { SITE } from "@/lib/site";

const APK_URL = SITE.apkUrl;

/* Marketing ticker — illustrative last prices, not a live feed. Up moves show
   green, down moves brand red (conventional trading read). */
const TICKER = [
  { sym: "NIFTY 50", price: "23,119.70", chg: "+0.26%", up: true },
  { sym: "BANK NIFTY", price: "55,619.90", chg: "+0.41%", up: true },
  { sym: "SENSEX", price: "73,900.06", chg: "-0.12%", up: false },
  { sym: "RELIANCE", price: "1,225.00", chg: "+0.45%", up: true },
  { sym: "HDFCBANK", price: "1,672.40", chg: "-0.31%", up: false },
  { sym: "TCS", price: "3,984.10", chg: "+0.68%", up: true },
  { sym: "INFY", price: "1,540.55", chg: "-0.22%", up: false },
  { sym: "GOLD", price: "72,480", chg: "+0.54%", up: true },
  { sym: "SILVER", price: "89,110", chg: "+1.02%", up: true },
  { sym: "CRUDE", price: "6,254", chg: "-0.88%", up: false },
];

const STATS = [
  { value: "1,000+", label: "Symbols tracked live" },
  { value: "6", label: "Timeframes · 1m → 1W" },
  { value: "< 2s", label: "Tick-to-chart latency" },
  { value: "3", label: "Exchanges · NSE / BSE / MCX" },
];

const FAQS = [
  {
    q: "How do I get an account?",
    a: "Download the Android app and register with your KYC details. Our admin team verifies your submission and issues your login credentials — usually within 24 hours.",
  },
  {
    q: "How fresh is the market data?",
    a: "Live indices, equities and commodities stream with under two seconds of tick-to-chart latency during market hours, sourced from the exchange feed.",
  },
  {
    q: "Which platforms are supported?",
    a: "The full trading experience — charts, orders, funds and ledger — lives in the Android app. Account administration is handled on the web.",
  },
  {
    q: "Is my money at risk?",
    a: "This is a simulated (paper trading) environment for practice and education. No real money is invested, deposited, or withdrawn.",
  },
];

function DownloadButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={APK_URL}
      className={`inline-flex items-center gap-2.5 rounded-full bg-primary px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary-dark hover:shadow-xl hover:shadow-primary/35 active:scale-[0.97] ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download APK
    </a>
  );
}

function TickerRow() {
  return (
    <div className="flex shrink-0 items-center">
      {TICKER.map((t) => (
        <span key={t.sym} className="mx-4 inline-flex items-center gap-2 whitespace-nowrap text-sm">
          <span className="font-semibold text-foreground">{t.sym}</span>
          <span className="text-text-secondary">{t.price}</span>
          <span className={t.up ? "font-medium text-[#15803d]" : "font-medium text-negative"}>
            {t.chg}
          </span>
          <span aria-hidden className="ml-2 text-border">•</span>
        </span>
      ))}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group border-b border-border/80 py-8 transition first:pt-0 last:border-b-0 sm:border sm:rounded-2xl sm:border-border sm:bg-surface/80 sm:p-6 sm:backdrop-blur-sm sm:first:pt-6 sm:last:border sm:hover:border-primary/25 sm:hover:shadow-lg sm:hover:shadow-primary/5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-muted text-primary transition group-hover:bg-primary group-hover:text-white">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{description}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="site-root brand-atmosphere flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-surface/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <BrandMark />
          <nav className="hidden items-center gap-8 text-sm font-medium text-text-secondary md:flex">
            <a href="#features" className="transition hover:text-primary">Features</a>
            <a href="#how-it-works" className="transition hover:text-primary">How it works</a>
            <a href="#security" className="transition hover:text-primary">Security</a>
            <a href="#faq" className="transition hover:text-primary">FAQ</a>
          </nav>
          <DownloadButton className="hidden sm:inline-flex !px-5 !py-2.5 !text-sm" />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="relative mx-auto flex min-h-[70vh] max-w-6xl flex-col items-center justify-center px-5 py-20 text-center lg:py-28">
            <BrandMark size="lg" href={null} className="mb-8 justify-center" />
            <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.12] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
              Trade smarter. Wherever you are.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
              Live charts, orders, funds and a running ledger — all in one place.
              Take Sedhii with you on Android. One account, every market.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
              <DownloadButton />
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-7 py-3.5 text-[15px] font-semibold text-foreground transition hover:border-accent/40 hover:bg-accent-muted"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* Live-markets ticker */}
        <section aria-label="Live markets" className="border-y border-border/70 bg-surface/70">
          <div className="ticker-mask relative overflow-hidden py-3.5">
            <div className="ticker-track">
              <TickerRow />
              <TickerRow />
            </div>
            {/* edge fades */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-surface to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-surface to-transparent" />
          </div>
        </section>

        {/* Stats */}
        <section className="border-b border-border/70 bg-surface/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-12 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center sm:text-left">
                <p className="font-display text-3xl font-semibold text-primary sm:text-4xl">{s.value}</p>
                <p className="mt-1.5 text-xs leading-snug text-text-secondary sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Features</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Institutional-grade data, served simply
              </h2>
              <p className="mt-4 text-text-secondary">Speed, clarity and control — without the clutter.</p>
            </div>
            <div className="mt-12 grid gap-0 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              <FeatureCard
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
                title="Real-time candlestick charts"
                description="Six timeframes from 1-minute to 1-week, with under two seconds of tick-to-chart latency."
              />
              <FeatureCard
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
                title="Orders & ledger"
                description="Order history, live positions and a running P&L ledger you can download as CSV."
              />
              <FeatureCard
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
                title="Markets feed"
                description="Indices, equities and commodities across NSE, BSE and MCX — streamed in one feed."
              />
              <FeatureCard
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                title="Fund management"
                description="Deposit, withdraw and track margin utilisation and drawdown in real time."
              />
              <FeatureCard
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>}
                title="Watchlist & alerts"
                description="Custom watchlists and price alerts so you never miss a move."
              />
              <FeatureCard
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                title="Secure & private"
                description="Encrypted auth, secure document uploads and admin-approved accounts."
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-border/70 bg-surface/50 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">How it works</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Live in three steps
              </h2>
            </div>
            <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {[
                { step: "01", title: "Request an account", desc: "Download the app and submit your KYC details to request access." },
                { step: "02", title: "Get verified", desc: "Our admin team verifies your details and issues your login credentials." },
                { step: "03", title: "Sign in and trade", desc: "Fund your account and trade live across indices, equities and commodities." },
              ].map((item) => (
                <div key={item.step} className="text-center sm:text-left">
                  <p className="font-display text-4xl font-semibold text-primary/25">{item.step}</p>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Security</p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Built to be trusted
                </h2>
                <p className="mt-4 max-w-md text-text-secondary">
                  Every account is reviewed and approved before it goes live. Access
                  is guarded end to end, and simulated balances keep real money out of harm.
                </p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {[
                  { t: "Admin-approved accounts", d: "No self-serve access — every login is issued after review." },
                  { t: "Encrypted authentication", d: "Credentials are hashed; sessions are token-guarded." },
                  { t: "Secure document uploads", d: "KYC documents are stored privately, not publicly served." },
                  { t: "Simulated balances", d: "Paper trading only — no real funds ever move." },
                ].map((f) => (
                  <li key={f.t} className="rounded-2xl border border-border bg-surface/80 p-5">
                    <p className="text-sm font-semibold text-foreground">{f.t}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{f.d}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Download CTA */}
        <section id="download" className="pb-20 lg:pb-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary via-primary-dark to-accent-dark px-8 py-16 text-center text-white sm:px-16 lg:py-20">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.16),transparent_55%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_85%,rgba(142,27,27,0.28),transparent_45%)]" />
              <div className="relative">
                <p className="font-display text-3xl font-semibold sm:text-4xl">Take the markets with you</p>
                <p className="mx-auto mt-4 max-w-md text-white/80">
                  Download Sedhii for Android and start trading today — clear tools, real execution, no clutter.
                </p>
                <div className="mt-10">
                  <a
                    href={APK_URL}
                    className="inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-[15px] font-bold text-primary shadow-lg transition hover:bg-white/90 active:scale-[0.97]"
                  >
                    Download APK for Android
                  </a>
                </div>
                <p className="mt-4 text-xs text-white/50">Android 8.0+ required · ~15 MB</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border/70 bg-surface/50 py-20 lg:py-28">
          <div className="mx-auto max-w-3xl px-5">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">FAQ</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Questions, answered
              </h2>
            </div>
            <div className="mt-12 divide-y divide-border/80 overflow-hidden rounded-2xl border border-border bg-surface/80">
              {FAQS.map((f) => (
                <details key={f.q} className="group px-6 py-5 [&_summary]:list-none">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15px] font-semibold text-foreground">
                    {f.q}
                    <svg className="h-5 w-5 shrink-0 text-text-secondary transition group-open:rotate-45" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-surface/70">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-3">
              <BrandMark size="sm" />
              <p className="text-xs leading-relaxed text-text-secondary">
                Trade smarter across indices, equities &amp; commodities — one account, every market.
              </p>
              <p className="mt-2 text-xs text-text-secondary">
                &copy; {new Date().getFullYear()} Sedhii. All rights reserved.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-semibold text-foreground">Product</p>
              <a href="#features" className="text-text-secondary transition hover:text-primary">Features</a>
              <a href="#how-it-works" className="text-text-secondary transition hover:text-primary">How it works</a>
              <a href="#security" className="text-text-secondary transition hover:text-primary">Security</a>
              <a href={APK_URL} className="font-medium text-primary transition hover:text-primary-dark">Download APK</a>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-semibold text-foreground">Account</p>
              <a href={APK_URL} className="text-text-secondary transition hover:text-primary">Get the app</a>
              <a href={`mailto:${SITE.supportEmail}`} className="text-text-secondary transition hover:text-primary">Support</a>
              {/* Discreet staff entry — small and low-key, but findable */}
              <Link
                href={SITE.adminUrl}
                rel="nofollow"
                className="text-xs text-text-secondary/50 transition hover:text-primary"
              >
                Admin
              </Link>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-semibold text-foreground">Legal</p>
              <Link href="/privacy-policy" className="text-text-secondary transition hover:text-primary">Privacy Policy</Link>
              <a href={`mailto:${SITE.supportEmail}`} className="text-text-secondary transition hover:text-primary">{SITE.supportEmail}</a>
            </div>
          </div>

          <div className="mt-10 border-t border-border/60 pt-5">
            <p className="text-[11px] text-text-secondary">
              Simulated trading only — no real money is invested, deposited or withdrawn.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
