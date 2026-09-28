import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { supabase, friendlyError } from '../lib/supabase';
import { ensureMonth, loadTransactions, sumBy } from '../lib/data';
import { currentMonth, money } from '../lib/format';
import type { Budget, Transaction } from '../lib/types';
import { Donut } from '../components/Donut';
import { TxRow } from '../components/TxRow';
import { TransactionForm } from '../components/TransactionForm';
import { Icon, MonthPicker, Progress, Spinner, go, toast } from '../components/ui';

const compact = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);

export function Home() {
  const { userId, profile, categories, month, setMonth, version, bump, updateProfile } = useApp();
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [inAccounts, setInAccounts] = useState<number | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureMonth(userId, month, categories);
        const [list, b, accs, paid] = await Promise.all([
          loadTransactions(userId, month),
          supabase.from('budgets').select('*').eq('user_id', userId),
          supabase.from('accounts').select('id,initial_balance,type').eq('user_id', userId),
          supabase.from('transactions').select('type,amount,account_id').eq('user_id', userId).eq('status', 'paga'),
        ]);
        if (b.error) throw b.error;
        if (accs.error) throw accs.error;
        if (paid.error) throw paid.error;
        if (!alive) return;
        setTxs(list);
        setBudgets(((b.data || []) as Budget[]).map((x) => ({ ...x, monthly_limit: Number(x.monthly_limit) })));
        // saldo em contas = saldo inicial das contas + tudo que já entrou − tudo que já saiu (exceto no cartão de crédito)
        const accountRows = (accs.data || []) as { id: string; initial_balance: number; type: string }[];
        const cashAccountIds = new Set(accountRows.filter((a) => a.type !== 'credito').map((a) => a.id));
        const base = accountRows
          .filter((a) => a.type !== 'credito')
          .reduce((s, a) => s + Number(a.initial_balance), 0);
        const flow = ((paid.data || []) as { type: string; amount: number; account_id: string | null }[]).reduce(
          (s, t) => !t.account_id || !cashAccountIds.has(t.account_id) ? s : t.type === 'receita' ? s + Number(t.amount) : s - Number(t.amount),
          0
        );
        setInAccounts(base + flow);
      } catch (err) {
        toast(friendlyError(err));
        setTxs([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, month, version, categories]);

  if (!txs) return <Spinner />;

  const incomePaid = sumBy(txs, 'receita', true);
  const expensePaid = sumBy(txs, 'despesa', true);
  const incomeAll = sumBy(txs, 'receita');
  const expenseAll = sumBy(txs, 'despesa');

  const pending = txs
    .filter((t) => t.status === 'prevista')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const recent = txs.filter((t) => t.status === 'paga').slice(0, 5);

  const byCat = new Map<string, number>();
  for (const t of txs.filter((x) => x.type === 'despesa' && x.status === 'paga')) {
    byCat.set(t.category_id || '', (byCat.get(t.category_id || '') || 0) + t.amount);
  }
  const slices = [...byCat.entries()]
    .map(([id, value]) => ({ label: catMap.get(id)?.name ?? 'Outros', value, color: catMap.get(id)?.color ?? '#888780' }))
    .sort((a, b) => b.value - a.value);
  const topSlices = slices.slice(0, 5);
  const rest = slices.slice(5).reduce((s, x) => s + x.value, 0);
  if (rest) topSlices.push({ label: 'Demais', value: rest, color: '#B4B2A9' });

  const alerts = budgets
    .map((b) => ({ b, spent: byCat.get(b.category_id) || 0, cat: catMap.get(b.category_id) }))
    .filter((x) => x.spent / x.b.monthly_limit >= 0.8)
    .sort((a, b) => b.spent / b.b.monthly_limit - a.spent / a.b.monthly_limit);

  const needsReview = month === currentMonth() && profile?.last_review_month !== currentMonth();

  async function markPaid(t: Transaction) {
    const { error } = await supabase.from('transactions').update({ status: 'paga' }).eq('id', t.id!).eq('user_id', userId);
    if (error) return toast(friendlyError(error));
    toast(t.type === 'receita' ? 'Recebimento confirmado' : 'Pagamento confirmado');
    bump();
  }

  const firstName = (profile?.name || '').split(' ')[0];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="muted small">Olá{firstName ? ',' : ''}</div>
          <div className="hello">{firstName || 'bem-vindo'}</div>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      <section className="balance-card">
        <div className="balance-label">Saldo do mês</div>
        <div className="balance-value">{money(incomePaid - expensePaid)}</div>
        <div className="balance-sub">Previsto até o fim do mês: {money(incomeAll - expenseAll)}</div>
        <div className="balance-split">
          <div>
            <Icon name="up" size={16} /> Receitas
            <strong>{money(incomePaid)}</strong>
            <small>de {money(incomeAll)}</small>
          </div>
          <div>
            <Icon name="down" size={16} /> Despesas
            <strong>{money(expensePaid)}</strong>
            <small>de {money(expenseAll)}</small>
          </div>
        </div>
        {inAccounts !== null && <div className="balance-accounts">Em contas agora: {money(inAccounts)}</div>}
      </section>

      {needsReview && (
        <section className="notice info">
          <Icon name="edit" size={18} />
          <div className="grow">
            <strong>Mês novo.</strong> Algum custo fixo ou renda mudou de valor?
            <div className="notice-actions">
              <button className="btn small" onClick={() => go('/perfil/custos')}>
                Revisar valores
              </button>
              <button className="btn small ghost" onClick={() => updateProfile({ last_review_month: currentMonth() })}>
                Está tudo igual
              </button>
            </div>
          </div>
        </section>
      )}

      {alerts.length > 0 && (
        <section className="card">
          <h2 className="card-title">Atenção ao orçamento</h2>
          {alerts.slice(0, 3).map(({ b, spent, cat }) => (
            <div className="budget-mini" key={b.category_id}>
              <div className="budget-mini-head">
                <span>
                  {cat?.icon} {cat?.name}
                </span>
                <span className={spent > b.monthly_limit ? 'neg' : 'warn-text'}>
                  {money(spent)} / {money(b.monthly_limit)}
                </span>
              </div>
              <Progress value={spent} max={b.monthly_limit} />
            </div>
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section className="card">
          <h2 className="card-title">A pagar e a receber</h2>
          {pending.map((t) => (
            <TxRow
              key={t.id}
              t={t}
              category={catMap.get(t.category_id || '')}
              onClick={() => setEditing(t)}
              action={{ label: t.type === 'receita' ? 'Recebi' : 'Paguei', onClick: () => markPaid(t) }}
            />
          ))}
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Para onde foi o dinheiro</h2>
        {slices.length ? (
          <div className="donut-row">
            <Donut data={topSlices} size={132} center={compact(expenseAll)} />
            <ul className="legend">
              {topSlices.map((s) => (
                <li key={s.label}>
                  <span className="dot" style={{ background: s.color }} />
                  <span className="grow">{s.label}</span>
                  <span className="muted">{Math.round((s.value / expenseAll) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted">Nenhuma despesa neste mês.</p>
        )}
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Últimas transações</h2>
          <a href="#/transacoes" className="small">
            Ver todas
          </a>
        </div>
        {recent.length ? (
          recent.map((t) => <TxRow key={t.id} t={t} category={catMap.get(t.category_id || '')} onClick={() => setEditing(t)} />)
        ) : (
          <p className="muted">Toque no + para lançar seu primeiro gasto.</p>
        )}
      </section>

      {editing && <TransactionForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
