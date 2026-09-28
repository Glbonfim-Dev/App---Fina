import type { Category, Transaction } from '../lib/types';
import { PAYMENT_LABELS } from '../lib/types';
import { dateBR, money } from '../lib/format';

export function TxRow({
  t,
  category,
  onClick,
  action,
}: {
  t: Transaction;
  category?: Category;
  onClick?: () => void;
  action?: { label: string; onClick: () => void };
}) {
  const sign = t.type === 'receita' ? '+' : '−';
  const meta = [
    action ? `${sign} ${money(t.amount)}` : '',
    t.status === 'prevista' ? `Vence ${dateBR(t.date).slice(0, 5)}` : dateBR(t.date).slice(0, 5),
    category?.name ?? 'Sem categoria',
    t.payment_method ? PAYMENT_LABELS[t.payment_method] : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="tx-row">
      <button className="tx-main" onClick={onClick}>
        <span className="tx-icon" style={{ background: `${category?.color ?? '#888780'}22` }} aria-hidden="true">
          {category?.icon ?? '📦'}
        </span>
        <span className="tx-text">
          <span className="tx-desc">{t.description}</span>
          <span className="tx-meta">
            {t.status === 'prevista' && !action && <span className="badge warn">Prevista</span>} {meta}
          </span>
        </span>
        {!action && (
          <span className={`tx-amount ${t.type === 'receita' ? 'pos' : 'neg'}`}>
            {sign} {money(t.amount)}
          </span>
        )}
      </button>
      {action && (
        <button className="btn small" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
