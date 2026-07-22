# Public Eyewear Advice Sources

This file records public, non-personal reference sources used to enrich VisionID frame-advice rules. These sources should inform advisory heuristics only; they are not biometric ground truth and should not be used to label a customer's face in the UI.

## Source Set

- ZEISS Better Vision: style and face-shape guidance for choosing frames and colors.
- ZEISS Canada buying tips: broad rule that softer faces often benefit from angular frames, while angular faces often benefit from rounder frames.
- Warby Parker face-shape guide: practical guidance that face shape is a guide, not a hard rule; includes round, oval, square, heart, triangle, and diamond frame suggestions.
- Warby Parker style and frame-shape guides: public taxonomy of frame silhouettes such as rectangle, cat-eye, browline, round, oval, rimless, and full-rim.
- FramesDirect face-shape guide: balancing natural features, measuring forehead, cheekbones, jawline, and face length.
- LensCrafters / OPSM / Ray-Ban frame advisor pages: public description of matching by face shape, face size, facial features, style preferences, and physical traits.
- Clearly / Eyebuydirect public guides: consumer-facing examples of using frame shape to balance features, with reminders that these are guidelines.

## Rules Extracted For VisionID

- Do not present face-shape labels as the customer-facing conclusion.
- Convert geometry into direct advice:
  - soft or compact features -> add definition with rectangular, square-soft, browline, or cat-eye-light frames;
  - angular jaw -> soften with oval, round-medium, rimless, or thin rounded frames;
  - longer vertical proportion -> use frames with more lens height and avoid very flat, narrow lenses;
  - cheekbone-dominant width -> avoid frames that pinch at the cheekbone; use slightly wider frames and softer lower rims;
  - stronger upper-face signal -> avoid overly heavy browlines and oversized top-heavy frames;
  - wider jaw signal -> lift attention with browline, cat-eye-light, or upper-detail frames.
- Fit still outranks face-shape rules:
  - frame width should sit close to the widest facial point;
  - pupils should sit comfortably inside the lens, not too close to the bridge or edge;
  - top line should relate to the brow line without hiding expression;
  - bridge, nose pads, and temple pressure must be checked in person.

## Integration Notes

- Public sources are used as a starting prior.
- Store feedback from real DongDo Optic consultations as calibration data.
- As real consultation data grows, local feedback should outweigh public guide priors.
