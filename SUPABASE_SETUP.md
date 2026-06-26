# Berber Randevu Sistemi - Supabase Kurulum Adımları

Bu belgede, **Berber Randevu Sistemi** için Supabase üzerinde yapılması gereken veritabanı kurulumları ve RLS (Row Level Security) güvenlik ayarları yer almaktadır.

---

## 1. Supabase Projesi Oluşturma

1. [Supabase](https://supabase.com) adresine gidin ve giriş yapın.
2. **New Project** butonuna tıklayarak yeni bir proje oluşturun.
3. Proje adını girin (Örn: `berber-randevu`).
4. Güçlü bir veritabanı şifresi belirleyin ve not edin.
5. Bölgeyi Türkiye'ye en yakın konum (Frankfurt gibi) seçip projenin kurulmasını bekleyin (yaklaşık 1-2 dakika).

---

## 2. Admin Hesabı Oluşturma

Uygulamanın yönetim paneline erişmek için bir admin hesabı oluşturmanız gerekir:
1. Supabase panelinde sol menüden **Authentication** sekmesine tıklayın.
2. **Users** sayfasında **Add user > Create user** butonuna tıklayın.
3. Admin olarak giriş yapacağınız e-posta adresini ve şifresini yazıp kaydedin.
4. Adminin e-posta doğrulaması yapmadan direkt giriş yapabilmesi için: **Authentication > Providers > Email** ayarlarına girip **Confirm email** seçeneğini devre dışı bırakın (disabled) ve kaydedin.

---

## 3. SQL Tablolarını ve Politikalarını Kurma

Sol menüden **SQL Editor** seçeneğine tıklayın. **New Query** butonuna basarak yeni bir sorgu penceresi açın, aşağıdaki SQL betiğini kopyalayıp yapıştırın ve **Run** butonuna tıklayın:

```sql
-- 1. Appointments Table (Randevular)
create table appointments (
    id uuid primary key default gen_random_uuid(),
    customer_name text not null,
    customer_phone text not null,
    service_name text not null,
    appointment_date date not null,
    appointment_time text not null, -- Örn: "10:00", "11:30"
    status text default 'pending' not null, -- 'pending', 'approved', 'rejected'
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Hızlı arama ve filtreleme için indeksler
create index idx_appointments_date on appointments(appointment_date);
create index idx_appointments_status on appointments(status);

-- 2. Settings Table (Admin Ayarları - Çalışma Saatleri)
create table settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Row Level Security (RLS) Aktifleştirme
alter table appointments enable row level security;
alter table settings enable row level security;

-- 4. RLS Politikaları (Security Policies)
-- Müşteriler giriş yapmadan randevu oluşturabilir
create policy "Allow public inserts on appointments"
on appointments for insert to public with check (true);

-- Sadece giriş yapmış admin randevuları listeleyebilir ve yönetebilir
create policy "Allow authenticated admins all actions on appointments"
on appointments for all to authenticated using (true) with check (true);

-- Müşteriler aktif çalışma saatlerini okuyabilir (randevu formu için)
create policy "Allow public selects on settings"
on settings for select to public using (true);

-- Sadece giriş yapmış admin çalışma saatlerini düzenleyebilir
create policy "Allow authenticated admins all actions on settings"
on settings for all to authenticated using (true) with check (true);

-- 5. Varsayılan Çalışma Saatlerinin Eklenmesi (İlk Kurulum)
insert into settings (key, value) values (
    'working_slots', 
    '["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"]'::jsonb
) on conflict (key) do nothing;
```

---

## 4. API Bilgilerini Alıp Uygulamaya Ekleme

Uygulamanın Supabase ile konuşabilmesi için API anahtarlarını almanız gerekir:
1. Supabase panelinde sol alt köşedeki **Project Settings** (Dişli simgesi) ikonuna tıklayın.
2. **API** menüsüne gelin.
3. **Project API keys** bölümünde yer alan:
   - **Project URL** (örnek: `https://xxxx.supabase.co`)
   - **API Key (anon/public)** (örnek: `eyJhbGciOiJIUzI1NiIsIn...`)
4. Bu bilgileri projedeki `js/supabase.js` dosyası içerisindeki ilgili alanlara yapıştırın:
   ```javascript
   const SUPABASE_URL = "BURAYA_PROJECT_URL_YAZIN";
   const SUPABASE_ANON_KEY = "BURAYA_ANON_KEY_YAZIN";
   ```
