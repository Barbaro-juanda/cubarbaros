-- Cubárbaros Caja: pega TODO esto en Supabase > SQL Editor > Run.

create table if not exists public.registros (
  id             text primary key,
  tipo           text not null check (tipo in ('pedido', 'gasto', 'config')),
  datos          jsonb not null,
  actualizado_en bigint not null,
  borrado        boolean not null default false
);

create index if not exists registros_actualizado_idx on public.registros (actualizado_en);

-- Si llega un cambio MÁS VIEJO que el guardado, se ignora (gana el más reciente).
create or replace function public.ignorar_cambio_viejo() returns trigger
language plpgsql as $$
begin
  if new.actualizado_en < old.actualizado_en then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists registros_ignorar_viejo on public.registros;
create trigger registros_ignorar_viejo
  before update on public.registros
  for each row execute function public.ignorar_cambio_viejo();

-- Seguridad: solo quien tenga sesión (el usuario del código) puede leer y escribir.
alter table public.registros enable row level security;

drop policy if exists "solo con sesion" on public.registros;
create policy "solo con sesion" on public.registros
  for all to authenticated
  using (true) with check (true);
