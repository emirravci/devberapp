// SUPABASE INITIALIZATION & COMMON UI HELPERS

// WARNING: Bu bilgileri kendi Supabase projenizden aldığınız bilgilerle güncelleyin.
// Bilgileri nasıl alacağınızı öğrenmek için SUPABASE_SETUP.md dosyasını okuyabilirsiniz.
const SUPABASE_URL = "https://lrdapszncckjnbhmjwea.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZGFwc3puY2Nram5iaG1qd2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0OTA4NzYsImV4cCI6MjA5ODA2Njg3Nn0.zE3ZHtdujn1DYoWppYDW0jERNnrcQsYYfdnG6pnUE6g";

if (SUPABASE_URL === "YOUR_BARBER_SUPABASE_URL" || SUPABASE_ANON_KEY === "YOUR_BARBER_SUPABASE_ANON_KEY") {
    console.warn("Lütfen js/supabase.js dosyasındaki SUPABASE_URL ve SUPABASE_ANON_KEY değerlerini güncelleyin!");
}

// Supabase Client Init
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Navigation Elements
const bookingView = document.getElementById('booking-view');
const successView = document.getElementById('success-view');
const adminLoginView = document.getElementById('admin-login-view');
const adminDashboardView = document.getElementById('admin-dashboard-view');

const btnAdminLoginLink = document.getElementById('btn-admin-login-link');
const btnAdminLoginCancel = document.getElementById('btn-admin-login-cancel');
const btnSuccessBack = document.getElementById('btn-success-back');

// Admin panel tabs elements
const tabRandevular = document.getElementById('tab-randevular');
const tabCalismaSaatleri = document.getElementById('tab-calisma-saatleri');
const adminAppointmentsPanel = document.getElementById('admin-appointments-panel');
const adminSchedulerPanel = document.getElementById('admin-scheduler-panel');

// Global UI Controllers
export function showLoader() {
    document.getElementById('global-loader').classList.add('active');
}

export function hideLoader() {
    document.getElementById('global-loader').classList.remove('active');
}

// Toast Notifications
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-triangle-exclamation';
    
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    const removeToast = () => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    };
    
    const timeoutId = setTimeout(removeToast, 4000);
    
    toast.addEventListener('click', () => {
        clearTimeout(timeoutId);
        removeToast();
    });
}

// View switching Router (SPA)
export function showView(viewId, extraData = null) {
    // Hide all
    [bookingView, successView, adminLoginView, adminDashboardView].forEach(view => {
        view.classList.remove('active');
    });
    
    // Show requested
    const target = document.getElementById(`${viewId}-view`);
    if (target) {
        target.classList.add('active');
    }
    
    // Dispatch lifecycle events to modules
    const eventName = `view-${viewId}-loaded`;
    const event = new CustomEvent(eventName, { detail: extraData });
    document.dispatchEvent(event);
}

// Setup common navigation event listeners
function initNavigationEvents() {
    // Link to admin login
    btnAdminLoginLink.addEventListener('click', async () => {
        // Check if already authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            showView('admin-dashboard');
        } else {
            showView('admin-login');
        }
    });

    // Cancel admin login
    btnAdminLoginCancel.addEventListener('click', () => {
        showView('booking');
    });

    // Go back after successful booking
    btnSuccessBack.addEventListener('click', () => {
        showView('booking');
    });

    // Admin Dashboard Tabs toggle
    tabRandevular.addEventListener('click', () => {
        tabRandevular.classList.add('active');
        tabCalismaSaatleri.classList.remove('active');
        adminAppointmentsPanel.style.display = 'block';
        adminSchedulerPanel.style.display = 'none';
    });

    tabCalismaSaatleri.addEventListener('click', () => {
        tabCalismaSaatleri.classList.add('active');
        tabRandevular.classList.remove('active');
        adminSchedulerPanel.style.display = 'block';
        adminAppointmentsPanel.style.display = 'none';
        
        // Dispatch load event specifically for working hours config
        document.dispatchEvent(new CustomEvent('admin-scheduler-loaded'));
    });
}

initNavigationEvents();

// Global Auth State Change Listener
supabase.auth.onAuthStateChange((event, session) => {
    const adminUsername = document.getElementById('admin-username');
    
    if (session && session.user) {
        // Logged in
        if (adminUsername) adminUsername.innerText = session.user.email;
        
        // If current view is login screen, automatically show dashboard
        if (adminLoginView.classList.contains('active')) {
            showView('admin-dashboard');
        }
    } else {
        // Logged out
        if (adminUsername) adminUsername.innerText = '';
        
        // If currently inside admin dashboard, kick back to booking screen
        if (adminDashboardView.classList.contains('active')) {
            showView('booking');
        }
    }
});

// LocalStorage helpers for customer appointments
export function getSavedAppointmentIds() {
    try {
        const ids = localStorage.getItem('saloon_gold_appointments');
        return ids ? JSON.parse(ids) : [];
    } catch (e) {
        console.error('Error reading localStorage', e);
        return [];
    }
}

export function saveAppointmentId(id) {
    try {
        const ids = getSavedAppointmentIds();
        if (!ids.includes(id)) {
            ids.push(id);
            localStorage.setItem('saloon_gold_appointments', JSON.stringify(ids));
        }
    } catch (e) {
        console.error('Error writing to localStorage', e);
    }
}
