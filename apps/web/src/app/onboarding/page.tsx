"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const riskProfiles = [
  {
    value: "conservador",
    label: "Conservador",
    description: "Prefiro segurança, aceito menor rentabilidade",
    icon: "🛡️",
  },
  {
    value: "moderado",
    label: "Moderado",
    description: "Busco equilíbrio entre segurança e rentabilidade",
    icon: "⚖️",
  },
  {
    value: "agressivo",
    label: "Agressivo",
    description: "Aceito riscos por maior potencial de retorno",
    icon: "🚀",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [rendaMensal, setRendaMensal] = useState("");
  const [perfilRisco, setPerfilRisco] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleNext = () => {
    if (step === 1 && !rendaMensal) {
      setError("Informe sua renda mensal");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleFinish = async () => {
    if (!perfilRisco) {
      setError("Selecione seu perfil de investidor");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error: updateError } = await supabase
        .from("users")
        .upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
          renda_mensal: parseFloat(rendaMensal.replace(",", ".")) || 0,
          perfil_risco: perfilRisco,
        });

      if (updateError) {
        console.error("Erro ao atualizar perfil:", updateError);
      }

      router.push("/dashboard");
    } catch (err) {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-600">Renda Viva</h1>
          <p className="text-gray-600 mt-2">Vamos configurar sua conta</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          <div className={cn("flex-1 h-2 rounded-full", step >= 1 ? "bg-green-600" : "bg-gray-200")} />
          <div className={cn("flex-1 h-2 rounded-full", step >= 2 ? "bg-green-600" : "bg-gray-200")} />
        </div>

        <Card className="p-8">
          {/* Step 1: Renda */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Qual sua renda mensal?
              </h2>
              <p className="text-gray-500 mb-6">
                Isso nos ajuda a entender melhor seu perfil financeiro.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Renda mensal (R$)
                </label>
                <Input
                  type="number"
                  value={rendaMensal}
                  onChange={(e) => setRendaMensal(e.target.value)}
                  placeholder="3.500,00"
                />
              </div>

              <Button onClick={handleNext} className="w-full">
                Continuar
              </Button>
            </div>
          )}

          {/* Step 2: Perfil de Risco */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Qual seu perfil de investidor?
              </h2>
              <p className="text-gray-500 mb-6">
                Escolha o perfil que mais combina com você.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-3 mb-6">
                {riskProfiles.map((profile) => (
                  <button
                    key={profile.value}
                    type="button"
                    onClick={() => setPerfilRisco(profile.value)}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 text-left transition-all",
                      perfilRisco === profile.value
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{profile.icon}</span>
                      <div>
                        <p className="font-medium text-gray-900">{profile.label}</p>
                        <p className="text-sm text-gray-500">{profile.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleFinish} className="flex-1" loading={loading}>
                  Começar
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}