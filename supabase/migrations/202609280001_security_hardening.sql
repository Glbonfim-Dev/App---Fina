-- Execute este arquivo em projetos criados antes de 28/09/2026.
-- As constraints NOT VALID protegem novos dados sem bloquear a migração por
-- registros antigos; valide-as depois de corrigir eventuais dados legados.

alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check
  check (status in ('prevista', 'paga', 'cancelada'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_theme_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_theme_check check (theme in ('claro', 'escuro')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_onboarding_step_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_onboarding_step_check check (onboarding_step between 1 and 6) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goals_saved_amount_check' and conrelid = 'public.goals'::regclass) then
    alter table public.goals add constraint goals_saved_amount_check check (saved_amount >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_description_length_check' and conrelid = 'public.transactions'::regclass) then
    alter table public.transactions add constraint transactions_description_length_check check (char_length(description) <= 120) not valid;
  end if;
end $$;

create index if not exists transactions_user_month_status on public.transactions (user_id, month, status);
create index if not exists budgets_user on public.budgets (user_id);
create index if not exists goals_user on public.goals (user_id);

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
    (new.id, 'Moradia', 'despesa', '🏠', '#1D9E75', 1),
    (new.id, 'Contas da casa', 'despesa', '💡', '#378ADD', 2),
    (new.id, 'Mercado', 'despesa', '🛒', '#D85A30', 3),
    (new.id, 'Restaurantes', 'despesa', '🍽️', '#D4537E', 4),
    (new.id, 'Transporte', 'despesa', '🚗', '#7F77DD', 5),
    (new.id, 'Saúde', 'despesa', '💊', '#E24B4A', 6),
    (new.id, 'Educação', 'despesa', '🎓', '#185FA5', 7),
    (new.id, 'Lazer', 'despesa', '🎉', '#EF9F27', 8),
    (new.id, 'Assinaturas', 'despesa', '📺', '#534AB7', 9),
    (new.id, 'Compras', 'despesa', '🛍️', '#993556', 10),
    (new.id, 'Dívidas', 'despesa', '💳', '#A32D2D', 11),
    (new.id, 'Outros', 'despesa', '📦', '#888780', 12),
    (new.id, 'Salário', 'receita', '💼', '#0F6E56', 1),
    (new.id, 'Freelance', 'receita', '🧑‍💻', '#3B6D11', 2),
    (new.id, 'Outras receitas', 'receita', '💰', '#639922', 3);
  return new;
end;
$$;

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
