import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Wallet, ArrowUpRight, ReceiptText } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";

export function FinancialSummaryWidget() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    investedMonth: 0,
    laborMonth: 0,
    pendingTotal: 0,
    monthlyRecurring: 0,
    activeSubscriptions: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const now = new Date();
        const start = startOfMonth(now).toISOString();
        const end = endOfMonth(now).toISOString();

        // 1. Get Paid Investment (Ads) for current month
        const { data: adsData } = await supabase
          .from('financial_invoices')
          .select('amount')
          .eq('category', 'ads')
          .eq('status', 'paid')
          .gte('created_at', start)
          .lte('created_at', end);

        // 2. Get Paid Labor for current month
        const { data: laborData } = await supabase
          .from('financial_invoices')
          .select('amount')
          .eq('category', 'labor')
          .eq('status', 'paid')
          .gte('created_at', start)
          .lte('created_at', end);

        // 3. Get Pending Total (all time) - Anything NOT paid
        const { data: pendingData } = await supabase
          .from('financial_invoices')
          .select('amount')
          .neq('status', 'paid');

        // 4. Get active subscriptions (monthly revenue)
        const { data: subsData } = await supabase
          .from('client_subscriptions')
          .select('monthly_amount')
          .eq('status', 'active');

        const invested = (adsData || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const labor = (laborData || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const pending = (pendingData || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const recurring = (subsData || []).reduce((acc, curr) => acc + Number(curr.monthly_amount || 0), 0);
        const activeCount = (subsData || []).length;

        setStats({
          investedMonth: invested,
          laborMonth: labor,
          pendingTotal: pending,
          monthlyRecurring: recurring,
          activeSubscriptions: activeCount,
        });
      } catch (err) {
        console.error("Erro ao carregar estatísticas financeiras:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return <div className="h-32 w-full animate-pulse bg-muted rounded-xl" />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-950 border-blue-100 dark:border-blue-900/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Investimentos (Mês)</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {formatCurrency(stats.investedMonth)}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center">
            Total investido em anúncios <ArrowUpRight className="ml-1 h-3 w-3" />
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-950 border-indigo-100 dark:border-indigo-900/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mão de Obra (Mês)</CardTitle>
          <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
            {formatCurrency(stats.laborMonth)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Faturamento em serviços
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-950 border-emerald-100 dark:border-emerald-900/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mensalidades (MRR)</CardTitle>
          <ReceiptText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(stats.monthlyRecurring)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.activeSubscriptions} assinatura(s) ativa(s)
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-950 border-amber-100 dark:border-amber-900/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
          <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
            {formatCurrency(stats.pendingTotal)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aguardando pagamento
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
