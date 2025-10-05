import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diagram Prototyping Lab",
  description: "JSON-driven JSXGraph diagrams for AI-generated lesson content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/jsxgraph@1.11.1/distrib/jsxgraph.css"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
