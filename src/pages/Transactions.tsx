import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { ensureMonth, loadTransactions, sumBy } from '../lib/data';
import { friendlyError } from '../lib/supabase';
import { dayLabel, money } from '../lib/format';
import type { Transaction } from '../lib/types';
import { TxRow } from '../components/TxRow';
import { TransactionForm } from '../components/TransactionForm';
import { Icon, MonthPicker, Spinner, toast } from '../components/ui';

type Filter = 'todas' | 'despesa' | 'receita' | 'prevista';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'despesa', label: 'Despesas' },
  { id: 'receita', label: 'Receitas' },
  { id: 'prevista', label: 'Previstas' },
];

export function Transactions() {
  const { userId, categories, month, setMonth, version } = useApp();
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [filter, setFilter] = useState<Filter>('todas');
  const [catFilter, setCatFilter] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    let alive = true;
    ensureMonth(userId, month, categories)
      .then(() => loadTransactions(userId, month))
      .then((l) => alive && setTxs(l))
      .catch((err) => {
        toast(friendlyError(err));
        if (alive) setTxs([]);
      });
    return () => {
      alive = false;
    };
  }, [userId, month, version, categories]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (txs || []).filter((t) => {
      if (filter === 'prevista' && t.status !== 'prevista') return false;
      if ((filter === 'despesa' || filter === 'receita') && t.type !== filter) return false;
      if (catFilter && t.category_id !== catFilter) return false;
      if (q && !t.description.toLowerCase().includes(q) && !(catMap.get(t.category_id || '')?.name.toLowerCase().includes(q) ?? false)) return false;
      return true;
    });
  }, [txs, filter, catFilter, query, catMap]);

  const groups = useMemo(() => {
    const g = new Map<string, Transaction[]>();
    for (const t of list) g.set(t.date, [...(g.get(t.date) || []), t]);
    return [...g.entries()];
  }, [list]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Transações</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      <div className="input-icon search">
        <Icon name="search" size={18} />
        <input placeholder="Buscar por descrição ou categoria" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar" />
      </div>

      <div className="chips scroll">
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip${filter === f.id ? ' selected' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
        <select className="chip-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Filtrar por categoria">
          <option value="">Categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      {!txs ? (
        <Spinner />
      ) : (
        <>
          <div className="totals-strip">
            <span>
              Entradas <strong className="pos">{money(sumBy(list, 'receita'))}</strong>
            </span>
            <span>
              Saídas <strong className="neg">{money(sumBy(list, 'despesa'))}</strong>
            </span>
          </div>

          {groups.length === 0 && (
            <div className="empty">
              <Icon name="receipt" size={28} />
              <p>Nenhuma transação encontrada.</p>
            </div>
          )}

          {groups.map(([date, items]) => (
            <section key={date} className="day-group">
              <h2 className="day-title">{dayLabel(date)}</h2>
              <div className="card flush">
                {items.map((t) => (
                  <TxRow key={t.id} t={t} category={catMap.get(t.category_id || '')} onClick={() => setEditing(t)} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {editing && <TransactionForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
