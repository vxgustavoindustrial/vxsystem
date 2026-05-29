import React from 'react';
import { cn } from '../../lib/utils';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  variant?: 'green' | 'yellow' | 'red' | 'gray' | 'blue';
}

const getStatusColor = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  
  if (['active', 'approved', 'done', 'paid'].includes(normalizedStatus)) return 'green';
  if (['pending', 'payment_reported', 'in_progress', 'scheduled'].includes(normalizedStatus)) return 'yellow';
  if (['inactive', 'rejected', 'overdue'].includes(normalizedStatus)) return 'red';
  if (['onboarding', 'review'].includes(normalizedStatus)) return 'blue';
  
  return 'gray';
};

const getStatusLabel = (status: string) => {
  const normalized = status.toLowerCase();
  const translations: Record<string, string> = {
    'paid': 'Pago',
    'pending': 'Pendente',
    'payment_reported': 'Pagamento Informado',
    'overdue': 'Atrasado',
    'disputed': 'Contestado',
    'active': 'Ativo',
    'approved': 'Aprovado',
    'done': 'Concluído',
    'scheduled': 'Agendado',
    'in_progress': 'Em Andamento',
    'review': 'Em Revisão',
    'onboarding': 'Onboarding',
    'todo': 'A Fazer'
  };

  if (translations[normalized]) return translations[normalized];

  const formatted = status.replace(/_/g, ' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function StatusBadge({ status, variant, className, ...props }: StatusBadgeProps) {
  const colorVariant = variant || getStatusColor(status);
  
  const variants = {
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    gray: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[colorVariant as keyof typeof variants],
        className
      )}
      {...props}
    >
      {getStatusLabel(status)}
    </span>
  );
}
