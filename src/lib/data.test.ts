import { describe, expect, it } from 'vitest';
import { sumBy, toCSV } from './data';
import type { Category, Transaction } from './types';

const base: Omit<Transaction, 'type' | 'amount' | 'status'> = {
  id: 'tx',
  description: 'Teste',
  category_id: 'cat',
  account_id: null,
  date: '2026-09-28',
  payment_method: 'pix',
};

describe('regras de transações', () => {
  it('não soma ocorrências canceladas e separa realizado de previsto', () => {
    const rows: Transaction[] = [
      { ...base, id: '1', type: 'despesa', amount: 10, status: 'paga' },
      { ...base, id: '2', type: 'despesa', amount: 20, status: 'prevista' },
      { ...base, id: '3', type: 'despesa', amount: 30, status: 'cancelada' },
    ];
    expect(sumBy(rows, 'despesa')).toBe(30);
    expect(sumBy(rows, 'despesa', true)).toBe(10);
  });

  it('gera CSV compatível com Excel e protege campos com aspas', () => {
    const rows: Transaction[] = [
      { ...base, type: 'despesa', amount: 12.5, status: 'paga', description: 'Mercado "Centro"' },
    ];
    const categories: Category[] = [
      { id: 'cat', user_id: 'user', name: 'Mercado', kind: 'despesa', icon: '🛒', color: '#D85A30', sort: 1 },
    ];
    const csv = toCSV(rows, categories);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Mercado ""Centro"""');
    expect(csv).toContain('12,50');
  });
});
