import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "../../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Renda Viva — Renda inteligente, viva.",
  description:
    "Gestão financeira pessoal com inteligência artificial. Transações automáticas, dashboard inteligente, orçamento adaptativo e assistente financeiro IA.",
  keywords: [
    "gestão financeira",
    "finanças pessoais",
    "inteligência artificial",
    "controle de gastos",
    "orçamento",
    "investimentos",
    "fintech",
    "brasil",
  ],
  authors: [{ name: "Renda Viva" }],
  openGraph: {
    title: "Renda Viva — Renda inteligente, viva.",
    description:
      "Gestão financeira pessoal com inteligência artificial. Transações automáticas, dashboard inteligente, orçamento adaptativo e assistente financeiro IA.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased bg-rv-page text-rv-ink">
        {children}
      </body>
    </html>
  );
}
