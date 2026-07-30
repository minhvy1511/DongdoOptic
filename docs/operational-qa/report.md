# Operational QA Report

Date: 2026-07-31
Branch: feature/visionid-ux-operations
Baseline: 5d5cfba

## Scope

Focused validation for the unfinished end-to-end operational QA round:

- saved consultation state must stay stable after save;
- completed operation drafts must not reappear as resume prompts;
- customers with saved consultation results can be marked measured;
- no camera/classifier/catalog/recommendation changes.

## Local QA Server

Static server command used:

```powershell
$qaServer = Join-Path $env:TEMP 'dongdo-optic-qa-server.cjs'
Start-Process -FilePath 'node' -ArgumentList @($qaServer, '5183', 'E:\DongDo_Optic') -WorkingDirectory 'E:\DongDo_Optic' -WindowStyle Hidden
```

Browser origin:

```text
http://127.0.0.1:5183/frontend/?visionDebug=1&qa=completed-fixes-final
```

Server checks:

- `/frontend/`: HTTP 200
- `/frontend/js/app.js`: HTTP 200
- JS MIME: `text/javascript; charset=utf-8`

## Results

| Area | Expected | Actual | Status | Notes |
| --- | --- | --- | --- | --- |
| Saved consultation state | Saving a consultation result must not immediately become update-required only because `savedAt` changed. | Signature now ignores `savedAt`; `npm` regression test passes. Browser flow did not show visible update-required text after save/reload. | Pass | Business changes still change the signature. |
| Completed draft after save | Reload after saved consultation must not show resume modal. | Reload after saved consultation showed no visible resume modal. | Pass | Tested on clean origin 5183. |
| Completed draft after measured | Reload after marking measured must not show resume modal. | Customer remained `measured`; operation draft was not present; resume dialog was not visible. | Pass | Root fix: completed context is also set when marking measured. |
| Mark measured button | Saved consultation result must enable visible measured action in Tab 4. | Opening saved result showed `markMeasuredButton` visible and enabled. | Pass | Button moved from hidden VisionID controls to consultation actions. |
| Customer isolation | Completed context must be tied to draftId/sessionCode/customerId, not a global boolean. | Completed context includes all three identifiers and is cleared on open/resume/new session. | Pass | Next-customer browser QA still needs a full manual pass. |
| Privacy/storage | No image, landmark, mesh, or debug payload should be persisted by these fixes. | No VisionID storage schema was changed; draft store still rejects unsafe keys. | Pass | Covered by existing privacy tests. |
| Screenshot capture | Capture updated screenshots into repo. | Blocked by sandbox write permissions for binary files under `E:\DongDo_Optic`. | Blocked | Existing screenshots remain in `docs/operational-qa/`. |
| Backend validation | Run backend tests and compileall. | Blocked because `python` is not in PATH. | Blocked by environment | Not treated as app failure per brief. |

## Existing Screenshot Paths

These screenshots were already present from the earlier QA run:

- `docs/operational-qa/01-profile-new.png`
- `docs/operational-qa/02-draft-resume.png`
- `docs/operational-qa/06-workflow-validation.png`
- `docs/operational-qa/07-visionid-fallback.png`
- `docs/operational-qa/08-manual-confirmation.png`
- `docs/operational-qa/09-consultation-manual.png`
- `docs/operational-qa/10-consultation-saved.png`
- `docs/operational-qa/11-customer-list-status.png`

No new screenshots were written because the current sandbox cannot create binary files under the repository path.

## Root Causes Confirmed

1. Consultation signatures included `savedAt`, so a freshly saved payload could look different from the persisted payload even when business content was unchanged.
2. Completed operation context was not restored after marking a previously saved customer as measured, so page lifecycle flush could write a new draft after the operation had been completed.
3. `markMeasuredButton` was rendered inside the hidden VisionID camera controls, so it could be logically enabled but unavailable in Tab 4.

## Fix Summary

- `frontend/js/consultation-state.js`
  - strips volatile `savedAt` from consultation signatures.

- `frontend/js/app.js`
  - adds completed operation context keyed by draftId, sessionCode, and customerId;
  - skips draft save/flush when the completed operation has no unsaved business changes;
  - starts a new draft only after a real post-completion edit;
  - centralizes measured button disabled state in `syncMarkMeasuredButtonState()`;
  - sets completed context after marking a customer measured.

- `frontend/index.html`
  - moves `markMeasuredButton` into Tab 4 consultation actions so the CTA is visible where it is used.

- `tests/vision/consultation-state.test.js`
  - covers `savedAt`-ignored signatures and business-content changes.

- `tests/vision/operation-draft-store.test.js`
  - covers cancelled debounce after completion and completed measured draft being non-resumable.

## Validation

```text
npm.cmd test
Result: Pass, 124/124
```

```text
node --check frontend/js/app.js
node --check frontend/js/consultation-state.js
node --check frontend/js/operation-draft-store.js
node --check frontend/js/customer-store.js
node --check frontend/js/workflow-state.js
node --check frontend/js/operation-validation.js
node --check frontend/js/customer-lookup.js
node --check frontend/js/app.mobile.js
Result: Pass
```

```text
git diff --check
Result: Pass
Note: Git reported LF-to-CRLF working-copy warnings only.
```

```text
python -m unittest discover -s tests/backend
python -m compileall backend
Result: Blocked by environment, python is not in PATH.
```

## Remaining Operational QA

- Full next-customer isolation manual flow.
- Real desktop camera smoke.
- Android Chrome portrait/landscape smoke.
- iPhone/iPad Safari upload fallback smoke.
- Duplicate customer flow after these fixes.
- Final public deployment smoke after approval.

## Recommendation

Ready to continue end-to-end QA.

Do not push, deploy, merge, or proceed to production approval until the remaining device/manual QA items pass.
