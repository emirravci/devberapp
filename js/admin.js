import { supabase, showLoader, hideLoader, showToast, showView } from './supabase.js';

// DOM Elements - Auth
const adminLoginForm = document.getElementById('admin-login-form');
const adminEmailInput = document.getElementById('admin-email');
const adminPasswordInput = document.getElementById('admin-password');
const btnAdminLogout = document.getElementById('btn-admin-logout');

// DOM Elements - Stats
const statPending = document.getElementById('stat-pending');
const statApproved = document.getElementById('stat-approved');
const statToday = document.getElementById('stat-today');
const statTotal = document.getElementById('stat-total');

// DOM Elements - Filters
const filterAll = document.getElementById('filter-all');
const filterPending = document.getElementById('filter-pending');
const filterApproved = document.getElementById('filter-approved');
const filterRejected = document.getElementById('filter-rejected');
const appointmentsList = document.getElementById('admin-appointments-list');

// DOM Elements - Scheduler
const newSlotTimeInput = document.getElementById('new-slot-time');
const btnAddSlot = document.getElementById('btn-add-slot');
const slotsEditGrid = document.getElementById('slots-edit-grid');
const selectHolidayDay = document.getElementById('select-holiday-day');
const btnSaveHoliday = document.getElementById('btn-save-holiday');

// Module state
let allAppointments = [];
let currentFilter = 'all'; // 'all', 'pending', 'approved', 'rejected'
let workingSlots = [];
let weeklyHoliday = 'none';
let realtimeChannel = null;

// Listen to Admin Dashboard Load Event
document.addEventListener('view-admin-dashboard-loaded', async () => {
    // Verify session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        showToast("Lütfen önce giriş yapın.", "error");
        showView('admin-login');
        return;
    }
    
    currentFilter = 'all';
    updateFilterTabStyles();
    await loadAdminDashboard();
    initRealtimeSubscription();
});

// Listen to Scheduler Tab Load Event
document.addEventListener('admin-scheduler-loaded', async () => {
    await loadWorkingHours();
    await loadHolidaySetting();
});

// Setup admin action listeners
function initAdminEvents() {
    // 1. Admin Login Form Submit
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
            // Navigation handled by auth listener in supabase.js
        } catch (err) {
            console.error("Giriş hatası:", err);
            showToast(err.message || "Giriş yapılamadı. Bilgilerinizi kontrol edin.", "error");
        } finally {
            hideLoader();
        }
    });

    // 2. Admin Logout
    btnAdminLogout.addEventListener('click', async () => {
        showLoader();
        try {
            // Clean up realtime subscription
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

    // 3. Tab Filters clicks
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

    // 4. Add Working Hour Slot
    btnAddSlot.addEventListener('click', handleAddSlot);

    // 5. Save Holiday Day click
    btnSaveHoliday.addEventListener('click', handleSaveHoliday);
}

initAdminEvents();

// Update classes for filter buttons
function updateFilterTabStyles() {
    [filterAll, filterPending, filterApproved, filterRejected].forEach(btn => btn.classList.remove('active'));
    
    if (currentFilter === 'all') filterAll.classList.add('active');
    if (currentFilter === 'pending') filterPending.classList.add('active');
    if (currentFilter === 'approved') filterApproved.classList.add('active');
    if (currentFilter === 'rejected') filterRejected.classList.add('active');
}

// Fetch dashboard stats and list appointments
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

// Calculate and render statistic card counters
function calculateStats() {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    
    let pendingCount = 0;
    let approvedCount = 0;
    let todayCount = 0;

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

// Format date to local readable format
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Format date for WhatsApp message (e.g. 27 Haziran 2026)
function formatDateTurkish(dateString) {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// Convert formatted phone to international WhatsApp format
function toWhatsAppNumber(phone) {
    const digits = phone.replace(/\D/g, '');
    // Turkish numbers: 10 digits (5XX...) or 11 digits (05XX...)
    if (digits.length === 11 && digits.startsWith('0')) {
        return '90' + digits.substring(1);
    } else if (digits.length === 10) {
        return '90' + digits;
    }
    return digits; // return as-is if format unknown
}

// Build WhatsApp URL with templated message
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

// Filter and render list cards
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

        // Notes segment if exists
        const notesHtml = app.notes ? `<div class="app-notes"><strong>Not:</strong> ${app.notes}</div>` : '';

        const waApprovedUrl = buildWhatsAppUrl(app, 'approved');
        const waRejectedUrl = buildWhatsAppUrl(app, 'rejected');
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

        // Bind event listeners for actions
        const btnApprove = card.querySelector('.btn-approve');
        if (btnApprove) {
            btnApprove.addEventListener('click', () => updateAppointmentStatus(app.id, 'approved'));
        }

        const btnReject = card.querySelector('.btn-reject');
        if (btnReject) {
            btnReject.addEventListener('click', () => updateAppointmentStatus(app.id, 'rejected'));
        }

        card.querySelector('.btn-delete').addEventListener('click', () => deleteAppointment(app.id));

        appointmentsList.appendChild(card);
    });
}

// Update status in database and optionally open WhatsApp
async function updateAppointmentStatus(id, newStatus) {
    showLoader();
    try {
        const { error } = await supabase
            .from('appointments')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) throw error;
        
        // Reload data first
        await loadAdminDashboard();
        
        // Find updated appointment and build WA URL
        const updatedApp = allAppointments.find(a => a.id === id);
        if (updatedApp) {
            const waUrl = buildWhatsAppUrl(updatedApp, newStatus);
            const actionText = newStatus === 'approved' ? 'onaylandı' : 'reddedildi';
            
            // Show toast with WhatsApp shortcut
            const toastMsg = newStatus === 'approved' ? "Randevu onaylandı ✅" : "Randevu reddedildi.";
            showToast(toastMsg, "success");
            
            // Open WhatsApp confirmation/rejection message automatically
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

// Delete record
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

// WORKING HOURS CONFIGURATION (SCHEDULER PANEL)

// Load scheduler slots from settings
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

// Render active hours list with remove actions
function renderWorkingSlots() {
    slotsEditGrid.innerHTML = '';

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

// Add slot and save to database
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

    // Add, sort chronologically, and save
    workingSlots.push(newTime);
    workingSlots.sort();

    await saveWorkingSlots();
    newSlotTimeInput.value = '';
}

// Remove slot and save to database
async function removeWorkingSlot(timeToRemove) {
    if (!confirm(`${timeToRemove} saat dilimini kaldırmak istediğinize emin misiniz?`)) return;
    
    workingSlots = workingSlots.filter(t => t !== timeToRemove);
    await saveWorkingSlots();
}

// Save updated slots array to database
async function saveWorkingSlots() {
    showLoader();
    try {
        const { error } = await supabase
            .from('settings')
            .upsert({
                key: 'working_slots',
                value: workingSlots,
                updated_at: new Date().toISOString()
            });

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

// REALTIME & HOLIDAY CONFIG HELPERS

// Initialize Supabase Realtime Channel
function initRealtimeSubscription() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }
    
    realtimeChannel = supabase
        .channel('admin-appointments-changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'appointments'
        }, async (payload) => {
            console.log('Anlık veri değişikliği algılandı:', payload);
            await loadAdminDashboardSilent();
        })
        .subscribe();
}

// Fetch dashboard data silently (without loader) for realtime updates
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

// Load weekly holiday setting
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

// Save weekly holiday to database
async function handleSaveHoliday() {
    const selectedHoliday = selectHolidayDay.value;
    
    showLoader();
    try {
        const { error } = await supabase
            .from('settings')
            .upsert({
                key: 'weekly_holiday',
                value: selectedHoliday,
                updated_at: new Date().toISOString()
            });

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
