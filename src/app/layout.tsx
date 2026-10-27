import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALIBI.exe — The interview room is open",
  description: "A cinematic, five-round interrogation game about evidence and doubt.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
