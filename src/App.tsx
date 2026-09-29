import { useState } from 'react';
import { AppProvider, useApp } from './lib/store';
import { isConfigured, supabase } from './lib/supabase';
import { ForgotPassword, Login, NewPassword, Signup } from './pages/auth/AuthPages';
import { Onboarding } from './pages/onboarding/Onboarding';
import { Home } from './pages/Home';
import { Transactions } from './pages/Transactions';
import { Budgets } from './pages/Budgets';
import { MyCosts, Profile } from './pages/Profile';
import { TransactionForm } from './components/TransactionForm';
import { Icon, Spinner, ToastHost, useHashRoute } from './components/ui';

export default function App() {
  if (!isConfigured) return <SetupNeeded />;
  return (
    <AppProvider>
      <Router />
      <ToastHost />
    </AppProvider>
  );
}

function Router() {
  const { loading, session, profile, recovering } = useApp();
  const route = useHashRoute();

  if (recovering) return <NewPassword />;
  if (loading) return <Splash />;

  // ---------- sem login: só as telas de acesso ----------
  if (!session) {
    if (route.startsWith('/cadastro')) return <Signup />;
    if (route.startsWith('/esqueci')) return <ForgotPassword />;
    return <Login />;
  }

  if (!profile) {
    return (
      <main className="auth">
        <p className="muted center">Não foi possível carregar seu perfil.</p>
        <button className="btn primary block" onClick={() => window.location.reload()}>
          Tentar de novo
        </button>
        <button className="btn block" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </main>
    );
  }

  if (route.startsWith('/nova-senha')) return <NewPassword />;

  // ---------- onboarding obrigatório ----------
  if (!profile.onboarding_completed) return <Onboarding />;

  return <Tabs route={route} />;
}

const NAV = [
  { path: '/', label: 'Início', icon: 'home' },
  { path: '/transacoes', label: 'Transações', icon: 'list' },
  { path: '/orcamentos', label: 'Orçamentos', icon: 'pie' },
  { path: '/perfil', label: 'Perfil', icon: 'user' },
];

function Tabs({ route }: { route: string }) {
  const [adding, setAdding] = useState(false);
  const active = (p: string) => (p === '/' ? route === '/' || route === '' : route.startsWith(p));

  let page;
  if (route.startsWith('/transacoes')) page = <Transactions />;
  else if (route.startsWith('/orcamentos')) page = <Budgets />;
  else if (route.startsWith('/perfil/custos')) page = <MyCosts />;
  else if (route.startsWith('/perfil')) page = <Profile />;
  else page = <Home />;

  return (
    <div className="app">
      <main className="app-main">{page}</main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {NAV.slice(0, 2).map((n) => (
          <a key={n.path} href={`#${n.path}`} className={active(n.path) ? 'active' : ''} aria-current={active(n.path) ? 'page' : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </a>
        ))}
        <button className="fab" onClick={() => setAdding(true)} aria-label="Nova transação">
          <Icon name="plus" size={26} />
        </button>
        {NAV.slice(2).map((n) => (
          <a key={n.path} href={`#${n.path}`} className={active(n.path) ? 'active' : ''} aria-current={active(n.path) ? 'page' : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>

      {adding && <TransactionForm onClose={() => setAdding(false)} />}
    </div>
  );
}

function Splash() {
  return (
    <main className="splash">
      <div className="logo">
        <Icon name="wallet" size={30} />
      </div>
      <Spinner />
    </main>
  );
}

function SetupNeeded() {
  return (
    <main className="auth">
      <div className="auth-brand">
        <div className="logo">
          <Icon name="wallet" size={30} />
        </div>
        <h1>Falta configurar o Supabase</h1>
        <p className="muted">
          Crie o arquivo <code>.env</code> (copie de <code>.env.example</code>) com <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>. No GitHub, cadastre essas duas variáveis em Settings &gt; Secrets and variables &gt; Actions. Veja o
          README.
        </p>
      </div>
    </main>
  );
}
