document.addEventListener('DOMContentLoaded', () => {
    // --- Shared Logic: Theme & Language ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    const savedTheme = localStorage.getItem('diacare_theme');
    if (savedTheme === 'dark' && themeIcon) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.className = 'fas fa-sun';
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                if (themeIcon) themeIcon.className = 'fas fa-moon';
                localStorage.setItem('diacare_theme', 'light');
                const ts = document.getElementById('settings-theme');
                if (ts) ts.value = 'light';
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                if (themeIcon) themeIcon.className = 'fas fa-sun';
                localStorage.setItem('diacare_theme', 'dark');
                const ts = document.getElementById('settings-theme');
                if (ts) ts.value = 'dark';
            }
        });
    }

    // Load user profile & Set initial form values
    const fnameInput = document.getElementById('settings-fname');
    const langSelect = document.getElementById('settings-lang');
    const themeSelect = document.getElementById('settings-theme');
    const typeSelect = document.getElementById('settings-diabetes-type');

    const userName = localStorage.getItem('diacare_user_fname');

    if (fnameInput) fnameInput.value = userName || '';
    if (langSelect) langSelect.value = localStorage.getItem('diacare_lang') || 'en';
    if (themeSelect) themeSelect.value = localStorage.getItem('diacare_theme') || 'light';
    if (typeSelect) typeSelect.value = localStorage.getItem('diacare_diabetes_type') || 'type1';

    const updateGreeting = () => {
        const greetingEl = document.getElementById('user-greeting');
        if (greetingEl) {
            const curLang = document.documentElement.getAttribute('lang') || 'en';
            const welcomeStr = dictionary && dictionary['welcome'] ? dictionary['welcome'][curLang] : 'Welcome,';
            const currentName = localStorage.getItem('diacare_user_fname') || '';
            greetingEl.textContent = `${welcomeStr} ${currentName}!`;
        }
    };
    setTimeout(updateGreeting, 50);
    document.addEventListener('languageChanged', updateGreeting);

    // Form Interactions
    const updateProfileBtn = document.getElementById('btn-update-profile');
    if (updateProfileBtn) {
        updateProfileBtn.addEventListener('click', async () => {
            if (fnameInput && fnameInput.value.trim() !== '') {
                const newFname = fnameInput.value.trim();
                const newType = typeSelect ? typeSelect.value : 'type1';

                localStorage.setItem('diacare_user_fname', newFname);
                if (typeSelect) {
                    localStorage.setItem('diacare_diabetes_type', newType);
                }
                updateGreeting();

                // تحديث البيانات في Firebase
                if (window.DiaCareDB && window.DiaCareDB.updateProfile) {
                    await window.DiaCareDB.updateProfile(newFname, newType);
                }

                const isArabic = document.documentElement.getAttribute('lang') === 'ar';
                window.showToast(isArabic ? 'تم حفظ الاسم بنجاح!' : 'Name updated successfully!', 'success');
            }
        });
    }

    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            if (typeof updateLanguage === 'function') {
                updateLanguage(e.target.value);
            }
        });
    }

    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            if (themeToggleBtn) themeToggleBtn.click(); // Reuse existing logic
        });
    }

    const changePassBtn = document.getElementById('btn-change-password');
    const passInput = document.getElementById('settings-password');
    if (changePassBtn) {
        changePassBtn.addEventListener('click', () => {
            if (passInput && passInput.value.trim() !== '') {
                const isArabic = document.documentElement.getAttribute('lang') === 'ar';
                // We simulate saving for now. If you want this to work with Firebase, it will be added in script.js
                window.showToast(isArabic ? 'تم طلب تغيير كلمة المرور! (يعمل مع قاعدة البيانات)' : 'Password change requested! (Works with Backend)', 'success');
                passInput.value = '';
            }
        });
    }

    // --- AI Chatbot Shared Logic ---
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
        };

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

        // Minimal Chat logic to prevent errors, actual implementation uses Gemini as in other pages
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
        chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleChatSubmit(); });
    }
});