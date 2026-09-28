import { useState, type FormEvent, type ReactNode } from 'react';
import { authRedirectUrl, friendlyError, supabase } from '../../lib/supabase';
import { useApp } from '../../lib/store';
import { Field, Icon, PasswordInput, go, toast } from '../../components/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function passwordProblem(p: string): string | null {
  if (p.length < 8) return 'Use pelo menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Use letras e números.';
  return null;
}

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-brand">
        <div className="logo">
          <Icon name="wallet" size={30} />
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children}
      {footer && <div className="auth-footer">{footer}</div>}
    </main>
  );
}

function EmailInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="input-icon">
      <Icon name="mail" size={18} />
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="voce@email.com"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
      />
    </div>
  );
}

/* ------------------------------ LOGIN ------------------------------ */
export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return setError('Informe um e-mail válido.');
    if (!password) return setError('Informe sua senha.');
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else go('/');
  }

  return (
    <AuthShell
      title="Fina"
      subtitle="Seu dinheiro sob controle"
      footer={
        <>
          Não tem conta? <a href="#/cadastro">Criar conta</a>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="E-mail">
          <EmailInput value={email} onChange={setEmail} />
        </Field>
        <Field label="Senha">
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" ariaLabel="Senha" />
        </Field>
        <div className="right">
          <a href="#/esqueci">Esqueci minha senha</a>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </AuthShell>
  );
}

/* ----------------------------- CADASTRO ---------------------------- */
export function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (name.trim().length < 2) err.name = 'Informe seu nome.';
    if (!EMAIL_RE.test(email)) err.email = 'Informe um e-mail válido.';
    const p = passwordProblem(password);
    if (p) err.password = p;
    if (confirm !== password) err.confirm = 'As senhas não conferem.';
    if (!terms) err.terms = 'Você precisa aceitar os termos para continuar.';
    setErrors(err);
    if (Object.keys(err).length) return;

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim(), terms_accepted: 'true' },
        emailRedirectTo: authRedirectUrl(),
      },
    });
    setBusy(false);
    if (error) return setErrors({ form: friendlyError(error) });
    if (!data.session) setSent(true); // confirmação por e-mail ativada no Supabase
    else go('/');
  }

  if (sent) {
    return (
      <AuthShell title="Confirme seu e-mail" subtitle={`Enviamos um link para ${email}. Abra o e-mail e toque no link para ativar sua conta.`}>
        <a className="btn primary block" href="#/entrar">
          Voltar para o login
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Leva menos de um minuto"
      footer={
        <>
          Já tem conta? <a href="#/entrar">Entrar</a>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Nome" error={errors.name}>
          <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Souza" maxLength={120} />
        </Field>
        <Field label="E-mail" error={errors.email}>
          <EmailInput value={email} onChange={setEmail} />
        </Field>
        <Field label="Senha" error={errors.password} hint="Mínimo de 8 caracteres, com letras e números.">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" ariaLabel="Senha" />
        </Field>
        <Field label="Confirmar senha" error={errors.confirm}>
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" ariaLabel="Confirmar senha" />
        </Field>
        <label className={`check${errors.terms ? ' has-error' : ''}`}>
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>
            Li e aceito os <a href="/termos.html" target="_blank" rel="noreferrer">Termos de Uso</a> e a{' '}
            <a href="/privacidade.html" target="_blank" rel="noreferrer">Política de Privacidade</a>.
          </span>
        </label>
        {errors.terms && <p className="field-error">{errors.terms}</p>}
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>
    </AuthShell>
  );
}

/* ------------------------- ESQUECI A SENHA ------------------------- */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return setError('Informe um e-mail válido.');
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else setSent(true);
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle={sent ? 'Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha.' : 'Informe o e-mail da sua conta.'}
      footer={<a href="#/entrar">Voltar para o login</a>}
    >
      {!sent && (
        <form className="stack" onSubmit={submit} noValidate>
          <Field label="E-mail">
            <EmailInput value={email} onChange={setEmail} />
          </Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn primary block" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

/* --------------------------- NOVA SENHA ---------------------------- */
export function NewPassword({ onDone }: { onDone?: () => void }) {
  const { endRecovery } = useApp();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const p = passwordProblem(password);
    if (p) return setError(p);
    if (password !== confirm) return setError('As senhas não conferem.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    toast('Senha alterada');
    endRecovery();
    onDone?.();
    go('/');
  }

  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma senha nova para sua conta.">
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números.">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" ariaLabel="Nova senha" />
        </Field>
        <Field label="Confirmar nova senha">
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" ariaLabel="Confirmar nova senha" />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </AuthShell>
  );
}
