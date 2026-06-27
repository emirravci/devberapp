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
// INITIALIZATION
// =============================================
function initBookingEvents() {
    // Min date (cannot select past dates)
    const today = new Date().toLocaleDateString('en-CA');
    bookingDateInput.min = today;

    // Service cards
    const cards = servicesGrid.querySelectorAll('.service-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedService = card.getAttribute('data-service');
            selectedPrice = parseFloat(card.getAttribute('data-price'));
            selectedDuration = parseInt(card.getAttribute('data-duration') || '30', 10);
            validateForm();
        });
    });

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

    // Form submit
    bookingForm.addEventListener('submit', handleBookingSubmit);

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
    btnBook.disabled = true;
}

function validateForm() {
    const customerName = customerNameInput.value.trim();
    const customerPhoneDigits = customerPhoneInput.value.replace(/\D/g, '');
    const isPhoneValid = customerPhoneDigits.length === 10 || customerPhoneDigits.length === 11;
    const isValid = selectedService && selectedDate && selectedTime && customerName && isPhoneValid;
    btnBook.disabled = !isValid;
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
            .in('key', ['working_slots', 'weekly_holiday']);

        if (settingsError) throw settingsError;

        const workingSlotsSetting = settingsData.find(s => s.key === 'working_slots');
        const holidaySetting = settingsData.find(s => s.key === 'weekly_holiday');

        const activeSlots = workingSlotsSetting ? workingSlotsSetting.value : [
            "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
        ];
        const holidayDay = holidaySetting ? holidaySetting.value : 'none';

        // Check holiday
        if (holidayDay !== 'none') {
            const selectedDateObj = new Date(dateString);
            const selectedDay = selectedDateObj.getDay();
            if (selectedDay.toString() === holidayDay) {
                renderHolidayMessage(holidayDay);
                return;
            }
        }

        // Fetch booked times
        const { data: bookedData, error: bookedError } = await supabase
            .from('appointments')
            .select('appointment_time')
            .eq('appointment_date', dateString)
            .neq('status', 'rejected');

        const bookedTimes = (bookedData || []).map(app => {
            const time = app.appointment_time;
            if (time && time.includes(':')) {
                const parts = time.split(':');
                if (parts.length >= 2) {
                    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                }
            }
            return time;
        });

        renderTimeSlots(activeSlots, bookedTimes, dateString);
    } catch (err) {
        console.error("Randevu saatleri yüklenemedi:", err);
        showToast("Randevu saatleri yüklenirken hata oluştu.", "error");
    } finally {
        hideLoader();
    }
}

function renderTimeSlots(activeSlots, bookedTimes, dateString) {
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

    activeSlots.forEach(slot => {
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

        const isBooked = bookedTimes.includes(slot);

        if (isBooked || isPastTime) {
            btn.disabled = true;
            btn.title = isBooked ? "Dolu" : "Geçmiş Saat";
        }

        btn.addEventListener('click', () => {
            bookingSlotsGrid.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTime = slot;
            validateForm();
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
    e.preventDefault();
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
