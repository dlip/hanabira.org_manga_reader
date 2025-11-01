import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "hanabira.org Manga Reader",
  description: "Enhanced mokuro manga reader with Japanese text sidebar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <ToastProvider>
          <div className="flex-1">
            {children}
          </div>
        </ToastProvider>
        <footer className="w-full py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-10">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center space-y-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Made with love by{' '}
                <a 
                  href="https://hanabira.org" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  hanabira.org
                </a>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
                <div>
                  GitHub:{' '}
                  <a 
                    href="https://github.com/tristcoil/hanabira.org" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    tristcoil/hanabira.org
                  </a>
                </div>
                <div>
                  Uses:{' '}
                  <a 
                    href="https://github.com/kha-white/mokuro" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    Mokuro
                  </a>
                  {' '}for OCR manga files
                </div>
                <div>
                  Legal manga:{' '}
                  <a 
                    href="https://bookwalker.jp/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    BookWalker
                  </a>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
