import Script from "next/script";
import "./globals.css";
import CustomThemeProvider from "./providers/theme-provider";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import ChunkErrorRecovery from "./components/chunk-error-recovery";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://ittefaqironandcementstore.cloud"),
  title: "Ittefaq Iron and Cement Store",
  description: "Ittefaq Iron and Cement Store - Point of Sale System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body
        className="antialiased"
        suppressHydrationWarning={true}
      >
        <ChunkErrorRecovery />
        <Script src="/websdk.client.js" strategy="beforeInteractive" />
        <AppRouterCacheProvider>
          <CustomThemeProvider>
            {children}
          </CustomThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
