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
const selectWorkStart = document.getElementById('select-work-start');
const selectWorkEnd = document.getElementById('select-work-end');
const btnSaveWorkHours = document.getElementById('btn-save-work-hours');
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

// DOM Elements — Salon Profile
const tabProfil = document.getElementById('tab-profil');
const adminProfilePanel = document.getElementById('admin-profile-panel');
const salonShareUrlInput = document.getElementById('salon-share-url');
const btnCopyShareUrl = document.getElementById('btn-copy-share-url');
const profileForm = document.getElementById('profile-form');
const profileSalonName = document.getElementById('profile-salon-name');
const profileOwnerName = document.getElementById('profile-owner-name');
const profilePhone = document.getElementById('profile-phone');
const profileAddress = document.getElementById('profile-address');
const profileDesc = document.getElementById('profile-desc');
const profileInstagram = document.getElementById('profile-instagram');
const profileLogoUrl = document.getElementById('profile-logo-url');
const profileCoverUrl = document.getElementById('profile-cover-url');
const profileSlug = document.getElementById('profile-slug');
const slugStatusIcon = document.getElementById('slug-status-icon');


// Module state
let allAppointments = [];
let currentFilter = 'all';
let workingHours = null;
let weeklyHoliday = 'none';
let servicesListArray = [];
let realtimeChannel = null;
let sessionUserId = null;

// =============================================
// INITIALIZATION — Check session on page load
// =============================================
async function initAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        sessionUserId = session.user.id;
        showAdminView('admin-dashboard');
        document.getElementById('admin-username').innerText = session.user.email;
        await loadAdminDashboard();
        initRealtimeSubscription();
    } else {
        window.location.href = 'auth.html';
    }
}

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
    const adminUsername = document.getElementById('admin-username');
    if (session && session.user) {
        sessionUserId = session.user.id;
        if (adminUsername) adminUsername.innerText = session.user.email;
    } else {
        sessionUserId = null;
        if (adminUsername) adminUsername.innerText = '';
        window.location.href = 'auth.html';
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
        tabProfil.classList.remove('active');
        adminAppointmentsPanel.style.display = 'block';
        adminSchedulerPanel.style.display = 'none';
        adminServicesPanel.style.display = 'none';
        adminCustomersPanel.style.display = 'none';
        adminProfilePanel.style.display = 'none';
    });

    tabCalismaSaatleri.addEventListener('click', async () => {
        tabCalismaSaatleri.classList.add('active');
        tabRandevular.classList.remove('active');
        tabHizmetler.classList.remove('active');
        tabMusteriler.classList.remove('active');
        tabProfil.classList.remove('active');
        adminSchedulerPanel.style.display = 'block';
        adminAppointmentsPanel.style.display = 'none';
        adminServicesPanel.style.display = 'none';
        adminCustomersPanel.style.display = 'none';
        adminProfilePanel.style.display = 'none';
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
        tabProfil.classList.remove('active');
        adminServicesPanel.style.display = 'block';
        adminAppointmentsPanel.style.display = 'none';
        adminSchedulerPanel.style.display = 'none';
        adminCustomersPanel.style.display = 'none';
        adminProfilePanel.style.display = 'none';
        await loadAdminServices();
    });

    tabMusteriler.addEventListener('click', async () => {
        tabMusteriler.classList.add('active');
        tabRandevular.classList.remove('active');
        tabCalismaSaatleri.classList.remove('active');
        tabHizmetler.classList.remove('active');
        tabProfil.classList.remove('active');
        adminCustomersPanel.style.display = 'block';
        adminAppointmentsPanel.style.display = 'none';
        adminSchedulerPanel.style.display = 'none';
        adminServicesPanel.style.display = 'none';
        adminProfilePanel.style.display = 'none';
        await loadCustomersList();
    });

    tabProfil.addEventListener('click', async () => {
        tabProfil.classList.add('active');
        tabRandevular.classList.remove('active');
        tabCalismaSaatleri.classList.remove('active');
        tabHizmetler.classList.remove('active');
        tabMusteriler.classList.remove('active');
        adminProfilePanel.style.display = 'block';
        adminAppointmentsPanel.style.display = 'none';
        adminSchedulerPanel.style.display = 'none';
        adminServicesPanel.style.display = 'none';
        adminCustomersPanel.style.display = 'none';
        await loadBarberProfile();
    });

    // Scheduler events
    if (btnSaveWorkHours) btnSaveWorkHours.addEventListener('click', handleSaveWorkHours);
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

    // Profile events
    if (btnCopyShareUrl) btnCopyShareUrl.addEventListener('click', handleCopyShareUrl);
    if (profileForm) profileForm.addEventListener('submit', handleProfileSubmit);

    // Slug real-time uniqueness validation
    let slugCheckTimeout = null;
    if (profileSlug) {
        profileSlug.addEventListener('input', (e) => {
            // Clean value: force lowercase, digits, and hyphens only
            let val = e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '');
            e.target.value = val;
            
            // Update live preview of share URL
            updateLiveShareUrl(val);

            if (slugCheckTimeout) clearTimeout(slugCheckTimeout);
            if (!val) {
                slugStatusIcon.innerHTML = '';
                return;
            }

            slugStatusIcon.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color: var(--accent-gold);"></i>';
            slugCheckTimeout = setTimeout(async () => {
                try {
                    const { data, error } = await supabase
                        .from('barbers')
                        .select('id')
                        .eq('slug', val)
                        .neq('id', sessionUserId)
                        .maybeSingle();

                    if (error) throw error;

                    if (data) {
                        slugStatusIcon.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color: var(--color-error);" title="Bu URL adı başkası tarafından alınmış!"></i>';
                    } else {
                        slugStatusIcon.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--color-success);" title="Bu URL adı uygun!"></i>';
                    }
                } catch (err) {
                    console.error("Slug kontrol hatası:", err);
                    slugStatusIcon.innerHTML = '';
                }
            }, 500);
        });
    }


    // Image upload events
    const btnPickLogo = document.getElementById('btn-pick-logo');
    const btnPickCover = document.getElementById('btn-pick-cover');
    const btnRemoveLogo = document.getElementById('btn-remove-logo');
    const btnRemoveCover = document.getElementById('btn-remove-cover');
    const logoFileInput = document.getElementById('logo-file-input');
    const coverFileInput = document.getElementById('cover-file-input');

    if (btnPickLogo) btnPickLogo.addEventListener('click', () => logoFileInput.click());
    if (btnPickCover) btnPickCover.addEventListener('click', () => coverFileInput.click());
    if (logoFileInput) logoFileInput.addEventListener('change', (e) => handleImageUpload(e, 'logo'));
    if (coverFileInput) coverFileInput.addEventListener('change', (e) => handleImageUpload(e, 'cover'));
    if (btnRemoveLogo) btnRemoveLogo.addEventListener('click', () => clearImagePreview('logo'));
    if (btnRemoveCover) btnRemoveCover.addEventListener('click', () => clearImagePreview('cover'));
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
            .eq('user_id', sessionUserId)
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
            .eq('user_id', sessionUserId)
            .eq('key', 'working_slots')
            .maybeSingle();

        if (error) throw error;
        
        workingHours = (data && data.value && typeof data.value === 'object' && !Array.isArray(data.value)) 
            ? data.value 
            : { start: '09:00', end: '22:00' };

        if (selectWorkStart) selectWorkStart.value = workingHours.start || '09:00';
        if (selectWorkEnd) selectWorkEnd.value = workingHours.end || '22:00';
    } catch (err) {
        console.error("Çalışma saatleri yüklenemedi:", err);
        showToast("Çalışma saatleri yüklenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

async function handleSaveWorkHours() {
    const start = selectWorkStart.value;
    const end = selectWorkEnd.value;

    if (!start || !end) {
        showToast("Lütfen başlangıç ve bitiş saatini seçin.", "error");
        return;
    }

    showLoader();
    try {
        const payload = { start, end };
        const { error } = await supabase
            .from('settings')
            .upsert({ user_id: sessionUserId, key: 'working_slots', value: payload, updated_at: new Date().toISOString() });

        if (error) throw error;
        workingHours = payload;
        showToast("Mesai saatleri başarıyla güncellendi.", "success");
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
            .eq('user_id', sessionUserId)
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
            .upsert({ user_id: sessionUserId, key: 'weekly_holiday', value: selectedHoliday, updated_at: new Date().toISOString() });

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
            .eq('user_id', sessionUserId)
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
            .eq('user_id', sessionUserId)
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
                .insert({ ...payload, user_id: sessionUserId });

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
            .eq('user_id', sessionUserId)
            .eq('key', 'slot_strategy')
            .maybeSingle();

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
            .upsert({ user_id: sessionUserId, key: 'slot_strategy', value: strategy });

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
            .eq('user_id', sessionUserId)
            .eq('key', 'break_hours')
            .maybeSingle();

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
            .upsert({ user_id: sessionUserId, key: 'break_hours', value: payload });

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
        const { data: notesData, error } = await supabase.from('customer_notes').select('*').eq('user_id', sessionUserId);
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
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 3rem 0;">
                    <i class="fa-solid fa-users-slash" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block; margin-left: auto; margin-right: auto;"></i>
                    Kayıtlı müşteri bulunamadı.
                </td>
            </tr>
        `;
        return;
    }

    customers.forEach(customer => {
        const noteRow = notes.find(n => n.phone === customer.phone);
        const noteText = noteRow ? noteRow.note : 'Not eklenmemiş.';
        
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';

        tr.innerHTML = `
            <td style="padding: 1rem 1.5rem; vertical-align: middle;">
                <div style="font-weight: 600; color: var(--text-primary);">${customer.name}</div>
                <div class="customer-note-summary" style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                    <i class="fa-solid fa-sticky-note" style="color: var(--accent-gold); font-size: 0.75rem; margin-right: 0.25rem;"></i>
                    <span>${noteText}</span>
                </div>
            </td>
            <td style="padding: 1rem 1.5rem; vertical-align: middle;">
                <a href="tel:${customer.phone}" style="color: inherit; text-decoration: none;">${customer.phone}</a>
            </td>
            <td style="padding: 1rem 1.5rem; vertical-align: middle;">
                ${customer.lastVisit ? formatDateTurkish(customer.lastVisit) : '-'}
            </td>
            <td style="padding: 1rem 1.5rem; vertical-align: middle; font-weight: 600;">
                ${customer.totalAppointments}
            </td>
            <td style="padding: 1rem 1.5rem; vertical-align: middle; font-weight: 600; color: var(--color-success) !important;">
                ${customer.totalRevenue} ₺
            </td>
            <td style="padding: 1rem 1.5rem; vertical-align: middle; text-align: center;">
                <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
                    <button class="btn-secondary btn-sm btn-edit-note" data-phone="${customer.phone}" data-name="${customer.name}" data-note="${noteRow ? noteRow.note : ''}" style="color: var(--accent-gold); border-color: var(--accent-gold); padding: 0.35rem 0.75rem; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.3rem;">
                        <i class="fa-solid fa-pen"></i> Not
                    </button>
                    <a href="${buildWhatsAppUrl({customer_phone: customer.phone, customer_name: customer.name}, 'contact')}" target="_blank" class="btn-whatsapp btn-sm" title="WhatsApp'tan Mesaj Gönder" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center;">
                        <i class="fa-brands fa-whatsapp"></i>
                    </a>
                </div>
            </td>
        `;

        tr.querySelector('.btn-edit-note').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            openNoteModal(btn.dataset.phone, btn.dataset.note);
        });

        adminCustomersList.appendChild(tr);
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
            .upsert({ user_id: sessionUserId, phone: phone, note: note });

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
            user_id: sessionUserId,
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

// =============================================
// SALON PROFILE MANAGEMENT
// =============================================
async function loadBarberProfile() {
    if (!sessionUserId) return;

    showLoader();
    try {
        const { data, error } = await supabase
            .from('barbers')
            .select('*')
            .eq('id', sessionUserId)
            .maybeSingle();

        if (error) throw error;

        // Generate and show sharing URL based on slug or id
        const baseUrl = window.location.href.split('/').slice(0, -1).join('/');
        const shareUrl = data && data.slug 
            ? `${baseUrl}/salon.html?s=${data.slug}`
            : `${baseUrl}/salon.html?id=${sessionUserId}`;
        if (salonShareUrlInput) salonShareUrlInput.value = shareUrl;

        if (data) {
            if (profileSalonName) profileSalonName.value = data.salon_name || '';
            if (profileSlug) profileSlug.value = data.slug || '';
            if (profileOwnerName) profileOwnerName.value = data.owner_name || '';
            if (profilePhone) profilePhone.value = data.phone || '';
            if (profileAddress) profileAddress.value = data.address || '';
            if (profileDesc) profileDesc.value = data.description || '';
            if (profileInstagram) profileInstagram.value = data.instagram || '';
            if (profileLogoUrl) profileLogoUrl.value = data.logo_url || '';
            if (profileCoverUrl) profileCoverUrl.value = data.cover_url || '';

            // Populate image previews
            if (data.logo_url) setImagePreview('logo', data.logo_url);
            if (data.cover_url) setImagePreview('cover', data.cover_url);
            
            // Clean slug status icon
            if (slugStatusIcon) slugStatusIcon.innerHTML = '';
        }
    } catch (err) {
        console.error("Profil yüklenirken hata:", err);
        showToast("Profil bilgileri yüklenemedi.", "error");
    } finally {
        hideLoader();
    }
}


// =============================================
// IMAGE UPLOAD (Supabase Storage)
// =============================================
function setImagePreview(type, url) {
    const img = document.getElementById(`${type}-preview-img`);
    const placeholder = document.getElementById(`${type}-placeholder`);
    const removeBtn = document.getElementById(`btn-remove-${type}`);
    if (img) { img.src = url; img.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-flex';
}

function clearImagePreview(type) {
    const img = document.getElementById(`${type}-preview-img`);
    const placeholder = document.getElementById(`${type}-placeholder`);
    const removeBtn = document.getElementById(`btn-remove-${type}`);
    const urlInput = document.getElementById(`profile-${type}-url`);
    if (img) { img.src = ''; img.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
    if (removeBtn) removeBtn.style.display = 'none';
    if (urlInput) urlInput.value = '';
}

async function handleImageUpload(e, type) {
    const file = e.target.files[0];
    if (!file) return;

    const maxMB = type === 'logo' ? 2 : 5;
    if (file.size > maxMB * 1024 * 1024) {
        showToast(`Dosya çok büyük. Maksimum ${maxMB}MB yükleyebilirsiniz.`, 'error');
        e.target.value = '';
        return;
    }

    if (!sessionUserId) { showToast('Oturum bulunamadı.', 'error'); return; }

    const progressBar = document.getElementById(`${type}-progress-bar`);
    const progressWrapper = document.getElementById(`${type}-upload-progress`);

    if (progressWrapper) progressWrapper.style.display = 'block';
    if (progressBar) { progressBar.style.width = '0%'; progressBar.style.transition = 'none'; }
    requestAnimationFrame(() => {
        if (progressBar) { progressBar.style.transition = 'width 0.5s ease'; progressBar.style.width = '60%'; }
    });

    try {
        const ext = file.name.split('.').pop();
        const fileName = `${sessionUserId}/${type}_${Date.now()}.${ext}`;

        const { error } = await supabase.storage
            .from('salon-assets')
            .upload(fileName, file, { upsert: true, contentType: file.type });

        if (error) throw error;

        if (progressBar) progressBar.style.width = '100%';
        await new Promise(r => setTimeout(r, 400));

        const { data: urlData } = supabase.storage
            .from('salon-assets')
            .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;
        const urlInput = document.getElementById(`profile-${type}-url`);
        if (urlInput) urlInput.value = publicUrl;
        setImagePreview(type, publicUrl);

        showToast(`${type === 'logo' ? 'Logo' : 'Kapak görseli'} başarıyla yüklendi! ✅`, 'success');
    } catch (err) {
        console.error('Görsel yükleme hatası:', err);
        showToast('Görsel yüklenemedi. Supabase Storage bucket\'ı oluşturulmuş mu?', 'error');
    } finally {
        if (progressWrapper) setTimeout(() => { progressWrapper.style.display = 'none'; }, 700);
        e.target.value = '';
    }
}

async function handleProfileSubmit(e) {
    e.preventDefault();
    if (!sessionUserId) return;

    const salon_name = profileSalonName.value.trim();
    const slug = profileSlug ? profileSlug.value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '') : '';
    const owner_name = profileOwnerName.value.trim();
    const phone = profilePhone.value.trim();
    const address = profileAddress.value.trim();
    const description = profileDesc.value.trim();
    const instagram = profileInstagram.value.trim();
    const logo_url = profileLogoUrl.value.trim();
    const cover_url = profileCoverUrl.value.trim();

    if (!salon_name) {
        showToast("Salon adı zorunludur.", "error");
        return;
    }

    showLoader();
    try {
        // Validate slug uniqueness before saving
        if (slug) {
            const { data: existingSlug, error: checkError } = await supabase
                .from('barbers')
                .select('id')
                .eq('slug', slug)
                .neq('id', sessionUserId)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existingSlug) {
                showToast("Bu özel URL adı başka bir salon tarafından kullanılıyor.", "error");
                hideLoader();
                return;
            }
        }

        const { error } = await supabase
            .from('barbers')
            .upsert({
                id: sessionUserId,
                salon_name,
                slug: slug || null, // store null instead of empty string so unique constraint doesn't fail on multiple empty
                owner_name,
                phone,
                address,
                description,
                instagram,
                logo_url,
                cover_url
            });

        if (error) throw error;
        
        // Update live preview share url input
        updateLiveShareUrl(slug);
        
        showToast("Profil bilgileri başarıyla güncellendi. ✅", "success");
    } catch (err) {
        console.error("Profil kaydedilirken hata:", err);
        showToast("Değişiklikler kaydedilemedi.", "error");
    } finally {
        hideLoader();
    }
}

function handleCopyShareUrl() {
    if (salonShareUrlInput) {
        salonShareUrlInput.select();
        salonShareUrlInput.setSelectionRange(0, 99999); // Mobil için
        navigator.clipboard.writeText(salonShareUrlInput.value)
            .then(() => {
                showToast("Paylaşım linki kopyalandı! 📋", "success");
            })
            .catch(err => {
                console.error("Kopyalama hatası:", err);
                showToast("Kopyalanamadı, lütfen manuel seçin.", "error");
            });
    }
}

// Helper to update the live preview sharing link
function updateLiveShareUrl(slug) {
    const baseUrl = window.location.href.split('/').slice(0, -1).join('/');
    if (slug) {
        salonShareUrlInput.value = `${baseUrl}/salon.html?s=${slug}`;
    } else {
        salonShareUrlInput.value = `${baseUrl}/salon.html?id=${sessionUserId}`;
    }
}


