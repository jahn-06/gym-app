-- ============================================
-- FITNESS APP - datový model
-- Tento skript spusťte v Supabase: SQL Editor -> New query -> vložit -> Run
-- ============================================

-- 1) PROFILES
-- Rozšiřuje vestavěnou tabulku "auth.users" (tu spravuje Supabase Auth
-- automaticky při registraci) o naše vlastní údaje jako jméno, telefon atd.
-- Propojujeme ji přes stejné "id", jaké má uživatel v auth.users.
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  first_name text,
  last_name text,
  phone text,
  birth_date date,
  created_at timestamptz default now()
);

-- Zapneme Row Level Security -- bez tohoto řádku by RLS pravidla níže
-- vůbec neplatila a tabulka by byla otevřená všem.
alter table profiles enable row level security;

-- Pravidlo: uživatel smí číst POUZE svůj vlastní profil
create policy "Uzivatel vidi svuj profil"
  on profiles for select
  using (auth.uid() = id);

-- Pravidlo: uživatel smí upravovat POUZE svůj vlastní profil
create policy "Uzivatel upravuje svuj profil"
  on profiles for update
  using (auth.uid() = id);

-- Automatika: při každé nové registraci v auth.users se automaticky
-- vytvoří odpovídající prázdný řádek v profiles. Bez tohoto triggeru
-- bychom museli vytváření profilu řešit ručně v appce.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2) MEMBERSHIP_TYPES
-- Ceník - toto NENÍ vázané na konkrétního uživatele, je to společný
-- číselník pro všechny (proto na tuto tabulku nedáváme "uid = " pravidlo,
-- ale jen "všichni smí číst, nikdo přes appku nesmí zapisovat").
create table membership_types (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  price_czk numeric not null,
  duration_days int, -- null = jednorázový vstup (nemá trvání)
  sort_order int default 0
);

alter table membership_types enable row level security;

create policy "Kdokoli prihlaseny vidi cenik"
  on membership_types for select
  using (auth.role() = 'authenticated');

-- Naplníme počáteční ceník
insert into membership_types (name, price_czk, duration_days, sort_order) values
  ('Jednorázový vstup', 149, null, 1),
  ('Měsíční permanentka', 899, 30, 2),
  ('Čtvrtletní permanentka', 2399, 90, 3),
  ('Roční permanentka', 7900, 365, 4);


-- 3) MEMBERSHIPS
-- Konkrétní zakoupená permice konkrétního uživatele.
create table memberships (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  membership_type_id uuid references membership_types not null,
  starts_on date not null,
  ends_on date, -- null pro jednorázový vstup
  status text not null default 'pending', -- 'pending' | 'active' | 'expired' | 'used'
  created_at timestamptz default now()
);

alter table memberships enable row level security;

create policy "Uzivatel vidi sve permice"
  on memberships for select
  using (auth.uid() = user_id);

create policy "Uzivatel si muze zalozit permici"
  on memberships for insert
  with check (auth.uid() = user_id);


-- 4) CHECK_INS
-- Log vstupů do fitka.
create table check_ins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  checked_in_at timestamptz default now()
);

alter table check_ins enable row level security;

create policy "Uzivatel vidi sve vstupy"
  on check_ins for select
  using (auth.uid() = user_id);

create policy "Uzivatel si muze zapsat vstup"
  on check_ins for insert
  with check (auth.uid() = user_id);
