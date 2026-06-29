"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      setSent(true);
    } catch {
      setError("Erro ao enviar email. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inp = { width:"100%", padding:"11px 14px", border:"1.5px solid #D8F3DC", borderRadius:"10px", fontFamily:"Inter,sans-serif", fontSize:"14px", color:"#1B2A22", outline:"none", boxSizing:"border-box" as const, background:"#FFFFFF", marginBottom:"16px" };
  const lbl = { fontFamily:"Inter,sans-serif", fontSize:"13px", fontWeight:500, color:"#1B4332", display:"block", marginBottom:"6px" };

  if (sent) {
    return (
      <>
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <div style={{ width:"56px", height:"56px", borderRadius:"50%", background:"#D8F3DC", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontFamily:"Poppins,sans-serif", fontWeight:600, fontSize:"22px", color:"#1B4332", marginBottom:"8px", marginTop:0 }}>Email enviado!</h2>
          <p style={{ fontFamily:"Inter,sans-serif", fontSize:"14px", color:"#5A6B62", lineHeight:1.6, marginTop:0 }}>
            Enviamos um link de redefinição para <strong style={{ color:"#1B4332" }}>{email}</strong>. Verifique sua caixa de entrada e spam.
          </p>
        </div>
        <Link href="/login" style={{ display:"block", textAlign:"center", padding:"13px", background:"#2D6A4F", color:"#FFFFFF", borderRadius:"10px", fontFamily:"Poppins,sans-serif", fontSize:"15px", fontWeight:600, textDecoration:"none" }}>
          Voltar para o login
        </Link>
      </>
    );
  }

  return (
    <>
      <h2 style={{ fontFamily:"Poppins,sans-serif", fontWeight:600, fontSize:"22px", color:"#1B4332", marginBottom:"6px", marginTop:0 }}>Redefinir senha</h2>
      <p style={{ fontFamily:"Inter,sans-serif", fontSize:"13px", color:"#5A6B62", marginBottom:"28px", marginTop:0 }}>
        Digite seu email e enviaremos um link para redefinir sua senha.
      </p>
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding:"12px 14px", background:"#FEF2F0", border:"1px solid #F5C6C0", borderRadius:"10px", color:"#C44B35", fontSize:"13px", marginBottom:"16px" }}>
            {error}
          </div>
        )}
        <div><label style={lbl}>E-mail</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required style={inp}/></div>
        <button type="submit" disabled={loading} style={{ width:"100%", padding:"13px", background:loading?"#74C69D":"#2D6A4F", color:"#FFFFFF", border:"none", borderRadius:"10px", fontFamily:"Poppins,sans-serif", fontSize:"15px", fontWeight:600, cursor:loading?"not-allowed":"pointer" }}>
          {loading ? "Enviando..." : "Enviar link de redefinição"}
        </button>
      </form>
      <p style={{ textAlign:"center", fontSize:"13px", color:"#5A6B62", marginTop:"20px", fontFamily:"Inter,sans-serif" }}>
        Lembrou a senha?{" "}
        <Link href="/login" style={{ color:"#2D6A4F", fontWeight:500, textDecoration:"none" }}>Voltar ao login</Link>
      </p>
    </>
  );
}
