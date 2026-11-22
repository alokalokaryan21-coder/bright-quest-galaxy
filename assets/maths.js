(() => {
  const answers = document.querySelector('#answers');
  if (!answers) return;

  const levels = [...document.querySelectorAll('[data-level]')];
  const descriptions = [
    'Add, subtract, and find missing numbers.',
    'Work with two-digit numbers, multiplication, and equal groups.',
    'Use division and work through several steps to find missing numbers.',
    'Solve squares, changing patterns, and multi-step logic puzzles.'
  ];
  const sum = document.querySelector('#sum');
  const type = document.querySelector('#puzzle-type');
  const status = document.querySelector('#game-status');
  const hint = document.querySelector('#puzzle-hint');
  const stats = document.querySelector('#stats');
  const fuel = document.querySelector('#fuel');
  const timer = document.querySelector('#mission-timer');
  const levelDescription = document.querySelector('#level-description');
  const hintButton = document.querySelector('#hint');
  const differentPuzzle = document.querySelector('#different-puzzle');
  const continueButton = document.querySelector('#continue-puzzle');
  const restart = document.querySelector('#restart');
  const celebration = document.querySelector('#celebration');
  const title = document.querySelector('#celebration-title');
  const nextLevel = document.querySelector('#next-level');
  const missionSize = Number(fuel.max);
  let level = 0;
  let completed;
  let correct;
  let startedAt;
  let clock;
  let puzzle;
  let answered;
  const seen = new Set();

  function formatTime() {
    const seconds = Math.floor((performance.now() - startedAt) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function updateTimer() {
    timer.textContent = formatTime();
  }

  function draw(focusQuestion = false) {
    let candidate;
    for (let attempt = 0; attempt < 60; attempt++) {
      const question = mathsQuestions.create(level, completed);
      if (!seen.has(question.prompt)) {
        candidate = question;
        break;
      }
    }
    if (!candidate) {
      status.textContent = 'You’ve seen lots of versions of this puzzle! Try this one or start a new mission.';
      return;
    }

    puzzle = candidate;
    seen.add(puzzle.prompt);
    answered = false;
    type.textContent = puzzle.type;
    sum.textContent = puzzle.prompt;
    stats.textContent = `Puzzle ${completed + 1} of ${missionSize}`;
    status.textContent = 'Choose an answer to solve the puzzle.';
    hint.hidden = true;
    hint.textContent = '';
    hintButton.disabled = false;
    differentPuzzle.disabled = false;
    continueButton.hidden = true;
    answers.replaceChildren();

    puzzle.choices.forEach(value => {
      const button = document.createElement('button');
      button.className = 'answer';
      button.textContent = value;
      button.type = 'button';
      button.addEventListener('click', () => choose(button, value));
      answers.append(button);
    });
    if (focusQuestion) sum.focus();
  }

  function showCelebration() {
    clearInterval(clock);
    const master = level === levels.length - 1;
    title.textContent = master ? 'Congratulations, Maths Champion!' : 'Congratulations!';
    document.querySelector('#completion-score').textContent = `Score: ${correct} out of ${missionSize}`;
    document.querySelector('#completion-time').textContent = `Completion time: ${timer.textContent}`;
    document.querySelector('#final-feedback').textContent = status.textContent;
    nextLevel.hidden = master;
    stats.textContent = 'Mission complete';
    continueButton.textContent = 'View results';
    continueButton.hidden = false;
    openResults();
  }

  function openResults() {
    celebration.showModal();
    title.focus();
  }

  function choose(button, value) {
    if (answered) return;
    answered = true;
    completed++;
    fuel.value = completed;
    const isCorrect = value === puzzle.answer;
    if (isCorrect) correct++;
    else button.classList.add('wrong');
    for (const option of answers.children) {
      option.disabled = true;
      if (Number(option.textContent) === puzzle.answer) option.classList.add('correct');
    }
    status.textContent = `${isCorrect ? 'Correct!' : 'Good try!'} ${puzzle.explanation}`;
    hintButton.disabled = true;
    differentPuzzle.disabled = true;
    hint.hidden = true;

    if (completed === missionSize) {
      updateTimer();
      showCelebration();
    } else {
      continueButton.textContent = 'Next puzzle →';
      continueButton.hidden = false;
      continueButton.focus();
    }
  }

  function reset(newLevel = level, focusQuestion = false) {
    clearInterval(clock);
    if (celebration.open) celebration.close();
    level = newLevel;
    completed = 0;
    correct = 0;
    seen.clear();
    levels.forEach((button, index) => {
      const selected = index === level;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    levelDescription.textContent = descriptions[level];
    fuel.value = 0;
    startedAt = performance.now();
    updateTimer();
    clock = setInterval(updateTimer, 250);
    draw(focusQuestion);
  }

  hintButton.addEventListener('click', () => {
    hint.hidden = false;
    hint.textContent = puzzle.hint;
    hint.focus();
  });
  differentPuzzle.addEventListener('click', () => draw(true));
  continueButton.addEventListener('click', () => {
    if (completed === missionSize) openResults();
    else if (answered) draw(true);
  });
  levels.forEach((button, index) => button.addEventListener('click', () => reset(index)));
  restart.addEventListener('click', () => reset(level, true));
  document.querySelector('#try-again').addEventListener('click', () => reset(level, true));
  nextLevel.addEventListener('click', () => reset(level + 1, true));
  celebration.addEventListener('cancel', event => {
    event.preventDefault();
    celebration.close();
    continueButton.focus();
  });
  reset();
})();
