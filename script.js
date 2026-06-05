// ==========================================
// 1. INICJALIZACJA ZMIENNYCH GLOBALNYCH
// ==========================================
let data = [];
let termsData = [];
let vademecumData = [];
let quizData = [];
let currentQuestionIndex = 0;
let userScore = 0;
let currentActiveTopicId = null;

const matchState = {
    dateCards: [],
    eventCards: [],
    selected: [],
    matches: 0,
    totalPairs: 0,
    locked: false,
};

const flashStates = {
    dates: { currentIndex: 0, good: 0, bad: 0, badCards: [], isReviewRound: false, firstRoundBadCount: 0 },
    terms: { currentIndex: 0, good: 0, bad: 0, badCards: [], isReviewRound: false, firstRoundBadCount: 0 }
};

let activeTab = 'dates';
let _termFlipLast = 0;
let _termFlipLocked = false;

const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const setDisplay = (element, value) => {
    const el = typeof element === 'string' ? $(element) : element;
    if (el) el.style.display = value;
};

const getFlashState = type => flashStates[type] || flashStates.dates;
const getFlashData = type => (type === 'dates' ? data : termsData);
const getCurrentPool = type => getFlashState(type).isReviewRound ? getFlashState(type).badCards : getFlashData(type);

const getFlashIds = type => type === 'dates'
    ? { front: 'front', back: 'event', desc: 'desc', card: 'card', toggleText: 'toggleText', good: 'goodCount', bad: 'badCount', progressText: 'progressText', progressBar: 'progressBar' }
    : { front: 'termFront', desc: 'termDesc', card: 'termCard', good: 'goodCountTerms', bad: 'badCountTerms', progressText: 'progressTextTerms', progressBar: 'progressBarTerms' };

async function initApp() {
    const cacheBuster = '?v=' + Date.now();
    try {
        const response = await fetch('data.json' + cacheBuster);
        data = await response.json();
        if (data.length) buildCheatSheet();
    } catch (e) {
        console.error('Błąd ładowania danych:', e);
    }

    try {
        const response = await fetch('pojecia.json' + cacheBuster);
        termsData = await response.json();
        if (termsData.length) {
            termsData.sort(() => Math.random() - 0.5);
            renderFlashCard('terms');
        }
    } catch (e) {
        console.error('Błąd ładowania pliku pojecia.json:', e);
        termsData = [];
    }

    bindTermCardFlip();

    try {
        const response = await fetch('zagadnienia.json' + cacheBuster);
        vademecumData = await response.json();
        if (vademecumData.length) buildVademecum();
    } catch (e) {
        console.error('Błąd ładowania pliku zagadnienia.json:', e);
        vademecumData = [];
    }

    if (typeof checkSavedSession === 'function') checkSavedSession();
}

initApp();

function updateCountdown() {
    const examDate = new Date('July 9, 2026 12:30:00').getTime();
    const countdown = $('countdown');
    const timeLeft = examDate - Date.now();
    if (timeLeft < 0) {
        if (countdown) {
            countdown.classList.remove('pulse');
            void countdown.offsetWidth;
            countdown.classList.add('pulse');
            countdown.innerHTML = 'Egzamin już trwa / minął!';
        }
        return setDisplay('countdown', 'block');
    }

    const days = Math.floor(timeLeft / 86400000);
    const hours = Math.floor((timeLeft % 86400000) / 3600000);
    const minutes = Math.floor((timeLeft % 3600000) / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    if (countdown) {
        countdown.classList.remove('pulse');
        void countdown.offsetWidth;
        countdown.classList.add('pulse');
        countdown.innerHTML = `${days}d ${hours}g ${minutes}m ${seconds}s`;
    }
}
setInterval(updateCountdown, 1000);
updateCountdown();

function switchTab(tabId, element) {
    activeTab = tabId;
    qsa('.tab-btn').forEach(b => b.classList.remove('active'));
    qsa('.tab-content').forEach(c => c.classList.remove('active-content'));
    if (element) element.classList.add('active');
    const target = $(`tab-${tabId}`);
    if (target) target.classList.add('active-content');

    if (tabId !== 'quiz') exitQuiz();
    if (tabId !== 'match') exitMatchingPairs();
    setDisplay('globalModeToggle', tabId === 'dates' ? 'block' : 'none');
}

function renderFlashCard(type) {
    const state = getFlashState(type);
    const pool = getCurrentPool(type);
    if (!pool.length || state.currentIndex >= pool.length) return;

    const card = pool[state.currentIndex];
    const ids = getFlashIds(type);
    // Prevent brief flash of the backside of the next card by disabling
    // the flip transition while we replace content, then restore it.
    const cardElement = $(ids.card);
    const inner = cardElement?.querySelector('.card-inner');
    let prevTransition = '';
    if (cardElement) {
        cardElement.classList.add('card-changing');
    }
    if (inner) {
        prevTransition = inner.style.transition || '';
        inner.style.transition = 'none';
        inner.style.transform = 'none';
        cardElement.classList.remove('flipped');
        inner.classList.remove('flipped');
        void inner.offsetWidth;
        _termFlipLocked = true;
    }

    if (type === 'dates') {
        const reverse = $('modeToggle')?.checked;
        if ($(ids.toggleText)) $(ids.toggleText).innerText = reverse ? 'Wydarzenie ➔ Data' : 'Data ➔ Wydarzenie';
        if ($(ids.front)) $(ids.front).innerText = reverse ? card.event : card.date;
        if ($(ids.back)) $(ids.back).innerText = reverse ? card.date : card.event;
        if ($(ids.desc)) $(ids.desc).innerText = card.description;
    } else {
        if ($(ids.front)) $(ids.front).innerText = card.title;
        if ($(ids.desc)) $(ids.desc).innerHTML = `<div class="term-back-body">${card.description}</div>`;
        if (cardElement) cardElement.style.cursor = 'pointer';
    }

    // restore transition after a short tick so the next manual flip animates
    if (inner) {
        requestAnimationFrame(() => {
            inner.style.transition = prevTransition || 'transform .55s cubic-bezier(0.4, 0, 0.2, 1)';
            inner.style.transform = '';
            setTimeout(() => {
                if (cardElement) cardElement.classList.remove('card-changing');
                _termFlipLocked = false;
            }, 120);
        });
    } else if (cardElement) {
        setTimeout(() => cardElement.classList.remove('card-changing'), 120);
    }

    $(ids.card)?.classList.remove('flipped');
    updateFlashProgress(type);
    saveSession();
}

function flipCard() {
    $('card')?.classList.toggle('flipped');
}

function flipTermCard(evt) {
    const now = Date.now();
    if (now - _termFlipLast < 300) return;
    _termFlipLast = now;
    if (_termFlipLocked) { return; }
    if (evt && evt.preventDefault) try { evt.preventDefault(); evt.stopPropagation(); } catch (e) {}
    const termCard = $('termCard');
    if (!termCard) return;
    // debug: termCard exists
    const inner = termCard.querySelector('.card-inner');
    // debug: inner element present -> %s
    const flipped = termCard.classList.toggle('flipped');
    // flip toggled: %s
    if (inner) {
        inner.classList.toggle('flipped', flipped);
        inner.style.transform = flipped ? 'rotateY(180deg)' : 'none';
    }
}

function bindTermCardFlip() {
    const termCard = $('termCard');
    if (!termCard) return;
    termCard.style.cursor = 'pointer';
    // use capture to ensure the click is received even if children stop propagation
    try {
        termCard.addEventListener('click', flipTermCard, { capture: true, passive: false });
        // listener attached to #termCard
    } catch (e) {
        // fallback for older browsers
        termCard.addEventListener('click', flipTermCard);
        // listener attached (fallback) to #termCard
    }
    const inner = termCard.querySelector('.card-inner');
    const front = termCard.querySelector('.card-front');
    const back = termCard.querySelector('.card-back');
    [inner, front, back].forEach(el => {
        if (!el) return;
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
    });
}

// Ensure listener is attached even if initApp fails early
window.addEventListener('DOMContentLoaded', () => {
    try { bindTermCardFlip(); } catch (e) { /* bind failed */ }
});

// Also attempt immediate binding as script is at page end
try { bindTermCardFlip(); } catch (e) {}

function answer(correct) {
    answerFlash('dates', correct);
}

function answerTerm(correct) {
    answerFlash('terms', correct);
}

function answerFlash(type, correct) {
    const state = getFlashState(type);
    const pool = getCurrentPool(type);
    if (!pool.length || state.currentIndex >= pool.length) return;

    const card = pool[state.currentIndex];
    if (correct) state.good++; else {
        state.bad++;
        if (!state.badCards.includes(card)) state.badCards.push(card);
    }

    const ids = getFlashIds(type);
    if ($(ids.good)) $(ids.good).innerText = state.good;
    if ($(ids.bad)) $(ids.bad).innerText = state.bad;
    state.currentIndex++;

    if (state.currentIndex < pool.length) {
        renderFlashCard(type);
        return;
    }

    if (!state.isReviewRound && state.badCards.length) {
        state.firstRoundBadCount = state.badCards.length;
        state.isReviewRound = true;
        state.currentIndex = 0;
        state.good = 0;
        state.bad = 0;
        if ($(ids.good)) $(ids.good).innerText = 0;
        if ($(ids.bad)) $(ids.bad).innerText = 0;
        state.badCards.sort(() => Math.random() - 0.5);
        renderFlashCard(type);
        return;
    }

    if (type === 'dates') showFinalStatistics(); else showFinalStatsTerms();
}

function updateFlashProgress(type) {
    const state = getFlashState(type);
    const pool = getCurrentPool(type);
    const ids = getFlashIds(type);
    if (!pool.length) return;
    $(ids.progressText).innerText = `${type === 'dates' ? 'Karta' : 'Pojęcie'} ${state.currentIndex + 1} / ${pool.length}`;
    $(ids.progressBar).style.width = ((state.currentIndex + 1) / pool.length) * 100 + '%';
}

function shuffleArray(arr) {
    return arr.slice().sort(() => Math.random() - 0.5);
}

function startMatchingPairs() {
    if (!data.length) return alert('Brak danych do gry w dopasowywanie par.');
    const pairCount = Math.min(6, Math.floor(data.length));
    const chosen = shuffleArray(data).slice(0, pairCount);
    matchState.dateCards = shuffleArray(chosen.map((item, index) => ({
        id: `date-${index}`,
        matchId: index,
        label: item.date,
        type: 'date',
        matched: false,
        selected: false,
    })));
    matchState.eventCards = shuffleArray(chosen.map((item, index) => ({
        id: `event-${index}`,
        matchId: index,
        label: item.event,
        type: 'event',
        matched: false,
        selected: false,
    })));
    matchState.selected = [];
    matchState.matches = 0;
    matchState.totalPairs = pairCount;
    matchState.locked = false;

    $('matchContainer')?.classList.remove('hidden');
    $('startMatchBtn')?.classList.add('hidden');
    $('matchRestartBtn')?.classList.add('hidden');
    renderMatchBoard();
    updateMatchStatus('Znajdź parę dat i wydarzeń');
}

function exitMatchingPairs() {
    $('matchContainer')?.classList.add('hidden');
    $('startMatchBtn')?.classList.remove('hidden');
    const board = $('matchBoard');
    if (board) board.innerHTML = '';
}

function renderMatchBoard() {
    const board = $('matchBoard');
    if (!board) return;
    board.innerHTML = '';

    const leftColumn = document.createElement('div');
    leftColumn.className = 'match-column';
    leftColumn.innerHTML = '<h3>Daty</h3>';

    matchState.dateCards.forEach(card => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `match-card${card.selected ? ' selected' : ''}${card.matched ? ' matched' : ''}`;
        btn.dataset.cardId = card.id;
        btn.innerHTML = `<span>${card.label}</span>`;
        btn.onclick = () => handleMatchClick(card.id);
        leftColumn.appendChild(btn);
    });

    const rightColumn = document.createElement('div');
    rightColumn.className = 'match-column';
    rightColumn.innerHTML = '<h3>Wydarzenia</h3>';

    matchState.eventCards.forEach(card => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `match-card${card.selected ? ' selected' : ''}${card.matched ? ' matched' : ''}`;
        btn.dataset.cardId = card.id;
        btn.innerHTML = `<span>${card.label}</span>`;
        btn.onclick = () => handleMatchClick(card.id);
        rightColumn.appendChild(btn);
    });

    board.appendChild(leftColumn);
    board.appendChild(rightColumn);
}

function updateMatchStatus(message) {
    const status = $('matchStatus');
    if (!status) return;
    if (message) {
        status.innerText = message;
        return;
    }
    if (matchState.matches >= matchState.totalPairs) {
        status.innerText = `Brawo! Dopasowano wszystkie ${matchState.totalPairs} par.`;
    } else {
        status.innerText = `Pary: ${matchState.matches} / ${matchState.totalPairs}. Wybierz dwie karty.`;
    }
}

function handleMatchClick(cardId) {
    if (matchState.locked) return;
    const card = matchState.dateCards.find(c => c.id === cardId) || matchState.eventCards.find(c => c.id === cardId);
    if (!card || card.matched) return;

    // If selecting a second card of the same type, replace the first selection
    if (matchState.selected.length === 1 && matchState.selected[0].type === card.type) {
        matchState.selected[0].selected = false;
        matchState.selected = [];
    }

    card.selected = true;
    matchState.selected.push(card);
    renderMatchBoard();

    if (matchState.selected.length !== 2) {
        return;
    }

    const [first, second] = matchState.selected;
    if (first.type === second.type) {
        // Shouldn't happen, but reset just in case
        matchState.selected.forEach(c => c.selected = false);
        matchState.selected = [];
        renderMatchBoard();
        return;
    }

    if (first.matchId === second.matchId) {
        first.matched = true;
        second.matched = true;
        matchState.matches += 1;
        matchState.selected = [];
        updateMatchStatus(`Dobrze! Para ${matchState.matches} / ${matchState.totalPairs}.`);
        if (matchState.matches === matchState.totalPairs) {
            $('matchRestartBtn')?.classList.remove('hidden');
            updateMatchStatus(`Brawo! Udało się dopasować wszystkie ${matchState.totalPairs} par.`);
        }
        renderMatchBoard();
        return;
    }

    matchState.locked = true;
    updateMatchStatus('Źle. Spróbuj jeszcze raz...');
    setTimeout(() => {
        matchState.selected.forEach(c => c.selected = false);
        matchState.selected = [];
        matchState.locked = false;
        renderMatchBoard();
        updateMatchStatus();
    }, 800);
}

function showFinalStatistics() {
    localStorage.removeItem('fiszki_session');
    $('statsModalType').innerText = 'Przerobiłeś całą bazę dat!';
    $('modalTotal').innerText = data.length;
    $('modalCorrect').innerText = data.length - flashStates.dates.firstRoundBadCount;
    $('modalAccuracy').innerText = Math.round(((data.length - flashStates.dates.firstRoundBadCount) / data.length) * 100);
    setDisplay('statsModal', 'flex');
}

function showFinalStatsTerms() {
    const total = termsData.length;
    $('statsModalType').innerText = 'Przerobiłeś bazę pojęć i źródeł!';
    $('modalTotal').innerText = total;
    $('modalCorrect').innerText = total - flashStates.terms.firstRoundBadCount;
    $('modalAccuracy').innerText = Math.round(((total - flashStates.terms.firstRoundBadCount) / total) * 100);
    setDisplay('statsModal', 'flex');
}

function buildVademecum() {
    const container = $('vademecumAccordion');
    if (!container) return;
    container.innerHTML = '';
    if (!vademecumData.length) {
        container.innerHTML = "<div style='text-align:center; padding:20px; opacity:0.5;'>Brak załadowanych danych w bazie.</div>";
        return;
    }

    vademecumData.forEach((item, index) => {
        const accItem = document.createElement('div');
        accItem.className = 'accordion-item';
        const header = item.topic || item.title || item.zagadnienie || item.temat || 'Brak tematu';
        const content = item.content || item.description || item.tresc || item.zawartosc || 'Brak treści';
        let summary = item.summary || '';

        if (summary.includes('Konsolidacja Galii')) {
            summary = 'Konsolidacja Galii, sojusz z Kościołem katolickim i budowa potęgi militarnej, która położyła podwaliny pod imperium Karolingów.';
        } else if (summary.includes('Wielkie ruchy dysydenckie')) {
            summary = 'Wielkie ruchy dysydenckie negujące bogactwo Kościoła, które doprowadziły do reakcji papiestwa i powołania instytucji inkwizycyjnej.';
        }

        const topicId = item.id || index + 1;
        accItem.innerHTML = `
            <div class="accordion-header" onclick="toggleAccordion(${index})">
                <span>📌 ${header}</span>
            </div>
            <div class="accordion-body" id="acc-body-${index}">
                <div class="acc-content-inner">
                    ${summary ? `<p class="vademecum-intro" style="font-style: italic; color: #a29bfe; margin-bottom: 15px; font-size: 1.05rem; line-height: 1.5; border-left: 3px solid #6c5ce7; padding-left: 10px;">${summary}</p>` : ''}
                    <div>${content}</div>
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 15px 0;">
                    <button onclick="startMiniQuiz(${topicId})" class="show-btn" style="background: #fbbf24; color: #0f172a; font-weight: bold; width: 100%; padding: 10px; font-size: 0.95rem; border-radius: 6px; cursor: pointer;">
                        📝 Sprawdź się: Uruchom mini-quiz z tego zagadnienia (5 pytań)
                    </button>
                </div>
            </div>
        `;
        container.appendChild(accItem);
    });
}

function toggleAccordion(index) {
    const body = $(`acc-body-${index}`);
    if (!body) return;
    const header = body.previousElementSibling;
    const open = body.classList.contains('open');
    qsa('.accordion-body').forEach(b => b.classList.remove('open'));
    qsa('.accordion-header').forEach(h => h.classList.remove('active'));
    if (!open) {
        body.classList.add('open');
        if (header) header.classList.add('active');
    }
}

function toggleAccordionFixed(index, headerElement) {
    toggleAccordion(index);
    setTimeout(() => {
        const item = headerElement.closest('.accordion-item');
        const summary = headerElement.querySelector('.acc-summary');
        if (!item || !summary) return;
        if (item.classList.contains('active')) {
            summary.style.opacity = '0';
            summary.style.pointerEvents = 'none';
            setTimeout(() => { summary.style.display = 'none'; }, 200);
        } else {
            summary.style.display = 'inline';
            setTimeout(() => { summary.style.opacity = '0.5'; summary.style.pointerEvents = 'auto'; }, 10);
        }
    }, 50);
}

function searchVademecum() {
    const query = $('vademecumSearch')?.value.toLowerCase() || '';
    qsa('.accordion-item').forEach(item => item.style.display = item.innerText.toLowerCase().includes(query) ? '' : 'none');
}

function setQuizMode(showQuiz) {
    ['vademecumAccordion', 'vademecumSearch', 'startQuizBtn'].forEach(id => setDisplay(id, showQuiz ? 'none' : 'block'));
    const quizContainer = $('quizContainer');
    if (quizContainer) {
        quizContainer.classList.toggle('hidden', !showQuiz);
        setDisplay(quizContainer, showQuiz ? 'block' : 'none');
    }
    const backBtn = $('backToTopicsBtn');
    if (backBtn) {
        backBtn.classList.toggle('hidden', !showQuiz);
        setDisplay('backToTopicsBtn', showQuiz ? 'inline-block' : 'none');
    }
    const hint = qs('#tab-quiz p');
    if (hint) hint.style.display = showQuiz ? 'none' : 'block';
}

function normalizeQuizData(rawData) {
    if (Array.isArray(rawData) && rawData.length === 1 && rawData[0] && typeof rawData[0] === 'object' && !Array.isArray(rawData[0])) {
        return rawData[0];
    }
    if (Array.isArray(rawData)) {
        const merged = {};
        rawData.forEach(item => {
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                Object.assign(merged, item);
            }
        });
        return merged;
    }
    return rawData;
}

function exitQuiz() {
    setQuizMode(false);
    currentActiveTopicId = null;
}

async function startQuiz() {
    if (!window.fullQuizData) {
        const response = await fetch('testy.json?v=' + Date.now());
        window.fullQuizData = normalizeQuizData(await response.json());
    }
    const allQuestions = Object.values(window.fullQuizData).flat();
    quizData = allQuestions;
    if (!quizData.length) return alert('Błąd: Nie udało się wczytać pytań.');
    quizData.sort(() => Math.random() - 0.5);
    quizData = quizData.slice(0, 10);
    currentQuestionIndex = 0;
    userScore = 0;
    setQuizMode(true);
    showQuestion();
}

async function startMiniQuiz(topicId) {
    currentActiveTopicId = topicId;
    if (!window.fullQuizData) {
        const response = await fetch('testy.json?v=' + Date.now());
        window.fullQuizData = normalizeQuizData(await response.json());
    }
    const questions = window.fullQuizData[String(topicId)];
    if (!Array.isArray(questions)) return alert(`Brak dedykowanych pytań dla tematu nr ${topicId}.`);
    quizData = questions.sort(() => Math.random() - 0.5).slice(0, 5);
    currentQuestionIndex = 0;
    userScore = 0;
    const quizTabButton = document.querySelector(".tab-btn[onclick*='quiz']") || document.querySelector(".tab-btn[onclick*='tests']");
    switchTab('quiz', quizTabButton);
    setQuizMode(true);
    showQuestion();
}

function renderQuizResult() {
    $('quizProgress').innerText = '🏁 Koniec testu!';
    const percentage = (userScore / quizData.length) * 100;
    const isMini = currentActiveTopicId !== null;
    const sentiment = percentage < 50
        ? ['❌ Chuja umiesz, ucz się dalej! Z taką wiedzą nawet nie podchodź.', '#ef4444']
        : percentage < 80
            ? ['⚠️ No ja nie wiem, czy z taką wiedzą zdasz u Lenartowicz... Może być ciężko. Powtórz materiał!', '#f59e0b']
            : ['👑 Potęga! Lenartowicz pęka z dumy. Jesteś absolutnym mistrzem średniowiecza!', '#10b981'];

    $('quizQuestion').innerHTML = `
        <div style="text-align: center; margin-bottom: 15px;">
            Twój wynik to: <span style="font-size: 2rem; font-weight: bold; color: ${sentiment[1]};">${userScore} / ${quizData.length}</span> (${Math.round(percentage)}%)
        </div>
        <p style="text-align: center; font-size: 1.15rem; font-weight: 500; color: ${sentiment[1]}; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
            ${sentiment[0]}
        </p>
    `;

    const answersDiv = $('quizAnswers');
    answersDiv.innerHTML = '';
    const retryBtn = document.createElement('button');
    retryBtn.className = 'show-btn';
    retryBtn.style.cssText = 'background: #fbbf24; color: #0f172a; font-weight: bold; font-size: 1.1rem; padding: 15px; width: 100%; margin-top: 10px; border-radius: 6px; cursor: pointer;';
    retryBtn.innerText = isMini ? '🔄 Powtórz ten temat' : '🔄 Spróbuj ponownie (Wylosuj nowe 10 pytań)';
    retryBtn.onclick = () => isMini ? startMiniQuiz(currentActiveTopicId) : startQuiz();
    answersDiv.appendChild(retryBtn);
    if (isMini) {
        const backBtn = $('backToTopicsBtn');
        if (backBtn) {
            backBtn.classList.remove('hidden');
            backBtn.style.display = 'inline-block';
            backBtn.classList.add('highlight');
            try { backBtn.focus(); } catch (e) {}
        }
        currentActiveTopicId = null;
    }
}

function renderQuizQuestion(q) {
    $('quizProgress').innerText = `Pytanie ${currentQuestionIndex + 1} z ${quizData.length}`;
    $('quizQuestion').innerText = q.question;
    const answersDiv = $('quizAnswers');
    answersDiv.innerHTML = '';
    q.answers.forEach((ans, index) => {
        const btn = document.createElement('button');
        btn.className = 'show-btn';
        btn.innerText = ans;
        btn.style.cssText = 'text-align: left; width: 100%; background: #334155; margin: 5px 0; transition: 0.2s; padding: 12px; border-radius: 6px; cursor: pointer; color: #fff;';
        btn.onclick = () => checkAnswer(index, btn);
        answersDiv.appendChild(btn);
    });
}

function showQuestion() {
    const feedback = $('quizFeedback');
    const nextBtn = $('nextQuestionBtn');
    if (feedback) feedback.style.display = 'none';
    if (nextBtn) {
        nextBtn.classList.add('hidden');
        nextBtn.style.display = 'none';
    }
    if (currentQuestionIndex >= quizData.length) return renderQuizResult();
    const q = quizData[currentQuestionIndex];
    if (!q) return;
    renderQuizQuestion(q);
}

function setQuizFeedback(text, type) {
    const feedback = $('quizFeedback');
    if (!feedback) return;
    const palette = type === 'success'
        ? ['rgba(22, 163, 74, 0.2)', '#4ade80']
        : ['rgba(220, 38, 38, 0.2)', '#f87171'];
    feedback.innerText = text;
    feedback.style.cssText = `margin-top: 20px; padding: 10px; background: ${palette[0]}; color: ${palette[1]}; border-radius: 6px; display: block;`;
}

function checkAnswer(selectedIndex, clickedBtn) {
    const q = quizData[currentQuestionIndex];
    const buttons = $('quizAnswers').getElementsByTagName('button');
    const nextBtn = $('nextQuestionBtn');
    Array.from(buttons).forEach(btn => btn.disabled = true);

    if (selectedIndex === q.correct) {
        clickedBtn.style.background = '#16a34a';
        setQuizFeedback('✨ Dobra odpowiedź!', 'success');
        userScore++;
    } else {
        clickedBtn.style.background = '#dc2626';
        if (buttons[q.correct]) buttons[q.correct].style.background = '#16a34a';
        setQuizFeedback(`❌ Błąd. Prawidłowa odpowiedź to: ${q.answers[q.correct]}`, 'error');
    }

    if (nextBtn) {
        nextBtn.classList.remove('hidden');
        nextBtn.style.display = 'inline-block';
        nextBtn.innerText = currentQuestionIndex === quizData.length - 1 ? 'Zobacz wynik 🏁' : 'Następne pytanie ➡️';
    }
}

function nextQuestion() {
    currentQuestionIndex++;
    const nextBtn = $('nextQuestionBtn');
    if (nextBtn) {
        nextBtn.classList.add('hidden');
        nextBtn.style.display = 'none';
    }
    showQuestion();
}

function buildCheatSheet() {
    const tableBody = $('cheatTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.date}</td><td>${item.event}</td><td>${item.description}</td>`;
        tableBody.appendChild(row);
    });
}

function toggleCheatSheet() {
    const container = $('cheatSheetContainer');
    if (!container) return;
    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
        container.classList.remove('hidden');
        buildCheatSheet();
    } else {
        container.classList.add('hidden');
    }
}

function searchCheatSheet() {
    const query = ($('cheatSearch')?.value || '').toLowerCase();
    const rows = $('cheatTableBody')?.getElementsByTagName('tr') || [];
    Array.from(rows).forEach(row => row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none');
}

function shuffleCards() {
    data.sort(() => Math.random() - 0.5);
}

function saveSession() {
    const state = flashStates.dates;
    if (state.good || state.bad || state.currentIndex || state.isReviewRound) {
        localStorage.setItem('fiszki_session', JSON.stringify({
            ...state,
            badCardsIndexes: state.badCards.map(card => data.indexOf(card)),
            dataOrderIndexes: data.map((item, index) => index),
            isReverseMode: $('modeToggle')?.checked || false
        }));
    } else {
        localStorage.removeItem('fiszki_session');
    }
}

function checkSavedSession() {
    const saved = localStorage.getItem('fiszki_session');
    if (!saved) return startFreshGame();

    try {
        const state = JSON.parse(saved);
        const total = state.isReviewRound ? state.badCardsIndexes.length : data.length;
        if (state.currentIndex >= total && total > 0) return localStorage.removeItem('fiszki_session') && startFreshGame();
        $('restoreModalText').innerText = `Karta ${state.currentIndex + 1} / ${total}`;
        setDisplay('restoreModal', 'flex');
    } catch {
        startFreshGame();
    }
}

function handleRestoreDecision(shouldRestore) {
    setDisplay('restoreModal', 'none');
    if (!shouldRestore) {
        localStorage.removeItem('fiszki_session');
        return startFreshGame();
    }

    const state = JSON.parse(localStorage.getItem('fiszki_session'));
    const originalData = [...data];
    data = state.dataOrderIndexes.map(idx => originalData[idx]);
    flashStates.dates.badCards = state.badCardsIndexes.map(idx => originalData[idx]);
    flashStates.dates.currentIndex = state.currentIndex;
    flashStates.dates.good = state.good;
    flashStates.dates.bad = state.bad;
    flashStates.dates.isReviewRound = state.isReviewRound;
    flashStates.dates.firstRoundBadCount = state.firstRoundBadCount;
    if ($('modeToggle')) $('modeToggle').checked = state.isReverseMode;
    $('goodCount').innerText = state.good;
    $('badCount').innerText = state.bad;
    renderFlashCard('dates');
}

function startFreshGame() {
    shuffleCards();
    renderFlashCard('dates');
}

function handleModeChange() {
    const state = flashStates.dates;
    if (state.good || state.bad || state.currentIndex || state.isReviewRound) {
        setDisplay('confirmModal', 'flex');
    } else {
        renderFlashCard('dates');
    }
}

function confirmResetAction(shouldReset) {
    setDisplay('confirmModal', 'none');
    if (shouldReset) {
        localStorage.removeItem('fiszki_session');
        return resetFlashState('dates');
    }
    if ($('modeToggle')) $('modeToggle').checked = !$('modeToggle').checked;
    renderFlashCard('dates');
}

function resetFlashState(type) {
    const state = getFlashState(type);
    Object.assign(state, { currentIndex: 0, good: 0, bad: 0, badCards: [], isReviewRound: false, firstRoundBadCount: 0 });
    const ids = getFlashIds(type);
    if ($(ids.good)) $(ids.good).innerText = 0;
    if ($(ids.bad)) $(ids.bad).innerText = 0;
    if (type === 'dates') {
        shuffleCards();
        renderFlashCard('dates');
    } else {
        termsData.sort(() => Math.random() - 0.5);
        renderFlashCard('terms');
    }
}

function closeModal() {
    setDisplay('statsModal', 'none');
    resetFlashState(activeTab === 'dates' ? 'dates' : 'terms');
}

window.addEventListener('keydown', event => {
    if (document.activeElement.tagName === 'INPUT') return;
    const isModalOpen = ['statsModal', 'confirmModal', 'restoreModal'].some(id => $(id)?.style.display === 'flex');
    if (isModalOpen) return;

    const key = event.key.toLowerCase();
    const code = event.code;
    if (activeTab === 'dates') {
        if (code === 'Space') { event.preventDefault(); flipCard(); }
        else if (key === 'arrowleft' || key === 'a') answerFlash('dates', false);
        else if (key === 'arrowright' || key === 'd') answerFlash('dates', true);
    } else if (activeTab === 'terms') {
        if (code === 'Space') { event.preventDefault(); flipTermCard(); }
        else if (key === 'arrowleft' || key === 'a') answerFlash('terms', false);
        else if (key === 'arrowright' || key === 'd') answerFlash('terms', true);
    }
});