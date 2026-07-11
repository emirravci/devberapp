import { supabase, showLoader, hideLoader, showToast, getSavedAppointmentIds, saveAppointmentId } from './supabase-core.js';

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

// "Randevularım" Modal elements
const btnMyAppointments = document.getElementById('btn-my-appointments');
const appointmentsModal = document.getElementById('appointments-modal');
const btnCloseAppointmentsModal = document.getElementById('btn-close-appointments-modal');
const myAppointmentsList = document.getElementById('my-appointments-list');

// Randevu Onay Modali elements
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

// Success view elements
const successView = document.getElementById('success-view');
const bookingView = document.getElementById('booking-view');
const successService = document.getElementById('success-service');
const successDate = document.getElementById('success-date');
const successTime = document.getElementById('success-time');
const successName = document.getElementById('success-name');
const btnSuccessBack = document.getElementById('btn-success-back');

// Module state variables
let selectedService = '';
let selectedPrice = 0;
let selectedDuration = 30;
let selectedDate = '';
let selectedTime = '';

// =============================================
// VIEW SWITCHING (Booking ↔ Success)
// =============================================
function showCustomerView(viewId) {
    [bookingView, successView].forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`${viewId}-view`);
    if (target) target.classList.add('active');
}

// =============================================
// SERVICES LOADING (DYNAMIC)
// =============================================
async function loadServices() {
    showLoader();
    try {
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .order('price', { ascending: true });

        if (error) throw error;

        renderServices(data || []);
    } catch (err) {
        console.error("Hizmetler yüklenemedi:", err);
        showToast("Hizmet listesi yüklenirken hata oluştu.", "error");
        servicesGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--color-error); padding: 1.5rem 0; font-weight: 600;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                Hizmet listesi alınamadı.
            </div>
        `;
    } finally {
        hideLoader();
    }
}

function renderServices(services) {
    servicesGrid.innerHTML = '';
    if (services.length === 0) {
        servicesGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 2rem 0;">
                Aktif hizmet bulunmamaktadır.
            </div>
        `;
        return;
    }

    services.forEach(service => {
        const card = document.createElement('div');
        card.className = 'service-card';
        card.setAttribute('data-service', service.name);
        card.setAttribute('data-price', service.price);
        card.setAttribute('data-duration', service.duration);

        const iconClass = service.icon || 'fa-scissors';

        card.innerHTML = `
            <div class="service-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="service-name">${service.name}</div>
            <div class="service-price">${service.price} ₺</div>
            <div class="service-duration"><i class="fa-regular fa-clock"></i> ${service.duration} dk</div>
            <div class="service-desc">${service.description || ''}</div>
        `;

        card.addEventListener('click', () => {
            servicesGrid.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedService = service.name;
            selectedPrice = parseFloat(service.price);
            selectedDuration = parseInt(service.duration || '30', 10);
            validateForm();
            // Automatically advance to Step 2
            setTimeout(() => goToStep(2), 220);
        });

        servicesGrid.appendChild(card);
    });
}

// =============================================
// INITIALIZATION
// =============================================
let currentStep = 1;

function goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 3) return;

    // Hide all steps, show current
    document.querySelectorAll('.wizard-step').forEach(step => {
        step.classList.remove('active');
    });
    const targetStep = document.getElementById(`step-${stepNumber}`);
    if (targetStep) targetStep.classList.add('active');

    // Update progress indicator
    const steps = document.querySelectorAll('.progress-step');
    steps.forEach(step => {
        const stepVal = parseInt(step.getAttribute('data-step'), 10);
        step.classList.remove('active', 'completed');
        if (stepVal === stepNumber) {
            step.classList.add('active');
        } else if (stepVal < stepNumber) {
            step.classList.add('completed');
        }
    });

    // Update progress line fill width
    const lineFill = document.getElementById('progress-line-fill');
    if (lineFill) {
        const percent = ((stepNumber - 1) / 2) * 100;
        lineFill.style.width = `${percent}%`;
    }

    currentStep = stepNumber;
}

function initBookingEvents() {
    // Load services from DB
    loadServices();
    // Update salon status open/closed badge
    updateSalonStatusBadge();

    // Min date (cannot select past dates) and Max date (max 30 days ahead)
    const todayObj = new Date();
    const today = todayObj.toLocaleDateString('en-CA');
    bookingDateInput.min = today;

    const maxDateObj = new Date();
    maxDateObj.setDate(todayObj.getDate() + 30);
    const maxDate = maxDateObj.toLocaleDateString('en-CA');
    bookingDateInput.max = maxDate;

    // Date change
    bookingDateInput.addEventListener('change', async (e) => {
        selectedDate = e.target.value;
        selectedTime = '';
        validateForm();
        if (selectedDate) {
            await loadAvailableTimeSlots(selectedDate);
        } else {
            bookingSlotsContainer.style.display = 'none';
        }
    });

    // Input validation
    customerNameInput.addEventListener('input', validateForm);

    // Phone formatting mask
    customerPhoneInput.addEventListener('input', (e) => {
        let val = e.target.value;
        let digits = val.replace(/\D/g, '');
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

    // Form submit -> open confirmation modal first
    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        openConfirmModal();
    });

    // Confirm Modal events
    btnCloseConfirmModal.addEventListener('click', () => confirmModal.classList.remove('active'));
    btnCancelConfirm.addEventListener('click', () => confirmModal.classList.remove('active'));
    btnFinalConfirm.addEventListener('click', handleBookingSubmit);

    // Wizard navigation buttons
    document.getElementById('btn-next-to-2').addEventListener('click', () => goToStep(2));
    document.getElementById('btn-back-to-1').addEventListener('click', () => goToStep(1));
    document.getElementById('btn-next-to-3').addEventListener('click', () => goToStep(3));
    document.getElementById('btn-back-to-2').addEventListener('click', () => goToStep(2));

    // Wizard step indicators clicks
    document.querySelectorAll('.progress-step').forEach(step => {
        step.addEventListener('click', () => {
            const stepVal = parseInt(step.getAttribute('data-step'), 10);
            if (stepVal === 1) {
                goToStep(1);
            } else if (stepVal === 2 && selectedService) {
                goToStep(2);
            } else if (stepVal === 3 && selectedService && selectedDate && selectedTime) {
                goToStep(3);
            }
        });
    });

    // My appointments modal
    btnMyAppointments.addEventListener('click', openAppointmentsModal);
    btnCloseAppointmentsModal.addEventListener('click', () => appointmentsModal.classList.remove('active'));
    appointmentsModal.addEventListener('click', (e) => {
        if (e.target === appointmentsModal) appointmentsModal.classList.remove('active');
    });

    // Success back button
    btnSuccessBack.addEventListener('click', () => {
        resetBookingState();
        showCustomerView('booking');
    });
}

function openConfirmModal() {
    confirmService.innerText = selectedService;
    confirmDurationPrice.innerText = `${selectedDuration} dk / ${selectedPrice} ₺`;
    confirmDate.innerText = formatTurkishDate(selectedDate);
    confirmTime.innerText = selectedTime;
    confirmName.innerText = customerNameInput.value.trim();
    confirmPhone.innerText = customerPhoneInput.value.trim();
    confirmModal.classList.add('active');
}

initBookingEvents();

// =============================================
// FORM STATE
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
    const customerPhoneDigits = customerPhoneInput.value.replace(/\D/g, '');
    const isPhoneValid = customerPhoneDigits.length === 10 || customerPhoneDigits.length === 11;

    // Enable/disable Wizard navigation buttons
    const btnNextTo2 = document.getElementById('btn-next-to-2');
    const btnNextTo3 = document.getElementById('btn-next-to-3');

    if (btnNextTo2) btnNextTo2.disabled = !selectedService;
    if (btnNextTo3) btnNextTo3.disabled = !(selectedService && selectedDate && selectedTime);

    const isValid = selectedService && selectedDate && selectedTime && customerName && isPhoneValid;
    btnBook.disabled = !isValid;
}

// =============================================
// TIME SLOTS
// =============================================
// Time conversion helper functions
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return h * 60 + m;
}

function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// =============================================
// TIME SLOTS
// =============================================
async function loadAvailableTimeSlots(dateString) {
    showLoader();
    try {
        const { data: settingsData, error: settingsError } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['working_slots', 'weekly_holiday', 'slot_strategy', 'break_hours']);

        if (settingsError) throw settingsError;

        const workingSlotsSetting = settingsData.find(s => s.key === 'working_slots');
        const holidaySetting = settingsData.find(s => s.key === 'weekly_holiday');
        const strategySetting = settingsData.find(s => s.key === 'slot_strategy');
        const breakSetting = settingsData.find(s => s.key === 'break_hours');

        const activeSlots = workingSlotsSetting ? workingSlotsSetting.value : [
            "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
        ];
        const holidayDay = holidaySetting ? holidaySetting.value : 'none';
        const slotStrategy = strategySetting ? strategySetting.value : 'half_hourly';
        const breakHours = breakSetting ? breakSetting.value : null;

        // Check holiday
        if (holidayDay !== 'none') {
            const [year, month, day] = dateString.split('-').map(Number);
            const selectedDateObj = new Date(year, month - 1, day);
            const selectedDay = selectedDateObj.getDay();
            if (selectedDay.toString() === holidayDay) {
                renderHolidayMessage(holidayDay);
                return;
            }
        }

        // Fetch booked times and their durations
        const { data: bookedData, error: bookedError } = await supabase
            .from('appointments')
            .select('appointment_time, service_duration')
            .eq('appointment_date', dateString)
            .neq('status', 'rejected');

        renderTimeSlots(activeSlots, bookedData || [], dateString, slotStrategy, breakHours);
    } catch (err) {
        console.error("Randevu saatleri yüklenemedi:", err);
        showToast("Randevu saatleri yüklenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

function renderTimeSlots(activeSlots, bookedAppointments, dateString, slotStrategy, breakHours) {
    bookingSlotsGrid.innerHTML = '';
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const isTodaySelected = (dateString === todayStr);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (activeSlots.length === 0) {
        bookingSlotsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); font-size: 0.9rem; padding: 1rem 0;">
                Berber aktif çalışma saati tanımlamamış.
            </div>
        `;
        bookingSlotsContainer.style.display = 'block';
        return;
    }

    let slotsToShow = [];

    if (slotStrategy === 'hourly') {
        slotsToShow = activeSlots.filter(slot => slot.endsWith(':00'));
    } else if (slotStrategy === 'half_hourly') {
        slotsToShow = activeSlots.filter(slot => slot.endsWith(':00') || slot.endsWith(':30'));
    } else if (slotStrategy === 'service_based') {
        const sortedActive = [...activeSlots].sort();
        const startMin = timeToMinutes(sortedActive[0]);
        const endMin = timeToMinutes(sortedActive[sortedActive.length - 1]);
        
        // Dynamic slots generated every 15 mins up to closing time minus chosen service duration
        // We allow starting up to 1 hour before the closing slot to make it flexible
        const maxStartMin = endMin + 60 - selectedDuration;

        for (let m = startMin; m <= maxStartMin; m += 15) {
            slotsToShow.push(minutesToTime(m));
        }
    } else {
        slotsToShow = activeSlots;
    }

    if (slotsToShow.length === 0) {
        bookingSlotsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); font-size: 0.9rem; padding: 1rem 0;">
                Seçilen hizmet süresi için uygun saat aralığı bulunamadı.
            </div>
        `;
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
            const [slotHour, slotMin] = slot.split(':').map(Number);
            if (slotHour < currentHour || (slotHour === currentHour && slotMin <= currentMinute)) {
                isPastTime = true;
            }
        }

        // Check if overlaps with break hours
        let isBreak = false;
        if (breakHours && breakHours.start && breakHours.end) {
            const slotStart = timeToMinutes(slot);
            const slotEnd = slotStart + (slotStrategy === 'service_based' ? selectedDuration : 30);
            const breakStart = timeToMinutes(breakHours.start);
            const breakEnd = timeToMinutes(breakHours.end);

            if (slotStart < breakEnd && slotEnd > breakStart) {
                isBreak = true;
            }
        }

        let isBooked = false;

        if (slotStrategy === 'service_based') {
            const slotStart = timeToMinutes(slot);
            const slotEnd = slotStart + selectedDuration;

            isBooked = bookedAppointments.some(app => {
                const appStart = timeToMinutes(app.appointment_time);
                const appDur = app.service_duration || 30; // fallback to 30 mins
                const appEnd = appStart + appDur;

                // Overlap check
                return (slotStart < appEnd && slotEnd > appStart);
            });
        } else {
            const formattedSlot = formatTime(slot);
            isBooked = bookedAppointments.some(app => formatTime(app.appointment_time) === formattedSlot);
        }

        if (isBooked || isPastTime || isBreak) {
            btn.disabled = true;
            btn.title = isBooked ? "Dolu" : (isBreak ? "Mola / Yemek Saati" : "Geçmiş Saat");
        }

        btn.addEventListener('click', () => {
            bookingSlotsGrid.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTime = slot;
            validateForm();
            // Auto transition to step 3
            setTimeout(() => goToStep(3), 220);
        });

        bookingSlotsGrid.appendChild(btn);
    });

    bookingSlotsContainer.style.display = 'block';
}

function renderHolidayMessage(holidayDayNum) {
    const daysTurkish = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const holidayName = daysTurkish[holidayDayNum] || "Tatil Günü";

    bookingSlotsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--color-error); font-weight: 600; padding: 1.5rem 0; font-size: 0.95rem;">
            <i class="fa-solid fa-mug-hot" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; color: var(--accent-gold);"></i>
            Salonumuz ${holidayName} günleri kapalıdır.
        </div>
    `;
    bookingSlotsContainer.style.display = 'block';
}

// =============================================
// FORMAT DATE & TIME
// =============================================
function formatTurkishDate(dateStr) {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
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
// BOOKING SUBMIT
// =============================================
async function handleBookingSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    confirmModal.classList.remove('active');
    const customerName = customerNameInput.value.trim();
    const customerPhone = customerPhoneInput.value.trim();
    const notes = customerNotesInput.value.trim();
    const customerPhoneDigits = customerPhone.replace(/\D/g, '');

    if (!selectedService || !selectedDate || !selectedTime || !customerName || (customerPhoneDigits.length !== 10 && customerPhoneDigits.length !== 11)) {
        showToast("Lütfen tüm zorunlu alanları doğru doldurun!", "error");
        return;
    }

    showLoader();
    try {
        const { data: insertedData, error } = await supabase
            .from('appointments')
            .insert({
                customer_name: customerName,
                customer_phone: customerPhone,
                service_name: selectedService,
                service_duration: selectedDuration,
                appointment_date: selectedDate,
                appointment_time: selectedTime,
                status: 'pending',
                notes: notes
            })
            .select()
            .single();

        if (error) throw error;

        if (insertedData && insertedData.id) saveAppointmentId(insertedData.id);

        successService.innerText = `${selectedService} (${selectedPrice} ₺)`;
        successDate.innerText = formatTurkishDate(selectedDate);
        successTime.innerText = selectedTime;
        successName.innerText = customerName;

        setupCalendarLinks(selectedService, selectedDate, selectedTime, selectedDuration);

        showToast("Randevunuz başarıyla alındı!", "success");
        showCustomerView('success');
    } catch (err) {
        console.error("Randevu kaydetme hatası:", err);
        showToast("Randevu kaydedilirken bir hata oluştu.", "error");
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

    const formatISO = (date) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    };

    const startStr = formatISO(startDate);
    const endStr = formatISO(endDate);

    const title = encodeURIComponent(`Saloon Gold Randevu - ${service}`);
    const details = encodeURIComponent(`Saloon Gold adresindeki ${service} randevunuz. Süre: ${durationMinutes} dk. Lütfen randevu saatinden 5 dakika önce salonda olunuz.`);
    const location = encodeURIComponent("Saloon Gold, İstanbul");

    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
    googleBtn.href = googleUrl;

    appleBtn.onclick = () => {
        const icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Saloon Gold//Barber Appointment//EN",
            "BEGIN:VEVENT",
            `UID:${Date.now()}@saloon.gold`,
            `DTSTAMP:${formatISO(new Date())}Z`,
            `DTSTART:${startStr}`,
            `DTEND:${endStr}`,
            `SUMMARY:Saloon Gold - ${service}`,
            `DESCRIPTION:${service} randevunuz. Süre: ${durationMinutes} dk.`,
            `LOCATION:Saloon Gold`,
            "END:VEVENT",
            "END:VCALENDAR"
        ].join("\r\n");

        const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `saloon_gold_randevu.ics`;
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
    myAppointmentsList.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 1rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Yükleniyor...</div>';

    const savedIds = getSavedAppointmentIds();
    if (savedIds.length === 0) {
        myAppointmentsList.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 2rem 1rem;">
                <i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block;"></i>
                Henüz kayıtlı bir randevunuz bulunmamaktadır.
            </div>
        `;
        return;
    }

    try {
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .in('id', savedIds)
            .order('appointment_date', { ascending: false })
            .order('appointment_time', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            myAppointmentsList.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 2rem 1rem;">
                    <i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block;"></i>
                    Kayıtlı randevularınız bulunamadı veya silinmiş.
                </div>
            `;
            return;
        }

        myAppointmentsList.innerHTML = '';
        data.forEach(app => {
            const card = document.createElement('div');
            card.className = 'my-appointment-card';

            let statusText = 'Bekliyor';
            let statusClass = 'pending';
            if (app.status === 'approved') { statusText = 'Onaylandı'; statusClass = 'approved'; }
            else if (app.status === 'rejected') { statusText = 'Reddedildi'; statusClass = 'rejected'; }

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
        console.error("Randevular yüklenirken hata oluştu:", err);
        myAppointmentsList.innerHTML = '<div style="color: var(--color-error); text-align: center; padding: 1rem;">Randevular yüklenirken bir hata oluştu.</div>';
    }
}

async function updateSalonStatusBadge() {
    const statusBadge = document.getElementById('salon-status-badge');
    if (!statusBadge) return;

    try {
        const { data: settingsData, error: settingsError } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['working_slots', 'weekly_holiday']);

        if (settingsError) throw settingsError;

        const workingSlotsSetting = settingsData.find(s => s.key === 'working_slots');
        const holidaySetting = settingsData.find(s => s.key === 'weekly_holiday');

        const activeSlots = workingSlotsSetting ? workingSlotsSetting.value : [];
        const holidayDay = holidaySetting ? holidaySetting.value : 'none';

        const now = new Date();
        const currentDayNum = now.getDay(); // 0: Pazar, 1: Pazartesi...
        
        // Check if holiday
        if (holidayDay !== 'none' && currentDayNum.toString() === holidayDay) {
            statusBadge.innerText = "Salon: Kapalı (Tatil Günü)";
            statusBadge.className = "salon-status-badge status-closed";
            return;
        }

        if (activeSlots.length === 0) {
            statusBadge.innerText = "Salon: Kapalı";
            statusBadge.className = "salon-status-badge status-closed";
            return;
        }

        // Sort slots to get start/end time
        const sortedSlots = [...activeSlots].sort();
        const firstSlot = sortedSlots[0];
        const lastSlot = sortedSlots[sortedSlots.length - 1];

        const currentHour = now.getHours();
        const currentMin = now.getMinutes();

        const [startHour, startMin] = firstSlot.split(':').map(Number);
        const [endHour, endMin] = lastSlot.split(':').map(Number);

        const startTimeVal = startHour * 60 + startMin;
        const endTimeVal = (endHour + 1) * 60; // 1 hour after the last slot starts
        const currentTimeVal = currentHour * 60 + currentMin;

        if (currentTimeVal >= startTimeVal && currentTimeVal < endTimeVal) {
            statusBadge.innerText = "Salon: Açık";
            statusBadge.className = "salon-status-badge status-open";
        } else {
            statusBadge.innerText = "Salon: Kapalı (Mesai Dışı)";
            statusBadge.className = "salon-status-badge status-closed";
        }
    } catch (err) {
        console.error("Salon durum göstergesi güncellenemedi:", err);
        statusBadge.innerText = "Salon Durumu Bilinmiyor";
        statusBadge.className = "salon-status-badge status-loading";
    }
}
