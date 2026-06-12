import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const ERROR_MAP = {
    'auth/invalid-email':          { en: 'Please enter a valid email address.', ar: 'الرجاء إدخال بريد إلكتروني صالح.' },
    'auth/user-not-found':         { en: 'No account found with this email.', ar: 'لا يوجد حساب مرتبط بهذا البريد.' },
    'auth/network-request-failed': { en: 'Network error. Check your connection.', ar: 'خطأ في الشبكة. تحقق من اتصالك.' },
    'auth/too-many-requests':      { en: 'Too many attempts. Please wait a few minutes.', ar: 'محاولات كثيرة. الرجاء الانتظار بضع دقائق.' },
    'auth/missing-email':          { en: 'Please enter an email address.', ar: 'الرجاء إدخال البريد الإلكتروني.' }
};
const FALLBACK_ERROR = { en: 'An unexpected error occurred.', ar: 'حدث خطأ غير متوقع.' };

function getLang() {
    return document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
}

function tr(code) {
    const lang = getLang();
    if (ERROR_MAP[code]) return ERROR_MAP[code][lang];
    if (code) return code;
    return FALLBACK_ERROR[lang];
}

function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');
}

function showFormError(formEl, code) {
    if (!formEl) return;
    const banner = formEl.querySelector('.form-error');
    if (!banner) return;
    banner.hidden = false;
    const textEl = banner.querySelector('.error-text');
    if (textEl) textEl.textContent = tr(code);
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    formEl.classList.remove('shake');
    void formEl.offsetWidth;
    formEl.classList.add('shake');
}

function clearFormError(formEl) {
    if (!formEl) return;
    const banner = formEl.querySelector('.form-error');
    if (banner) banner.hidden = true;
    formEl.classList.remove('shake');
}

function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = 'toast is-' + (type || 'info');
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.textContent = message;
    container.appendChild(t);
    setTimeout(() => {
        t.style.transition = 'opacity 0.25s ease';
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 250);
    }, 4000);
}

function setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('is-loading', !!loading);
    btn.disabled = !!loading;
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-forgot-password');
    const emailInput = document.getElementById('reset-email');

    if (!form) return;

    emailInput?.addEventListener('blur', () => {
        if (!emailInput.value) {
            emailInput.classList.remove('is-valid', 'is-invalid');
            return;
        }
        const ok = isValidEmail(emailInput.value);
        const lang = getLang();
        const msg = ok ? '' : (window.dictionary && window.dictionary.invalidEmail)
            ? window.dictionary.invalidEmail[lang]
            : (lang === 'ar' ? 'بريد غير صالح' : 'Invalid email');
        emailInput.classList.toggle('is-valid', ok);
        emailInput.classList.toggle('is-invalid', !ok);
        const hint = document.getElementById('reset-email-hint');
        if (hint) {
            hint.textContent = msg;
            hint.classList.toggle('is-error', !ok);
            hint.classList.toggle('is-ok', ok);
        }
    });

    emailInput?.addEventListener('input', () => {
        emailInput.classList.remove('is-valid', 'is-invalid');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormError(form);

        const email = emailInput?.value.trim();

        if (!email || !isValidEmail(email)) {
            showFormError(form, 'auth/invalid-email');
            emailInput?.focus();
            return;
        }

        const btn = document.getElementById('reset-submit-btn');
        setButtonLoading(btn, true);

        try {
            await sendPasswordResetEmail(auth, email);
            const lang = getLang();
            const tmpl = (window.dictionary && window.dictionary.resetLinkSent)
                ? window.dictionary.resetLinkSent[lang]
                : (lang === 'ar' ? `تم إرسال رابط إعادة التعيين إلى ${email}` : `Password reset link sent to ${email}`);
            showToast(tmpl.replace('{email}', email), 'success');
            setButtonLoading(btn, false);
            setTimeout(() => { window.location.href = 'index.html'; }, 3000);
        } catch (err) {
            console.error('Reset password error:', err);
            showFormError(form, err.code || 'auth/network-request-failed');
            setButtonLoading(btn, false);
        }
    });
});
