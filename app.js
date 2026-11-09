// app.js: loads the CSV files, runs the math in ccc.js and fills in the page.
// All the finance math lives in ccc.js. This file only reads files and
// formats results for display.
'use strict';

const STATEMENTS_FILE = 'data/electromart.csv';
const ASSUMPTIONS_FILE = 'data/assumptions.csv';

// ---------- Formatting ----------
// Days: two decimals. Dollars: nearest dollar. Rounding happens only here,
// for display. The math in ccc.js is never rounded.

const MINUS = '−'; // a true minus sign, easier to read than a hyphen
const twoDecimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function format(x, formatter, { dollars = false, plus = false } = {}) {
  const text = formatter.format(Math.abs(x));
  const roundsToZero = text === formatter.format(0); // avoid showing "−0.00"
  const sign = roundsToZero ? '' : x < 0 ? MINUS : plus ? '+' : '';
  return sign + (dollars ? '$' : '') + text;
}
const fmtDays = x => format(x, twoDecimals);
const fmtDaysChange = x => format(x, twoDecimals, { plus: true });
const fmtDollars = x => format(x, wholeNumber, { dollars: true });
const fmtNumber = x => format(x, wholeNumber);

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

// ---------- Rendering ----------

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

  const check = document.getElementById('cash-check');
  check.replaceChildren(...result.levers.map(l => {
    const [first, second] = l.section === 'asset' ? [l.daysBefore, l.daysAfter] : [l.daysAfter, l.daysBefore];
    return el('li', {
      text: `${l.label}: (${fmtDays(first)} − ${fmtDays(second)}) × ${fmtNumber(l.annualFlow)} / ${fmtNumber(d)} = ${fmtDollars(l.cashFreedFromDays)}`,
    });
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

function renderInputs(result, lines) {
  const tbody = document.querySelector('#inputs-table tbody');
  tbody.replaceChildren(...Object.keys(LINE_LABELS).map(item => row(
    LINE_LABELS[item], '',
    [fmtDollars(lines[item].before), fmtDollars(lines[item].after)],
  )));
  document.getElementById('assumption-days').textContent =
    `Days in the year: ${fmtNumber(result.daysInYear)} (the class slides use 360).`;
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

    renderDays(result, lines);
    renderCash(result);
    renderInputs(result, lines);

    status.hidden = true;
    ['days-section', 'cash-section', 'inputs-section'].forEach(id => {
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
