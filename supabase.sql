create table if not exists public.rifa_reservas (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null,
  email text not null,
  amount numeric(10,2) not null,
  status text not null default 'reservado',
  created_at timestamptz not null default now()
);

create table if not exists public.rifa_numeros (
  number integer primary key check (number between 1 and 100),
  reservation_id bigint not null references public.rifa_reservas(id) on delete cascade
);

create index if not exists idx_rifa_numeros_reservation_id on public.rifa_numeros(reservation_id);

create or replace function public.reservar_numeros(
  p_numbers integer[],
  p_name text,
  p_phone text,
  p_email text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_count integer;
  v_expected integer;
begin
  if p_numbers is null or array_length(p_numbers, 1) is null then
    raise exception 'Selecione pelo menos um número.';
  end if;
  v_expected := (select count(*) from (select distinct unnest(p_numbers)) x);
  if v_expected <> array_length(p_numbers, 1) then
    raise exception 'Números duplicados na seleção.';
  end if;
  if exists (select 1 from public.rifa_numeros where number = any(p_numbers)) then
    raise exception 'Um ou mais números já foram reservados.';
  end if;

  insert into public.rifa_reservas(name, phone, email, amount)
  values (trim(p_name), trim(p_phone), lower(trim(p_email)), p_amount)
  returning id into v_id;

  insert into public.rifa_numeros(number, reservation_id)
  select n, v_id from unnest(p_numbers) as n;

  select count(*) into v_count from public.rifa_numeros where reservation_id = v_id;
  if v_count <> v_expected then
    raise exception 'Não foi possível registrar todos os números.';
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function public.reservar_numeros(integer[],text,text,text,numeric) from public;
revoke all on function public.reservar_numeros(integer[],text,text,text,numeric) from anon;
revoke all on function public.reservar_numeros(integer[],text,text,text,numeric) from authenticated;
grant execute on function public.reservar_numeros(integer[],text,text,text,numeric) to service_role;

alter table public.rifa_reservas enable row level security;
alter table public.rifa_numeros enable row level security;
