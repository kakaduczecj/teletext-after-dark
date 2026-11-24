# Implementation Plan: Emergency Broadcast Verification

## Overview

Implements the fourth act of the Harbour case inside `index.html`. All changes are confined to the single `<script>` tag and `<style>` block of `index.html`, plus eight new test cases appended to `tests/smoke.mjs`. No new files, no build step, no external dependencies.

The implementation follows eight sequential phases. Each phase builds on the previous one and ends in a testable state. Phases 1 and 8 (pure logic and smoke tests) are required; hints (Phase 6) are optional polish.

---

## Tasks

- [x] 1. Add the four pure packet-logic functions to `index.html`
  - Open the `<script>` block and, **before any rendering or event-handling code**, add the four pure functions exactly as specified in the design's "Pure Function Signatures and Logic" section: `fieldChecksum(str)`, `packetChecksum(a, b, c)`, `identifyTamperedFields(rcv, arch)`, `verifySlots(slot1, slot2)`, and `verifyChannel(channel)`.
  - Each function must read no DOM state, no `localStorage`, and no module-level mutable variables.
  - `verifySlots` must return `{valid, reason}` with reason values `'correct'`, `'order'`, and `'field'` exactly as specified.
  - Expose all five functions at module scope so `tests/smoke.mjs` can call them via `t.run('verifySlots(...)')`.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 1.1 Write property test for `verifySlots` uniqueness (Property 4)
    - **Property 4: Unique valid slot pair**
    - Enumerate all six ordered pairs from `{A, B, C}` via `t.run(...)` and assert exactly one passes `verifySlots`.
    - **Validates: Requirements 3.7, 4.4**

  - [ ]* 1.2 Write property test for `packetChecksum` determinism (Property 5)
    - **Property 5: Checksum determinism**
    - Call `packetChecksum` twice with the same arguments via `t.run(...)` and assert both return the same integer.
    - **Validates: Requirements 4.1, 4.3**

- [x] 2. Extend the state model in `blank()` and `read()`
  - In `blank()`: add `slots: [], channel: null` to the returned state object.
  - In `read()`: at the end of the existing `try` block, add the slot/channel restoration logic from the design's "Save/Load Compatibility" section — filter `rawSlots` to valid field names, slice to 2, trust `channel` only when `slots` are complete and pass `verifySlots`, fall back to `[]` / `null` on any corrupt data.
  - `persist()` requires no change (new fields serialize automatically).
  - Verify that the five migration-table rows in the design produce the correct resulting state.
  - _Requirements: 1.4, 5.4, 7.1, 7.2, 7.4_

  - [ ]* 2.1 Write property test for slot round-trip persistence (Property 2)
    - **Property 2: Slot round-trip persistence**
    - For each partial and complete valid `slots` value (`[]`, `['B']`, `['B','C']`) simulate a save and reload via `receiver(memory)` and assert `s.slots` is restored identically.
    - **Validates: Requirements 1.4, 5.4**

- [x] 3. Add the `verificationComplete()` helper and gate `publishCorrection()`
  - Add the `verificationComplete()` function exactly as specified: returns true only when `s.draft && s.slots.length === 2 && verifySlots(s.slots[0], s.slots[1]).valid && verifyChannel(s.channel)`.
  - In `publishCorrection()`, add `if (!verificationComplete()) return;` as the first guard after the existing guards.
  - Confirm the existing smoke-test sequence (which calls `publish` after `redraft`) still passes — that path will now require verification before it can proceed, so update the expectation if needed, or confirm the existing test still exercises the right control flow.
  - _Requirements: 1.2, 6.1, 6.3_

  - [ ]* 3.1 Write property test for the publish gate (Property 1)
    - **Property 1: Publish gate**
    - For any Harbour state where `draft === true` and `verificationComplete()` is false, assert that calling `act('publish')` leaves `s.won === false` and leaves the P214 LIVE feed unchanged.
    - **Validates: Requirements 1.2, 6.1**

- [x] 4. Checkpoint — Existing smoke tests must still pass
  - Run `node tests/smoke.mjs` and confirm all pre-existing `PASS` lines are printed without error.
  - No new test cases are added yet; this checkpoint validates that Phases 1–3 have not broken existing game logic.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add `pickSlot`, `pickChannel`, and `verifyReset` to the `act()` dispatcher
  - Add three new `case` branches to the `act()` switch statement, following the pseudocode in the design's "New Action Handlers" section precisely:
    - `pickSlot`: toggle field in/out of `s.slots`, evaluate when two slots are filled, call `tell()` with the correct rejection or confirmation message, call `tone()` with the specified frequency, clear `s.slots` on rejection.
    - `pickChannel`: guard on valid slot state, reject `SR-2` with the specified message, accept `EO-7` by setting `s.channel`, call `tone(480)`.
    - `verifyReset`: clear `s.slots` and `s.channel`, call `tell()` with the cleared message.
  - All EN and CS strings must match the bilingual strings table in the design exactly.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3_

  - [ ]* 5.1 Write property test for invalid slot pair rejection (Property 3)
    - **Property 3: Invalid slot pair rejection preserves state**
    - For every ordered pair where `verifySlots` returns false, assert that after the pair is submitted `s.won === false`, the LIVE feed is unchanged, and `s.slots` is `[]`.
    - **Validates: Requirements 3.6, 6.1**

- [x] 6. Add the two new render functions and update the `lastPage()` branch tree
  - Add `verificationPage()` producing the HTML structure from the design: eyebrow, title, inline task description, two-panel layout (receiver feed buttons + archive parity display), slot display, conditional channel-selection buttons, and "Clear slots" reset link. Use the existing `btn()` helper and `L(en, cs)` pattern throughout.
  - Add `verifiedDraftPage()` producing the verified-draft state: eyebrow, title, lead paragraph, blockquote, enabled publish button, and redraft link.
  - Update the `lastPage()` / `correctionPage()` branch: add the `verificationComplete()` fork that routes to `verifiedDraftPage()` and the `!verificationComplete()` fork that routes to `verificationPage()`, leaving the `s.won` → `endingPage()` and `reportPage()` paths unchanged.
  - Set `aria-pressed` on `pickSlot` buttons when their field is in `s.slots`.
  - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.4, 3.1, 3.2, 3.4, 5.1, 5.2, 6.2, 9.1, 9.2, 9.3_

  - [ ]* 6.1 Write property test for archive feed immutability (Property 6)
    - **Property 6: Archive feed immutability through publication**
    - Capture P214 archive innerHTML before the full verification-then-publish sequence and assert it equals the innerHTML captured after publication.
    - **Validates: Requirements 6.4**

  - [ ]* 6.2 Write property test for language switch preserving slots (Property 8)
    - **Property 8: Language switch preserves slots**
    - For each partial slot state, switch language and assert `s.slots` is unchanged and all labels appear in the new language.
    - **Validates: Requirements 2.3**

- [x] 7. Add the small CSS additions for the two-panel layout
  - Inside the existing `<style>` block, add the following rules:
    - `.verifyPanels`: `display:grid; grid-template-columns:1fr 1fr; gap:14px` with a media query or breakpoint rule that falls back to `display:block` below 360 px.
    - `.verifyPanel`: no-shrink container (inherits from grid cell).
    - `.slotRow`: flex row with gap for the two slot boxes.
    - `.slotBox`: inline-block box styled consistently with existing module elements.
  - Confirm the layout does not break existing pages by reviewing the `verifyPanels` class is scoped to the new markup only.
  - _Requirements: 2.2, 9.2_

- [x] 8. Checkpoint — Full rendering and action flow passes
  - Run `node tests/smoke.mjs` and confirm all pre-existing `PASS` lines still print.
  - Manually trace through the control flow for the full verification path: `pickSlot('B')` → `pickSlot('C')` → `pickChannel('EO-7')` → `publish` to confirm the state machine transitions match the stage diagram.
  - Ensure all tests pass, ask the user if questions arise.

- [x]* 9. Extend `hints()` with the two-level verification hints
  - Locate the P793 `hints()` branch and add the sub-branch described in the design's "Hints Integration" section: when `s.draft && !verificationComplete()`, return the two-element hints array with the comparison-method hint (level 1) and the quay/count-specifics hint (level 2) in both EN and CS.
  - Leave the existing editorial hints (shown when `!s.draft`) completely unchanged.
  - The existing `moreHint` action already advances `hintLevel`; no structural changes to that path are needed.
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. Append the eight new smoke-test cases to `tests/smoke.mjs`
  - Append all eight test blocks from the design's "Smoke Test Additions" section **after** the existing `console.log('PASS: v0.3 ...')` line, verbatim.
  - The appended tests cover: publish gate (Test 1), swapped-field rejection (Test 2), wrong-field rejection (Test 3), full correct flow (Test 4), partial slot reload persistence (Test 5), old `won:true` save compatibility (Test 6), Cases_State isolation (Test 7), and pair-uniqueness proof (Test 8).
  - Confirm the final `console.log('PASS: v0.4 ...')` line is present.
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ]* 10.1 Run the full smoke suite and verify all PASS lines print
    - Execute `node tests/smoke.mjs` and assert both `PASS: v0.3 ...` and `PASS: v0.4 ...` are printed with no assertion errors.
    - **Validates: Requirements 10.1–10.8**

- [x] 11. Final checkpoint — Full suite green, feature complete
  - Run `node tests/smoke.mjs`; confirm both `PASS` lines appear.
  - Spot-check the Cases_State isolation: start any v0.3 case (P611, P672, or P747), confirm its state is unaffected by all Harbour verification state changes performed in earlier tasks.
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; the unlabelled tasks are the minimum set required to ship the feature.
- Every task references specific requirements for traceability.
- Property tests (1.1, 1.2, 2.1, 3.1, 5.1, 6.1, 6.2) validate universal correctness properties; unit-style tests are inside the Phase 8 smoke-test cases.
- The `t.run(src)` helper already available in `tests/smoke.mjs` executes arbitrary JS in the game's VM context, making all pure-function and state-enumeration properties testable without additional infrastructure.
- Checkpoints (Tasks 4, 8, 11) ensure no phase silently breaks pre-existing behavior.
- Hints (Task 9) are marked optional because the game is completable without them; they are polish, not gate logic.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["4"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["6.1", "6.2", "7"] },
    { "id": 5, "tasks": ["8"] },
    { "id": 6, "tasks": ["9", "10.1"] },
    { "id": 7, "tasks": ["11"] }
  ]
}
```

<!-- Wave rationale:
  Wave 0: Pure-function property tests (1.1, 1.2) — depend only on Task 1 (pure functions), which is the first implementation step.
  Wave 1: State-model property test (2.1) and publish-gate property test (3.1) — depend on Tasks 2 and 3 respectively.
  Wave 2: Checkpoint 4 — must follow Tasks 1–3.
  Wave 3: Action-handler property test (5.1) — depends on Task 5 (action dispatcher).
  Wave 4: Render property tests (6.1, 6.2) and CSS task (7) — depend on Task 6 (rendering).
  Wave 5: Checkpoint 8 — must follow Tasks 5–7.
  Wave 6: Hints (9) and smoke-test uniqueness run (10.1) — both depend on the full implementation being in place.
  Wave 7: Final checkpoint 11 — depends on everything above.
-->
