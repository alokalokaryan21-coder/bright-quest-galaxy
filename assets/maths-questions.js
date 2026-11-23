const mathsQuestions = (() => {
  const random = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

  function addition(min, max) {
    const a = random(min, max);
    const b = random(a, max);
    return {
      type: 'Addition', prompt: `${a} + ${b} = ?`, answer: a + b,
      hint: 'Start at the larger number and count up by the smaller number.',
      explanation: `Add the two amounts together: ${a} + ${b} = ${a + b}.`
    };
  }

  function subtraction(min, max) {
    const a = random(min, max);
    const b = random(2, a - 1);
    return {
      type: 'Subtraction', prompt: `${a} − ${b} = ?`, answer: a - b,
      hint: 'Start at the first number. Count backwards by the second number.',
      explanation: `Taking ${b} away from ${a} leaves ${a - b}.`
    };
  }

  function missingAddend(step) {
    const a = random(4 + step * 2, 8 + step * 3);
    const b = random(3 + step * 2, 7 + step * 3);
    const total = a + b;
    return {
      type: 'Missing number', prompt: `${a} + ? = ${total}`, answer: b,
      hint: 'Find how far it is from the part you know to the total.',
      explanation: `Subtract the known part from the total: ${total} − ${a} = ${b}.`
    };
  }

  function multiplication() {
    const a = random(3, 7);
    const b = random(a, 9);
    return {
      type: 'Multiplication', prompt: `${a} × ${b} = ?`, answer: a * b,
      hint: 'Think of equal rows. Add the same number once for each row.',
      explanation: `${a} rows of ${b} make ${a * b} altogether.`
    };
  }

  function groups() {
    const boxes = random(6, 12);
    const crystals = random(6, 11);
    return {
      type: 'Equal groups', prompt: `${boxes} crates each hold ${crystals} crystals. How many crystals in all?`,
      answer: boxes * crystals,
      hint: 'Multiply the number of crates by the number of crystals in each crate.',
      explanation: `${boxes} groups of ${crystals} make ${boxes} × ${crystals} = ${boxes * crystals}.`
    };
  }

  function cargoTotal() {
    const crates = random(7, 12);
    const crystals = random(8, 14);
    const loose = random(12, 29);
    const packed = crates * crystals;
    return {
      type: 'Groups plus extras', prompt: `${crates} crates each hold ${crystals} crystals. There are ${loose} loose crystals. How many crystals altogether?`,
      answer: packed + loose,
      hint: 'Find the crystals packed in crates first, then add the loose ones.',
      explanation: `${crates} × ${crystals} = ${packed}. Add the ${loose} loose crystals to get ${packed + loose}.`
    };
  }

  function division() {
    const groups = random(4, 12);
    const size = random(5, 13);
    return {
      type: 'Division', prompt: `${groups * size} ÷ ${groups} = ?`, answer: size,
      hint: 'Think backwards: what would you multiply the divisor by to make the total?',
      explanation: `${groups} groups of ${size} make ${groups * size}, so each group has ${size}.`
    };
  }

  function twoStep(step) {
    const a = random(11 + step * 4, 22 + step * 4);
    const b = random(14 + step * 3, 25 + step * 4);
    const c = random(9 + step * 3, 18 + step * 4);
    return {
      type: 'Two-step arithmetic', prompt: `(${a} + ${b}) − ${c} = ?`, answer: a + b - c,
      hint: 'Work out the sum inside the parentheses first.',
      explanation: `First add to get ${a + b}. Then subtract ${c} to get ${a + b - c}.`
    };
  }

  function missingFactor(step) {
    const factor = random(6 + step, 10 + step);
    const answer = random(9 + step, 15 + step);
    const extra = random(10 + step * 2, 26 + step * 3);
    const product = answer * factor;
    return {
      type: 'Missing factor', prompt: `? × ${factor} + ${extra} = ${product + extra}`, answer,
      hint: 'Undo the addition first. Then undo the multiplication using division.',
      explanation: `Remove ${extra} to get ${product}. Then ${product} ÷ ${factor} = ${answer}.`
    };
  }

  function squares() {
    const base = random(8, 16);
    const offset = random(5, 18);
    return {
      type: 'Square numbers', prompt: `${base}² − ${offset} = ?`, answer: base ** 2 - offset,
      hint: 'A square number comes from multiplying a number by itself. Do that before subtracting.',
      explanation: `${base} × ${base} = ${base ** 2}. Subtract ${offset} to get ${base ** 2 - offset}.`
    };
  }

  function pattern() {
    const start = random(8, 30);
    const gap = random(3, 9);
    const increase = random(2, 6);
    const second = start + gap;
    const third = second + gap + increase;
    const fourth = third + gap + increase * 2;
    const next = fourth + gap + increase * 3;
    return {
      type: 'Number patterns', prompt: `${start}, ${second}, ${third}, ${fourth}, ?`, answer: next,
      hint: 'Compare the gaps between each pair of neighbours. How are the gaps changing?',
      explanation: `The gaps grow by ${increase} each time. The next gap is ${gap + increase * 3}, so the next number is ${next}.`
    };
  }

  function mixed() {
    const a = random(6, 15);
    const b = random(4, 12);
    const c = random(3, 9);
    const extra = random(13, 35);
    const answer = extra + a * (b + c);
    return {
      type: 'Order of operations', prompt: `${extra} + ${a} × (${b} + ${c}) = ?`, answer,
      hint: 'Do the parentheses first, then the multiplication, and then the addition.',
      explanation: `The parentheses give ${b + c}. Multiply by ${a} to get ${a * (b + c)}, then add ${extra} to get ${answer}.`
    };
  }

  function reversedFlight() {
    const factor = random(4, 9);
    const answer = random(6, 14);
    const delivery = random(3, 12);
    const divisor = random(3, 6);
    const remaining = (answer * factor + delivery) * divisor;
    return {
      type: 'Reverse the mission', prompt: `A robot fills ${factor} crates equally, adds ${delivery} loose crystals, then multiplies the whole haul by ${divisor}. It ends with ${remaining} crystals. How many were in each crate to start?`,
      answer,
      hint: 'Work backwards. Undo the last multiplication, then remove the extra crystals before sharing equally.',
      explanation: `Divide ${remaining} by ${divisor}, subtract ${delivery}, then divide by ${factor}: ${remaining / divisor} − ${delivery} = ${answer * factor}, and ${answer * factor} ÷ ${factor} = ${answer}.`
    };
  }

  function compareCargo() {
    const crates = random(7, 13);
    const perCrate = random(10, 19);
    const bonus = random(18, 27);
    const otherCrates = crates - 2;
    const otherSize = perCrate + 2;
    const totalA = crates * perCrate + bonus;
    const totalB = otherCrates * otherSize;
    const answer = Math.abs(totalA - totalB);
    return {
      type: 'Compare two plans',
      prompt: `Ship A has ${crates} crates of ${perCrate} crystals plus ${bonus} loose crystals. Ship B has ${otherCrates} crates of ${otherSize}. How many more crystals does the fuller ship have?`,
      answer,
      hint: 'Find the total on each ship separately. Then subtract the smaller total from the larger one.',
      explanation: `Ship A has ${totalA}; Ship B has ${totalB}. The difference is ${Math.max(totalA, totalB)} − ${Math.min(totalA, totalB)} = ${answer}.`
    };
  }

  // Each slot adds a skill or working step as the mission progresses.
  const missions = [
    [() => addition(1, 9), () => subtraction(8, 17), () => missingAddend(0), () => addition(10, 22), () => missingAddend(3)],
    [() => addition(24, 88), () => subtraction(45, 98), multiplication, groups, cargoTotal],
    [division, () => twoStep(2), () => twoStep(4), () => missingFactor(0), () => missingFactor(3)],
    [squares, pattern, mixed, reversedFlight, compareCargo]
  ];

  function create(level, slot) {
    const puzzle = missions[level][slot]();
    const offsets = [1, -1, 2, -2, 3, -3, 5, -5, 10, -10, 12, -12];
    const choices = [puzzle.answer];
    while (choices.length < 4) {
      const index = random(0, offsets.length - 1);
      const option = puzzle.answer + offsets.splice(index, 1)[0];
      if (option >= 0) choices.push(option);
    }
    for (let index = choices.length - 1; index > 0; index--) {
      const other = random(0, index);
      [choices[index], choices[other]] = [choices[other], choices[index]];
    }
    return { ...puzzle, choices };
  }

  return { create };
})();
