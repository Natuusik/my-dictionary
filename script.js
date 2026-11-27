// =====================================================================
// ВСТАВЬТЕ ВАШИ ДАННЫЕ ИЗ SUPABASE (Project Settings -> API)
// =====================================================================
const SUPABASE_URL = 'https://oxinddpmnblggssmcpbc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_buNcB1Gf3j4R0z68CwTSgQ__WHMuxFY';
// =====================================================================

let supabaseClient = null;
let foldersMap = { "Папка №1": [] };
let currentFolder = "Папка №1";

let trainingQueue = [];
let currentIndex = 0;
let isTraining = false;
let countdownInterval = null;
let nextStepTimeout = null;

const audioCache = new Map();
let activeAudio = null;

// --- ИНИЦИАЛИЗАЦИЯ И СТАРТ ПРИЛОЖЕНИЯ ---
async function initApp() {
    const statusBadge = document.getElementById('db-status');
    
    if (SUPABASE_URL.includes('ВАШ_ПРОЕКТ')) {
        if (statusBadge) {
            statusBadge.textContent = "Нет ключей API";
            statusBadge.className = "text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full";
        }
        renderUI();
        return;
    }

    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        // Загружаем данные из базы
        await loadFromDatabase();
        
        // Восстанавливаем настройки и выбранную папку из памяти браузера
        loadUserSettings();

        if (statusBadge) {
            statusBadge.textContent = "Онлайн (БД)";
            statusBadge.className = "text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full";
        }
    } catch (err) {
        console.error("Ошибка инициализации Supabase:", err);
        if (statusBadge) {
            statusBadge.textContent = "Ошибка БД";
            statusBadge.className = "text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full";
        }
        renderUI();
    }
}

// --- ЗАГРУЗКА ИЗ БАЗЫ ДАННЫХ ---
async function loadFromDatabase() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('words_dictation')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Ошибка загрузки из Supabase:", error.message);
        return;
    }

    foldersMap = { "Папка №1": [] };

    if (data && data.length > 0) {
        data.forEach(row => {
            const folderName = row.folder_name || "Папка №1";
            if (!foldersMap[folderName]) {
                foldersMap[folderName] = [];
            }
            foldersMap[folderName].push({
                id: row.id,
                en: row.word_en,
                ru: row.word_ru || '',
                audioEnUrl: row.audio_en_url,
                audioRuUrl: row.audio_ru_url,
                audioRuFemaleUrl: row.audio_ru_female_url
            });
        });
    }

    // Проверяем сохраненную папку
    const savedFolder = localStorage.getItem('user_folder');
    if (savedFolder && foldersMap[savedFolder]) {
        currentFolder = savedFolder;
    } else {
        const folderKeys = Object.keys(foldersMap);
        currentFolder = folderKeys.length > 0 ? folderKeys[0] : "Папка №1";
    }

    renderUI();
}

// --- ОТРИСОВКА ИНТЕРФЕЙСА ---
function renderUI() {
    const select = document.getElementById('folder-select');
    if (!select) return;
    
    select.innerHTML = '';
    
    const folderNames = Object.keys(foldersMap);
    if (folderNames.length === 0) {
        foldersMap["Папка №1"] = [];
        folderNames.push("Папка №1");
    }

    if (!foldersMap[currentFolder]) {
        currentFolder = folderNames[0];
    }

    folderNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = `${name} (${(foldersMap[name] || []).length})`;
        if (name === currentFolder) option.selected = true;
        select.appendChild(option);
    });

    const listContainer = document.getElementById('words-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    const words = foldersMap[currentFolder] || [];
    
    const badge = document.getElementById('total-words-badge');
    if (badge) badge.textContent = `${words.length} слов`;

    if (words.length === 0) {
        listContainer.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Папка пуста. Добавьте слова выше.</p>';
        return;
    }

    words.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-sm';
        div.innerHTML = `
            <div>
                <span class="font-bold text-slate-800">${item.en}</span>
                <span class="text-slate-500"> — ${item.ru || '<i class="text-rose-400 text-xs">нет перевода</i>'}</span>
                ${item.audioEnUrl ? '<span class="ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">HD MP3</span>' : ''}
            </div>
            <div class="flex items-center gap-1">
                <button onclick="editWord('${item.id}')" class="text-slate-400 hover:text-emerald-600 px-1.5 transition" title="Редактировать">✏️</button>
                <button onclick="deleteWord('${item.id}')" class="text-slate-400 hover:text-rose-500 px-1.5 font-bold transition" title="Удалить">✕</button>
            </div>
        `;
        listContainer.appendChild(div);
    });
}

// --- УПРАВЛЕНИЕ ПАПКАМИ ---
function selectFolder() {
    const select = document.getElementById('folder-select');
    if (select) {
        currentFolder = select.value;
        saveUserSettings();
        renderUI();
    }
}

function createNewFolder() {
    const nextNum = Object.keys(foldersMap).length + 1;
    const name = prompt("Введите название новой папки:", `Папка №${nextNum}`);
    if (name && name.trim()) {
        const cleanName = name.trim();
        if (!foldersMap[cleanName]) {
            foldersMap[cleanName] = [];
        }
        currentFolder = cleanName;
        saveUserSettings();
        renderUI();
    }
}

async function deleteCurrentFolder() {
    if (!confirm(`Удалить папку "${currentFolder}" и все её слова из облака?`)) return;

    if (supabaseClient) {
        await supabaseClient
            .from('words_dictation')
            .delete()
            .eq('folder_name', currentFolder);
    }

    delete foldersMap[currentFolder];
    if (Object.keys(foldersMap).length === 0) {
        foldersMap["Папка №1"] = [];
    }
    currentFolder = Object.keys(foldersMap)[0];
    saveUserSettings();
    renderUI();
}

// --- ДОБАВЛЕНИЕ И РЕДАКТИРОВАНИЕ СЛОВ ---
async function addNewSingleWord() {
    const englishInput = document.getElementById('sourceWord');
    const russianInput = document.getElementById('targetWord');
    
    const englishWord = englishInput ? englishInput.value.trim() : '';
    const russianWord = russianInput ? russianInput.value.trim() : '';

    if (!englishWord || !russianWord) {
        alert("Пожалуйста, заполните оба поля: и слово, и перевод!");
        return;
    }

    const rowsToInsert = [{
        folder_name: currentFolder,
        word_en: englishWord,
        word_ru: russianWord
    }];

    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('words_dictation')
            .insert(rowsToInsert);
        
        if (error) {
            alert("Ошибка сохранения: " + error.message);
        } else {
            if (englishInput) englishInput.value = '';
            if (russianInput) russianInput.value = '';
            await loadFromDatabase();
        }
    } else {
        if (!foldersMap[currentFolder]) foldersMap[currentFolder] = [];
        foldersMap[currentFolder].push({ id: Date.now(), en: englishWord, ru: russianWord });
        if (englishInput) englishInput.value = '';
        if (russianInput) russianInput.value = '';
        renderUI();
    }
}

async function editWord(id) {
    const words = foldersMap[currentFolder] || [];
    const item = words.find(w => String(w.id) === String(id));
    if (!item) return;

    const newEn = prompt("Редактировать английское слово/фразу:", item.en);
    if (newEn === null) return;

    const newRu = prompt("Редактировать перевод:", item.ru);
    if (newRu === null) return;

    const cleanEn = newEn.trim();
    const cleanRu = newRu.trim();

    if (!cleanEn) {
        alert("Английское слово не может быть пустым!");
        return;
    }

    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('words_dictation')
            .update({
                word_en: cleanEn,
                word_ru: cleanRu,
                audio_en_url: null,
                audio_ru_url: null,
                audio_ru_female_url: null
            })
            .eq('id', id);

        if (error) {
            alert("Ошибка при редактировании: " + error.message);
        } else {
            await loadFromDatabase();
        }
    } else {
        item.en = cleanEn;
        item.ru = cleanRu;
        renderUI();
    }
}

async function deleteWord(id) {
    if (supabaseClient) {
        await supabaseClient
            .from('words_dictation')
            .delete()
            .eq('id', id);
        await loadFromDatabase();
    } else {
        foldersMap[currentFolder] = foldersMap[currentFolder].filter(w => String(w.id) !== String(id));
        renderUI();
    }
}

async function clearFolderWords() {
    if (!confirm("Очистить все слова в этой папке?")) return;
    await deleteCurrentFolder();
}

// --- БУФЕР ОБМЕНА И ПЕРЕВОД ---
async function pasteFromClipboard(elementId) {
    try {
        const text = await navigator.clipboard.readText();
        const el = document.getElementById(elementId);
        if (el) el.value = text;
    } catch (err) {
        console.error("Не удалось прочитать буфер обмена:", err);
    }
}

async function translateWord() {
    const textInput = document.getElementById('sourceWord');
    const targetInput = document.getElementById('targetWord');
    const text = textInput ? textInput.value.trim() : '';

    if (!text) {
        alert("Сначала введите слово для перевода!");
        return;
    }

    try {
        if (targetInput) targetInput.placeholder = "Переводим...";
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`);
        const data = await response.json();
        
        if (data && data.responseData && data.responseData.translatedText) {
            if (targetInput) targetInput.value = data.responseData.translatedText;
        } else {
            if (targetInput) targetInput.placeholder = "Не удалось перевести";
        }
    } catch (err) {
        console.error("Ошибка перевода:", err);
        if (targetInput) targetInput.placeholder = "Ошибка перевода";
    }
}

// --- АУДИО И ОЗВУЧКА ---
function getCurrentVoiceType() {
    const select = document.getElementById('voiceSelect');
    return select ? select.value : 'pro';
}

function getAudioUrl(text, langCode, customUrl) {
    if (customUrl) return customUrl;
    return `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${langCode}&q=${encodeURIComponent(text)}`;
}

function preloadAudio(text, langCode, customUrl = null) {
    if (!text || text === '—') return;
    const key = customUrl || `${langCode}:${text.toLowerCase()}`;
    if (!audioCache.has(key)) {
        const audio = new Audio();
        audio.referrerPolicy = "no-referrer";
        audio.src = getAudioUrl(text, langCode, customUrl);
        audio.preload = "auto";
        audioCache.set(key, audio);
    }
}

function speakSystemFallback(text, langCode, doneCallback) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode === 'ru' ? 'ru-RU' : 'en-US';
        utterance.rate = 0.9;
        utterance.onend = doneCallback;
        utterance.onerror = doneCallback;
        window.speechSynthesis.speak(utterance);
        setTimeout(doneCallback, 3500);
    } else {
        doneCallback();
    }
}

function speakText(text, langCode, customUrl, onFinishedCallback) {
    if (!text || text === '—') {
        if (onFinishedCallback) onFinishedCallback();
        return;
    }

    let finished = false;
    const done = () => {
        if (!finished) {
            finished = true;
            if (onFinishedCallback) onFinishedCallback();
        }
    };

    const key = customUrl || `${langCode}:${text.toLowerCase()}`;
    let audio = audioCache.get(key);

    if (!audio) {
        audio = new Audio();
        audio.referrerPolicy = "no-referrer";
        audio.src = getAudioUrl(text, langCode, customUrl);
        audioCache.set(key, audio);
    } else {
        audio.currentTime = 0;
    }

    activeAudio = audio;

    const networkTimeout = setTimeout(() => {
        if (!finished && audio.paused) {
            audio.pause();
            audioCache.delete(key);
            speakSystemFallback(text, langCode, done);
        }
    }, 2200);

    audio.onplaying = () => clearTimeout(networkTimeout);
    audio.onended = () => {
        clearTimeout(networkTimeout);
        done();
    };
    audio.onerror = () => {
        clearTimeout(networkTimeout);
        audioCache.delete(key);
        speakSystemFallback(text, langCode, done);
    };

    audio.play().catch(() => {
        clearTimeout(networkTimeout);
        speakSystemFallback(text, langCode, done);
    });
}

function testAudio() {
    preloadAudio("Облачный тренажёр готов к работе", "ru");
    speakText("Cloud trainer is ready", "en", null, () => {
        setTimeout(() => {
            speakText("Облачный тренажёр готов к работе", "ru", null);
        }, 300);
    });
}

// --- ЛОГИКА ТРЕНИРОВКИ ---
function startTraining() {
    const words = foldersMap[currentFolder] || [];
    if (words.length === 0) {
        alert("Добавьте хотя бы одно слово в папку перед началом!");
        return;
    }

    trainingQueue = [...words];
    const shuffleCheck = document.getElementById('shuffle-check');
    if (shuffleCheck && shuffleCheck.checked) {
        trainingQueue.sort(() => Math.random() - 0.5);
    }

    currentIndex = 0;
    isTraining = true;

    const directionSelect = document.getElementById('direction-select');
    const direction = directionSelect ? directionSelect.value : 'en-ru';
    
    const dirBadge = document.getElementById('direction-badge');
    if (dirBadge) dirBadge.textContent = direction === 'en-ru' ? 'EN ➔ RU' : 'RU ➔ EN';
    
    const folderTitle = document.getElementById('active-folder-title');
    if (folderTitle) folderTitle.textContent = currentFolder;

    const setupScreen = document.getElementById('setup-screen');
    const trainingScreen = document.getElementById('training-screen');
    if (setupScreen) setupScreen.classList.add('hidden');
    if (trainingScreen) trainingScreen.classList.remove('hidden');

    runStep();
}

function runStep() {
    if (!isTraining) return;
    clearTimers();

    const modeSelect = document.getElementById('mode-select');
    const mode = modeSelect ? modeSelect.value : 'once';
    
    if (currentIndex >= trainingQueue.length) {
        if (mode === 'loop') {
            currentIndex = 0;
            const shuffleCheck = document.getElementById('shuffle-check');
            if (shuffleCheck && shuffleCheck.checked) {
                trainingQueue.sort(() => Math.random() - 0.5);
            }
        } else {
            alert("Тренировка завершена! Все слова пройдены.");
            stopTraining();
            return;
        }
    }

    const item = trainingQueue[currentIndex];
    const directionSelect = document.getElementById('direction-select');
    const direction = directionSelect ? directionSelect.value : 'en-ru';
    
    const hideAnswerCheck = document.getElementById('hide-answer-check');
    const hideAnswer = hideAnswerCheck ? hideAnswerCheck.checked : true;
    
    const delaySelect = document.getElementById('delay-select');
    const delaySec = delaySelect ? parseInt(delaySelect.value, 10) : 5;

    const voiceType = getCurrentVoiceType(); // 'pro' (мужской) или 'female' (женский)

    const promptText = direction === 'en-ru' ? item.en : (item.ru || item.en);
    const promptLang = direction === 'en-ru' ? 'en' : 'ru';
    
    const answerText = direction === 'en-ru' ? (item.ru || '—') : item.en;
    const answerLang = direction === 'en-ru' ? 'ru' : 'en';

    let promptUrl = '';
    let answerUrl = '';

    if (direction === 'en-ru') {
        promptUrl = item.audioEnUrl;
        answerUrl = (voiceType === 'female') ? item.audioRuFemaleUrl : item.audioRuUrl;
    } else {
        promptUrl = (voiceType === 'female') ? item.audioRuFemaleUrl : item.audioRuUrl;
        answerUrl = item.audioEnUrl;
    }

    setTimeout(() => preloadAudio(answerText, answerLang, answerUrl), 400);

    const progressCounter = document.getElementById('progress-counter');
    if (progressCounter) progressCounter.textContent = `${currentIndex + 1} / ${trainingQueue.length}`;
    
    const statusBadge = document.getElementById('status-badge');
    if (statusBadge) {
        statusBadge.textContent = "1. Слушайте слово...";
        statusBadge.className = "text-xs font-semibold px-3 py-1 rounded-full bg-emerald-200 text-emerald-900";
    }
    
    const promptWord = document.getElementById('prompt-word');
    if (promptWord) promptWord.textContent = promptText;
    
    const answerEl = document.getElementById('answer-word');
    if (answerEl) {
        answerEl.textContent = answerText;
        if (hideAnswer) {
            answerEl.classList.add('blur-sm', 'select-none', 'opacity-40');
        } else {
            answerEl.classList.remove('blur-sm', 'select-none', 'opacity-40');
        }
    }

    const timerLabel = document.getElementById('timer-label');
    const timerSeconds = document.getElementById('timer-seconds');
    const timerBar = document.getElementById('timer-bar');
    
    if (timerLabel) timerLabel.textContent = "Перевод прозвучит через:";
    if (timerSeconds) timerSeconds.textContent = `${delaySec} с`;
    if (timerBar) timerBar.style.width = '100%';

    speakText(promptText, promptLang, promptUrl, () => {
        if (!isTraining) return;
        startThinkTimer(delaySec, answerText, answerLang, answerUrl);
    });
}

    const item = trainingQueue[currentIndex];
    const directionSelect = document.getElementById('direction-select');
    const direction = directionSelect ? directionSelect.value : 'en-ru';
    
    const hideAnswerCheck = document.getElementById('hide-answer-check');
    const hideAnswer = hideAnswerCheck ? hideAnswerCheck.checked : true;
    
    const delaySelect = document.getElementById('delay-select');
    const delaySec = delaySelect ? parseInt(delaySelect.value, 10) : 5;

    const voiceType = getCurrentVoiceType(); // 'pro' (мужской) или 'female' (женский)

    const promptText = direction === 'en-ru' ? item.en : (item.ru || item.en);
    const promptLang = direction === 'en-ru' ? 'en' : 'ru';
    
    const answerText = direction === 'en-ru' ? (item.ru || '—') : item.en;
    const answerLang = direction === 'en-ru' ? 'ru' : 'en';

    // Исправленная логика выбора аудиоссылок с учетом выбранного голоса
    let promptUrl = '';
    let answerUrl = '';

    if (direction === 'en-ru') {
        promptUrl = item.audioEnUrl;
        answerUrl = (voiceType === 'female') ? item.audioRuFemaleUrl : item.audioRuUrl;
    } else {
        promptUrl = (voiceType === 'female') ? item.audioRuFemaleUrl : item.audioRuUrl;
        answerUrl = item.audioEnUrl;
    }

    setTimeout(() => preloadAudio(answerText, answerLang, answerUrl), 400);

    const progressCounter = document.getElementById('progress-counter');
    if (progressCounter) progressCounter.textContent = `${currentIndex + 1} / ${trainingQueue.length}`;
    
    const statusBadge = document.getElementById('status-badge');
    if (statusBadge) {
        statusBadge.textContent = "1. Слушайте слово...";
        statusBadge.className = "text-xs font-semibold px-3 py-1 rounded-full bg-emerald-200 text-emerald-900";
    }
    
    const promptWord = document.getElementById('prompt-word');
    if (promptWord) promptWord.textContent = promptText;
    
    const answerEl = document.getElementById('answer-word');
    if (answerEl) {
        answerEl.textContent = answerText;
        if (hideAnswer) {
            answerEl.classList.add('blur-sm', 'select-none', 'opacity-40');
        } else {
            answerEl.classList.remove('blur-sm', 'select-none', 'opacity-40');
        }
    }

    const timerLabel = document.getElementById('timer-label');
    const timerSeconds = document.getElementById('timer-seconds');
    const timerBar = document.getElementById('timer-bar');
    
    if (timerLabel) timerLabel.textContent = "Перевод прозвучит через:";
    if (timerSeconds) timerSeconds.textContent = `${delaySec} с`;
    if (timerBar) timerBar.style.width = '100%';

    speakText(promptText, promptLang, promptUrl, () => {
        if (!isTraining) return;
        startThinkTimer(delaySec, answerText, answerLang, answerUrl);
    });
}

function startThinkTimer(seconds, answerText, answerLang, answerUrl) {
    const statusBadge = document.getElementById('status-badge');
    if (statusBadge) {
        statusBadge.textContent = "2. Вспомните перевод...";
        statusBadge.className = "text-xs font-semibold px-3 py-1 rounded-full bg-amber-200 text-amber-800";
    }

    const totalMs = seconds * 1000;
    const startTime = Date.now();

    countdownInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, totalMs - elapsed);
        const percent = (remaining / totalMs) * 100;

        const timerBar = document.getElementById('timer-bar');
        const timerSeconds = document.getElementById('timer-seconds');
        
        if (timerBar) timerBar.style.width = `${percent}%`;
        if (timerSeconds) timerSeconds.textContent = `${Math.ceil(remaining / 1000)} с`;

        if (remaining <= 0) {
            clearInterval(countdownInterval);
            revealAndSpeakAnswer(answerText, answerLang, answerUrl);
        }
    }, 100);
}

function revealAndSpeakAnswer(answerText, answerLang, answerUrl) {
    if (!isTraining) return;

    const statusBadge = document.getElementById('status-badge');
    if (statusBadge) {
        statusBadge.textContent = "3. Правильный перевод:";
        statusBadge.className = "text-xs font-semibold px-3 py-1 rounded-full bg-emerald-200 text-emerald-800";
    }
    
    const timerLabel = document.getElementById('timer-label');
    const timerSeconds = document.getElementById('timer-seconds');
    if (timerLabel) timerLabel.textContent = "Следующее слово...";
    if (timerSeconds) timerSeconds.textContent = "";

    const answerEl = document.getElementById('answer-word');
    if (answerEl) answerEl.classList.remove('blur-sm', 'select-none', 'opacity-40');

    speakText(answerText, answerLang, answerUrl, () => {
        if (!isTraining) return;
        nextStepTimeout = setTimeout(() => {
            currentIndex++;
            runStep();
        }, 1500);
    });
}

function repeatCurrentWord() {
    if (!isTraining) return;
    runStep();
}

function skipToNext() {
    if (!isTraining) return;
    clearTimers();
    currentIndex++;
    runStep();
}

function clearTimers() {
    if (countdownInterval) clearInterval(countdownInterval);
    if (nextStepTimeout) clearTimeout(nextStepTimeout);
    if (activeAudio) activeAudio.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function stopTraining() {
    isTraining = false;
    clearTimers();
    const trainingScreen = document.getElementById('training-screen');
    const setupScreen = document.getElementById('setup-screen');
    if (trainingScreen) trainingScreen.classList.add('hidden');
    if (setupScreen) setupScreen.classList.remove('hidden');
}

// --- СОХРАНЕНИЕ И ВОССТАНОВЛЕНИЕ НАСТРОЕК ---
function saveUserSettings() {
    const folderSelect = document.getElementById('folder-select');
    const voiceSelect = document.getElementById('voiceSelect');
    const directionSelect = document.getElementById('direction-select');
    const delaySelect = document.getElementById('delay-select');
    const modeSelect = document.getElementById('mode-select');
    const shuffleCheck = document.getElementById('shuffle-check');
    const hideAnswerCheck = document.getElementById('hide-answer-check');

    if (folderSelect) localStorage.setItem('user_folder', folderSelect.value);
    if (voiceSelect) localStorage.setItem('user_voice', voiceSelect.value);
    if (directionSelect) localStorage.setItem('user_direction', directionSelect.value);
    if (delaySelect) localStorage.setItem('user_delay', delaySelect.value);
    if (modeSelect) localStorage.setItem('user_mode', modeSelect.value);
    if (shuffleCheck) localStorage.setItem('user_shuffle', shuffleCheck.checked);
    if (hideAnswerCheck) localStorage.setItem('user_hide_answer', hideAnswerCheck.checked);
}

function loadUserSettings() {
    try {
        if (localStorage.getItem('user_folder')) {
            const el = document.getElementById('folder-select');
            if (el && el.querySelector(`option[value="${localStorage.getItem('user_folder')}"]`)) {
                el.value = localStorage.getItem('user_folder');
                currentFolder = el.value;
                renderUI();
            }
        }
        if (localStorage.getItem('user_voice')) {
            const el = document.getElementById('voiceSelect');
            if (el) el.value = localStorage.getItem('user_voice');
        }
        if (localStorage.getItem('user_direction')) {
            const el = document.getElementById('direction-select');
            if (el) el.value = localStorage.getItem('user_direction');
        }
        if (localStorage.getItem('user_delay')) {
            const el = document.getElementById('delay-select');
            if (el) el.value = localStorage.getItem('user_delay');
        }
        if (localStorage.getItem('user_mode')) {
            const el = document.getElementById('mode-select');
            if (el) el.value = localStorage.getItem('user_mode');
        }
        if (localStorage.getItem('user_shuffle') !== null) {
            const el = document.getElementById('shuffle-check');
            if (el) el.checked = localStorage.getItem('user_shuffle') === 'true';
        }
        if (localStorage.getItem('user_hide_answer') !== null) {
            const el = document.getElementById('hide-answer-check');
            if (el) el.checked = localStorage.getItem('user_hide_answer') === 'true';
        }
    } catch (e) {
        console.error("Ошибка загрузки настроек:", e);
    }
}

// Автоматически сохранять настройки при изменениях в интерфейсе
document.addEventListener('change', (event) => {
    if (['folder-select', 'voiceSelect', 'direction-select', 'delay-select', 'mode-select', 'shuffle-check', 'hide-answer-check'].includes(event.target.id)) {
        saveUserSettings();
    }
});

// --- ЗАПУСК ---
initApp();
