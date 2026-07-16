import { supabase, showLoader, hideLoader, showToast, getSavedAppointmentIds, saveAppointmentId } from './supabase-core.js';

// =============================================
// MULTI-TENANT: READ BARBER ID OR SLUG FROM URL
// =============================================
const urlParams = new URLSearchParams(window.location.search);
let barberId = urlParams.get('id');
const barberSlug = urlParams.get('s');


// =============================================
// DOM ELEMENTS
// =============================================
const bookingForm = document.getElementById('booking-form');
const servicesGrid = document.getElementById('services-grid');
const bookingDateInput = document.getElementById('booking-date');
const bookingSlotsContainer = document.getElementById('booking-slots-container');
const bookingSlotsGrid = document.getElementById('booking-slots-grid');
const customerNameInput = document.getElementById('customer-name');
const customerPhoneInput = document.getElementById('customer-phone');
const customerNotesInput = document.getElementById('customer-notes');
const btnBook = document.getElementById('btn-book');
const noBarberError = document.getElementById('no-barber-error');
const mainBookingCard = document.getElementById('main-booking-card');

const btnMyAppointments = document.getElementById('btn-my-appointments');
const appointmentsModal = document.getElementById('appointments-modal');
const btnCloseAppointmentsModal = document.getElementById('btn-close-appointments-modal');
const myAppointmentsList = document.getElementById('my-appointments-list');

const confirmModal = document.getElementById('confirm-booking-modal');
const btnCloseConfirmModal = document.getElementById('btn-close-confirm-modal');
const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
const btnFinalConfirm = document.getElementById('btn-final-confirm');

const confirmService = document.getElementById('confirm-service');
const confirmDurationPrice = document.getElementById('confirm-duration-price');
const confirmDate = document.getElementById('confirm-date');
const confirmTime = document.getElementById('confirm-time');
const confirmName = document.getElementById('confirm-name');
const confirmPhone = document.getElementById('confirm-phone');

const successView = document.getElementById('success-view');
const bookingView = document.getElementById('booking-view');
const successService = document.getElementById('success-service');
const successDate = document.getElementById('success-date');
const successTime = document.getElementById('success-time');
const successName = document.getElementById('success-name');
const btnSuccessBack = document.getElementById('btn-success-back');

let selectedService = '';
let selectedPrice = 0;
let selectedDuration = 30;
let selectedDate = '';
let selectedTime = '';

// =============================================
// VIEW SWITCHING
// =============================================
function showCustomerView(viewId) {
    [bookingView, successView].forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId + '-view');
    if (target) target.classList.add('active');
}

// =============================================
// SALON PROFILE LOADING (from barbers table)
// =============================================
async function loadSalonProfile() {
    if (!barberId) return;
    try {
        const { data, error } = await supabase
            .from('barbers')
            .select('salon_name, description, phone, address, instagram, logo_url, cover_url')
            .eq('id', barberId)
            .maybeSingle();
        if (error) throw error;
        if (!data) return;

        const salonName = data.salon_name;
        const salonDesc = data.description;
        const salonOwner = data.owner_name;
        const salonPhone = data.phone;
        const salonAddress = data.address;
        const salonInstagram = data.instagram;
        const salonLogo = data.logo_url;
        const salonCover = data.cover_url;

        if (salonName) document.title = salonName + ' | Randevu Al';

        const nameEl = document.getElementById('display-salon-name');
        const appbarNameEl = document.getElementById('appbar-salon-name');
        const descEl = document.getElementById('display-salon-description');
        const ownerEl = document.getElementById('display-salon-owner');

        if (appbarNameEl) appbarNameEl.textContent = salonName || 'Salon';
        if (nameEl) nameEl.textContent = salonName || 'Salon';
        if (ownerEl) {
            if (salonOwner) {
                ownerEl.querySelector('span').textContent = salonOwner;
                ownerEl.style.display = 'inline-flex';
            } else {
                ownerEl.style.display = 'none';
            }
        }
        const phoneEl = document.getElementById('display-salon-phone');
        const addressEl = document.getElementById('display-salon-address');
        const whatsappEl = document.getElementById('display-salon-whatsapp');
        const igEl = document.getElementById('display-salon-instagram');
        const logoEl = document.getElementById('salon-logo-img');
        const coverEl = document.getElementById('salon-cover-img');

        if (descEl) descEl.textContent = salonDesc || '';

        // Clean phone number format for tel and WhatsApp links
        let cleanedPhone = '';
        if (salonPhone) {
            cleanedPhone = salonPhone.replace(/\D/g, '');
            if (cleanedPhone.length === 10 && !cleanedPhone.startsWith('9')) {
                cleanedPhone = '90' + cleanedPhone;
            } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('0')) {
                cleanedPhone = '90' + cleanedPhone.substring(1);
            }
        }

        if (phoneEl) {
            if (salonPhone) {
                phoneEl.innerHTML = '<i class="fa-solid fa-phone"></i> ' + salonPhone;
                phoneEl.href = 'tel:' + (cleanedPhone.startsWith('+') ? cleanedPhone : '+' + cleanedPhone);
                phoneEl.style.display = 'inline-flex';
            } else {
                phoneEl.style.display = 'none';
            }
        }

        if (whatsappEl) {
            if (cleanedPhone) {
                whatsappEl.href = 'https://wa.me/' + cleanedPhone;
                whatsappEl.style.display = 'inline-flex';
            } else {
                whatsappEl.style.display = 'none';
            }
        }

        if (addressEl) {
            if (salonAddress) {
                addressEl.innerHTML = '<i class="fa-solid fa-location-dot"></i> ' + salonAddress;
                addressEl.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(salonAddress);
                addressEl.style.display = 'inline-flex';
            } else {
                addressEl.style.display = 'none';
            }
        }

        if (igEl) {
            if (salonInstagram) {
                igEl.href = salonInstagram.startsWith('http') ? salonInstagram : 'https://instagram.com/' + salonInstagram.replace('@', '');
                igEl.style.display = 'inline-flex';
            } else {
                igEl.style.display = 'none';
            }
        }
        if (logoEl && salonLogo) {
            logoEl.src = salonLogo;
            logoEl.onerror = () => { logoEl.src = 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=150&auto=format&fit=crop&q=80'; };
        }
        if (coverEl && salonCover) {
            coverEl.src = salonCover;
            coverEl.onerror = () => { coverEl.src = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&auto=format&fit=crop&q=80'; };
        }
    } catch (err) {
        console.error('Salon profili yuklenemedi:', err);
    }
}

// =============================================
// SERVICES LOADING (per barber)
// =============================================
async function loadServices() {
    showLoader();
    try {
        let query = supabase.from('services').select('*').order('price', { ascending: true });
        if (barberId) query = query.eq('user_id', barberId);
        const { data, error } = await query;
        if (error) throw error;
        renderServices(data || []);
    } catch (err) {
        console.error('Hizmetler yuklenemedi:', err);
        showToast('Hizmet listesi yuklenirken hata olustu.', 'error');
        servicesGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--color-error);padding:1.5rem 0;font-weight:600;"><i class="fa-solid fa-triangle-exclamation" style="font-size:1.5rem;margin-bottom:0.5rem;display:block;"></i>Hizmet listesi alinamadi.</div>';
    } finally {
        hideLoader();
    }
}

function renderServices(services) {
    servicesGrid.innerHTML = '';
    if (services.length === 0) {
        servicesGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:2rem 0;">Aktif hizmet bulunmamaktadir.</div>';
        return;
    }
    services.forEach(service => {
        const card = document.createElement('div');
        card.className = 'service-card';
        card.setAttribute('data-service', service.name);
        card.setAttribute('data-price', service.price);
        card.setAttribute('data-duration', service.duration);
        const iconClass = service.icon || 'fa-scissors';
        card.innerHTML =
            '<div class="service-icon"><i class="fa-solid ' + iconClass + '"></i></div>' +
            '<div class="service-name">' + service.name + '</div>' +
            '<div class="service-price">' + service.price + ' ₺</div>' +
            '<div class="service-duration"><i class="fa-regular fa-clock"></i> ' + service.duration + ' dk</div>' +
            '<div class="service-desc">' + (service.description || '') + '</div>';
        card.addEventListener('click', () => {
            servicesGrid.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedService = service.name;
            selectedPrice = parseFloat(service.price);
            selectedDuration = parseInt(service.duration || '30', 10);
            validateForm();
            setTimeout(() => goToStep(2), 220);
        });
        servicesGrid.appendChild(card);
    });
}

// =============================================
// WIZARD / STEP NAVIGATION
// =============================================
let currentStep = 1;

function goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 3) return;
    document.querySelectorAll('.wizard-step').forEach(step => step.classList.remove('active'));
    const targetStep = document.getElementById('step-' + stepNumber);
    if (targetStep) targetStep.classList.add('active');
    document.querySelectorAll('.progress-step').forEach(step => {
        const stepVal = parseInt(step.getAttribute('data-step'), 10);
        step.classList.remove('active', 'completed');
        if (stepVal === stepNumber) step.classList.add('active');
        else if (stepVal < stepNumber) step.classList.add('completed');
    });
    const lineFill = document.getElementById('progress-line-fill');
    if (lineFill) lineFill.style.width = ((stepNumber - 1) / 2 * 100) + '%';
    currentStep = stepNumber;
}

// =============================================
// INITIALIZATION
// =============================================
async function initBookingEvents() {
    if (!barberId) {
        if (noBarberError) noBarberError.style.display = 'block';
        if (mainBookingCard) mainBookingCard.style.display = 'none';
        const ph = document.querySelector('.salon-profile-header');
        if (ph) ph.style.display = 'none';
        hideLoader();
        return;
    }
    loadSalonProfile();
    loadServices();
    updateSalonStatusBadge();

    const todayObj = new Date();
    bookingDateInput.min = todayObj.toLocaleDateString('en-CA');
    const maxDateObj = new Date();
    maxDateObj.setDate(todayObj.getDate() + 30);
    bookingDateInput.max = maxDateObj.toLocaleDateString('en-CA');

    bookingDateInput.addEventListener('change', async (e) => {
        selectedDate = e.target.value;
        selectedTime = '';
        validateForm();
        if (selectedDate) await loadAvailableTimeSlots(selectedDate);
        else bookingSlotsContainer.style.display = 'none';
    });

    customerNameInput.addEventListener('input', validateForm);

    customerPhoneInput.addEventListener('input', (e) => {
        let digits = e.target.value.replace(/\D/g, '');
        if (digits.length > 11) digits = digits.substring(0, 11);
        let formatted = '';
        if (digits.length > 0) {
            if (digits[0] === '0') {
                formatted += '0';
                if (digits.length > 1) formatted += ' (' + digits.substring(1, 4);
                if (digits.length > 4) formatted += ') ' + digits.substring(4, 7);
                if (digits.length > 7) formatted += ' ' + digits.substring(7, 9);
                if (digits.length > 9) formatted += ' ' + digits.substring(9, 11);
            } else {
                formatted += '(' + digits.substring(0, 3);
                if (digits.length > 3) formatted += ') ' + digits.substring(3, 6);
                if (digits.length > 6) formatted += ' ' + digits.substring(6, 8);
                if (digits.length > 8) formatted += ' ' + digits.substring(8, 10);
            }
        }
        e.target.value = formatted;
        validateForm();
    });

    bookingForm.addEventListener('submit', (e) => { e.preventDefault(); openConfirmModal(); });
    btnCloseConfirmModal.addEventListener('click', () => confirmModal.classList.remove('active'));
    btnCancelConfirm.addEventListener('click', () => confirmModal.classList.remove('active'));
    btnFinalConfirm.addEventListener('click', handleBookingSubmit);

    document.getElementById('btn-next-to-2').addEventListener('click', () => goToStep(2));
    document.getElementById('btn-back-to-1').addEventListener('click', () => goToStep(1));
    document.getElementById('btn-next-to-3').addEventListener('click', () => goToStep(3));
    document.getElementById('btn-back-to-2').addEventListener('click', () => goToStep(2));

    document.querySelectorAll('.progress-step').forEach(step => {
        step.addEventListener('click', () => {
            const stepVal = parseInt(step.getAttribute('data-step'), 10);
            if (stepVal === 1) goToStep(1);
            else if (stepVal === 2 && selectedService) goToStep(2);
            else if (stepVal === 3 && selectedService && selectedDate && selectedTime) goToStep(3);
        });
    });

    btnMyAppointments.addEventListener('click', openAppointmentsModal);
    const btnMyAppointmentsNav = document.getElementById('btn-my-appointments-nav');
    if (btnMyAppointmentsNav) {
        btnMyAppointmentsNav.addEventListener('click', openAppointmentsModal);
    }
    btnCloseAppointmentsModal.addEventListener('click', () => appointmentsModal.classList.remove('active'));
    appointmentsModal.addEventListener('click', (e) => { if (e.target === appointmentsModal) appointmentsModal.classList.remove('active'); });
    btnSuccessBack.addEventListener('click', () => { resetBookingState(); showCustomerView('booking'); });

    // Phone search box event listeners
    const searchPhoneInput = document.getElementById('appointments-search-phone');
    const btnSearchAppointments = document.getElementById('btn-search-appointments');

    if (searchPhoneInput) {
        searchPhoneInput.addEventListener('input', (e) => {
            let digits = e.target.value.replace(/\D/g, '');
            if (digits.length > 11) digits = digits.substring(0, 11);
            let formatted = '';
            if (digits.length > 0) {
                if (digits[0] === '0') {
                    formatted += '0';
                    if (digits.length > 1) formatted += ' (' + digits.substring(1, 4);
                    if (digits.length > 4) formatted += ') ' + digits.substring(4, 7);
                    if (digits.length > 7) formatted += ' ' + digits.substring(7, 9);
                    if (digits.length > 9) formatted += ' ' + digits.substring(9, 11);
                } else {
                    formatted += '(' + digits.substring(0, 3);
                    if (digits.length > 3) formatted += ') ' + digits.substring(3, 6);
                    if (digits.length > 6) formatted += ' ' + digits.substring(6, 8);
                    if (digits.length > 8) formatted += ' ' + digits.substring(8, 10);
                }
            }
            e.target.value = formatted;
        });

        searchPhoneInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (btnSearchAppointments) btnSearchAppointments.click();
            }
        });
    }

    if (btnSearchAppointments) {
        btnSearchAppointments.addEventListener('click', searchAppointmentsByPhone);
    }
}

function openConfirmModal() {
    confirmService.innerText = selectedService;
    confirmDurationPrice.innerText = selectedDuration + ' dk / ' + selectedPrice + ' ₺';
    confirmDate.innerText = formatTurkishDate(selectedDate);
    confirmTime.innerText = selectedTime;
    confirmName.innerText = customerNameInput.value.trim();
    confirmPhone.innerText = customerPhoneInput.value.trim();
    confirmModal.classList.add('active');
}

async function initBookingPage() {
    showLoader();
    try {
        if (!barberId && barberSlug) {
            // Query barbers table by slug to get the unique id
            const { data, error } = await supabase
                .from('barbers')
                .select('id')
                .eq('slug', barberSlug.toLowerCase().trim())
                .maybeSingle();

            if (error) throw error;
            if (data) {
                barberId = data.id;
            }
        }
        await initBookingEvents();
    } catch (err) {
        console.error("Sayfa başlatılamadı:", err);
        showToast("Sayfa yüklenirken hata oluştu.", "error");
        hideLoader();
    }
}

initBookingPage();

// =============================================
// FORM STATE & VALIDATION
// =============================================
function resetBookingState() {
    bookingForm.reset();
    servicesGrid.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
    bookingSlotsContainer.style.display = 'none';
    bookingSlotsGrid.innerHTML = '';
    selectedService = '';
    selectedPrice = 0;
    selectedDate = '';
    selectedTime = '';
    goToStep(1);
    validateForm();
}

function validateForm() {
    const customerName = customerNameInput.value.trim();
    const digits = customerPhoneInput.value.replace(/\D/g, '');
    const isPhoneValid = digits.length === 10 || digits.length === 11;
    const btnNextTo2 = document.getElementById('btn-next-to-2');
    const btnNextTo3 = document.getElementById('btn-next-to-3');
    if (btnNextTo2) btnNextTo2.disabled = !selectedService;
    if (btnNextTo3) btnNextTo3.disabled = !(selectedService && selectedDate && selectedTime);
    btnBook.disabled = !(selectedService && selectedDate && selectedTime && customerName && isPhoneValid);
}

// =============================================
// TIME HELPERS
// =============================================
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minutesToTime(minutes) {
    return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

// =============================================
// TIME SLOTS (per barber)
// =============================================
async function loadAvailableTimeSlots(dateString) {
    showLoader();
    try {
        let settingsQuery = supabase.from('settings').select('key, value').in('key', ['working_slots', 'weekly_holiday', 'slot_strategy', 'break_hours']);
        if (barberId) settingsQuery = settingsQuery.eq('user_id', barberId);
        const { data: settingsData, error: settingsError } = await settingsQuery;
        if (settingsError) throw settingsError;

        const workingSlotsSetting = settingsData.find(s => s.key === 'working_slots');
        const holidaySetting = settingsData.find(s => s.key === 'weekly_holiday');
        const strategySetting = settingsData.find(s => s.key === 'slot_strategy');
        const breakSetting = settingsData.find(s => s.key === 'break_hours');

        let workingHours = { start: '09:00', end: '22:00' };
        if (workingSlotsSetting && workingSlotsSetting.value) {
            if (Array.isArray(workingSlotsSetting.value) && workingSlotsSetting.value.length > 0) {
                const sorted = [...workingSlotsSetting.value].sort();
                workingHours.start = sorted[0];
                workingHours.end = sorted[sorted.length - 1];
            } else if (!Array.isArray(workingSlotsSetting.value)) {
                workingHours = workingSlotsSetting.value;
            }
        }

        const startMin = timeToMinutes(workingHours.start || '09:00');
        const endMin = timeToMinutes(workingHours.end || '22:00');
        let activeSlots = [];
        for (let m = startMin; m <= endMin; m += 30) activeSlots.push(minutesToTime(m));

        const holidayDay = holidaySetting ? holidaySetting.value : 'none';
        let slotStrategy = strategySetting ? strategySetting.value : 'half_hourly';
        if (typeof slotStrategy === 'string') slotStrategy = slotStrategy.replace(/^"|"$/g, '');
        else if (typeof slotStrategy === 'object' && slotStrategy !== null) slotStrategy = slotStrategy.strategy || slotStrategy.value || 'half_hourly';
        const breakHours = breakSetting ? breakSetting.value : null;

        if (holidayDay !== 'none') {
            const [year, month, day] = dateString.split('-').map(Number);
            const selectedDay = new Date(year, month - 1, day).getDay();
            if (selectedDay.toString() === holidayDay) { renderHolidayMessage(holidayDay); return; }
        }

        let bookedQuery = supabase.from('appointments').select('appointment_time, service_duration, status').eq('appointment_date', dateString).neq('status', 'rejected');
        if (barberId) bookedQuery = bookedQuery.eq('user_id', barberId);
        const { data: bookedData } = await bookedQuery;

        renderTimeSlots(activeSlots, bookedData || [], dateString, slotStrategy, breakHours);
    } catch (err) {
        console.error('Randevu saatleri yuklenemedi:', err);
        showToast('Randevu saatleri yuklenirken hata olustu.', 'error');
    } finally {
        hideLoader();
    }
}

function renderTimeSlots(activeSlots, bookedAppointments, dateString, slotStrategy, breakHours) {
    bookingSlotsGrid.innerHTML = '';
    const now = new Date();
    const isTodaySelected = (dateString === now.toLocaleDateString('en-CA'));
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (activeSlots.length === 0) {
        bookingSlotsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);font-size:0.9rem;padding:1rem 0;">Berber aktif calisma saati tanimlamamis.</div>';
        bookingSlotsContainer.style.display = 'block';
        return;
    }

    let slotsToShow = [];
    if (slotStrategy === 'hourly') {
        slotsToShow = activeSlots.filter(s => s.endsWith(':00'));
    } else if (slotStrategy === 'half_hourly') {
        slotsToShow = activeSlots.filter(s => s.endsWith(':00') || s.endsWith(':30'));
    } else if (slotStrategy === 'service_based') {
        const sorted = [...activeSlots].sort();
        const sMin = timeToMinutes(sorted[0]);
        const eMin = timeToMinutes(sorted[sorted.length - 1]);
        const maxStart = eMin + 60 - selectedDuration;
        for (let m = sMin; m <= maxStart; m += 15) slotsToShow.push(minutesToTime(m));
    } else {
        slotsToShow = activeSlots;
    }

    if (slotsToShow.length === 0) {
        bookingSlotsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);font-size:0.9rem;padding:1rem 0;">Secilen hizmet suresi icin uygun saat araligI bulunamadi.</div>';
        bookingSlotsContainer.style.display = 'block';
        return;
    }

    slotsToShow.forEach(slot => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot-btn';
        btn.innerText = slot;

        let isPastTime = false;
        if (isTodaySelected) {
            const [sh, sm] = slot.split(':').map(Number);
            if (sh < currentHour || (sh === currentHour && sm <= currentMinute)) isPastTime = true;
        }

        let isBreak = false;
        if (breakHours && breakHours.start && breakHours.end) {
            const ss = timeToMinutes(slot);
            const se = ss + (slotStrategy === 'service_based' ? selectedDuration : 30);
            const bs = timeToMinutes(breakHours.start);
            const be = timeToMinutes(breakHours.end);
            if (ss < be && se > bs) isBreak = true;
        }

        const slotStart = timeToMinutes(slot);
        const slotEnd = slotStart + selectedDuration;
        let isBooked = false;
        let isPending = false;

        bookedAppointments.forEach(app => {
            const appStart = timeToMinutes(app.appointment_time);
            const appEnd = appStart + (app.service_duration || 30);
            if (slotStart < appEnd && slotEnd > appStart) {
                if (app.status === 'approved') isBooked = true;
                else if (app.status === 'pending') isPending = true;
            }
        });

        if (isBooked || isPastTime || isBreak) {
            btn.disabled = true;
            btn.title = isBooked ? 'Dolu' : (isBreak ? 'Mola / Yemek Saati' : 'Gecmis Saat');
        } else if (isPending) {
            btn.disabled = true;
            btn.classList.add('pending-slot');
            btn.title = 'Bu saat icin onay bekleyen bir randevu var';
        }

        btn.addEventListener('click', () => {
            bookingSlotsGrid.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTime = slot;
            validateForm();
            setTimeout(() => goToStep(3), 220);
        });
        bookingSlotsGrid.appendChild(btn);
    });

    bookingSlotsContainer.style.display = 'block';
}

function renderHolidayMessage(holidayDayNum) {
    const daysTurkish = ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'];
    bookingSlotsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--color-error);font-weight:600;padding:1.5rem 0;font-size:0.95rem;"><i class="fa-solid fa-mug-hot" style="font-size:1.5rem;margin-bottom:0.5rem;display:block;color:var(--accent-gold);"></i>Salonumuz ' + (daysTurkish[holidayDayNum] || 'Tatil Gunu') + ' gunleri kapalidir.</div>';
    bookingSlotsContainer.style.display = 'block';
}

// =============================================
// DATE / TIME FORMATTERS
// =============================================
function formatTurkishDate(dateStr) {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(timeStr) {
    if (!timeStr) return '-';
    const parts = timeStr.split(':');
    if (parts.length >= 2) return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
    return timeStr;
}

// =============================================
// BOOKING SUBMIT (with barberId)
// =============================================
async function handleBookingSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    confirmModal.classList.remove('active');
    const customerName = customerNameInput.value.trim();
    const customerPhone = customerPhoneInput.value.trim();
    const notes = customerNotesInput.value.trim();
    const digits = customerPhone.replace(/\D/g, '');
    if (!selectedService || !selectedDate || !selectedTime || !customerName || (digits.length !== 10 && digits.length !== 11)) {
        showToast('Lutfen tum zorunlu alanlari dogru doldurun!', 'error');
        return;
    }
    if (!barberId) { showToast('Gecersiz berber baglantisi.', 'error'); return; }
    showLoader();
    try {
        const { data: insertedData, error } = await supabase.from('appointments').insert({
            user_id: barberId,
            customer_name: customerName,
            customer_phone: customerPhone,
            service_name: selectedService,
            service_duration: selectedDuration,
            appointment_date: selectedDate,
            appointment_time: selectedTime,
            status: 'pending',
            notes: notes
        }).select().single();
        if (error) throw error;
        if (insertedData && insertedData.id) saveAppointmentId(insertedData.id);
        successService.innerText = selectedService + ' (' + selectedPrice + ' ₺)';
        successDate.innerText = formatTurkishDate(selectedDate);
        successTime.innerText = selectedTime;
        successName.innerText = customerName;
        setupCalendarLinks(selectedService, selectedDate, selectedTime, selectedDuration);
        showToast('Randevunuz basariyla alindi!', 'success');
        showCustomerView('success');
    } catch (err) {
        console.error('Randevu kaydetme hatasi:', err);
        showToast('Randevu kaydedilirken bir hata olustu.', 'error');
    } finally {
        hideLoader();
    }
}

// =============================================
// CALENDAR LINKS
// =============================================
function setupCalendarLinks(service, dateStr, timeStr, durationMinutes) {
    const googleBtn = document.getElementById('btn-add-google-calendar');
    const appleBtn = document.getElementById('btn-add-apple-calendar');
    const [hours, minutes] = timeStr.split(':').map(Number);
    const [year, month, day] = dateStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, hours, minutes);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    const formatISO = (d) => {
        const p = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + 'T' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    };
    const startStr = formatISO(startDate);
    const endStr = formatISO(endDate);
    const nameEl = document.getElementById('display-salon-name');
    const salonName = (nameEl && nameEl.textContent && nameEl.textContent !== 'Salon Yukleniyor...') ? nameEl.textContent : 'Berber Salonu';
    const title = encodeURIComponent(salonName + ' Randevu - ' + service);
    const details = encodeURIComponent(salonName + ' randevunuz. Sure: ' + durationMinutes + ' dk.');
    const location = encodeURIComponent(salonName);
    googleBtn.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + title + '&dates=' + startStr + '/' + endStr + '&details=' + details + '&location=' + location;
    appleBtn.onclick = () => {
        const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' + salonName + '//EN', 'BEGIN:VEVENT', 'UID:' + Date.now() + '@devberapp', 'DTSTAMP:' + formatISO(new Date()) + 'Z', 'DTSTART:' + startStr, 'DTEND:' + endStr, 'SUMMARY:' + salonName + ' - ' + service, 'DESCRIPTION:' + service + ' randevunuz.', 'LOCATION:' + salonName, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'berber_randevu.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
}

// =============================================
// MY APPOINTMENTS MODAL
// =============================================
async function openAppointmentsModal() {
    appointmentsModal.classList.add('active');
    
    const searchPhoneInput = document.getElementById('appointments-search-phone');
    if (searchPhoneInput) {
        const savedPhone = localStorage.getItem('devber_search_phone');
        if (savedPhone) {
            searchPhoneInput.value = savedPhone;
            await searchAppointmentsByPhone();
        } else {
            searchPhoneInput.value = '';
            myAppointmentsList.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:2rem 1rem;"><i class="fa-solid fa-phone-volume" style="font-size:2rem;color:var(--text-muted);margin-bottom:0.5rem;display:block;"></i>Randevularınızı listelemek için telefon numaranızı girip sorgulayın.</div>';
        }
    }
}

async function searchAppointmentsByPhone() {
    const searchPhoneInput = document.getElementById('appointments-search-phone');
    if (!searchPhoneInput) return;

    const phoneVal = searchPhoneInput.value.trim();
    if (!phoneVal) {
        showToast("Lütfen telefon numaranızı girin.", "error");
        return;
    }

    // Save phone to localStorage so they don't need to type it next time
    localStorage.setItem('devber_search_phone', phoneVal);

    myAppointmentsList.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:1rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Sorgulanıyor...</div>';

    try {
        let query = supabase
            .from('appointments')
            .select('*')
            .eq('customer_phone', phoneVal);
            
        // Filter by barberId so they only see appointments of the current salon for privacy!
        if (barberId) {
            query = query.eq('user_id', barberId);
        }
        
        const { data, error } = await query
            .order('appointment_date', { ascending: false })
            .order('appointment_time', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            myAppointmentsList.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:2rem 1rem;"><i class="fa-solid fa-calendar-xmark" style="font-size:2rem;color:var(--text-muted);margin-bottom:0.5rem;display:block;"></i>Bu telefon numarasına ait aktif randevu bulunamadı.</div>';
            return;
        }

        myAppointmentsList.innerHTML = '';
        data.forEach(app => {
            const card = document.createElement('div');
            card.className = 'my-appointment-card';
            
            let statusText = 'Bekliyor', statusClass = 'pending';
            if (app.status === 'approved') { 
                statusText = 'Onaylandı'; 
                statusClass = 'approved'; 
            } else if (app.status === 'rejected') { 
                statusText = 'Reddedildi'; 
                statusClass = 'rejected'; 
            }
            
            card.innerHTML = `
                <div class="my-appointment-info">
                    <span class="my-appointment-service">${app.service_name}</span>
                    <span class="my-appointment-datetime">
                        <i class="fa-solid fa-calendar-day"></i> ${formatTurkishDate(app.appointment_date)} &nbsp;
                        <i class="fa-solid fa-clock"></i> ${formatTime(app.appointment_time)}
                    </span>
                </div>
                <div class="my-appointment-status">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
            `;
            myAppointmentsList.appendChild(card);
        });
    } catch (err) {
        console.error('Randevular sorgulanırken hata oluştu:', err);
        myAppointmentsList.innerHTML = '<div style="color:var(--color-error);text-align:center;padding:1rem;">Sorgulama yapılırken bir hata oluştu.</div>';
    }
}

// =============================================
// SALON STATUS BADGE (per barber)
// =============================================
async function updateSalonStatusBadge() {
    const statusBadge = document.getElementById('salon-status-badge');
    if (!statusBadge) return;
    try {
        let sq = supabase.from('settings').select('key, value').in('key', ['working_slots', 'weekly_holiday']);
        if (barberId) sq = sq.eq('user_id', barberId);
        const { data: sd, error: se } = await sq;
        if (se) throw se;
        const wss = sd.find(s => s.key === 'working_slots');
        const hs = sd.find(s => s.key === 'weekly_holiday');
        let wh = { start: '09:00', end: '22:00' };
        if (wss && wss.value) {
            if (Array.isArray(wss.value) && wss.value.length > 0) {
                const sorted = [...wss.value].sort();
                wh.start = sorted[0]; wh.end = sorted[sorted.length - 1];
            } else if (!Array.isArray(wss.value)) { wh = wss.value; }
        }
        const hd = hs ? hs.value : 'none';
        const now = new Date();
        if (hd !== 'none' && now.getDay().toString() === hd) {
            statusBadge.innerHTML = '<span class="status-pulse"></span> Salon: Kapali (Tatil Gunu)';
            statusBadge.className = 'salon-status-badge status-closed'; return;
        }
        if (!wh || !wh.start || !wh.end) {
            statusBadge.innerHTML = '<span class="status-pulse"></span> Salon: Kapali';
            statusBadge.className = 'salon-status-badge status-closed'; return;
        }
        const cur = now.getHours() * 60 + now.getMinutes();
        if (cur >= timeToMinutes(wh.start) && cur < timeToMinutes(wh.end)) {
            statusBadge.innerHTML = '<span class="status-pulse"></span> Salon: Acik';
            statusBadge.className = 'salon-status-badge status-open';
        } else {
            statusBadge.innerHTML = '<span class="status-pulse"></span> Salon: Kapali (Mesai Disi)';
            statusBadge.className = 'salon-status-badge status-closed';
        }
    } catch (err) {
        console.error('Salon durum gostergesi guncellenemedi:', err);
        statusBadge.innerHTML = '<span class="status-pulse"></span> Salon Durumu Bilinmiyor';
        statusBadge.className = 'salon-status-badge status-loading';
    }
}
