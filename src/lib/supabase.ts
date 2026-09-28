import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && key);

export const supabase = createClient(url || 'http://localhost', key || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export function authRedirectUrl(): string {
  return Capacitor.isNativePlatform() ? 'com.fina.app://auth/callback' : window.location.origin;
}

/** Finaliza callbacks OAuth/PKCE recebidos pelo esquema nativo do Capacitor. */
export async function handleNativeAuthCallback(callbackUrl: string): Promise<'signin' | 'recovery'> {
  const parsed = new URL(callbackUrl);
  const callbackType = parsed.searchParams.get('type') === 'recovery' || parsed.hash.includes('type=recovery') ? 'recovery' : 'signin';
  const code = parsed.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return callbackType;
  }

  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  }
  return callbackType;
}

/** Traduz os erros mais comuns do Supabase para mensagens claras em português. */
export function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message || String(err || '');
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar. Veja sua caixa de entrada.';
  if (m.includes('user already registered')) return 'Já existe uma conta com esse e-mail.';
  if (m.includes('password should be')) return 'A senha é muito fraca. Use pelo menos 8 caracteres com letras e números.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com a internet. Tente de novo.';
  if (m.includes('same password') || m.includes('different from the old')) return 'A nova senha precisa ser diferente da atual.';
  return 'Algo deu errado. Tente de novo em instantes.';
}
