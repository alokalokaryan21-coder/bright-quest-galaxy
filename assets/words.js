(() => {
  const levels = [
    {
      name: "Little explorer",
      size: 5,
      count: 3,
      bank: "MOON STAR ROBOT COMET EARTH SPACE ORBIT ALIEN LIGHT CLOUD RAIN STORM SNOW WIND SUN SKY TREE LEAF SEED ROOT BIRD FISH WHALE SHARK TIGER LION BEAR HORSE ZEBRA PANDA APPLE GRAPE PEACH MANGO LEMON TRAIN BOAT PLANE BIKE WHEEL BRICK HOUSE DOOR CHAIR TABLE BOOK PAPER PAINT MUSIC DRUM MAGIC HAPPY SMILE DREAM WATER RIVER BEACH SHELL STONE FLAME".split(
        " ",
      ),
    },
    {
      name: "Space traveller",
      size: 6,
      count: 4,
      bank: "PLANET ROCKET GALAXY METEOR SATURN JUPITER NEPTUNE GRAVITY SOLAR LUNAR COSMOS ECLIPSE CRATER AURORA NEBULA ORANGE BANANA CHERRY CARROT GARDEN FOREST JUNGLE DESERT ISLAND OCEAN STREAM VOLCANO CRYSTAL MINERAL FOSSIL ENERGY MAGNET CIRCUIT CODING PUZZLE NUMBER PATTERN SHADOW MIRROR COLOUR RAINBOW THUNDER SPARKLE DOLPHIN PENGUIN GIRAFFE MONKEY RABBIT TURTLE OCTOPUS DRAGON CASTLE PIRATE BRIDGE TUNNEL ENGINE CAMERA INVENT EXPLORE JOURNEY".split(
        " ",
      ),
    },
    {
      name: "Word wizard",
      size: 8,
      count: 5,
      bank: "ELIXIR TEXTURE LITERATE ASTEROID ASTRONAUT SATELLITE TELESCOPE UNIVERSE SUPERNOVA STARDUST EQUINOX SOLSTICE GALACTIC CELESTIAL ROTATION REVOLUTION EXPLORER DISCOVERY ADVENTURE INVENTION CREATIVE IMAGINE MYSTERY CURIOUS COURAGE PATIENCE STRATEGY SOLUTION SEQUENCE ALGORITHM VARIABLE FUNCTION COMPUTER KEYBOARD SOFTWARE HARDWARE NETWORK INTERNET ELECTRON ELEMENT MOLECULE CHEMICAL REACTION FRICTION MOMENTUM VELOCITY PRESSURE VIBRATION REFLECTION REFRACTION SPECTRUM RADIATION HABITAT WILDLIFE DINOSAUR SKELETON BUTTERFLY CHAMELEON CROCODILE CAMOUFLAGE".split(
        " ",
      ),
    },
  ];
  const rounds = [0, 0, 0];
  let dailyKey = "",
    puzzles = [];
  function todayKey() {
    const d = new Date();
    return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
      .map((part) => String(part).padStart(2, "0"))
      .join("-");
  }
  function randomFor(key) {
    let seed = 2166136261;
    for (const c of key) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
    return () => {
      seed += 0x6d2b79f5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(items, rng) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function windingRoute(n, rng) {
    let route = Array.from({ length: n * n }, (_, i) => {
      const row = Math.floor(i / n);
      return row * n + (row % 2 ? n - 1 - (i % n) : i % n);
    });
    // Backbite moves mix a full-board path while preserving neighbouring cells.
    for (let step = 0; step < n * n * 12; step++) {
      if (rng() < 0.5) route.reverse();
      const head = route[0],
        options = [];
      for (let i = 2; i < route.length; i++)
        if (
          Math.abs((head % n) - (route[i] % n)) +
            Math.abs(Math.floor(head / n) - Math.floor(route[i] / n)) ===
          1
        )
          options.push(i);
      if (options.length) {
        const k = options[Math.floor(rng() * options.length)];
        route = [...route.slice(0, k).reverse(), ...route.slice(k)];
      }
    }
    return route;
  }
  function bendCount(path) {
    let bends = 0;
    for (let i = 2; i < path.length; i++)
      if (path[i] - path[i - 1] !== path[i - 1] - path[i - 2]) bends++;
    return bends;
  }
  function buildDaily(key) {
    return levels.map((level, index) => {
      const rng = randomFor(`${key}:${index}`),
        words = shuffle(level.bank, rng).slice(0, level.count * 5);
      return Array.from({ length: 5 }, (_, round) => {
        const n = level.size,
          texts = words.slice(round * level.count, (round + 1) * level.count);
        let entries,
          bestScore = -1;
        for (let attempt = 0; attempt < 100; attempt++) {
          const route = windingRoute(n, rng);
          let offset = 0;
          const candidate = texts.map((text) => {
            const path = route.slice(offset, offset + text.length);
            offset += text.length + 1;
            return { text, path };
          });
          const score = candidate.reduce(
            (sum, w) => sum + Math.min(index === 0 ? 1 : 2, bendCount(w.path)),
            0,
          );
          if (score > bestScore) {
            entries = candidate;
            bestScore = score;
          }
          if (score === texts.length * (index === 0 ? 1 : 2)) break;
        }
        return {
          name: level.name,
          size: n,
          words: entries.sort((a, b) => a.text.length - b.text.length),
        };
      });
    });
  }
  let savedPuzzles = {};
  let savedDifficulty = 0;
  const storageKey = () => `moonberry.word-trails.board.v2.${dailyKey}`;
  function refreshDaily() {
    const key = todayKey();
    if (key === dailyKey) return false;
    dailyKey = key;
    puzzles = buildDaily(key);
    rounds.fill(0);
    savedPuzzles = {};
    savedDifficulty = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()));
      if (saved?.rounds?.length === levels.length) {
        saved.rounds.forEach((round, index) => {
          if (Number.isInteger(round) && round >= 0 && round < 5)
            rounds[index] = round;
        });
        savedPuzzles = saved.puzzles || {};
        if (levels[saved.difficulty]) savedDifficulty = saved.difficulty;
      }
    } catch {
      // An unavailable browser store still allows play for this visit.
    }
    return true;
  }
  refreshDaily();
  const colours = ["#1593d7", "#9e68d7", "#ef8964", "#35aa85", "#e4b535"],
    tints = ["#c9eaff", "#e7d4fb", "#ffe0d3", "#d5f3e6", "#fff0bd"];
  let touchDrag = false,
    lastPointerCell = null;
  let difficulty = 0,
    selected = 0,
    trail = [],
    completed = new Map(),
    revealed = new Map(),
    history = [],
    hintCell = null,
    dragging = false,
    letters = [];
  const byId = (id) => document.getElementById(id),
    current = () => puzzles[difficulty][rounds[difficulty]],
    adjacent = (a, b) =>
      Math.abs(
        Math.floor(a / current().size) - Math.floor(b / current().size),
      ) +
        Math.abs((a % current().size) - (b % current().size)) ===
      1;
  let timerStartedAt = null,
    timerElapsed = 0;
  function elapsedTime() {
    return (
      timerElapsed +
      (timerStartedAt === null ? 0 : performance.now() - timerStartedAt)
    );
  }
  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function drawTimer() {
    byId("word-timer").textContent = formatTime(elapsedTime());
  }
  function startTimer() {
    if (timerStartedAt === null) timerStartedAt = performance.now();
    drawTimer();
  }
  function stopTimer() {
    timerElapsed = elapsedTime();
    timerStartedAt = null;
    drawTimer();
  }
  function resetTimer() {
    timerStartedAt = null;
    timerElapsed = 0;
    drawTimer();
  }
  setInterval(drawTimer, 250);
  function busyCells() {
    return new Set([...completed.values()].flat());
  }
  function savePuzzle() {
    savedPuzzles[`${difficulty}:${rounds[difficulty]}`] = {
      selected,
      trail,
      completed: [...completed],
      revealed: [...revealed],
      history,
      elapsed: elapsedTime(),
      running: timerStartedAt !== null,
    };
    try {
      localStorage.setItem(
        storageKey(),
        JSON.stringify({ difficulty, rounds, puzzles: savedPuzzles }),
      );
    } catch {
      // Keep this visit playable when browser storage is blocked.
    }
  }
  function draw() {
    const p = current(),
      word = p.words[selected].text,
      used = busyCells();
    const finished = completed.size === p.words.length;
    byId("word-celebration").hidden = !finished;
    byId("timer-badge").className = finished
      ? "timer-badge timer-complete"
      : "timer-badge";
    byId("word-finish-time").textContent = finished
      ? formatTime(timerElapsed)
      : "";
    document.querySelectorAll("#letters button").forEach((button, i) => {
      button.className = letters[i] ? "" : "blocked";
      if (used.has(i)) {
        button.classList.add("done");
        const j = [...completed].find(([, path]) => path.includes(i))[0];
        button.style.setProperty("--trail-tint", tints[j]);
      } else button.style.removeProperty("--trail-tint");
      if (trail.includes(i)) button.classList.add("current");
      if (hintCell === i) button.classList.add("hinted");
      button.setAttribute(
        "aria-label",
        letters[i]
          ? `${letters[i]}, row ${Math.floor(i / p.size) + 1}, column ${(i % p.size) + 1}${used.has(i) ? ", completed word" : ""}`
          : "Blocked square",
      );
    });
    document.querySelectorAll("#word-list button").forEach((b, i) => {
      const answer = p.words[i].text,
        revealCount = completed.has(i) ? answer.length : revealed.get(i) || 0;
      b.replaceChildren();
      b.style.setProperty("--letter-count", answer.length);
      b.style.setProperty(
        "--letter-colour",
        ["#096799", "#7044a3", "#a04426", "#14634d", "#765900"][i],
      );
      b.className = completed.has(i) ? "complete" : "";
      b.setAttribute("aria-pressed", String(i === selected));
      b.setAttribute(
        "aria-label",
        completed.has(i)
          ? `${answer}, completed`
          : `Word ${i + 1}, ${answer.length} letters. ${revealCount ? answer.slice(0, revealCount).split("").join(" ") + ", " + (answer.length - revealCount) + " hidden letters." : "All letters hidden."} ${i === selected && trail.length ? "Trying " + trail.map((n) => letters[n]).join(" ") + ". " : ""}Select for a hint.`,
      );
      const boxes = document.createElement("span");
      boxes.className = "word-boxes";
      boxes.setAttribute("aria-hidden", "true");
      for (const [letterIndex, letter] of [...answer].entries()) {
        const box = document.createElement("span");
        box.className = "word-box";
        const trying =
          i === selected && !completed.has(i) && letterIndex < trail.length;
        box.textContent = trying
          ? letters[trail[letterIndex]]
          : letterIndex < revealCount
            ? letter
            : "";
        if (trying) box.classList.add("trying");
        boxes.append(box);
      }
      b.append(boxes);
      const tick = document.createElement("span");
      tick.className = "word-tick";
      tick.setAttribute("aria-hidden", "true");
      tick.textContent = completed.has(i) ? "✓" : "";
      b.append(tick);
    });
    byId("spelling").textContent =
      completed.size === p.words.length
        ? "All words found!"
        : trail.length
          ? trail.map((n) => letters[n]).join(" ")
          : "Start on any letter";
    byId("word-progress").textContent =
      `${completed.size} / ${p.words.length} words`;
    byId("daily-practice").textContent =
      `${levels[difficulty].count * 5} words today · Puzzle ${rounds[difficulty] + 1} of 5 · ${dailyKey}`;
    byId("word-new").textContent =
      rounds[difficulty] === 4 ? "↻ Review today’s puzzles" : "New puzzle →";
    byId("word-next").hidden =
      completed.size !== p.words.length || difficulty === puzzles.length - 1;
    savePuzzle();
    byId("word-undo").disabled = trail.length === 0 && history.length === 0;
    byId("word-clear").disabled = trail.length === 0;
    byId("word-hint").disabled =
      completed.size === p.words.length || completed.has(selected);
    const svg = byId("trail-lines");
    svg.setAttribute("viewBox", `0 0 ${p.size * 100} ${p.size * 100}`);
    svg.replaceChildren();
    for (const [j, path] of [...completed.entries(), [selected, trail]]) {
      if (!path.length) continue;
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline",
      );
      const points = path.length === 1 ? [path[0], path[0]] : path;
      line.setAttribute(
        "points",
        points
          .map(
            (i) =>
              `${(i % p.size) * 100 + 50},${Math.floor(i / p.size) * 100 + 50}`,
          )
          .join(" "),
      );
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", colours[j]);
      line.setAttribute("stroke-width", "58");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      svg.append(line);
      for (let step = 1; step < path.length; step++) {
        const from = path[step - 1],
          to = path[step],
          x1 = (from % p.size) * 100 + 50,
          y1 = Math.floor(from / p.size) * 100 + 50,
          x2 = (to % p.size) * 100 + 50,
          y2 = Math.floor(to / p.size) * 100 + 50;
        const arrow = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "polyline",
        );
        arrow.setAttribute("points", "-5,-8 3,0 -5,8");
        arrow.setAttribute(
          "transform",
          `translate(${(x1 + x2) / 2} ${(y1 + y2) / 2}) rotate(${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI})`,
        );
        arrow.setAttribute("fill", "none");
        arrow.setAttribute("stroke", "#102943");
        arrow.setAttribute("stroke-width", "3.5");
        arrow.setAttribute("stroke-linecap", "round");
        arrow.setAttribute("stroke-linejoin", "round");
        svg.append(arrow);
      }
    }
  }
  function chooseWord(i) {
    if (completed.has(i)) return;
    selected = i;
    trail = [];
    hintCell = null;
    byId("word-message").textContent =
      "Start on any letter and try a combination. Select a word if you would like a hint.";
    draw();
  }
  // Find a complete, non-overlapping solution, optionally fixing a candidate path.
  // A correctly spelled word is accepted only if the whole board remains solvable.
  function remainingSolution(
    fixed = new Map(),
    preferredIndex = -1,
    prefix = [],
  ) {
    const p = current(),
      locked = new Map([...completed, ...fixed]);
    const bit = (cell) => 1n << BigInt(cell);
    let occupied = 0n;
    for (const [index, path] of locked) {
      const word = p.words[index];
      if (path.length !== word.text.length) return null;
      let own = 0n;
      for (let i = 0; i < path.length; i++) {
        const cell = path[i],
          mask = bit(cell);
        if (
          letters[cell] !== word.text[i] ||
          (i && !adjacent(path[i - 1], cell)) ||
          (occupied | own) & mask
        )
          return null;
        own |= mask;
      }
      occupied |= own;
    }
    const neighbours = letters.map((letter, cell) =>
      letter
        ? letters.flatMap((l, i) => (l && adjacent(cell, i) ? [i] : []))
        : [],
    );
    const options = new Map();
    for (let index = 0; index < p.words.length; index++) {
      if (locked.has(index)) continue;
      const word = p.words[index].text,
        paths = [];
      function walk(path, mask) {
        if (path.length === word.length) {
          paths.push({ path: [...path], mask });
          return;
        }
        const forced =
          index === preferredIndex ? prefix[path.length] : undefined;
        const next =
          forced !== undefined
            ? [forced]
            : path.length
              ? neighbours[path.at(-1)]
              : letters.map((_, i) => i);
        for (const cell of next) {
          const flag = bit(cell);
          if (
            letters[cell] !== word[path.length] ||
            (occupied | mask) & flag ||
            (path.length && !adjacent(path.at(-1), cell))
          )
            continue;
          path.push(cell);
          walk(path, mask | flag);
          path.pop();
        }
      }
      walk([], 0n);
      if (!paths.length) return null;
      options.set(index, paths);
    }
    const failed = new Set();
    function solve(left, used, plan) {
      if (!left.length) return plan;
      const key = left.join(",") + ":" + used;
      if (failed.has(key)) return null;
      let best = -1,
        choices = null;
      for (const index of left) {
        const available = options.get(index).filter((o) => !(o.mask & used));
        if (!available.length) {
          failed.add(key);
          return null;
        }
        if (!choices || available.length < choices.length) {
          best = index;
          choices = available;
        }
      }
      for (const choice of choices) {
        const result = solve(
          left.filter((i) => i !== best),
          used | choice.mask,
          new Map([...plan, [best, choice.path]]),
        );
        if (result) return result;
      }
      failed.add(key);
      return null;
    }
    return solve([...options.keys()], occupied, locked);
  }
  function visit(i, mode = "tap") {
    const p = current();
    if (!letters[i] || completed.size === p.words.length) return;
    const back = trail.indexOf(i);
    if (back >= 0) {
      if (back === trail.length - 1) {
        if (mode === "drag") return;
        undo();
        return;
      }
      trail = trail.slice(0, back + 1);
      hintCell = null;
      draw();
      return;
    }
    if (busyCells().has(i)) {
      byId("word-message").textContent =
        "That letter belongs to a completed word. Try another square.";
      return;
    }
    if (trail.includes(i) || (trail.length && !adjacent(trail.at(-1), i))) {
      byId("word-message").textContent =
        "Move to a neighbouring square: up, down, left or right.";
      return;
    }
    startTimer();
    if (!trail.length) {
      const owner = p.words.findIndex(
        (w, j) => !completed.has(j) && w.path.includes(i),
      );
      if (owner >= 0) selected = owner;
    }
    trail.push(i);
    hintCell = null;
    const spelling = trail.map((n) => letters[n]).join("");
    const foundIndex = p.words.findIndex(
      (word, index) => !completed.has(index) && word.text === spelling,
    );
    const found =
      foundIndex < 0 ? null : { word: p.words[foundIndex], index: foundIndex };
    if (found) selected = found.index;
    byId("word-message").textContent =
      "Try your combination. Keep tracing, use Undo, or clear the path to start again.";
    if (found && !remainingSolution(new Map([[found.index, [...trail]]]))) {
      dragging = false;
      byId("word-message").textContent =
        `${found.word.text} is a word, but this route blocks another word. Try a different route. Use Undo or tap an earlier letter.`;
      draw();
      return;
    }
    if (found) {
      dragging = false;
      completed.set(found.index, [...trail]);
      history.push(found.index);
      trail = [];
      if (completed.size === p.words.length) {
        stopTimer();
        byId("word-message").textContent =
          `Wonderful! You found every word in ${formatTime(timerElapsed)}. ⭐`;
      } else {
        selected = p.words.findIndex((w, j) => !completed.has(j));
        byId("word-message").textContent =
          `${found.word.text} found! Discover any remaining word.`;
      }
    }
    draw();
  }
  function hint() {
    const index = selected,
      word = current().words[index];
    if (completed.has(index)) return;
    // Continue a viable player path; otherwise guide along a solvable alternative.
    let plan = remainingSolution(new Map(), index, trail),
      previous = trail.length;
    if (!plan) {
      plan = remainingSolution();
      previous = 0;
    }
    if (!plan) {
      byId("word-message").textContent =
        "Use Undo to reopen the last word and try another route.";
      return;
    }
    const path = plan.get(index),
      count = Math.min(previous + 1, word.text.length);
    startTimer();
    revealed.set(index, Math.max(revealed.get(index) || 0, count));
    trail = path.slice(0, count - 1);
    visit(path[count - 1]);
    if (!completed.has(index)) {
      hintCell = path[count - 1];
      byId("word-message").textContent =
        `${count} of ${word.text.length} letters selected. Tap Hint to add the next letter, or keep tracing yourself.`;
      draw();
    }
  }

  function undo() {
    if (completed.size === current().words.length && history.length)
      startTimer();
    if (trail.length) trail.pop();
    else if (history.length) {
      selected = history.pop();
      trail = completed.get(selected).slice(0, -1);
      completed.delete(selected);
    }
    hintCell = null;
    byId("word-message").textContent = "One step back. Try another way!";
    draw();
  }
  function loadPuzzle(i, restore = true) {
    resetTimer();
    refreshDaily();
    difficulty = i;
    selected = 0;
    trail = [];
    completed.clear();
    revealed.clear();
    history = [];
    hintCell = null;
    dragging = false;
    const p = current();
    letters = Array(p.size * p.size).fill("");
    p.words.forEach((w) =>
      w.path.forEach((cell, j) => (letters[cell] = w.text[j])),
    );
    byId("trail-board").style.setProperty("--board-cells", p.size);
    byId("puzzle-title").textContent = p.name;
    byId("letters").style.gridTemplateColumns = `repeat(${p.size},1fr)`;
    byId("letters").replaceChildren();
    letters.forEach((letter, n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.cell = n;
      b.textContent = letter;
      b.disabled = !letter;
      let touchTap = false;
      b.addEventListener("pointerdown", (e) => {
        touchTap = e.pointerType === "touch" && !touchDrag;
        if (touchTap) return;
        if (e.button !== 0) return;
        e.preventDefault();
        dragging = true;
        lastPointerCell = n;
        visit(n);
      });
      b.addEventListener("click", (e) => {
        if (e.detail === 0 || touchTap) visit(n);
        touchTap = false;
      });
      byId("letters").append(b);
    });
    byId("word-list").replaceChildren();
    p.words.forEach((w, j) => {
      const b = document.createElement("button");
      b.type = "button";
      b.style.setProperty("--trail-tint", tints[j]);
      b.onclick = () => chooseWord(j);
      byId("word-list").append(b);
    });
    document
      .querySelectorAll("[data-difficulty]")
      .forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    const saved = restore
      ? savedPuzzles[`${difficulty}:${rounds[difficulty]}`]
      : null;
    if (saved) {
      selected = saved.selected;
      trail = [...saved.trail];
      completed = new Map(saved.completed);
      revealed = new Map(saved.revealed);
      history = [...saved.history];
      timerElapsed = saved.elapsed;
      if (saved.running) timerStartedAt = performance.now();
    }
    byId("word-message").textContent =
      "Start on any letter and try a combination. Select a word if you would like a hint.";
    drawTimer();
    draw();
  }
  byId("trail-board").addEventListener("pointermove", (e) => {
    if (!dragging) return;
    e.preventDefault();
    const b = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-cell]");
    if (b && byId("letters").contains(b)) {
      const cell = Number(b.dataset.cell);
      if (cell !== lastPointerCell) {
        lastPointerCell = cell;
        visit(cell, "drag");
      }
    }
  });
  document.addEventListener("pointerup", () => (dragging = false));
  document.addEventListener("pointercancel", () => (dragging = false));
  document
    .querySelectorAll("[data-difficulty]")
    .forEach(
      (b) => (b.onclick = () => loadPuzzle(Number(b.dataset.difficulty))),
    );
  byId("word-undo").onclick = undo;
  byId("word-hint").onclick = hint;
  byId("word-clear").onclick = () => chooseWord(selected);
  byId("word-restart").onclick = () => loadPuzzle(difficulty, false);
  byId("word-next").onclick = () => loadPuzzle(difficulty + 1);
  byId("word-new").onclick = () => {
    const previousDay = dailyKey;
    refreshDaily();
    if (previousDay === dailyKey)
      rounds[difficulty] = (rounds[difficulty] + 1) % 5;
    loadPuzzle(difficulty);
  };
  loadPuzzle(savedDifficulty);
  window.addEventListener("pagehide", savePuzzle);
  window.addEventListener("focus", () => {
    if (refreshDaily()) loadPuzzle(difficulty);
  });

  byId("word-touch-mode").onclick = () => {
    touchDrag = !touchDrag;
    dragging = false;
    byId("trail-board").classList.toggle("touch-drag", touchDrag);
    byId("word-touch-mode").setAttribute("aria-pressed", String(touchDrag));
    byId("word-touch-mode").textContent =
      `Drag mode: ${touchDrag ? "on" : "off"}`;
  };
  byId("word-zoom").onclick = () => {
    const enlarged = byId("trail-scroll").classList.toggle("enlarged");
    byId("word-zoom").setAttribute("aria-pressed", String(enlarged));
    byId("word-zoom").textContent = enlarged ? "Fit screen" : "Larger letters";
  };
})();
