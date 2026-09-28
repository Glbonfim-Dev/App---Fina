import { useEffect, useState, type ReactNode } from 'react';
import { supabase, friendlyError } from '../../lib/supabase';
import { syncRows } from '../../lib/data';
import { useApp } from '../../lib/store';
import { currentMonth, isValidDay, money } from '../../lib/format';
import { ACCOUNT_LABELS, DEBT_LABELS, type Account, type AccountType, type Budget, type Debt, type DebtKind, type FixedExpense, type Income } from '../../lib/types';
import { DayField, Icon, MoneyField, Spinner, toast } from '../../components/ui';

/** Ações do rodapé: usadas tanto no onboarding quanto em Perfil > Meus custos */
export interface StepActions {
  primaryLabel: string;
  onDone: () => void;
  onBack?: () => void;
  onSkip?: () => void;
}

function StepFooter({ actions, save, busy }: { actions: StepActions; save: () => Promise<boolean>; busy: boolean }) {
  return (
    <div className="step-footer">
      {actions.onBack && (
        <button className="btn" onClick={actions.onBack} disabled={busy}>
          Voltar
        </button>
      )}
      {actions.onSkip && (
        <button className="btn ghost" onClick={actions.onSkip} disabled={busy}>
          Pular
        </button>
      )}
      <button
        className="btn primary grow"
        disabled={busy}
        onClick={async () => {
          if (await save()) actions.onDone();
        }}
      >
        {busy ? 'Salvando…' : actions.primaryLabel}
      </button>
    </div>
  );
}

function StepHeader({ title, text }: { title: string; text: string }) {
  return (
    <div className="step-header">
      <h1>{title}</h1>
      <p className="muted">{text}</p>
    </div>
  );
}

class Invalid extends Error {}

function useSaver() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (err) {
      toast(err instanceof Invalid ? err.message : friendlyError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/* =================================================================== */
/* 1. RENDA                                                            */
/* =================================================================== */
type IncomeRow = { id?: string; name: string; amount: number | null; day: number | null; category_id: string | null; start_month?: string };

export function IncomeStep({ actions }: { actions: StepActions }) {
  const { userId, categories } = useApp();
  const incomeCats = categories.filter((c) => c.kind === 'receita');
  const salary = incomeCats.find((c) => c.name === 'Salário')?.id ?? null;
  const [rows, setRows] = useState<IncomeRow[] | null>(null);
  const [error, setError] = useState('');
  const { busy, run } = useSaver();

  useEffect(() => {
    supabase
      .from('incomes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
      .then(({ data }) => {
        const list = ((data || []) as Income[]).map((i) => ({ ...i, amount: num(i.amount), day: i.day }));
        setRows(list.length ? list : [{ name: 'Salário', amount: null, day: 5, category_id: salary }]);
      });
  }, [userId, salary]);

  if (!rows) return <Spinner />;
  const update = (i: number, patch: Partial<IncomeRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);

  const save = () =>
    run(async () => {
      const filled = rows.filter((r) => r.name.trim() || r.amount);
      if (!filled.length) throw new Invalid('Informe pelo menos uma fonte de renda.');
      for (const r of filled) {
        if (!r.name.trim() || !r.amount || r.amount <= 0 || !isValidDay(r.day ?? 0)) {
          setError('Preencha nome, valor maior que zero e dia (1 a 31) em cada renda.');
          throw new Invalid('Preencha nome, valor maior que zero e dia (1 a 31) em cada renda.');
        }
      }
      setError('');
      await syncRows(
        'incomes',
        userId,
        filled.map((r) => ({
          id: r.id,
          name: r.name.trim(),
          amount: r.amount!,
          day: r.day!,
          category_id: r.category_id ?? salary,
          start_month: r.start_month ?? currentMonth(),
        }))
      );
    });

  return (
    <>
      <StepHeader title="Quanto você recebe?" text="Informe cada fonte de renda do mês. O app lança esses valores sozinho todo mês." />
      <div className="card-list">
        {rows.map((r, i) => (
          <div className="item-card" key={r.id ?? `n${i}`}>
            <div className="item-card-head">
              <input className="input" aria-label="Nome da renda" placeholder="Salário, freelance…" value={r.name} onChange={(e) => update(i, { name: e.target.value })} maxLength={80} />
              {rows.length > 1 && (
                <button className="icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remover">
                  <Icon name="trash" size={18} />
                </button>
              )}
            </div>
            <div className="row-3">
              <MoneyField value={r.amount} onChange={(v) => update(i, { amount: v })} ariaLabel="Valor mensal" />
              <DayField value={r.day} onChange={(v) => update(i, { day: v })} ariaLabel="Dia do recebimento" />
            </div>
            <select className="input" aria-label="Categoria" value={r.category_id ?? ''} onChange={(e) => update(i, { category_id: e.target.value || null })}>
              {incomeCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button className="btn ghost add" onClick={() => setRows([...rows, { name: '', amount: null, day: 10, category_id: salary }])}>
        <Icon name="plus" size={18} /> Adicionar outra renda
      </button>
      <div className="total-line">
        Renda mensal <strong className="pos">{money(total)}</strong>
      </div>
      {error && <p className="form-error">{error}</p>}
      <StepFooter actions={actions} save={save} busy={busy} />
    </>
  );
}

/* =================================================================== */
/* 2. CUSTOS FIXOS                                                     */
/* =================================================================== */
const FIXED_PRESETS: { name: string; category: string }[] = [
  { name: 'Aluguel ou financiamento', category: 'Moradia' },
  { name: 'Condomínio', category: 'Moradia' },
  { name: 'Energia', category: 'Contas da casa' },
  { name: 'Água', category: 'Contas da casa' },
  { name: 'Gás', category: 'Contas da casa' },
  { name: 'Internet', category: 'Contas da casa' },
  { name: 'Celular', category: 'Contas da casa' },
  { name: 'Plano de saúde', category: 'Saúde' },
  { name: 'Escola ou faculdade', category: 'Educação' },
  { name: 'Transporte (ônibus, app)', category: 'Transporte' },
  { name: 'Assinaturas (streaming, apps)', category: 'Assinaturas' },
];

type FixedRow = { id?: string; name: string; amount: number | null; day: number | null; category_id: string | null; checked: boolean; preset: boolean; start_month?: string };

export function FixedStep({ actions }: { actions: StepActions }) {
  const { userId, categories } = useApp();
  const expenseCats = categories.filter((c) => c.kind === 'despesa');
  const catId = (name: string) => expenseCats.find((c) => c.name === name)?.id ?? null;
  const [rows, setRows] = useState<FixedRow[] | null>(null);
  const [error, setError] = useState('');
  const { busy, run } = useSaver();

  useEffect(() => {
    supabase
      .from('fixed_expenses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
      .then(({ data }) => {
        const saved = (data || []) as FixedExpense[];
        const presetRows: FixedRow[] = FIXED_PRESETS.map((p) => {
          const s = saved.find((x) => x.name === p.name);
          return s
            ? { ...s, amount: num(s.amount), checked: true, preset: true }
            : { name: p.name, amount: null, day: 10, category_id: catId(p.category), checked: false, preset: true };
        });
        const custom: FixedRow[] = saved
          .filter((x) => !FIXED_PRESETS.some((p) => p.name === x.name))
          .map((s) => ({ ...s, amount: num(s.amount), checked: true, preset: false }));
        setRows([...presetRows, ...custom]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, categories.length]);

  if (!rows) return <Spinner />;
  const update = (i: number, patch: Partial<FixedRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const total = rows.filter((r) => r.checked).reduce((s, r) => s + (r.amount || 0), 0);

  const save = () =>
    run(async () => {
      const chosen = rows.filter((r) => r.checked);
      const bad = chosen.find((r) => !r.name.trim() || !r.amount || r.amount <= 0 || !isValidDay(r.day ?? 0));
      if (bad) {
        const msg = `Confira "${bad.name || 'item sem nome'}": informe valor maior que zero e dia de vencimento (1 a 31).`;
        setError(msg);
        throw new Invalid(msg);
      }
      setError('');
      await syncRows(
        'fixed_expenses',
        userId,
        chosen.map((r) => ({
          id: r.id,
          name: r.name.trim(),
          amount: r.amount!,
          day: r.day!,
          category_id: r.category_id ?? catId('Outros'),
          start_month: r.start_month ?? currentMonth(),
        }))
      );
    });

  return (
    <>
      <StepHeader title="Seus custos fixos" text="Marque o que você paga todo mês e informe o valor e o dia do vencimento." />
      <div className="check-list">
        {rows.map((r, i) => (
          <div className={`check-item${r.checked ? ' on' : ''}`} key={r.id ?? `${r.name}${i}`}>
            <label className="check-item-head">
              <input type="checkbox" checked={r.checked} onChange={(e) => update(i, { checked: e.target.checked })} />
              {r.preset ? (
                <span>{r.name}</span>
              ) : (
                <input className="input" placeholder="Nome do custo" value={r.name} onChange={(e) => update(i, { name: e.target.value })} maxLength={80} />
              )}
              {!r.preset && (
                <button className="icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remover">
                  <Icon name="trash" size={18} />
                </button>
              )}
            </label>
            {r.checked && (
              <div className="check-item-body">
                <div className="row-3">
                  <MoneyField value={r.amount} onChange={(v) => update(i, { amount: v })} ariaLabel={`Valor de ${r.name}`} />
                  <DayField value={r.day} onChange={(v) => update(i, { day: v })} ariaLabel="Dia do vencimento" />
                </div>
                {!r.preset && (
                  <select className="input" aria-label="Categoria" value={r.category_id ?? ''} onChange={(e) => update(i, { category_id: e.target.value || null })}>
                    {expenseCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        className="btn ghost add"
        onClick={() => setRows([...rows, { name: '', amount: null, day: 10, category_id: catId('Outros'), checked: true, preset: false }])}
      >
        <Icon name="plus" size={18} /> Adicionar outro custo
      </button>
      <div className="total-line">
        Custos fixos <strong className="neg">{money(total)}</strong>
      </div>
      {error && <p className="form-error">{error}</p>}
      <StepFooter actions={actions} save={save} busy={busy} />
    </>
  );
}

/* =================================================================== */
/* 3. GASTOS VARIÁVEIS -> ORÇAMENTOS                                   */
/* =================================================================== */
const VARIABLE_CATS = ['Mercado', 'Restaurantes', 'Transporte', 'Lazer', 'Compras', 'Saúde', 'Outros'];
const VARIABLE_HINT: Record<string, string> = {
  Transporte: 'Combustível, estacionamento, apps',
  Saúde: 'Farmácia, consultas',
  Compras: 'Roupas, casa, presentes',
};

export function VariableStep({ actions }: { actions: StepActions }) {
  const { userId, categories } = useApp();
  const cats = VARIABLE_CATS.map((n) => categories.find((c) => c.kind === 'despesa' && c.name === n)).filter(Boolean) as typeof categories;
  const [values, setValues] = useState<Record<string, number | null> | null>(null);
  const [income, setIncome] = useState(0);
  const [fixed, setFixed] = useState(0);
  const { busy, run } = useSaver();

  useEffect(() => {
    Promise.all([
      supabase.from('budgets').select('*').eq('user_id', userId),
      supabase.from('incomes').select('amount').eq('user_id', userId),
      supabase.from('fixed_expenses').select('amount').eq('user_id', userId),
    ]).then(([b, i, f]) => {
      const map: Record<string, number | null> = {};
      for (const x of (b.data || []) as Budget[]) map[x.category_id] = Number(x.monthly_limit);
      setValues(map);
      setIncome(((i.data || []) as { amount: number }[]).reduce((s, x) => s + Number(x.amount), 0));
      setFixed(((f.data || []) as { amount: number }[]).reduce((s, x) => s + Number(x.amount), 0));
    });
  }, [userId]);

  if (!values) return <Spinner />;
  const variable = cats.reduce((s, c) => s + (values[c.id] || 0), 0);
  const left = income - fixed - variable;

  const save = () =>
    run(async () => {
      for (const c of cats) {
        const v = values[c.id];
        if (v && v > 0) {
          const { error } = await supabase
            .from('budgets')
            .upsert({ user_id: userId, category_id: c.id, monthly_limit: v }, { onConflict: 'user_id,category_id' });
          if (error) throw error;
        } else {
          const { error } = await supabase.from('budgets').delete().eq('user_id', userId).eq('category_id', c.id);
          if (error) throw error;
        }
      }
    });

  return (
    <>
      <StepHeader title="Gastos do dia a dia" text="Quanto você costuma gastar por mês em cada item? Esses valores viram seus limites de orçamento." />
      <div className="card-list">
        {cats.map((c) => (
          <div className="budget-input" key={c.id}>
            <div>
              <div className="budget-input-name">
                <span aria-hidden="true">{c.icon}</span> {c.name}
              </div>
              {VARIABLE_HINT[c.name] && <div className="muted small">{VARIABLE_HINT[c.name]}</div>}
            </div>
            <MoneyField value={values[c.id] ?? null} onChange={(v) => setValues({ ...values, [c.id]: v })} ariaLabel={`Gasto com ${c.name}`} />
          </div>
        ))}
      </div>
      <div className="total-line">
        Gastos variáveis <strong className="neg">{money(variable)}</strong>
      </div>
      {income > 0 && left < 0 && (
        <div className="notice warn">
          <Icon name="alert" size={18} /> Seus custos fixos e variáveis passam da sua renda em {money(-left)}. Você pode continuar, mas vale revisar.
        </div>
      )}
      <StepFooter actions={actions} save={save} busy={busy} />
    </>
  );
}

/* =================================================================== */
/* 4. CONTAS, CARTÕES E PARCELAS                                       */
/* =================================================================== */
type AccRow = { id?: string; name: string; type: AccountType; initial_balance: number | null; credit_limit: number | null; closing_day: number | null; due_day: number | null };
type InstRow = { id?: string; name: string; installment_amount: number | null; current_installment: number | null; total_installments: number | null; due_day: number | null; start_month?: string };

export function AccountsStep({ actions }: { actions: StepActions }) {
  const { userId, refreshLists } = useApp();
  const [accs, setAccs] = useState<AccRow[] | null>(null);
  const [inst, setInst] = useState<InstRow[]>([]);
  const [error, setError] = useState('');
  const { busy, run } = useSaver();

  useEffect(() => {
    Promise.all([
      supabase.from('accounts').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('debts').select('*').eq('user_id', userId).eq('kind', 'parcela_cartao').order('created_at'),
    ]).then(([a, d]) => {
      const list = ((a.data || []) as Account[]).map((x) => ({ ...x, initial_balance: num(x.initial_balance), credit_limit: num(x.credit_limit) }));
      setAccs(list.length ? list : [{ name: 'Conta principal', type: 'corrente', initial_balance: null, credit_limit: null, closing_day: null, due_day: null }]);
      setInst(((d.data || []) as Debt[]).map((x) => ({ ...x, installment_amount: num(x.installment_amount) })));
    });
  }, [userId]);

  if (!accs) return <Spinner />;
  const updA = (i: number, p: Partial<AccRow>) => setAccs(accs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const updI = (i: number, p: Partial<InstRow>) => setInst(inst.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const save = () =>
    run(async () => {
      const list = accs.filter((a) => a.name.trim());
      for (const a of list) {
        if (a.type === 'credito' && (!isValidDay(a.closing_day ?? 0) || !isValidDay(a.due_day ?? 0))) {
          const msg = `Informe os dias de fechamento e vencimento do cartão "${a.name}".`;
          setError(msg);
          throw new Invalid(msg);
        }
      }
      for (const p of inst) {
        const ok =
          p.name.trim() && p.installment_amount && p.installment_amount > 0 && p.current_installment && p.total_installments &&
          p.current_installment <= p.total_installments && isValidDay(p.due_day ?? 0);
        if (!ok) {
          const msg = 'Confira as parcelas: nome, valor, parcela atual/total e dia de vencimento.';
          setError(msg);
          throw new Invalid(msg);
        }
      }
      setError('');
      await syncRows(
        'accounts',
        userId,
        list.map((a) => ({
          id: a.id,
          name: a.name.trim(),
          type: a.type,
          initial_balance: a.type === 'credito' ? 0 : a.initial_balance ?? 0,
          credit_limit: a.type === 'credito' ? a.credit_limit : null,
          closing_day: a.type === 'credito' ? a.closing_day : null,
          due_day: a.type === 'credito' ? a.due_day : null,
        }))
      );
      await syncRows(
        'debts',
        userId,
        inst.map((p) => ({
          id: p.id,
          kind: 'parcela_cartao',
          name: p.name.trim(),
          installment_amount: p.installment_amount!,
          current_installment: p.current_installment!,
          total_installments: p.total_installments!,
          due_day: p.due_day!,
          account_id: null,
          start_month: p.start_month ?? currentMonth(),
        })),
        { column: 'kind', value: 'parcela_cartao' }
      );
      await refreshLists();
    });

  return (
    <>
      <StepHeader title="Contas e cartões" text="Quanto você tem hoje em cada conta? Cadastre também seus cartões de crédito." />
      <div className="card-list">
        {accs.map((a, i) => (
          <div className="item-card" key={a.id ?? `a${i}`}>
            <div className="item-card-head">
              <input className="input" aria-label="Nome da conta" placeholder="Nubank, Itaú, carteira…" value={a.name} onChange={(e) => updA(i, { name: e.target.value })} maxLength={80} />
              {accs.length > 1 && (
                <button className="icon-btn" onClick={() => setAccs(accs.filter((_, j) => j !== i))} aria-label="Remover">
                  <Icon name="trash" size={18} />
                </button>
              )}
            </div>
            <select className="input" aria-label="Tipo" value={a.type} onChange={(e) => updA(i, { type: e.target.value as AccountType })}>
              {(Object.keys(ACCOUNT_LABELS) as AccountType[]).map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_LABELS[t]}
                </option>
              ))}
            </select>
            {a.type === 'credito' ? (
              <>
                <label className="mini-label">Limite</label>
                <MoneyField value={a.credit_limit} onChange={(v) => updA(i, { credit_limit: v })} ariaLabel="Limite do cartão" />
                <div className="row-2">
                  <div>
                    <label className="mini-label">Fecha dia</label>
                    <DayField value={a.closing_day} onChange={(v) => updA(i, { closing_day: v })} ariaLabel="Dia de fechamento" />
                  </div>
                  <div>
                    <label className="mini-label">Vence dia</label>
                    <DayField value={a.due_day} onChange={(v) => updA(i, { due_day: v })} ariaLabel="Dia de vencimento" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <label className="mini-label">Saldo atual</label>
                <MoneyField value={a.initial_balance} onChange={(v) => updA(i, { initial_balance: v })} ariaLabel="Saldo atual" />
              </>
            )}
          </div>
        ))}
      </div>
      <button className="btn ghost add" onClick={() => setAccs([...accs, { name: '', type: 'credito', initial_balance: null, credit_limit: null, closing_day: null, due_day: null }])}>
        <Icon name="plus" size={18} /> Adicionar conta ou cartão
      </button>

      <h2 className="section-title">Compras parceladas em andamento</h2>
      <p className="muted small">Ex.: celular em 10x, já pagou 3 → parcela atual 4 de 10.</p>
      <div className="card-list">
        {inst.map((p, i) => (
          <div className="item-card" key={p.id ?? `p${i}`}>
            <div className="item-card-head">
              <input className="input" aria-label="Descrição" placeholder="Celular, geladeira…" value={p.name} onChange={(e) => updI(i, { name: e.target.value })} maxLength={80} />
              <button className="icon-btn" onClick={() => setInst(inst.filter((_, j) => j !== i))} aria-label="Remover">
                <Icon name="trash" size={18} />
              </button>
            </div>
            <MoneyField value={p.installment_amount} onChange={(v) => updI(i, { installment_amount: v })} ariaLabel="Valor da parcela" />
            <div className="row-3">
              <div>
                <label className="mini-label">Parcela atual</label>
                <DayField value={p.current_installment} onChange={(v) => updI(i, { current_installment: v })} ariaLabel="Parcela atual" />
              </div>
              <div>
                <label className="mini-label">De</label>
                <DayField value={p.total_installments} onChange={(v) => updI(i, { total_installments: v })} ariaLabel="Total de parcelas" />
              </div>
              <div>
                <label className="mini-label">Vence dia</label>
                <DayField value={p.due_day} onChange={(v) => updI(i, { due_day: v })} ariaLabel="Dia de vencimento" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn ghost add" onClick={() => setInst([...inst, { name: '', installment_amount: null, current_installment: 1, total_installments: null, due_day: 10 }])}>
        <Icon name="plus" size={18} /> Adicionar parcela
      </button>
      {error && <p className="form-error">{error}</p>}
      <StepFooter actions={actions} save={save} busy={busy} />
    </>
  );
}

/* =================================================================== */
/* 5. DÍVIDAS (opcional)                                               */
/* =================================================================== */
type DebtRow = InstRow & { kind: DebtKind };

export function DebtsStep({ actions }: { actions: StepActions }) {
  const { userId } = useApp();
  const [rows, setRows] = useState<DebtRow[] | null>(null);
  const [error, setError] = useState('');
  const { busy, run } = useSaver();

  useEffect(() => {
    supabase
      .from('debts')
      .select('*')
      .eq('user_id', userId)
      .neq('kind', 'parcela_cartao')
      .order('created_at')
      .then(({ data }) => setRows(((data || []) as Debt[]).map((x) => ({ ...x, installment_amount: num(x.installment_amount) }))));
  }, [userId]);

  if (!rows) return <Spinner />;
  const upd = (i: number, p: Partial<DebtRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const save = () =>
    run(async () => {
      for (const p of rows) {
        const ok =
          p.name.trim() && p.installment_amount && p.installment_amount > 0 && p.current_installment && p.total_installments &&
          p.current_installment <= p.total_installments && isValidDay(p.due_day ?? 0);
        if (!ok) {
          const msg = 'Confira as dívidas: nome, valor da parcela, parcela atual/total e dia de vencimento.';
          setError(msg);
          throw new Invalid(msg);
        }
      }
      setError('');
      await syncRows(
        'debts',
        userId,
        rows.map((p) => ({
          id: p.id,
          kind: p.kind,
          name: p.name.trim(),
          installment_amount: p.installment_amount!,
          current_installment: p.current_installment!,
          total_installments: p.total_installments!,
          due_day: p.due_day!,
          account_id: null,
          start_month: p.start_month ?? currentMonth(),
        })),
        { column: 'kind', value: 'parcela_cartao', op: 'neq' }
      );
    });

  return (
    <>
      <StepHeader title="Empréstimos e financiamentos" text="Tem alguma dívida com parcelas mensais? Se não tiver, é só pular." />
      {rows.length === 0 && (
        <div className="empty">
          <Icon name="receipt" size={28} />
          <p>Nenhuma dívida cadastrada.</p>
        </div>
      )}
      <div className="card-list">
        {rows.map((p, i) => (
          <div className="item-card" key={p.id ?? `d${i}`}>
            <div className="item-card-head">
              <input className="input" aria-label="Descrição" placeholder="Financiamento do carro" value={p.name} onChange={(e) => upd(i, { name: e.target.value })} maxLength={80} />
              <button className="icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remover">
                <Icon name="trash" size={18} />
              </button>
            </div>
            <select className="input" aria-label="Tipo" value={p.kind} onChange={(e) => upd(i, { kind: e.target.value as DebtKind })}>
              <option value="emprestimo">{DEBT_LABELS.emprestimo}</option>
              <option value="financiamento">{DEBT_LABELS.financiamento}</option>
            </select>
            <label className="mini-label">Valor da parcela</label>
            <MoneyField value={p.installment_amount} onChange={(v) => upd(i, { installment_amount: v })} ariaLabel="Valor da parcela" />
            <div className="row-3">
              <div>
                <label className="mini-label">Parcela atual</label>
                <input className="input day-input" inputMode="numeric" value={p.current_installment ?? ''} onChange={(e) => upd(i, { current_installment: Number(e.target.value.replace(/\D/g, '')) || null })} aria-label="Parcela atual" />
              </div>
              <div>
                <label className="mini-label">De</label>
                <input className="input day-input" inputMode="numeric" value={p.total_installments ?? ''} onChange={(e) => upd(i, { total_installments: Number(e.target.value.replace(/\D/g, '')) || null })} aria-label="Total de parcelas" />
              </div>
              <div>
                <label className="mini-label">Vence dia</label>
                <DayField value={p.due_day} onChange={(v) => upd(i, { due_day: v })} ariaLabel="Dia de vencimento" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn ghost add" onClick={() => setRows([...rows, { kind: 'emprestimo', name: '', installment_amount: null, current_installment: 1, total_installments: null, due_day: 10 }])}>
        <Icon name="plus" size={18} /> Adicionar dívida
      </button>
      {error && <p className="form-error">{error}</p>}
      <StepFooter actions={actions} save={save} busy={busy} />
    </>
  );
}

/* =================================================================== */
/* 6. RESUMO                                                           */
/* =================================================================== */
function SummaryLine({ label, value, cls }: { label: string; value: number; cls?: string }): ReactNode {
  return (
    <div className="summary-line">
      <span>{label}</span>
      <strong className={cls}>{money(value)}</strong>
    </div>
  );
}

export function SummaryStep({ onBack, onFinish }: { onBack: () => void; onFinish: (goal: { target: number } | null) => Promise<void> }) {
  const { userId } = useApp();
  const [t, setT] = useState<{ income: number; fixed: number; variable: number; debts: number } | null>(null);
  const [createGoal, setCreateGoal] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('incomes').select('amount').eq('user_id', userId),
      supabase.from('fixed_expenses').select('amount').eq('user_id', userId),
      supabase.from('budgets').select('monthly_limit').eq('user_id', userId),
      supabase.from('debts').select('installment_amount').eq('user_id', userId),
    ]).then(([i, f, b, d]) => {
      const sum = (rows: unknown[] | null, k: string) => (rows || []).reduce((s: number, r) => s + Number((r as Record<string, unknown>)[k]), 0);
      setT({ income: sum(i.data, 'amount'), fixed: sum(f.data, 'amount'), variable: sum(b.data, 'monthly_limit'), debts: sum(d.data, 'installment_amount') });
    });
  }, [userId]);

  if (!t) return <Spinner />;
  const left = t.income - t.fixed - t.variable - t.debts;
  const monthlySaving = Math.round(t.income * 0.1);
  const reserve = Math.round((t.fixed + t.variable + t.debts) * 6);

  return (
    <>
      <StepHeader title="Tudo pronto" text="Este é o retrato do seu mês. Você pode mudar qualquer valor depois em Perfil > Meus custos." />
      <div className="card">
        <SummaryLine label="Renda" value={t.income} cls="pos" />
        <SummaryLine label="Custos fixos" value={-t.fixed} cls="neg" />
        <SummaryLine label="Gastos variáveis" value={-t.variable} cls="neg" />
        <SummaryLine label="Parcelas e dívidas" value={-t.debts} cls="neg" />
        <div className="summary-total">
          <span>Sobra por mês</span>
          <strong className={left >= 0 ? 'pos' : 'neg'}>{money(left)}</strong>
        </div>
      </div>

      {left < 0 ? (
        <div className="notice warn">
          <Icon name="alert" size={18} /> Seus gastos previstos passam da renda. Os orçamentos vão te avisar quando uma categoria estourar.
        </div>
      ) : (
        <div className="notice ok">
          <Icon name="target" size={18} />
          <div>
            <strong>Sugestão:</strong> guarde {money(monthlySaving)} por mês (10% da renda) até formar uma reserva de emergência de {money(reserve)} — seis meses dos seus gastos.
          </div>
        </div>
      )}

      {reserve > 0 && (
        <label className="switch-row">
          <span>Criar a meta "Reserva de emergência"</span>
          <input type="checkbox" className="switch" checked={createGoal} onChange={(e) => setCreateGoal(e.target.checked)} />
        </label>
      )}

      <div className="step-footer">
        <button className="btn" onClick={onBack} disabled={busy}>
          Voltar
        </button>
        <button
          className="btn primary grow"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onFinish(createGoal && reserve > 0 ? { target: reserve } : null);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Preparando…' : 'Concluir e começar'}
        </button>
      </div>
    </>
  );
}
