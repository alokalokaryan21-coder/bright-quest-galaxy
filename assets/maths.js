(() => {
  const answers = document.querySelector('#answers');
  if (!answers) return;

  const levels = [...document.querySelectorAll('[data-level]')];
  const sum = document.querySelector('#sum');
  const status = document.querySelector('#game-status');
  const stats = document.querySelector('#stats');
  const celebration = document.querySelector('#celebration');
  const title = document.querySelector('#celebration-title');
  const score = document.querySelector('#completion-score');
  const time = document.querySelector('#completion-time');
  const nextLevel = document.querySelector('#next-level');
  const roundSize = 5;
  let level = 0;
  let index = 0;
  let correct = 0;
  let startedAt;
  let advanceTimer;
  let operations;
  const usedQuestions = new Set();

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function shuffle(values) {
    for (let index = values.length - 1; index > 0; index--) {
      const other = randomInt(0, index);
      [values[index], values[other]] = [values[other], values[index]];
    }
    return values;
  }

  function makeQuestion(operation) {
    if (operation === 0) {
      const a = randomInt(1, 20);
      const b = randomInt(a, 20);
      return { text: `${a} + ${b} = ?`, result: a + b };
    }
    if (operation === 1) {
      const a = randomInt(15, 50);
      const b = randomInt(2, a - 1);
      return { text: `${a} − ${b} = ?`, result: a - b };
    }
    const a = randomInt(2, 12);
    const b = randomInt(a, 12);
    return { text: `${a} × ${b} = ?`, result: a * b };
  }

  function draw(focusQuestion = false) {
    let question;
    do {
      question = makeQuestion(operations[index]);
    } while (usedQuestions.has(question.text));
    usedQuestions.add(question.text);
    sum.textContent = question.text;
    stats.textContent = `Question ${index + 1} of ${roundSize} · ${correct} correct`;
    status.textContent = 'Choose the right answer to power your rocket.';
    const guesses = new Set([question.result]);
    while (guesses.size < 4) {
      guesses.add(randomInt(Math.max(0, question.result - 12), question.result + 12));
    }
    answers.replaceChildren();
    shuffle([...guesses]).forEach(value => {
      const button = document.createElement('button');
      button.className = 'answer';
      button.textContent = value;
      button.type = 'button';
      button.addEventListener('click', () => choose(button, value, question.result));
      answers.append(button);
    });
    if (focusQuestion) sum.focus();
  }

  function showCelebration(elapsedSeconds) {
    const master = level === levels.length - 1;
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = String(elapsedSeconds % 60).padStart(2, '0');
    title.textContent = master ? 'Congratulations, Maths Champion!' : 'Congratulations!';
    score.textContent = `Score: ${correct} out of ${roundSize}`;
    time.textContent = `Completion time: ${minutes}:${seconds}`;
    nextLevel.hidden = master;
    sum.textContent = `${correct} / ${roundSize}`;
    stats.textContent = `${correct} correct out of ${roundSize}`;
    status.textContent = 'Mission complete! 🌟';
    answers.replaceChildren();
    celebration.showModal();
    title.focus();
  }

  function choose(button, value, result) {
    const correctAnswer = [...answers.children].find(answer => Number(answer.textContent) === result);
    correctAnswer.classList.add('correct');
    if (value === result) {
      correct++;
      status.textContent = 'Correct! Your rocket is flying higher! 🚀';
    } else {
      button.classList.add('wrong');
      status.textContent = `Good try! The answer was ${result}.`;
    }
    [...answers.children].forEach(answer => { answer.disabled = true; });
    const elapsedSeconds = Math.floor((performance.now() - startedAt) / 1000);
    advanceTimer = setTimeout(() => {
      index++;
      if (index === roundSize) showCelebration(elapsedSeconds);
      else draw(true);
    }, 1050);
  }

  function reset(newLevel = level, focusQuestion = false) {
    clearTimeout(advanceTimer);
    if (celebration.open) celebration.close();
    level = newLevel;
    index = 0;
    correct = 0;
    usedQuestions.clear();
    operations = level === levels.length - 1
      ? shuffle([0, 1, 2, randomInt(0, 2), randomInt(0, 2)])
      : Array(roundSize).fill(level);
    levels.forEach((button, index) => {
      const selected = index === level;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    startedAt = performance.now();
    draw(focusQuestion);
  }

  levels.forEach((button, index) => button.addEventListener('click', () => reset(index)));
  document.querySelector('#restart').addEventListener('click', () => reset(level, true));
  document.querySelector('#try-again').addEventListener('click', () => reset(level, true));
  nextLevel.addEventListener('click', () => reset(level + 1, true));
  reset();
})();
