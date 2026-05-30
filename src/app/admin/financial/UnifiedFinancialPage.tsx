import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminFinancialPage } from "./page";
import { AdminMonthlyPage } from "@/modules/vx-admin/components/AdminCommercialPages";
import { CreditCard, ReceiptText } from "lucide-react";

export function UnifiedFinancialPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Financeiro</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Gestão Financeira Unificada</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Gerencie pagamentos, boletos e mensalidades/planos recorrentes em um só lugar.
          </p>
        </div>
      </header>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList>
          <TabsTrigger value="payments">
            <CreditCard className="mr-2 h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <ReceiptText className="mr-2 h-4 w-4" />
            Mensalidades
          </TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="pt-4">
          <AdminFinancialPage />
        </TabsContent>
        <TabsContent value="subscriptions" className="pt-4">
          <AdminMonthlyPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
