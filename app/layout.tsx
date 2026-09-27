import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";
import "./globals.css";

// Marketing fonts. Only the CSS variables are attached to <html>; the global
// body font stays Arial so the admin panel is unchanged. The .site-root scope
// in globals.css opts the landing + legal pages into Sora / Fraunces.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Sedhii — Paper Trading App",
    template: "%s · Sedhii",
  },
  description:
    "Sedhii is a paper trading (simulated) app for indices, equities & commodities. Practise the markets risk-free — no real money is invested.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${fraunces.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
