# Integration Research Notes

## LINE OA Notifications

The official LINE Messaging API supports push messages to a user, group chat, or multi-person chat. The relevant endpoint is `POST /v2/bot/message/push`. The application must securely store a LINE Messaging API channel access token, which authorizes calls made on behalf of the selected LINE channel. Booking notifications can be sent immediately from the booking mutation. Near-end-of-session alerts require a durable scheduled callback rather than an in-process server timer.

Sources: [LINE Messaging API: Send messages](https://developers.line.biz/en/docs/messaging-api/sending-messages/), [LINE Messaging API Reference](https://developers.line.biz/en/reference/messaging-api/), and [LINE Channel Access Tokens](https://developers.line.biz/en/docs/basics/channel-access-token/).

## Preview Verification

The managed preview host initially rejected Vite requests because it was not on the permitted-host list. This was resolved through the Vite server configuration. The page title now loads as `Crazy Snooker Club`; however, the React interface is still blank in the browser and requires a client-side console investigation before delivery.

The investigation identified a `ReferenceError: React is not defined` in the JSX entry module. The module imports React hooks but not the default `React` symbol required by the active JSX transform. The entry import will be corrected and the preview re-verified.

The corrected preview loads successfully. A POS validation scanned barcode `8850124018015`, identified the matching water product, added one unit to the cart, and recalculated the total to THB 15.00.

The booking and near-end alert screen is accessible in the managed preview. A booking can be entered with table, customer, phone, and start time. Production delivery remains deferred until LINE OA credentials are supplied.

Submitting a booking without production credentials succeeds in the local workflow and clearly tells the user that LINE OA delivery will activate after configuration. The inventory screen also renders the product barcode catalogue with receiving and adjustment controls; it shares the same stock data model as the POS screen.

The corrected inventory flow was verified end to end: scanning `8850124018015` selected น้ำดื่ม for an explicit stock action, then a one-unit receipt updated its displayed inventory from 48 to 49 without adding the item to the POS cart. Camera scanning now has user-visible fallback messages for missing support, denied permission, camera startup, and scan detector failures.

Final POS validation confirmed that a product can be added to the cart and that QR generation correctly declines to proceed with the clear message `PROMPTPAY_RECIPIENT ยังไม่ได้ตั้งค่า` while the live recipient configuration remains deferred. This is expected; no payment QR can be generated until the club supplies a legitimate PromptPay recipient value.

The table-status panel was verified in the rendered application. It shows available, occupied, reserved, and maintenance states with an accessible text label plus a distinct color. Changing โต๊ะ 02 from available to occupied immediately updated the card and showed an operator confirmation message through the live server event flow.

The transaction-history screen was verified with all supported filter controls visible. Selecting PromptPay reduced the results to the matching PromptPay record `CS-DEMO-1002`, confirming that the payment-method filter updates the transaction list correctly.

Opening `CS-DEMO-1002` displayed a receipt with receipt number, payment timestamp, customer, method, line items, and total. The receipt modal exposes print controls and an email field. The configured delivery behavior deliberately opens the operator's email client with the receipt information instead of sending mail automatically, so a real transactional-email service and credential remain optional future integration work.

The operations upgrade passed seven automated tests, including table-status labels, receipt mail composition, and combined date/method/query transaction filtering. The production build was also smoke-tested by starting `node dist/index.js` and successfully reading both the deployed application shell and the `/api/tables` endpoint.

The guided-support update was verified after a clean first-run state. The tour opened automatically at step 1, displayed `ขั้นตอน 1 จาก 6`, and advanced to the POS guidance at step 2 when the operator selected Next. The navigation now includes a Settings screen and the interface includes an always-available Help control.

After completing the tour, the global Help control opened an accessible in-app manual popup with concise Thai guidance for every main workflow plus actions to restart the tour and download the full PDF manual.

The Settings screen was verified to present dedicated controls for opening the manual, downloading the full PDF, and restarting the Interactive Tour.

Selecting the Settings PDF export control successfully downloaded `crazy-snooker-user-manual-th.pdf`, confirmed in the browser download history.

After dismissal, revisiting the application did not automatically show the tour. Selecting `เริ่ม Interactive Tour ใหม่` from Settings reset the saved completion state and immediately restarted the tour at step 1, as designed.

The enhanced tour was verified with a visible 17% progress indicator at step 1 of 6 and a corresponding horizontal progress bar, in addition to the existing textual step count and progress dots.

The Help popup search was verified with the Thai keyword `บาร์โค้ด`. It reported two matching topics and narrowed the visible guide cards to the POS and inventory sections.

The structured support-report form was verified to show its privacy reminder, category selector, optional contact field, current-screen context, and a clear validation message when detail is under 10 characters. The feedback API independently returned the expected HTTP 400 response for the same invalid payload before attempting any database write.

The admin navigation was verified to open the user-report center with refresh, category and status filters, a clear internal-access notice, and an empty state. The Help control tooltip was visibly rendered with the concise explanation “เปิดคู่มือ วิธีใช้งาน และรายงานปัญหา”.

The feedback queue completed loading and rendered its empty state without an error. Settings also exposed the `เริ่ม Interactive Tour ใหม่` control for testing the explicit Skip Tour behavior.

The restarted tour displayed the dedicated `ข้ามทัวร์ (Skip Tour)` action at step 1. Selecting it closed the tour immediately and returned to the POS view, confirming that experienced users can bypass onboarding without completing every step.

After a page reload, the tour remained dismissed, confirming persisted skip completion. The Help button was also verified to reference the `help-tooltip` element via `aria-describedby`; the tooltip exposes `role="tooltip"` and its concise explanatory text to assistive technology.

## Feedback Administration Enhancements — Verification

The protected new-report counter rejects a request without an administrator key with HTTP 401, while the authorized access check and authorized count request both return HTTP 200. The navigation badge therefore obtains only a numeric count through the protected administrator session and never exposes report content, contacts, or internal notes.

A labeled `[TEST]` report was submitted to the real feedback store, received a protected internal note, and transitioned from `new` to `in_progress` and then `resolved`. This confirmed that the new note table, count endpoint, status persistence, and protected note retrieval operate against the live database.

The browser verification created a separate labeled `[TEST]` report, unlocked the admin center with the configured secret without printing it, confirmed a visible new-report badge, added and displayed an internal note, and chose `ดูการแนะนำการใช้งานอีกครั้ง` from Help. The Help action closed the dialog and opened step 1 of the Interactive Tour. The script resolved its test report during cleanup.

The latest validation suite contains 16 passing tests, including repository coverage for counting `new` reports and storing notes separately from report content. The production build completed successfully. Desktop and 375px mobile previews both rendered the first-time tour with progress, Skip Tour, and Next controls without overflow. The reusable `crazy-snooker-guided-support` skill also passed the skill validator.

## Persistent Near-End Alerts — Verification

The table-state API now reads and writes persistent table sessions, including the customer and expected end time. A browser flow changed a test table to occupied, supplied an end time, confirmed that the value remained visible after saving, and restored the table to available during cleanup. The automated test suite also verifies time parsing and the one-claim behavior used to prevent duplicate notifications.

The published project has an enabled Heartbeat job using a six-field one-minute cron expression. Its authenticated callbacks reached the protected `/api/scheduled/near-end-alerts` endpoint successfully on repeated scheduled runs. Because LINE OA credentials are deliberately deferred, each verified run returned HTTP 200 with `line_not_configured`, performed no delivery, and did not create a misleading delivery record. The final configuration of the LINE token and recipient remains the only prerequisite for live push notifications.

## LINE Messaging API Push Message — Live Verification

The LINE Channel Access Token was checked through the read-only bot-information endpoint before any delivery attempt. The configured recipient was then corrected to an addressable LINE Messaging API destination. Two clearly labelled `[TEST]` messages—one booking notification and one near-end notification—were accepted by LINE from the application server.

The production Heartbeat callback subsequently processed one labelled test table in its near-end window and reported `checked: 1`, `claimed: 1`, `delivered: 1`, and `failed: 0`. This confirms the durable one-minute scheduler, protected callback, idempotent claim, and LINE Push Message delivery work together in the published environment. The test table was restored to **โต๊ะ 02 / available** immediately after verification.
