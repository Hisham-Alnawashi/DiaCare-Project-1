import { auth, db } from "./firebase-config.js";
import { collection, addDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

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
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                if (themeIcon) themeIcon.className = 'fas fa-sun';
                localStorage.setItem('diacare_theme', 'dark');
            }
        });
    }

    // Load user profile
    const userName = localStorage.getItem('diacare_user_fname');
    if (userName) {
        const greetingEl = document.getElementById('user-greeting');
        if (greetingEl) {
            const updateGreeting = () => {
                const curLang = document.documentElement.getAttribute('lang') || 'en';
                const welcomeStr = dictionary && dictionary['welcome'] ? dictionary['welcome'][curLang] : 'Welcome,';
                greetingEl.textContent = `${welcomeStr} ${userName}!`;
            };
            setTimeout(updateGreeting, 50);

            document.addEventListener('languageChanged', updateGreeting);
        }
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

            if (saveToHistory) {
                let history = JSON.parse(sessionStorage.getItem('diacare_chat_history') || '[]');
                history.push({ text, sender });
                sessionStorage.setItem('diacare_chat_history', JSON.stringify(history));
            }
        };

        const loadChatHistory = () => {
            let history = JSON.parse(sessionStorage.getItem('diacare_chat_history') || '[]');
            if (history.length > 0) {
                chatMessages.innerHTML = '';
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

    // --- Data Rendering Logic (Stats & Charts) ---
    let reportChartInstance = null;
    function renderReportsData(resolvedUser) {
        const glucoseLogs = JSON.parse(localStorage.getItem('db_glucose') || '[]');
        console.log("DEBUG: renderReportsData fired. Logs length:", glucoseLogs.length, "Current User:", auth.currentUser);

        if (glucoseLogs.length > 0) {
            let sum = 0, normal = 0, high = 0, low = 0;
            glucoseLogs.forEach(log => {
                sum += log.value;
                if (log.value < 70) low++;
                else if (log.value > 180) high++;
                else normal++;
            });

            const total = glucoseLogs.length;
            const avg = Math.round(sum / total);
            // خوارزمية تقريبية لحساب السكر التراكمي: (Average + 46.7) / 28.7
            const a1c = ((avg + 46.7) / 28.7).toFixed(1);

            const normalPct = Math.round((normal / total) * 100);
            const highPct = Math.round((high / total) * 100);
            const lowPct = Math.round((low / total) * 100);

            const avgEl = document.getElementById('report-avg-glucose');
            if (avgEl) avgEl.textContent = avg + " mg/dL";

            const a1cEl = document.getElementById('report-est-a1c');
            if (a1cEl) a1cEl.textContent = a1c + "%";

            const setProgress = (idPrefix, pct) => {
                const pctEl = document.getElementById(`${idPrefix}-pct`);
                const barEl = document.getElementById(`${idPrefix}-bar`);
                if (pctEl) pctEl.textContent = pct + "%";
                if (barEl) barEl.style.width = pct + "%";
            };
            setProgress('report-normal', normalPct);
            setProgress('report-high', highPct);
            setProgress('report-low', lowPct);

            // Save report summary to Firestore
            const activeUser = resolvedUser || auth.currentUser;
            let userUid = activeUser ? activeUser.uid : null;

            if (!userUid) {
                console.log("DEBUG: No authenticated user found, using fallback Local UID for testing.");
                userUid = localStorage.getItem('diacare_user_id') || "mock_developer_user_id";
            }

            if (userUid) {
                const today = new Date().toISOString().split('T')[0];
                console.log("DEBUG: Attempting to save report for UID:", userUid);
                setDoc(doc(db, `users/${userUid}/reports`, today), {
                    avgGlucose: avg,
                    estimatedA1c: parseFloat(a1c),
                    timeInRange: { normal: normalPct, high: highPct, low: lowPct },
                    totalReadings: total,
                    computedAt: new Date().toISOString()
                })
                .then(() => console.log("DEBUG: Report successfully saved to Firestore!"))
                .catch(err => console.error('CRITICAL FIRESTORE ERROR:', err));
            } else {
                console.log("DEBUG: Report save skipped because no resolved user is available.");
            }
        }

        const ctx = document.getElementById('monthlyTrendChart');
        if (ctx && glucoseLogs.length > 0) {
            const isAr = document.documentElement.getAttribute('lang') === 'ar';

            // Group readings by date (YYYY-MM-DD) and compute daily averages
            const dailyMap = {};
            glucoseLogs.forEach(log => {
                if (!log.timestamp) return;
                const dateKey = new Date(log.timestamp).toISOString().split('T')[0];
                if (!dailyMap[dateKey]) dailyMap[dateKey] = { sum: 0, count: 0 };
                dailyMap[dateKey].sum += log.value;
                dailyMap[dateKey].count++;
            });

            const dailyAverages = Object.keys(dailyMap)
                .sort()
                .map(dateKey => {
                    const [y, m, d] = dateKey.split('-');
                    return {
                        date: dateKey,
                        label: `${d}/${m}`,
                        avg: Math.round(dailyMap[dateKey].sum / dailyMap[dateKey].count),
                        count: dailyMap[dateKey].count
                    };
                })
                .slice(-30);

            const labels = dailyAverages.map(d => d.label);
            const dataPoints = dailyAverages.map(d => d.avg);
            const readingCounts = dailyAverages.map(d => d.count);
            const pointColors = dataPoints.map(v => (v < 70 || v > 180) ? '#ef4444' : '#6a3ec4');

            const makeTooltipLabel = () => function (context) {
                const idx = context.dataIndex;
                const avg = dataPoints[idx];
                const count = readingCounts[idx];
                return isAr
                    ? `المتوسط: ${avg} mg/dL (من ${count} قراءات)`
                    : `Avg: ${avg} mg/dL (from ${count} readings)`;
            };

            if (reportChartInstance) {
                reportChartInstance.data.labels = labels;
                reportChartInstance.data.datasets[0].data = dataPoints;
                reportChartInstance.data.datasets[0].pointBackgroundColor = pointColors;
                reportChartInstance.data.datasets[0].label = isAr ? 'السكر (mg/dL)' : 'Glucose (mg/dL)';
                reportChartInstance.options.plugins.tooltip.callbacks.label = makeTooltipLabel();
                reportChartInstance.update();
            } else {
                reportChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: isAr ? 'السكر (mg/dL)' : 'Glucose (mg/dL)',
                            data: dataPoints,
                            borderColor: '#6a3ec4',
                            backgroundColor: 'rgba(106, 62, 196, 0.1)',
                            borderWidth: 3,
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: pointColors,
                            pointRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { suggestedMin: 50, suggestedMax: 250 } },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: makeTooltipLabel()
                                }
                            }
                        }
                    }
                });
            }
        }
    }

    renderReportsData();
    document.addEventListener('languageChanged', renderReportsData);
    document.addEventListener('logsSynced', renderReportsData);
    document.addEventListener('userDataLoaded', renderReportsData);

    // Auth listener (registers once per page load)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("DEBUG: Global Auth Resolved! User UID:", user.uid);
            renderReportsData(user);
        } else {
            console.log("DEBUG: Global Auth resolved but no user is signed in.");
        }
    });

    // --- PDF Export Logic ---
    const exportBtn = document.getElementById('btn-export-pdf');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const isArabic = document.documentElement.getAttribute('lang') === 'ar';

            // نأخذ نسخة من المحتوى لكي نزيل منه الأزرار دون التأثير على الشاشة أمام المستخدم
            const element = document.querySelector('.main-content').cloneNode(true);

            const controls = element.querySelector('.header-controls');
            if (controls) controls.remove();

            const exportCard = element.querySelector('#btn-export-pdf').parentNode;
            if (exportCard) exportCard.remove();

            // تحويل الرسم البياني إلى صورة لكي يظهر بوضوح في ملف الـ PDF
            const originalCanvas = document.getElementById('monthlyTrendChart');
            const clonedCanvasContainer = element.querySelector('.chart-placeholder');
            if (originalCanvas && clonedCanvasContainer) {
                const img = document.createElement('img');
                img.src = originalCanvas.toDataURL('image/png');
                img.style.width = '100%';
                clonedCanvasContainer.innerHTML = '';
                clonedCanvasContainer.appendChild(img);
            }

            const originalText = exportBtn.innerHTML;
            exportBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isArabic ? 'جاري التصدير...' : 'Exporting...'}`;
            exportBtn.disabled = true;

            const opt = {
                margin: 0.5,
                filename: `DiaCare_Report_${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            // بدء التنزيل الفعلي لملف الـ PDF
            html2pdf().set(opt).from(element).save().then(() => {
                exportBtn.innerHTML = originalText;
                exportBtn.disabled = false;
            });
        });
    }
});