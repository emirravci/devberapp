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
const tabHizmetler = document.getElementById('tab-hizmetler');
const tabMusteriler = document.getElementById('tab-musteriler');
const adminAppointmentsPanel = document.getElementById('admin-appointments-panel');
const adminSchedulerPanel = document.getElementById('admin-scheduler-panel');
const adminServicesPanel = document.getElementById('admin-services-panel');
const adminCustomersPanel = document.getElementById('admin-customers-panel');

// DOM Elements — Scheduler
const newSlotTimeInput = document.getElementById('new-slot-time');
const btnAddSlot = document.getElementById('btn-add-slot');
const slotsEditGrid = document.getElementById('slots-edit-grid');
const slotsCountBadge = document.getElementById('slots-count');
const selectHolidayDay = document.getElementById('select-holiday-day');
const btnSaveHoliday = document.getElementById('btn-save-holiday');
const selectSlotStrategy = document.getElementById('select-slot-strategy');
const btnSaveStrategy = document.getElementById('btn-save-strategy');
const selectBreakStart = document.getElementById('select-break-start');
const selectBreakEnd = document.getElementById('select-break-end');
const btnSaveBreak = document.getElementById('btn-save-break');

// DOM Elements — Manual Appointment
const btnAddManualTrigger = document.getElementById('btn-add-manual-appointment-trigger');
const manualAppointmentModal = document.getElementById('manual-appointment-modal');
const btnCloseManualModal = document.getElementById('btn-close-manual-modal');
const btnCancelManual = document.getElementById('btn-cancel-manual');
const manualAppointmentForm = document.getElementById('manual-appointment-form');
const manualCustomerName = document.getElementById('manual-customer-name');
const manualCustomerPhone = document.getElementById('manual-customer-phone');
const manualServiceSelect = document.getElementById('manual-service-select');
const manualDateInput = document.getElementById('manual-date-input');
const manualTimeInput = document.getElementById('manual-time-input');
const manualNotes = document.getElementById('manual-notes');

// DOM Elements — Customer Notes
const customerNoteModal = document.getElementById('customer-note-modal');
const btnCloseNoteModal = document.getElementById('btn-close-note-modal');
const btnCancelNote = document.getElementById('btn-cancel-note');
const customerNoteForm = document.getElementById('customer-note-form');
const customerNotePhone = document.getElementById('customer-note-phone');
const customerNoteText = document.getElementById('customer-note-text');
const adminCustomersList = document.getElementById('admin-customers-list');

// DOM Elements — Services Manager
const btnAddServiceTrigger = document.getElementById('btn-add-service-trigger');
const adminServicesList = document.getElementById('admin-services-list');
const serviceModal = document.getElementById('service-modal');
const btnCloseServiceModal = document.getElementById('btn-close-service-modal');
const btnCancelService = document.getElementById('btn-cancel-service');
const serviceForm = document.getElementById('service-form');
const serviceEditIdInput = document.getElementById('service-edit-id');
const serviceNameInput = document.getElementById('service-name-input');
const servicePriceInput = document.getElementById('service-price-input');
const serviceDurationInput = document.getElementById('service-duration-input');
const serviceIconInput = document.getElementById('service-icon-input');
const serviceDescInput = document.getElementById('service-desc-input');
const serviceModalTitle = document.getElementById('service-modal-title');

// Module state
let allAppointments = [];
let currentFilter = 'all';
let workingSlots = [];
let weeklyHoliday = 'none';
let servicesListArray = [];
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

    tabRandevular.addEventListener('click', () => {
        tabRandevular.classList.add('active');
        tabCalismaSaatleri.classList.remove('active');
        tabHizmetler.classList.remove('active');
        tabMusteriler.classList.remove('active');
        adminAppointmentsPanel.style.display = 'block';
        adminSchedulerPanel.style.display = 'none';
        adminServicesPanel.style.display = 'none';
        adminCustomersPanel.style.display = 'none';
    });

    tabCalismaSaatleri.addEventListener('click', async () => {
        tabCalismaSaatleri.classList.add('active');
        tabRandevular.classList.remove('active');
        tabHizmetler.classList.remove('active');
        tabMusteriler.classList.remove('active');
        adminSchedulerPanel.style.display = 'block';
        adminAppointmentsPanel.style.display = 'none';
        adminServicesPanel.style.display = 'none';
        adminCustomersPanel.style.display = 'none';
        await loadWorkingHours();
        await loadHolidaySetting();
        await loadStrategySetting();
        await loadBreakHours();
    });

    tabHizmetler.addEventListener('click', async () => {
        tabHizmetler.classList.add('active');
        tabRandevular.classList.remove('active');
        tabCalismaSaatleri.classList.remove('active');
        tabMusteriler.classList.remove('active');
        adminServicesPanel.style.display = 'block';
        adminAppointmentsPanel.style.display = 'none';
        adminSchedulerPanel.style.display = 'none';
        adminCustomersPanel.style.display = 'none';
        await loadAdminServices();
    });

    tabMusteriler.addEventListener('click', async () => {
        tabMusteriler.classList.add('active');
        tabRandevular.classList.remove('active');
        tabCalismaSaatleri.classList.remove('active');
        tabHizmetler.classList.remove('active');
        adminCustomersPanel.style.display = 'block';
        adminAppointmentsPanel.style.display = 'none';
        adminSchedulerPanel.style.display = 'none';
        adminServicesPanel.style.display = 'none';
        await loadCustomersList();
    });

    // Scheduler events
    btnAddSlot.addEventListener('click', handleAddSlot);
    btnSaveHoliday.addEventListener('click', handleSaveHoliday);
    btnSaveStrategy.addEventListener('click', handleSaveStrategy);

    // Services events
    btnAddServiceTrigger.addEventListener('click', openServiceModalForAdd);
    btnCloseServiceModal.addEventListener('click', () => serviceModal.classList.remove('active'));
    btnCancelService.addEventListener('click', () => serviceModal.classList.remove('active'));
    serviceForm.addEventListener('submit', handleServiceFormSubmit);

    // Break hours events
    if (btnSaveBreak) btnSaveBreak.addEventListener('click', handleSaveBreak);

    // Manual appointment events
    if (btnAddManualTrigger) btnAddManualTrigger.addEventListener('click', openManualModal);
    if (btnCloseManualModal) btnCloseManualModal.addEventListener('click', closeManualModal);
    if (btnCancelManual) btnCancelManual.addEventListener('click', closeManualModal);
    if (manualAppointmentForm) manualAppointmentForm.addEventListener('submit', handleManualAppointmentSubmit);

    // Customer note events
    if (btnCloseNoteModal) btnCloseNoteModal.addEventListener('click', closeNoteModal);
    if (btnCancelNote) btnCancelNote.addEventListener('click', closeNoteModal);
    if (customerNoteForm) customerNoteForm.addEventListener('submit', handleCustomerNoteSubmit);
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
    
    // Since we need prices for revenue calculation, and we might not have servicesListArray yet,
    // let's fetch it if empty. But first, just update counts.
    allAppointments.forEach(app => {
        if (app.status === 'pending') pendingCount++;
        if (app.status === 'approved') approvedCount++;
        if (app.appointment_date === today) todayCount++;
    });

    if (statPending) statPending.innerText = pendingCount;
    if (statApproved) statApproved.innerText = approvedCount;
    if (statToday) statToday.innerText = todayCount;
    if (statTotal) statTotal.innerText = allAppointments.length;
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

function formatTime(timeStr) {
    if (!timeStr) return '-';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return timeStr;
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
    const timeStr = formatTime(app.appointment_time);

    let message = '';
    if (messageType === 'approved') {
        message = `Merhaba ${app.customer_name} 👋\n\nRandevunuz onaylanmıştır! ✅\n\n✂️ Hizmet: ${app.service_name}\n📅 Tarih: ${dateStr}\n🕐 Saat: ${timeStr}\n\nRandevu saatinizden 5 dakika önce salonumuzda olmanızı rica ederiz. Görüşmek üzere! 🙏`;
    } else if (messageType === 'rejected') {
        message = `Merhaba ${app.customer_name} 👋\n\nMaalesef ${dateStr} tarihli saat ${timeStr} için randevu talebinizi alamıyoruz. 😔\n\nFarklı bir saat veya tarih için yeniden randevu alabilirsiniz. İyi günler dileriz!`;
    } else {
        message = `Merhaba ${app.customer_name} 👋\n\nRandevunuz hakkında bilgi vermek için ulaşıyoruz.\n\n✂️ Hizmet: ${app.service_name}\n📅 Tarih: ${dateStr}\n🕐 Saat: ${timeStr}`;
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
                    <div class="app-detail-item"><i class="fa-solid fa-clock"></i> <span>${formatTime(app.appointment_time)}</span></div>
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

// =============================================
// SERVICES MANAGEMENT (CRUD)
// =============================================
async function loadAdminServices() {
    showLoader();
    try {
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .order('price', { ascending: true });

        if (error) throw error;

        servicesListArray = data || [];
        renderAdminServices();
    } catch (err) {
        console.error("Hizmetler yüklenemedi:", err);
        showToast("Hizmetler yüklenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

function renderAdminServices() {
    adminServicesList.innerHTML = '';
    if (servicesListArray.length === 0) {
        adminServicesList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-scissors"></i>
                <p>Kayıtlı hizmet bulunmamaktadır. Yeni hizmet ekleyerek başlayabilirsiniz.</p>
            </div>
        `;
        return;
    }

    servicesListArray.forEach(service => {
        const card = document.createElement('div');
        card.className = 'appointment-admin-card';
        
        const iconClass = service.icon || 'fa-scissors';

        card.innerHTML = `
            <div class="appointment-info">
                <div class="app-customer-header">
                    <span class="app-customer-name" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700;">
                        <i class="fa-solid ${iconClass}" style="color: var(--accent-gold);"></i> ${service.name}
                    </span>
                </div>
                <div class="app-details-row">
                    <div class="app-detail-item"><i class="fa-solid fa-tags"></i> <span>Fiyat: <strong>${service.price} ₺</strong></span></div>
                    <div class="app-detail-item"><i class="fa-regular fa-clock"></i> <span>Süre: <strong>${service.duration} dk</strong></span></div>
                </div>
                ${service.description ? `<div class="app-notes" style="margin-top: 0.25rem;">${service.description}</div>` : ''}
            </div>
            <div class="app-actions">
                <button class="btn-secondary btn-edit-service" style="color: var(--accent-gold); border-color: var(--accent-gold);" data-id="${service.id}"><i class="fa-solid fa-pen-to-square"></i> Düzenle</button>
                <button class="btn-danger btn-delete-service" data-id="${service.id}"><i class="fa-solid fa-trash"></i> Sil</button>
            </div>
        `;

        card.querySelector('.btn-edit-service').addEventListener('click', () => openServiceModalForEdit(service));
        card.querySelector('.btn-delete-service').addEventListener('click', () => deleteService(service.id));

        adminServicesList.appendChild(card);
    });
}

function openServiceModalForAdd() {
    serviceModalTitle.innerHTML = '<i class="fa-solid fa-plus"></i> Yeni Hizmet Ekle';
    serviceForm.reset();
    serviceEditIdInput.value = '';
    serviceModal.classList.add('active');
}

function openServiceModalForEdit(service) {
    serviceModalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Hizmeti Düzenle';
    serviceEditIdInput.value = service.id;
    serviceNameInput.value = service.name;
    servicePriceInput.value = service.price;
    serviceDurationInput.value = service.duration;
    serviceIconInput.value = service.icon || 'fa-scissors';
    serviceDescInput.value = service.description || '';
    serviceModal.classList.add('active');
}

async function handleServiceFormSubmit(e) {
    e.preventDefault();
    const serviceId = serviceEditIdInput.value;
    const name = serviceNameInput.value.trim();
    const price = parseFloat(servicePriceInput.value);
    const duration = parseInt(serviceDurationInput.value, 10);
    const icon = serviceIconInput.value;
    const description = serviceDescInput.value.trim();

    if (!name || isNaN(price) || isNaN(duration)) {
        showToast("Lütfen tüm zorunlu alanları doldurun.", "error");
        return;
    }

    showLoader();
    try {
        const payload = { 
            name, 
            price, 
            duration, 
            icon, 
            description 
        };

        if (serviceId) {
            // Update
            const { error } = await supabase
                .from('services')
                .update(payload)
                .eq('id', serviceId);

            if (error) throw error;
            showToast("Hizmet başarıyla güncellendi.", "success");
        } else {
            // Insert
            const { error } = await supabase
                .from('services')
                .insert(payload);

            if (error) throw error;
            showToast("Yeni hizmet başarıyla eklendi.", "success");
        }

        serviceModal.classList.remove('active');
        await loadAdminServices();
    } catch (err) {
        console.error("Hizmet kaydedilemedi:", err);
        showToast("Hizmet kaydedilirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

async function deleteService(id) {
    if (!confirm("Bu hizmeti kalıcı olarak silmek istediğinize emin misiniz? Bu hizmeti seçmiş aktif randevuları etkilemeyecektir.")) return;

    showLoader();
    try {
        const { error } = await supabase
            .from('services')
            .delete()
            .eq('id', id);

        if (error) throw error;
        showToast("Hizmet silindi.", "success");
        await loadAdminServices();
    } catch (err) {
        console.error("Hizmet silinemedi:", err);
        showToast("Hizmet silinirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

// =============================================
// SLOT STRATEGY SETTING
// =============================================
async function loadStrategySetting() {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'slot_strategy')
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        const currentStrategy = data ? data.value : 'half_hourly';
        if (selectSlotStrategy) {
            selectSlotStrategy.value = currentStrategy;
        }
    } catch (err) {
        console.error("Strateji ayarı yüklenemedi:", err);
    }
}

async function handleSaveStrategy() {
    const strategy = selectSlotStrategy.value;
    if (!strategy) return;

    showLoader();
    try {
        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'slot_strategy', value: strategy }, { onConflict: 'key' });

        if (error) throw error;
        showToast("Randevu saat dağılım modu kaydedildi!", "success");
    } catch (err) {
        console.error("Strateji kaydedilemedi:", err);
        showToast("Strateji ayarı kaydedilirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

// =============================================
// BREAK HOURS SETTING
// =============================================
async function loadBreakHours() {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'break_hours')
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (data && data.value && typeof data.value === 'object') {
            if (selectBreakStart) selectBreakStart.value = data.value.start || '';
            if (selectBreakEnd) selectBreakEnd.value = data.value.end || '';
        }
    } catch (err) {
        console.error("Mola saatleri yüklenemedi:", err);
    }
}

async function handleSaveBreak() {
    const start = selectBreakStart.value;
    const end = selectBreakEnd.value;

    showLoader();
    try {
        const payload = { start, end };
        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'break_hours', value: payload }, { onConflict: 'key' });

        if (error) throw error;
        showToast("Mola saatleri başarıyla kaydedildi!", "success");
    } catch (err) {
        console.error("Mola saatleri kaydedilemedi:", err);
        showToast("Mola saatleri kaydedilirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

// =============================================
// CUSTOMERS & NOTES
// =============================================
async function loadCustomersList() {
    showLoader();
    try {
        // Group appointments by customer phone to get unique customers
        const uniqueCustomers = {};
        allAppointments.forEach(app => {
            const phone = app.customer_phone;
            if (!uniqueCustomers[phone]) {
                uniqueCustomers[phone] = {
                    name: app.customer_name,
                    phone: phone,
                    totalAppointments: 0,
                    totalRevenue: 0,
                    lastVisit: null
                };
            }
            uniqueCustomers[phone].totalAppointments++;
            if (app.status === 'approved') {
                const service = servicesListArray.find(s => s.name === app.service_name);
                if (service) {
                    uniqueCustomers[phone].totalRevenue += service.price;
                }
            }
            if (!uniqueCustomers[phone].lastVisit || new Date(app.appointment_date) > new Date(uniqueCustomers[phone].lastVisit)) {
                uniqueCustomers[phone].lastVisit = app.appointment_date;
            }
        });

        const customersArray = Object.values(uniqueCustomers);
        customersArray.sort((a, b) => new Date(b.lastVisit) - new Date(a.lastVisit));

        // Fetch notes
        const { data: notesData, error } = await supabase.from('customer_notes').select('*');
        if (error) throw error;

        renderCustomersList(customersArray, notesData || []);
    } catch (err) {
        console.error("Müşteriler yüklenemedi:", err);
        showToast("Müşteri listesi yüklenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

function renderCustomersList(customers, notes) {
    if (!adminCustomersList) return;
    adminCustomersList.innerHTML = '';

    if (customers.length === 0) {
        adminCustomersList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-users-slash"></i>
                <p>Kayıtlı müşteri bulunamadı.</p>
            </div>
        `;
        return;
    }

    customers.forEach(customer => {
        const noteRow = notes.find(n => n.phone === customer.phone);
        const noteText = noteRow ? noteRow.note : 'Not eklenmemiş.';
        
        const card = document.createElement('div');
        card.className = 'appointment-admin-card';

        card.innerHTML = `
            <div class="appointment-info">
                <div class="app-customer-header">
                    <span class="app-customer-name"><i class="fa-solid fa-user"></i> ${customer.name}</span>
                </div>
                <div class="app-details-row">
                    <div class="app-detail-item"><i class="fa-solid fa-phone"></i> <span><a href="tel:${customer.phone}" style="color: inherit; text-decoration: none;">${customer.phone}</a></span></div>
                    <div class="app-detail-item"><i class="fa-solid fa-calendar-check"></i> <span>Ziyaret: <strong>${customer.totalAppointments}</strong></span></div>
                    <div class="app-detail-item"><i class="fa-solid fa-wallet"></i> <span>Harcama: <strong>${customer.totalRevenue} ₺</strong></span></div>
                </div>
                <div class="app-notes" style="margin-top: 0.5rem; background: var(--bg-card); border-left-color: var(--accent-gold);">
                    <strong>Müşteri Notu:</strong> <span class="note-content">${noteText}</span>
                </div>
            </div>
            <div class="app-actions">
                <button class="btn-secondary btn-edit-note" data-phone="${customer.phone}" data-name="${customer.name}" data-note="${noteRow ? noteRow.note : ''}" style="color: var(--accent-gold); border-color: var(--accent-gold);">
                    <i class="fa-solid fa-pen"></i> Not Düzenle
                </button>
                <a href="${buildWhatsAppUrl({customer_phone: customer.phone, customer_name: customer.name}, 'contact')}" target="_blank" class="btn-whatsapp" title="WhatsApp'tan Mesaj Gönder">
                    <i class="fa-brands fa-whatsapp"></i>
                </a>
            </div>
        `;

        card.querySelector('.btn-edit-note').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            openNoteModal(btn.dataset.phone, btn.dataset.note);
        });

        adminCustomersList.appendChild(card);
    });
}

function openNoteModal(phone, existingNote) {
    if (!customerNoteModal) return;
    customerNotePhone.value = phone;
    customerNoteText.value = existingNote || '';
    customerNoteModal.classList.add('active');
}

function closeNoteModal() {
    if (customerNoteModal) customerNoteModal.classList.remove('active');
}

async function handleCustomerNoteSubmit(e) {
    e.preventDefault();
    const phone = customerNotePhone.value.trim();
    const note = customerNoteText.value.trim();

    if (!phone) return;

    showLoader();
    try {
        const { error } = await supabase
            .from('customer_notes')
            .upsert({ phone: phone, note: note }, { onConflict: 'phone' });

        if (error) throw error;
        
        showToast("Not başarıyla kaydedildi.", "success");
        closeNoteModal();
        await loadCustomersList();
    } catch (err) {
        console.error("Not kaydedilemedi:", err);
        showToast("Not kaydedilirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

// =============================================
// MANUAL APPOINTMENTS
// =============================================
async function openManualModal() {
    if (!manualAppointmentModal) return;
    manualAppointmentForm.reset();
    
    // Populate services dropdown
    if (manualServiceSelect && servicesListArray.length === 0) {
        const { data } = await supabase.from('services').select('*').order('price', { ascending: true });
        servicesListArray = data || [];
    }
    
    if (manualServiceSelect) {
        manualServiceSelect.innerHTML = '<option value="" disabled selected>Hizmet Seçiniz...</option>';
        servicesListArray.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = s.name;
            manualServiceSelect.appendChild(opt);
        });
    }

    // Set today as default date
    if (manualDateInput) {
        manualDateInput.value = new Date().toLocaleDateString('en-CA');
    }

    manualAppointmentModal.classList.add('active');
}

function closeManualModal() {
    if (manualAppointmentModal) manualAppointmentModal.classList.remove('active');
}

async function handleManualAppointmentSubmit(e) {
    e.preventDefault();
    
    const customer_name = manualCustomerName.value.trim();
    const customer_phone = manualCustomerPhone.value.trim();
    const service_name = manualServiceSelect.value;
    const appointment_date = manualDateInput.value;
    const appointment_time = manualTimeInput.value;
    const notes = manualNotes.value.trim();

    if (!customer_name || !customer_phone || !service_name || !appointment_date || !appointment_time) {
        showToast("Lütfen tüm zorunlu alanları doldurun.", "error");
        return;
    }

    showLoader();
    try {
        const { error } = await supabase.from('appointments').insert({
            customer_name,
            customer_phone,
            service_name,
            appointment_date,
            appointment_time,
            notes,
            status: 'approved' // Auto-approve manual appointments
        });

        if (error) throw error;
        
        showToast("Randevu başarıyla eklendi.", "success");
        closeManualModal();
        await loadAdminDashboard();
    } catch (err) {
        console.error("Manuel randevu eklenemedi:", err);
        showToast("Randevu eklenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

