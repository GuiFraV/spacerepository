import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "À la lisière du possible — Portfolio spatial",
    description: "Un portfolio 3D interactif : prenez les commandes du Voyager et explorez des mondes créatifs.",
    openGraph: {
      title: "À la lisière du possible",
      description: "Prenez les commandes du Voyager et explorez un portfolio au cœur de l’espace.",
      type: "website",
      images: [{ url: new URL("/og.png", origin).toString(), width: 1672, height: 941, alt: "Le Voyager face à une singularité lumineuse" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "À la lisière du possible",
      description: "Un portfolio spatial en 3D, calme et interactif.",
      images: [new URL("/og.png", origin).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
