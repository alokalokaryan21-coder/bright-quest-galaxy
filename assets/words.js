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

  function renderAnswer(word, puzzle) {
    const solved = Boolean(puzzle && isSolved(word, puzzle));
    const letters = puzzle?.typed.map(index => puzzle.tiles[index]) || [];
    slots.replaceChildren();
    for (let index = 0; index < (word?.length || 0); index++) {
      const slot = document.createElement('span');
      slot.className = 'word-slot';
      slot.textContent = letters[index] || '';
      slots.append(slot);
    }
    [...bank.children].forEach((tile, index) => {
      tile.disabled = solved || puzzle.typed.includes(index) || letters.length === word.length;
    });
    undo.disabled = letters.length === 0;
    hint.disabled = restart.disabled = !puzzle;
    next.hidden = !puzzle;
    next.disabled = !solved;
    start.hidden = Boolean(puzzle);
    updateAllowance();
  }

  function renderPuzzle() {
    const word = activeWord();
    const puzzle = progress.puzzles[word];
    const description = clues[progress.level].get(word);
    clue.textContent = description ? `${description} (${word.length} letters)` : 'Choose a level and start a word';
    bank.replaceChildren();
    puzzle?.tiles.forEach((letter, index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'letter-tile';
      tile.textContent = letter;
      tile.setAttribute('aria-label', `Add letter ${letter}`);
      tile.addEventListener('click', () => {
        puzzle.typed.push(index);
        const solved = isSolved(word, puzzle);
        if (solved) puzzle.completed = true;
        saveProgress();
        renderAnswer(word, puzzle);
        if (solved) {
          renderHistory();
          status.textContent = completionMessage();
          next.focus();
        } else if (puzzle.typed.length === word.length) {
          status.textContent = 'Not quite. Undo a letter and try again.';
          undo.focus();
        } else {
          status.textContent = 'Keep going!';
          bank.querySelector('button:not(:disabled)')?.focus();
        }
      });
      bank.append(tile);
    });
    if (puzzle) {
      status.textContent = isSolved(word, puzzle)
        ? completionMessage()
        : puzzle.typed.length === word.length
          ? 'Not quite. Undo a letter and try again.'
          : 'Tap the letters to build the word.';
    }
    renderAnswer(word, puzzle);
    renderHistory();
  }

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
    saveProgress();
    renderAnswer(word, puzzle);
    status.textContent = 'You can do it!';
    if (undo.disabled) bank.firstElementChild?.focus();
  });

  hint.addEventListener('click', () => {
    const word = activeWord();
    if (word) status.textContent = `Hint: the word starts with ${word[0]} and ends with ${word.at(-1)}.`;
  });
  restart.addEventListener('click', clearAnswer);
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
})();
