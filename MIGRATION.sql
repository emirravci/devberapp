-- ============================================================
-- MULTI-TENANT GEÇİŞ BETİĞİ
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

-- 1. BARBERS (Berber Profilleri) Tablosu
create table if not exists barbers (
    id          uuid primary key references auth.users(id) on delete cascade,
    salon_name  text not null default 'Salonum',
    owner_name  text,
    phone       text,
    address     text,
    description text,
    instagram   text,
    logo_url    text,
    cover_url   text,
    created_at  timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table barbers enable row level security;

drop policy if exists "Allow public select on barbers" on barbers;
create policy "Allow public select on barbers"
on barbers for select to public using (true);

drop policy if exists "Allow owner to manage barber profile" on barbers;
create policy "Allow owner to manage barber profile"
on barbers for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================
-- 2. MEVCUT TABLOLARA user_id KOLONU EKLEME
-- ============================================================

alter table appointments add column if not exists user_id uuid references auth.users(id);
create index if not exists idx_appointments_user_id on appointments(user_id);

alter table services add column if not exists user_id uuid references auth.users(id);
create index if not exists idx_services_user_id on services(user_id);

-- Settings tablosunu yedekle, sil ve yeni PRIMARY KEY ile oluştur
drop table if exists settings cascade;
create table settings (
    user_id    uuid not null references auth.users(id) on delete cascade,
    key        text not null,
    value      jsonb not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id, key)
);
alter table settings enable row level security;

-- customer_notes tablosunu yedekle, sil ve yeni PRIMARY KEY ile oluştur
drop table if exists customer_notes cascade;
create table customer_notes (
    user_id    uuid not null references auth.users(id) on delete cascade,
    phone      text not null,
    note       text,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id, phone)
);
alter table customer_notes enable row level security;

-- ============================================================
-- 3. YENİ RLS POLİTİKALARI
-- ============================================================

-- APPOINTMENTS
drop policy if exists "Allow public inserts on appointments" on appointments;
drop policy if exists "Allow public select on appointments" on appointments;
drop policy if exists "Allow authenticated admins all actions on appointments" on appointments;
drop policy if exists "Public can insert appointments" on appointments;
drop policy if exists "Public can read appointments by user_id" on appointments;
drop policy if exists "Authenticated owner can manage their appointments" on appointments;

create policy "Public can insert appointments"
on appointments for insert to public with check (true);

create policy "Public can read appointments by user_id"
on appointments for select to public using (true);

create policy "Authenticated owner can manage their appointments"
on appointments for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SETTINGS
drop policy if exists "Public can read settings" on settings;
drop policy if exists "Authenticated owner can manage their settings" on settings;
drop policy if exists "Allow public selects on settings" on settings;
drop policy if exists "Allow authenticated admins all actions on settings" on settings;

create policy "Public can read settings"
on settings for select to public using (true);

create policy "Authenticated owner can manage their settings"
on settings for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SERVICES
drop policy if exists "Allow public select on services" on services;
drop policy if exists "Allow authenticated admins all actions on services" on services;
drop policy if exists "Public can read services" on services;
drop policy if exists "Authenticated owner can manage their services" on services;

create policy "Public can read services"
on services for select to public using (true);

create policy "Authenticated owner can manage their services"
on services for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- CUSTOMER NOTES
drop policy if exists "Authenticated owner can manage their customer_notes" on customer_notes;
drop policy if exists "Allow authenticated admins all actions on customer_notes" on customer_notes;

create policy "Authenticated owner can manage their customer_notes"
on customer_notes for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 4. YENİ KULLANICI KAYIT OLDUĞUNDA OTOMATİK VARSAYILAN AYARLAR
-- ============================================================
create or replace function public.handle_new_barber()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.barbers (id, salon_name)
    values (new.id, 'Salonum')
    on conflict (id) do nothing;

    insert into public.settings (user_id, key, value) values
    (new.id, 'working_slots',  '{"start": "09:00", "end": "22:00"}'::jsonb),
    (new.id, 'slot_strategy',  '"half_hourly"'::jsonb),
    (new.id, 'break_hours',    '{"start": "13:00", "end": "14:00"}'::jsonb),
    (new.id, 'weekly_holiday', '"none"'::jsonb)
    on conflict (user_id, key) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_barber();
