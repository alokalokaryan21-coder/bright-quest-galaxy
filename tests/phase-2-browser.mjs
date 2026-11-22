// Run from the repository root with Node.js 22+, Python 3, and Chromium installed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { runInNewContext } from 'node:vm';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, description) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const outcome = await check();
    if (outcome) return outcome;
    await wait(50);
  }
  throw new Error('Timed out waiting for ' + description);
}

const profile = await mkdtemp(join(tmpdir(), 'moonberry-test-'));
const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1']);
const browser = spawn(process.env.CHROMIUM || 'chromium', [
  '--headless', '--disable-dev-shm-usage',
  ...(process.env.CHROMIUM_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
]);
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk; });
server.stderr.resume();
browser.stderr.resume();
let socket;

try {
  const address = await until(() => serverOutput.match(/port (\d+)/)?.[1], 'Python server');
  const base = 'http://127.0.0.1:' + address;
  const port = await until(async () => {
    const file = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '');
    return file.split('\n')[0];
  }, 'Chromium');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });

  let id = 0;
  const pending = new Map();
  const requests = [];
  const exceptions = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    pending.get(message.id)?.(message);
    if (message.method === 'Network.requestWillBeSent' && message.params.type === 'Document') {
      requests.push(message.params.request);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
  };
  function call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      pending.set(requestId, message => {
        pending.delete(requestId);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || expression);
    return result.result.value;
  }
  function run(fn, ...args) {
    return evaluate(`(${fn})(...${JSON.stringify(args)})`);
  }
  async function go(path) {
    const { frameId, loaderId } = await call('Page.navigate', { url: base + path });
    await until(async () => {
      const { frameTree } = await call('Page.getFrameTree');
      return frameTree.frame.id === frameId && frameTree.frame.loaderId === loaderId &&
        await run(path => location.pathname === path && document.readyState === 'complete', path);
    }, path);
  }
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Network.enable');
  await call('Network.setCacheDisabled', { cacheDisabled: true });

  // Preserve the Phase 1 form privacy fallback.
  for (const mode of ['normal', 'blocked', 'disabled']) {
    await call('Network.setBlockedURLs', { urls: mode === 'blocked' ? ['*/assets/parents.js'] : [] });
    await call('Emulation.setScriptExecutionDisabled', { value: mode === 'disabled' });
    await go('/parents/');
    const requestCount = requests.length;
    assert.deepEqual(await run(() => {
      const form = document.querySelector('#inquiry-form');
      form.elements.parentName.value = 'Private example';
      form.elements.notes.value = 'Private notes';
      form.querySelector('button').click();
      return { closed: [...form.elements].every(control => control.disabled), submitted: [...new FormData(form)], search: location.search };
    }), { closed: true, submitted: [], search: '' });
    await wait(100);
    assert.equal(requests.length, requestCount);
  }
  await call('Network.setBlockedURLs', { urls: [] });
  await call('Emulation.setScriptExecutionDisabled', { value: false });

  // Use a controllable local date for refresh and day rollover checks.
  const clock = await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const RealDate = Date;
      window.testDate = [2026, 10, 22, 12];
      let offset;
      window.Date = class extends RealDate {
        constructor(...args) {
          if (args.length) super(...args);
          else super(offset === undefined ? new RealDate(...window.testDate).valueOf() : RealDate.now() + offset);
        }
      };
      window.beginMidnight = () => {
        offset = new RealDate(2026, 10, 22, 23, 59, 59, 700).valueOf() - RealDate.now();
        window.dispatchEvent(new Event('focus'));
      };
    })();`
  });
  await go('/words/');
  const ranges = [[3, 4], [4, 5], [5, 6], [6, 8]];
  assert.deepEqual(await run(() => wordBank.map(entries => entries.length)), [30, 30, 30, 30]);
  assert.ok(await run(ranges => {
    const words = wordBank.flat().map(([word]) => word);
    return new Set(words).size === words.length && wordBank.every((entries, level) =>
      entries.every(([word, clue]) => /^[A-Z]+$/.test(word) &&
        word.length >= ranges[level][0] && word.length <= ranges[level][1] && clue.trim().length > 0));
  }, ranges));

  const wordState = () => JSON.parse(localStorage.getItem('moonberry.word-trails.v1'));
  const startWord = () => document.querySelector('#new-word').click();
  await run(startWord);
  await run(() => document.querySelector('.letter-tile').click());
  const partial = await run(wordState);
  const originalTiles = await run(() => document.querySelector('#letter-bank').textContent);
  await run(() => document.querySelector('[data-level="1"]').click());
  await run(startWord);
  await run(() => document.querySelector('[data-level="0"]').click());
  await go('/words/');
  const refreshed = await run(wordState);
  assert.equal(refreshed.active[0], partial.active[0]);
  assert.deepEqual(refreshed.puzzles[partial.active[0]], partial.puzzles[partial.active[0]]);
  assert.equal(await run(() => document.querySelector('#letter-bank').textContent), originalTiles);

  function solveWord() {
    const { level, active } = JSON.parse(localStorage.getItem('moonberry.word-trails.v1'));
    document.querySelector('#restart').click();
    for (const letter of active[level]) {
      [...document.querySelectorAll('.letter-tile:not(:disabled)')].find(tile => tile.textContent === letter).click();
    }
    return active[level];
  }
  const firstWord = await run(solveWord);
  assert.equal(await run(() => document.querySelector('#next').disabled), false);
  await run(() => document.querySelector('#undo').click());
  assert.equal(await run(() => document.querySelector('#next').disabled), true);
  await run(last => {
    [...document.querySelectorAll('.letter-tile:not(:disabled)')].find(tile => tile.textContent === last).click();
  }, firstWord.at(-1));
  assert.equal(await run(() => document.querySelector('#next').disabled), false);

  for (let level = 0; level < 4; level++) {
    await run(level => {
      document.querySelector(`[data-level="${level}"]`).click();
      document.querySelector('#new-word').click();
    }, level);
    for (let word = 0; word < 5; word++) {
      const spelling = await run(solveWord);
      assert.ok(spelling.length >= ranges[level][0] && spelling.length <= ranges[level][1]);
      await run(() => document.querySelector('#next').click());
    }
    assert.match(await run(() => document.querySelector('#stats').textContent), /^0 new challenges/);
    assert.match(await run(() => document.querySelector('#game-status').textContent), /today’s limit/);
  }
  const yesterday = await run(wordState);
  assert.equal(Object.keys(yesterday.puzzles).length, 20);
  await run(() => {
    document.querySelector('[data-level="0"]').click();
    const history = document.querySelector('#puzzle-history');
    history.selectedIndex = 1;
    history.dispatchEvent(new Event('change'));
  });
  assert.equal(await run(() => document.querySelector('#next').disabled), true);
  assert.equal(await run(solveWord), firstWord);
  assert.equal(Object.keys((await run(wordState)).puzzles).length, 20);

  await run(() => window.beginMidnight());
  await until(async () => (await run(() => document.querySelector('#stats').textContent)).startsWith('5 new'), 'local midnight rollover');
  await run(() => document.querySelector('#next').click());
  const today = await run(wordState);
  assert.equal(Object.keys(today.puzzles).length, 21);
  assert.ok(!Object.hasOwn(yesterday.puzzles, today.active[0]));
  assert.notEqual(today.puzzles[today.active[0]].day, yesterday.puzzles[firstWord].day);
  await run(() => {
    const key = 'moonberry.word-trails.v1';
    const state = JSON.parse(localStorage.getItem(key));
    for (const [word] of wordBank[0]) {
      state.puzzles[word] ||= {level: 0, day: '2026-11-1', tiles: [...word], typed: [], completed: true};
    }
    localStorage.setItem(key, JSON.stringify(state));
  });
  await go('/words/');
  await run(solveWord);
  assert.match(await run(() => document.querySelector('#game-status').textContent), /explored every word/);

  await call('Page.removeScriptToEvaluateOnNewDocument', clock);
  const blockedStorage = await call('Page.addScriptToEvaluateOnNewDocument', {
    source: "Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });"
  });
  await go('/words/');
  await run(startWord);
  assert.match(await run(() => document.querySelector('#stats').textContent), /4 new challenges left today · This visit only/);
  assert.ok(await run(() => document.querySelectorAll('.letter-tile').length >= 3));
  await call('Page.removeScriptToEvaluateOnNewDocument', blockedStorage);

  function solveMaths(type, prompt) {
    const [a, b, c, d, e] = prompt.match(/\d+/g).map(Number);
    switch (type) {
      case 'Addition': return a + b;
      case 'Subtraction': return a - b;
      case 'Missing number': return b - a;
      case 'Multiplication':
      case 'Equal groups': return a * b;
      case 'Groups plus extras': return a * b + c;
      case 'Division': return a / b;
      case 'Two-step arithmetic': return a + b - c;
      case 'Missing factor': return (c - b) / a;
      case 'Square numbers': return a * a - b;
      case 'Number patterns': return d + (d - c) + ((d - c) - (c - b));
      case 'Order of operations': return a + b * (c + d);
      case 'Reverse the mission': return (d / c - b) / a;
      case 'Compare two plans': return Math.abs(a * b + c - d * e);
      default: throw new Error('Unknown puzzle type: ' + type);
    }
  }

  const typesByLevel = [
    ['Addition', 'Subtraction', 'Missing number', 'Addition', 'Missing number'],
    ['Addition', 'Subtraction', 'Multiplication', 'Equal groups', 'Groups plus extras'],
    ['Division', 'Two-step arithmetic', 'Two-step arithmetic', 'Missing factor', 'Missing factor'],
    ['Square numbers', 'Number patterns', 'Order of operations', 'Reverse the mission', 'Compare two plans']
  ];
  const source = await readFile('assets/maths-questions.js', 'utf8');
  const generator = runInNewContext(source + '\nmathsQuestions');
  for (let level = 0; level < typesByLevel.length; level++) {
    for (let slot = 0; slot < 5; slot++) {
      const prompts = new Set();
      for (let sample = 0; sample < 60; sample++) {
        const question = generator.create(level, slot);
        prompts.add(question.prompt);
        assert.equal(question.type, typesByLevel[level][slot]);
        assert.equal(question.answer, solveMaths(question.type, question.prompt));
        assert.equal(new Set(question.choices).size, 4);
        assert.ok(question.choices.includes(question.answer));
        assert.ok(question.choices.every(value => Number.isInteger(value) && value >= 0));
        assert.ok(question.hint.length > 0 && !question.hint.includes(String(question.answer)));
        assert.ok(question.explanation.includes(String(question.answer)));
      }
      assert.ok(prompts.size > 5, 'Each mission slot should generate varied puzzles');
    }
  }

  await go('/maths/');
  assert.equal(await run(() => getComputedStyle(document.querySelector('.maths-layout')).gridTemplateColumns.split(' ').length), 2);
  const initialQuestion = await run(() => document.querySelector('#sum').textContent);
  await run(() => document.querySelector('#hint').click());
  assert.ok(await run(() => document.activeElement.id === 'puzzle-hint' && !document.activeElement.hidden && document.activeElement.textContent.length > 0));
  await until(async () => await run(() => document.querySelector('#mission-timer').textContent !== '0:00'), 'running timer');
  await run(() => document.querySelector('#different-puzzle').click());
  assert.notEqual(await run(() => document.querySelector('#sum').textContent), initialQuestion);
  assert.match(await run(() => document.querySelector('#stats').textContent), /^Puzzle 1 of 5$/);
  assert.ok(await run(() => document.querySelector('#fuel').value === 0 && document.querySelector('#mission-timer').textContent !== '0:00'));

  // Changing level or restarting after an answer must never advance the new mission.
  for (const selector of ['#restart', '[data-level="1"]']) {
    await run(selector => {
      document.querySelector('#answers button').click();
      document.querySelector(selector).click();
    }, selector);
    await wait(1150);
    assert.match(await run(() => document.querySelector('#stats').textContent), /^Puzzle 1 of 5$/);
    assert.equal(await run(() => document.querySelector('#fuel').value), 0);
  }

  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 650, deviceScaleFactor: 1, mobile: true });
  await run(() => document.querySelector('[data-level="0"]').click());
  for (let level = 0; level < 4; level++) {
    const questions = new Set();
    assert.equal(await run(() => Number(document.querySelector('[data-level][aria-pressed="true"]').dataset.level)), level);
    for (let slot = 0; slot < 5; slot++) {
      const { problem, type } = await run(() => ({
        problem: document.querySelector('#sum').textContent,
        type: document.querySelector('#puzzle-type').textContent
      }));
      assert.equal(type, typesByLevel[level][slot]);
      assert.ok(!questions.has(problem));
      questions.add(problem);
      assert.ok(await run(() => document.documentElement.scrollWidth <= innerWidth));
      await run((answer, wrong) => {
        const button = [...document.querySelectorAll('#answers button')].find(button =>
          wrong ? +button.textContent !== answer : +button.textContent === answer);
        if (!button) throw Error('Expected answer option');
        button.click();
      }, solveMaths(type, problem), slot === 0);
      assert.equal(await run(() => document.querySelector('#fuel').value), slot + 1);
      if (slot < 4) {
        assert.equal(await run(() => document.activeElement.id), 'continue-puzzle');
        if (slot === 0) {
          await call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
          await call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
        } else {
          await run(() => document.querySelector('#continue-puzzle').click());
        }
      }
    }
    assert.deepEqual(await run(() => ({
      score: document.querySelector('#completion-score').textContent,
      time: document.querySelector('#completion-time').textContent === 'Completion time: ' + document.querySelector('#mission-timer').textContent,
      champion: document.querySelector('#celebration-title').textContent.includes('Maths Champion'),
      nextHidden: document.querySelector('#next-level').hidden,
      modal: document.querySelector('#celebration').matches(':modal'),
      focused: document.activeElement.id,
      fits: document.querySelector('#celebration').scrollWidth <= innerWidth
    })), { score: 'Score: 4 out of 5', time: true, champion: level === 3, nextHidden: level === 3, modal: true, focused: 'celebration-title', fits: true });
    if (level === 0) {
      const finalTime = await run(() => document.querySelector('#mission-timer').textContent);
      await wait(1100);
      assert.equal(await run(() => document.querySelector('#mission-timer').textContent), finalTime);
      await run(() => document.querySelector('#celebration').dispatchEvent(new Event('cancel', { cancelable: true })));
      assert.equal(await run(() => document.activeElement.id), 'continue-puzzle');
      await run(() => document.querySelector('#continue-puzzle').click());
    }
    await run(level => document.querySelector(level === 3 ? '#try-again' : '#next-level').click(), level);
    assert.match(await run(() => document.querySelector('#stats').textContent), /^Puzzle 1 of 5$/);
    assert.equal(await run(() => document.querySelector('#mission-timer').textContent), '0:00');
  }

  await go('/memory/');
  const order = () => [...document.querySelectorAll('.memory-card')].map(card => card.dataset.symbol).join('|');
  const firstOrder = await run(order);
  const subsequentOrders = [];
  for (let retry = 0; retry < 3; retry++) {
    await run(() => document.querySelector('#restart').click());
    subsequentOrders.push(await run(order));
  }
  assert.ok(subsequentOrders.some(shuffle => shuffle !== firstOrder));
  for (const pairs of [4, 6, 8, 12]) {
    assert.equal(await run(pairs => {
      const cards = [...document.querySelectorAll('.memory-card')];
      if (cards.length !== pairs * 2) throw Error('Incorrect board size');
      for (const symbol of new Set(cards.map(card => card.dataset.symbol))) {
        const match = cards.filter(card => card.dataset.symbol === symbol);
        if (match.length !== 2) throw Error('Incorrect number of matching cards');
        match.forEach(card => card.click());
      }
      return !document.querySelector('#next-level').hidden && cards.every(card => card.disabled);
    }, pairs), pairs < 12);
    assert.match(await run(() => document.querySelector('#game-status').textContent), new RegExp(`matched all ${pairs} pairs`));
    assert.ok(await run(() => document.documentElement.scrollWidth <= innerWidth));
    await run(pairs => document.querySelector(pairs === 12 ? '#restart' : '#next-level').click(), pairs);
  }
  assert.match(await run(() => document.querySelector('#stats').textContent), /^0\/12 pairs/);

  await go('/robot/');
  let previousDistance = 0;
  for (let level = 0; level < 4; level++) {
    const path = await run(() => {
      const maze = document.querySelector('#maze');
      const cells = [...maze.children];
      const size = +maze.dataset.size;
      const origin = cells.findIndex(cell => cell.classList.contains('robot'));
      const goal = cells.findIndex(cell => cell.classList.contains('goal'));
      const seen = new Set([origin]);
      const queue = [[origin, []]];
      for (const [position, path] of queue) {
        if (position === goal) return path;
        const neighbors = [
          [position - size, 'ArrowUp'], [position + size, 'ArrowDown'],
          [position - 1, 'ArrowLeft'], [position + 1, 'ArrowRight']
        ];
        for (const [neighbor, key] of neighbors) {
          if (!cells[neighbor] || seen.has(neighbor) || cells[neighbor].classList.contains('wall')) continue;
          seen.add(neighbor);
          queue.push([neighbor, [...path, key]]);
        }
      }
      throw Error('Maze has no solution');
    });
    assert.ok(path.length > previousDistance, 'Each maze needs a longer solution');
    previousDistance = path.length;
    await run((path, keyboard) => {
      for (const key of path) {
        if (keyboard) document.querySelector('#maze').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        else document.querySelector(`[data-direction="${key}"]`).click();
      }
    }, path, level % 2 === 0);
    assert.match(await run(() => document.querySelector('#game-status').textContent), /Rescue complete/);
    assert.ok(await run(() => document.documentElement.scrollWidth <= innerWidth));
    await run(level => document.querySelector(level === 3 ? '#restart' : '#next-level').click(), level);
  }
  assert.match(await run(() => document.querySelector('#stats').textContent), /^Moves: 0 · Maze 4 of 4/);
  assert.deepEqual(exceptions, []);
  console.log('Passed Phase 1 privacy and timer regressions, Word Trails daily history and refresh, Maths puzzle correctness, controls and celebrations, Memory progression, and all four Robot mazes.');
} finally {
  socket?.close();
  for (const process of [browser, server]) {
    if (process.exitCode === null && process.signalCode === null) {
      process.kill();
      await once(process, 'exit');
    }
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5 });
}
