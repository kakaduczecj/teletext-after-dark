# Requirements Document

## Introduction

This feature adds a fourth act to the existing Harbour case in *Teletext After Dark* (Merewick Relay). After the player selects the correct editorial conclusion ("Ready to air"), a machine packet arrives on the station's emergency override channel claiming that West Quay has priority. The player must cross-check two teletext frame payloads — the normal receiver feed and the independent archive — identify which two of three line fields were overwritten by the emergency packet, and select the correct channel to carry the correction. Only a successful ordered verification of both fields unlocks the final publish action. This act takes roughly 60–90 seconds to complete and must be playable by touch, keyboard, and readable text alone, with no reliance on audio, timing, color, or visual pattern.

The act is inserted between the existing "report/redraft" step (P793) and the existing "publish/broadcast" step. It does not add new top-level pages and does not alter P611, P672, or P747.

## Glossary

- **Packet**: A machine-generated data burst on the emergency override channel, carried as a structured text payload with deterministic field values and a parity checksum.
- **Receiver_Feed**: The normal teletext frame as displayed on the receiver screen, potentially overwritten by the emergency packet.
- **Archive_Feed**: The independent archival copy of the same teletext frame, unaffected by the override and therefore usable as a ground-truth reference.
- **Line_Fragment**: One of three distinct text segments within a teletext frame that the packet may overwrite. Each fragment maps to a named field (Field A, Field B, Field C).
- **Parity_Strip**: A short line-check sequence displayed beneath each Line_Fragment in the Archive_Feed, encoding a deterministic checksum that can be compared against the Receiver_Feed.
- **Field**: A named, selectable unit (Field A, Field B, Field C) corresponding to one Line_Fragment and its Parity_Strip.
- **Verification_Slot**: One of two ordered positions (Slot 1, Slot 2) the player must fill with a correctly identified Field to complete verification.
- **Packet_Channel**: The named broadcast channel (one of two options) the player must select to route the correction after field verification.
- **Verified_Draft**: The editorial conclusion state that becomes reachable only after both Verification_Slots are correctly filled and the Packet_Channel is correctly chosen.
- **Harbour_State**: The persistent save object under the `merewick.teletext.v2` localStorage key representing all Harbour case progress.
- **Cases_State**: The persistent save object under the `merewick.teletext.cases.v1` localStorage key for P611, P672, and P747.
- **Newsroom**: The editorial interface presented at P793 after all three evidence marks are decoded.
- **Stage**: An integer field in Harbour_State (values 0–5) that tracks the player's progress through the five acts; the new verification act occupies stage 4, shifting the former stage-4 "published" state to stage 5.
- **Packet_Checksum**: A single numeric value derived deterministically from the packet's field content using a fixed algorithm, used to identify which fields were tampered.
- **Verification_Workflow**: The complete interaction sequence of inspecting fragments, selecting two fields in order, and choosing the Packet_Channel.
- **False_Positive**: An apparently plausible but incorrect field selection (e.g., swapped order or wrong field pairing) that must be rejected with a specific reason.

## Requirements

### Requirement 1: Insert the Verification Act into the Harbour Story

**User Story:** As a player, I want a new act between selecting the correct editorial conclusion and broadcasting it, so that the story has an additional verification step that changes what is required to publish.

#### Acceptance Criteria

1. WHEN the player selects the correct editorial conclusion at P793, THE Newsroom SHALL present the Verification_Workflow instead of enabling the publish action directly.
2. WHILE the Verification_Workflow is incomplete, THE Newsroom SHALL keep the publish action disabled so that no UI sequence can trigger a broadcast.
3. WHEN the player completes the Verification_Workflow, THE Newsroom SHALL enable the publish action and display a visibly distinct "Verified draft" label.
4. THE Harbour_State SHALL record verification progress so that reloading the page restores the player's position within the Verification_Workflow without data loss.
5. WHEN the player resets the Harbour case, THE Harbour_State SHALL clear verification progress along with all other Harbour progress, returning stage to 0.

---

### Requirement 2: Display the Emergency Packet and Two Frame Payloads

**User Story:** As a player, I want to read both the normal receiver feed and the independent archive side by side, so that I can compare them to find the overwritten fields.

#### Acceptance Criteria

1. WHEN the Verification_Workflow starts, THE Newsroom SHALL display the emergency packet notice, the Receiver_Feed with three Line_Fragments, and the Archive_Feed with three matching Parity_Strips.
2. THE Newsroom SHALL present the Receiver_Feed and Archive_Feed in a layout accessible by keyboard navigation and usable on a touch screen at 360 px minimum viewport width.
3. WHEN the player switches language (EN ↔ CS), THE Newsroom SHALL display all Verification_Workflow labels, field names, channel names, notice text, and hint content in the selected language without resetting verification progress.
4. THE Newsroom SHALL allow the player to re-read the Receiver_Feed and Archive_Feed at any point during the Verification_Workflow without losing Verification_Slot selections already made.

---

### Requirement 3: Field Selection — Identify Two Overwritten Fields in Order

**User Story:** As a player, I want to select which two of the three fields were overwritten by the packet, in the correct order, so that I can prove I understand the tampered content.

#### Acceptance Criteria

1. THE Newsroom SHALL present three selectable Fields (A, B, C), each linked to a Line_Fragment and its Parity_Strip.
2. WHEN the player selects a Field, THE Newsroom SHALL place it in the next empty Verification_Slot and display the selection visibly.
3. WHEN the player selects a Field that is already in a Verification_Slot, THE Newsroom SHALL remove it from that slot and return the slot to empty.
4. WHEN both Verification_Slots are filled with the two correct Fields in the correct order, THE Newsroom SHALL record the slot selections as valid and allow the player to proceed to Packet_Channel selection.
5. IF the player fills both Verification_Slots with a plausible but incorrect combination (wrong field or wrong order), THEN THE Newsroom SHALL reject the attempt with a specific reason explaining why that pair is wrong, and SHALL leave the draft intact and the LIVE feed unmodified.
6. IF the player fills both Verification_Slots with any combination that does not match the unique valid pair, THEN THE Newsroom SHALL reject the attempt and leave the LIVE feed unmodified.
7. THE Verification_Workflow SHALL provide at most one valid ordered field pair; there SHALL be no alternative correct answer.

---

### Requirement 4: Packet Checksum — Deterministic and Unit-Testable Logic

**User Story:** As a developer, I want the packet field content and checksum rules implemented as self-contained, deterministic functions, so that the correctness of field identification can be proven in automated tests.

#### Acceptance Criteria

1. THE Packet SHALL expose a pure function that, given field values, computes the Packet_Checksum deterministically without reading DOM state or localStorage.
2. THE Packet SHALL expose a pure function that identifies which two Fields are overwritten given the Receiver_Feed values and Archive_Feed values.
3. WHEN the same field inputs are provided, THE Packet checksum function SHALL return the same output on every invocation (no randomness, no time-dependence).
4. FOR ALL valid ordered field pairs (Slot 1, Slot 2), THE Packet logic SHALL prove that each pair is unique — no two different field combinations produce a passing verification.
5. THE Packet logic SHALL be separable from rendering code so that tests/smoke.mjs can exercise it without a DOM.

---

### Requirement 5: Channel Selection — Route the Correction

**User Story:** As a player, I want to choose which channel carries the correction after identifying the overwritten fields, so that the final step requires a deliberate routing decision.

#### Acceptance Criteria

1. WHEN both Verification_Slots are validly filled, THE Newsroom SHALL present two named Packet_Channel options.
2. WHEN the player selects the correct Packet_Channel, THE Newsroom SHALL mark the Verification_Workflow as complete and display the "Verified draft" state.
3. WHEN the player selects the incorrect Packet_Channel, THE Newsroom SHALL reject the selection, leave the LIVE feed unmodified, and allow the player to try again without losing Verification_Slot selections.
4. WHEN the Verification_Workflow is complete, THE Harbour_State SHALL record the chosen channel so that it is restored on reload.

---

### Requirement 6: Publish Gate — Verification Must Precede Broadcast

**User Story:** As a player, I want the broadcast action to be unavailable until I have completed verification, so that having the editorial draft alone is not sufficient to publish.

#### Acceptance Criteria

1. WHILE the Verification_Workflow is incomplete, THE Newsroom SHALL hide or disable the publish action with no reachable workaround via any UI sequence.
2. WHEN the Verification_Workflow is complete, THE Newsroom SHALL display the publish action in a visibly distinct state from the unverified draft.
3. WHEN the player triggers the publish action after verification, THE Newsroom SHALL transition to the final on-air state, identical to the existing broadcast outcome (the "All aboard" / "Všichni na palubě" ending).
4. THE Archive_Feed preimage of P214 SHALL remain byte-identical before and after publication; THE Newsroom SHALL never modify the archived text.

---

### Requirement 7: Compatibility with Existing Saves and Reset

**User Story:** As a returning player, I want my existing v0.2 and v0.3 Harbour saves handled gracefully, and my other case saves left untouched, so that upgrading does not break my progress.

#### Acceptance Criteria

1. WHEN a Harbour_State saved under a pre-verification version (stage 4 "published" flag set) is loaded, THE Newsroom SHALL treat it as already published and display the final on-air state without requiring re-verification.
2. WHEN a Harbour_State with stage less than 4 is loaded (draft or redraft), THE Newsroom SHALL require the player to complete the Verification_Workflow before publishing.
3. THE Cases_State object SHALL remain unmodified by the Verification_Workflow; P611, P672, and P747 SHALL show no change in behavior or storage.
4. WHEN localStorage is unavailable or throws, THE Newsroom SHALL continue to function in-session, completing the Verification_Workflow and accepting publication without storing or reading any state.
5. WHEN the player resets the Harbour case and confirms, THE Harbour_State SHALL be cleared entirely, resetting to the initial P100 state.

---

### Requirement 8: Hints and In-Game Documentation

**User Story:** As a player who is stuck, I want layered hints and concise in-game documentation for the Verification_Workflow, so that I can understand what to do without external help.

#### Acceptance Criteria

1. THE Newsroom SHALL display a brief inline task description explaining what the Verification_Workflow requires, visible without opening any modal.
2. WHEN the player opens the hint dialog during the Verification_Workflow, THE Newsroom SHALL display a first-level hint that describes the comparison method (examining Parity_Strips against Line_Fragments) without naming the correct fields.
3. WHEN the player requests a second-level hint within the same hint dialog session, THE Newsroom SHALL display a more specific hint indicating which aspect of the parity pattern to focus on, without directly naming the correct answer.
4. WHEN the player switches language, THE Newsroom SHALL display all hints in the selected language.

---

### Requirement 9: Accessibility and Input Coverage

**User Story:** As a player on mobile or keyboard, I want to complete the full Verification_Workflow without a mouse, so that the game remains accessible on all supported input methods.

#### Acceptance Criteria

1. THE Newsroom SHALL make every Verification_Workflow action — field selection, slot management, channel selection, hint access, and publication — reachable by keyboard alone using Tab, Enter, and Space.
2. THE Newsroom SHALL make every Verification_Workflow action reachable by touch on a 360 px wide viewport.
3. THE Newsroom SHALL not require the player to distinguish fields by color, visual pattern, audio cue, or time-sensitive reaction; all information SHALL be conveyed by readable text and structure.

---

### Requirement 10: Test Coverage

**User Story:** As a developer, I want automated tests that prove the verification logic, false-positive rejection, storage compatibility, and bilingual behavior, so that regressions are caught without a browser.

#### Acceptance Criteria

1. THE smoke test SHALL verify that before verification is complete, no programmatic call to the publish action changes the LIVE feed or the Harbour_State stage.
2. THE smoke test SHALL verify that a swapped-field pair (correct fields, wrong order) is rejected with a specific reason distinct from an entirely wrong-field rejection.
3. THE smoke test SHALL verify that a wrong-field pair (one or both fields incorrect) is rejected.
4. THE smoke test SHALL verify that the full Verification_Workflow — selecting correct fields in order, choosing the correct channel, then publishing — produces the final on-air state.
5. THE smoke test SHALL verify that progress (partial slot selections, completed verification) survives a simulated reload via receiver construction from stored memory.
6. THE smoke test SHALL verify that an existing completed Harbour save (stage 4 published) is replayed correctly and displays the final on-air state without requiring re-verification.
7. THE smoke test SHALL verify that Cases_State is unchanged after the entire Harbour Verification_Workflow completes.
8. THE smoke test SHALL prove that each valid ordered field pair is unique — that iterating all ordered permutations of the three fields yields exactly one passing pair.
