// app.js: loads the CSV files, runs the math in ccc.js and fills in the page.
// All the finance math lives in ccc.js. This file only reads files, handles
// the sliders and buttons, and formats results for display.
'use strict';

const STATEMENTS_FILE = 'data/electromart.csv';
const ASSUMPTIONS_FILE = 'data/assumptions.csv';

// ---------- Formatting ----------
// Days: two decimals. Dollars: nearest dollar. Rates: percent, two decimals.
// Rounding happens only here, for display. The math in ccc.js is never rounded.

const MINUS = '−'; // a true minus sign, easier to read than a hyphen
const twoDecimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const percentTwo = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const upToTwo = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function format(x, formatter, { dollars = false, plus = false } = {}) {
  const text = formatter.format(Math.abs(x));
  const roundsToZero = text === formatter.format(0); // avoid showing "−0.00" or "−$0"
  const sign = roundsToZero ? '' : x < 0 ? MINUS : plus ? '+' : '';
  return sign + (dollars ? '$' : '') + text;
}
const fmtDays = x => format(x, twoDecimals);
const fmtDaysChange = x => format(x, twoDecimals, { plus: true });
const fmtDollars = x => format(x, wholeNumber, { dollars: true });
const fmtNumber = x => format(x, wholeNumber);
const fmtRate = x => format(x, percentTwo);
// Supplier terms written the usual way, for example "2/10, net 30".
const fmtTerms = a => `${upToTwo.format(a.supplier_discount * 100)}/${upToTwo.format(a.discount_days)}, net ${upToTwo.format(a.net_days)}`;

// ---------- Small helpers for building the page ----------

// Make an element. Text is always set with textContent, never as HTML.
function el(tag, { className, text, scope } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (scope) node.scope = scope;
  if (text !== undefined) node.textContent = text;
  children.forEach(child => node.append(child));
  return node;
}

// A row whose first cell is a label with an optional smaller description.
function row(label, description, values, className) {
  const head = el('th', { scope: 'row' }, [el('span', { className: 'label', text: label })]);
  if (description) head.append(el('span', { className: 'desc', text: description }));
  return el('tr', { className }, [head, ...values.map(v => el('td', { text: v }))]);
}

// Replace a list's items with one <li> per line of text.
function fillList(id, lines) {
  document.getElementById(id).replaceChildren(...lines.map(text => el('li', { text })));
}

// ---------- Part B: Before and After ----------

const DAYS_ROWS = [
  { key: 'dio', label: 'DIO', desc: 'Days inventory outstanding' },
  { key: 'dso', label: 'DSO', desc: 'Days sales outstanding' },
  { key: 'dpo', label: 'DPO', desc: 'Days payables outstanding' },
  { key: 'ccc', label: 'CCC', desc: 'Cash conversion cycle', className: 'total' },
];

// Which balance and annual flow each days measure uses, for "Show the math".
const DAYS_FORMULA = {
  dio: { balance: 'inventory', flow: 'cogs', words: 'Inventory / COGS' },
  dso: { balance: 'accounts_receivable', flow: 'revenue', words: 'Receivables / Revenue' },
  dpo: { balance: 'accounts_payable', flow: 'cogs', words: 'Payables / COGS' },
};

const LINE_LABELS = {
  revenue: 'Revenue',
  cogs: 'Cost of goods sold (COGS)',
  inventory: 'Inventory',
  accounts_receivable: 'Accounts receivable',
  accounts_payable: 'Accounts payable',
  notes_payable: 'Notes payable (bank line)',
};

function renderDays(result, lines) {
  const tbody = document.querySelector('#days-table tbody');
  tbody.replaceChildren(...DAYS_ROWS.map(r => row(
    r.label, r.desc,
    [fmtDays(result.before[r.key]), fmtDays(result.after[r.key]),
      fmtDaysChange(result.after[r.key] - result.before[r.key])],
    r.className,
  )));

  const d = result.daysInYear;
  const math = document.getElementById('days-math');
  math.replaceChildren();
  ['before', 'after'].forEach(period => {
    const days = result[period];
    const items = ['dio', 'dso', 'dpo'].map(key => {
      const f = DAYS_FORMULA[key];
      return el('li', {
        text: `${key.toUpperCase()} = ${f.words} × ${fmtNumber(d)} = ` +
          `${fmtNumber(lines[f.balance][period])} / ${fmtNumber(lines[f.flow][period])} × ${fmtNumber(d)} = ` +
          `${fmtDays(days[key])} days`,
      });
    });
    items.push(el('li', {
      text: `CCC = DIO + DSO − DPO = ${fmtDays(days.dio)} + ${fmtDays(days.dso)} − ${fmtDays(days.dpo)} = ${fmtDays(days.ccc)} days`,
    }));
    math.append(el('h4', { text: period === 'before' ? 'Before' : 'After' }), el('ul', {}, items));
  });
}

function renderCash(result) {
  const tbody = document.querySelector('#cash-table tbody');
  const rows = result.levers.map(l => row(
    l.label,
    l.section === 'asset' ? 'Asset: Before − After' : 'Liability: After − Before',
    [fmtDollars(l.balanceBefore), fmtDollars(l.balanceAfter), fmtDollars(l.cashFreed)],
  ));
  rows.push(row('Total', '', ['', '', fmtDollars(result.totalCashFreed)], 'total'));
  tbody.replaceChildren(...rows);

  const d = result.daysInYear;
  document.getElementById('days-in-year-note').textContent = fmtNumber(d);

  fillList('cash-check', result.levers.map(l => {
    const [first, second] = l.section === 'asset' ? [l.daysBefore, l.daysAfter] : [l.daysAfter, l.daysBefore];
    return `${l.label}: (${fmtDays(first)} − ${fmtDays(second)}) × ${fmtNumber(l.annualFlow)} / ${fmtNumber(d)} = ${fmtDollars(l.cashFreedFromDays)}`;
  }));

  // The two methods agree whenever revenue and COGS are the same in both
  // periods. If they don't (possible with another company's file), say why.
  const mismatch = result.levers.some(l => Math.abs(l.cashFreed - l.cashFreedFromDays) >= 0.5);
  const warning = document.getElementById('cash-check-warning');
  warning.hidden = !mismatch;
  warning.textContent = mismatch
    ? 'The two methods differ because revenue or COGS changed between periods. The days check holds them at their Before values.'
    : '';
}

function renderInputs(result, lines, assumptions) {
  const tbody = document.querySelector('#inputs-table tbody');
  tbody.replaceChildren(...Object.keys(LINE_LABELS).map(item => row(
    LINE_LABELS[item], '',
    [fmtDollars(lines[item].before), fmtDollars(lines[item].after)],
  )));
  fillList('assumption-list', [
    `Days in the year: ${fmtNumber(result.daysInYear)} (the class slides use 360).`,
    `Bank line interest rate: ${fmtRate(assumptions.bank_rate)} a year.`,
    `Supplier terms: ${fmtTerms(assumptions)}. A ${upToTwo.format(assumptions.supplier_discount * 100)}% discount ` +
      `for paying within ${upToTwo.format(assumptions.discount_days)} days, otherwise due in ${upToTwo.format(assumptions.net_days)} days.`,
  ]);
}

// ---------- Part C: the levers ----------

let model = null;                              // { lines, assumptions, result }, set once the CSVs load
const sliderDays = { dio: 0, dso: 0, dpo: 0 }; // the days the sliders are set to, never rounded
const SLIDER_KEYS = ['dio', 'dso', 'dpo'];

const LEVER_LINES = [
  { key: 'inventory', label: 'Inventory', item: 'inventory', days: 'dio', flow: 'cogs', flowLabel: 'COGS' },
  { key: 'receivables', label: 'Receivables', item: 'accounts_receivable', days: 'dso', flow: 'revenue', flowLabel: 'Revenue' },
  { key: 'payables', label: 'Payables', item: 'accounts_payable', days: 'dpo', flow: 'cogs', flowLabel: 'COGS' },
];

// Slider range: 0 to twice the largest of Before and After, rounded up to the
// next 10 days. For DPO the net days are included, so you can always slide
// past the due date. This is a display choice, not finance math.
function sliderMax(values) {
  return Math.max(10, Math.ceil(2 * Math.max(...values) / 10) * 10);
}

// Show a days value in a number box (two decimals, for display only).
const boxText = x => x.toFixed(2);

function setupLevers() {
  const { result, assumptions } = model;
  SLIDER_KEYS.forEach(key => {
    const range = document.getElementById(`${key}-range`);
    const box = document.getElementById(`${key}-number`);
    const values = [result.before[key], result.after[key]];
    if (key === 'dpo') values.push(assumptions.net_days);
    const max = sliderMax(values);
    range.max = String(max);
    box.max = String(max);

    range.addEventListener('input', () => {
      sliderDays[key] = range.valueAsNumber;
      box.value = boxText(sliderDays[key]);
      renderLevers();
    });
    box.addEventListener('input', () => {
      const v = box.valueAsNumber;
      if (Number.isFinite(v) && v >= 0 && v <= max) {
        sliderDays[key] = v;
        range.value = String(v);
        renderLevers();
      }
    });
    // When you leave the box, put back the slider's value if what you typed
    // was blank or outside the slider's range.
    box.addEventListener('change', () => {
      if (box.valueAsNumber !== sliderDays[key]) box.value = boxText(sliderDays[key]);
    });
  });

  document.getElementById('set-before').addEventListener('click', () => setLevers(result.before));
  document.getElementById('set-after').addEventListener('click', () => setLevers(result.after));
  setLevers(result.before);
}

// Set all three sliders to exact days (for example the Before or After days).
function setLevers(days) {
  SLIDER_KEYS.forEach(key => {
    sliderDays[key] = days[key];
    document.getElementById(`${key}-range`).value = String(days[key]);
    document.getElementById(`${key}-number`).value = boxText(days[key]);
  });
  renderLevers();
}

function renderLevers() {
  const { lines, assumptions, result } = model;
  const d = assumptions.days_in_year;
  const now = CCC.leverResults(lines, assumptions, sliderDays);
  const base = CCC.leverResults(lines, assumptions, result.before);

  // Which preset, if any, the sliders match exactly.
  const matches = days => SLIDER_KEYS.every(k => sliderDays[k] === days[k]);
  const atBefore = matches(result.before);
  const atAfter = matches(result.after);
  document.getElementById('set-before').setAttribute('aria-pressed', String(atBefore));
  document.getElementById('set-after').setAttribute('aria-pressed', String(atAfter));
  document.getElementById('lever-status').textContent =
    atBefore ? 'The sliders are set to the Before days.'
      : atAfter ? 'The sliders are set to the After days.'
        : 'The sliders are set to your own days.';

  // 1. Days and the new cash conversion cycle
  const leverDays = { ...sliderDays, ccc: now.ccc };
  document.querySelector('#lever-days-table tbody').replaceChildren(...DAYS_ROWS.map(r => row(
    r.label, r.desc,
    [fmtDays(result.before[r.key]), fmtDays(leverDays[r.key]), fmtDaysChange(leverDays[r.key] - result.before[r.key])],
    r.className,
  )));

  // 2 and 3. Balances the days imply, and cash freed compared with Before
  const cashRows = LEVER_LINES.map(l => row(
    l.label,
    lines[l.item].section === 'asset' ? 'Asset: Before − Levers' : 'Liability: Levers − Before',
    [fmtDollars(lines[l.item].before), fmtDollars(now.balances[l.key]), fmtDollars(now.cashFreed[l.key])],
  ));
  cashRows.push(row('Total cash freed', '', ['', '', fmtDollars(now.cashFreed.total)], 'total'));
  document.querySelector('#lever-cash-table tbody').replaceChildren(...cashRows);
  fillList('lever-cash-math', LEVER_LINES.map(l =>
    `${l.label} = ${l.days.toUpperCase()} × ${l.flowLabel} / ${fmtNumber(d)} = ` +
    `${fmtDays(sliderDays[l.days])} × ${fmtNumber(lines[l.flow].before)} / ${fmtNumber(d)} = ${fmtDollars(now.balances[l.key])}`));

  // 4. Interest saved on the bank line
  const borrowing = now.cashFreed.total < 0;
  document.querySelector('#lever-interest-table tbody').replaceChildren(
    row('Total cash freed', '', [fmtDollars(now.cashFreed.total)]),
    row(borrowing ? 'Extra borrowed on the bank line' : 'Paid down on the bank line',
      borrowing ? 'Shown as a negative paydown' : `Up to its Before balance of ${fmtDollars(now.bankLineBefore)}`,
      [fmtDollars(now.bankLinePaydown)]),
    row('Bank rate', '', [fmtRate(assumptions.bank_rate)]),
    row('Interest saved each year', 'If every freed dollar pays down the bank line', [fmtDollars(now.interestSaved)], 'total'),
  );
  fillList('lever-interest-math', [
    `Interest saved = ${fmtDollars(now.bankLinePaydown)} × ${fmtRate(assumptions.bank_rate)} = ${fmtDollars(now.interestSaved)}`,
  ]);
  const interestWarning = document.getElementById('lever-interest-warning');
  let warningText = '';
  if (borrowing) {
    warningText = 'Cash freed is negative, so ElectroMart has to borrow more on the bank line. The extra interest shows as a negative saving.';
  } else if (now.cashFreed.total > now.bankLineBefore) {
    warningText = `Cash freed is more than the bank line's Before balance of ${fmtDollars(now.bankLineBefore)}. ` +
      'Only that much can be paid down, so only that much saves interest.';
  }
  interestWarning.textContent = warningText;
  interestWarning.hidden = warningText === '';

  // 5. Supplier terms: days past due and the cost of skipping the discount
  const net = upToTwo.format(assumptions.net_days);
  const discDays = upToTwo.format(assumptions.discount_days);
  const pct = upToTwo.format(assumptions.supplier_discount * 100);
  const costText = r => r.takesDiscount ? 'Takes the discount' : fmtRate(r.discountCost);
  document.getElementById('supplier-heading').textContent = `5. Supplier terms: ${fmtTerms(assumptions)}`;
  document.querySelector('#lever-supplier-table tbody').replaceChildren(
    row(`Days paid past the net-${net} due date`, '', [fmtDays(base.daysPastDue), fmtDays(now.daysPastDue)]),
    row(`Annual cost of skipping the ${pct}% discount`, 'Nominal annual rate', [costText(base), costText(now)]),
  );
  fillList('lever-supplier-math', [
    `Days past due = DPO − ${net}, but never less than 0 = ${fmtDays(sliderDays.dpo)} − ${net} → ${fmtDays(now.daysPastDue)} days`,
    now.takesDiscount
      ? `DPO of ${fmtDays(sliderDays.dpo)} days is within the ${discDays}-day discount period, so ElectroMart takes the discount.`
      : `Cost = d / (1 − d) × ${fmtNumber(d)} / (DPO − ${discDays}) = ${fmtRate(assumptions.supplier_discount)} / (1 − ${fmtRate(assumptions.supplier_discount)}) × ` +
        `${fmtNumber(d)} / (${fmtDays(sliderDays.dpo)} − ${discDays}) = ${fmtRate(now.discountCost)}`,
  ]);
}

// ---------- Loading ----------

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Couldn't load ${path} (the server answered ${response.status}).`);
  return response.text();
}

async function main() {
  const status = document.getElementById('status');
  try {
    const [statementsText, assumptionsText] = await Promise.all([
      fetchText(STATEMENTS_FILE),
      fetchText(ASSUMPTIONS_FILE),
    ]);
    const lines = CCC.readStatements(CCC.parseCsv(statementsText));
    const assumptions = CCC.readAssumptions(CCC.parseCsv(assumptionsText));
    const result = CCC.analyze(lines, assumptions);
    model = { lines, assumptions, result };

    renderDays(result, lines);
    renderCash(result);
    renderInputs(result, lines, assumptions);
    setupLevers();

    status.hidden = true;
    ['days-section', 'cash-section', 'levers-section', 'inputs-section'].forEach(id => {
      document.getElementById(id).hidden = false;
    });
  } catch (err) {
    let message = err.message;
    if (location.protocol === 'file:') {
      message += ' This page has to be opened from a web address (for example GitHub Pages), not as a file.';
    }
    status.textContent = `Couldn't show the numbers. ${message}`;
    status.classList.add('error');
  }
}

main();
