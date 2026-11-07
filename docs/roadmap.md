# Roadmap and suggested features

The first version does the asked-for loop: photo → recognised → Google Sheet → everything recalculated, for many properties. Below are the additions I would prioritise, roughly in order of value for a landlord with short- and long-term units.

## Already designed in (small work to finish)

| Feature | Why | Status |
|---|---|---|
| **Income ledger + auto rent columns** | The original sheet needed rent typed by month. Logging each payout (Airbnb/VRBO/cash) makes "Airbnb Rent" / "Cash Rent" automatic and gives per-booking history. | Implemented |
| **Regular Bills ledger** | Utility/mortgage bills are receipts too. Photographing them fills the month cells on the summary tab. | Implemented |
| **Link the existing 2026 sheet** | So nothing has to be re-typed. | Implemented (summary rebuild is opt-in) |
| **Entry delete from the app** | Mistakes happen on the phone. | Implemented |
| **Edit entries** | Change amount/category after the fact, updating the sheet row in place (locate by Entry ID). | TODO – server has `deleteRowByEntryId`; add `updateRowByEntryId` |

## Next, by value

1. **Receipt-to-expense splitting.** One Costco run often mixes supplies for two properties, or personal items. Let the review screen tick line items and split the receipt into multiple rows (even across properties); Claude already returns line items.
2. **Email/forward intake.** Most utility and insurance bills arrive as PDF/email, not paper. Give each user an inbound address (`<user>@receipts.yourdomain`) or a "share to Rental Ledger" share-sheet target; PDFs go through the same extraction (Claude accepts PDFs natively).
3. **Mileage + travel log.** Trips to the property are deductible (IRS standard mileage rate). A "Trip" entry with odometer/miles → auto amount, in its own tab.
4. **Tax-year export (Schedule E).** Map categories to Schedule E lines and produce a year-end summary tab or CSV an accountant can use. Keep the mapping in `packages/shared` so it is one place to tune.
5. **Recurring bill reminders.** Mortgage/insurance/tax are predictable: show "expected but not yet logged this month" on the property dashboard and offer a one-tap "same as last month" entry.
6. **Multi-user per property.** Co-owners or a property manager scanning receipts for the same sheet. Needs a `property_members` table and an invite flow; Google Sheets sharing already covers read access to the sheet itself.
7. **Occupancy / nightly-rate context for STR.** Import the Airbnb/VRBO CSV payout report to populate the Income tab in bulk and derive occupancy, ADR and RevPAR per month next to the P&L.
8. **Vendor memory.** Remember category/ledger choices per vendor ("Home Depot → Repairs") to improve suggestions over time; store on the user and feed into the extraction prompt.
9. **Duplicate detection.** Warn when a receipt with the same vendor, date and total already exists (common when photographing twice).
10. **Offline queue.** Capture without signal; upload when back online. Expo `FileSystem` + a pending-scans table.
11. **Dashboard charts.** Monthly rent vs expenses, per-property comparison, YTD vs last year. The data is already read from the summary tab.
12. **Long-term rental extras.** Lease dates, security-deposit tracking, late fees, tenant contact, rent-due reminders. The property type field exists to gate these.
13. **Receipt originals retention policy.** Purge server uploads after N days (Drive keeps the copy); optional Drive image compression.
14. **Hosted deployment + Postgres.** The server is stateless apart from SQLite and the uploads folder; moving to Postgres + object storage (S3/GCS) is contained in `Repo` and `UploadStore`.

## Known limitations of the MVP

- Google refresh tokens for apps in *Testing* mode expire after 7 days; publish the OAuth app for long-lived access.
- Extraction quality depends on the photo; the review screen is there for a reason. Confidence and warnings are surfaced.
- If a linked (hand-made) sheet uses a different column order than A–F/H, rows will land in the wrong columns. Column mapping per linked workbook is a straightforward extension of `tabMap`.
- No automated tests hit the live Google/Anthropic APIs; the template/formula layer and schema normalisation are unit-tested instead.
