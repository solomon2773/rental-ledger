# Workbook layout

One spreadsheet per property per year, titled `<Property> - Balance Sheets - <Year>`, created in `Drive / Rental Ledger / <Property> / <Year> /`.

It mirrors the original "2529 persimmon dr-AirBnb Balance Sheets-2026" sheet and adds two ledger tabs so the summary can be fully formula-driven.

## Tabs

| Tab | Purpose | Rows written by the app |
|---|---|---|
| **Regular Expense** | Monthly summary + yearly totals. Formulas only. | none (formulas) |
| **Regular Bills** *(new)* | One row per recurring bill: mortgage, water, electricity, internet, insurance, property tax, HOA… | yes |
| **Room Supply Expenses** | Itemised operating purchases (same columns as the original) | yes |
| **Initial Room Setup Expenses** | Itemised one-time setup purchases (same columns as the original) | yes |
| **Income** *(new)* | Payouts and rent received | yes |

## Expense ledger columns (Regular Bills, Room Supply, Initial Setup)

| Col | Header | Content |
|---|---|---|
| A | Expense Date | `=DATE(y,m,d)` formatted `mm/dd/yy` |
| B | From | vendor |
| C | Category | dropdown. Supply/Setup: Supplies, Repairs, Cleaning, Furniture & Appliances, Taxes, Fees & Services, Meal, Travel, Others. Regular Bills: the property's bill columns. |
| D | Details | free text summary of what was bought |
| E | Amount | number, currency format |
| F | Pay by | e.g. `Visa - 8941`, `Checking Account` |
| G | Notes | optional |
| H | Receipt | `=HYPERLINK("<drive link>","Yes")` or `No` |
| I | Entry ID | UUID used by the app to find/delete the row (small grey text) |

Columns A–F and H match the original sheet, so the app can also append to the original workbook when it is *linked*.

## Income columns

| Col | Header | Content |
|---|---|---|
| A | Date | `=DATE(...)` |
| B | Source | Airbnb, VRBO, Booking.com, Direct Booking, Cash Rent, Bank Transfer Rent, Security Deposit, Other |
| C | Bucket | `Airbnb Rent` or `Cash Rent` (matches the summary column header it rolls into) |
| D | Payer | guest / tenant / confirmation code |
| E | Amount | |
| F | Notes | |
| G | Entry ID | |

## Regular Expense (summary) tab

Row 1 headers (for the default categories): `"" | Mortgage | City Water | Electricity | Gas | Internet | Home Insurance | Property Tax | HOA | Monthly Total Regular Expense | Airbnb Rent | Cash Rent | profit/lost | 75% | Lender $$ (75% rent − Mortgage)`.
The category columns come from the property's *monthly bill columns* setting; everything to their right shifts accordingly.

Rows 2–13 are the months (`=DATE(year, m, 1)`, formatted `mmm/yyyy`). For month row *r*:

| Column | Formula |
|---|---|
| each bill category *X* | `=SUMIFS('Regular Bills'!$E:$E, 'Regular Bills'!$C:$C, X$1, 'Regular Bills'!$A:$A, ">="&$A r, 'Regular Bills'!$A:$A, "<"&EDATE($A r,1))` |
| Monthly Total Regular Expense | `=SUM(<first cat> r:<last cat> r)` |
| Airbnb Rent / Cash Rent | `=SUMIFS(Income!$E:$E, Income!$C:$C, <header>, Income!$A:$A, ">="&$A r, Income!$A:$A, "<"&EDATE($A r,1))` |
| profit/lost | `=AirbnbRent + CashRent − MonthlyTotal` |
| 75 % | `=(AirbnbRent + CashRent) * <75% header cell>` – the share of rent lenders typically count as income |
| Lender $$ | `=75% − Mortgage` – what a lender nets the rental against the mortgage payment |

Rows 15–21:

| Row | Label | Formula (in the *profit/lost* column unless noted) |
|---|---|---|
| 15 | Average | per column: `=IFERROR(AVERAGEIF(col2:col13,"<>0"),0)` (ignores empty months) |
| 16 | Yearly Total | per column: `=SUM(col2:col13)` |
| 17 | Yearly Utility Cost | sum of the yearly totals of utility columns (City Water, Electricity, Gas, Internet, Trash, Sewer) |
| 18 | Supply Expenses | `=SUM('Room Supply Expenses'!$E:$E)` |
| 19 | Initial Setup Expenses | `=SUM('Initial Room Setup Expenses'!$E:$E)` |
| 20 | Whole Year Net P&L (operating) | `=AirbnbRent16 + CashRent16 − MonthlyTotal16 − SupplyExpenses` |
| 21 | Net P&L incl. Initial Setup | `=row20 − row19` |

Differences from the original, on purpose:

- Monthly bill cells are formulas fed by the **Regular Bills** ledger instead of typed numbers, so a photographed electricity bill flows into the right month automatically. You can still overwrite a cell by hand.
- `Supply Expenses` sums the whole column instead of pointing at a fixed cell (`E178` in the original), so it never goes stale.
- Net P&L includes Cash Rent (the original only subtracted from Airbnb rent) and setup costs are shown separately because they are one-time, capital-like spend.
- Gas and HOA were added as default bill columns; remove them in property settings if unwanted.

## Linking an existing workbook

`POST /properties/:id/workbooks/link` inspects tab titles and maps them:

| Title matches | Ledger |
|---|---|
| `regular bill` | Regular Bills |
| `supply` / `supplies` | Room Supply Expenses |
| `setup` | Initial Room Setup Expenses |
| `income` / `rent received` / `payout` | Income |
| `regular expense` / `summary` / `balance` | summary tab |

Missing ledger tabs are added with headers; existing tabs are left alone. Because the original ledger tabs have pre-filled category cells in empty rows, the app finds the *first row with an empty date* and writes there (overwriting that row's placeholder category). The summary is not rewritten unless you run **Rebuild summary formulas**, which is explicit and confirmed in the app.
