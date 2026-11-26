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
async function triggerInstantSync() {
    const GITHUB_USERNAME = 'Natuusik';
    const REPO_NAME = 'my-dictionary';
    const TOKEN = 'ваш_токен_сюда'; // Тот самый токен, который вы создали в настройках GitHub

    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/dispatches`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ event_type: 'trigger-sync' })
        });

        if (response.ok) {
            alert("🚀 Сигнал отправлен! Озвучка сгенерируется через 10–15 секунд. Обновите страницу.");
        } else {
            alert("Ошибка при запуске синхронизации.");
        }
    } catch (err) {
        console.error(err);
        alert("Не удалось связаться с GitHub API.");
    }
}
// Инициализация подключения к Supabase
async function initSupabase() {
    const statusBadge = document.getElementById('db-status');
    if (SUPABASE_URL.includes('ВАШ_ПРОЕКТ')) {
        statusBadge.textContent = "Нет ключей API";
        statusBadge.className = "text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full";
        renderUI();
        return;
    }

    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        await loadFromDatabase();
        statusBadge.textContent = "Онлайн (БД)";
        statusBadge.className = "text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full";
    } catch (err) {
        console.error("Ошибка Supabase:", err);
        statusBadge.textContent = "Ошибка БД";
        statusBadge.className = "text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full";
    }
}

// Функция для получения выбранного голоса
function getCurrentVoiceType() {
    const select = document.getElementById('voiceSelect');
    return select ? select.value : 'pro'; // по умолчанию 'pro' (мужской)
}

// Функция воспроизведения аудио слова с учетом выбранного голоса
function playWordAudio(wordItem) {
    const voiceType = getCurrentVoiceType(); // 'pro' или 'female'
    
    let audioUrl = '';
    
    if (voiceType === 'female') {
        audioUrl = wordItem.audioRuFemaleUrl; // Женская версия
    } else {
        audioUrl = wordItem.audioRuUrl; // Мужская версия (основная)
    }
    
    if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().catch(e => console.log("Ошибка воспроизведения:", e));
    }
}

// Загрузка всех слов и папок из таблицы Supabase
async function loadFromDatabase() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('words_dictation')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        alert("Ошибка загрузки из Supabase: " + error.message);
        return;
    }

    const grouped = {};
    if (data && data.length > 0) {
        data.forEach(row => {
            if (!grouped[row.folder_name]) {
                grouped[row.folder_name] = [];
            }
            grouped[row.folder_name].push({
                id: row.id,
                en: row.word_en,
                ru: row.word_ru || '',
                audioEnUrl: row.audio_en_url,
                audioRuUrl: row.audio_ru_url,
                audioRuFemaleUrl: row.audio_ru_female_url // Поддержка женской озвучки
            });
        });
        foldersMap = grouped;
        if (!foldersMap[currentFolder]) {
            currentFolder = Object.keys(foldersMap)[0];
        }
    } else {
        foldersMap = { "Папка №1": [] };
        currentFolder = "Папка №1";
    }

    renderUI();
}

function renderUI() {
    const select = document.getElementById('folder-select');
    select.innerHTML = '';
    
    const folderNames = Object.keys(foldersMap);
    folderNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = `${name} (${foldersMap[name].length})`;
        if (name === currentFolder) option.selected = true;
        select.appendChild(option);
    });

    const listContainer = document.getElementById('words-list');
    listContainer.innerHTML = '';
    const words = foldersMap[currentFolder] || [];
    
    document.getElementById('total-words-badge').textContent = `${words.length} слов`;

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
            <button onclick="deleteWord('${item.id}')" class="text-slate-400 hover:text-rose-500 px-2 font-bold">✕</button>
        `;
        listContainer.appendChild(div);
    });
}

function selectFolder() {
    currentFolder = document.getElementById('folder-select').value;
    renderUI();
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
    renderUI();
}

async function addWords() {
    const raw = document.getElementById('bulk-input').value.trim();
    if (!raw) return;

    const btn = document.getElementById('save-btn');
    btn.textContent = "⏳ Сохранение в облако...";
    btn.disabled = true;

    const lines = raw.split('\n');
    const rowsToInsert = [];

    lines.forEach(line => {
        if (!line.trim()) return;
        const parts = line.split(/[-—]/);
        const en = parts[0].trim();
        const ru = parts.slice(1).join('-').trim();
        if (en) {
            rowsToInsert.push({
                folder_name: currentFolder,
                word_en: en,
                word_ru: ru
            });
        }
    });

    if (rowsToInsert.length > 0) {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('words_dictation')
                .insert(rowsToInsert);
            
            if (error) {
                alert("Ошибка сохранения: " + error.message);
            } else {
                await loadFromDatabase();
            }
        } else {
            rowsToInsert.forEach(r => {
                foldersMap[currentFolder].push({ id: Date.now() + Math.random(), en: r.word_en, ru: r.word_ru });
            });
            renderUI();
        }
    }

    document.getElementById('bulk-input').value = '';
    btn.textContent = "☁️ Сохранить в Supabase";
    btn.disabled = false;
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

// --- ОЗВУЧКА ---
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
    if (document.getElementById('shuffle-check').checked) {
        trainingQueue.sort(() => Math.random() - 0.5);
    }

    currentIndex = 0;
    isTraining = true;

    const direction = document.getElementById('direction-select').value;
    document.getElementById('direction-badge').textContent = direction === 'en-ru' ? 'EN ➔ RU' : 'RU ➔ EN';
    document.getElementById('active-folder-title').textContent = currentFolder;

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('training-screen').classList.remove('hidden');

    runStep();
}

function runStep() {
    if (!isTraining) return;
    clearTimers();

    const mode = document.getElementById('mode-select').value;
    if (currentIndex >= trainingQueue.length) {
        if (mode === 'loop') {
            currentIndex = 0;
            if (document.getElementById('shuffle-check').checked) {
                trainingQueue.sort(() => Math.random() - 0.5);
            }
        } else {
            alert("Тренировка завершена! Все слова пройдены.");
            stopTraining();
            return;
        }
    }

    const item = trainingQueue[currentIndex];
    const direction = document.getElementById('direction-select').value;
    const hideAnswer = document.getElementById('hide-answer-check').checked;
    const delaySec = parseInt(document.getElementById('delay-select').value, 10);

    const promptText = direction === 'en-ru' ? item.en : (item.ru || item.en);
    const promptLang = direction === 'en-ru' ? 'en' : 'ru';
    const promptUrl = direction === 'en-ru' ? item.audioEnUrl : item.audioRuUrl;
    
    const answerText = direction === 'en-ru' ? (item.ru || '—') : item.en;
    const answerLang = direction === 'en-ru' ? 'ru' : 'en';
    
    // Выбираем правильный URL для русской озвучки с учетом выбранного голоса
    let answerUrl = '';
    if (direction === 'en-ru') {
        const voiceType = getCurrentVoiceType();
        answerUrl = (voiceType === 'female') ? item.audioRuFemaleUrl : item.audioRuUrl;
    } else {
        answerUrl = item.audioEnUrl;
    }

    setTimeout(() => preloadAudio(answerText, answerLang, answerUrl), 400);

    document.getElementById('progress-counter').textContent = `${currentIndex + 1} / ${trainingQueue.length}`;
    document.getElementById('status-badge').textContent = "1. Слушайте слово...";
    document.getElementById('status-badge').className = "text-xs font-semibold px-3 py-1 rounded-full bg-emerald-200 text-emerald-900";
    
    document.getElementById('prompt-word').textContent = promptText;
    
    const answerEl = document.getElementById('answer-word');
    answerEl.textContent = answerText;
    if (hideAnswer) {
        answerEl.classList.add('blur-sm', 'select-none', 'opacity-40');
    } else {
        answerEl.classList.remove('blur-sm', 'select-none', 'opacity-40');
    }

    document.getElementById('timer-label').textContent = "Перевод прозвучит через:";
    document.getElementById('timer-seconds').textContent = `${delaySec} с`;
    document.getElementById('timer-bar').style.width = '100%';

    speakText(promptText, promptLang, promptUrl, () => {
        if (!isTraining) return;
        startThinkTimer(delaySec, answerText, answerLang, answerUrl);
    });
}

function startThinkTimer(seconds, answerText, answerLang, answerUrl) {
    document.getElementById('status-badge').textContent = "2. Вспомните перевод...";
    document.getElementById('status-badge').className = "text-xs font-semibold px-3 py-1 rounded-full bg-amber-200 text-amber-800";

    const totalMs = seconds * 1000;
    const startTime = Date.now();

    countdownInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, totalMs - elapsed);
        const percent = (remaining / totalMs) * 100;

        document.getElementById('timer-bar').style.width = `${percent}%`;
        document.getElementById('timer-seconds').textContent = `${Math.ceil(remaining / 1000)} с`;

        if (remaining <= 0) {
            clearInterval(countdownInterval);
            revealAndSpeakAnswer(answerText, answerLang, answerUrl);
        }
    }, 100);
}

function revealAndSpeakAnswer(answerText, answerLang, answerUrl) {
    if (!isTraining) return;

    document.getElementById('status-badge').textContent = "3. Правильный перевод:";
    document.getElementById('status-badge').className = "text-xs font-semibold px-3 py-1 rounded-full bg-emerald-200 text-emerald-800";
    document.getElementById('timer-label').textContent = "Следующее слово...";
    document.getElementById('timer-seconds').textContent = "";

    const answerEl = document.getElementById('answer-word');
    answerEl.classList.remove('blur-sm', 'select-none', 'opacity-40');

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
    document.getElementById('training-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
}

// Запуск инициализации при открытии страницы
initSupabase();
