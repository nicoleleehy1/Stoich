import type { Metadata } from "next";
import { Lora, Inter, VT323 } from "next/font/google";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-vt323",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stoich",
  description: "Paste any chemistry paragraph. See the molecules.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${lora.variable} ${inter.variable} ${vt323.variable}`}
    >
      <head>
        <script src="https://3Dmol.org/build/3Dmol-min.js" async />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
