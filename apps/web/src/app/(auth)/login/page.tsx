"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", data.user.id)
          .single();

        if (!profile?.full_name) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err) {
      setError("Erro ao fazer login. Tente novamente.");
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
        Acesse sua Conta
      </h2>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#5A6B62", marginBottom: "28px", marginTop: 0 }}>
        Bem-vindo de volta ao Renda Viva
      </p>

      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: "12px 14px", background: "#FEF2F0", border: "1px solid #F5C6C0", borderRadius: "10px", color: "#C44B35", fontSize: "13px", fontFamily: "Inter, sans-serif", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "8px" }}>
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

        <div style={{ textAlign: "right", marginBottom: "20px" }}>
          <Link href="/forgot-password" style={{ fontSize: "12px", color: "#2D6A4F", textDecoration: "none", fontFamily: "Inter, sans-serif" }}>
            Esqueceu sua senha?
          </Link>
        </div>

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
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: "13px", color: "#5A6B62", marginTop: "20px", fontFamily: "Inter, sans-serif" }}>
        Não tem uma conta?{" "}
        <Link href="/register" style={{ color: "#2D6A4F", fontWeight: 500, textDecoration: "none" }}>
          Criar conta
        </Link>
      </p>
    </>
  );
}
