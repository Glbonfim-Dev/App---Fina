import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { currentMonth } from './format';
import type { Account, Category, Profile } from './types';

interface AppState {
  loading: boolean;
  session: Session | null;
  userId: string;
  email: string;
  profile: Profile | null;
  recovering: boolean;
  categories: Category[];
  accounts: Account[];
  month: string;
  setMonth: (m: string) => void;
  /** muda sempre que algo é salvo, para as telas recarregarem */
  version: number;
  bump: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  refreshLists: () => Promise<void>;
  endRecovery: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fora do AppProvider');
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [version, setVersion] = useState(0);

  const userId = session?.user.id ?? '';

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (data.session) setLoading(true);
        setSession(data.session);
        if (!data.session) setLoading(false);
      })
      .catch(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (s) setLoading(true);
      setSession(s);
      if (!s) {
        setProfile(null);
        setCategories([]);
        setAccounts([]);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    let lastError: unknown;
    // o perfil é criado por um gatilho no banco; tenta algumas vezes logo após o cadastro
    for (let i = 0; i < 4; i++) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) lastError = error;
      if (data) {
        setProfile(data as Profile);
        return;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    if (lastError) throw lastError;
  }, [userId]);

  const refreshLists = useCallback(async () => {
    if (!userId) return;
    const [c, a] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', userId).order('sort'),
      supabase.from('accounts').select('*').eq('user_id', userId).order('created_at'),
    ]);
    setCategories((c.data || []) as Category[]);
    setAccounts(((a.data || []) as Account[]).map((x) => ({ ...x, initial_balance: Number(x.initial_balance) })));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    // A troca de usuário inicia a hidratação remota do contexto; os setters só rodam após I/O assíncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([refreshProfile(), refreshLists()]).finally(() => setLoading(false));
  }, [userId, refreshProfile, refreshLists]);

  useEffect(() => {
    document.documentElement.dataset.theme = profile?.theme === 'escuro' ? 'dark' : 'light';
  }, [profile?.theme]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!userId) return;
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select().single();
      if (error) throw error;
      setProfile(data as Profile);
    },
    [userId]
  );

  const value: AppState = {
    loading,
    session,
    userId,
    email: session?.user.email ?? '',
    profile,
    recovering,
    categories,
    accounts,
    month,
    setMonth,
    version,
    bump: () => setVersion((v) => v + 1),
    refreshProfile,
    updateProfile,
    refreshLists,
    endRecovery: () => setRecovering(false),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
