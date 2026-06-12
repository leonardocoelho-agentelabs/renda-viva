import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Target } from "lucide-react";

export default function GoalsPage() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Metas</h1>
        <p className="text-gray-500">Defina e acompanhe seus objetivos financeiros</p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Target className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Funcionalidade em desenvolvimento</h2>
        <p className="text-gray-400 mb-8 max-w-sm">
          Em breve você poderá criar metas financeiras, como reserva de emergência, viagem dos sonhos ou aposentadoria.
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </DashboardLayout>
  );
}
