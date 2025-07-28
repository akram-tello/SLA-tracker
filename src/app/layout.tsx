import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from 'next-themes';

export const metadata: Metadata = {
  title: "SLA Tracker Dashboard",
  description: "Monitor order processing performance across brands and countries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <div className="min-h-screen bg-gray-50 dark:bg-black">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
