// ========================================================
// 1. ИНИЦИАЛИЗАЦИЯ ДАННЫХ И АВТОНОМНОЕ СОХРАНЕНИЕ
// ========================================================

let currentLanguage = 'en'; 
let activeTopicId = null;    
let availableVoices = [];    

let appData = { en: [], et: [] };

// Стандартные заготовки слов при самом первом открытии сайта
const defaultAppData = {
    en: [
        {
            id: 1,
            name: "🔥 Глаголы",
            words: [
                { id: 101, foreign: "abilities", russian: "способности", customAudio: null },
                { id: 102, foreign: "environment", russian: "окружающая среда", customAudio: null }
            ]
        }
    ],
    et: []
};

let mediaRecorder = null;
let audioChunks = [];
let recordingWordId = null;
let isTraining = false;
let wordTimeout = null;
let countdownInterval = null;

// Главный старт приложения при загрузке страницы
function initApp() {
    console.log("Приложение успешно запущено в автономном режиме!");
    const savedLang = localStorage.getItem('my_dictionary_current_lang') || 'en';
    
    const localDb = localStorage.getItem('dict_local_db_all');
    if (localDb) {
        try {
            appData = JSON.parse(localDb);
        } catch(e) {
            appData = JSON.parse(JSON.stringify(defaultAppData));
        }
    } else {
        appData = JSON.parse(JSON.stringify(defaultAppData));
        saveData();
    }
    
    switchLanguage(savedLang); 
    loadTrainerSettings();
}

// Запись текущего состояния словаря в постоянную память браузера
function saveData() {
    localStorage.setItem('my_dictionary_current_lang', currentLanguage);
    localStorage.setItem('dict_local_db_all', JSON.stringify(appData));
}
// ========================================================
// 2. ФУНКЦИИ ИМПОРТА И ЭКСПОРТА (TXT) - ИСПРАВЛЕНО ДЛЯ ЛОКАЛЬНОГО СТАРТА
// ========================================================

function exportAllDataToTXT() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my_dictionary_backup.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("📥 Полный бэкап словаря сохранен!");
}

function exportCurrentFolderToTXT() {
    if (!activeTopicId) return;
    const currentTopics = appData[currentLanguage] || [];
    const activeTopic = currentTopics.find(t => t.id === activeTopicId);
    if (!activeTopic) return;
    
    const dataStr = JSON.stringify(activeTopic, null, 2);
    const blob = new Blob([dataStr], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `тема_${activeTopic.name}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert(`📥 Тема "${activeTopic.name}" сохранена!`);
}

// ИСПРАВЛЕНО: Добавлен индекс [0] для стабильного чтения локального файла в Chrome
function importAllDataFromTXT(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            if (parsedData && (parsedData.en || parsedData.et)) {
                appData = parsedData;
                saveData();
                renderTopics();
                if (document.getElementById('folderContentBlock')) document.getElementById('folderContentBlock').style.display = 'none';
                alert("🔄 Все данные успешно восстановлены!");
            }
        } catch (err) { alert("❌ Ошибка чтения файла бэкапа! Убедитесь, что это правильный .txt файл."); }
        event.target.value = "";
    };
    reader.readAsText(files[0]); // Строго указываем первый файл
}

// ИСПРАВЛЕНО: Добавлен индекс [0] для импорта одной папки с жесткого диска
function importSingleFolderFromTXT(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsedTopic = JSON.parse(e.target.result);
            if (parsedTopic && parsedTopic.name && Array.isArray(parsedTopic.words)) {
                parsedTopic.id = Date.now();
                if (!appData[currentLanguage]) appData[currentLanguage] = [];
                appData[currentLanguage].push(parsedTopic);
                saveData();
                renderTopics();
                alert(`➕ Тема "${parsedTopic.name}" успешно добавлена!`);
            }
        } catch (err) { alert("❌ Ошибка чтения файла темы!"); }
        event.target.value = "";
    };
    reader.readAsText(files[0]); // Строго указываем первый файл
}

// ========================================================
// 3. УПРАВЛЕНИЕ ЯЗЫКАМИ И ПАПКАМИ
// ========================================================

function switchLanguage(lang) {
    currentLanguage = lang;
    activeTopicId = null; 
    const tabEn = document.getElementById('tab-en');
    const tabEt = document.getElementById('tab-et');
    if (tabEn) tabEn.classList.toggle('active', lang === 'en');
    if (tabEt) tabEt.classList.toggle('active', lang === 'et');
    if (document.getElementById('folderContentBlock')) document.getElementById('folderContentBlock').style.display = 'none';
    localStorage.setItem('my_dictionary_current_lang', currentLanguage);
    renderTopics(); 
}

function renderTopics() {
    const container = document.getElementById('topicsContainer');
    if (!container) return;
    container.innerHTML = '';
    const currentTopics = appData[currentLanguage] || [];
    if (currentTopics.length === 0) {
        container.innerHTML = '<p style="color:#64748b; font-size:14px; grid-column:span 3;">Папок пока нет. Создай первую тему выше!</p>';
        return;
    }
    currentTopics.forEach(topic => {
        const folder = document.createElement('div');
        folder.className = `topic-folder ${activeTopicId === topic.id ? 'active' : ''}`;
        folder.onclick = (e) => {
            if (e.target.classList.contains('btn-delete-folder')) return;
            openTopic(topic.id);
        };
        folder.innerHTML = `
            <button class="btn-delete-folder" onclick="deleteTopic(${topic.id})">❌</button>
            <span class="folder-icon">📁</span>
            <span class="folder-name">${topic.name}</span>
        `;
        container.appendChild(folder);
    });
}

function createTopic() {
    const input = document.getElementById('newTopicInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) { alert("Введи название папки!"); return; }
    const newTopic = { id: Date.now(), name: name, words: [] };
    if (!appData[currentLanguage]) appData[currentLanguage] = [];
    appData[currentLanguage].push(newTopic);
    input.value = ''; 
    saveData();     
    renderTopics(); 
}

function deleteTopic(id) {
    if (!confirm("Удалить эту папку и все слова внутри неё?")) return;
    appData[currentLanguage] = appData[currentLanguage].filter(t => t.id !== id);
    if (activeTopicId === id) {
        activeTopicId = null;
        if (document.getElementById('folderContentBlock')) document.getElementById('folderContentBlock').style.display = 'none';
    }
    saveData(); 
    renderTopics();
}

function renameActiveTopic() {
    const currentTopics = appData[currentLanguage] || [];
    const topic = currentTopics.find(t => t.id === activeTopicId);
    if (!topic) return;
    const newName = prompt("Введи новое название для этой папки:", topic.name);
    if (newName && newName.trim() !== "") {
        topic.name = newName.trim();
        if (document.getElementById('activeFolderName')) document.getElementById('activeFolderName').innerText = topic.name;
        saveData(); 
        renderTopics(); 
    }
}
// ========================================================
// 4. РАБОТА СО СЛОВАМИ И ЗАПИСЬ ГОЛОСА
// ========================================================

function openTopic(id) {
    activeTopicId = id;
    const topic = appData[currentLanguage].find(t => t.id === id);
    if (!topic) return;
    if (document.getElementById('activeFolderName')) document.getElementById('activeFolderName').innerText = topic.name;
    if (document.getElementById('folderContentBlock')) document.getElementById('folderContentBlock').style.display = 'block';
    renderTopics(); 
    renderWords();  
}

function renderWords() {
    const container = document.getElementById('wordsContainer');
    if (!container) return;
    container.innerHTML = '';
    const topic = appData[currentLanguage].find(t => t.id === activeTopicId);
    if (!topic || topic.words.length === 0) {
        container.innerHTML = '<p style="color:#64748b; font-size:14px; padding:10px 0;">В этой папке пока пусто. Добавь слова ниже!</p>';
        return;
    }
    topic.words.forEach(w => {
        const item = document.createElement('div');
        item.className = 'word-item';
        const hasVoice = w.customAudio ? '🔊 Послушать' : '🎙 Записать';
        const retryButton = w.customAudio ? `<button class="btn-mic" style="background: #e2e8f0; color: #475569; margin-right: 5px;" onclick="resetVoice(${w.id})">🔄 Перезаписать</button>` : '';
        item.innerHTML = `
            <div style="text-align: left;"><strong>${w.foreign}</strong> — <span style="color:#64748b;">${w.russian}</span></div>
            <div class="word-actions">
                ${retryButton}
                <button class="btn-mic" id="mic-btn-${w.id}" onclick="handleVoiceAction(${w.id})">${hasVoice}</button>
                <button class="btn-delete-word" onclick="deleteWord(${w.id})">🗑️</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function addWordToTopic() {
    const foreignInput = document.getElementById('foreignWordInput');
    const russianInput = document.getElementById('russianWordInput');
    if (!foreignInput || !russianInput) return;
    const foreignText = foreignInput.value.trim();
    const russianText = russianInput.value.trim();
    if (!foreignText || !russianText) { alert("Заполни оба поля!"); return; }
    const topic = appData[currentLanguage].find(t => t.id === activeTopicId);
    if (topic) {
        topic.words.push({ id: Date.now(), foreign: foreignText, russian: russianText, customAudio: null });
        foreignInput.value = '';
        russianInput.value = '';
        saveData(); 
        renderWords(); 
    }
}

function deleteWord(wordId) {
    const topic = appData[currentLanguage].find(t => t.id === activeTopicId);
    if (topic) {
        topic.words = topic.words.filter(w => w.id !== wordId);
        saveData(); 
        renderWords();
    }
}

function resetVoice(wordId) {
    const topic = appData[currentLanguage].find(t => t.id === activeTopicId);
    const word = topic ? topic.words.find(w => w.id === wordId) : null;
    if (word) { word.customAudio = null; saveData(); renderWords(); }
}

function handleVoiceAction(wordId) {
    const topic = appData[currentLanguage].find(t => t.id === activeTopicId);
    const word = topic ? topic.words.find(w => w.id === wordId) : null;
    if (word && word.customAudio) {
        const btn = document.getElementById(`mic-btn-${wordId}`);
        if (btn) { btn.innerText = "🎵 Идет звук..."; btn.style.background = "#3b82f6"; }
        const audio = new Audio(word.customAudio);
        audio.play();
        audio.onended = function() { if (btn) { btn.innerText = "🔊 Послушать"; btn.style.background = ""; } };
    } else { toggleRecord(wordId); }
}

async function toggleRecord(wordId) {
    const btn = document.getElementById(`mic-btn-${wordId}`);
    if (!btn) return;
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        recordingWordId = wordId; audioChunks = [];
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = function() {
                    const topic = appData[currentLanguage].find(t => t.id === activeTopicId);
                    const word = topic ? topic.words.find(w => w.id === recordingWordId) : null;
                    if (word) { word.customAudio = reader.result; saveData(); renderWords(); }
                };
            };
            mediaRecorder.start(); btn.innerText = "🛑 Стоп"; btn.style.background = "#ef4444";
        } catch (err) { alert("Микрофон недоступен."); }
    } else { mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t => t.stop()); }
}
// ========================================================
// 5. ПОДГОТОВКА РОБОТОВ ОЗВУЧКИ И ПАМЯТЬ НАСТРОЕК
// ========================================================

function populateVoiceList() {
    if (typeof speechSynthesis === 'undefined') return;
    availableVoices = window.speechSynthesis.getVoices();
    console.log("Голоса синтезатора успешно обновлены. Всего доступно:", availableVoices.length);

    const voiceSelect = document.getElementById('voiceSelectNew');
    if (!voiceSelect) return;
    
    const savedVoiceName = localStorage.getItem('trainer_saved_voice_name');
    voiceSelect.innerHTML = '';

    const filtered = availableVoices.filter(v => {
        const l = v.lang.toLowerCase();
        return l.startsWith('en') || l.startsWith('et') || l.startsWith('ru');
    });

    const toDisplay = filtered.length > 0 ? filtered : availableVoices;

    const autoOption = document.createElement('option');
    autoOption.textContent = "✨ Автоматический подбор ИИ-голосов";
    autoOption.value = "auto_best";
    if (!savedVoiceName || savedVoiceName === "auto_best") autoOption.selected = true;
    voiceSelect.appendChild(autoOption);

    toDisplay.forEach(voice => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`;
        option.value = voice.name;
        if (savedVoiceName && voice.name === savedVoiceName) {
            option.selected = true;
        }
        voiceSelect.appendChild(option);
    });
}

let voiceCheckInterval = setInterval(() => {
    if (typeof speechSynthesis !== 'undefined' && window.speechSynthesis.getVoices().length > 0) {
        populateVoiceList(); clearInterval(voiceCheckInterval);
    }
}, 300);

if (typeof speechSynthesis !== 'undefined' && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
        populateVoiceList(); clearInterval(voiceCheckInterval);
    };
}
setTimeout(populateVoiceList, 500);

function saveTrainerSettings() {
    const speedInput = document.getElementById('speedRangeNew');
    const pauseInput = document.getElementById('pauseRangeNew');
    const modeSelect = document.getElementById('modeSelectNew');
    const voiceSelect = document.getElementById('voiceSelectNew');

    if (speedInput) localStorage.setItem('trainer_saved_speed', speedInput.value);
    if (pauseInput) localStorage.setItem('trainer_saved_pause', pauseInput.value);
    if (modeSelect) localStorage.setItem('trainer_saved_mode', modeSelect.value);
    if (voiceSelect && voiceSelect.value) localStorage.setItem('trainer_saved_voice_name', voiceSelect.value);
}

function loadTrainerSettings() {
    const speedInput = document.getElementById('speedRangeNew');
    const pauseInput = document.getElementById('pauseRangeNew');
    const modeSelect = document.getElementById('modeSelectNew');

    const savedSpeed = localStorage.getItem('trainer_saved_speed');
    const savedPause = localStorage.getItem('trainer_saved_pause');
    const savedMode = localStorage.getItem('trainer_saved_mode');

    if (savedSpeed && speedInput) { speedInput.value = savedSpeed; if(document.getElementById('speedValue')) document.getElementById('speedValue').innerText = savedSpeed; }
    if (savedPause && pauseInput) { pauseInput.value = savedPause; if(document.getElementById('pauseValue')) document.getElementById('pauseValue').innerText = savedPause; }
    if (savedMode && modeSelect) modeSelect.value = savedMode;
    populateVoiceList(); 
}

document.addEventListener("change", (e) => {
    if (e.target && ['speedRangeNew', 'pauseRangeNew', 'modeSelectNew', 'voiceSelectNew'].includes(e.target.id)) saveTrainerSettings();
});
// ========================================================
// 6. ЛОГИКА ТРЕНАЖЁРА И ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ========================================================

function toggleTraining() { if (isTraining) stopTraining(); else startTraining(); }

function startTraining() {
    const topic = appData[currentLanguage].find(t => t.id === activeTopicId);
    if (!topic || topic.words.length === 0) { alert("В этой папке нет слов для тренировки!"); return; }
    isTraining = true; saveTrainerSettings();
    if(document.getElementById('mainScreen')) document.getElementById('mainScreen').style.display = 'none';
    if(document.getElementById('trainerScreen')) document.getElementById('trainerScreen').style.display = 'block';
    nextTrainingStep();
}

function stopTraining() {
    isTraining = false; clearTimeout(wordTimeout); clearInterval(countdownInterval);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if(document.getElementById('mainScreen')) document.getElementById('mainScreen').style.display = 'block';
    if(document.getElementById('trainerScreen')) document.getElementById('trainerScreen').style.display = 'none';
}

function nextTrainingStep() {
    if (!isTraining) return;
    const topic = appData[currentLanguage].find(t => t.id === activeTopicId);
    if (!topic || topic.words.length === 0) { stopTraining(); return; }

    const randomWord = topic.words[Math.floor(Math.random() * topic.words.length)];
    const speedInput = document.getElementById('speedRangeNew');
    const pauseInput = document.getElementById('pauseRangeNew');
    const modeSelect = document.getElementById('modeSelectNew');
    const voiceSelect = document.getElementById('voiceSelectNew');
    
    const currentSpeed = speedInput ? parseFloat(speedInput.value) : 1.0;
    const userPauseSeconds = pauseInput ? parseInt(pauseInput.value) : 3;
    const currentMode = modeSelect ? modeSelect.value : 'foreign-ru';

    if(document.getElementById('translationDisplay')) document.getElementById('translationDisplay').innerText = "";

    // 1. Четко определяем текстовое содержимое для каждого шага
    let firstSpeechText = currentMode === 'foreign-ru' ? randomWord.foreign : randomWord.russian;
    let firstSpeechLang = currentMode === 'foreign-ru' ? (currentLanguage === 'en' ? 'en-US' : 'et-EE') : 'ru-RU';
    
    let secondSpeechText = currentMode === 'foreign-ru' ? randomWord.russian : randomWord.foreign;
    let secondSpeechLang = currentMode === 'foreign-ru' ? 'ru-RU' : (currentLanguage === 'en' ? 'en-US' : 'et-EE');

    if(document.getElementById('wordDisplay')) document.getElementById('wordDisplay').innerText = firstSpeechText;

    // УМНЫЙ АВТОПОДБОР РОБОТОВ НА ЛЕТУ ДЛЯ КАЖДОГО СЛОВА ОТДЕЛЬНО
    function speakWithRobot(text, targetLang) {
        if (typeof speechSynthesis === 'undefined') return;
        window.speechSynthesis.cancel(); // Сбрасываем старые зависшие хвосты звука

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = currentSpeed;
        
        const allVoices = window.speechSynthesis.getVoices();
        const shortLang = targetLang.substring(0, 2).toLowerCase();
        
        let selectedVoice = null;
        
        // А. Если пользователь выбрал конкретного робота вручную из списка
        if (voiceSelect && voiceSelect.value && voiceSelect.value !== 'auto_best') {
            const userVoice = allVoices.find(v => v.name === voiceSelect.value);
            if (userVoice && userVoice.lang.toLowerCase().startsWith(shortLang)) {
                selectedVoice = userVoice;
            }
        }
        
        // Б. ФИРМЕННАЯ СХЕМА АВТОПОДБОРА (Пересчитывается для каждого шага!)
        if (!selectedVoice) {
            if (shortLang === 'en') {
                // Английский: ищем сочные премиальные мужские голоса Natural/Premium или Microsoft David/Ryan
                selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith('en') && v.name.includes('Male') && (v.name.includes('Natural') || v.name.includes('Premium')));
                if (!selectedVoice) selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith('en') && (v.name.includes('David') || v.name.includes('Ryan') || v.name.includes('Guy') || v.name.includes('James')));
                if (!selectedVoice) selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith('en') && v.name.includes('Male'));
            } 
            else if (shortLang === 'ru') {
                // Русский: Строго ищем Microsoft Maksim (эталонный системный аналог Алисы) или Dmitry/Anton/Google Male
                selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith('ru') && (v.name.includes('Maksim') || v.name.includes('Maxim')));
                if (!selectedVoice) selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith('ru') && (v.name.includes('Dmitry') || v.name.includes('Anton') || v.name.includes('Pavel')));
                if (!selectedVoice) selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith('ru') && v.name.includes('Google') && !v.name.includes('Female'));
                if (!selectedVoice) selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith('ru') && v.name.includes('Male'));
            } 
            else if (shortLang === 'et') {
                // Эстонский: Целенаправленно ищем официальный пакет Mari от EKI, Johannes или Tõnu для идеальных ударений
                selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith('et') && (v.name.includes('Mari') || v.name.includes('Eki') || v.name.includes('Estonian Mari')));
                if (!selectedVoice) selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith('et') && (v.name.includes('Johannes') || v.name.includes('Tõnu') || v.name.includes('Kert')));
            }
            
            // Если идеальный носитель на устройстве не найден, берем любой лучший для этого языка
            if (!selectedVoice) {
                selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith(shortLang) && (v.name.includes('Natural') || v.name.includes('Premium')));
                if (!selectedVoice) selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith(shortLang) && v.name.includes('Google'));
                if (!selectedVoice) selectedVoice = allVoices.find(v => v.lang.toLowerCase().startsWith(shortLang));
            }
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            if(document.getElementById('audioTypeDisplay')) document.getElementById('audioTypeDisplay').innerText = `🤖 Озвучка: ${selectedVoice.name}`;
        } else {
            utterance.lang = targetLang;
            if(document.getElementById('audioTypeDisplay')) document.getElementById('audioTypeDisplay').innerText = "🤖 Стандартный робот";
        }
        
        window.speechSynthesis.speak(utterance);
    }

    // --- ШАГ 1: Произносим само слово ---
    if (currentMode === 'foreign-ru' && randomWord.customAudio) {
        if(document.getElementById('audioTypeDisplay')) document.getElementById('audioTypeDisplay').innerText = "🎤 Звучит твой голос";
        const audio = new Audio(randomWord.customAudio);
        audio.playbackRate = currentSpeed;
        audio.play().catch(() => speakWithRobot(firstSpeechText, firstSpeechLang));
    } else { 
        speakWithRobot(firstSpeechText, firstSpeechLang); 
    }

    // Таймер ожидания перевода
    let secondsLeft = userPauseSeconds;
    if(document.getElementById('timerDisplay')) document.getElementById('timerDisplay').innerText = `Вспомни перевод... (${secondsLeft} сек)`;
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0 && document.getElementById('timerDisplay')) {
            document.getElementById('timerDisplay').innerText = `Вспомни перевод... (${secondsLeft} сек)`;
        } else {
            clearInterval(countdownInterval);
        }
    }, 1000);

    // --- ШАГ 2: Пауза прошла, произносим перевод ---
    clearTimeout(wordTimeout);
    wordTimeout = setTimeout(() => {
        if (!isTraining) return;
        if(document.getElementById('translationDisplay')) document.getElementById('translationDisplay').innerText = secondSpeechText;
        if(document.getElementById('timerDisplay')) document.getElementById('timerDisplay').innerText = "Правильно!";

        if (currentMode === 'ru-foreign' && randomWord.customAudio) {
            const audio = new Audio(randomWord.customAudio);
            audio.playbackRate = currentSpeed;
            audio.play().catch(() => speakWithRobot(secondSpeechText, secondSpeechLang));
        } else { 
            speakWithRobot(secondSpeechText, secondSpeechLang); 
        }

        // Переход к следующей карточке слова через 2.5 секунды
        wordTimeout = setTimeout(() => { if (isTraining) nextTrainingStep(); }, 2500);
    }, userPauseSeconds * 1000);
}

// Безопасный запуск приложения после полной загрузки дерева HTML
document.addEventListener("DOMContentLoaded", () => { 
    initApp(); 
    loadTrainerSettings(); 
});
