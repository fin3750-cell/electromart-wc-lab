// ccc.js: the finance math for the ElectroMart CCC app.
//
// Every function in this file is "pure": numbers (or CSV text) go in and
// results come out. Nothing here touches the web page, so each function can
// be checked with Node, for example:
//   node -e "const C = require('./ccc.js'); console.log(C.dio(1200000, 6000000, 365))"
//
// No figures are typed into this file. Every number comes from the CSV files
// in data/, which app.js reads and passes in.

(function (root) {
  'use strict';

  // ---------- Reading CSV text ----------

  // Turn CSV text into a list of objects, one per row, keyed by the header row.
  // Handles quoted fields ("a, b"), doubled quotes inside quotes (""),
  // Windows line endings and blank lines.
  function parseCsv(text) {
    const s = String(text).replace(/^﻿/, ''); // drop a byte-order mark if present
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { field += ch; }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else {
        field += ch;
      }
    }
    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

    const nonBlank = rows.filter(r => r.some(f => f.trim() !== ''));
    if (nonBlank.length === 0) return [];
    const header = nonBlank[0].map(h => h.trim().toLowerCase());
    return nonBlank.slice(1).map(r => {
      const obj = {};
      header.forEach((h, j) => { obj[h] = (r[j] === undefined ? '' : r[j]).trim(); });
      return obj;
    });
  }

  // Read a CSV cell as a number. A blank or non-numeric cell is an error
  // (a blank must never quietly become 0).
  function toNumber(value, what) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    const n = text === '' ? NaN : Number(text);
    if (!Number.isFinite(n)) throw new Error(`${what} is "${text}", which is not a number.`);
    return n;
  }

  // The lines the app needs, and the section each must be in.
  // The section decides the sign of cash freed (see cashFreedFromBalances).
  const REQUIRED_LINES = {
    revenue: 'income_statement',
    cogs: 'income_statement',
    inventory: 'asset',
    accounts_receivable: 'asset',
    accounts_payable: 'liability_or_equity',
    notes_payable: 'liability_or_equity', // the bank line of credit
  };

  // Turn the rows of a statements CSV (section,item,before,after) into
  //   { revenue: { section: 'income_statement', before: ..., after: ... }, ... }
  function readStatements(rows) {
    const lines = {};
    rows.forEach((r, i) => {
      const item = (r.item || '').toLowerCase();
      if (!item) throw new Error(`Row ${i + 2} of the statements file has no item name.`);
      if (lines[item]) throw new Error(`The item "${item}" appears more than once.`);
      lines[item] = {
        section: (r.section || '').toLowerCase(),
        before: toNumber(r.before, `${item} (Before)`),
        after: toNumber(r.after, `${item} (After)`),
      };
    });

    Object.keys(REQUIRED_LINES).forEach(item => {
      const line = lines[item];
      if (!line) throw new Error(`The statements file has no "${item}" line.`);
      if (line.section !== REQUIRED_LINES[item]) {
        throw new Error(`"${item}" should be in section "${REQUIRED_LINES[item]}", not "${line.section}".`);
      }
    });
    ['revenue', 'cogs'].forEach(item => {
      if (!(lines[item].before > 0 && lines[item].after > 0)) {
        throw new Error(`${item} must be greater than zero in both periods.`);
      }
    });
    return lines;
  }

  // Turn the rows of assumptions.csv (assumption,value,note) into
  //   { days_in_year: 365, bank_rate: 0.08, ... }
  function readAssumptions(rows) {
    const a = {};
    rows.forEach(r => {
      const name = (r.assumption || '').toLowerCase();
      if (name) a[name] = toNumber(r.value, name);
    });
    const need = (name, ok, rule) => {
      if (a[name] === undefined) throw new Error(`assumptions.csv has no "${name}" line.`);
      if (!ok(a[name])) throw new Error(`In assumptions.csv, ${name} ${rule}.`);
    };
    need('days_in_year', v => v > 0, 'must be greater than zero');
    need('bank_rate', v => v >= 0, 'can\'t be negative');
    need('supplier_discount', v => v >= 0 && v < 1, 'must be at least 0 and less than 1 (2% is 0.02)');
    need('discount_days', v => v >= 0, 'can\'t be negative');
    need('net_days', v => v >= a.discount_days, 'must be at least discount_days');
    return a;
  }

  // ---------- Days ----------

  // How many days of the annual flow are sitting in a balance:
  //   balance / annual flow × days in the year
  function daysOutstanding(balance, annualFlow, daysInYear) {
    return balance / annualFlow * daysInYear;
  }

  // DIO = Inventory / COGS × days in year
  function dio(inventory, cogs, daysInYear) {
    return daysOutstanding(inventory, cogs, daysInYear);
  }

  // DSO = Accounts receivable / Revenue × days in year (all sales are on credit)
  function dso(receivables, revenue, daysInYear) {
    return daysOutstanding(receivables, revenue, daysInYear);
  }

  // DPO = Accounts payable / COGS × days in year (purchases equal COGS)
  function dpo(payables, cogs, daysInYear) {
    return daysOutstanding(payables, cogs, daysInYear);
  }

  // Cash conversion cycle = DIO + DSO − DPO
  function cashConversionCycle(dioDays, dsoDays, dpoDays) {
    return dioDays + dsoDays - dpoDays;
  }

  // DIO, DSO, DPO and the CCC for one period ('before' or 'after').
  function periodDays(lines, period, daysInYear) {
    const result = {
      dio: dio(lines.inventory[period], lines.cogs[period], daysInYear),
      dso: dso(lines.accounts_receivable[period], lines.revenue[period], daysInYear),
      dpo: dpo(lines.accounts_payable[period], lines.cogs[period], daysInYear),
    };
    result.ccc = cashConversionCycle(result.dio, result.dso, result.dpo);
    return result;
  }

  // ---------- Cash freed ----------

  // Cash freed by the change in one balance sheet line.
  //   Asset (inventory, receivables): Before − After. A drop frees cash.
  //   Liability (accounts payable):   After − Before. A rise frees cash.
  // A negative result means the change used cash instead of freeing it.
  function cashFreedFromBalances(section, before, after) {
    if (section === 'asset') return before - after;
    if (section === 'liability_or_equity') return after - before;
    throw new Error(`Can't work out cash freed for section "${section}".`);
  }

  // The same cash, worked out from days instead of balances:
  //   days changed × annual flow / days in year
  // For an asset, fewer days frees cash. For payables, more days frees cash.
  // This equals cashFreedFromBalances when the annual flow is the same in
  // both periods, as it is in the ElectroMart case.
  function cashFreedFromDays(section, daysBefore, daysAfter, annualFlow, daysInYear) {
    let daysChanged;
    if (section === 'asset') daysChanged = daysBefore - daysAfter;
    else if (section === 'liability_or_equity') daysChanged = daysAfter - daysBefore;
    else throw new Error(`Can't work out cash freed for section "${section}".`);
    return daysChanged * annualFlow / daysInYear;
  }

  // ---------- Everything the page shows ----------

  // The three levers: which balance, which days measure and which annual flow.
  const LEVERS = [
    { key: 'inventory', label: 'Inventory', item: 'inventory', days: 'dio', flow: 'cogs' },
    { key: 'receivables', label: 'Receivables', item: 'accounts_receivable', days: 'dso', flow: 'revenue' },
    { key: 'payables', label: 'Payables', item: 'accounts_payable', days: 'dpo', flow: 'cogs' },
  ];

  function analyze(lines, assumptions) {
    const daysInYear = assumptions.days_in_year;
    const before = periodDays(lines, 'before', daysInYear);
    const after = periodDays(lines, 'after', daysInYear);

    const levers = LEVERS.map(l => {
      const line = lines[l.item];
      // Revenue and COGS are held at their Before values for the days check.
      const annualFlow = lines[l.flow].before;
      return {
        key: l.key,
        label: l.label,
        section: line.section,
        balanceBefore: line.before,
        balanceAfter: line.after,
        daysMeasure: l.days,
        daysBefore: before[l.days],
        daysAfter: after[l.days],
        flowItem: l.flow,
        annualFlow: annualFlow,
        cashFreed: cashFreedFromBalances(line.section, line.before, line.after),
        cashFreedFromDays: cashFreedFromDays(line.section, before[l.days], after[l.days], annualFlow, daysInYear),
      };
    });

    const totalCashFreed = levers.reduce((sum, l) => sum + l.cashFreed, 0);
    return { daysInYear, before, after, levers, totalCashFreed };
  }

  // ---------- The levers (sliders) ----------

  // The balance a days figure implies: days × annual flow / days in year.
  function impliedBalance(days, annualFlow, daysInYear) {
    return days * annualFlow / daysInYear;
  }

  // How much of the cash freed goes to the bank line. Only the bank line's
  // Before balance can be paid down. If cash freed is negative, ElectroMart
  // borrows that much more, so this is negative too.
  function bankLinePaydown(cashFreed, bankLineBefore) {
    return cashFreed > 0 ? Math.min(cashFreed, bankLineBefore) : cashFreed;
  }

  // Interest saved each year = amount paid down on the bank line × bank rate.
  // Negative means extra interest from borrowing more.
  function interestSaved(cashFreed, bankLineBefore, bankRate) {
    return bankLinePaydown(cashFreed, bankLineBefore) * bankRate;
  }

  // Days paid past the due date = DPO − net days, never less than zero.
  function daysPastDue(dpoDays, netDays) {
    return Math.max(0, dpoDays - netDays);
  }

  // If DPO is within the discount period, ElectroMart takes the discount.
  function takesDiscount(dpoDays, discountDays) {
    return dpoDays <= discountDays;
  }

  // Nominal annual cost of skipping the supplier discount:
  //   d / (1 − d) × days in year / (days paid − discount days)
  // where d is the discount (0.02 for 2%) and days paid is DPO.
  // If ElectroMart takes the discount, nothing is skipped, so this returns 0.
  function costOfSkippingDiscount(discount, dpoDays, discountDays, daysInYear) {
    if (takesDiscount(dpoDays, discountDays)) return 0;
    return discount / (1 - discount) * daysInYear / (dpoDays - discountDays);
  }

  // Everything the levers section shows for one set of days { dio, dso, dpo }.
  // Revenue and COGS are held at their Before values. Cash freed compares the
  // balances these days imply with the Before balance sheet.
  function leverResults(lines, assumptions, days) {
    const d = assumptions.days_in_year;
    const revenue = lines.revenue.before;
    const cogs = lines.cogs.before;

    const balances = {
      inventory: impliedBalance(days.dio, cogs, d),
      receivables: impliedBalance(days.dso, revenue, d),
      payables: impliedBalance(days.dpo, cogs, d),
    };
    const cashFreed = {
      inventory: cashFreedFromBalances(lines.inventory.section, lines.inventory.before, balances.inventory),
      receivables: cashFreedFromBalances(lines.accounts_receivable.section, lines.accounts_receivable.before, balances.receivables),
      payables: cashFreedFromBalances(lines.accounts_payable.section, lines.accounts_payable.before, balances.payables),
    };
    cashFreed.total = cashFreed.inventory + cashFreed.receivables + cashFreed.payables;

    const bankLineBefore = lines.notes_payable.before;
    return {
      ccc: cashConversionCycle(days.dio, days.dso, days.dpo),
      balances,
      cashFreed,
      bankLineBefore,
      bankLinePaydown: bankLinePaydown(cashFreed.total, bankLineBefore),
      interestSaved: interestSaved(cashFreed.total, bankLineBefore, assumptions.bank_rate),
      daysPastDue: daysPastDue(days.dpo, assumptions.net_days),
      takesDiscount: takesDiscount(days.dpo, assumptions.discount_days),
      discountCost: costOfSkippingDiscount(assumptions.supplier_discount, days.dpo, assumptions.discount_days, d),
    };
  }

  const CCC = {
    parseCsv,
    toNumber,
    readStatements,
    readAssumptions,
    daysOutstanding,
    dio,
    dso,
    dpo,
    cashConversionCycle,
    periodDays,
    cashFreedFromBalances,
    cashFreedFromDays,
    analyze,
    impliedBalance,
    bankLinePaydown,
    interestSaved,
    daysPastDue,
    takesDiscount,
    costOfSkippingDiscount,
    leverResults,
  };

  // In Node, `require('./ccc.js')` returns CCC. In the browser, it is window.CCC.
  if (typeof module === 'object' && module.exports) module.exports = CCC;
  else root.CCC = CCC;
})(typeof globalThis !== 'undefined' ? globalThis : this);
