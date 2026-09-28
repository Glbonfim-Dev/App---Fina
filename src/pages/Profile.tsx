import { useState } from 'react';
import { useApp } from '../lib/store';
import { supabase, friendlyError } from '../lib/supabase';
import { refreshPlanned, toCSV } from '../lib/data';
import { currentMonth, todayISO } from '../lib/format';
import type { Transaction } from '../lib/types';
import { Field, Icon, PasswordInput, Sheet, go, toast } from '../components/ui';
import { passwordProblem } from './auth/AuthPages';
import { AccountsStep, DebtsStep, FixedStep, IncomeStep, VariableStep, type StepActions } from './onboarding/steps';

export function Profile() {
  const { profile, email, userId, categories, updateProfile } = useApp();
  const [editName, setEditName] = useState(false);
  const [changePass, setChangePass] = useState(false);
  const name = profile?.name || '';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';

  async function exportCSV() {
    const { data, error } = await supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false });
    if (error) return toast(friendlyError(error));
    const rows = ((data || []) as Transaction[]).map((t) => ({ ...t, amount: Number(t.amount) }));
    const blob = new Blob([toCSV(rows, categories)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fina-transacoes-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function deleteAccount() {
    const typed = window.prompt('Isso apaga sua conta e TODOS os seus dados para sempre. Para confirmar, digite EXCLUIR');
    if (typed?.trim().toUpperCase() !== 'EXCLUIR') return;
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return toast(friendlyError(error));
    await supabase.auth.signOut();
    toast('Sua conta foi excluída');
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Perfil</h1>
      </header>

      <section className="profile-card">
        <div className="avatar">{initials}</div>
        <div className="grow">
          <div className="profile-name">{name || 'Sem nome'}</div>
          <div className="muted small">{email}</div>
        </div>
        <button className="icon-btn" onClick={() => setEditName(true)} aria-label="Editar nome">
          <Icon name="edit" size={18} />
        </button>
      </section>

      <nav className="menu">
        <button className="menu-item" onClick={() => go('/perfil/custos')}>
          <Icon name="wallet" /> <span className="grow">Meus custos, renda e contas</span> <Icon name="right" size={18} />
        </button>
        <label className="menu-item">
          <Icon name="moon" /> <span className="grow">Tema escuro</span>
          <input
            type="checkbox"
            className="switch"
            checked={profile?.theme === 'escuro'}
            onChange={(e) => updateProfile({ theme: e.target.checked ? 'escuro' : 'claro' }).catch((err) => toast(friendlyError(err)))}
          />
        </label>
        <button className="menu-item" onClick={() => setChangePass(true)}>
          <Icon name="key" /> <span className="grow">Trocar senha</span> <Icon name="right" size={18} />
        </button>
        <button className="menu-item" onClick={exportCSV}>
          <Icon name="download" /> <span className="grow">Exportar transações (CSV)</span>
        </button>
        <a className="menu-item" href="/privacidade.html" target="_blank" rel="noreferrer">
          <Icon name="shield" /> <span className="grow">Privacidade e termos</span> <Icon name="right" size={18} />
        </a>
      </nav>

      <nav className="menu">
        <button className="menu-item" onClick={() => supabase.auth.signOut()}>
          <Icon name="logout" /> <span className="grow">Sair</span>
        </button>
        <button className="menu-item danger" onClick={deleteAccount}>
          <Icon name="trash" /> <span className="grow">Excluir minha conta</span>
        </button>
      </nav>

      <p className="muted small center">Fina 1.0</p>

      {editName && <NameSheet initial={name} onClose={() => setEditName(false)} />}
      {changePass && <PasswordSheet onClose={() => setChangePass(false)} />}
    </div>
  );
}

function NameSheet({ initial, onClose }: { initial: string; onClose: () => void }) {
  const { updateProfile } = useApp();
  const [name, setName] = useState(initial);
  const [error, setError] = useState('');
  return (
    <Sheet title="Seu nome" onClose={onClose}>
      <Field label="Nome" error={error}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
      </Field>
      <button
        className="btn primary block"
        onClick={async () => {
          if (name.trim().length < 2) return setError('Informe seu nome.');
          try {
            await updateProfile({ name: name.trim() });
            toast('Nome atualizado');
            onClose();
          } catch (err) {
            setError(friendlyError(err));
          }
        }}
      >
        Salvar
      </button>
    </Sheet>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  return (
    <Sheet title="Trocar senha" onClose={onClose}>
      <Field label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números.">
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" ariaLabel="Nova senha" />
      </Field>
      <Field label="Confirmar nova senha">
        <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" ariaLabel="Confirmar nova senha" />
      </Field>
      {error && <p className="form-error">{error}</p>}
      <button
        className="btn primary block"
        onClick={async () => {
          const p = passwordProblem(password);
          if (p) return setError(p);
          if (password !== confirm) return setError('As senhas não conferem.');
          const { error } = await supabase.auth.updateUser({ password });
          if (error) return setError(friendlyError(error));
          toast('Senha alterada');
          onClose();
        }}
      >
        Salvar nova senha
      </button>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Perfil > Meus custos: reaproveita as telas do onboarding            */
/* ------------------------------------------------------------------ */
const TABS = [
  { id: 'renda', label: 'Renda' },
  { id: 'fixos', label: 'Custos fixos' },
  { id: 'variaveis', label: 'Dia a dia' },
  { id: 'contas', label: 'Contas' },
  { id: 'dividas', label: 'Dívidas' },
] as const;

export function MyCosts() {
  const { userId, categories, updateProfile, bump } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('renda');

  const actions: StepActions = {
    primaryLabel: 'Salvar alterações',
    onBack: () => go('/perfil'),
    onDone: async () => {
      try {
        await refreshPlanned(userId, currentMonth(), categories);
        await updateProfile({ last_review_month: currentMonth() });
        bump();
        toast('Alterações salvas');
      } catch (err) {
        toast(friendlyError(err));
      }
    },
  };

  return (
    <div className="page">
      <header className="page-head">
        <button className="icon-btn" onClick={() => go('/perfil')} aria-label="Voltar">
          <Icon name="left" />
        </button>
        <h1 className="grow">Meus custos</h1>
      </header>
      <div className="chips scroll">
        {TABS.map((t) => (
          <button key={t.id} className={`chip${tab === t.id ? ' selected' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="muted small">Mudanças atualizam os lançamentos previstos deste mês. O que já foi pago não muda.</p>
      <div className="edit-step" key={tab}>
        {tab === 'renda' && <IncomeStep actions={actions} />}
        {tab === 'fixos' && <FixedStep actions={actions} />}
        {tab === 'variaveis' && <VariableStep actions={actions} />}
        {tab === 'contas' && <AccountsStep actions={actions} />}
        {tab === 'dividas' && <DebtsStep actions={actions} />}
      </div>
    </div>
  );
}
