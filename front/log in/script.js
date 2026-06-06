import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB1P0Wk6ICLDxBoStHL0dboD8z7_0yhNXg",
    authDomain: "dia-care-86f57.firebaseapp.com",
    projectId: "dia-care-86f57",
    storageBucket: "dia-care-86f57.firebasestorage.app",
    messagingSenderId: "192885531387",
    appId: "1:192885531387:web:1ba384d658d1a0ea3f465e",
    measurementId: "G-3BBW3L00FP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('DiaCare script loaded!');

// ==========================================
// DiaCare Integrated Local Database (JSON)
// ==========================================
window.DiaCareDB = {
    init: function () {
        if (!localStorage.getItem('db_glucose')) localStorage.setItem('db_glucose', JSON.stringify([]));
        if (!localStorage.getItem('db_weight')) localStorage.setItem('db_weight', JSON.stringify([]));
        if (!localStorage.getItem('db_meals')) localStorage.setItem('db_meals', JSON.stringify([]));
    },
    addLog: async function (table, data) {
        let records = JSON.parse(localStorage.getItem(table) || '[]');
        data.timestamp = new Date().toISOString(); // حفظ التاريخ والوقت بدقة
        records.push(data);
        localStorage.setItem(table, JSON.stringify(records));

        // الحفظ في Firebase Firestore إذا كان المستخدم مسجلاً
        if (auth && auth.currentUser) {
            try {
                await addDoc(collection(db, `users/${auth.currentUser.uid}/${table}`), data);
            } catch (e) {
                console.error("Error adding document to Firebase: ", e);
            }
        }
        return true;
    },
    getLogs: function (table) {
        return JSON.parse(localStorage.getItem(table) || '[]');
    },
    syncLogs: async function (table) {
        // جلب السجلات من Firebase لتحديث LocalStorage
        if (auth && auth.currentUser) {
            try {
                const querySnapshot = await getDocs(collection(db, `users/${auth.currentUser.uid}/${table}`));
                let records = [];
                querySnapshot.forEach((docSnap) => {
                    records.push(docSnap.data());
                });
                if (records.length > 0) {
                    localStorage.setItem(table, JSON.stringify(records));
                }
            } catch (e) {
                console.error("Error syncing documents from Firebase: ", e);
            }
        }
    },
    updateProfile: async function (fname, type) {
        if (auth && auth.currentUser) {
            try {
                await setDoc(doc(db, "users", auth.currentUser.uid), {
                    fname: fname,
                    type: type
                }, { merge: true });
            } catch (e) {
                console.error("Error updating profile in Firebase: ", e);
            }
        }
    },
    logout: async function () {
        if (auth) {
            await signOut(auth);
        }
        localStorage.removeItem('diacare_user_fname');
        localStorage.removeItem('diacare_diabetes_type');
        localStorage.removeItem('diacare_user_email');
        localStorage.removeItem('db_glucose');
        localStorage.removeItem('db_weight');
        localStorage.removeItem('db_meals');
        localStorage.removeItem('diacare_chat_history');
    }
};
window.DiaCareDB.init();

// مراقبة حالة تسجيل الدخول وتحديث البيانات من Firebase بشكل دائم
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            localStorage.setItem('diacare_user_fname', userData.fname);
            localStorage.setItem('diacare_diabetes_type', userData.type);
            document.dispatchEvent(new Event('userDataLoaded'));
        }
        await window.DiaCareDB.syncLogs('db_glucose');
        await window.DiaCareDB.syncLogs('db_weight');
        await window.DiaCareDB.syncLogs('db_meals');
        document.dispatchEvent(new Event('logsSynced'));
    }
});

window.switchTab = function (tab) {
    // Get elements
    const loginBtn = document.getElementById('tab-login');
    const signupBtn = document.getElementById('tab-signup');
    const loginForm = document.getElementById('form-login');
    const signupForm = document.getElementById('form-signup');

    if (tab === 'login') {
        // Update tabs
        loginBtn.classList.add('active');
        signupBtn.classList.remove('active');

        // Update forms
        loginForm.classList.remove('form-hidden');
        loginForm.classList.add('form-active');
        signupForm.classList.remove('form-active');
        signupForm.classList.add('form-hidden');
    } else {
        // Update tabs
        signupBtn.classList.add('active');
        loginBtn.classList.remove('active');

        // Update forms
        signupForm.classList.remove('form-hidden');
        signupForm.classList.add('form-active');
        loginForm.classList.remove('form-active');
        loginForm.classList.add('form-hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- ميزة الدخول التلقائي: تخطي صفحة التسجيل إذا كان المستخدم مسجلاً ---
    /* تم تعطيل الدخول التلقائي مؤقتاً لتطوير صفحة الدخول
    // const isLoggedIn = localStorage.getItem('diacare_user_fname');
    // const currentPage = window.location.pathname.toLowerCase();
    // const isIndexPage = currentPage.endsWith('index.html') || currentPage.endsWith('/') || !currentPage.includes('.html');
    // if (isLoggedIn && isIndexPage) {
    //     window.location.href = 'dashboard.html';
    //     return;
    // }
    */

    // ==========================================
    // Auth-page helpers (UI feedback, validation)
    // ==========================================
    const ERROR_MAP = {
        'auth/invalid-credential':     { en: 'Email or password is incorrect.', ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' },
        'auth/user-not-found':         { en: 'No account found with this email.', ar: 'لا يوجد حساب مرتبط بهذا البريد.' },
        'auth/wrong-password':         { en: 'Incorrect password.', ar: 'كلمة المرور غير صحيحة.' },
        'auth/invalid-email':          { en: 'Please enter a valid email address.', ar: 'الرجاء إدخال بريد إلكتروني صالح.' },
        'auth/email-already-in-use':   { en: 'An account with this email already exists. Try logging in.', ar: 'يوجد حساب مرتبط بهذا البريد. جرّب تسجيل الدخول.' },
        'auth/weak-password':          { en: 'Password must be at least 8 characters.', ar: 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.' },
        'auth/too-many-requests':      { en: 'Too many attempts. Please wait a few minutes.', ar: 'محاولات كثيرة. الرجاء الانتظار بضع دقائق.' },
        'auth/network-request-failed': { en: 'Network error. Check your connection.', ar: 'خطأ في الشبكة. تحقق من اتصالك.' },
        'auth/popup-closed-by-user':   { en: 'Google sign-in was cancelled.', ar: 'تم إلغاء تسجيل الدخول عبر Google.' },
        'auth/operation-not-allowed':  { en: 'Google sign-in is not enabled. Please contact support.', ar: 'تسجيل الدخول عبر Google غير مفعّل. الرجاء التواصل مع الدعم.' }
    };
    const FALLBACK_ERROR = { en: 'An unexpected error occurred.', ar: 'حدث خطأ غير متوقع.' };

    function getLang() {
        return document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
    }
    function tr(messageOrKey) {
        // Accepts either a plain string or a key from ERROR_MAP
        const lang = getLang();
        if (ERROR_MAP[messageOrKey]) return ERROR_MAP[messageOrKey][lang];
        if (messageOrKey) return messageOrKey;
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
        // Force reflow to restart the animation
        void formEl.offsetWidth;
        formEl.classList.add('shake');
    }
    function clearFormError(formEl) {
        if (!formEl) return;
        const banner = formEl.querySelector('.form-error');
        if (banner) banner.hidden = true;
        formEl.classList.remove('shake');
    }
    function setFieldState(input, ok, message) {
        if (!input) return;
        input.classList.toggle('is-valid', !!ok);
        input.classList.toggle('is-invalid', !ok);
        const hint = input.parentElement.parentElement?.querySelector('.field-hint')
            || input.parentElement?.querySelector('.field-hint')
            || null;
        if (hint) {
            hint.textContent = message || '';
            hint.classList.toggle('is-error', !ok);
            hint.classList.toggle('is-ok', !!ok);
        }
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

    // ==========================================
    // Tab keyboard navigation (WAI-ARIA tabs)
    // ==========================================
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    function activateTab(tab) {
        const isLogin = tab === tabLogin;
        [tabLogin, tabSignup].forEach(t => {
            t.classList.toggle('active', t === tab);
            t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
            t.setAttribute('tabindex', t === tab ? '0' : '-1');
        });
        document.getElementById('form-login').classList.toggle('form-hidden', !isLogin);
        document.getElementById('form-login').classList.toggle('form-active', isLogin);
        document.getElementById('form-signup').classList.toggle('form-hidden', isLogin);
        document.getElementById('form-signup').classList.toggle('form-active', !isLogin);
        if (isLogin) {
            document.getElementById('login-email').focus();
        } else {
            document.getElementById('signup-fname').focus();
        }
    }
    [tabLogin, tabSignup].forEach(tab => {
        if (!tab) return;
        tab.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                activateTab(tab === tabLogin ? tabSignup : tabLogin);
            } else if (e.key === 'Home') {
                e.preventDefault();
                activateTab(tabLogin);
            } else if (e.key === 'End') {
                e.preventDefault();
                activateTab(tabSignup);
            }
        });
    });

    // ==========================================
    // Password show/hide toggles
    // ==========================================
    document.querySelectorAll('.toggle-pw').forEach(btn => {
        btn.addEventListener('click', () => {
            const wrapper = btn.closest('.password-wrapper');
            const input = wrapper?.querySelector('input');
            if (!input) return;
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            btn.setAttribute('aria-pressed', showing ? 'false' : 'true');
            const lang = getLang();
            const key = showing ? 'ariaShowPassword' : 'ariaHidePassword';
            if (window.dictionary && window.dictionary[key]) {
                btn.setAttribute('aria-label', window.dictionary[key][lang]);
            }
            const icon = btn.querySelector('i');
            if (icon) icon.className = showing ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    });

    // ==========================================
    // Password strength meter
    // ==========================================
    const signupPassword = document.getElementById('signup-password');
    const strengthBar = document.getElementById('strength-bar');
    const strengthLabel = document.getElementById('strength-label');
    function computeStrength(v) {
        let score = 0;
        if (v.length >= 8) score++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
        if (/\d/.test(v) || /[^A-Za-z0-9]/.test(v)) score++;
        return score;
    }
    function refreshStrength() {
        if (!signupPassword || !strengthBar || !strengthLabel) return;
        const v = signupPassword.value;
        if (!v) {
            strengthBar.className = 'strength-bar';
            strengthLabel.textContent = '';
            return;
        }
        const score = computeStrength(v);
        const lang = getLang();
        let cls = 'weak', key = 'strengthWeak';
        if (score === 2) { cls = 'fair'; key = 'strengthFair'; }
        else if (score >= 3) { cls = 'strong'; key = 'strengthStrong'; }
        strengthBar.className = 'strength-bar ' + cls;
        strengthLabel.textContent = (window.dictionary && window.dictionary[key])
            ? window.dictionary[key][lang]
            : (lang === 'ar' ? 'قوة كلمة المرور' : 'Strength');
    }
    signupPassword?.addEventListener('input', refreshStrength);

    // ==========================================
    // Confirm-password match check
    // ==========================================
    const signupConfirm = document.getElementById('signup-password-confirm');
    function refreshConfirm() {
        if (!signupConfirm || !signupPassword) return;
        if (!signupConfirm.value) {
            signupConfirm.classList.remove('is-valid', 'is-invalid');
            return;
        }
        const ok = signupConfirm.value === signupPassword.value;
        const lang = getLang();
        const msg = window.dictionary && window.dictionary.passwordMismatch
            ? window.dictionary.passwordMismatch[lang]
            : (lang === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
        setFieldState(signupConfirm, ok, ok ? '' : msg);
    }
    signupConfirm?.addEventListener('input', refreshConfirm);
    signupPassword?.addEventListener('input', refreshConfirm);

    // ==========================================
    // Real-time email validation
    // ==========================================
    ['login-email', 'signup-email'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('blur', () => {
            const ok = isValidEmail(el.value);
            if (!el.value) {
                el.classList.remove('is-valid', 'is-invalid');
                return;
            }
            const lang = getLang();
            const msg = ok ? '' : (window.dictionary && window.dictionary.invalidEmail)
                ? window.dictionary.invalidEmail[lang]
                : (lang === 'ar' ? 'بريد غير صالح' : 'Invalid email');
            setFieldState(el, ok, msg);
        });
        el.addEventListener('input', () => {
            el.classList.remove('is-valid', 'is-invalid');
        });
    });

    // ==========================================
    // Forgot password (inline, sends reset email)
    // ==========================================
    const forgotLink = document.getElementById('forgot-password');
    const loginFormEl = document.getElementById('form-login');
    forgotLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearFormError(loginFormEl);
        const emailEl = document.getElementById('login-email');
        const email = (emailEl?.value || '').trim();
        if (!isValidEmail(email)) {
            showFormError(loginFormEl, 'auth/invalid-email');
            emailEl?.focus();
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            const lang = getLang();
            const tmpl = (window.dictionary && window.dictionary.resetLinkSent)
                ? window.dictionary.resetLinkSent[lang]
                : (lang === 'ar' ? `تم إرسال رابط إعادة التعيين إلى ${email}` : `Password reset link sent to ${email}`);
            showToast(tmpl.replace('{email}', email), 'success');
        } catch (err) {
            console.error('Reset password error:', err);
            showFormError(loginFormEl, err.code || 'auth/network-request-failed');
        }
    });

    // ==========================================
    // Login submit
    // ==========================================
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormError(loginForm);

            const email = loginForm.loginEmail.value.trim();
            const password = loginForm.password.value;
            const remember = loginForm.rememberMe.checked;

            if (!isValidEmail(email)) {
                showFormError(loginForm, 'auth/invalid-email');
                return;
            }
            if (!password) {
                const lang = getLang();
                showFormError(loginForm, lang === 'ar' ? 'يرجى إدخال كلمة المرور.' : 'Please enter your password.');
                return;
            }

            const btn = loginForm.querySelector('button[type="submit"]');
            setButtonLoading(btn, true);

            try {
                await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    localStorage.setItem('diacare_user_fname', userData.fname);
                    localStorage.setItem('diacare_diabetes_type', userData.type);
                } else {
                    localStorage.setItem('diacare_user_fname', getLang() === 'ar' ? 'مستخدم' : 'User');
                }
                localStorage.setItem('diacare_user_email', user.email);

                await window.DiaCareDB.syncLogs('db_glucose');
                await window.DiaCareDB.syncLogs('db_weight');
                await window.DiaCareDB.syncLogs('db_meals');

                const lang = getLang();
                showToast(lang === 'ar' ? 'تم تسجيل الدخول بنجاح!' : 'Signed in successfully!', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 350);
            } catch (error) {
                console.error('Login error:', error);
                showFormError(loginForm, error.code || 'auth/invalid-credential');
                setButtonLoading(btn, false);
            }
        });
    }

    // ==========================================
    // Signup submit
    // ==========================================
    const signupFormElement = document.getElementById('form-signup');
    if (signupFormElement) {
        signupFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormError(signupFormElement);

            const fname = signupFormElement.fname.value.trim();
            const lname = signupFormElement.lname.value.trim();
            const email = signupFormElement.signupEmail.value.trim();
            const password = signupFormElement.signupPassword.value;
            const confirm = signupFormElement.signupPasswordConfirm.value;
            const dob = signupFormElement.dob.value;
            const type = signupFormElement.diabetesType.value;
            const lang = getLang();

            if (!fname || !lname) {
                showFormError(signupFormElement, lang === 'ar' ? 'يرجى إدخال الاسم الكامل.' : 'Please enter your full name.');
                return;
            }
            if (!isValidEmail(email)) {
                showFormError(signupFormElement, 'auth/invalid-email');
                return;
            }
            if (password.length < 8) {
                showFormError(signupFormElement, 'auth/weak-password');
                return;
            }
            if (password !== confirm) {
                const tmpl = window.dictionary && window.dictionary.passwordMismatch
                    ? window.dictionary.passwordMismatch[lang]
                    : 'Passwords do not match';
                showFormError(signupFormElement, lang === 'ar' ? 'تأكد من تطابق كلمتي المرور.' : 'Please make sure both passwords match.');
                signupFormElement.signupPasswordConfirm.focus();
                return;
            }
            if (!dob) {
                showFormError(signupFormElement, lang === 'ar' ? 'يرجى إدخال تاريخ الميلاد.' : 'Please enter your date of birth.');
                return;
            }
            if (!type) {
                showFormError(signupFormElement, lang === 'ar' ? 'يرجى اختيار نوع السكري.' : 'Please select your diabetes type.');
                return;
            }

            const btn = signupFormElement.querySelector('button[type="submit"]');
            setButtonLoading(btn, true);

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                await setDoc(doc(db, "users", user.uid), {
                    fname: fname,
                    lname: lname,
                    type: type,
                    email: email,
                    createdAt: new Date().toISOString()
                });

                localStorage.setItem('diacare_user_fname', fname);
                localStorage.setItem('diacare_diabetes_type', type);
                localStorage.setItem('diacare_user_email', email);

                showToast(lang === 'ar' ? 'تم إنشاء الحساب بنجاح!' : 'Account created successfully!', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
            } catch (error) {
                console.error('Signup error:', error);
                showFormError(signupFormElement, error.code || 'auth/email-already-in-use');
                setButtonLoading(btn, false);
            }
        });
    }

    // ==========================================
    // Google sign-in (popup on desktop, redirect on mobile)
    // ==========================================
    const googleBtn = document.getElementById('google-login');
    async function handleGoogleProfile(user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            const displayName = user.displayName || 'User';
            const fname = displayName.split(' ')[0] || 'User';
            await setDoc(doc(db, "users", user.uid), {
                fname: fname,
                type: 'type1',
                email: user.email,
                createdAt: new Date().toISOString()
            });
            localStorage.setItem('diacare_user_fname', fname);
            localStorage.setItem('diacare_diabetes_type', 'type1');
        } else {
            const userData = userDoc.data();
            localStorage.setItem('diacare_user_fname', userData.fname);
            localStorage.setItem('diacare_diabetes_type', userData.type);
        }
        localStorage.setItem('diacare_user_email', user.email);
    }
    async function finishGoogleSignIn(user) {
        await handleGoogleProfile(user);
        await window.DiaCareDB.syncLogs('db_glucose');
        await window.DiaCareDB.syncLogs('db_weight');
        await window.DiaCareDB.syncLogs('db_meals');
        const lang = getLang();
        showToast(lang === 'ar' ? 'تم تسجيل الدخول عبر Google' : 'Signed in with Google', 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 350);
    }
    googleBtn?.addEventListener('click', async () => {
        clearFormError(loginFormEl);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        setButtonLoading(googleBtn, true);
        try {
            const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) {
                await signInWithRedirect(auth, provider);
                // Result handled on next page load via getRedirectResult below
            } else {
                const result = await signInWithPopup(auth, provider);
                if (result?.user) await finishGoogleSignIn(result.user);
            }
        } catch (err) {
            console.error('Google sign-in error:', err);
            showFormError(loginFormEl, err.code || 'auth/popup-closed-by-user');
            setButtonLoading(googleBtn, false);
        }
    });

    // Handle redirect result (mobile flow) on page load
    getRedirectResult(auth).then(async (result) => {
        if (result?.user) {
            await finishGoogleSignIn(result.user);
        }
    }).catch((err) => {
        if (err && err.code) {
            console.error('Redirect result error:', err);
            showFormError(loginFormEl, err.code);
        }
    });

    // --- AI Chatbot Shared Logic for Index ---
    if (window.chatBotAttached) return;
    window.chatBotAttached = true;

    const chatbotToggle = document.getElementById('chatbot-toggle');
    const chatbotWindow = document.getElementById('chatbot-window');
    const chatbotClose = document.getElementById('chatbot-close');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send');

    if (chatbotToggle) {
        chatbotToggle.addEventListener('click', () => {
            chatbotWindow.classList.toggle('active');
            if (chatbotWindow.classList.contains('active')) chatInput.focus();
        });

        chatbotClose.addEventListener('click', () => {
            chatbotWindow.classList.remove('active');
        });

        const appendMessage = (text, sender, saveToHistory = true) => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `message msg-${sender}`;
            msgDiv.textContent = text;
            chatMessages.appendChild(msgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            if (saveToHistory) {
                let history = JSON.parse(sessionStorage.getItem('diacare_chat_history') || '[]');
                history.push({ text, sender });
                sessionStorage.setItem('diacare_chat_history', JSON.stringify(history));
            }
        };

        const loadChatHistory = () => {
            let history = JSON.parse(sessionStorage.getItem('diacare_chat_history') || '[]');
            if (history.length > 0) {
                chatMessages.innerHTML = ''; // clear default welcome
                history.forEach(msg => {
                    appendMessage(msg.text, msg.sender, false);
                });
            }
        };
        loadChatHistory();

        const showTypingIndicator = () => {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'typing-indicator';
            typingDiv.id = 'typing-indicator';
            typingDiv.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };

        const hideTypingIndicator = () => {
            const typingDiv = document.getElementById('typing-indicator');
            if (typingDiv) typingDiv.remove();
        };

        const handleChatSubmit = async () => {
            const userText = chatInput.value.trim();
            if (!userText) return;

            appendMessage(userText, 'user');
            chatInput.value = '';
            showTypingIndicator();

            setTimeout(() => {
                hideTypingIndicator();
                const isArabic = document.documentElement.getAttribute('lang') === 'ar';
                const type = localStorage.getItem('diacare_diabetes_type') || 'type1';
                const lastGlucose = parseFloat(localStorage.getItem('diacare_last_glucose'));
                let response = "";

                if (userText.toLowerCase().includes('رياض') || userText.toLowerCase().includes('sport') || userText.toLowerCase().includes('exercise')) {
                    response = isArabic ?
                        "الرياضة ممتازة لخفض السكر! يُنصح بـ 150 دقيقة من التمارين الهوائية أسبوعياً (مثل المشي السريع). تأكد من فحص السكر قبل الرياضة؛ إذا كان أقل من 100، تناول وجبة خفيفة. وإذا كان فوق 250، احذر من التمارين الشاقة." :
                        "Exercise is great for lowering blood sugar! 150 mins/week of aerobic activity is recommended. Check sugar before: if <100, eat a snack. If >250, avoid strenuous exercise.";
                } else if (userText.toLowerCase().includes('أكل') || userText.toLowerCase().includes('طعام') || userText.toLowerCase().includes('eat') || userText.toLowerCase().includes('food') || userText.toLowerCase().includes('diet')) {
                    response = isArabic ?
                        "ينصح بالتركيز على الخضروات غير النشوية، والبروتينات الخالية من الدهون، والكربوهيدرات المعقدة (مثل الشوفان والخبز الأسمر). تجنب السكريات البسيطة والمشروبات المحلاة." :
                        "Focus on non-starchy vegetables, lean proteins, and complex carbs (like oats and whole wheat bread). Avoid simple sugars and sweetened drinks.";
                } else if (!isNaN(lastGlucose) && (userText.includes(lastGlucose.toString()) || userText.includes('قراءت') || userText.includes('reading') || userText.includes('سكر'))) {
                    if (lastGlucose < 70) {
                        response = isArabic ?
                            `قراءتك الحالية (${lastGlucose}) منخفضة جداً (نقص سكر الدم) 🚨\n\n📌 **الإجراء الطبي (حسب جمعية السكري الأمريكية ADA):**\n١. **تطبيق قاعدة 15:** تناول 15 جرام من الكربوهيدرات السريعة فوراً (مثل: نصف كوب عصير، ملعقة عسل، أو 3 أقراص جلوكوز).\n٢. انتظر 15 دقيقة ثم افحص السكر مرة أخرى.\n٣. إذا كان لا يزال أقل من 70، كرر الخطوة الأولى.\n٤. إذا ارتفع فوق 70، تناول وجبة خفيفة تحتوي على بروتين (مثل نصف ساندويتش) لمنع هبوطه مجدداً.` :
                            `Your reading (${lastGlucose}) is very low (Hypoglycemia) 🚨\n\n📌 **Medical Action (ADA Guidelines):**\n1. **Rule of 15:** Eat 15g of fast-acting carbs immediately (e.g., 1/2 cup juice, 1 tbsp honey).\n2. Wait 15 mins and check again.\n3. If still < 70, repeat step 1.\n4. Once > 70, eat a small snack with protein (e.g., half sandwich) to stabilize it.`;
                    } else if (lastGlucose > 180) {
                        if (type === 'type1') {
                            response = isArabic ?
                                `قراءتك الحالية (${lastGlucose}) مرتفعة ⚠️\n\n📌 **الإجراء الطبي:**\n١. اشرب كوبين من الماء للمساعدة في التخلص من السكر الزائد عبر البول.\n٢. خذ جرعة تصحيحية من الإنسولين السريع حسب توجيهات طبيبك.\n٣. **تحذير:** إذا كان السكر فوق 250، افحص الكيتونات وتجنب الرياضة الشاقة تماماً.\n٤. أعد الفحص بعد ساعتين.` :
                                `Your reading (${lastGlucose}) is high ⚠️\n\n📌 **Medical Action:**\n1. Drink plenty of water to help flush excess sugar via urine.\n2. Take a rapid insulin correction dose as directed by your doctor.\n3. **Warning:** If > 250, check for ketones and avoid strenuous exercise.\n4. Recheck in 2 hours.`;
                        } else if (type === 'type2') {
                            response = isArabic ?
                                `قراءتك الحالية (${lastGlucose}) مرتفعة ⚠️\n\n📌 **الإجراء الطبي:**\n١. تأكد من أخذ أدويتك الموصوفة (مثل حبة المنظم 700مغ) في وقتها.\n٢. اشرب الماء بكثرة للترطيب.\n٣. قم بنشاط بدني خفيف (مثل المشي لـ 15-20 دقيقة) لأن ذلك يساعد العضلات على حرق السكر الزائد.\n٤. تجنب الكربوهيدرات البسيطة في وجبتك القادمة.` :
                                `Your reading (${lastGlucose}) is high ⚠️\n\n📌 **Medical Action:**\n1. Ensure you took your prescribed meds (e.g., Metformin 700mg) on time.\n2. Drink plenty of water.\n3. Do light exercise (like a 15-20 min walk) to help muscles use excess sugar.\n4. Avoid simple carbs in your next meal.`;
                        } else if (type === 'gestational') {
                            response = isArabic ?
                                `قراءتك الحالية (${lastGlucose}) أعلى من النطاق الآمن للحمل ⚠️\n\n📌 **الإجراء الطبي:**\n١. اشربي الماء والتزمي حرفياً بالحمية الغذائية المحددة لكِ.\n٢. المشي الخفيف لـ 15 دقيقة بعد الوجبات يساعد جداً في خفض السكر.\n٣. تواصلي مع طبيبك لمراجعة الخطة العلاجية (الإنسولين هو الخيار الآمن إذا استمر الارتفاع).` :
                                `Your reading (${lastGlucose}) is above the safe pregnancy target ⚠️\n\n📌 **Medical Action:**\n1. Drink water and strictly follow your gestational diet plan.\n2. A 15-min light walk after meals significantly lowers sugar.\n3. Consult your doctor to review your treatment (Insulin is the safe option if it remains high).`;
                        } else {
                            response = isArabic ?
                                `قراءة طفلك (${lastGlucose}) مرتفعة ⚠️\n\n📌 **الإجراء الطبي:**\n١. شجعه على شرب الماء لترطيب جسمه.\n٢. احسب جرعة تصحيحية بحذر حسب توجيهات طبيب الأطفال.\n٣. راقب السكر مرة أخرى بعد الجرعة وتجنب إعطاءه سكريات إضافية.` :
                                `Your child's reading (${lastGlucose}) is high ⚠️\n\n📌 **Medical Action:**\n1. Encourage them to drink plenty of water.\n2. Calculate a careful correction dose per pediatrician's guidance.\n3. Recheck sugar later and avoid extra sweets.`;
                        }
                    } else {
                        response = isArabic ?
                            `قراءتك الحالية (${lastGlucose}) ممتازة وضمن النطاق الطبيعي الموصى به! 🎉\n\n📌 **نصيحة طبية:**\nأنت تقوم بعمل رائع. استمر في الحفاظ على هذا التوازن من خلال الالتزام بخطتك الغذائية والعلاجية، وممارسة نشاط بدني يومي.` :
                            `Your current reading (${lastGlucose}) is excellent and in range! 🎉\n\n📌 **Medical Advice:**\nYou are doing a great job. Keep this balance by sticking to your meal and treatment plan, and getting daily physical activity.`;
                    }
                } else {
                    response = isArabic ?
                        "مرحباً بك! أنا المساعد الطبي المحلي المعتمد على مراجع طبية موثوقة (مثل جمعية السكري الأمريكية ADA). يمكنك سؤالي عن الرياضة، الطعام، أو الضغط على (توضيح طبي) ليتم تحليل قراءتك." :
                        "Welcome! I am your local Medical Assistant based on reliable guidelines (like ADA). Ask me about exercise, food, or click (Medical Explanation) to get your reading analyzed.";
                }

                appendMessage(response + (isArabic ? "\n\n(ملاحظة: هذه إرشادات مرجعية، يرجى دائماً مراجعة طبيبك المعالج)." : "\n\n(Note: These are reference guidelines, always consult your treating doctor)."), 'ai');
            }, 600);
        };

        chatSendBtn.addEventListener('click', handleChatSubmit);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleChatSubmit();
        });
    }

    // --- ميزة تسجيل الخروج الموحدة لجميع الصفحات ---
    const globalLogoutBtn = document.getElementById('logout-btn');
    if (globalLogoutBtn) {
        const newLogoutBtn = globalLogoutBtn.cloneNode(true);
        globalLogoutBtn.parentNode.replaceChild(newLogoutBtn, globalLogoutBtn);
        newLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (window.DiaCareDB && window.DiaCareDB.logout) {
                await window.DiaCareDB.logout();
            }
            window.location.href = 'index.html';
        });
    }
});
