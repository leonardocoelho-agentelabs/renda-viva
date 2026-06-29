import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .auth-container {
          display: flex;
          height: 100vh;
          width: 100%;
          overflow: hidden;
        }
        .auth-left {
          width: 50%;
          background: #1B4332;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }
        .auth-right {
          flex: 1;
          background: #F5F8F6;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
          overflow-y: auto;
        }
        .auth-card {
          width: 100%;
          max-width: 400px;
          background: #FFFFFF;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 4px 32px rgba(27,67,50,0.08);
          border: 1px solid rgba(27,67,50,0.07);
          position: relative;
        }
        .auth-mobile-logo {
          display: none;
        }

        @media (max-width: 768px) {
          .auth-container {
            flex-direction: column;
            height: auto;
            min-height: 100vh;
            overflow: auto;
          }
          .auth-left {
            display: none;
          }
          .auth-right {
            flex: none;
            width: 100%;
            min-height: 100vh;
            padding: 32px 20px;
            align-items: flex-start;
            background: #F5F8F6;
          }
          .auth-card {
            padding: 28px 20px;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(27,67,50,0.08);
            border: 1px solid rgba(27,67,50,0.07);
            background: #FFFFFF;
            max-width: 100%;
          }
          .auth-mobile-logo {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 28px;
          }
        }
      `}</style>

      <div className="auth-container">

        {/* ===== COLUNA ESQUERDA — BRANDING ===== */}
        <div className="auth-left">

          {/* Folha decorativa de fundo */}
          <svg
            style={{ position: "absolute", bottom: "-80px", left: "-80px", opacity: 0.07, pointerEvents: "none" }}
            width="500" height="500" viewBox="0 0 200 200" fill="none"
          >
            <path d="M100 10 C140 10 180 50 180 100 C180 150 140 190 100 190 C60 190 10 160 10 100 C10 40 60 10 100 10 Z" fill="#52B788"/>
            <path d="M100 10 L100 190" stroke="#95D5B2" strokeWidth="2" opacity="0.5"/>
            <path d="M10 100 C40 70 160 70 190 100" stroke="#95D5B2" strokeWidth="1.5" opacity="0.3"/>
            <path d="M20 130 C60 100 140 100 180 130" stroke="#95D5B2" strokeWidth="1" opacity="0.2"/>
          </svg>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 1 }}>
            <svg viewBox="0 0 120 120" width="44" height="44">
              <circle cx="60" cy="60" r="60" fill="#FFFFFF"/>
              <text x="58" y="63" textAnchor="middle" dominantBaseline="central"
                    fontFamily="Poppins, sans-serif" fontWeight="700" fontSize="52"
                    letterSpacing="-4" fill="#2D6A4F">RV</text>
              <g transform="translate(83 30) rotate(33)">
                <path d="M0,-13 C8,-8 8,5 0,13 C-8,5 -8,-8 0,-13 Z" fill="#52B788"/>
                <path d="M0,-10 L0,10" stroke="#2D6A4F" strokeWidth="1.5"
                      strokeLinecap="round" fill="none" opacity="0.6"/>
              </g>
            </svg>
            <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "20px", color: "#FFFFFF" }}>
              Renda<span style={{ color: "#52B788" }}>Viva</span>
            </span>
          </div>

          {/* Copy central */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <h1 style={{
              fontFamily: "Poppins, sans-serif", fontWeight: 700,
              fontSize: "36px", lineHeight: 1.2, color: "#FFFFFF",
              marginBottom: "16px", marginTop: 0,
            }}>
              Organize suas<br />
              Finanças com<br />
              <span style={{ color: "#52B788" }}>Inteligência Artificial</span>
            </h1>
            <p style={{
              fontFamily: "Inter, sans-serif", fontSize: "14px",
              color: "#95D5B2", lineHeight: 1.7,
              maxWidth: "300px", marginBottom: "40px", marginTop: 0,
            }}>
              Categorização automática, alertas no WhatsApp e um assistente
              financeiro disponível 24h. Grátis por 14 dias.
            </p>

            {/* Grade de ícones 2x2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", maxWidth: "220px" }}>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(82,183,136,0.15)", border: "1px solid rgba(82,183,136,0.25)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#52B788" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <span style={{ fontSize: "11px", color: "#74C69D", textAlign: "center", fontFamily: "Inter, sans-serif", lineHeight: 1.4 }}>Relatórios<br/>automáticos</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(82,183,136,0.15)", border: "1px solid rgba(82,183,136,0.25)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#52B788" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                </div>
                <span style={{ fontSize: "11px", color: "#74C69D", textAlign: "center", fontFamily: "Inter, sans-serif", lineHeight: 1.4 }}>Dashboard<br/>inteligente</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(82,183,136,0.15)", border: "1px solid rgba(82,183,136,0.25)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#52B788" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
                  </svg>
                </div>
                <span style={{ fontSize: "11px", color: "#74C69D", textAlign: "center", fontFamily: "Inter, sans-serif", lineHeight: 1.4 }}>Alertas no<br/>WhatsApp</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(82,183,136,0.15)", border: "1px solid rgba(82,183,136,0.25)", position: "relative" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#52B788" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <div style={{ position: "absolute", top: "-4px", right: "-4px", width: "16px", height: "16px", borderRadius: "50%", background: "#52B788", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
                <span style={{ fontSize: "11px", color: "#74C69D", textAlign: "center", fontFamily: "Inter, sans-serif", lineHeight: 1.4 }}>Assistente<br/>IA Viva</span>
              </div>

            </div>
          </div>

          {/* Rodapé */}
          <p style={{ position: "relative", zIndex: 1, fontSize: "12px", color: "rgba(149,213,178,0.5)", fontFamily: "Inter, sans-serif", margin: 0 }}>
            🔒 Seguro · Open Finance BACEN
          </p>

        </div>

        {/* ===== COLUNA DIREITA — children (login ou cadastro) ===== */}
        <div className="auth-right">

          {/* Logo visível APENAS no mobile */}
          <div className="auth-mobile-logo">
            <svg viewBox="0 0 120 120" width="36" height="36">
              <circle cx="60" cy="60" r="60" fill="#2D6A4F"/>
              <text x="58" y="63" textAnchor="middle" dominantBaseline="central"
                    fontFamily="Poppins, sans-serif" fontWeight="700" fontSize="52"
                    letterSpacing="-4" fill="#FFFFFF">RV</text>
              <g transform="translate(83 30) rotate(33)">
                <path d="M0,-13 C8,-8 8,5 0,13 C-8,5 -8,-8 0,-13 Z" fill="#52B788"/>
                <path d="M0,-10 L0,10" stroke="#2D6A4F" strokeWidth="1.5"
                      strokeLinecap="round" fill="none" opacity="0.6"/>
              </g>
            </svg>
            <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600,
                           fontSize: "20px", color: "#1B4332" }}>
              Renda<span style={{ color: "#52B788" }}>Viva</span>
            </span>
          </div>

          {/* Card do formulário */}
          <div className="auth-card">
            {children}
          </div>

        </div>
      </div>
    </>
  );
}
