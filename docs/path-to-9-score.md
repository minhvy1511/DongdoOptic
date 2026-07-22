# Path To 9/10

Current target: keep the consultation content stable, then raise the product from prototype to store-ready operation.

## 1. Interface And Workflow

Target: 9/10

- Keep the four-tab flow, but make each tab task-focused: profile, needs, VisionID, consultation.
- Hide technical/debug language by default.
- Add clearer completion states: saved profile, VisionID ready, consultation ready, feedback synced.
- Mobile/tablet must keep primary actions near the active work area.

## 2. Staff Consultation Support

Target: 9/10

- Use direct frame advice instead of face-shape labels.
- Show a three-step try-on plan: try first, compare, reject quickly.
- Add fit checks that staff can perform physically: width, pupil position, brow line, bridge, temple pressure.
- Store staff feedback after each consultation to calibrate local rules.

## 3. Product Suggestion Logic

Target: 9/10

- Replace generic frame categories with a real DongDo catalog: SKU, shape, size, material, bridge, temple, color, price, stock.
- Score frames by fit signals, prescription, purpose, budget, material, and staff feedback.
- Log chosen frame versus suggested frame to improve rankings.
- Public advice should remain a prior; local store feedback should become the stronger signal.

## 4. Real Operation Readiness

Target: 9/10

- Add reliable server-side storage/export for feedback and consultation results.
- Add admin-only export routes for calibration data.
- Add backup/restore workflow for customer and feedback JSON or database.
- Add smoke tests for health, privacy, feedback, and consultation flow before every deploy.

## 5. Security And Privacy

Target: 9/10

- Keep images client-side and never upload face photos by default.
- Require admin key for sensitive read/write endpoints.
- Keep feedback submission open but avoid names, phone numbers, and images.
- Add security headers, no-store for API responses, and clear privacy copy.
- Add a retention policy for local customer records and calibration feedback.
