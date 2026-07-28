# AGENTS.md

## Project mission
Build a face-analysis and virtual-eyewear system that recommends eyeglass frames by:
1. visual style compatibility;
2. physical fit;
3. confidence and device capability.

## Mandatory reading
Before planning or changing code, read:

- `docs/AR_GLASSES_PRODUCT_SPEC.md`
- `docs/CODEX_TASK_BRIEF.md`

Treat `docs/AR_GLASSES_PRODUCT_SPEC.md` as the product source of truth unless it conflicts with the existing codebase or verified current SDK documentation.

## Working rules
- Inspect the repository before proposing an architecture.
- Do not assume the current stack, routes, database, deployment platform, or camera library.
- Separate **virtual try-on** from **real-world measurement**.
- Never present pixel or normalized landmark distances as millimetres without a validated scale source.
- On devices without trusted depth or calibration, label size results as estimates.
- Keep face-shape output probabilistic or mixed; do not force every face into one rigid class.
- Preserve user privacy. Prefer on-device processing and do not persist face images or biometric geometry unless explicitly required and consented to.
- Add feature detection and graceful fallbacks for unsupported devices.
- Verify current Apple, Google, and MediaPipe documentation before using platform-specific APIs.
- Do not begin a large implementation until you have produced:
  1. repository audit;
  2. gap analysis;
  3. proposed architecture;
  4. milestone plan;
  5. acceptance tests.

## Engineering expectations
- Use small, reviewable changes.
- Reuse the existing stack where reasonable.
- Add tests for geometry, scoring, capability detection, and quality gates.
- Keep measurement logic independent from rendering logic.
- Keep product-frame metadata independent from face-analysis code.
- Document assumptions and unresolved questions.
- Do not silently invent product dimensions or calibration constants.

## Definition of done
A task is done only when:
- relevant tests pass;
- unsupported-device behavior is defined;
- user-facing confidence/limitations are shown;
- documentation is updated;
- no absolute sizing claim is made without validated calibration.
