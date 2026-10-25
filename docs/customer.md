# Customer

The Customer workspace follows Figma C0–C5: horizontal navigation, Be Vietnam Pro, teal banners, centered 1120px content, horse cards, document rows, sender/recipient booking panels and a separate confirmation step. Styles are scoped to `.customer` and `.cj` so legacy input margins cannot distort the forms.

CustomerJourney supplies reusable profiles, four photo slots, private uploads, domestic/international booking and estimates from the published pricing API. Existing order details, notifications and tracking remain accessible. History supports search, status/year filters, pagination and CSV export.

## Customer orders update (2026-10-25)

- New orders use `VCN-YYYYMMDD-NNNN`, with the date in Asia/Ho_Chi_Minh and a four-digit daily sequence. The existing unique code index and transaction retry handle concurrent inserts. Existing order codes remain unchanged; no schema migration is required for this update. A day supports up to 9999 codes. The next number follows the highest code still present for that day.
- `view=orders` is **Đơn của tôi**: cards for all owned orders, route and horses, progress, quote and paid amount, search, status counts, departure-date range, and detail navigation. Booking confirmation now uses `view=confirm`; successful submission returns to the order list.
- **Lịch sử giao dịch** and its CSV include only `DELIVERED` orders with an approved quote and total receipts greater than or equal to that quote. Delivered but unpaid orders remain visible under Đơn của tôi.
- Specialist supplement requests mark only the selected document `INVALID`, retain the reason, and send a document-linked notification. Existing dossier locks remain enforced. Customer notifications resolve the order, horse and document and open their detail under Đơn của tôi.
- The detail groups checklist results by horse. Customers can upload PDF/JPG/PNG up to 5 MB to the requested document and send it for review. Only that document becomes `SUBMITTED` (Chờ thẩm định); other approved documents are unchanged. Pending uploads block accidental navigation until sent or discarded.
- Regression checks: `apps/api/test/customer-order-updates.test.cjs` and `apps/web/test/customer-orders.browser.cjs`. Browser checks use mocked API data, including three horses with one EIA supplement request; they do not modify the team's database.

## Database

Migration CustomerProfiles1800000009000 adds customer_horse_profiles (owner, unique passport, JSON fields, revision), customer_profile_files (append-only private metadata), and orders.booking_details (contacts, pickup time, services, international paperwork, preferred payment and consent). Existing order horses seed profiles without deleting history.

Passport uniqueness moves from order snapshots into the profile registry. Submission locks the registry and rejects foreign owners, allowing the same customer's horse on subsequent orders. Assigned profile passports cannot be edited. Profile edits use optimistic locking.

On Manager approval, the latest staged files matching required document types become SUBMITTED document versions; they are never automatically validated. Uploads for active orders use the existing review locks. Private storage retains its 5 MB file limit.

## API

All /api/v1/customer endpoints require CUSTOMER: GET/POST /profiles, PUT /profiles/:id, GET /document-types, POST /profiles/:id/files and GET /files/:id. File reads and edits are owner-scoped.

GET /orders/customer-workspace returns owned orders, horse names, approved quotes, receipts and document counts. Pricing estimates come from /pricing/estimate. Official amounts still require Manager approval. Payment choices are preferences, not payment gateway transactions. The route graphic is schematic, not GPS. CSV export is not a tax invoice.

## Checks

- API test/customer.mysql.cjs: isolated MySQL schema; ownership, edit races, private uploads, reusable identity, consent, contact persistence and document transfer into review.
- API test/flow1.mysql.cjs: draft/submission/approval/ownership and Manager pagination regressions.
- API test/customer-workspace.test.cjs and test/swagger.test.cjs: authorization and endpoint contracts.
- Web test/customer.browser.cjs: C0–C5 navigation, fonts, documents, history export, international booking through submission, unsaved-change guard and 390px layout.
- API scripts/verify-customer-workspace.cjs: read-only checks against configured MySQL and running localhost API; no customer records or credentials printed.
