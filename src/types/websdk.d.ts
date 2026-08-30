declare module "WebSdk";

declare global {
  interface Window {
    WebSdk?: unknown;
    WebSdkCore?: unknown;
  }
}

export {};
