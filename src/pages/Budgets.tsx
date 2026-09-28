import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { supabase, friendlyError } from '../lib/supabase';
import { loadTransactions } from '../lib/data';
import { dateBR, money, monthDiff, todayISO } from '../lib/format';
import type { Budget, Goal, Transaction } from '../lib/types';
import { Field, Icon, MoneyField, MonthPicker, Progress, Sheet, Spinner, toast } from '../components/ui';

export function Budgets() {
  const { userId, categories, month, setMonth, version, bump } = useApp();
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [editBudget, setEditBudget] = useState<Budget | 'new' | null>(null);
  const [editGoal, setEditGoal] = useState<Goal | 'new' | null>(null);
  const [deposit, setDeposit] = useState<Goal | null>(null);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    Promise.all([
      supabase.from('budgets').select('*').eq('user_id', userId),
      supabase.from('goals').select('*').eq('user_id', userId).order('created_at'),
      loadTransactions(userId, month),
    ])
      .then(([b, g, t]) => {
        if (b.error) throw b.error;
        if (g.error) throw g.error;
        setBudgets(((b.data || []) as Budget[]).map((x) => ({ ...x, monthly_limit: Number(x.monthly_limit) })));
        setGoals(((g.data || []) as Goal[]).map((x) => ({ ...x, target_amount: Number(x.target_amount), saved_amount: Number(x.saved_amount) })));
        setTxs(t);
      })
      .catch((err) => toast(friendlyError(err)));
  }, [userId, month, version]);

  if (!budgets) return <Spinner />;

  const spentBy = new Map<string, number>();
  for (const t of txs.filter((x) => x.type === 'despesa' && x.status === 'paga')) {
    spentBy.set(t.category_id || '', (spentBy.get(t.category_id || '') || 0) + t.amount);
  }

  const rows = budgets
    .map((b) => ({ b, spent: spentBy.get(b.category_id) || 0, cat: catMap.get(b.category_id) }))
    .sort((a, b) => b.spent / b.b.monthly_limit - a.spent / a.b.monthly_limit);
  const totalLimit = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Orçamentos</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      <section className="card">
        <div className="budget-total">
          <span className="muted small">Gasto nas categorias com limite</span>
          <strong>
            {money(totalSpent)} <span className="muted">de {money(totalLimit)}</span>
          </strong>
          <Progress value={totalSpent} max={totalLimit} />
        </div>
      </section>

      <section className="card">
        {rows.length === 0 && <p className="muted">Nenhum orçamento definido ainda.</p>}
        {rows.map(({ b, spent, cat }) => {
          const pct = b.monthly_limit ? spent / b.monthly_limit : 0;
          return (
            <button className="budget-row" key={b.category_id} onClick={() => setEditBudget(b)}>
              <div className="budget-mini-head">
                <span>
                  <span aria-hidden="true">{cat?.icon}</span> {cat?.name ?? 'Categoria'}
                </span>
                <span className={pct > 1 ? 'neg' : pct >= 0.8 ? 'warn-text' : 'muted'}>
                  {money(spent)} / {money(b.monthly_limit)}
                </span>
              </div>
              <Progress value={spent} max={b.monthly_limit} />
              {pct > 1 && (
                <div className="over-text">
                  <Icon name="alert" size={14} /> Limite estourado em {money(spent - b.monthly_limit)}
                </div>
              )}
            </button>
          );
        })}
        <button className="btn ghost add" onClick={() => setEditBudget('new')}>
          <Icon name="plus" size={18} /> Novo orçamento
        </button>
      </section>

      <div className="card-title-row">
        <h2 className="section-title">Metas</h2>
        <button className="btn small ghost" onClick={() => setEditGoal('new')}>
          <Icon name="plus" size={16} /> Nova meta
        </button>
      </div>
      {goals.length === 0 && <p className="muted">Crie uma meta para acompanhar quanto você está guardando.</p>}
      {goals.map((g) => {
        const pct = Math.round((g.saved_amount / g.target_amount) * 100);
        const monthsLeft = g.deadline ? Math.max(monthDiff(todayISO().slice(0, 7), g.deadline.slice(0, 7)), 1) : null;
        const perMonth = monthsLeft ? Math.max(g.target_amount - g.saved_amount, 0) / monthsLeft : null;
        return (
          <section className="goal-card" key={g.id}>
            <div className="goal-head">
              <button className="goal-name" onClick={() => setEditGoal(g)}>
                <Icon name="target" size={18} /> {g.name}
              </button>
              <span className="goal-pct">{pct}%</span>
            </div>
            <div className="goal-values">
              {money(g.saved_amount)} de {money(g.target_amount)}
              {g.deadline && <> · até {dateBR(g.deadline)}</>}
            </div>
            <Progress value={g.saved_amount} max={g.target_amount} tone="accent" />
            <div className="goal-foot">
              <span className="small">{perMonth && perMonth > 0 ? `Guarde ${money(perMonth)} por mês para chegar lá` : pct >= 100 ? 'Meta alcançada' : ''}</span>
              <button className="btn small" onClick={() => setDeposit(g)}>
                Guardar
              </button>
            </div>
          </section>
        );
      })}

      {editBudget && (
        <BudgetSheet
          budget={editBudget === 'new' ? null : editBudget}
          used={budgets.map((b) => b.category_id)}
          onClose={() => setEditBudget(null)}
          onSaved={() => {
            setEditBudget(null);
            bump();
          }}
        />
      )}
      {editGoal && (
        <GoalSheet
          goal={editGoal === 'new' ? null : editGoal}
          onClose={() => setEditGoal(null)}
          onSaved={() => {
            setEditGoal(null);
            bump();
          }}
        />
      )}
      {deposit && (
        <DepositSheet
          goal={deposit}
          onClose={() => setDeposit(null)}
          onSaved={() => {
            setDeposit(null);
            bump();
          }}
        />
      )}
    </div>
  );
}

function BudgetSheet({ budget, used, onClose, onSaved }: { budget: Budget | null; used: string[]; onClose: () => void; onSaved: () => void }) {
  const { userId, categories } = useApp();
  const options = categories.filter((c) => c.kind === 'despesa' && (c.id === budget?.category_id || !used.includes(c.id)));
  const [categoryId, setCategoryId] = useState(budget?.category_id ?? options[0]?.id ?? '');
  const [limit, setLimit] = useState<number | null>(budget?.monthly_limit ?? null);
  const [error, setError] = useState('');

  async function save() {
    if (!categoryId) return setError('Escolha uma categoria.');
    if (!limit || limit <= 0) return setError('Informe um limite maior que zero.');
    const { error } = await supabase
      .from('budgets')
      .upsert({ user_id: userId, category_id: categoryId, monthly_limit: limit }, { onConflict: 'user_id,category_id' });
    if (error) return setError(friendlyError(error));
    toast('Orçamento salvo');
    onSaved();
  }
  async function remove() {
    const { error } = await supabase.from('budgets').delete().eq('user_id', userId).eq('category_id', categoryId);
    if (error) return setError(friendlyError(error));
    toast('Orçamento removido');
    onSaved();
  }

  return (
    <Sheet title={budget ? 'Editar orçamento' : 'Novo orçamento'} onClose={onClose}>
      <Field label="Categoria">
        <select className="input" value={categoryId} disabled={Boolean(budget)} onChange={(e) => setCategoryId(e.target.value)}>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Limite por mês">
        <MoneyField value={limit} onChange={setLimit} autoFocus />
      </Field>
      {error && <p className="form-error">{error}</p>}
      <button className="btn primary block" onClick={save}>
        Salvar
      </button>
      {budget && (
        <button className="btn danger-ghost block" onClick={remove}>
          <Icon name="trash" size={18} /> Remover orçamento
        </button>
      )}
    </Sheet>
  );
}

function GoalSheet({ goal, onClose, onSaved }: { goal: Goal | null; onClose: () => void; onSaved: () => void }) {
  const { userId } = useApp();
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState<number | null>(goal?.target_amount ?? null);
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [error, setError] = useState('');

  async function save() {
    if (!name.trim()) return setError('Dê um nome para a meta.');
    if (!target || target <= 0) return setError('Informe um valor maior que zero.');
    const row = { user_id: userId, name: name.trim(), target_amount: target, deadline: deadline || null };
    const { error } = goal?.id
      ? await supabase.from('goals').update(row).eq('id', goal.id)
      : await supabase.from('goals').insert({ ...row, saved_amount: 0 });
    if (error) return setError(friendlyError(error));
    toast('Meta salva');
    onSaved();
  }
  async function remove() {
    if (!goal?.id || !window.confirm('Excluir esta meta?')) return;
    const { error } = await supabase.from('goals').delete().eq('id', goal.id);
    if (error) return setError(friendlyError(error));
    toast('Meta excluída');
    onSaved();
  }

  return (
    <Sheet title={goal ? 'Editar meta' : 'Nova meta'} onClose={onClose}>
      <Field label="Nome">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Viagem de férias" maxLength={120} />
      </Field>
      <Field label="Quanto quer juntar">
        <MoneyField value={target} onChange={setTarget} />
      </Field>
      <Field label="Até quando (opcional)">
        <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </Field>
      {error && <p className="form-error">{error}</p>}
      <button className="btn primary block" onClick={save}>
        Salvar meta
      </button>
      {goal && (
        <button className="btn danger-ghost block" onClick={remove}>
          <Icon name="trash" size={18} /> Excluir meta
        </button>
      )}
    </Sheet>
  );
}

function DepositSheet({ goal, onClose, onSaved }: { goal: Goal; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState<number | null>(null);
  const [withdraw, setWithdraw] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!value || value <= 0) return setError('Informe um valor maior que zero.');
    const next = Math.max(goal.saved_amount + (withdraw ? -value : value), 0);
    const { error } = await supabase.from('goals').update({ saved_amount: next }).eq('id', goal.id!);
    if (error) return setError(friendlyError(error));
    toast(withdraw ? 'Retirada registrada' : 'Valor guardado');
    onSaved();
  }

  return (
    <Sheet title={goal.name} onClose={onClose}>
      <div className="segmented">
        <button className={!withdraw ? 'active income' : ''} onClick={() => setWithdraw(false)}>
          Guardar
        </button>
        <button className={withdraw ? 'active expense' : ''} onClick={() => setWithdraw(true)}>
          Retirar
        </button>
      </div>
      <div className="amount-hero">
        <MoneyField value={value} onChange={setValue} big autoFocus ariaLabel="Valor" />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn primary block" onClick={save}>
        Confirmar
      </button>
    </Sheet>
  );
}
