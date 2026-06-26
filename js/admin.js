import { supabase, showLoader, hideLoader, showToast } from './supabase-core.js';

// =============================================
// VIEW SWITCHING (Login ↔ Dashboard)
// =============================================
const adminLoginView = document.getElementById('admin-login-view');
const adminDashboardView = document.getElementById('admin-dashboard-view');

function showAdminView(viewId) {
    [adminLoginView, adminDashboardView].forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`${viewId}-view`);
    if (target) target.classList.add('active');
}

// =============================================
// DOM ELEMENTS — Auth
// =============================================
const adminLoginForm = document.getElementById('admin-login-form');
const adminEmailInput = document.getElementById('admin-email');
const adminPasswordInput = document.getElementById('admin-password');
const btnTogglePassword = document.getElementById('btn-toggle-password');
const passwordEyeIcon = document.getElementById('password-eye-icon');
const btnAdminLogout = document.getElementById('btn-admin-logout');

// DOM Elements — Stats
const statPending = document.getElementById('stat-pending');
const statApproved = document.getElementById('stat-approved');
const statToday = document.getElementById('stat-today');
const statTotal = document.getElementById('stat-total');

// DOM Elements — Filters
const filterAll = document.getElementById('filter-all');
const filterPending = document.getElementById('filter-pending');
const filterApproved = document.getElementById('filter-approved');
const filterRejected = document.getElementById('filter-rejected');
const appointmentsList = document.getElementById('admin-appointments-list');

// DOM Elements — Tabs
const tabRandevular = document.getElementById('tab-randevular');
const tabCalismaSaatleri = document.getElementById('tab-calisma-saatleri');
const adminAppointmentsPanel = document.getElementById('admin-appointments-panel');
const adminSchedulerPanel = document.getElementById('admin-scheduler-panel');

// DOM Elements — Scheduler
const newSlotTimeInput = document.getElementById('new-slot-time');
const btnAddSlot = document.getElementById('btn-add-slot');
const slotsEditGrid = document.getElementById('slots-edit-grid');
const slotsCountBadge = document.getElementById('slots-count');
const selectHolidayDay = document.getElementById('select-holiday-day');
const btnSaveHoliday = document.getElementById('btn-save-holiday');

// Module state
let allAppointments = [];
let currentFilter = 'all';
let workingSlots = [];
let weeklyHoliday = 'none';
let realtimeChannel = null;

// =============================================
// INITIALIZATION — Check session on page load
// =============================================
async function initAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        showAdminView('admin-dashboard');
        document.getElementById('admin-username').innerText = session.user.email;
        await loadAdminDashboard();
        initRealtimeSubscription();
    } else {
        showAdminView('admin-login');
    }
}

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
    const adminUsername = document.getElementById('admin-username');
    if (session && session.user) {
        if (adminUsername) adminUsername.innerText = session.user.email;
        if (adminLoginView.classList.contains('active')) {
            showAdminView('admin-dashboard');
            loadAdminDashboard();
            initRealtimeSubscription();
        }
    } else {
        if (adminUsername) adminUsername.innerText = '';
        showAdminView('admin-login');
        // Cleanup realtime
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
    }
});

// =============================================
// EVENT LISTENERS
// =============================================
function initEvents() {
    // Login form
    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = adminEmailInput.value.trim();
        const password = adminPasswordInput.value.trim();

        if (!email || !password) {
            showToast("Lütfen e-posta ve şifrenizi girin.", "error");
            return;
        }

        showLoader();
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showToast("Giriş başarılı! Hoş geldiniz.", "success");
        } catch (err) {
            console.error("Giriş hatası:", err);
            showToast(err.message || "Giriş yapılamadı. Bilgilerinizi kontrol edin.", "error");
        } finally {
            hideLoader();
        }
    });

    // Toggle password visibility
    btnTogglePassword.addEventListener('click', () => {
        const isPassword = adminPasswordInput.type === 'password';
        adminPasswordInput.type = isPassword ? 'text' : 'password';
        passwordEyeIcon.className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });

    // Logout
    btnAdminLogout.addEventListener('click', async () => {
        showLoader();
        try {
            if (realtimeChannel) {
                supabase.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            showToast("Çıkış yapıldı.", "info");
        } catch (err) {
            console.error("Çıkış hatası:", err);
            showToast("Çıkış yapılırken bir hata oluştu.", "error");
        } finally {
            hideLoader();
        }
    });

    // Tab filters
    const filters = [
        { btn: filterAll, status: 'all' },
        { btn: filterPending, status: 'pending' },
        { btn: filterApproved, status: 'approved' },
        { btn: filterRejected, status: 'rejected' }
    ];

    filters.forEach(item => {
        item.btn.addEventListener('click', () => {
            currentFilter = item.status;
            updateFilterTabStyles();
            renderFilteredAppointments();
        });
    });

    // Dashboard tabs
    tabRandevular.addEventListener('click', () => {
        tabRandevular.classList.add('active');
        tabCalismaSaatleri.classList.remove('active');
        adminAppointmentsPanel.style.display = 'block';
        adminSchedulerPanel.style.display = 'none';
    });

    tabCalismaSaatleri.addEventListener('click', async () => {
        tabCalismaSaatleri.classList.add('active');
        tabRandevular.classList.remove('active');
        adminSchedulerPanel.style.display = 'block';
        adminAppointmentsPanel.style.display = 'none';
        await loadWorkingHours();
        await loadHolidaySetting();
    });

    // Scheduler events
    btnAddSlot.addEventListener('click', handleAddSlot);
    btnSaveHoliday.addEventListener('click', handleSaveHoliday);
}

initEvents();
initAdmin();

// =============================================
// FILTER TAB STYLES
// =============================================
function updateFilterTabStyles() {
    [filterAll, filterPending, filterApproved, filterRejected].forEach(btn => btn.classList.remove('active'));
    if (currentFilter === 'all') filterAll.classList.add('active');
    if (currentFilter === 'pending') filterPending.classList.add('active');
    if (currentFilter === 'approved') filterApproved.classList.add('active');
    if (currentFilter === 'rejected') filterRejected.classList.add('active');
}

// =============================================
// DASHBOARD DATA
// =============================================
async function loadAdminDashboard() {
    showLoader();
    try {
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true });

        if (error) throw error;

        allAppointments = data || [];
        calculateStats();
        renderFilteredAppointments();
    } catch (err) {
        console.error("Yönetim paneli yükleme hatası:", err);
        showToast("Veriler yüklenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

function calculateStats() {
    const today = new Date().toLocaleDateString('en-CA');
    let pendingCount = 0, approvedCount = 0, todayCount = 0;

    allAppointments.forEach(app => {
        if (app.status === 'pending') pendingCount++;
        if (app.status === 'approved') approvedCount++;
        if (app.appointment_date === today) todayCount++;
    });

    statPending.innerText = pendingCount;
    statApproved.innerText = approvedCount;
    statToday.innerText = todayCount;
    statTotal.innerText = allAppointments.length;
}

// =============================================
// DATE FORMATTING
// =============================================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTurkish(dateString) {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// =============================================
// WHATSAPP INTEGRATION
// =============================================
function toWhatsAppNumber(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) return '90' + digits.substring(1);
    if (digits.length === 10) return '90' + digits;
    return digits;
}

function buildWhatsAppUrl(app, messageType) {
    const waNumber = toWhatsAppNumber(app.customer_phone);
    const dateStr = formatDateTurkish(app.appointment_date);

    let message = '';
    if (messageType === 'approved') {
        message = `Merhaba ${app.customer_name} 👋\n\nRandevunuz onaylanmıştır! ✅\n\n✂️ Hizmet: ${app.service_name}\n📅 Tarih: ${dateStr}\n🕐 Saat: ${app.appointment_time}\n\nRandevu saatinizden 5 dakika önce salonumuzda olmanızı rica ederiz. Görüşmek üzere! 🙏`;
    } else if (messageType === 'rejected') {
        message = `Merhaba ${app.customer_name} 👋\n\nMaalesef ${dateStr} tarihli saat ${app.appointment_time} için randevu talebinizi alamıyoruz. 😔\n\nFarklı bir saat veya tarih için yeniden randevu alabilirsiniz. İyi günler dileriz!`;
    } else {
        message = `Merhaba ${app.customer_name} 👋\n\nRandevunuz hakkında bilgi vermek için ulaşıyoruz.\n\n✂️ Hizmet: ${app.service_name}\n📅 Tarih: ${dateStr}\n🕐 Saat: ${app.appointment_time}`;
    }

    return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
}

// =============================================
// APPOINTMENT RENDERING
// =============================================
function renderFilteredAppointments() {
    appointmentsList.innerHTML = '';

    const filtered = allAppointments.filter(app => {
        if (currentFilter === 'all') return true;
        return app.status === currentFilter;
    });

    if (filtered.length === 0) {
        appointmentsList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-calendar-minus"></i>
                <p>Gösterilecek randevu kaydı bulunmamaktadır.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(app => {
        const card = document.createElement('div');
        card.className = 'appointment-admin-card';

        let statusText = 'Bekliyor';
        if (app.status === 'approved') statusText = 'Onaylandı';
        if (app.status === 'rejected') statusText = 'Reddedildi';

        const notesHtml = app.notes ? `<div class="app-notes"><strong>Not:</strong> ${app.notes}</div>` : '';
        const waContactUrl = buildWhatsAppUrl(app, 'contact');

        card.innerHTML = `
            <div class="appointment-info">
                <div class="app-customer-header">
                    <span class="app-customer-name">${app.customer_name}</span>
                    <span class="status-badge ${app.status}">${statusText}</span>
                </div>
                <div class="app-details-row">
                    <div class="app-detail-item"><i class="fa-solid fa-scissors"></i> <span>${app.service_name}</span></div>
                    <div class="app-detail-item"><i class="fa-solid fa-calendar-day"></i> <span>${formatDate(app.appointment_date)}</span></div>
                    <div class="app-detail-item"><i class="fa-solid fa-clock"></i> <span>${app.appointment_time}</span></div>
                    <div class="app-detail-item"><i class="fa-solid fa-phone"></i> <span><a href="tel:${app.customer_phone}" style="color: inherit; text-decoration: none;">${app.customer_phone}</a></span></div>
                </div>
                ${notesHtml}
            </div>
            <div class="app-actions">
                ${app.status !== 'approved' ? `<button class="btn-secondary btn-approve" style="color: var(--color-success); border-color: var(--color-success);" data-id="${app.id}"><i class="fa-solid fa-check"></i> Onayla</button>` : ''}
                ${app.status !== 'rejected' ? `<button class="btn-danger btn-reject" data-id="${app.id}"><i class="fa-solid fa-ban"></i> Reddet</button>` : ''}
                <a href="${waContactUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp" title="WhatsApp'tan Mesaj Gönder">
                    <i class="fa-brands fa-whatsapp"></i>
                </a>
                <button class="btn-secondary btn-delete" style="color: var(--color-error); padding: 0.85rem;" data-id="${app.id}" title="Kayıt Sil"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        const btnApprove = card.querySelector('.btn-approve');
        if (btnApprove) btnApprove.addEventListener('click', () => updateAppointmentStatus(app.id, 'approved'));

        const btnReject = card.querySelector('.btn-reject');
        if (btnReject) btnReject.addEventListener('click', () => updateAppointmentStatus(app.id, 'rejected'));

        card.querySelector('.btn-delete').addEventListener('click', () => deleteAppointment(app.id));

        appointmentsList.appendChild(card);
    });
}

// =============================================
// APPOINTMENT ACTIONS
// =============================================
async function updateAppointmentStatus(id, newStatus) {
    showLoader();
    try {
        const { error } = await supabase
            .from('appointments')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) throw error;

        await loadAdminDashboard();

        const updatedApp = allAppointments.find(a => a.id === id);
        if (updatedApp) {
            const waUrl = buildWhatsAppUrl(updatedApp, newStatus);
            const toastMsg = newStatus === 'approved' ? "Randevu onaylandı ✅" : "Randevu reddedildi.";
            showToast(toastMsg, "success");
            setTimeout(() => window.open(waUrl, '_blank', 'noopener,noreferrer'), 600);
        } else {
            showToast(newStatus === 'approved' ? "Randevu onaylandı." : "Randevu reddedildi.", "success");
        }
    } catch (err) {
        console.error("Randevu güncellenemedi:", err);
        showToast("Durum güncellenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

async function deleteAppointment(id) {
    if (!confirm("Bu randevuyu kalıcı olarak silmek istediğinize emin misiniz?")) return;

    showLoader();
    try {
        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', id);

        if (error) throw error;
        showToast("Randevu silindi.", "success");
        await loadAdminDashboard();
    } catch (err) {
        console.error("Randevu silinemedi:", err);
        showToast("Silme işlemi sırasında hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

// =============================================
// WORKING HOURS (SCHEDULER)
// =============================================
async function loadWorkingHours() {
    showLoader();
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'working_slots')
            .maybeSingle();

        if (error) throw error;
        workingSlots = (data && data.value) ? data.value : [];
        renderWorkingSlots();
    } catch (err) {
        console.error("Saat dilimleri yüklenemedi:", err);
        showToast("Çalışma saatleri yüklenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

function renderWorkingSlots() {
    slotsEditGrid.innerHTML = '';
    slotsCountBadge.innerText = `${workingSlots.length} saat`;

    if (workingSlots.length === 0) {
        slotsEditGrid.innerHTML = `
            <div style="grid-column: 1 / -1; color: var(--text-secondary); font-size: 0.95rem; font-style: italic;">
                Kayıtlı saat dilimi bulunmamaktadır. Lütfen saat ekleyin.
            </div>
        `;
        return;
    }

    workingSlots.forEach(time => {
        const badge = document.createElement('div');
        badge.className = 'slot-edit-badge';
        badge.innerHTML = `
            <span>${time}</span>
            <button class="btn-remove-slot" data-time="${time}" title="Kaldır"><i class="fa-solid fa-xmark"></i></button>
        `;
        badge.querySelector('.btn-remove-slot').addEventListener('click', () => removeWorkingSlot(time));
        slotsEditGrid.appendChild(badge);
    });
}

async function handleAddSlot() {
    const newTime = newSlotTimeInput.value;
    if (!newTime) {
        showToast("Lütfen geçerli bir saat seçin.", "error");
        return;
    }
    if (workingSlots.includes(newTime)) {
        showToast("Bu saat dilimi zaten mevcut.", "error");
        return;
    }
    workingSlots.push(newTime);
    workingSlots.sort();
    await saveWorkingSlots();
    newSlotTimeInput.value = '';
}

async function removeWorkingSlot(timeToRemove) {
    if (!confirm(`${timeToRemove} saat dilimini kaldırmak istediğinize emin misiniz?`)) return;
    workingSlots = workingSlots.filter(t => t !== timeToRemove);
    await saveWorkingSlots();
}

async function saveWorkingSlots() {
    showLoader();
    try {
        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'working_slots', value: workingSlots, updated_at: new Date().toISOString() });

        if (error) throw error;
        showToast("Çalışma saatleri güncellendi.", "success");
        renderWorkingSlots();
    } catch (err) {
        console.error("Saatler veritabanına kaydedilemedi:", err);
        showToast("Değişiklikler kaydedilirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

// =============================================
// HOLIDAY SETTINGS
// =============================================
async function loadHolidaySetting() {
    showLoader();
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'weekly_holiday')
            .maybeSingle();

        if (error) throw error;
        weeklyHoliday = (data && data.value) ? data.value : 'none';
        selectHolidayDay.value = weeklyHoliday;
    } catch (err) {
        console.error("Tatil günü yüklenemedi:", err);
        showToast("Tatil günü yüklenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

async function handleSaveHoliday() {
    const selectedHoliday = selectHolidayDay.value;
    showLoader();
    try {
        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'weekly_holiday', value: selectedHoliday, updated_at: new Date().toISOString() });

        if (error) throw error;
        weeklyHoliday = selectedHoliday;
        showToast("Tatil günü başarıyla güncellendi.", "success");
    } catch (err) {
        console.error("Tatil günü kaydedilemedi:", err);
        showToast("Tatil günü kaydedilirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

// =============================================
// REALTIME SUBSCRIPTION
// =============================================
function initRealtimeSubscription() {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);

    realtimeChannel = supabase
        .channel('admin-appointments-changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'appointments'
        }, async () => {
            await loadAdminDashboardSilent();
        })
        .subscribe();
}

async function loadAdminDashboardSilent() {
    try {
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true });

        if (error) throw error;
        allAppointments = data || [];
        calculateStats();
        renderFilteredAppointments();
    } catch (err) {
        console.error("Realtime veri yenileme hatası:", err);
    }
}
