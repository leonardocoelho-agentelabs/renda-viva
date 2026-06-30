"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/meta-pixel";

/**
 * Eventos de Pixel da landing page (rota /).
 * A landing é renderizada via dangerouslySetInnerHTML (HTML bruto, sem <Link>
 * de JSX), então usamos delegação de evento para os CTAs de registro e um
 * IntersectionObserver na seção de preço — sem alterar o HTML da landing.
 *   - Lead: clique em qualquer CTA que aponta para /register
 *   - ViewContent: scroll até a seção #preco
 */
export function LandingPixelEvents() {
  useEffect(() => {
    // Lead — delegação de clique nos CTAs "Começar agora" / "Quero organizar..."
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('a[href="/register"]')) {
        trackEvent("Lead", { content_name: "cta_landing_page" });
      }
    };
    document.addEventListener("click", onClick);

    // ViewContent — quando a seção de preço entra na viewport
    let observer: IntersectionObserver | undefined;
    const precoSection = document.getElementById("preco");
    if (precoSection) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              trackEvent("ViewContent", { content_name: "pricing_section" });
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      observer.observe(precoSection);
    }

    return () => {
      document.removeEventListener("click", onClick);
      observer?.disconnect();
    };
  }, []);

  return null;
}
