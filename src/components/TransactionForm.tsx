import { useState } from 'react';
import { supabase, friendlyError } from '../lib/supabase';
import { useApp } from '../lib/store';
import { todayISO } from '../lib/format';
import { PAYMENT_LABELS, type Kind, type PaymentMethod, type Transaction } from '../lib/types';
import { Field, Icon, MoneyField, Sheet, toast } from './ui';

export function TransactionForm({ initial, onClose }: { initial?: Transaction; onClose: () => void }) {
  const { userId, categories, accounts, bump } = useApp();
  const editing = Boolean(initial?.id);
  const generated = Boolean(initial?.source_type && initial.source_id);

  const [type, setType] = useState<Kind>(initial?.type ?? 'despesa');
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [method, setMethod] = useState<PaymentMethod | null>(initial?.payment_method ?? 'pix');
  const [accountId, setAccountId] = useState<string | null>(initial?.account_id ?? null);
  const [paid, setPaid] = useState(initial ? initial.status === 'paga' : true);
  const [repeat, setRepeat] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const cats = categories.filter((c) => c.kind === type);
  const clear = (k: string) => errors[k] && setErrors({ ...errors, [k]: '' });

  async function save() {
    const e: Record<string, string> = {};
    if (!amount || amount <= 0) e.amount = 'Informe um valor maior que zero.';
    if (!description.trim()) e.description = 'Dê um nome para a transação.';
    if (!categoryId) e.category = 'Escolha uma categoria.';
    if (!date) e.date = 'Informe a data.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const row = {
        user_id: userId,
        type,
        amount: amount!,
        description: description.trim(),
        category_id: categoryId,
        account_id: accountId,
        date,
        payment_method: type === 'despesa' ? method : null,
        status: paid ? 'paga' : 'prevista',
      };
      if (editing) {
        const { error } = await supabase.from('transactions').update(row).eq('id', initial!.id!).eq('user_id', userId);
        if (error) throw error;
      } else if (repeat) {
        // transforma em custo fixo / renda recorrente: o app lança todo mês sozinho
        const table = type === 'despesa' ? 'fixed_expenses' : 'incomes';
        const { data: src, error: e1 } = await supabase
          .from(table)
          .insert({
            user_id: userId,
            name: row.description,
            amount: row.amount,
            day: Number(date.slice(8, 10)),
            category_id: categoryId,
            start_month: date.slice(0, 7),
          })
          .select('id')
          .single();
        if (e1) throw e1;
        const { error } = await supabase.from('transactions').insert({
          ...row,
          source_type: type === 'despesa' ? 'fixed' : 'income',
          source_id: (src as { id: string }).id,
          month: date.slice(0, 7),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transactions').insert(row);
        if (error) throw error;
      }
      toast(editing ? 'Transação atualizada' : 'Transação salva');
      bump();
      onClose();
    } catch (err) {
      toast(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial?.id) return;
    if (!window.confirm('Excluir esta transação?')) return;
    // Mantém a chave da ocorrência recorrente para que ensureMonth não a recrie.
    const request = generated
      ? supabase.from('transactions').update({ status: 'cancelada' }).eq('id', initial.id).eq('user_id', userId)
      : supabase.from('transactions').delete().eq('id', initial.id).eq('user_id', userId);
    const { error } = await request;
    if (error) return toast(friendlyError(error));
    toast('Transação excluída');
    bump();
    onClose();
  }

  return (
    <Sheet title={editing ? 'Editar transação' : 'Nova transação'} onClose={onClose}>
      <div className="segmented" role="tablist">
        <button
          role="tab"
          aria-selected={type === 'despesa'}
          className={type === 'despesa' ? 'active expense' : ''}
          disabled={generated}
          onClick={() => {
            setType('despesa');
            setCategoryId(null);
          }}
        >
          Despesa
        </button>
        <button
          role="tab"
          aria-selected={type === 'receita'}
          className={type === 'receita' ? 'active income' : ''}
          disabled={generated}
          onClick={() => {
            setType('receita');
            setCategoryId(null);
          }}
        >
          Receita
        </button>
      </div>

      {generated && <p className="muted small">Esta ocorrência vem de uma recorrência. Edite a recorrência em Perfil → Meus custos.</p>}

      <div className={`amount-hero ${type}`}>
        <MoneyField value={amount} onChange={(v) => { setAmount(v); clear('amount'); }} big autoFocus={!editing} ariaLabel="Valor" />
        {errors.amount && <span className="field-error center">{errors.amount}</span>}
      </div>

      <Field label="Descrição" error={errors.description}>
        <input
          className="input"
          value={description}
          onChange={(e) => { setDescription(e.target.value); clear('description'); }}
          placeholder={type === 'despesa' ? 'Supermercado' : 'Salário'}
          maxLength={80}
        />
      </Field>

      <Field label="Categoria" error={errors.category}>
        <div className="chips">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip${categoryId === c.id ? ' selected' : ''}`}
              onClick={() => { setCategoryId(c.id); clear('category'); }}
            >
              <span aria-hidden="true">{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
      </Field>

      <div className="row-2">
        <Field label="Data" error={errors.date}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {accounts.length > 0 && (
          <Field label="Conta">
            <select className="input" value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value || null)}>
              <option value="">Nenhuma</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {type === 'despesa' && (
        <Field label="Forma de pagamento">
          <div className="chips">
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <button key={m} type="button" className={`chip${method === m ? ' selected' : ''}`} onClick={() => setMethod(m)}>
                {PAYMENT_LABELS[m]}
              </button>
            ))}
          </div>
        </Field>
      )}

      <label className="switch-row">
        <span>{type === 'despesa' ? 'Já foi paga' : 'Já recebi'}</span>
        <input type="checkbox" className="switch" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
      </label>

      {!editing && (
        <label className="switch-row">
          <span>Repetir todo mês</span>
          <input type="checkbox" className="switch" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
        </label>
      )}

      <button className="btn primary block" onClick={save} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar transação'}
      </button>
      {editing && (
        <button className="btn danger-ghost block" onClick={remove}>
          <Icon name="trash" size={18} /> Excluir
        </button>
      )}
    </Sheet>
  );
}
