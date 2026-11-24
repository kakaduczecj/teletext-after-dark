# Design Document

## Overview

The emergency-broadcast-verification feature adds a fourth act to the Harbour case in *Teletext After Dark* (Merewick Relay). It sits between the existing "editorial conclusion" step (P793 / `s.draft = true`) and the existing publish step (`s.won = true`). The player must cross-check a machine-generated emergency packet against two teletext frame payloads, identify two tampered fields in the correct order, and choose the correct broadcast channel before the publish action becomes available.

The entire feature lives inside `index.html` with no new files, no external dependencies, and no build step. All new logic, rendering, and bilingual strings are inline in the existing `<script>` tag. The smoke test (`tests/smoke.mjs`) is extended with eight new test cases appended after the existing ones.

---

## Architecture

The feature is a pure in-script extension of the existing Harbour case state machine. No new top-level pages are added. The existing `lastPage()` / `correctionPage()` rendering tree at P793 gains two new sub-branches; the `act()` dispatcher gains three new cases (`pickSlot`, `pickChannel`, `verifyReset`); four pure helper functions are added for testability; and the `read()` and `blank()` state initializers are updated to handle the new sub-fields.

### Component boundaries

```
index.html <script>
├── State (s object, read/persist)
│   └── NEW: s.slots, s.channel
├── Pure packet logic (no DOM access)
│   ├── packetChecksum(a, b, c) → number
│   ├── identifyTamperedFields(rcv, arch) → string[]
│   ├── verifySlots(slot1, slot2) → {valid, reason}
│   └── verifyChannel(channel) → boolean
├── Rendering (lastPage → correctionPage → verificationPage)
│   └── NEW: verificationPage()
└── Action dispatcher (act)
    ├── NEW: case 'pickSlot'
    ├── NEW: case 'pickChannel'
    └── NEW: case 'verifyReset'
```

### Stage transition diagram

```
stage 0 (blank / evidence gathering)
  │
  │  found.length === 3
  ▼
stage 3 (all evidence recovered, P793 available)
  │
  │  act('report', '1')  → draftCorrection()
  ▼
s.draft = true, s.slots = [], s.channel = null
(Verification_Workflow begins — publish DISABLED)
  │
  │  pickSlot × 2 (correct fields in correct order)
  ▼
s.slots = ['B','C']  (channel selection unlocked)
  │
  │  pickChannel('EO-7')
  ▼
s.slots = ['B','C'], s.channel = 'EO-7'
(Verification complete — Verified draft — publish ENABLED)
  │
  │  act('publish')  → publishCorrection()
  ▼
s.won = true, s.draft = false
(Final on-air state: "All aboard" / "Všichni na palubě")
```

**Legacy compatibility transitions:**

| Loaded save condition | Resulting state |
|---|---|
| `s.won === true` (old stage 5) | Show "All aboard" immediately — no re-verification |
| `s.draft === true`, no `slots` key | Start Verification_Workflow fresh (`s.slots = []`, `s.channel = null`) |
| `s.draft === true`, `slots` valid | Restore slot state from storage |
| `s.draft === true`, `channel` valid | Restore completed verification state |

---

## Components and Interfaces

### 1. State shape (`merewick.teletext.v2`)

The existing `s` object gains two new optional fields under the draft sub-state:

```js
// Existing fields (unchanged):
{
  lang: 'en' | 'cs',
  page: string,
  found: string[],       // evidence page keys collected
  won: boolean,          // published (old "stage 5")
  draft: boolean,        // editorial conclusion selected (old "stage 4")
  started: boolean,
  map: { turn, x, y, layer }
}

// New fields (present only when draft === true):
{
  slots: string[],       // ordered field names in slots, e.g. [] | ['B'] | ['B','C']
  channel: string|null   // 'EO-7' | null
}
```

**Invariants:**
- `slots` is `[]`, `['B']`, `['C']`, `['A']`, `['B','C']`, or any two-element subset of `['A','B','C']`.
- `channel` is non-null only when `slots.length === 2` and `verifySlots(slots[0], slots[1]).valid` is true.
- When `won === true`, `slots` and `channel` are ignored (the old save format where `won === true` before this feature is treated identically).

### 2. `blank()` and `read()` changes

**`blank()`**: Add `slots: [], channel: null` to the returned object.

**`read()`**: After the existing validation logic, add:
```js
// Restore slots: only if draft is true, slots is a valid array
if (a.draft) {
  const rawSlots = x.slots;
  a.slots = Array.isArray(rawSlots)
    ? rawSlots.filter(v => ['A','B','C'].includes(v)).slice(0, 2)
    : [];
  // channel: only trust if slots are complete and valid
  const slotsValid = a.slots.length === 2 && verifySlots(a.slots[0], a.slots[1]).valid;
  a.channel = slotsValid && x.channel === 'EO-7' ? 'EO-7' : null;
} else {
  a.slots = [];
  a.channel = null;
}
```

This means an old save with `draft: true` but no `slots` key cleanly starts the workflow from scratch.

### 3. `persist()` changes

The existing `persist()` call writes `s` to localStorage. Because `s` now contains `slots` and `channel`, no changes to `persist()` are needed — the new fields are serialized automatically as part of `JSON.stringify(s)`.

---

## Data Models

### Packet content (deterministic, bilingual)

The packet contains three line fragments. Field A is **unmodified** (receiver matches archive). Fields **B and C are tampered**: the receiver feed shows overwritten values for both. The correct verification order is Slot 1 = B (the route-critical tampering), Slot 2 = C (the passenger-count tampering). `verifySlots('B','C')` returns `{valid:true, reason:'correct'}`; `verifySlots('C','B')` returns `{valid:false, reason:'order'}`.

#### Archive feed (true values)

| Field | EN content | CS content |
|---|---|---|
| A | `Departure time: 23:28` | `Čas odjezdu: 23:28` |
| B | `Departure quay: East Steps` | `Molo odjezdu: Východní schody` |
| C | `Passenger count: 5` | `Počet osob: 5` |

#### Receiver feed (tampered values)

| Field | EN content | CS content | Changed? |
|---|---|---|---|
| A | `Departure time: 23:28` | `Čas odjezdu: 23:28` | No |
| B | `Departure quay: West Quay` | `Molo odjezdu: West Quay` | **YES** |
| C | `Passenger count: 12` | `Počet osob: 12` | **YES** |

**Rationale for this pair:** The emergency packet claims "West Quay" has priority (matching the storyline's false claim) and inflates the passenger count to 12 to make the route seem implausible. The archive shows the true quay (East Steps, consistent with the established story) and the true count (5, the five rescued residents). Both changed fields are semantically meaningful and narrative-consistent.

**Why B then C (not C then B):** The packet's parity strip for B shows the archive quay checksum; comparing against the receiver's B value identifies B as tampered first. Field C shows a changed count. The correct verification order is Slot 1 = B (the route-critical tampering), Slot 2 = C (the count tampering). Swapping produces reason `'order'`.

#### Parity strips (per-field checksum algorithm)

Each parity strip is the **sum of all char codes in the archive field string, modulo 256**, displayed as two-digit hex:

```js
function fieldChecksum(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  return sum % 256;
}
```

The archive panel shows each field's `fieldChecksum` as `0xNN`. The receiver panel shows the raw text of each field. The player detects tampering by computing (mentally or by inspection) that the receiver text for fields B and C does not match the parity shown in the archive.

> The game does not require the player to do arithmetic. The parity strip is presented as a short hex value that the player can verify by looking at a reference table displayed inline. The comparison is intuitive: archive field B reads "0x`nn`" and the legend shows what `0x`nn` decodes to — the player sees the mismatch because receiver B says "West Quay" while archive B's checksum annotates "East Steps."

#### Combined packet checksum

```js
function packetChecksum(a, b, c) {
  // a, b, c are the RECEIVER feed string values for fields A, B, C
  return (fieldChecksum(a) + fieldChecksum(b) + fieldChecksum(c)) % 256;
}
```

This combined checksum is shown at the top of the packet notice. It encodes the tampered receiver state; the archive's corresponding combined value differs, flagging that at least one field was overwritten.

#### Channels

| ID | EN label | CS label | Correct? |
|---|---|---|---|
| `EO-7` | Emergency Override — Channel 7 | Nouzový kanál — Kanál 7 | **Yes** |
| `SR-2` | Standard Relay — Channel 2 | Standardní relé — Kanál 2 | No |

---

## Pure Function Signatures and Logic

All four functions are defined in the `<script>` block before any rendering or event-handling code. They read no DOM state, no `localStorage`, and no module-level mutable variables.

### `fieldChecksum(str)`

```js
function fieldChecksum(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  return sum % 256;
}
```

Returns an integer 0–255. Used to compute archive parity strips and to populate `identifyTamperedFields`.

### `packetChecksum(a, b, c)`

```js
function packetChecksum(a, b, c) {
  return (fieldChecksum(a) + fieldChecksum(b) + fieldChecksum(c)) % 256;
}
```

Arguments are the receiver feed string values for fields A, B, C. Returns integer 0–255. No DOM, no side effects. Exposed at module scope so `tests/smoke.mjs` can call `t.run('packetChecksum(...)')`.

### `identifyTamperedFields(rcv, arch)`

```js
// rcv = { A: string, B: string, C: string }  — receiver values
// arch = { A: string, B: string, C: string } — archive values
// returns array of field names that differ, in canonical order ['B','C']
function identifyTamperedFields(rcv, arch) {
  return ['A','B','C'].filter(k => fieldChecksum(rcv[k]) !== fieldChecksum(arch[k]));
}
```

For the fixed game content this always returns `['B','C']`. Exposed for smoke test verification.

### `verifySlots(slot1, slot2)`

```js
// Returns { valid: boolean, reason: string }
// reason values:
//   'correct'  — both correct fields in correct order
//   'order'    — correct fields but wrong order (C before B)
//   'field'    — at least one field is not among the tampered fields
function verifySlots(slot1, slot2) {
  const tampered = ['B', 'C'];
  const bothTampered = tampered.includes(slot1) && tampered.includes(slot2);
  if (!bothTampered) return { valid: false, reason: 'field' };
  if (slot1 === 'B' && slot2 === 'C') return { valid: true,  reason: 'correct' };
  // Both tampered but swapped
  return { valid: false, reason: 'order' };
}
```

### `verifyChannel(channel)`

```js
function verifyChannel(channel) {
  return channel === 'EO-7';
}
```

---

## Rendering Logic

### `lastPage()` branch tree (updated)

```
lastPage()
├── s.won === true  →  endingPage()       ("All aboard")
├── s.draft === true
│   ├── verificationComplete()  →  verifiedDraftPage()   ("Verified draft" + publish)
│   └── !verificationComplete() →  verificationPage()    (Verification_Workflow)
└── neither  →  reportPage()             (editorial conclusion selection)
```

Where:
```js
function verificationComplete() {
  return s.draft && s.slots.length === 2
    && verifySlots(s.slots[0], s.slots[1]).valid
    && verifyChannel(s.channel);
}
```

### `verificationPage()` — HTML structure

```html
<!-- Eyebrow + title -->
<div class="eyebrow">23:59 / EMERGENCY OVERRIDE</div>
<h1 class="pagetitle">Cross-check the packet</h1>

<!-- Inline task description (always visible, Req 8.1) -->
<p class="task">
  An emergency packet has overwritten two fields in the receiver feed.
  Compare each field against its archive parity strip. Select the two
  tampered fields in the order they appear — route first, then count.
  Then choose the correct channel to route the correction.
</p>

<!-- Two-panel layout: Receiver feed | Archive feed -->
<div class="verifyPanels">
  <div class="verifyPanel">
    <div class="moduleTitle">RECEIVER FEED</div>
    <div class="clueRows">
      <!-- For each field A, B, C: -->
      <button class="clueRow" data-do="pickSlot" data-val="A"
              aria-pressed="[true if A is in s.slots]">
        <span class="ln">A</span>
        <span class="pair">[receiver value for A]</span>
      </button>
      <!-- ... B and C likewise ... -->
    </div>
  </div>
  <div class="verifyPanel">
    <div class="moduleTitle">ARCHIVE PARITY</div>
    <div class="clueRows">
      <!-- For each field A, B, C (non-interactive): -->
      <div class="clueRow" aria-disabled="true">
        <span class="ln">A</span>
        <span class="pair">[archive value for A]
          <small>0x[hex of fieldChecksum(archiveA)]</small>
        </span>
      </div>
      <!-- ... B and C likewise ... -->
    </div>
  </div>
</div>

<!-- Slot display -->
<div class="moduleTitle">VERIFICATION SLOTS</div>
<div class="slotRow">
  <span class="slotBox">Slot 1: [s.slots[0] or '—']</span>
  <span class="slotBox">Slot 2: [s.slots[1] or '—']</span>
</div>

<!-- Channel selection (shown only when slots.length === 2 AND verifySlots passes) -->
[if slotsValid]
<div class="moduleTitle">PACKET CHANNEL</div>
<div class="answers">
  <button class="answer" data-do="pickChannel" data-val="EO-7">EO-7 › Emergency Override — Channel 7</button>
  <button class="answer" data-do="pickChannel" data-val="SR-2">SR-2 › Standard Relay — Channel 2</button>
</div>
[/if]

<!-- Reset link and re-read affordance -->
<button class="inline" data-do="verifyReset">Clear slots and start over</button>
```

**CSS note:** The `verifyPanels` div uses `display:grid; grid-template-columns: 1fr 1fr; gap: 14px` on viewports ≥ 360 px and `display:block` with stacking below that threshold. This follows the same responsive pattern as the existing `.two` grid. No new CSS classes are strictly required beyond `verifyPanels`, `verifyPanel`, and `slotRow` / `slotBox` — all are small additions to the existing `<style>` block.

### `verifiedDraftPage()` — HTML structure

```html
<!-- Eyebrow + title -->
<div class="eyebrow">23:59 / EDITORIAL OVERRIDE — VERIFIED</div>
<h1 class="pagetitle">Verified draft</h1>

<!-- Summary of what was confirmed -->
<p class="lead">
  The tampered fields have been identified and the channel locked.
  The correction is ready to broadcast.
</p>
<blockquote class="quote">
  CORRECTION / THE LITTLE WREN TURNED BACK.
  FIVE RESIDENTS WERE TAKEN ABOARD AT THE EAST STEPS.
</blockquote>

<!-- Publish button (enabled, visually distinct amber action) -->
<button class="action" data-do="publish">Broadcast correction</button>
<button class="inline"  data-do="redraft">Return to review</button>
```

### `draftCorrection()` changes

Add initialization of new fields after setting `s.draft = true`:
```js
s.slots = s.slots || [];   // preserve any in-progress slots (reload case)
s.channel = s.channel || null;
```

### `publishCorrection()` changes

Add verification gate:
```js
function publishCorrection() {
  if (s.page !== '793' || !s.draft || s.found.length !== 3 || s.won) return;
  if (!verificationComplete()) return;  // NEW GATE
  s.won = true;
  s.draft = false;
  // s.slots and s.channel left as-is (not needed after publication)
  render();
  tone(660);
  tell(L('ON AIR. P214 LIVE now carries the correction. P214 ARCHIVE remains untouched.',
         'VE VYSÍLÁNÍ. P214 ŽIVĚ teď obsahuje opravu. ARCHIV P214 zůstal nedotčený.'));
  $('page').focus({ preventScroll: true });
}
```

---

## New Action Handlers

### `pickSlot(val)` — `val` is `'A'` | `'B'` | `'C'`

```js
case 'pickSlot':
  if (!s.draft || verificationComplete() || s.won) return;
  if (s.slots.includes(v)) {
    // Deselect: remove from wherever it sits
    s.slots = s.slots.filter(x => x !== v);
  } else if (s.slots.length < 2) {
    s.slots = [...s.slots, v];
  }
  // If two slots are now filled, evaluate immediately
  if (s.slots.length === 2) {
    const { valid, reason } = verifySlots(s.slots[0], s.slots[1]);
    if (!valid) {
      const msg = reason === 'order'
        ? L('Sequence rejected: those fields were tampered but the order does not match the packet timeline. The route field comes first.',
            'Pořadí odmítnuto: tato pole byla přepsána, ale pořadí neodpovídá časové linii paketu. Nejprve patří pole s trasou.')
        : L('Pair rejected: at least one of these fields matches the archive. Only overwritten fields unlock the channel.',
            'Dvojice odmítnuta: alespoň jedno z těchto polí odpovídá archivu. Kanál odemknou pouze přepsaná pole.');
      tell(msg);
      tone(110);
      s.slots = [];  // clear and let player retry
    } else {
      tell(L('Both fields confirmed. Select the broadcast channel.',
             'Obě pole potvrzena. Zvol vysílací kanál.'));
      tone(380);
    }
  }
  render();
  break;
```

### `pickChannel(val)` — `val` is `'EO-7'` | `'SR-2'`

```js
case 'pickChannel':
  if (!s.draft || s.won) return;
  if (s.slots.length !== 2 || !verifySlots(s.slots[0], s.slots[1]).valid) return;
  if (!verifyChannel(v)) {
    tell(L('Channel rejected: SR-2 is the standard relay and cannot carry an emergency override. Use EO-7.',
           'Kanál odmítnut: SR-2 je standardní relé a nouzový přepis přenést nemůže. Použij EO-7.'));
    tone(110);
    return;
  }
  s.channel = v;
  tell(L('Channel locked. The verified draft is ready to broadcast.',
         'Kanál uzamčen. Ověřený koncept je připraven k vysílání.'));
  tone(480);
  render();
  break;
```

### `verifyReset()`

```js
case 'verifyReset':
  if (!s.draft || s.won) return;
  s.slots = [];
  s.channel = null;
  tell(L('Slots cleared. Re-read the feeds and select two fields.',
         'Sloty vymazány. Znovu přečti přenosy a vyber dvě pole.'));
  render();
  break;
```

---

## Hints Integration

The existing `hints()` function dispatches on `s.page`. The P793 branch gains a new sub-branch for the verification act:

```js
if (s.page === '793') {
  if (!s.draft) {
    // existing editorial hints (unchanged)
    return [L('Read the three fragments...', '...'), L('The boat turned back...', '...')];
  }
  if (!verificationComplete()) {
    // NEW: Verification_Workflow hints (Req 8.2 and 8.3)
    return [
      L('Compare each field in the receiver feed against its parity strip in the archive. Two fields show a different value than their strip predicts.',
        'Porovnej každé pole přijímače s paritním řetězcem v archivu. Dvě pole mají jinou hodnotu, než předpovídá jejich strip.'),
      L('The first tampered field names a quay. The second changes a passenger count. Select the quay field first, then the count field.',
        'První přepsané pole uvádí molo. Druhé mění počet osob. Vyber nejprve pole s molem, pak pole s počtem.')
    ];
  }
  // Already verified — no hint needed; fall through to default
}
```

The existing `moreHint` action (triggered inside the modal) already advances `hintLevel` and shows the second element. No structural changes to `moreHint` are needed.

---

## Save/Load Compatibility

### Reading old saves

The `read()` function already validates individual fields with `typeof` and membership checks. The new logic runs only when `a.draft === true` and is safe to add after the existing validation block:

```js
// Add at end of try block in read(), after existing validation:
if (a.draft) {
  const rawSlots = Array.isArray(x.slots) ? x.slots : [];
  a.slots = rawSlots.filter(v => ['A','B','C'].includes(v)).slice(0, 2);
  const slotsComplete = a.slots.length === 2 && verifySlots(a.slots[0], a.slots[1]).valid;
  a.channel = slotsComplete && x.channel === 'EO-7' ? 'EO-7' : null;
} else {
  a.slots = [];
  a.channel = null;
}
```

### Migration table

| Old save JSON | `a.won` | `a.draft` | `a.slots` | `a.channel` | Displayed state |
|---|---|---|---|---|---|
| `{"won":true,...}` (pre-v0.4 published) | `true` | `false` | `[]` | `null` | "All aboard" (no re-verification) |
| `{"draft":true,...}` (pre-v0.4 unverified) | `false` | `true` | `[]` | `null` | Verification_Workflow fresh |
| `{"draft":true,"slots":["B"],...}` | `false` | `true` | `['B']` | `null` | Slot 1 filled, waiting for Slot 2 |
| `{"draft":true,"slots":["B","C"],"channel":"EO-7",...}` | `false` | `true` | `['B','C']` | `'EO-7'` | Verified draft, publish enabled |
| Corrupt / unparseable `slots` value | `false` | `true` | `[]` | `null` | Verification_Workflow fresh |

### Cases_State isolation

The Verification_Workflow touches only `merewick.teletext.v2`. It never reads or writes `merewick.teletext.cases.v1`. The `persist()` function writes `s` only to `storageKey` (the v2 key). No change needed.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Publish gate

*For any* Harbour state where `draft === true` and `verificationComplete()` is false, calling `act('publish')` SHALL leave `s.won === false` and SHALL leave the LIVE feed of P214 unchanged.

**Validates: Requirements 1.2, 6.1**

### Property 2: Slot round-trip persistence

*For any* slot fill sequence that results in a valid `s.slots` array (including partial fills), constructing a new receiver from the saved memory SHALL restore `s.slots` to the same value.

**Validates: Requirements 1.4, 5.4**

### Property 3: Invalid slot pair rejection preserves state

*For any* ordered pair `(f1, f2)` drawn from `{A, B, C}` where `verifySlots(f1, f2).valid === false`, filling both slots with that pair SHALL leave `s.won === false`, leave the LIVE feed unmodified, and clear `s.slots` to `[]`.

**Validates: Requirements 3.6, 6.1**

### Property 4: Unique valid slot pair

*For all* ordered pairs drawn from `{A, B, C}` (six total), exactly one pair SHALL satisfy `verifySlots(s1, s2).valid === true`.

**Validates: Requirements 3.7, 4.4**

### Property 5: Checksum determinism

*For any* triple of strings `(a, b, c)`, calling `packetChecksum(a, b, c)` twice SHALL return the same integer both times.

**Validates: Requirements 4.1, 4.3**

### Property 6: Archive feed immutability through publication

*For any* verification-then-publish sequence, the innerHTML of the archive clue rows on P214 (captured before publication) SHALL equal the innerHTML captured after publication.

**Validates: Requirements 6.4**

### Property 7: Cases_State isolation

*For any* complete Harbour Verification_Workflow followed by publication, the `merewick.teletext.cases.v1` localStorage value SHALL be identical before and after.

**Validates: Requirements 7.3**

### Property 8: Language switch preserves slots

*For any* partial slot state, switching language SHALL leave `s.slots` unchanged and SHALL display all labels in the new language.

**Validates: Requirements 2.3**

---

## Error Handling

**localStorage unavailable:** The existing `persist()` and `read()` are wrapped in try/catch. If `localStorage.setItem` throws, `persist()` silently swallows the error and the game continues in-session. The same applies to the new `s.slots` / `s.channel` fields — they are read from `x` only inside the try block and fall back to the defaults `[]` / `null` on any error.

**Corrupt slot data:** The `read()` validation filters `rawSlots` by membership in `['A','B','C']` and slices to two items maximum. Any value that doesn't pass that filter is dropped. If the resulting `slots` array is not exactly two valid items with a passing `verifySlots`, `channel` is reset to `null`.

**Double-publish prevention:** `publishCorrection()` guards on `!verificationComplete()`. Even if a hypothetical future UI call sends `act('publish')` during an incomplete verification, it returns immediately without changing state.

**Render focus restoration:** The existing `render()` logic restores focus to a matching `[data-do]` element after re-render. The new `pickSlot` / `pickChannel` buttons carry `data-do` and `data-val`, so focus restoration works without additional changes.

---

## Testing Strategy

### Unit tests (examples and edge cases)

Targeted, specific examples that demonstrate concrete behavior:

- Correct editorial conclusion triggers Verification_Workflow, not publish
- Publish action before verification does not change state to `won`
- Swapped-field pair rejected with reason containing `'order'`
- Wrong-field pair rejected with reason containing `'field'`
- Correct slot sequence unlocks channel selection
- Correct channel choice produces "Verified draft" state
- Full flow: `pickSlot('B')` → `pickSlot('C')` → `pickChannel('EO-7')` → `publish` → "All aboard"
- Old completed save (`won: true`) shows "All aboard" without re-verification
- Reset clears `slots` and `channel`
- `localStorage` throws → workflow still completes in-session

### Property-based testing notes

For this feature, PBT is applied to the pure logic layer only (the four `packetChecksum` / `verifySlots` / etc. functions), where inputs are small enumerable sets. Because the game runs in a VM context with no external I/O, the existing `t.run()` smoke test infrastructure can enumerate all relevant cases exhaustively in a single assertion rather than requiring a separate PBT library. The properties above translate directly to `t.run(...)` assertions that iterate over all 6 ordered pairs, all language values, and all slot combinations.

If a property-based testing library were used in a build-step environment, **fast-check** (JavaScript) would be appropriate. Each test should run a minimum of 100 iterations for non-exhaustive input spaces.

---

## Smoke Test Additions (`tests/smoke.mjs`)

The following eight test cases are appended after the existing `console.log('PASS: v0.3 ...')` line. The receiver infrastructure (`receiver()`, `click()`, `key()`, `t.run()`) is used unchanged.

```js
// === v0.4: Verification_Workflow tests ===

// Setup: get to draft state (stage = draft=true, all evidence found)
let v = receiver();
v.click('begin');
v.click('mode','diff'); v.click('isolate','1');       // P214 mark
v.type('326'); v.seek(6.2); v.el.film.paused=false;
v.click('capture','1');                               // P326 mark
v.type('418'); v.key('r'); v.click('mapMove','left'); v.key('ArrowDown'); v.click('align'); // P418 mark
v.type('793'); v.click('report','1');
assert.match(v.markup, /Cross-check the packet|Ověřte paket/, 'Should show verification workflow');

// Test 1: publish before verification does not advance to won
v.click('publish');
assert.doesNotMatch(v.markup, /All aboard|Všichni na palubě/, 'Publish before verification must not win');
assert.doesNotMatch(v.memory(), /"won":true/, 'State must not record won before verification');

// Test 2: swapped-field pair rejected with reason about order
v.click('pickSlot','C'); v.click('pickSlot','B');
assert.match(v.text, /order|pořadí/i, 'Swapped pair should mention order');
assert.doesNotMatch(v.markup, /EO-7/, 'Channel selection must not appear after swap rejection');

// Test 3: wrong-field pair rejected
v.click('pickSlot','A'); v.click('pickSlot','C');
assert.match(v.text, /field|pole/i, 'Wrong-field pair should mention field');

// Test 4: full correct flow → Verified draft → publish → All aboard
v.click('pickSlot','B'); v.click('pickSlot','C');
assert.match(v.markup, /EO-7/, 'Channel selection must appear after correct slots');
v.click('pickChannel','SR-2');
assert.doesNotMatch(v.markup, /Verified draft|Ověřený koncept/, 'Wrong channel must not complete');
v.click('pickChannel','EO-7');
assert.match(v.markup, /Verified draft|Ověřený koncept/, 'Correct channel should complete verification');
v.click('publish');
assert.match(v.markup, /All aboard|Všichni na palubě/, 'Publish after verification should show ending');

// Test 5: progress survives reload (partial slot selection)
let v2 = receiver();
v2.click('begin');
v2.click('mode','diff'); v2.click('isolate','1');
v2.type('326'); v2.seek(6.2); v2.el.film.paused=false; v2.click('capture','1');
v2.type('418'); v2.key('r'); v2.click('mapMove','left'); v2.key('ArrowDown'); v2.click('align');
v2.type('793'); v2.click('report','1');
v2.click('pickSlot','B');
assert.match(JSON.stringify(v2.memory()), /"slots":\["B"\]/, 'Slot 1 must be persisted');
let v3 = receiver(v2.memory());
assert.equal(v3.page, 'P793'.slice(1), 'Should restore to P793');
assert.match(v3.markup, /Slot 1.*B|B.*Slot 1/, 'Slot 1 B must survive reload');

// Test 6: old completed save (won:true) → shows All aboard without re-verification
let oldSave = JSON.stringify({lang:'en',page:'793',found:['214','326','418'],won:true,draft:false,started:true});
let legacy2 = receiver(oldSave);
legacy2.type('793');
assert.match(legacy2.markup, /All aboard/, 'Old won save should show All aboard without verification');

// Test 7: Cases_State unchanged after full Harbour verification+publish flow
let v4 = receiver();
v4.click('begin');
v4.click('mode','diff'); v4.click('isolate','1');
v4.type('326'); v4.seek(6.2); v4.el.film.paused=false; v4.click('capture','1');
v4.type('418'); v4.key('r'); v4.click('mapMove','left'); v4.key('ArrowDown'); v4.click('align');
v4.type('793'); v4.click('report','1');
v4.click('pickSlot','B'); v4.click('pickSlot','C'); v4.click('pickChannel','EO-7'); v4.click('publish');
assert.equal(v4.cases(), undefined, 'Cases_State must be untouched after Harbour verification+publish');

// Test 8: uniqueness proof — exactly one ordered pair passes verifySlots
const pairResults = v.run(
  "JSON.stringify(['A','B','C'].flatMap(a=>['A','B','C'].filter(b=>b!==a).map(b=>[a,b,verifySlots(a,b).valid])))"
);
const pairs = JSON.parse(pairResults);
const passing = pairs.filter(([,,ok]) => ok);
assert.equal(passing.length, 1, 'Exactly one ordered pair must pass verifySlots');
assert.deepEqual(passing[0].slice(0,2), ['B','C'], 'The passing pair must be B then C');

console.log('PASS: v0.4 verification workflow — publish gate, swapped/wrong rejection, full correct flow, reload persistence, old-save compat, cases isolation, pair uniqueness.');
```

---

## Bilingual Strings

All new strings are added to the inline `L(en, cs)` call pattern. The table below covers every new string introduced by this feature.

| Key / location | EN | CS |
|---|---|---|
| Eyebrow | `23:59 / EMERGENCY OVERRIDE` | `23:59 / NOUZOVÝ PŘEPIS` |
| Page title (verify) | `Cross-check the packet` | `Ověřte paket` |
| Page title (verified) | `Verified draft` | `Ověřený koncept` |
| Inline task description | `An emergency packet has overwritten two fields in the receiver feed. Compare each field against its archive parity strip. Select the two tampered fields in the order they appear — route first, then count. Then choose the correct channel to route the correction.` | `Nouzový paket přepsal dvě pole v přijímači. Porovnej každé pole s paritním řetězcem v archivu. Vyber dvě přepsaná pole ve správném pořadí — nejprve trasa, pak počet. Pak zvol správný kanál pro vysílání opravy.` |
| Panel heading (receiver) | `RECEIVER FEED` | `PŘIJÍMAČ` |
| Panel heading (archive) | `ARCHIVE PARITY` | `ARCHIV / PARITA` |
| Slots heading | `VERIFICATION SLOTS` | `OVĚŘOVACÍ SLOTY` |
| Slot empty | `—` | `—` |
| Channel heading | `PACKET CHANNEL` | `KANÁL PAKETU` |
| Channel EO-7 | `EO-7 › Emergency Override — Channel 7` | `EO-7 › Nouzový kanál — Kanál 7` |
| Channel SR-2 | `SR-2 › Standard Relay — Channel 2` | `SR-2 › Standardní relé — Kanál 2` |
| Reset link | `Clear slots and start over` | `Vymazat sloty a začít znovu` |
| Slots confirmed | `Both fields confirmed. Select the broadcast channel.` | `Obě pole potvrzena. Zvol vysílací kanál.` |
| Swap rejection | `Sequence rejected: those fields were tampered but the order does not match the packet timeline. The route field comes first.` | `Pořadí odmítnuto: tato pole byla přepsána, ale pořadí neodpovídá časové linii paketu. Nejprve patří pole s trasou.` |
| Field rejection | `Pair rejected: at least one of these fields matches the archive. Only overwritten fields unlock the channel.` | `Dvojice odmítnuta: alespoň jedno z těchto polí odpovídá archivu. Kanál odemknou pouze přepsaná pole.` |
| Channel wrong | `Channel rejected: SR-2 is the standard relay and cannot carry an emergency override. Use EO-7.` | `Kanál odmítnut: SR-2 je standardní relé a nouzový přepis přenést nemůže. Použij EO-7.` |
| Channel confirmed | `Channel locked. The verified draft is ready to broadcast.` | `Kanál uzamčen. Ověřený koncept je připraven k vysílání.` |
| Slots cleared | `Slots cleared. Re-read the feeds and select two fields.` | `Sloty vymazány. Znovu přečti přenosy a vyber dvě pole.` |
| Hint 1 (verify) | `Compare each field in the receiver feed against its parity strip in the archive. Two fields show a different value than their strip predicts.` | `Porovnej každé pole přijímače s paritním řetězcem v archivu. Dvě pole mají jinou hodnotu, než předpovídá jejich strip.` |
| Hint 2 (verify) | `The first tampered field names a quay. The second changes a passenger count. Select the quay field first, then the count field.` | `První přepsané pole uvádí molo. Druhé mění počet osob. Vyber nejprve pole s molem, pak pole s počtem.` |
| Archive field A value | `Departure time: 23:28` | `Čas odjezdu: 23:28` |
| Archive field B value | `Departure quay: East Steps` | `Molo odjezdu: Východní schody` |
| Archive field C value | `Passenger count: 5` | `Počet osob: 5` |
| Receiver field B value (tampered) | `Departure quay: West Quay` | `Molo odjezdu: West Quay` |
| Receiver field C value (tampered) | `Passenger count: 12` | `Počet osob: 12` |
| Notice packet text | `EMERGENCY PACKET RECEIVED ON EO-7. WEST QUAY ROUTE HAS PRIORITY. PASSENGER COUNT UPDATED.` | `PŘIJAT NOUZOVÝ PAKET NA EO-7. TRASA PŘES WEST QUAY MÁ PŘEDNOST. POČET OSOB AKTUALIZOVÁN.` |

---

## Accessibility

### Keyboard navigation

Every new interactive element in `verificationPage()` and `verifiedDraftPage()` is a `<button>` rendered via the existing `btn()` helper, which outputs `data-do` / `data-val` attributes. The existing `click` event listener on `document` already dispatches any click on a `[data-do]` element to `act()`. Buttons receive native Tab focus and activate on Enter or Space without any additional code.

**Tab order** in the verification panel: the three `pickSlot` buttons (A → B → C) appear first in DOM order, followed by the two `pickChannel` buttons (EO-7 → SR-2, visible only after valid slot fill), then the `verifyReset` button, then the existing `hint` and `restartFoot` buttons in the outer shell. This matches the natural visual reading order and requires no `tabindex` manipulation.

**Arrow key handling:** No new arrow key bindings are introduced. The existing `keydown` listener only intercepts arrow keys for P418 (overlay) and P672/P747 (direction/frame). On P793, arrow keys do nothing, so Tab/Enter remain the only keyboard interface — consistent with the existing newsroom controls.

**`aria-pressed` state:** The `pickSlot` buttons set `aria-pressed="true"` when their field name is in `s.slots`. This is the same pattern used by the existing `physicalMode` toggle buttons.

**Screen reader text:** Field labels (A, B, C) are inside `<span class="ln">` within each button. The button's full accessible name is the concatenation of the label and the field value, e.g. "A Departure time: 23:28". The parity strip value in the archive panel uses `<small>` for visual de-emphasis; it is still in the DOM and read by screen readers.

### Touch

All new buttons use the existing `.answer` and `.clueRow` class styles, which inherit `touch-action: manipulation` from the base `button` rule. No minimum size changes are needed — existing `.answer` buttons are already 39 px minimum height with generous padding.

### No reliance on color, pattern, or timing

Field comparison works entirely through readable text: the receiver field string, the archive field string, and the archive parity hex value are all rendered as text. No color coding is used to identify tampered vs. clean fields. The player identifies the mismatch by reading — the same mechanic used in the existing P214 comparison step.
