import { useEffect, useState, type ReactNode } from 'react';
import { moneyInput, monthLabel, parseMoney, shiftMonth } from '../lib/format';

/* ------------------------------------------------------------------ */
/* Ícones (SVG em linha, sem dependências)                             */
/* ------------------------------------------------------------------ */
const PATHS: Record<string, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>,
  list: <><path d="M4 7h16M4 12h16M4 17h10" /></>,
  pie: <><path d="M12 3v9h9" /><circle cx="12" cy="12" r="9" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  x: <><path d="M6 6l12 12M18 6 6 18" /></>,
  left: <><path d="m15 5-7 7 7 7" /></>,
  right: <><path d="m9 5 7 7-7 7" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  check: <><path d="m5 12 5 5 9-10" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  logout: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></>,
  moon: <><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3" /></>,
  alert: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  wallet: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M5 7l11-4 1 4" /><rect x="14" y="11" width="7" height="5" rx="1.5" /></>,
  up: <><path d="M7 17 17 7M9 7h8v8" /></>,
  down: <><path d="M7 7l10 10M17 9v8H9" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /></>,
};

export function Icon({ name, size = 20, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Painel que sobe de baixo (bottom sheet)                             */
/* ------------------------------------------------------------------ */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campos                                                              */
/* ------------------------------------------------------------------ */
export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className={`field${error ? ' has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** Campo de valor em reais. Guarda o texto enquanto a pessoa digita e devolve número. */
export function MoneyField({
  value,
  onChange,
  placeholder = '0,00',
  autoFocus,
  big,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  big?: boolean;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(moneyInput(value));
  return (
    <div className={`money-input${big ? ' big' : ''}`}>
      <span>R$</span>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d,.]/g, '');
          setText(t);
          const n = parseMoney(t);
          onChange(Number.isNaN(n) ? null : n);
        }}
        onBlur={() => {
          const n = parseMoney(text);
          if (!Number.isNaN(n)) setText(moneyInput(n));
        }}
      />
    </div>
  );
}

export function DayField({ value, onChange, ariaLabel }: { value: number | null; onChange: (v: number | null) => void; ariaLabel?: string }) {
  return (
    <input
      className="input day-input"
      inputMode="numeric"
      aria-label={ariaLabel || 'Dia'}
      placeholder="Dia"
      value={value ?? ''}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, '').slice(0, 2);
        onChange(t ? Number(t) : null);
      }}
    />
  );
}

export function PasswordInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  ariaLabel?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-icon">
      <Icon name="lock" size={18} />
      <input
        type={show ? 'text' : 'password'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder || '••••••••'}
        autoComplete={props.autoComplete}
        aria-label={props.ariaLabel}
      />
      <button type="button" className="icon-btn ghost" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
        <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seletor de mês                                                      */
/* ------------------------------------------------------------------ */
export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="month-picker">
      <button className="icon-btn" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Mês anterior">
        <Icon name="left" size={18} />
      </button>
      <span>{monthLabel(month)}</span>
      <button className="icon-btn" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Próximo mês">
        <Icon name="right" size={18} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barra de progresso de orçamento                                     */
/* ------------------------------------------------------------------ */
export function Progress({ value, max, tone }: { value: number; max: number; tone?: 'auto' | 'accent' }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const cls = tone === 'accent' ? 'ok' : pct > 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-bar ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avisos rápidos (toast)                                              */
/* ------------------------------------------------------------------ */
let pushToast: (msg: string) => void = () => {};
export const toast = (msg: string) => pushToast(msg);

export function ToastHost() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let timer: number | undefined;
    pushToast = (m) => {
      setMsg(m);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(''), 2600);
    };
    return () => window.clearTimeout(timer);
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rotas simples baseadas em #hash                                     */
/* ------------------------------------------------------------------ */
export function useHashRoute(): string {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path: string) => {
  window.location.hash = path;
};
