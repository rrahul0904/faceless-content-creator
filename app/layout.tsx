import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faceless Creator — Autonomous short-form content",
  description: "Discover, script, render, approve, publish, and learn from faceless short-form content."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
