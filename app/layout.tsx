import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mol Lens",
  description: "Paste any chemistry paragraph. See the molecules.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script src="https://3Dmol.org/build/3Dmol-min.js" async />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
