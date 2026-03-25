/**
 * 8 Puzzle Solver — Chess.com Style
 * A* Algorithm with Manhattan Distance Heuristic
 * Features: move history, step-by-step replay, post-game review, eval bar
 */

// =====================================================
// MIN-HEAP (Priority Queue for A*)
// =====================================================
class MinHeap {
    constructor() { this.heap = []; }

    insert(node) {
        this.heap.push(node);
        this._bubbleUp(this.heap.length - 1);
    }

    extractMin() {
        if (this.heap.length === 1) return this.heap.pop();
        const min = this.heap[0];
        this.heap[0] = this.heap.pop();
        this._sinkDown(0);
        return min;
    }

    _bubbleUp(i) {
        while (i > 0) {
            const p = Math.floor((i - 1) / 2);
            if (this.heap[i].f < this.heap[p].f) {
                [this.heap[i], this.heap[p]] = [this.heap[p], this.heap[i]];
                i = p;
            } else break;
        }
    }

    _sinkDown(i) {
        const n = this.heap.length;
        while (true) {
            let smallest = i;
            const l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && this.heap[l].f < this.heap[smallest].f) smallest = l;
            if (r < n && this.heap[r].f < this.heap[smallest].f) smallest = r;
            if (smallest !== i) {
                [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
                i = smallest;
            } else break;
        }
    }

    get size() { return this.heap.length; }
    isEmpty() { return this.heap.length === 0; }
}

// =====================================================
// CONSTANTS & STATE
// =====================================================
const GOAL_STATE = [1, 2, 3, 4, 5, 6, 7, 8, 0];
const MOVES_MAP = [
    { dr: -1, dc: 0, label: '↑' }, // Up
    { dr: 1, dc: 0, label: '↓' },  // Down
    { dr: 0, dc: -1, label: '←' }, // Left
    { dr: 0, dc: 1, label: '→' }   // Right
];

let state = {
    board: [...GOAL_STATE],       // Current board
    isSolving: false,             // Animation in progress
    solvedPath: null,             // Array of board states (the A* solution)
    moveHistory: [],              // [{tile, heuristic, direction}]
    replayStep: 0,                // current step in replay
    replayAutoInterval: null,     // for auto-replay
    animTimeout: null,            // for solve animation
    speedMs: 200,                 // ms between animation steps
    sessionStats: {
        solved: 0,
        failed: 0,
        streak: 0,
        bestTime: null,
    },
    timerInterval: null,
    timerStart: null,
    elapsedMs: 0,
    lastSolveResult: null,        // to re-open review modal
};

// =====================================================
// DOM ELEMENTS
// =====================================================
const DOM = {
    board:            document.getElementById('puzzle-board'),
    boardWrapper:     document.getElementById('board-wrapper'),
    overlay:          document.getElementById('unsolvable-overlay'),
    solvingOverlay:   document.getElementById('solving-overlay'),
    computingDetail:  document.getElementById('computing-detail'),
    btnShuffle:       document.getElementById('btn-shuffle'),
    btnSolve:         document.getElementById('btn-solve'),
    btnReset:         document.getElementById('btn-reset'),
    btnOverlayShuffle:document.getElementById('btn-overlay-shuffle'),
    speedTabs:        document.querySelectorAll('.speed-tab'),
    toggleHeuristic:  document.getElementById('toggle-heuristic'),
    toggleCorrect:    document.getElementById('toggle-correct'),

    // Metrics
    metricTime:       document.getElementById('metric-time'),
    metricMoves:      document.getElementById('metric-moves'),
    metricNodes:      document.getElementById('metric-nodes'),
    metricHeuristic:  document.getElementById('metric-heuristic'),
    playerTimer:      document.getElementById('player-timer'),
    aiOptimal:        document.getElementById('ai-optimal'),

    // Move History
    moveHistoryList:  document.getElementById('move-history-list'),

    // A* Info
    algoF:            document.getElementById('algo-f'),
    algoG:            document.getElementById('algo-g'),
    algoH:            document.getElementById('algo-h'),
    algoOpen:         document.getElementById('algo-open'),
    algoClosed:       document.getElementById('algo-closed'),

    // Eval Bar
    evalBarFill:      document.getElementById('eval-bar-fill'),

    // Session Stats
    statSolved:       document.getElementById('stat-solved'),
    statFailed:       document.getElementById('stat-failed'),
    statStreak:       document.getElementById('stat-streak'),
    statBestTime:     document.getElementById('stat-best-time'),
    profileRating:    document.getElementById('profile-rating'),
    playerRating:     document.getElementById('player-rating'),

    // Replay
    replayControls:   document.getElementById('replay-controls'),
    replayStepLabel:  document.getElementById('replay-step-label'),
    btnReplayStart:   document.getElementById('btn-replay-start'),
    btnReplayPrev:    document.getElementById('btn-replay-prev'),
    btnReplayNext:    document.getElementById('btn-replay-next'),
    btnReplayEnd:     document.getElementById('btn-replay-end'),
    btnReplayAuto:    document.getElementById('btn-replay-auto'),

    // Review Modal
    reviewModal:      document.getElementById('review-modal'),
    modalCloseBtn:    document.getElementById('modal-close-btn'),
    modalGrade:       document.getElementById('modal-grade'),
    modalTitle:       document.getElementById('modal-title'),
    modalSubtitle:    document.getElementById('modal-subtitle'),
    reviewStatsGrid:  document.getElementById('review-stats-grid'),
    reviewAnalysis:   document.getElementById('review-analysis-text'),
    barEfficiency:    document.getElementById('bar-efficiency'),
    barSpeed:         document.getElementById('bar-speed'),
    barAccuracy:      document.getElementById('bar-accuracy'),
    lblEfficiency:    document.getElementById('lbl-efficiency'),
    lblSpeed:         document.getElementById('lbl-speed'),
    lblAccuracy:      document.getElementById('lbl-accuracy'),
    btnModalReplay:   document.getElementById('btn-modal-replay'),
    btnModalNew:      document.getElementById('btn-modal-new'),
    btnViewReview:    document.getElementById('btn-view-review'),

    // Solution Path Panel
    solutionPathSection: document.getElementById('solution-path-section'),
    solutionPathBody:    document.getElementById('solution-path-body'),
    spCount:             document.getElementById('sp-count'),
    spToggleBtn:         document.getElementById('sp-toggle-btn'),
    spToggleIcon:        document.getElementById('sp-toggle-icon'),
};

// =====================================================
// INIT
// =====================================================
function init() {
    loadSessionStats();
    
    // Auth integration
    const playerName = (typeof Auth !== 'undefined' ? Auth.getUser() : null) || 'Player';
    const navName = document.getElementById('nav-player-name');
    if (navName) navName.textContent = playerName;
    const profileName = document.getElementById('profile-player-name');
    if (profileName) profileName.textContent = playerName;
    const boardName = document.getElementById('board-player-name');
    if (boardName) boardName.textContent = playerName;

    // Settings integration
    const conf = typeof Settings !== 'undefined' ? Settings.get() : { speed: 200, showHeuristics: true, highlightMoves: true };
    state.speedMs = conf.speed;
    DOM.toggleHeuristic.checked = conf.showHeuristics;
    DOM.toggleCorrect.checked = conf.highlightMoves;

    // Initial Rating render
    DOM.profileRating.textContent = currentRating;
    if (DOM.playerRating) DOM.playerRating.textContent = '⭐ ' + currentRating;

    renderBoard();
    updateEvalBar();
    updateAlgoInfo(0, 0, getManhattanDistance(state.board), 0, 0);

    // Events
    DOM.btnShuffle.addEventListener('click', () => !state.isSolving && shuffleBoard());
    DOM.btnSolve.addEventListener('click', () => !state.isSolving && startSolving());
    DOM.btnReset.addEventListener('click', () => !state.isSolving && resetBoard());
    DOM.btnOverlayShuffle.addEventListener('click', () => { DOM.overlay.classList.add('hidden'); shuffleBoard(); });

    // Speed tabs
    DOM.speedTabs.forEach(tab => {
        if (parseInt(tab.dataset.speed, 10) === state.speedMs) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }

        tab.addEventListener('click', () => {
            DOM.speedTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.speedMs = parseInt(tab.dataset.speed, 10);
            if (typeof Settings !== 'undefined') {
                const c = Settings.get();
                c.speed = state.speedMs;
                Settings.save(c);
            }
        });
    });

    // Toggles
    DOM.toggleHeuristic.addEventListener('change', (e) => {
        if (typeof Settings !== 'undefined') {
            const c = Settings.get();
            c.showHeuristics = e.target.checked;
            Settings.save(c);
        }
        renderBoard();
    });
    DOM.toggleCorrect.addEventListener('change', (e) => {
        if (typeof Settings !== 'undefined') {
            const c = Settings.get();
            c.highlightMoves = e.target.checked;
            Settings.save(c);
        }
        renderBoard();
    });

    // Replay controls
    DOM.btnReplayStart.addEventListener('click', () => { stopAutoReplay(); jumpReplay(0); });
    DOM.btnReplayPrev.addEventListener('click', () => { stopAutoReplay(); jumpReplay(state.replayStep - 1); });
    DOM.btnReplayNext.addEventListener('click', () => { stopAutoReplay(); jumpReplay(state.replayStep + 1); });
    DOM.btnReplayEnd.addEventListener('click', () => { stopAutoReplay(); if (state.solvedPath) jumpReplay(state.solvedPath.length - 1); });
    DOM.btnReplayAuto.addEventListener('click', toggleAutoReplay);

    // Review Modal
    DOM.modalCloseBtn.addEventListener('click', closeReview);
    DOM.btnViewReview.addEventListener('click', openReview);
    DOM.btnModalReplay.addEventListener('click', () => { closeReview(); showReplayControls(); jumpReplay(0); });
    DOM.btnModalNew.addEventListener('click', () => { closeReview(); shuffleBoard(); });
    DOM.reviewModal.addEventListener('click', (e) => { if (e.target === DOM.reviewModal) closeReview(); });

    // Solution Path collapse toggle
    if (DOM.spToggleBtn) {
        DOM.spToggleBtn.addEventListener('click', () => {
            const body = DOM.solutionPathBody;
            const isCollapsed = body.classList.toggle('collapsed');
            if (DOM.spToggleIcon) DOM.spToggleIcon.className = isCollapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
        });
    }
}

// =====================================================
// BOARD RENDERING
// =====================================================
function renderBoard(highlightIndices = []) {
    const showHeuristic = DOM.toggleHeuristic.checked;
    const showCorrect   = DOM.toggleCorrect.checked;

    const boardSize = DOM.board.clientWidth || 340;
    const tileGap = 7;
    const tileSize = (boardSize - tileGap * 4) / 3;

    // Create tiles only once if they don't exist
    if (DOM.board.children.length === 0) {
        for (let i = 0; i <= 8; i++) {
            const tile = document.createElement('div');
            tile.classList.add('tile');
            tile.id = `tile-${i}`; // Assign ID based on tile value
            if (i === 0) {
                tile.classList.add('empty');
            } else {
                tile.textContent = i;
                const badge = document.createElement('div');
                badge.classList.add('heuristic-badge');
                tile.appendChild(badge);
            }
            // Attach click handler during creation
            tile.addEventListener('click', () => {
                // Find the current index of this tile's value in the board
                const currentIdx = state.board.indexOf(i);
                if (currentIdx !== -1 && !state.isSolving) {
                    handleTileClick(currentIdx);
                }
            });
            DOM.board.appendChild(tile);
        }
    }

    // Update positions and styles for existing tiles
    state.board.forEach((val, idx) => {
        const tile = document.getElementById(`tile-${val}`);
        if (!tile) return; // Should not happen if tiles are created correctly

        const row = Math.floor(idx / 3);
        const col = idx % 3;
        tile.style.left = (col * (tileSize + tileGap) + tileGap) + 'px';
        tile.style.top  = (row * (tileSize + tileGap) + tileGap) + 'px';
        tile.style.width  = tileSize + 'px';
        tile.style.height = tileSize + 'px';

        // Reset classes and styles
        tile.classList.remove('empty', 'highlighted');
        tile.style.background = '';

        if (val === 0) {
            tile.classList.add('empty');
        } else {
            // Correct position highlight
            if (showCorrect && val === GOAL_STATE[idx]) {
                tile.style.background = 'var(--tile-grad-correct)';
            }

            // Heuristic badge
            const badge = tile.querySelector('.heuristic-badge');
            if (badge) {
                if (showHeuristic) {
                    const ti = GOAL_STATE.indexOf(val);
                    const d = Math.abs(idx % 3 - ti % 3) + Math.abs(Math.floor(idx / 3) - Math.floor(ti / 3));
                    badge.textContent = `h=${d}`;
                    badge.style.display = 'block';
                } else {
                    badge.style.display = 'none';
                }
            }

            // Highlighted tile (during replay / solve)
            if (highlightIndices.includes(idx)) {
                tile.classList.add('highlighted');
            }
        } // Added missing closing brace

        DOM.board.appendChild(tile);
    });

    // Apply heuristic visibility via class on board wrapper
    if (showHeuristic) {
        DOM.boardWrapper.classList.add('show-heuristic');
    } else {
        DOM.boardWrapper.classList.remove('show-heuristic');
    }
}

function tileDistance(val, currentIdx) {
    const targetIdx = GOAL_STATE.indexOf(val);
    return Math.abs(currentIdx % 3 - targetIdx % 3) + Math.abs(Math.floor(currentIdx / 3) - Math.floor(targetIdx / 3));
}

// =====================================================
// TILE CLICK (MANUAL PLAY)
// =====================================================
function playSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
}

function handleTileClick(idx) {
    const emptyIdx = state.board.indexOf(0);
    if (!isAdjacent(idx, emptyIdx)) return;

    // Record move
    const movedTile = state.board[idx];
    startTimerIfNeeded();
    swap(state.board, idx, emptyIdx);

    const conf = typeof Settings !== 'undefined' ? Settings.get() : { sound: false };
    if (conf.sound) playSound();

    const h = getManhattanDistance(state.board);
    const g = state.moveHistory.length + 1;
    state.moveHistory.push({ tile: movedTile, h, g, source: 'player' });

    renderBoard([emptyIdx]); // highlight where the tile moved TO
    updateMetrics(g, h);
    updateEvalBar();
    appendMoveToHistory(state.moveHistory.length, movedTile, h);
    updateAlgoInfo(g + h, g, h, '—', '—');

    if (isGoal(state.board)) {
        stopTimer();
        triggerSolvedByPlayer();
    }
}

function isAdjacent(i1, i2) {
    return Math.abs(Math.floor(i1 / 3) - Math.floor(i2 / 3)) + Math.abs(i1 % 3 - i2 % 3) === 1;
}

function swap(arr, a, b) { [arr[a], arr[b]] = [arr[b], arr[a]]; }

// =====================================================
// SHUFFLE & RESET
// =====================================================
function recordLossIfNeeded() {
    if (state.moveHistory.length > 0 && !isGoal(state.board)) {
        state.sessionStats.failed++;
        state.sessionStats.streak = 0;
        if (!state.sessionStats.history) state.sessionStats.history = [];
        state.sessionStats.history.push({ result: 'Loss', moves: state.moveHistory.length, time: (state.elapsedMs / 1000).toFixed(1) + 's' });
        if (state.sessionStats.history.length > 10) state.sessionStats.history.shift();
        
        // Minor penalty for giving up
        currentRating = Math.max(400, currentRating - 10);
        DOM.profileRating.textContent = currentRating;
        if (DOM.playerRating) DOM.playerRating.textContent = '⭐ ' + currentRating;
        
        updateSessionStats();
    }
}

function shuffleBoard() {
    recordLossIfNeeded();
    stopTimer();
    clearReplay();
    resetMoveHistory();
    DOM.btnViewReview.classList.add('hidden');
    DOM.replayControls.classList.add('hidden');
    // Hide solution path
    if (DOM.solutionPathSection) DOM.solutionPathSection.classList.add('hidden');

    let shuffled;
    let attempts = 0;
    do {
        shuffled = [...GOAL_STATE].sort(() => Math.random() - 0.5);
        attempts++;
    } while ((!isSolvable(shuffled) || isGoal(shuffled)) && attempts < 1000);

    state.board = shuffled;
    state.solvedPath = null;
    state.moveHistory = [];
    state.elapsedMs = 0;
    DOM.playerTimer.textContent = '0.0s';

    const h = getManhattanDistance(state.board);
    DOM.metricTime.textContent = '0.0s';
    DOM.metricMoves.textContent = '0';
    DOM.metricNodes.textContent = '0';
    DOM.metricHeuristic.textContent = h;
    DOM.aiOptimal.textContent = '—';
    updateAlgoInfo(h, 0, h, 0, 0);
    renderBoard();
    updateEvalBar();
}

function resetBoard() {
    recordLossIfNeeded();
    stopTimer();
    clearReplay();
    resetMoveHistory();
    DOM.btnViewReview.classList.add('hidden');
    DOM.replayControls.classList.add('hidden');
    // Hide solution path
    if (DOM.solutionPathSection) DOM.solutionPathSection.classList.add('hidden');

    state.board = [...GOAL_STATE];
    state.solvedPath = null;
    state.moveHistory = [];
    state.elapsedMs = 0;
    DOM.playerTimer.textContent = '0.0s';
    DOM.metricTime.textContent = '0.0s';
    DOM.metricMoves.textContent = '0';
    DOM.metricNodes.textContent = '0';
    DOM.metricHeuristic.textContent = '0';
    DOM.aiOptimal.textContent = '—';
    updateAlgoInfo(0, 0, 0, 0, 0);
    renderBoard();
    updateEvalBar();
}

// =====================================================
// SOLVABILITY CHECK (inversion count)
// =====================================================
function isSolvable(board) {
    const flat = board.filter(n => n !== 0);
    let inv = 0;
    for (let i = 0; i < flat.length; i++)
        for (let j = i + 1; j < flat.length; j++)
            if (flat[i] > flat[j]) inv++;
    return inv % 2 === 0;  // odd width grid: solvable iff inversions even
}

// =====================================================
// TIMER
// =====================================================
function startTimerIfNeeded() {
    if (state.timerInterval) return;
    state.timerStart = Date.now() - state.elapsedMs;
    state.timerInterval = setInterval(() => {
        state.elapsedMs = Date.now() - state.timerStart;
        const secs = (state.elapsedMs / 1000).toFixed(1);
        DOM.metricTime.textContent = secs + 's';
        DOM.playerTimer.textContent = secs + 's';
    }, 100);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

// =====================================================
// METRICS & UI UPDATES
// =====================================================
function updateMetrics(moves, h) {
    DOM.metricMoves.textContent = moves;
    DOM.metricHeuristic.textContent = h;
}

function updateAlgoInfo(f, g, h, openSize, closedSize) {
    DOM.algoF.textContent = (f === '—' || f === undefined) ? '—' : f;
    DOM.algoG.textContent = g;
    DOM.algoH.textContent = h;
    DOM.algoOpen.textContent = openSize;
    DOM.algoClosed.textContent = closedSize;
}

function updateEvalBar() {
    const h = getManhattanDistance(state.board);
    const maxH = 28; // theoretical max manhattan distance for 8-puzzle
    const pct = Math.max(3, Math.min(97, ((maxH - h) / maxH) * 100));
    DOM.evalBarFill.style.height = pct + '%';
}

function appendMoveToHistory(num, tile, h) {
    // Remove empty placeholder
    const empty = DOM.moveHistoryList.querySelector('.mh-empty');
    if (empty) empty.remove();

    const row = document.createElement('div');
    row.classList.add('mh-row');
    row.id = `mh-row-${num}`;
    row.innerHTML = `
        <span class="mh-num">${num}</span>
        <span><span class="mh-tile">${tile}</span></span>
        <span class="mh-h">${h}</span>
    `;
    DOM.moveHistoryList.appendChild(row);
    DOM.moveHistoryList.scrollTop = DOM.moveHistoryList.scrollHeight;
}

function resetMoveHistory() {
    DOM.moveHistoryList.innerHTML = '<div class="mh-empty">No moves yet</div>';
}

function highlightMoveHistoryRow(step) {
    DOM.moveHistoryList.querySelectorAll('.mh-row').forEach(r => r.classList.remove('current-step'));
    const row = document.getElementById(`mh-row-${step}`);
    if (row) {
        row.classList.add('current-step');
        row.scrollIntoView({ block: 'nearest' });
    }
}

// =====================================================
// A* SEARCH ALGORITHM
// =====================================================
function getManhattanDistance(board) {
    let d = 0;
    for (let i = 0; i < board.length; i++) {
        const v = board[i];
        if (v === 0) continue;
        const ti = GOAL_STATE.indexOf(v);
        d += Math.abs(i % 3 - ti % 3) + Math.abs(Math.floor(i / 3) - Math.floor(ti / 3));
    }
    return d;
}

function isGoal(board) {
    return board.every((v, i) => v === GOAL_STATE[i]);
}

function getNeighbors(board) {
    const ei = board.indexOf(0);
    const r = Math.floor(ei / 3), c = ei % 3;
    const neighbors = [];
    for (const { dr, dc, label } of MOVES_MAP) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
            const nb = [...board];
            const ni = nr * 3 + nc;
            [nb[ei], nb[ni]] = [nb[ni], nb[ei]];
            neighbors.push({ board: nb, movedTile: board[ni], direction: label });
        }
    }
    return neighbors;
}

function computeAStar(initial) {
    const openSet = new MinHeap();
    const closedSet = new Set();
    const gMap = new Map();
    let nodesExpanded = 0;

    const startH = getManhattanDistance(initial);
    const startNode = { board: initial, g: 0, h: startH, f: startH, parent: null, movedTile: null, direction: null };
    openSet.insert(startNode);
    gMap.set(initial.join(''), 0);

    // Track open/closed counts at key points for UI
    let peakOpen = 0, peakClosed = 0;

    while (!openSet.isEmpty()) {
        const cur = openSet.extractMin();
        nodesExpanded++;
        const key = cur.board.join('');

        if (closedSet.has(key)) continue;
        closedSet.add(key);
        peakClosed = closedSet.size;
        peakOpen = Math.max(peakOpen, openSet.size);

        if (isGoal(cur.board)) {
            // Reconstruct path
            const path = [];
            const moves = []; // movedTile + direction for history
            let node = cur;
            while (node) {
                path.push(node.board);
                if (node.movedTile !== null) moves.push({ tile: node.movedTile, direction: node.direction });
                node = node.parent;
            }
            path.reverse();
            moves.reverse();
            return { path, moves, nodes: nodesExpanded, peakOpen, peakClosed };
        }

        for (const { board: nb, movedTile, direction } of getNeighbors(cur.board)) {
            const nbKey = nb.join('');
            if (closedSet.has(nbKey)) continue;
            const tentG = cur.g + 1;
            if (!gMap.has(nbKey) || tentG < gMap.get(nbKey)) {
                gMap.set(nbKey, tentG);
                const h = getManhattanDistance(nb);
                openSet.insert({ board: nb, g: tentG, h, f: tentG + h, parent: cur, movedTile, direction });
            }
        }
    }
    return null;
}

// =====================================================
// SOLVE ANIMATION
// =====================================================
async function startSolving() {
    if (!isSolvable(state.board)) {
        DOM.overlay.classList.remove('hidden');
        return;
    }
    if (isGoal(state.board)) return;

    state.isSolving = true;
    disableControls(true);
    DOM.solvingOverlay.classList.remove('hidden');
    DOM.replayControls.classList.add('hidden');
    clearReplay();
    stopTimer();

    // Reset metrics for AI solve
    state.moveHistory = [];
    resetMoveHistory();
    state.elapsedMs = 0;

    // Give the browser a moment to render the overlay before blocking computation
    await delay(60);

    const result = computeAStar(state.board);

    DOM.solvingOverlay.classList.add('hidden');

    if (!result) {
        state.isSolving = false;
        disableControls(false);
        DOM.overlay.classList.remove('hidden');
        return;
    }

    // Show optimal move count
    const optimalMoves = result.path.length - 1;
    DOM.aiOptimal.textContent = optimalMoves;
    DOM.metricNodes.textContent = result.nodes;
    updateAlgoInfo(result.path[0] ? getManhattanDistance(result.path[0]) : 0, 0, getManhattanDistance(result.path[0] || state.board), result.peakOpen, result.peakClosed);

    state.solvedPath = result.path;

    // Build move history from result.moves
    result.moves.forEach((mv, i) => {
        const h = getManhattanDistance(result.path[i + 1]);
        state.moveHistory.push({ tile: mv.tile, h, g: i + 1, source: 'ai' });
        appendMoveToHistory(i + 1, mv.tile, h);
    });

    // Animate
    startTimerIfNeeded();
    await animatePath(result.path);

    stopTimer();
    state.isSolving = false;
    disableControls(false);

    // Flash the board
    DOM.boardWrapper.classList.add('solved-flash');
    setTimeout(() => DOM.boardWrapper.classList.remove('solved-flash'), 1600);

    // Show review button
    DOM.btnViewReview.classList.remove('hidden');

    // Save solve result
    state.lastSolveResult = {
        moves: optimalMoves,
        nodes: result.nodes,
        timeSec: state.elapsedMs / 1000,
        source: 'ai',
        efficiency: 100,
    };

    // (Player solving handles rating/history. A* solve does not grant rating or history per user request)

    // Show replay
    showReplayControls();
    jumpReplay(result.path.length - 1); // show goal state

    // Build solution path panel
    buildSolutionPath(result.path, result.moves);

    // Open review
    setTimeout(() => showReviewModal(state.lastSolveResult), 800);
}

async function animatePath(path) {
    for (let i = 1; i < path.length; i++) {
        state.board = path[i];
        const prevEmpty = path[i - 1].indexOf(0);
        const curEmpty = path[i].indexOf(0);
        renderBoard([prevEmpty, curEmpty]);
        updateEvalBar();
        updateMetrics(i, getManhattanDistance(state.board));
        highlightMoveHistoryRow(i);
        highlightSolutionCard(i);
        updateAlgoInfo(
            getManhattanDistance(state.board) + i,
            i,
            getManhattanDistance(state.board),
            '—', '—'
        );
        await delay(state.speedMs);
    }
    renderBoard(); // final clean render
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================================================
// PLAYER SOLVED
// =====================================================
function triggerSolvedByPlayer() {
    const moves = state.moveHistory.length;
    const timeSec = state.elapsedMs / 1000;

    // Compare player moves vs A* optimal
    const optResult = computeAStar([...GOAL_STATE]); // Can't do this; need original start
    // Instead, we compute optimal from the original shuffle: store it at shuffle time
    const optimal = state.optimalMoves || moves;
    const efficiency = Math.min(100, Math.round((optimal / moves) * 100));

    state.lastSolveResult = { moves, nodes: '—', timeSec, source: 'player', efficiency };
    state.sessionStats.solved++;
    state.sessionStats.streak++;
    if (!state.sessionStats.bestTime || state.elapsedMs < state.sessionStats.bestTime) {
        state.sessionStats.bestTime = state.elapsedMs;
    }
    
    // Add History Entry
    if (!state.sessionStats.history) state.sessionStats.history = [];
    state.sessionStats.history.push({ result: 'Win', moves, time: timeSec.toFixed(1) + 's' });
    if (state.sessionStats.history.length > 10) state.sessionStats.history.shift();

    updateSessionStats();
    updateRating(Math.round(20 * (efficiency / 100)));

    DOM.boardWrapper.classList.add('solved-flash');
    setTimeout(() => DOM.boardWrapper.classList.remove('solved-flash'), 1600);
    DOM.btnViewReview.classList.remove('hidden');
    setTimeout(() => showReviewModal(state.lastSolveResult), 600);
}

// =====================================================
// REPLAY ENGINE
// =====================================================
function showReplayControls() {
    if (!state.solvedPath) return;
    DOM.replayControls.classList.remove('hidden');
    state.replayStep = state.solvedPath.length - 1;
    updateReplayLabel();
}

function jumpReplay(step) {
    if (!state.solvedPath) return;
    step = Math.max(0, Math.min(step, state.solvedPath.length - 1));
    state.replayStep = step;
    state.board = [...state.solvedPath[step]];

    const prevStep = Math.max(0, step - 1);
    const prevEmpty = state.solvedPath[prevStep].indexOf(0);
    const curEmpty = state.board.indexOf(0);

    renderBoard(step > 0 ? [prevEmpty, curEmpty] : []);
    updateReplayLabel();
    updateEvalBar();
    updateMetrics(step, getManhattanDistance(state.board));
    if (step > 0) highlightMoveHistoryRow(step);
    highlightSolutionCard(step);
}

function updateReplayLabel() {
    if (!state.solvedPath) return;
    DOM.replayStepLabel.textContent = `Step ${state.replayStep} / ${state.solvedPath.length - 1}`;
}

function toggleAutoReplay() {
    if (state.replayAutoInterval) {
        stopAutoReplay();
    } else {
        DOM.btnReplayAuto.innerHTML = '<i class="fa-solid fa-pause"></i>';
        if (state.replayStep >= state.solvedPath.length - 1) jumpReplay(0);
        state.replayAutoInterval = setInterval(() => {
            if (state.replayStep < state.solvedPath.length - 1) {
                jumpReplay(state.replayStep + 1);
            } else {
                stopAutoReplay();
            }
        }, state.speedMs);
    }
}

function stopAutoReplay() {
    if (state.replayAutoInterval) {
        clearInterval(state.replayAutoInterval);
        state.replayAutoInterval = null;
        DOM.btnReplayAuto.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

function clearReplay() {
    stopAutoReplay();
    state.replayStep = 0;
}

// =====================================================
// POST-GAME REVIEW MODAL
// =====================================================
function showReviewModal(result) {
    const { moves, timeSec, source } = result;
    const optMoves = state.optimalMoves || moves;
    const efficiency = source === 'ai' ? 100 : Math.min(100, Math.round((optMoves / moves) * 100));

    // GRADE logic
    let grade, gradeClass, title, subtitle, analysis;
    const speedScore = Math.max(0, 100 - Math.floor(timeSec * 3));
    const accuracyScore = efficiency;
    const overallScore = Math.round((efficiency * 0.6 + speedScore * 0.4));

    if (overallScore >= 90) {
        grade = 'S'; gradeClass = 'grade-S'; title = 'Flawless Solve!'; subtitle = 'Perfect execution by A* algorithm';
        analysis = `The A* algorithm found the <strong>globally optimal</strong> path of <strong>${moves} moves</strong> in just <strong>${timeSec.toFixed(2)}s</strong>. With a Manhattan Distance heuristic, every expanded node brought us closer to the goal. No unnecessary detours — this is algorithmic perfection.`;
    } else if (overallScore >= 75) {
        grade = 'A'; gradeClass = 'grade-A'; title = 'Excellent!'; subtitle = 'Near-optimal performance';
        analysis = `Great solve! The puzzle was solved in <strong>${moves} moves</strong> with high efficiency. The A* heuristic guided the search with excellent accuracy. Only a slight variation from optimal indicates the search space was efficiently explored.`;
    } else if (overallScore >= 55) {
        grade = 'B'; gradeClass = 'grade-B'; title = 'Good Job!'; subtitle = 'Solid performance';
        analysis = `The puzzle was solved in <strong>${moves} moves</strong>. While the solution is valid, there could be more optimal paths. The Manhattan Distance heuristic helps prune the search space, but some suboptimal expansions occurred. Try Medium or Fast speed to see more steps per second.`;
    } else {
        grade = 'C'; gradeClass = 'grade-C'; title = 'Completed'; subtitle = 'Room for improvement';
        analysis = `The puzzle was solved in <strong>${moves} moves</strong> over <strong>${timeSec.toFixed(2)} seconds</strong>. Consider using the A* auto-solver to see the optimal path. The heuristic toggle can help you understand why certain moves are preferred.`;
    }

    // Reset grade classes
    DOM.modalGrade.className = 'modal-grade ' + gradeClass;
    DOM.modalGrade.textContent = grade;
    DOM.modalTitle.textContent = title;
    DOM.modalSubtitle.textContent = subtitle;
    DOM.reviewAnalysis.innerHTML = analysis;

    // Stats grid
    DOM.reviewStatsGrid.innerHTML = `
        <div class="review-stat-box">
            <div class="review-stat-value" style="color:var(--accent)">${moves}</div>
            <div class="review-stat-label">Moves</div>
        </div>
        <div class="review-stat-box">
            <div class="review-stat-value" style="color:var(--accent-3)">${timeSec.toFixed(1)}s</div>
            <div class="review-stat-label">Time</div>
        </div>
        <div class="review-stat-box">
            <div class="review-stat-value" style="color:var(--accent-2)">${result.nodes || '—'}</div>
            <div class="review-stat-label">Nodes</div>
        </div>
        <div class="review-stat-box">
            <div class="review-stat-value" style="color:${efficiency >= 80 ? 'var(--accent)' : 'var(--accent-2)'}">${efficiency}%</div>
            <div class="review-stat-label">Efficiency</div>
        </div>
        <div class="review-stat-box">
            <div class="review-stat-value">${optMoves}</div>
            <div class="review-stat-label">Optimal</div>
        </div>
        <div class="review-stat-box">
            <div class="review-stat-value" style="color:var(--accent)">${overallScore}</div>
            <div class="review-stat-label">Score</div>
        </div>
    `;

    // Bars
    setTimeout(() => {
        DOM.barEfficiency.style.width = efficiency + '%';
        DOM.lblEfficiency.textContent = efficiency + '%';
        DOM.barSpeed.style.width = speedScore + '%';
        DOM.lblSpeed.textContent = speedScore + '%';
        DOM.barAccuracy.style.width = accuracyScore + '%';
        DOM.lblAccuracy.textContent = accuracyScore + '%';
    }, 100);

    DOM.reviewModal.classList.remove('hidden');
}

function openReview() {
    if (state.lastSolveResult) showReviewModal(state.lastSolveResult);
}

function closeReview() {
    DOM.reviewModal.classList.add('hidden');
    // Animate bars back to 0 for next time
    DOM.barEfficiency.style.width = '0%';
        DOM.barAccuracy.style.width = '0%';
}

// =====================================================
// PERSISTENT STATS & HISTORY
// =====================================================
let currentRating = 1200;
const currentUserName = (typeof Auth !== 'undefined') ? (Auth.getUser() || 'Player') : 'Player';
const LS_STATS_KEY = `8puzzle_session_stats_${currentUserName}`;

// Migrate old stats if they exist
if (!localStorage.getItem(LS_STATS_KEY) && localStorage.getItem('8puzzle_session_stats')) {
    localStorage.setItem(LS_STATS_KEY, localStorage.getItem('8puzzle_session_stats'));
}

function loadSessionStats() {
    const raw = localStorage.getItem(LS_STATS_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            state.sessionStats = { ...state.sessionStats, ...parsed };
            if (parsed.rating !== undefined) {
                currentRating = parsed.rating;
            }
        } catch (e) {}
    }
    // Don't call updateSessionStats here yet because DOM might not be fully ready in init() before renderBoard
}

function saveSessionStats() {
    state.sessionStats.rating = currentRating;
    localStorage.setItem(LS_STATS_KEY, JSON.stringify(state.sessionStats));
}

function updateRating(delta) {
    currentRating = Math.max(400, Math.round(currentRating + delta));
    DOM.profileRating.textContent = currentRating;
    if (DOM.playerRating) DOM.playerRating.textContent = '⭐ ' + currentRating;
}

function updateSessionStats() {
    const s = state.sessionStats;
    DOM.statSolved.textContent = s.solved;
    DOM.statFailed.textContent = s.failed;
    DOM.statStreak.textContent = s.streak;
    DOM.statBestTime.textContent = s.bestTime ? (s.bestTime / 1000).toFixed(1) + 's' : '—';

    // Render History
    const historyList = document.getElementById('player-history-list');
    if (historyList) {
        historyList.innerHTML = '';
        if (!s.history || s.history.length === 0) {
            historyList.innerHTML = '<div class="history-empty" style="text-align: center; color: var(--text-dim); font-size: 0.8rem; padding: 1.5rem;">No games played yet.</div>';
        } else {
            s.history.slice().reverse().forEach(game => {
                const el = document.createElement('div');
                el.style.display = 'flex';
                el.style.justifyContent = 'space-between';
                el.style.alignItems = 'center';
                el.style.padding = '8px 14px';
                el.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
                el.style.fontSize = '0.85rem';
                
                const resColor = game.result === 'Win' ? 'var(--accent)' : 'var(--danger)';
                const resIcon = game.result === 'Win' ? 'fa-check-circle' : 'fa-times-circle';
                
                el.innerHTML = `
                    <div style="color: ${resColor}; font-weight: 600; width: 60px;"><i class="fas ${resIcon}"></i> ${game.result}</div>
                    <div style="color: var(--text-muted);"><i class="fas fa-arrows-alt"></i> ${game.moves}</div>
                    <div style="color: var(--text-muted);"><i class="fas fa-stopwatch"></i> ${game.time}</div>
                `;
                historyList.appendChild(el);
            });
        }
    }
    saveSessionStats();
}

// =====================================================
// CONTROLS ENABLE/DISABLE
// =====================================================
function disableControls(disabled) {
    DOM.btnShuffle.disabled = disabled;
    DOM.btnSolve.disabled = disabled;
    DOM.btnReset.disabled = disabled;
    DOM.speedTabs.forEach(t => t.disabled = disabled);
}

// =====================================================
// SOLUTION PATH — STEP BY STEP PANEL
// =====================================================

/**
 * Build the scrollable solution path panel.
 * First card '#0 START' shows initial board.
 * Each subsequent card shows a step with direction, g/h/f.
 * @param {Array<Array<number>>} path  - from computeAStar
 * @param {Array<{tile, direction}>} moves
 */
function buildSolutionPath(path, moves) {
    const body = DOM.solutionPathBody;
    body.innerHTML = '';
    body.classList.remove('collapsed');
    if (DOM.spToggleIcon) DOM.spToggleIcon.className = 'fas fa-chevron-up';

    const DIRECTION_LABELS = {
        '↑': 'UP',
        '↓': 'DOWN',
        '←': 'LEFT',
        '→': 'RIGHT'
    };

    // Helper to build a single card DOM
    const createCard = (stepNum, boardState, movedIdx, isStart, g, h, f, dirText, movedTile) => {
        const card = document.createElement('div');
        card.classList.add('sp-card');
        if (isStart) card.classList.add('sp-start-card', 'sp-current');
        card.id = `sp-card-${stepNum}`;

        // Number
        const numEl = document.createElement('div');
        numEl.classList.add('sp-card-num');
        numEl.textContent = `#${stepNum}`;
        card.appendChild(numEl);

        // Mini board
        const miniBoard = document.createElement('div');
        miniBoard.classList.add('sp-mini-board');
        
        boardState.forEach((val, idx) => {
            const cell = document.createElement('div');
            cell.classList.add('sp-cell');
            if (val === 0) {
                cell.classList.add('sp-empty');
            } else {
                cell.textContent = val;
                if (!isStart && idx === movedIdx) {
                    cell.classList.add('sp-moved');
                }
            }
            miniBoard.appendChild(cell);
        });
        card.appendChild(miniBoard);

        // Info info
        const info = document.createElement('div');
        info.classList.add('sp-info');
        
        const hLabel = isStart ? 'START' : dirText;
        const subLabel = isStart ? '' : `<div class="sp-tile-moved">tile <span>${movedTile}</span> moved</div>`;
        
        info.innerHTML = `
            <div class="sp-direction">${hLabel}</div>
            <div class="sp-values">
                g=${g}&nbsp;&nbsp;h=${h}&nbsp;&nbsp;f=${f}
            </div>
            ${subLabel}
        `;
        card.appendChild(info);

        card.addEventListener('click', () => {
            stopAutoReplay();
            jumpReplay(stepNum);
            highlightSolutionCard(stepNum);
        });

        return card;
    };

    // 1. Build #0 START card
    const h0 = getManhattanDistance(path[0]);
    body.appendChild(createCard(0, path[0], null, true, 0, h0, h0, '', null));

    // 2. Build standard move cards
    moves.forEach((mv, i) => {
        const boardBefore = path[i];
        const boardAfter  = path[i + 1];

        const g = i + 1;
        const h = getManhattanDistance(boardAfter);
        const f = g + h;

        const movedToIdx = boardBefore.indexOf(0);
        const dirLabel = DIRECTION_LABELS[mv.direction] || mv.direction;

        const card = createCard(g, boardAfter, movedToIdx, false, g, h, f, dirLabel, mv.tile);
        body.appendChild(card);
    });

    // Show count
    DOM.spCount.textContent = `${moves.length} steps`;
    DOM.solutionPathSection.classList.remove('hidden');

    body.scrollTop = 0;
}

/**
 * Highlight the card corresponding to the current replay step.
 */
function highlightSolutionCard(step) {
    document.querySelectorAll('.sp-card').forEach(c => c.classList.remove('sp-current'));
    const card = document.getElementById(`sp-card-${step}`);
    if (card) {
        card.classList.add('sp-current');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// =====================================================
// BOOT
// =====================================================
window.addEventListener('DOMContentLoaded', () => {
    init();
    // Start with a shuffled board
    shuffleBoard();
});
