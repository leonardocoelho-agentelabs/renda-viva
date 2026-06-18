"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check } from "lucide-react";

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type CommitmentType = "assinatura" | "parcela";

const CATEGORIAS = [
  "Assinaturas",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Moradia",
  "Outros",
];

export function RecurringModal({ isOpen, onClose, onSuccess }: RecurringModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [step, setStep] = useState<1 | 2>(1);
  const [tipo, setTipo] = useState<CommitmentType | null>(null);
  const [loading, setLoading] = useState(false);

  // Formulário
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Assinaturas");
  const [valor, setValor] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("15");
  const [descricao, setDescricao] = useState("");
  const [alertaWhatsapp, setAlertaWhatsapp] = useState(true);

  // Campos exclusivos de parcela
  const [totalParcelas, setTotalParcelas] = useState("12");
  const [parcelasPagas, setParcelasPagas] = useState("0");
  const [dataInicio, setDataInicio] = useState(format(new Date(), "yyyy-MM-dd"));

  const resetForm = useCallback(() => {
    setStep(1);
    setTipo(null);
    setNome("");
    setCategoria("Assinaturas");
    setValor("");
    setDiaVencimento("15");
    setDescricao("");
    setAlertaWhatsapp(true);
    setTotalParcelas("12");
    setParcelasPagas("0");
    setDataInicio(format(new Date(), "yyyy-MM-dd"));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTipoSelect = (t: CommitmentType) => {
    setTipo(t);
    setStep(2);
  };

  const calcularProximoVencimento = useCallback(() => {
    const hoje = new Date();
    const dia = parseInt(diaVencimento) || 15;
    let proxima = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    if (proxima <= hoje) {
      proxima = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
    }
    return proxima;
  }, [diaVencimento]);

  const calcularParcelasRestantes = useCallback(() => {
    const total = parseInt(totalParcelas) || 0;
    const pagas = parseInt(parcelasPagas) || 0;
    return Math.max(0, total - pagas);
  }, [totalParcelas, parcelasPagas]);

  const calcularTotalRestante = useCallback(() => {
    const val = parseFloat(valor) || 0;
    return val * calcularParcelasRestantes();
  }, [valor, calcularParcelasRestantes]);

  const calcularDataQuitacao = useCallback(() => {
    const restantes = calcularParcelasRestantes();
    if (restantes === 0) return null;
    return addMonths(new Date(), restantes);
  }, [calcularParcelasRestantes]);

  const handleSubmit = async () => {
    if (!tipo || !nome.trim() || !valor || !diaVencimento) {
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Não autenticado");
      }

      const body: Record<string, unknown> = {
        nome: nome.trim(),
        categoria,
        tipo,
        valor: parseFloat(valor),
        dia_vencimento: parseInt(diaVencimento),
        descricao: descricao.trim() || undefined,
        alerta_whatsapp: alertaWhatsapp,
      };

      if (tipo === "parcela") {
        body.total_parcelas = parseInt(totalParcelas);
        body.parcelas_pagas = parseInt(parcelasPagas);
        body.data_inicio = dataInicio;
      }

      const res = await fetch(`${apiUrl}/recurring`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao criar compromisso");
      }

      handleClose();
      onSuccess();
    } catch (err) {
      console.error("Erro ao criar compromisso:", err);
      alert(err instanceof Error ? err.message : "Erro ao criar compromisso");
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    const val = parseFloat(valor) || 0;
    const proxVencimento = calcularProximoVencimento();

    if (tipo === "assinatura") {
      return (
        <div className="mt-4 p-3 bg-rv-mint/10 dark:bg-rv-green/10 rounded-lg border border-rv-forest/10 dark:border-rv-vivid/20">
          <p className="text-sm text-rv-forest dark:text-rv-vivid font-medium">
            📅 Preview da assinatura
          </p>
          <p className="text-sm text-rv-ink dark:text-[#F0F0F0] mt-1">
            Você pagará{" "}
            <strong>
              R$ {val.toFixed(2).replace(".", ",")}
            </strong>{" "}
            todo dia {diaVencimento}.
          </p>
          <p className="text-xs text-rv-muted mt-1">
            Próxima cobrança: {format(proxVencimento, "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      );
    }

    const restantes = calcularParcelasRestantes();
    const totalRestante = calcularTotalRestante();
    const dataQuitacao = calcularDataQuitacao();

    return (
      <div className="mt-4 p-3 bg-rv-mint/10 dark:bg-rv-green/10 rounded-lg border border-rv-forest/10 dark:border-rv-vivid/20">
        <p className="text-sm text-rv-forest dark:text-rv-vivid font-medium">
          💳 Preview da parcela
        </p>
        <p className="text-sm text-rv-ink dark:text-[#F0F0F0] mt-1">
          Parcelas restantes: <strong>{restantes}</strong> de {totalParcelas}
        </p>
        <p className="text-sm text-rv-ink dark:text-[#F0F0F0]">
          Total ainda a pagar:{" "}
          <strong>
            R$ {totalRestante.toFixed(2).replace(".", ",")}
          </strong>
        </p>
        {dataQuitacao && (
          <p className="text-xs text-rv-muted mt-1">
            Previsão de quitação: {format(dataQuitacao, "MMMM yyyy", { locale: ptBR })}
          </p>
        )}
        <p className="text-xs text-rv-muted">
          Próximo vencimento: dia {diaVencimento}
        </p>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-[#1E1E1E]">
        <DialogHeader>
          <DialogTitle className="font-[var(--font-poppins)] font-bold text-lg text-rv-ink dark:text-[#F0F0F0]">
            Novo Compromisso
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-rv-muted">
              Escolha o tipo de compromisso financeiro recorrente:
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleTipoSelect("assinatura")}
                className="flex flex-col items-center p-6 rounded-xl border-2 border-rv-forest/20 dark:border-rv-vivid/20 hover:border-rv-forest dark:hover:border-rv-vivid hover:bg-rv-mint/5 dark:hover:bg-rv-green/10 transition-all"
              >
                <span className="text-3xl mb-2">📅</span>
                <span className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                  Assinatura
                </span>
                <span className="text-xs text-rv-muted mt-1 text-center">
                  Sem prazo definido
                </span>
                <span className="text-xs text-rv-muted text-center">
                  Netflix, academia, streaming...
                </span>
              </button>

              <button
                onClick={() => handleTipoSelect("parcela")}
                className="flex flex-col items-center p-6 rounded-xl border-2 border-rv-forest/20 dark:border-rv-vivid/20 hover:border-rv-forest dark:hover:border-rv-vivid hover:bg-rv-mint/5 dark:hover:bg-rv-green/10 transition-all"
              >
                <span className="text-3xl mb-2">💳</span>
                <span className="font-semibold text-rv-ink dark:text-[#F0F0F0]">
                  Parcela
                </span>
                <span className="text-xs text-rv-muted mt-1 text-center">
                  Número fixo de meses
                </span>
                <span className="text-xs text-rv-muted text-center">
                  Financiamento, cartão...
                </span>
              </button>
            </div>
          </div>
        )}

        {step === 2 && tipo && (
          <div className="space-y-4">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-rv-muted hover:text-rv-ink dark:hover:text-[#F0F0F0]"
            >
              ← Voltar e escolher tipo
            </button>

            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">
                  Nome do {tipo === "assinatura" ? "serviço" : "compromisso"} *
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={tipo === "assinatura" ? "Netflix" : "Notebook Samsung"}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="categoria">Categoria *</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="valor">
                    Valor {tipo === "parcela" ? "por parcela" : "mensal"} *
                  </Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="diaVencimento">Dia de vencimento *</Label>
                  <Select value={diaVencimento} onValueChange={setDiaVencimento}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
                        <SelectItem key={dia} value={String(dia)}>
                          Dia {dia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {tipo === "parcela" && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="totalParcelas">Total de parcelas *</Label>
                    <Input
                      id="totalParcelas"
                      type="number"
                      min="2"
                      value={totalParcelas}
                      onChange={(e) => setTotalParcelas(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="parcelasPagas">Já pagas *</Label>
                    <Input
                      id="parcelasPagas"
                      type="number"
                      min="0"
                      value={parcelasPagas}
                      onChange={(e) => setParcelasPagas(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dataInicio">Início</Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="descricao">Descrição (opcional)</Label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Observações adicionais..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="alertaWhatsapp">Alertas via WhatsApp</Label>
                  <p className="text-xs text-rv-muted">
                    Receba lembretes 3 dias antes do vencimento
                  </p>
                </div>
                <Switch
                  id="alertaWhatsapp"
                  checked={alertaWhatsapp}
                  onCheckedChange={setAlertaWhatsapp}
                />
              </div>

              {valor && renderPreview()}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="border-gray-200 dark:border-white/10"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !nome.trim() || !valor}
                  className="bg-rv-green hover:bg-rv-forest text-white"
                >
                  {loading ? "Salvando..." : "Salvar compromisso"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
