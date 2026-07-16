// SUPABASE CORE - Shared between customer and admin pages
// Supabase client initialization & common UI helpers

const SUPABASE_URL = "https://lrdapszncckjnbhmjwea.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZGFwc3puY2Nram5iaG1qd2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0OTA4NzYsImV4cCI6MjA5ODA2Njg3Nn0.zE3ZHtdujn1DYoWppYDW0jERNnrcQsYYfdnG6pnUE6g";

// Supabase Client Init
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// LocalStorage helpers for customer appointments
export function getSavedAppointmentIds() {
    try {
        const ids = localStorage.getItem('devber_appointments');
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
            localStorage.setItem('devber_appointments', JSON.stringify(ids));
        }
    } catch (e) {
        console.error('Error writing to localStorage', e);
    }
}
