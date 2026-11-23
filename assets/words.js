(() => {
  const bank = document.querySelector('#letter-bank');
  if (!bank) return;

  const storageKey = 'moonberry.word-trails.v1';
  const dailyLimit = 5;
  const levels = [...document.querySelectorAll('[data-level]')];
  const clues = wordBank.map(entries => new Map(entries));
  const clue = document.querySelector('#clue');
  const slots = document.querySelector('#word-slots');
  const stats = document.querySelector('#stats');
  const status = document.querySelector('#game-status');
  const history = document.querySelector('#puzzle-history');
  const undo = document.querySelector('#undo');
  const hint = document.querySelector('#hint');
  const restart = document.querySelector('#restart');
  const next = document.querySelector('#next');
  const start = document.querySelector('#new-word');
  const drag = document.querySelector('#drag-mode');
  const timer = document.querySelector('#trail-timer');
  const size = 4;
  let board;
  let hinted;
  let activePointer = null;
  let previousCell = null;

  function readProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved?.puzzles && Array.isArray(saved.active) && clues[saved.level]) return saved;
    } catch {
      // Storage can be unavailable in a private or restricted browser.
    }
    return { level: 0, active: [null, null, null, null], puzzles: {} };
  }

  let progress = readProgress();
  let sessionOnly = false;
  let midnightTimer;

  function saveProgress() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      sessionOnly = true;
    }
  }

  function localDay(now = new Date()) {
    return [now.getFullYear(), now.getMonth() + 1, now.getDate()].join('-');
  }

  function activeWord() {
    return progress.active[progress.level];
  }

  function isSolved(word, puzzle) {
    return puzzle.typed.map(index => puzzle.tiles[index]).join('') === word;
  }

  function allowance() {
    const today = localDay();
    const issued = Object.values(progress.puzzles).filter(puzzle =>
      puzzle.level === progress.level && puzzle.day === today
    ).length;
    const unused = wordBank[progress.level].filter(([word]) => !Object.hasOwn(progress.puzzles, word));
    return { remaining: Math.max(0, dailyLimit - issued), unused };
  }

  function availabilityMessage() {
    const { remaining, unused } = allowance();
    if (!unused.length) return 'You’ve explored every word at this level! Replay a puzzle or try another level.';
    if (!remaining) return 'You’ve reached today’s limit. Replay a puzzle or come back tomorrow for more!';
    return '';
  }

  function updateAllowance() {
    const { remaining, unused } = allowance();
    const available = Math.min(remaining, unused.length);
    stats.textContent = `${available} new challenge${available === 1 ? '' : 's'} left today${sessionOnly ? ' · This visit only' : ''}`;
    start.disabled = available === 0;
    if (!activeWord()) status.textContent = availabilityMessage() || 'Each level has up to five new challenges per day.';
  }

  function scheduleMidnight() {
    clearTimeout(midnightTimer);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    midnightTimer = setTimeout(refreshDay, midnight - now);
  }

  function refreshDay() {
    updateAllowance();
    const word = activeWord();
    if (word && isSolved(word, progress.puzzles[word])) {
      status.textContent = completionMessage();
    }
    scheduleMidnight();
  }

  function completionMessage() {
    return `Wonderful! You spelled it! 🌟 ${availabilityMessage()}`.trim();
  }

  function renderHistory() {
    const words = Object.entries(progress.puzzles).filter(([, puzzle]) => puzzle.level === progress.level);
    history.replaceChildren(new Option('Choose a puzzle', ''));
    history.options[0].disabled = true;
    words.forEach(([word, puzzle], index) => {
      history.add(new Option(`Puzzle ${index + 1} · ${puzzle.completed ? 'Replay' : 'Continue'}`, word));
    });
    history.value = activeWord() || '';
    history.parentElement.hidden = words.length === 0;
  }

  function makeBoard(word, tiles) {
    // Keep the same board for a saved puzzle, including progress from the tile layout.
    const seed = [...tiles.join('')].reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 0);
    const cells = Array(size * size);
    const positions = [];
    const letters = [...tiles];
    const offset = Math.floor(seed / 8) % (cells.length - word.length + 1);
    const unused = new Set(tiles.keys());
    const alphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(letter => !word.includes(letter));

    [...word].forEach((letter, index) => {
      const part = offset + index;
      let row = Math.floor(part / size);
      let column = part % size;
      if (row % 2) column = size - 1 - column;
      if (seed & 1) row = size - 1 - row;
      if (seed & 2) column = size - 1 - column;
      if (seed & 4) [row, column] = [column, row];
      const tile = [...unused].find(candidate => tiles[candidate] === letter);
      unused.delete(tile);
      const cell = row * size + column;
      cells[cell] = tile;
      positions[tile] = cell;
    });

    for (let cell = 0; cell < cells.length; cell++) {
      if (cells[cell] !== undefined) continue;
      cells[cell] = letters.length;
      positions.push(cell);
      letters.push(alphabet[(seed + cell * 11) % alphabet.length]);
    }
    return { cells, positions, letters };
  }

  function neighbours(first, second) {
    const a = board.positions[first];
    const b = board.positions[second];
    return Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs(a % size - b % size) === 1;
  }

  function updateTimer() {
    const puzzle = progress.puzzles[activeWord()];
    const elapsed = puzzle?.began ? Math.max(0, Math.floor(((puzzle.finishedAt || Date.now()) - puzzle.began) / 1000)) : 0;
    const time = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
    if (timer.textContent !== time) timer.textContent = time;
  }

  function renderAnswer(word, puzzle) {
    const solved = Boolean(puzzle && isSolved(word, puzzle));
    const letters = puzzle?.typed.map(index => board.letters[index]) || [];
    slots.replaceChildren();
    for (let index = 0; index < (word?.length || 0); index++) {
      const slot = document.createElement('span');
      slot.className = 'word-slot';
      slot.textContent = letters[index] || '';
      slot.setAttribute('aria-label', letters[index] || 'Empty letter');
      slots.append(slot);
    }
    for (const tile of bank.children) {
      const index = Number(tile.dataset.index);
      const step = puzzle.typed.indexOf(index);
      tile.setAttribute('aria-pressed', String(step >= 0));
      tile.classList.toggle('is-hinted', index === hinted);
      delete tile.dataset.link;
      const previous = puzzle.typed[step - 1];
      if (step > 0 && neighbours(index, previous)) {
        const offset = board.positions[previous] - board.positions[index];
        tile.dataset.link = { [-size]: 'up', [size]: 'down', [-1]: 'left', [1]: 'right' }[offset];
      }
    }
    bank.classList.toggle('is-complete', solved);
    undo.disabled = letters.length === 0;
    hint.disabled = !puzzle || solved;
    restart.disabled = !puzzle || letters.length === 0;
    next.hidden = !puzzle;
    next.disabled = !solved;
    start.hidden = Boolean(puzzle);
    drag.hidden = !puzzle;
    updateAllowance();
    updateTimer();
  }

  function selectTile(index, tracing = false) {
    const word = activeWord();
    const puzzle = progress.puzzles[word];
    const existing = puzzle.typed.indexOf(index);
    if (existing >= 0) {
      if (tracing || isSolved(word, puzzle)) return;
      puzzle.typed.length = existing === puzzle.typed.length - 1 ? existing : existing + 1;
    } else {
      if (puzzle.typed.length === word.length) return;
      if (puzzle.typed.length && !neighbours(puzzle.typed.at(-1), index)) {
        if (!tracing) status.textContent = 'Choose a letter directly above, below, left, or right of the last letter.';
        return;
      }
      puzzle.began ||= Date.now();
      puzzle.typed.push(index);
    }

    const solved = isSolved(word, puzzle);
    if (solved) {
      puzzle.completed = true;
      puzzle.finishedAt = Date.now();
    }
    hinted = undefined;
    saveProgress();
    renderAnswer(word, puzzle);
    if (solved) {
      renderHistory();
      status.textContent = completionMessage();
      next.focus();
    } else {
      status.textContent = puzzle.typed.length === word.length
        ? 'Not quite. Undo a letter and try a different path.'
        : 'Keep following the trail!';
    }
  }

  function renderPuzzle() {
    const word = activeWord();
    const puzzle = progress.puzzles[word];
    const description = clues[progress.level].get(word);
    clue.textContent = description ? `${description} (${word.length} letters)` : 'Choose a level and start a word';
    bank.replaceChildren();
    bank.hidden = !puzzle;
    hinted = undefined;
    if (puzzle) {
      board = makeBoard(word, puzzle.tiles);
      board.cells.forEach((index, cell) => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'letter-tile';
        tile.textContent = board.letters[index];
        tile.dataset.index = index;
        tile.setAttribute('aria-label', `${tile.textContent}, row ${Math.floor(cell / size) + 1}, column ${cell % size + 1}`);
        tile.addEventListener('click', event => {
          if (!bank.classList.contains('drag-enabled') || event.detail === 0) selectTile(index);
        });
        bank.append(tile);
      });
      status.textContent = isSolved(word, puzzle)
        ? completionMessage()
        : puzzle.typed.length === word.length
          ? 'Not quite. Undo a letter and try a different path.'
          : 'Follow neighbouring letters to build the word.';
    }
    renderAnswer(word, puzzle);
    renderHistory();
  }

  function nextHint(word, path) {
    if (path.some((tile, index) => board.letters[tile] !== word[index])) return undefined;
    if (path.length === word.length) return path.at(-1);
    for (const tile of board.cells) {
      if (board.letters[tile] !== word[path.length] || path.includes(tile)) continue;
      if (path.length && !neighbours(path.at(-1), tile)) continue;
      if (nextHint(word, [...path, tile]) !== undefined) return tile;
    }
    return undefined;
  }

  function tracePointer(event) {
    const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest('.letter-tile');
    if (!tile || !bank.contains(tile) || tile === previousCell) return;
    previousCell = tile;
    selectTile(Number(tile.dataset.index), true);
  }

  function stopTracing(event) {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    previousCell = null;
  }

  drag.addEventListener('click', () => {
    const enabled = bank.classList.toggle('drag-enabled');
    drag.setAttribute('aria-pressed', String(enabled));
    document.querySelector('#trail-instructions').textContent = enabled
      ? 'Drag across neighbouring letters to trace a word. You can still use Tab and Enter.'
      : 'Tap a letter to start, then choose a neighbour. You can also use Tab and Enter.';
  });
  bank.addEventListener('pointerdown', event => {
    if (!bank.classList.contains('drag-enabled') || !event.isPrimary || event.button !== 0) return;
    activePointer = event.pointerId;
    bank.setPointerCapture(activePointer);
    tracePointer(event);
  });
  bank.addEventListener('pointermove', event => {
    if (event.pointerId === activePointer) tracePointer(event);
  });
  bank.addEventListener('lostpointercapture', stopTracing);

  function renderLevel() {
    levels.forEach((button, index) => {
      const selected = index === progress.level;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    renderPuzzle();
  }

  function newPuzzle() {
    const { remaining, unused } = allowance();
    if (!remaining || !unused.length) {
      updateAllowance();
      status.textContent = availabilityMessage();
      return;
    }
    const [word] = unused[Math.floor(Math.random() * unused.length)];
    const tiles = [...word];
    for (let index = tiles.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [tiles[index], tiles[other]] = [tiles[other], tiles[index]];
    }
    progress.puzzles[word] = { level: progress.level, day: localDay(), tiles, typed: [], completed: false };
    progress.active[progress.level] = word;
    saveProgress();
    renderPuzzle();
    bank.firstElementChild?.focus();
  }

  function clearAnswer() {
    const word = activeWord();
    const puzzle = progress.puzzles[word];
    if (!puzzle) return;
    puzzle.typed = [];
    delete puzzle.began;
    delete puzzle.finishedAt;
    saveProgress();
    renderPuzzle();
  }

  levels.forEach((button, index) => button.addEventListener('click', () => {
    progress.level = index;
    saveProgress();
    renderLevel();
  }));

  history.addEventListener('change', () => {
    const word = history.value;
    progress.active[progress.level] = word;
    if (progress.puzzles[word].completed) clearAnswer();
    else {
      saveProgress();
      renderPuzzle();
    }
  });

  undo.addEventListener('click', () => {
    const word = activeWord();
    const puzzle = progress.puzzles[word];
    if (!puzzle?.typed.length) return;
    puzzle.typed.pop();
    delete puzzle.finishedAt;
    hinted = undefined;
    saveProgress();
    renderAnswer(word, puzzle);
    status.textContent = 'You can do it!';
    if (undo.disabled) bank.firstElementChild?.focus();
  });

  hint.addEventListener('click', () => {
    const word = activeWord();
    const puzzle = progress.puzzles[word];
    if (!puzzle) return;
    hinted = nextHint(word, puzzle.typed);
    renderAnswer(word, puzzle);
    if (hinted === undefined) {
      status.textContent = 'Try undoing a letter or clearing the path, then ask for another hint.';
      return;
    }
    bank.querySelector('.is-hinted')?.focus();
    const cell = board.positions[hinted];
    status.textContent = `Try ${board.letters[hinted]} at row ${Math.floor(cell / size) + 1}, column ${cell % size + 1}.`;
  });
  restart.addEventListener('click', () => {
    clearAnswer();
    bank.firstElementChild?.focus();
  });
  next.addEventListener('click', () => {
    const word = activeWord();
    if (word && isSolved(word, progress.puzzles[word])) newPuzzle();
  });
  start.addEventListener('click', newPuzzle);
  window.addEventListener('focus', refreshDay);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshDay();
  });
  window.addEventListener('storage', event => {
    if (!sessionOnly && event.key === storageKey) {
      progress = readProgress();
      renderLevel();
    }
  });

  // Detect disabled storage before the first challenge is issued.
  saveProgress();
  renderLevel();
  scheduleMidnight();
  setInterval(updateTimer, 250);
})();
