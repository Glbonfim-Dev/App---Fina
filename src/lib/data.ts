import { supabase } from './supabase';
import { currentMonth, dateInMonth, monthDiff, monthRange } from './format';
import type { Category, Debt, FixedExpense, Income, Transaction } from './types';

type Row = { id?: string } & Record<string, unknown>;

/**
 * Sincroniza uma lista editada na tela com a tabela:
 * - atualiza as linhas que já existem (mantém o id)
 * - insere as novas
 * - apaga as que o usuário removeu
 * Assim os lançamentos já gerados continuam ligados ao mesmo item.
 */
export async function syncRows<T extends Row>(
  table: string,
  userId: string,
  rows: T[],
  filter?: { column: string; value: string; op?: 'eq' | 'neq' }
): Promise<void> {
  let q = supabase.from(table).select('id').eq('user_id', userId);
  if (filter) q = filter.op === 'neq' ? q.neq(filter.column, filter.value) : q.eq(filter.column, filter.value);
  const { data: existing, error: e1 } = await q;
  if (e1) throw e1;

  const keep = new Set(rows.filter((r) => r.id).map((r) => r.id as string));
  const toDelete = (existing || []).map((r: { id: string }) => r.id).filter((id) => !keep.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from(table).delete().in('id', toDelete);
    if (error) throw error;
  }

  const toUpdate = rows.filter((r) => r.id).map((r) => ({ ...r, user_id: userId }));
  if (toUpdate.length) {
    const { error } = await supabase.from(table).upsert(toUpdate);
    if (error) throw error;
  }

  const toInsert = rows
    .filter((r) => !r.id)
    .map((r) => {
      const { id: _omit, ...rest } = r;
      void _omit;
      return { ...rest, user_id: userId };
    });
  if (toInsert.length) {
    const { error } = await supabase.from(table).insert(toInsert);
    if (error) throw error;
  }
}

/**
 * Gera os lançamentos "previstos" do mês a partir das rendas, custos fixos e dívidas.
 * É seguro chamar várias vezes: a restrição UNIQUE do banco impede duplicados.
 * Não gera meses futuros nem meses anteriores ao cadastro de cada item.
 */
export async function ensureMonth(userId: string, month: string, categories: Category[]): Promise<void> {
  if (monthDiff(month, currentMonth()) < 0) return; // mês futuro

  const [inc, fix, deb] = await Promise.all([
    supabase.from('incomes').select('*').eq('user_id', userId),
    supabase.from('fixed_expenses').select('*').eq('user_id', userId),
    supabase.from('debts').select('*').eq('user_id', userId),
  ]);
  if (inc.error) throw inc.error;
  if (fix.error) throw fix.error;
  if (deb.error) throw deb.error;

  const debtCat = categories.find((c) => c.kind === 'despesa' && c.name === 'Dívidas')?.id ?? null;
  const rows: Transaction[] = [];

  for (const i of (inc.data || []) as Income[]) {
    if (i.active === false || !i.start_month || monthDiff(i.start_month, month) < 0) continue;
    rows.push({
      type: 'receita', amount: Number(i.amount), description: i.name, category_id: i.category_id,
      account_id: null, date: dateInMonth(month, i.day), payment_method: null, status: 'prevista',
      source_type: 'income', source_id: i.id, month,
    });
  }
  for (const f of (fix.data || []) as FixedExpense[]) {
    if (f.active === false || !f.start_month || monthDiff(f.start_month, month) < 0) continue;
    rows.push({
      type: 'despesa', amount: Number(f.amount), description: f.name, category_id: f.category_id,
      account_id: null, date: dateInMonth(month, f.day), payment_method: null, status: 'prevista',
      source_type: 'fixed', source_id: f.id, month,
    });
  }
  for (const d of (deb.data || []) as Debt[]) {
    if (!d.start_month) continue;
    const offset = monthDiff(d.start_month, month);
    const n = d.current_installment + offset;
    if (offset < 0 || n > d.total_installments) continue;
    rows.push({
      type: 'despesa', amount: Number(d.installment_amount), description: `${d.name} (${n}/${d.total_installments})`,
      category_id: debtCat, account_id: d.account_id, date: dateInMonth(month, d.due_day),
      payment_method: d.kind === 'parcela_cartao' ? 'credito' : 'boleto', status: 'prevista',
      source_type: 'debt', source_id: d.id, month,
    });
  }

  if (!rows.length) return;
  const { error } = await supabase
    .from('transactions')
    .upsert(rows.map((r) => ({ ...r, user_id: userId })), {
      onConflict: 'user_id,source_type,source_id,month',
      ignoreDuplicates: true,
    });
  if (error) throw error;
}

/**
 * Depois que a pessoa edita rendas/custos/dívidas, atualiza os lançamentos
 * ainda "previstos" do mês para refletir os novos valores
 * (e remove os de itens que foram apagados). Lançamentos já pagos não mudam.
 */
export async function refreshPlanned(userId: string, month: string, categories: Category[]): Promise<void> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('status', 'prevista')
    .not('source_id', 'is', null);
  if (error) throw error;
  const ids = ((data || []) as { id: string }[]).map((r) => r.id);
  if (ids.length) {
    const { error: e2 } = await supabase.from('transactions').delete().in('id', ids);
    if (e2) throw e2;
  }
  await ensureMonth(userId, month, categories);
}

export async function loadTransactions(userId: string, month: string): Promise<Transaction[]> {
  const { start, end } = monthRange(month);
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .neq('status', 'cancelada')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as Transaction[]).map((t) => ({ ...t, amount: Number(t.amount) }));
}

export function sumBy(list: Transaction[], type: 'receita' | 'despesa', onlyPaid = false): number {
  return list
    .filter((t) => t.type === type && t.status !== 'cancelada' && (!onlyPaid || t.status === 'paga'))
    .reduce((s, t) => s + t.amount, 0);
}

export function toCSV(rows: Transaction[], categories: Category[]): string {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Forma de pagamento', 'Status'];
  const lines = rows.map((t) =>
    [
      t.date,
      t.type,
      esc(t.description),
      esc(cat.get(t.category_id || '') || ''),
      t.amount.toFixed(2).replace('.', ','),
      t.payment_method || '',
      t.status,
    ].join(';')
  );
  return '﻿' + [header.join(';'), ...lines].join('\n');
}
