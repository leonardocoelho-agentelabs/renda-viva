"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    // Verifica se há sessão válida (vinda do link do email)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValidSession(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("As senhas não coincidem"); return; }
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres"); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) { setError(authError.message); return; }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Erro ao redefinir senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inp = { width:"100%", padding:"11px 14px", border:"1.5px solid #D8F3DC", borderRadius:"10px", fontFamily:"Inter,sans-serif", fontSize:"14px", color:"#1B2A22", outline:"none", boxSizing:"border-box" as const, background:"#FFFFFF", marginBottom:"16px" };
  const lbl = { fontFamily:"Inter,sans-serif", fontSize:"13px", fontWeight:500, color:"#1B4332", display:"block", marginBottom:"6px" };

  if (success) {
    return (
      <>
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <div style={{ width:"56px", height:"56px", borderRadius:"50%", background:"#D8F3DC", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontFamily:"Poppins,sans-serif", fontWeight:600, fontSize:"22px", color:"#1B4332", marginBottom:"8px", marginTop:0 }}>Senha redefinida!</h2>
          <p style={{ fontFamily:"Inter,sans-serif", fontSize:"14px", color:"#5A6B62", lineHeight:1.6, marginTop:0 }}>
            Sua senha foi atualizada com sucesso. Redirecionando para o login...
          </p>
        </div>
        <Link href="/login" style={{ display:"block", textAlign:"center", padding:"13px", background:"#2D6A4F", color:"#FFFFFF", borderRadius:"10px", fontFamily:"Poppins,sans-serif", fontSize:"15px", fontWeight:600, textDecoration:"none" }}>
          Ir para o login
        </Link>
      </>
    );
  }

  if (!validSession) {
    return (
      <>
        <h2 style={{ fontFamily:"Poppins,sans-serif", fontWeight:600, fontSize:"22px", color:"#1B4332", marginBottom:"8px", marginTop:0 }}>Link inválido</h2>
        <p style={{ fontFamily:"Inter,sans-serif", fontSize:"14px", color:"#5A6B62", lineHeight:1.6, marginBottom:"24px", marginTop:0 }}>
          Este link de redefinição é inválido ou já expirou. Solicite um novo link.
        </p>
        <Link href="/forgot-password" style={{ display:"block", textAlign:"center", padding:"13px", background:"#2D6A4F", color:"#FFFFFF", borderRadius:"10px", fontFamily:"Poppins,sans-serif", fontSize:"15px", fontWeight:600, textDecoration:"none" }}>
          Solicitar novo link
        </Link>
      </>
    );
  }

  return (
    <>
      <h2 style={{ fontFamily:"Poppins,sans-serif", fontWeight:600, fontSize:"22px", color:"#1B4332", marginBottom:"6px", marginTop:0 }}>Nova senha</h2>
      <p style={{ fontFamily:"Inter,sans-serif", fontSize:"13px", color:"#5A6B62", marginBottom:"28px", marginTop:0 }}>
        Digite e confirme sua nova senha abaixo.
      </p>
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding:"12px 14px", background:"#FEF2F0", border:"1px solid #F5C6C0", borderRadius:"10px", color:"#C44B35", fontSize:"13px", marginBottom:"16px" }}>
            {error}
          </div>
        )}
        <div><label style={lbl}>Nova senha</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={inp}/></div>
        <div><label style={lbl}>Confirmar nova senha</label><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="••••••••" required style={{...inp, marginBottom:"20px"}}/></div>
        <button type="submit" disabled={loading} style={{ width:"100%", padding:"13px", background:loading?"#74C69D":"#2D6A4F", color:"#FFFFFF", border:"none", borderRadius:"10px", fontFamily:"Poppins,sans-serif", fontSize:"15px", fontWeight:600, cursor:loading?"not-allowed":"pointer" }}>
          {loading ? "Salvando..." : "Redefinir senha"}
        </button>
      </form>
    </>
  );
}
