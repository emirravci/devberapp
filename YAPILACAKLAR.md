# Kullanıcı Tarafından Yapılması Gerekenler (YAPILACAKLAR.md)

Bu dosya, Berber Randevu Sistemi'nde yapılan dinamik hizmet yönetimi ve hata düzeltmelerinin veritabanı tarafında aktif hale gelmesi için **sizin (yönetici/geliştirici olarak)** Supabase üzerinde yapmanız gereken adımları içerir.

---

## 1. Supabase SQL Betiğini Çalıştırmak

Dinamik hizmet yönetimi (`services` tablosu) ve müşteri yetkilendirmesi (RLS) için aşağıdaki adımları sırasıyla uygulayın:

1. [Supabase Paneline](https://supabase.com) giriş yapın ve projenizi açın.
2. Sol menüdeki **SQL Editor** simgesine (üzerinde `SQL` yazan terminal simgesi) tıklayın.
3. **New Query** butonuna tıklayarak yeni bir sorgu penceresi açın.
4. Aşağıdaki SQL kodunu kopyalayıp sorgu penceresine yapıştırın:

```sql
-- 1. Services Table (Dinamik Hizmetler Tablosu)
create table if not exists services (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    price numeric not null,
    duration integer not null, -- dakika cinsinden
    description text,
    icon text default 'fa-scissors' not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Row Level Security (RLS) Aktifleştirme
alter table services enable row level security;

-- 3. RLS Politikaları (Security Policies)
-- Müşterilerin kendi randevu durumlarını okuyabilmesi için RLS Politikası Güncellemesi
drop policy if exists "Allow public select on appointments" on appointments;
create policy "Allow public select on appointments"
on appointments for select to public using (true);

-- Müşteriler hizmetleri okuyabilir
drop policy if exists "Allow public select on services" on services;
create policy "Allow public select on services"
on services for select to public using (true);

-- Sadece giriş yapmış admin hizmetleri üzerinde tüm işlemleri yapabilir
drop policy if exists "Allow authenticated admins all actions on services" on services;
create policy "Allow authenticated admins all actions on services"
on services for all to authenticated using (true) with check (true);

-- 4. Varsayılan Hizmetlerin Eklenmesi (Eğer yoksa)
insert into services (name, price, duration, description, icon) values
('Saç Kesimi', 250, 45, 'Yıkama ve fön dahildir.', 'fa-user-tie'),
('Sakal Kesimi', 150, 30, 'Sakal bakımı ve özel losyon.', 'fa-face-grimace'),
('Saç & Sakal', 350, 60, 'Saç-sakal kesimi, yıkama ve bakım.', 'fa-scissors'),
('Cilt Bakımı', 200, 40, 'Maske, buhar ve nemlendirici bakım.', 'fa-spa')
on conflict do nothing;
```

5. Sağ alttaki **Run** butonuna tıklayarak kodu çalıştırın. Başarılı mesajı (Success) aldığınızdan emin olun.

---

## 2. Admin Hesabı İçin Email Doğrulamasını Kapatma (Zorunlu Değil, Kolaylık İçin)
Eğer admin girişi yaparken e-posta aktivasyon adımıyla uğraşmak istemiyorsanız:
1. Supabase panelinde **Authentication > Providers > Email** ayarlarına gidin.
2. **Confirm email** seçeneğini bulun ve kapatıp (disabled) kaydedin.
3. Artık **Authentication > Users** kısmından oluşturduğunuz kullanıcı doğrudan giriş yapabilir.

---

## 3. Akıllı Saat Planlaması & Sihirbaz Güncellemeleri SQL Sorgusu (Son Değişiklikler)

En son eklediğimiz 3 adımlı sihirbaz ve akıllı zaman dağılım modlarının (`service_based`, `hourly`, `half_hourly`) çalışabilmesi için veritabanınızda şu SQL kodunu da çalıştırmanız gerekir:

1. Supabase panelinde **SQL Editor** sayfasına gidin.
2. **New Query** butonuna basın.
3. Aşağıdaki SQL kodunu yapıştırıp **Run** butonuna tıklayın:

```sql
-- 1. appointments tablosuna hizmet süresi kolonu ekleme
alter table appointments 
add column if not exists service_duration integer default 30;

-- 2. Ayarlar tablosuna slot stratejisi seçeneği ekleme (varsayılan: yarım saatlik)
insert into settings (key, value) values (
    'slot_strategy',
    '"half_hourly"'::jsonb
) on conflict (key) do nothing;
```

Bu adımları tamamladıktan sonra sistemin yeni dinamik ve akıllı zamanlama yapısı tamamen aktifleşecektir!

---

## 4. Mola Saatleri & Müşteri Rehberi Notları SQL Güncellemesi (Yeni Özellikler)

Rehberdeki müşteri bazlı notları ve mola saatleri engelleyicisini aktifleştirmek için aşağıdaki SQL sorgularını Supabase **SQL Editor** penceresinde çalıştırın:

```sql
-- 1. Müşteri Özel Notları Tablosu
create table if not exists customer_notes (
    phone text primary key,
    admin_note text,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Aktifleştirme
alter table customer_notes enable row level security;

-- Admin dışındaki halka açık kullanıcıların notları görmesini engelleme
drop policy if exists "Allow authenticated admins all actions on customer_notes" on customer_notes;
create policy "Allow authenticated admins all actions on customer_notes"
on customer_notes for all to authenticated using (true) with check (true);

-- 2. Ayarlar tablosuna varsayılan mola saati satırını ekleme (Öğle Molası 12:00 - 13:00)
insert into settings (key, value) values (
    'break_hours',
    '{"start": "12:00", "end": "13:00"}'::jsonb
) on conflict (key) do nothing;
```
