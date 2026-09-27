/**
 * Brand-wide links for the marketing/landing surface of the app.
 * Change them here, not in the page.
 */
export const SITE = {
  name: "Sedhii",
  supportEmail: "support@sedhiii.in",

  /** Admin panel — internal route in this same app. Linked only from the
   *  faint footer dot, never from the nav. */
  adminUrl: "/admin",

  /** Android build. Swap this one constant when a new APK ships. */
  apkUrl:
    "https://www.dropbox.com/scl/fi/xfh7g6jiltsewbd00w5i8/Zero-Dha0.apk?rlkey=jntlyflev4hnm7clugspv8f7v&st=hpczrtu5&dl=1",
} as const;
