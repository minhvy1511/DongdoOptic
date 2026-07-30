# Operational QA Report

Date: 2026-07-31
Branch: feature/visionid-ux-operations
Base commits reviewed: `5d5cfba`, `0e51dd2`
Local fix under review: duplicate-save modal integration

## Scope

Final local end-to-end operational QA for the UX operations round:

- saved consultation state remains stable after save/reload;
- completed operation drafts do not reappear as stale resume prompts;
- customers with saved consultation results can be marked measured;
- duplicate phone save flow gives staff a clear decision path;
- customer records stay isolated across sessions;
- no camera/classifier/catalog/recommendation/backend changes.

## Local QA Server

Static server used a temporary Node server outside the repository:

```powershell
$qaServer = Join-Path $env:TEMP "dongdo-optic-qa-server.cjs"
Start-Process -FilePath "node" -ArgumentList @($qaServer, "5178", "E:\DongDo_Optic") -WorkingDirectory "E:\DongDo_Optic" -WindowStyle Hidden
```

Browser origin:

```text
http://127.0.0.1:5178/frontend/?visionDebug=1&qa=completed-fixes
http://127.0.0.1:5178/frontend/?visionDebug=1&qa=focused-duplicate-measured
```

Server checks:

- `/frontend/`: HTTP 200
- `/frontend/js/app.js`: HTTP 200
- JS MIME: `text/javascript; charset=utf-8`
- Console errors during focused QA: none captured

## Results

| Area | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- |
| Duplicate inline warning | Typing an existing phone warns staff without replacing the current draft. | Warning appears; current draft name/code/session remain intact. | Pass | `duplicate-warning.png` |
| Duplicate save blocker | Pressing `Luu ho so khach` with an exact duplicate must open the duplicate dialog. | Initially failed: validation consumed the duplicate before `saveCurrentCustomer()` could open the dialog. Fixed by using save-specific validation and retested: dialog appears. | Pass after fix | `focused-duplicate-after-save.png`, `duplicate-modal.png` |
| Duplicate create separate | Staff can explicitly create a separate profile after dialog confirmation. | Focused QA created a separate duplicate after `createSeparateDuplicateButton`; duplicate notice cleared. | Pass | focused QA JSON |
| Saved consultation state | Saving a consultation result must not immediately become update-required only because `savedAt` changed. | Saved result stayed `Da luu ket qua tu van` after save and reload. | Pass | `consultation-saved-state.png` |
| Completed draft after save | Reload after saved consultation must not show a stale resume modal. | Reload after saved consultation showed no visible resume modal. | Pass | `completed-reload-no-resume.png` |
| Edit after completed consultation | Editing a completed customer should create a new resumable draft while keeping the old saved result until update is saved. | Browser QA produced a new resume prompt for the edit draft; saved card/result remained available. | Pass | operational QA JSON |
| Mark measured button | Saved consultation result must enable measured action in Tab 4. | Focused QA: button enabled after save; click changed state to `Da do`; reload retained `Da do`. | Pass | `focused-measured-enabled.png`, `focused-measured-clicked.png`, `focused-measured-reload.png` |
| Customer isolation | Starting a new customer after A is completed must not inherit recommendation/manual/measured/save state. | B started clean with its own name/phone/session and no saved/measured state. | Pass | `next-customer-clean-state.png` |
| Responsive overflow | Desktop, Android portrait/landscape, and iPad-size viewport should not have horizontal overflow. | Automated viewport checks reported `overflowX: false` on all tested viewports. | Pass | `responsive-*.png` |
| Privacy/storage | UX fixes must not persist image, landmark, mesh, or debug fields. | No VisionID persistence code changed; existing privacy/draft tests still pass. | Pass | npm test |
| Backend validation | Backend unit tests and compileall should pass when a Python interpreter is available. | `python` was not in PATH, but `C:\Users\Asus\AppData\Local\Programs\Python\Python314\python.exe` was found and used successfully. | Pass | backend unittest and compileall |

## Root Cause Fixed In This Round

The duplicate save path had two layers:

1. `getProfileValidation()` treated duplicate phone as a normal field error.
2. `saveCurrentCustomer()` contained the intended duplicate dialog flow.

When staff pressed `Luu ho so khach`, `saveCurrentCustomerWithLock()` returned early at validation, so `showDuplicateSaveDialog()` was never reached. The fix adds `validateProfileSaveState()` for explicit save actions, so required fields and prescription are still validated, while exact duplicate handling is left to `saveCurrentCustomer()`.

Workflow navigation still uses `validateProfileState()` and continues to block moving forward when a duplicate has not been resolved.

## Files Changed By The Local Fix

- `frontend/js/app.js`
  - imports `validateProfileSaveState()`;
  - uses save-specific validation in `saveCurrentCustomerWithLock()`;
  - keeps workflow duplicate blocking intact.

- `frontend/js/operation-validation.js`
  - adds `validateProfileSaveState()`.

- `tests/vision/operation-validation.test.js`
  - adds regression coverage proving explicit save does not consume duplicate handling before the dialog.

- `docs/operational-qa/report.md`
  - records the completed local operational QA.

- `docs/operational-qa/*.png`
  - adds focused duplicate/measured screenshots and updated responsive/browser evidence.

## Screenshot Paths

- `docs/operational-qa/duplicate-warning.png`
- `docs/operational-qa/duplicate-modal.png`
- `docs/operational-qa/focused-duplicate-after-save.png`
- `docs/operational-qa/consultation-saved-state.png`
- `docs/operational-qa/completed-reload-no-resume.png`
- `docs/operational-qa/focused-measured-enabled.png`
- `docs/operational-qa/focused-measured-clicked.png`
- `docs/operational-qa/focused-measured-reload.png`
- `docs/operational-qa/next-customer-clean-state.png`
- `docs/operational-qa/responsive-desktop.png`
- `docs/operational-qa/responsive-android-portrait.png`
- `docs/operational-qa/responsive-android-landscape.png`
- `docs/operational-qa/responsive-ipad-upload.png`

## Automated Validation

```text
npm.cmd test
Result after local fix: Pass, 125/125
```

```text
node --check frontend/js/app.js
node --check frontend/js/operation-validation.js
Result: Pass
```

Full final validation still needs to be rerun after committing:

```text
npm.cmd test
python -m unittest discover -s tests/backend
node --check frontend/js/app.js
node --check frontend/js/consultation-state.js
node --check frontend/js/operation-draft-store.js
node --check frontend/js/customer-store.js
node --check frontend/js/workflow-state.js
node --check frontend/js/operation-validation.js
node --check frontend/js/customer-lookup.js
node --check frontend/js/app.mobile.js
python -m compileall backend
git diff --check
git status --short
git log -10 --oneline
```

## Remaining Operational QA

- Real desktop camera smoke.
- Android Chrome portrait/landscape smoke.
- iPhone/iPad Safari upload fallback smoke.
- Manual duplicate flow on the public QA URL after deployment approval.
- Manual next-customer isolation on a real tablet/phone after deployment approval.

## Recommendation

Ready to continue end-to-end QA after the local duplicate-save fix is committed and final validation passes.

Do not push, deploy, merge, or proceed to production approval until the remaining device/manual QA items pass.
