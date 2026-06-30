"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/meta-pixel";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function RegisterForm() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);

  useEffect(() => {
    if (!inviteToken) return;
    fetch(`${API_URL}/family/invite/${inviteToken}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.invite) {
          setInviteData(data.invite);
          setEmail(data.invite.email_convidado);
          setName(data.invite.nome_membro);
          if (data.invite.whatsapp_membro) setWhatsapp(data.invite.whatsapp_membro);
        }
      })
      .catch(() => {});
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user) {
        trackEvent("CompleteRegistration", {
          content_name: "renda_viva_signup",
          status: "completed",
        });

        // Se veio de convite, aceitar automaticamente antes de redirecionar
        if (inviteToken) {
          const accessToken = (await supabase.auth.getSession()).data.session
            ?.access_token;
          if (accessToken) {
            await fetch(`${API_URL}/family/invite/${inviteToken}/accept`, {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}` },
            }).catch(() => {});
          }
          // Membro de família não precisa de onboarding/assinatura
          router.push("/dashboard");
          return;
        }

        router.push("/onboarding");
      }
    } catch (err) {
      setError("Erro ao criar conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid #D8F3DC",
    borderRadius: "10px",
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
    color: "#1B2A22",
    outline: "none",
    boxSizing: "border-box" as const,
    background: "#FFFFFF",
  };

  const labelStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: "13px",
    fontWeight: 500,
    color: "#1B4332",
    display: "block",
    marginBottom: "6px",
  };

  return (
    <>
      <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: "22px", color: "#1B4332", marginBottom: "6px", marginTop: 0 }}>
        Criar sua Conta
      </h2>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#5A6B62", marginBottom: "28px", marginTop: 0 }}>
        {inviteData ? "Crie sua conta para entrar na família" : "Grátis por 14 dias, sem cartão de crédito"}
      </p>

      {inviteData && (
        <div style={{ padding: "12px 14px", background: "#D8F3DC", border: "1px solid #95D5B2", borderRadius: "10px", marginBottom: "20px", fontSize: "13px", color: "#1B4332", fontFamily: "Inter, sans-serif" }}>
          🏠 Você foi convidado para a família <strong>{inviteData.families?.nome}</strong>. Crie sua conta para aceitar o convite.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: "12px 14px", background: "#FEF2F0", border: "1px solid #F5C6C0", borderRadius: "10px", color: "#C44B35", fontSize: "13px", fontFamily: "Inter, sans-serif", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Nome Completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maria Silva"
            required
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            readOnly={!!inviteData}
            style={inviteData ? { ...inputStyle, background: "#F5F8F6", color: "#5A6B62" } : inputStyle}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>WhatsApp</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+55 11 9XXXX-XXXX"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Confirmar Senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={inputStyle}
          />
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "#5A6B62", fontFamily: "Inter, sans-serif", marginBottom: "20px", cursor: "pointer" }}>
          <input type="checkbox" required style={{ marginTop: "2px", accentColor: "#2D6A4F" }} />
          <span>
            Concordo com os{" "}
            <Link href="/termos" style={{ color: "#2D6A4F", textDecoration: "none" }}>Termos de Uso</Link>
            {" "}e{" "}
            <Link href="/privacidade" style={{ color: "#2D6A4F", textDecoration: "none" }}>Política de Privacidade</Link>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "13px",
            background: loading ? "#74C69D" : "#2D6A4F",
            color: "#FFFFFF", border: "none", borderRadius: "10px",
            fontFamily: "Poppins, sans-serif", fontSize: "15px",
            fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.2s",
          }}
        >
          {loading ? "Criando conta..." : "Criar Minha Conta"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: "13px", color: "#5A6B62", marginTop: "20px", fontFamily: "Inter, sans-serif" }}>
        Já tem uma conta?{" "}
        <Link href="/login" style={{ color: "#2D6A4F", fontWeight: 500, textDecoration: "none" }}>
          Entrar
        </Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
