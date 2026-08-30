/**
 * Returns the base application URL from environment variables or browser context.
 */
export function getAppBaseUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://ittefaqironandcementstore.cloud"
  );
}
