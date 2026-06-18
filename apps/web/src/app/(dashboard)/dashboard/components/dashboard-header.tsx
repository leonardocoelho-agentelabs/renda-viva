interface DashboardHeaderProps {
  nome: string;
  saldoAtual: number;
  gastosAtual: number;
  gastosMediaTresMeses: number;
}

function getGreeting() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardHeader({
  nome,
  saldoAtual,
  gastosAtual,
  gastosMediaTresMeses,
}: DashboardHeaderProps) {
  const primeiroNome = nome?.split(" ")[0] || "por aqui";

  let mensagem = "";
  if (gastosMediaTresMeses > 0) {
    const variacao = ((gastosAtual - gastosMediaTresMeses) / gastosMediaTresMeses) * 100;
    if (variacao <= -5) {
      mensagem = `Você está gastando ${Math.abs(variacao).toFixed(0)}% menos que a média dos últimos 3 meses. 🎯`;
    } else if (variacao >= 5) {
      mensagem = `Você está gastando ${variacao.toFixed(0)}% mais que a média dos últimos 3 meses.`;
    } else {
      mensagem = "Seus gastos estão estáveis em relação aos últimos 3 meses.";
    }
  } else {
    mensagem =
      saldoAtual >= 0
        ? "Seu saldo está positivo este mês. Continue assim!"
        : "Seu saldo está negativo este mês. Vamos dar uma olhada nos gastos?";
  }

  return (
    <div className="mb-6">
      <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-rv-ink dark:text-[#F0F0F0]">
        {getGreeting()}, {primeiroNome} 👋
      </h1>
      <p className="text-sm text-rv-muted dark:text-[#8A8A8A] mt-1">{mensagem}</p>
    </div>
  );
}

export default DashboardHeader;
