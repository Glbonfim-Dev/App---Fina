export type Kind = 'despesa' | 'receita';
export type PaymentMethod = 'pix' | 'debito' | 'credito' | 'dinheiro' | 'boleto' | 'transferencia';
export type AccountType = 'corrente' | 'poupanca' | 'carteira' | 'credito';
export type DebtKind = 'emprestimo' | 'financiamento' | 'parcela_cartao';

export interface Profile {
  id: string;
  name: string;
  onboarding_step: number;
  onboarding_completed: boolean;
  last_review_month: string | null;
  theme: 'claro' | 'escuro';
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  kind: Kind;
  icon: string;
  color: string;
  sort: number;
}

export interface Account {
  id?: string;
  user_id?: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
}

export interface Income {
  id?: string;
  user_id?: string;
  name: string;
  amount: number;
  day: number;
  category_id: string | null;
  start_month?: string;
  active?: boolean;
}

export interface FixedExpense {
  id?: string;
  user_id?: string;
  name: string;
  amount: number;
  day: number;
  category_id: string | null;
  start_month?: string;
  active?: boolean;
}

export interface Debt {
  id?: string;
  user_id?: string;
  kind: DebtKind;
  name: string;
  installment_amount: number;
  current_installment: number;
  total_installments: number;
  due_day: number;
  account_id: string | null;
  start_month?: string;
}

export interface Budget {
  id?: string;
  user_id?: string;
  category_id: string;
  monthly_limit: number;
}

export interface Goal {
  id?: string;
  user_id?: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  deadline: string | null;
}

export interface Transaction {
  id?: string;
  user_id?: string;
  type: Kind;
  amount: number;
  description: string;
  category_id: string | null;
  account_id: string | null;
  date: string; // AAAA-MM-DD
  payment_method: PaymentMethod | null;
  status: 'prevista' | 'paga' | 'cancelada';
  source_type?: 'income' | 'fixed' | 'debt' | null;
  source_id?: string | null;
  month?: string | null;
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto',
  transferencia: 'Transferência',
};

export const ACCOUNT_LABELS: Record<AccountType, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  carteira: 'Carteira',
  credito: 'Cartão de crédito',
};

export const DEBT_LABELS: Record<DebtKind, string> = {
  emprestimo: 'Empréstimo',
  financiamento: 'Financiamento',
  parcela_cartao: 'Compra parcelada',
};
