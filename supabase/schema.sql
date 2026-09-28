-- =====================================================================
-- Fina — esquema do banco de dados (Supabase / PostgreSQL)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- Pode ser executado mais de uma vez sem problemas.
-- =====================================================================

-- ---------- PERFIL ----------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 120),
  onboarding_step int not null default 1 check (onboarding_step between 1 and 6),
  onboarding_completed boolean not null default false,
  last_review_month text check (last_review_month is null or last_review_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  theme text not null default 'claro' check (theme in ('claro', 'escuro')),
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- CATEGORIAS -------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('despesa', 'receita')),
  icon text not null default '📦',
  color text not null default '#888780' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- CONTAS E CARTÕES -------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type text not null check (type in ('corrente', 'poupanca', 'carteira', 'credito')),
  initial_balance numeric(14,2) not null default 0,
  credit_limit numeric(14,2),
  closing_day int check (closing_day between 1 and 31),
  due_day int check (due_day between 1 and 31),
  created_at timestamptz not null default now()
);

-- ---------- RENDAS (recorrentes) ---------------------------------------
create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  amount numeric(14,2) not null check (amount > 0),
  day int not null check (day between 1 and 31),
  category_id uuid references public.categories (id) on delete set null,
  start_month text not null check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- CUSTOS FIXOS (recorrentes) ---------------------------------
create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  amount numeric(14,2) not null check (amount > 0),
  day int not null check (day between 1 and 31),
  category_id uuid references public.categories (id) on delete set null,
  start_month text not null check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- DÍVIDAS E PARCELAS -----------------------------------------
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('emprestimo', 'financiamento', 'parcela_cartao')),
  name text not null check (char_length(name) between 1 and 80),
  installment_amount numeric(14,2) not null check (installment_amount > 0),
  current_installment int not null default 1 check (current_installment >= 1),
  total_installments int not null check (total_installments >= 1),
  due_day int not null check (due_day between 1 and 31),
  account_id uuid references public.accounts (id) on delete set null,
  start_month text not null check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  check (current_installment <= total_installments),
  created_at timestamptz not null default now()
);

-- ---------- ORÇAMENTOS -------------------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  monthly_limit numeric(14,2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

-- ---------- METAS ------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  target_amount numeric(14,2) not null check (target_amount > 0),
  saved_amount numeric(14,2) not null default 0 check (saved_amount >= 0),
  deadline date,
  created_at timestamptz not null default now()
);

-- ---------- TRANSAÇÕES -------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('receita', 'despesa')),
  amount numeric(14,2) not null check (amount > 0),
  description text not null default '' check (char_length(description) <= 120),
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  date date not null,
  payment_method text check (payment_method in ('pix', 'debito', 'credito', 'dinheiro', 'boleto', 'transferencia')),
  status text not null default 'paga' check (status in ('prevista', 'paga', 'cancelada')),
  -- lançamentos gerados automaticamente a partir de rendas / custos fixos / dívidas
  source_type text check (source_type in ('income', 'fixed', 'debt')),
  source_id uuid,
  month text check (month is null or month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, month)
);

create index if not exists transactions_user_date on public.transactions (user_id, date desc);
create index if not exists transactions_user_month_status on public.transactions (user_id, month, status);
create index if not exists budgets_user on public.budgets (user_id);
create index if not exists goals_user on public.goals (user_id);

-- ---------- SEGURANÇA: cada usuário só enxerga os próprios dados -------
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.accounts        enable row level security;
alter table public.incomes         enable row level security;
alter table public.fixed_expenses  enable row level security;
alter table public.debts           enable row level security;
alter table public.budgets         enable row level security;
alter table public.goals           enable row level security;
alter table public.transactions    enable row level security;

drop policy if exists "perfil proprio" on public.profiles;
create policy "perfil proprio" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['categories','accounts','incomes','fixed_expenses','debts','budgets','goals','transactions']
  loop
    execute format('drop policy if exists "dados proprios" on public.%I', t);
    execute format(
      'create policy "dados proprios" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------- NOVO USUÁRIO: cria perfil e categorias padrão --------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, terms_accepted_at)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', ''), 120),
    case when new.raw_user_meta_data ->> 'terms_accepted' = 'true' then now() end
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, kind, icon, color, sort) values
    (new.id, 'Moradia',        'despesa', '🏠', '#1D9E75', 1),
    (new.id, 'Contas da casa', 'despesa', '💡', '#378ADD', 2),
    (new.id, 'Mercado',        'despesa', '🛒', '#D85A30', 3),
    (new.id, 'Restaurantes',   'despesa', '🍽️', '#D4537E', 4),
    (new.id, 'Transporte',     'despesa', '🚗', '#7F77DD', 5),
    (new.id, 'Saúde',          'despesa', '💊', '#E24B4A', 6),
    (new.id, 'Educação',       'despesa', '🎓', '#185FA5', 7),
    (new.id, 'Lazer',          'despesa', '🎉', '#EF9F27', 8),
    (new.id, 'Assinaturas',    'despesa', '📺', '#534AB7', 9),
    (new.id, 'Compras',        'despesa', '🛍️', '#993556', 10),
    (new.id, 'Dívidas',        'despesa', '💳', '#A32D2D', 11),
    (new.id, 'Outros',         'despesa', '📦', '#888780', 12),
    (new.id, 'Salário',        'receita', '💼', '#0F6E56', 1),
    (new.id, 'Freelance',      'receita', '🧑‍💻', '#3B6D11', 2),
    (new.id, 'Outras receitas','receita', '💰', '#639922', 3);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- EXCLUIR CONTA (LGPD / exigência das lojas) -----------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  requesting_user uuid := auth.uid();
begin
  if requesting_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  delete from auth.users where id = requesting_user;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
