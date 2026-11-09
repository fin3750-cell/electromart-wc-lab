# ElectroMart Working Capital Lab

**FIN 4150 · Chapter 14: Working Capital Policy**

In this lab you use Claude Code to build a working capital calculator for ElectroMart, check it against your own math and judge the company's working capital policy. You also learn the GitHub workflow analysts and developers use: a repository, a branch, commits and a pull request.

## What's in this repository

| File | What it is |
|---|---|
| `case/ElectroMart_Case.md` | The case. Read it first. |
| `data/electromart.csv` | ElectroMart's balance sheet and income statement, before and after the changes |
| `data/assumptions.csv` | Days in the year, the bank's interest rate and the supplier's credit terms |
| `CLAUDE.md` | Instructions Claude reads at the start of every session. Read it so you know how Claude has been told to work with you. |
| `MEMO.md` | Your policy memo. You write this one yourself. |

## Part A: By hand first (10 minutes, no AI)

Fill in section 1 of the case worksheet (the two-page case handout), Before and After:

1. Days inventory outstanding (DIO), also called the inventory conversion period
2. Days sales outstanding (DSO), also called the receivables collection period
3. Days payables outstanding (DPO), also called the payables deferral period
4. The cash conversion cycle (CCC)

A calculator is fine. Keep your worksheet: Claude will ask for your numbers, and sections 2 to 4 of the worksheet follow Parts B to D, so you can check Claude's work as you go.

## Part B: Build the calculator (20 minutes)

Start a Claude Code session on your repository and paste this prompt:

> Read CLAUDE.md, README.md and case/ElectroMart_Case.md. Then build wc_calc.py, a working capital calculator. It should read data/electromart.csv and data/assumptions.csv and report DIO, DSO, DPO and the cash conversion cycle for Before and After, plus the cash freed by inventory, by receivables and by payables. Save the output to results.md. Walk me through it.

Then:

- When Claude asks for your Part A numbers, give them. If yours don't match Claude's, figure out who is right and why. Rounding counts.
- Check one number yourself with a calculator: the cash freed by cutting inventory, worked out from the days, (73.00 − 36.50) × 6,000,000 / 365. It should match the drop in the inventory balance. (If you round daily COGS to a whole dollar first, you'll be off by a few dollars. That's rounding, not an error.)

## Part C: Where the cash went (10 minutes)

The changes free up a lot of cash, but ElectroMart's cash balance goes up by much less. Write your own prompt asking Claude to add a sources-and-uses table to `results.md` that shows where every dollar of freed cash went. (Hint: compare every line of the two balance sheets.) You'll explain what you find in your memo.

## Part D: What-ifs (15 minutes)

Write a prompt asking Claude to add these to `wc_calc.py` and `results.md`:

1. **Interest saved:** the interest ElectroMart pays on its bank line each year before and after, at the rate in `assumptions.csv`, and the difference.
2. **Paying late:** suppliers' terms are 2/10, net 30. How many days past the net-30 due date does ElectroMart pay, before and after?
3. **Cost of skipping the discount:** ElectroMart pays on its DPO day, so it never takes the 2% discount. What does that trade credit cost per year, before and after? Use

   Nominal annual cost = discount % / (100% − discount %) × 365 / (days paid − discount period)

   Is it cheaper or more expensive than borrowing from the bank at 8%?
4. **Size of current assets:** current assets as a percent of sales, before and after.

## Part E: Pull request (10 minutes)

1. In the **Changes** card beside the chat, click the line counts (like `+120 -0`) to see every change Claude made. Read through it.
2. Click **Create PR**. Claude opens a pull request on GitHub.
3. On GitHub, open your repository's **Pull requests** tab and open the new pull request. Read the description, then click **Merge pull request** and **Confirm merge**.
4. Go back to your repository's main page. `wc_calc.py` and `results.md` should be there now.

## Part F: Your memo (after class)

On GitHub, open `MEMO.md`, click the pencil icon (**Edit this file**), write your memo, and click **Commit changes**. Keep it to about one page (400 to 500 words). Answer each question in `MEMO.md` in your own words. Claude can check your numbers, but it won't write the memo for you.

## Submit

Paste your repository's URL in the Canvas assignment. It looks like `https://github.com/your-username/electromart-wc-lab`.
