# Specialist workspace

The Specialist dashboard implements Figma frames `57:3885` (waiting) and `57:4106` (assessment) in file `XvYelFeTRkb5CFamqUHNak`. SVG assets are stored locally under `apps/web/public/specialist-assets`. Layout and controls adapt to small screens; order codes, names, documents and dates come from the API.

## Workflow

- Manager approves an order and creates its checklist; specialists receive an in-app notification.
- `GET /specialist/orders` lists available approved orders and the signed-in specialist's assigned orders.
- `POST /specialist/orders/:id/accept` claims the order under an order-row lock. Competing claims cannot assign the same order to two people. Repeating the owner's claim is idempotent.
- `GET /specialist/orders/:id` supplies the customer contacts, horse profiles, documents and assignment. A different specialist cannot access an assigned assessment.
- Existing document review/upload APIs retain version checks and document-level supplement requests. Customer notifications open the exact order, horse and document. Reviewing, requesting, uploading or expiring a document invalidates the prior assessment conclusion, without changing other horses' document results.
- `POST /specialist/orders/:id/conclude` accepts `decision`, `note`, `revision`. Approval requires all active horses' checklist documents to be valid and unexpired. Supplement/rejection requires a reason. The customer and managers receive the result. Assessment status is separate from transport status.
- Manager order details read `/manager/orders/:id/context` for booking contacts, requested services, an estimate from the current pricing version, and the specialist's conclusion. Quote drafting starts with the customer's saved booking input.

Migration `1800000010000-SpecialistAssessments` creates the assignment/conclusion table. The migration was applied to the configured application database; no customer order was claimed or reviewed as part of verification.

The existing model has no configured assessment deadline. The waiting card therefore displays “Hạn thẩm định: chưa đặt” when no `assessment_due_at` value is supplied. It does not fabricate the sample countdown in Figma.

## Verification

- `node apps/api/test/specialist.mysql.cjs`: isolated random test database; tests concurrent claim, ownership, a three-horse supplement, revision conflicts, expiry, notifications, assessment reset and Manager context.
- `node apps/web/test/specialist.browser.cjs`: mocked browser fixtures; tests filters, claim, versioned review, targeted supplement, conclusion, horse tabs, fullscreen, asset geometry and mobile overflow. Uses `PLAYWRIGHT_PACKAGE` when Playwright is installed outside the workspace.
- Desktop/mobile screenshots are written to `test-results/specialist-*-figma.png` and `test-results/specialist-mobile.png`.
