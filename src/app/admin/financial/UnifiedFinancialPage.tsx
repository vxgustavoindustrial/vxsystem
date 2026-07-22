import { CreditCard } from "lucide-react";
import { AdminFinancialPage } from "./page";

export function UnifiedFinancialPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Financeiro</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Gestão Financeira</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Gerencie pagamentos e boletos em um só lugar.
          </p>
        </div>
      </header>

      <AdminFinancialPage />
    </div>
  );
}
