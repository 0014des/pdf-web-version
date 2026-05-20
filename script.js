// ==========================================================================
// 歴史一問一答マスター 学習ロジック
// ==========================================================================

// --- 状態管理オブジェクト ---
const state = {
    allQuestions: [],       // 選択された章の全問題
    currentQuestions: [],   // 今回出題する問題リスト（シャッフル・絞り込み後）
    currentIndex: 0,        // 現在の問題インデックス
    correctCount: 0,        // 正解数
    wrongQuestions: [],     // 今回間違えた問題のリスト
    activeChapters: [7, 8, 9], // 選択されている章 [7, 8, 9]
    activeMode: 'card',     // 'card' (カード), 'choice' (4択), 'typing' (入力)
    activeOrder: 'random',  // 'random' (ランダム), 'sequence' (番号順)
    activeFilter: 'all',    // 'all' (すべて), 'wrong' (苦手), 'bookmark' (お気に入り)
    isAnswered: false       // 現在の問題に対して解答したかどうか（Choice/Typing用）
};

// --- ローカルストレージキー ---
const STORAGE_KEYS = {
    BOOKMARKS: 'history_app_bookmarks',
    WRONG_HISTORY: 'history_app_wrong_history'
};

// --- 初期ロードとイベントリスナー設定 ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

// --- アプリの初期化 ---
function initApp() {
    // データが存在するかチェック
    if (typeof QUESTIONS_DATA === 'undefined') {
        console.error('QUESTIONS_DATA が読み込まれていません。questions.js が正しく作成されているか確認してください。');
        alert('エラー：問題データが見つかりません。');
        return;
    }

    // ローカルストレージの初期化
    if (!localStorage.getItem(STORAGE_KEYS.BOOKMARKS)) {
        localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.WRONG_HISTORY)) {
        localStorage.setItem(STORAGE_KEYS.WRONG_HISTORY, JSON.stringify([]));
    }

    // デフォルトの設定状態をUIに反映
    updateSettingsUI();
}

// --- 設定UIの更新 ---
function updateSettingsUI() {
    // 章チップスの選択状態
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        const ch = parseInt(chip.dataset.chapter);
        if (state.activeChapters.includes(ch)) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });

    // モードボタンの選択状態
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        if (btn.dataset.mode === state.activeMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // ライト/ダークテーマの初期適用
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
        document.querySelector('#theme-toggle i').className = 'fa-solid fa-moon';
    } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        document.querySelector('#theme-toggle i').className = 'fa-solid fa-sun';
    }
}

// --- イベントリスナーの紐付け ---
function setupEventListeners() {
    // テーマ切り替え
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // 章の選択チップス
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const ch = parseInt(chip.dataset.chapter);
            const index = state.activeChapters.indexOf(ch);
            if (index > -1) {
                // 少なくとも1つの章を選択した状態を維持
                if (state.activeChapters.length > 1) {
                    state.activeChapters.splice(index, 1);
                } else {
                    showTemporaryAlert('最低でも1つの章を選択してください。');
                    return;
                }
            } else {
                state.activeChapters.push(ch);
            }
            updateSettingsUI();
        });
    });

    // 学習モードの選択
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeMode = btn.dataset.mode;
            updateSettingsUI();
        });
    });

    // 出題順ラジオボタン
    const orderRandom = document.getElementById('order-random');
    const orderSequence = document.getElementById('order-sequence');
    orderRandom.addEventListener('change', () => state.activeOrder = 'random');
    orderSequence.addEventListener('change', () => state.activeOrder = 'sequence');

    // 絞り込みラジオボタン
    const filterAll = document.getElementById('filter-all');
    const filterWrong = document.getElementById('filter-wrong');
    const filterBookmark = document.getElementById('filter-bookmark');
    filterAll.addEventListener('change', () => state.activeFilter = 'all');
    filterWrong.addEventListener('change', () => state.activeFilter = 'wrong');
    filterBookmark.addEventListener('change', () => state.activeFilter = 'bookmark');

    // 学習開始ボタン
    document.getElementById('start-btn').addEventListener('click', startLearning);

    // フラッシュカードのタップめくり
    document.getElementById('flashcard').addEventListener('click', (e) => {
        // フィードバックボタンがクリックされた場合はフリップしない
        if (e.target.closest('.card-feedback')) return;
        
        // ChoiceモードやTypingモードで未回答の場合はフリップさせない
        if ((state.activeMode === 'choice' || state.activeMode === 'typing') && !state.isAnswered) {
            return;
        }

        flipCard();
    });

    // お気に入りボタン
    document.getElementById('bookmark-btn').addEventListener('click', toggleBookmark);

    // 一問一答カードの自己評価ボタン
    document.getElementById('eval-correct').addEventListener('click', () => handleEvaluation(true));
    document.getElementById('eval-wrong').addEventListener('click', () => handleEvaluation(false));

    // タイピング判定ボタン
    document.getElementById('submit-typing-btn').addEventListener('click', checkTypingAnswer);
    document.getElementById('typing-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (!state.isAnswered) {
                checkTypingAnswer();
            } else {
                nextQuestion();
            }
        }
    });

    // 次へボタン
    document.getElementById('next-btn').addEventListener('click', nextQuestion);

    // リザルト画面アクション
    document.getElementById('retry-all-btn').addEventListener('click', () => {
        startLearning();
    });
    document.getElementById('retry-wrong-btn').addEventListener('click', () => {
        if (state.wrongQuestions.length === 0) {
            showTemporaryAlert('間違えた問題はありません！');
            return;
        }
        state.currentQuestions = [...state.wrongQuestions];
        resetLearningSession();
    });
    document.getElementById('back-to-settings-btn').addEventListener('click', backToSettings);

    // 一覧画面アクション
    document.getElementById('view-list-btn').addEventListener('click', showListPanel);
    document.getElementById('list-back-btn').addEventListener('click', () => {
        document.getElementById('list-panel').style.display = 'none';
        document.getElementById('placeholder-panel').style.display = 'flex';
    });
    document.getElementById('toggle-all-answers-btn').addEventListener('click', toggleAllAnswers);
    
    // 一覧のタブ切り替え
    const listTabs = document.querySelectorAll('input[name="list-tab"]');
    listTabs.forEach(tab => {
        tab.addEventListener('change', (e) => {
            renderQuestionList(e.target.value);
        });
    });

    // キーボード操作サポート
    document.addEventListener('keydown', handleKeyboardControls);
}

// --- テーマの切り替え ---
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme', !isLight);
    
    const icon = document.querySelector('#theme-toggle i');
    if (isLight) {
        icon.className = 'fa-solid fa-moon';
        localStorage.setItem('theme', 'light');
    } else {
        icon.className = 'fa-solid fa-sun';
        localStorage.setItem('theme', 'dark');
    }
}

// --- 学習セッションの開始 ---
function startLearning() {
    // 1. 章データのマージ
    let merged = [];
    state.activeChapters.forEach(ch => {
        const chData = QUESTIONS_DATA[ch] || [];
        // 章情報を追加しておく
        chData.forEach(q => {
            q.chapter = ch;
            merged.push(q);
        });
    });

    if (merged.length === 0) {
        showTemporaryAlert('選択された章に問題データがありません。');
        return;
    }

    // 2. 絞り込みフィルターの適用
    if (state.activeFilter === 'bookmark') {
        const bookmarks = getBookmarks();
        merged = merged.filter(q => bookmarks.includes(`${q.chapter}_${q.id}`));
        if (merged.length === 0) {
            showTemporaryAlert('ブックマークに登録されている問題がありません。');
            return;
        }
    } else if (state.activeFilter === 'wrong') {
        const wrongList = getWrongHistory();
        merged = merged.filter(q => wrongList.includes(`${q.chapter}_${q.id}`));
        if (merged.length === 0) {
            showTemporaryAlert('苦手履歴に登録されている問題がありません。通常の学習を開始します。');
        }
    }

    state.allQuestions = merged;
    state.currentQuestions = [...merged];

    // 3. 出題順（シャッフル）の適用
    if (state.activeOrder === 'random') {
        shuffleArray(state.currentQuestions);
    } else {
        // 章、およびID順に並び替え
        state.currentQuestions.sort((a, b) => {
            if (a.chapter !== b.chapter) return a.chapter - b.chapter;
            return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    resetLearningSession();
}

// --- 学習の進行リセット ---
function resetLearningSession() {
    state.currentIndex = 0;
    state.correctCount = 0;
    state.wrongQuestions = [];
    state.isAnswered = false;

    // パネルの表示切り替え
    document.getElementById('placeholder-panel').style.display = 'none';
    document.getElementById('result-panel').style.display = 'none';
    document.getElementById('study-panel').style.display = 'flex';
    document.querySelector('.stats-bar').style.display = 'grid';

    // 進捗表示の更新
    updateStatsBar();
    
    // 最初の問題を表示
    displayQuestion();
}

// --- 統計バー（進捗・正答率）の更新 ---
function updateStatsBar() {
    const total = state.currentQuestions.length;
    const current = state.currentIndex + 1;
    document.getElementById('progress-text').innerText = `${current} / ${total}`;
    
    const progressPercent = (state.currentIndex / total) * 100;
    document.getElementById('progress-bar').style.width = `${progressPercent}%`;

    // 正答率の計算
    let accuracy = 0;
    if (state.currentIndex > 0) {
        accuracy = Math.round((state.correctCount / state.currentIndex) * 100);
    }
    document.getElementById('accuracy-text').innerText = `${accuracy}%`;
}

// --- 問題の表示処理 ---
function displayQuestion() {
    const q = state.currentQuestions[state.currentIndex];
    if (!q) {
        finishLearning();
        return;
    }

    state.isAnswered = false;

    // カードの表示状態をフロント（表面）に戻す
    const card = document.getElementById('flashcard');
    card.classList.remove('flipped');

    // 章のヘッダーを表示
    const chNames = {
        7: "Chapter 7: 中世ヨーロッパ",
        8: "Chapter 8: 東アジアとモンゴル",
        9: "Chapter 9: 大交易・大交流の時代"
    };
    document.getElementById('card-chapter-tag').innerText = chNames[q.chapter] || `Chapter ${q.chapter}`;

    // ブックマークボタンの状態
    const bookmarks = getBookmarks();
    const bookmarkKey = `${q.chapter}_${q.id}`;
    const bookmarkBtn = document.getElementById('bookmark-btn');
    if (bookmarks.includes(bookmarkKey)) {
        bookmarkBtn.classList.add('active');
        bookmarkBtn.querySelector('i').className = 'fa-solid fa-star';
    } else {
        bookmarkBtn.classList.remove('active');
        bookmarkBtn.querySelector('i').className = 'fa-regular fa-star';
    }

    // 問題・答えのテキストを設定
    document.getElementById('question-display').innerText = formatQuestionText(q.question);
    document.getElementById('answer-display').innerText = formatAnswerText(q.answer);

    // 別解などの情報を解説スペースに表示
    displayExplanation(q.answer);

    // モード別のUI初期化
    initModeUI();

    // 進行バーの更新
    updateStatsBar();
}

// --- 問題文の整形（見栄えの調整） ---
function formatQuestionText(qText) {
    // 文末にハテナマークが無い場合は補足など、PDFのノイズを微調整（必要に応じて）
    return qText;
}

// --- 答えテキストの整形 ---
function formatAnswerText(aText) {
    // 括弧書きの読み仮名を消したバージョンを表示させるか、あるいはそのまま表示
    return aText;
}

// --- 解答の解説スペースの表示 ---
function displayExplanation(aText) {
    const expDiv = document.getElementById('answer-explanation');
    expDiv.innerHTML = '';
    
    // 括弧内のふりがなや、別解「／」が含まれている場合に表示
    const rubies = [];
    const alternatives = [];

    // ふりがな（括弧）の抽出
    const rubyMatch = aText.match(/（[^）]+）/g);
    if (rubyMatch) {
        rubyMatch.forEach(r => rubies.push(r));
    }

    // 別解の抽出
    if (aText.includes('／')) {
        const parts = aText.split('／');
        parts.forEach((p, idx) => {
            if (idx > 0) alternatives.push(p);
        });
    }

    let expHtml = '';
    if (rubies.length > 0) {
        expHtml += `<p class="explanation-item"><i class="fa-solid fa-language"></i> <strong>読み：</strong> ${rubies.join(', ')}</p>`;
    }
    if (alternatives.length > 0) {
        expHtml += `<p class="explanation-item"><i class="fa-solid fa-shuffle"></i> <strong>別解：</strong> ${alternatives.join(', ')}</p>`;
    }

    expDiv.innerHTML = expHtml;
}

// --- モードに応じたUIコンポーネントの表示切替 ---
function initModeUI() {
    const selfEval = document.getElementById('self-eval-container');
    const options = document.getElementById('options-container');
    const typing = document.getElementById('typing-container');
    const nextControls = document.getElementById('next-container');
    const hint = document.getElementById('card-hint');

    // すべて非表示
    selfEval.style.display = 'none';
    options.style.display = 'none';
    typing.style.display = 'none';
    nextControls.style.display = 'none';
    hint.style.display = 'none';

    if (state.activeMode === 'card') {
        selfEval.style.display = 'grid';
        hint.style.display = 'block';
    } else if (state.activeMode === 'choice') {
        options.style.display = 'grid';
        generateMultipleChoices();
    } else if (state.activeMode === 'typing') {
        typing.style.display = 'flex';
        document.getElementById('typing-input').value = '';
        document.getElementById('typing-input').disabled = false;
        setTimeout(() => document.getElementById('typing-input').focus(), 100);
    }
}

// --- フラッシュカードをめくる ---
function flipCard() {
    const card = document.getElementById('flashcard');
    card.classList.toggle('flipped');
}

// --- お気に入りの切り替え ---
function toggleBookmark(e) {
    e.stopPropagation(); // 親要素のカードクリック（フリップ）を防ぐ

    const q = state.currentQuestions[state.currentIndex];
    if (!q) return;

    const bookmarkKey = `${q.chapter}_${q.id}`;
    let bookmarks = getBookmarks();

    const idx = bookmarks.indexOf(bookmarkKey);
    const btn = document.getElementById('bookmark-btn');

    if (idx > -1) {
        bookmarks.splice(idx, 1);
        btn.classList.remove('active');
        btn.querySelector('i').className = 'fa-regular fa-star';
        showTemporaryAlert('ブックマークを解除しました。');
    } else {
        bookmarks.push(bookmarkKey);
        btn.classList.add('active');
        btn.querySelector('i').className = 'fa-solid fa-star';
        showTemporaryAlert('ブックマークに追加しました！');
    }

    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
}

// --- カードめくりモードの自己評価判定 ---
function handleEvaluation(isCorrect) {
    const q = state.currentQuestions[state.currentIndex];
    
    if (isCorrect) {
        state.correctCount++;
        // 苦手リストから削除
        removeWrongHistory(`${q.chapter}_${q.id}`);
    } else {
        state.wrongQuestions.push(q);
        // 苦手リストへ追加
        addWrongHistory(`${q.chapter}_${q.id}`);
    }

    // 次の問題へ
    state.currentIndex++;
    displayQuestion();
}

// --- 4択クイズの選択肢生成 ---
function generateMultipleChoices() {
    const currentQ = state.currentQuestions[state.currentIndex];
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    const correctAnswer = currentQ.answer;

    // ダミーの選択肢（同じ章の他の答え、または他の章の答え）を集める
    const dummyAnswers = [];
    const allAvailable = [];
    
    // 全ての問題データを集約
    Object.keys(QUESTIONS_DATA).forEach(ch => {
        QUESTIONS_DATA[ch].forEach(q => {
            if (q.answer !== correctAnswer) {
                allAvailable.push(q.answer);
            }
        });
    });

    // ランダムに3つ選出
    shuffleArray(allAvailable);
    const chosenDummies = allAvailable.slice(0, 3);
    
    const choices = [correctAnswer, ...chosenDummies];
    shuffleArray(choices);

    choices.forEach(ans => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        // 括弧内のふりがながある場合は、ふりがなを取り除いて表示するとスッキリするが、そのまま表示する
        btn.innerText = ans;
        btn.addEventListener('click', () => selectChoice(btn, ans, correctAnswer));
        container.appendChild(btn);
    });
}

// --- 4択クイズの選択処理 ---
function selectChoice(selectedBtn, answer, correctAnswer) {
    if (state.isAnswered) return;
    state.isAnswered = true;

    const isCorrect = (answer === correctAnswer);
    const optionBtns = document.querySelectorAll('.option-btn');

    optionBtns.forEach(btn => {
        btn.disabled = true; // 解答後は他のボタンを押せなくする
        if (btn.innerText === correctAnswer) {
            btn.classList.add('correct-choice');
        } else if (btn === selectedBtn && !isCorrect) {
            btn.classList.add('wrong-choice');
        }
    });

    showFeedback(isCorrect);
}

// --- タイピング回答判定 ---
function checkTypingAnswer() {
    if (state.isAnswered) return;
    
    const inputField = document.getElementById('typing-input');
    const inputVal = inputField.value.trim();

    if (!inputVal) {
        showTemporaryAlert('回答を入力してください。');
        return;
    }

    state.isAnswered = true;
    inputField.disabled = true;

    const currentQ = state.currentQuestions[state.currentIndex];
    const isCorrect = validateAnswer(inputVal, currentQ.answer);

    showFeedback(isCorrect);
}

// --- インテリジェントな正誤判定ロジック ---
function validateAnswer(input, answer) {
    // 完全にスペースやカタカナ半角などを除去して標準化する
    const normalize = (str) => {
        return str
            .toLowerCase()
            .replace(/[\s　]+/g, '')          // スペース削除
            .replace(/[ａ-ｚＡ-Ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角英数→半角英数
            .replace(/[（）()]/g, '')         // 括弧の削除
            .replace(/[＝=＝\-ー]/g, '')       // ハイフン等の削除
            .replace(/世/g, '');               // 「世」の表記の揺れ対策
    };

    const normInput = normalize(input);

    // 1. 完全に答えが一致する場合
    if (normInput === normalize(answer)) return true;

    // 2. 別解の判定（「／」で区切られている場合）
    if (answer.includes('／')) {
        const parts = answer.split('／');
        for (let p of parts) {
            if (normInput === normalize(p)) return true;
        }
    }

    // 3. ふりがなや括弧を除外した本体テキストとの一致
    // 例：「高麗（こうらい）」の「高麗」のみ
    const baseText = answer.replace(/（[^）]+）/g, '');
    if (normInput === normalize(baseText)) return true;

    // 例：「高麗（こうらい）」の「こうらい」のみ入力された場合も正解とするか
    const rubyText = answer.match(/（([^）]+)）/);
    if (rubyText && rubyText[1]) {
        if (normInput === normalize(rubyText[1])) return true;
    }

    return false;
}

// --- クイズ形式（Choice/Typing）の正誤フィードバック表示 ---
function showFeedback(isCorrect) {
    const q = state.currentQuestions[state.currentIndex];

    // 結果の反映
    if (isCorrect) {
        state.correctCount++;
        removeWrongHistory(`${q.chapter}_${q.id}`);
    } else {
        state.wrongQuestions.push(q);
        addWrongHistory(`${q.chapter}_${q.id}`);
    }

    // メッセージと次へボタンの表示
    const msgDiv = document.getElementById('feedback-message');
    if (isCorrect) {
        msgDiv.className = 'feedback-msg correct';
        msgDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i> 正解！';
    } else {
        msgDiv.className = 'feedback-msg wrong';
        msgDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> 不正解...`;
        
        // タイピングや4択で不正解の場合、カードをフリップして正しい答えを表示する
        setTimeout(() => flipCard(), 300);
    }

    document.getElementById('next-container').style.display = 'flex';
}

// --- 次の問題へ進む ---
function nextQuestion() {
    state.currentIndex++;
    displayQuestion();
}

// --- 学習の終了（結果画面の生成） ---
function finishLearning() {
    document.getElementById('study-panel').style.display = 'none';
    document.querySelector('.stats-bar').style.display = 'none';
    
    const resPanel = document.getElementById('result-panel');
    resPanel.style.display = 'flex';

    const total = state.currentQuestions.length;
    const correct = state.correctCount;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // スタッツ表示
    document.getElementById('res-total').innerText = total;
    document.getElementById('res-correct').innerText = correct;
    document.getElementById('res-accuracy').innerText = `${accuracy}%`;

    // 復習リストの生成
    const reviewList = document.getElementById('review-list');
    reviewList.innerHTML = '';

    if (state.wrongQuestions.length > 0) {
        state.wrongQuestions.forEach(q => {
            const item = document.createElement('div');
            item.className = 'review-item';
            item.innerHTML = `
                <div class="review-item-q">Q. ${q.question}</div>
                <div class="review-item-a">A. ${q.answer}</div>
            `;
            reviewList.appendChild(item);
        });
        document.getElementById('retry-wrong-btn').style.display = 'block';
    } else {
        reviewList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-check" style="color: var(--success-color); font-size: 2.5rem;"></i><p>素晴らしい！全問正解です！</p></div>';
        document.getElementById('retry-wrong-btn').style.display = 'none';
    }
}

// --- 設定画面に戻る ---
function backToSettings() {
    document.getElementById('result-panel').style.display = 'none';
    document.getElementById('study-panel').style.display = 'none';
    document.querySelector('.stats-bar').style.display = 'none';
    document.getElementById('placeholder-panel').style.display = 'flex';
}

// --- キーボード操作のハンドラー ---
function handleKeyboardControls(e) {
    // タイピングモードで入力フィールドにフォーカスがある時は、ショートカットキーを無効にする
    if (state.activeMode === 'typing' && document.activeElement === document.getElementById('typing-input') && e.key !== 'Enter') {
        return;
    }

    const studyPanel = document.getElementById('study-panel');
    if (studyPanel.style.display === 'none') return;

    // 1. スペースキーでカードめくり（Cardモードの時のみ、または回答後）
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (state.activeMode === 'card' || state.isAnswered) {
            flipCard();
        }
    }

    // 2. Cardモードでの「覚えた！」「まだ」評価
    if (state.activeMode === 'card') {
        const card = document.getElementById('flashcard');
        if (card.classList.contains('flipped')) {
            if (e.key === 'ArrowLeft') {
                handleEvaluation(false); // まだ
            } else if (e.key === 'ArrowRight') {
                handleEvaluation(true);  // 覚えた！
            }
        }
    }

    // 3. 4択モードでの数字選択（1〜4）
    if (state.activeMode === 'choice' && !state.isAnswered) {
        const btns = document.querySelectorAll('.option-btn');
        if (btns.length >= 4) {
            if (e.key === '1') btns[0].click();
            if (e.key === '2') btns[1].click();
            if (e.key === '3') btns[2].click();
            if (e.key === '4') btns[3].click();
        }
    }

    // 4. 回答済状態でのEnterキー（次へ進む）
    if (e.key === 'Enter' && state.isAnswered) {
        nextQuestion();
    }
}

// ==========================================================================
// ユーティリティ & ヘルパー関数
// ==========================================================================

// --- 配列をランダムにシャッフル (Fisher-Yates) ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- ブックマーク情報の取得 ---
function getBookmarks() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS)) || [];
}

// --- 苦手（不正解）履歴の管理 ---
function getWrongHistory() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.WRONG_HISTORY)) || [];
}

function addWrongHistory(key) {
    const list = getWrongHistory();
    if (!list.includes(key)) {
        list.push(key);
        localStorage.setItem(STORAGE_KEYS.WRONG_HISTORY, JSON.stringify(list));
    }
}

function removeWrongHistory(key) {
    const list = getWrongHistory();
    const idx = list.indexOf(key);
    if (idx > -1) {
        list.splice(idx, 1);
        localStorage.setItem(STORAGE_KEYS.WRONG_HISTORY, JSON.stringify(list));
    }
}

// --- 一時通知（トースト風）の表示 ---
function showTemporaryAlert(message) {
    // 既存のトーストがあれば削除
    const existing = document.querySelector('.toast-alert');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-alert';
    toast.innerText = message;
    
    // スタイル指定（直接注入）
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%) translateY(20px)',
        background: 'var(--accent-gradient)',
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-md)',
        fontSize: '0.9rem',
        fontWeight: '700',
        zIndex: '9999',
        opacity: '0',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    });

    document.body.appendChild(toast);
    
    // アニメーション表示
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
    }, 50);

    // 自動消去
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ==========================================================================
// 問題一覧機能の制御ロジック
// ==========================================================================

// --- 問題一覧パネルの表示 ---
function showListPanel() {
    document.getElementById('placeholder-panel').style.display = 'none';
    document.getElementById('result-panel').style.display = 'none';
    document.getElementById('study-panel').style.display = 'none';
    document.querySelector('.stats-bar').style.display = 'none';
    document.getElementById('list-panel').style.display = 'flex';

    // デフォルトで「すべて」タブを選択状態にする
    document.getElementById('list-tab-all').checked = true;
    renderQuestionList('all');
}

// --- すべての答えを表示/非表示の切り替え ---
function toggleAllAnswers() {
    const btn = document.getElementById('toggle-all-answers-btn');
    const answerBoxes = document.querySelectorAll('.list-item-answer-box');
    const currentState = btn.dataset.state || 'hidden';

    if (currentState === 'hidden') {
        answerBoxes.forEach(box => {
            box.classList.add('revealed');
            box.setAttribute('data-revealed', 'true');
        });
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> すべての答えを隠す';
        btn.dataset.state = 'shown';
    } else {
        answerBoxes.forEach(box => {
            box.classList.remove('revealed');
            box.setAttribute('data-revealed', 'false');
        });
        btn.innerHTML = '<i class="fa-solid fa-eye"></i> すべての答えを表示';
        btn.dataset.state = 'hidden';
    }
}

// --- 個別の解答切り替え時に一括切り替えボタンの状態を同期 ---
function updateToggleAllButtonState() {
    const btn = document.getElementById('toggle-all-answers-btn');
    const answerBoxes = document.querySelectorAll('.list-item-answer-box');
    const total = answerBoxes.length;
    if (total === 0) return;

    const revealedCount = document.querySelectorAll('.list-item-answer-box.revealed').length;

    if (revealedCount === total) {
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> すべての答えを隠す';
        btn.dataset.state = 'shown';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-eye"></i> すべての答えを表示';
        btn.dataset.state = 'hidden';
    }
}

// --- 問題一覧の描画処理 ---
function renderQuestionList(chapterFilter) {
    const container = document.getElementById('question-list-container');
    container.innerHTML = '';

    let questions = [];
    const chaptersToRender = chapterFilter === 'all' ? [7, 8, 9] : [parseInt(chapterFilter)];
    
    chaptersToRender.forEach(ch => {
        const chData = QUESTIONS_DATA[ch] || [];
        chData.forEach(q => {
            questions.push({
                ...q,
                chapter: ch
            });
        });
    });

    if (questions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>問題がありません。</p></div>';
        return;
    }

    // 「すべての答えを表示」ボタンの状態をリセット
    const toggleAllBtn = document.getElementById('toggle-all-answers-btn');
    toggleAllBtn.innerHTML = '<i class="fa-solid fa-eye"></i> すべての答えを表示';
    toggleAllBtn.dataset.state = 'hidden';

    // 描画
    questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';

        const chNames = {
            7: 'Ch.7 中世ヨーロッパ',
            8: 'Ch.8 東アジアとモンゴル',
            9: 'Ch.9 大交易・大交流の時代'
        };
        const chName = chNames[q.chapter] || `Chapter ${q.chapter}`;
        const chClass = `ch${q.chapter}`;

        // ブックマーク状態の確認
        const bookmarks = getBookmarks();
        const bookmarkKey = `${q.chapter}_${q.id}`;
        const isBookmarked = bookmarks.includes(bookmarkKey);
        const starClass = isBookmarked ? 'fa-solid fa-star' : 'fa-regular fa-star';
        const activeClass = isBookmarked ? 'active' : '';

        // 問題番号（通し番号と元のID）
        const displayIndex = index + 1;

        item.innerHTML = `
            <div class="list-item-header">
                <span class="list-item-id-tag ${chClass}">
                    <i class="fa-solid fa-graduation-cap"></i> ${chName} - No.${displayIndex} (ID: ${q.id})
                </span>
                <div class="list-item-actions">
                    <button class="action-icon-btn list-bookmark-btn ${activeClass}" data-chapter="${q.chapter}" data-id="${q.id}" title="ブックマーク">
                        <i class="${starClass}"></i>
                    </button>
                </div>
            </div>
            <div class="list-item-body">
                <div class="list-item-question">${q.question}</div>
                <div class="list-item-answer-box" data-revealed="false">
                    <span class="list-item-answer-text">${q.answer}</span>
                </div>
            </div>
        `;

        // 個別の答え表示クリックイベント
        const answerBox = item.querySelector('.list-item-answer-box');
        answerBox.addEventListener('click', () => {
            const isRevealed = answerBox.getAttribute('data-revealed') === 'true';
            if (isRevealed) {
                answerBox.classList.remove('revealed');
                answerBox.setAttribute('data-revealed', 'false');
            } else {
                answerBox.classList.add('revealed');
                answerBox.setAttribute('data-revealed', 'true');
            }
            updateToggleAllButtonState();
        });

        // ブックマークボタンイベント
        const bookmarkBtn = item.querySelector('.list-bookmark-btn');
        bookmarkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ch = bookmarkBtn.dataset.chapter;
            const qId = bookmarkBtn.dataset.id;
            const key = `${ch}_${qId}`;
            let bms = getBookmarks();
            const idx = bms.indexOf(key);

            if (idx > -1) {
                bms.splice(idx, 1);
                bookmarkBtn.classList.remove('active');
                bookmarkBtn.querySelector('i').className = 'fa-regular fa-star';
                showTemporaryAlert('ブックマークを解除しました。');
            } else {
                bms.push(key);
                bookmarkBtn.classList.add('active');
                bookmarkBtn.querySelector('i').className = 'fa-solid fa-star';
                showTemporaryAlert('ブックマークに追加しました！');
            }
            localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bms));

            // 学習中パネルのブックマーク状態とも連動させる（現在表示中の問題と同じなら）
            const currentQ = state.currentQuestions[state.currentIndex];
            if (currentQ && currentQ.chapter == ch && currentQ.id == qId) {
                const mainBookmarkBtn = document.getElementById('bookmark-btn');
                if (idx > -1) {
                    mainBookmarkBtn.classList.remove('active');
                    mainBookmarkBtn.querySelector('i').className = 'fa-regular fa-star';
                } else {
                    mainBookmarkBtn.classList.add('active');
                    mainBookmarkBtn.querySelector('i').className = 'fa-solid fa-star';
                }
            }
        });

        container.appendChild(item);
    });
}

