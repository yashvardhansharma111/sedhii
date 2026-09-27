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
    "https://www.dropbox.com/scl/fi/bo8l54dy1knj08byhxf7q/sedhii.apk?rlkey=wvt2hehln02e2o2rucrh59rst&st=o6snlsbr&dl=1",
} as const;
