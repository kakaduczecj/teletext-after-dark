# Teletext After Dark

**Find the truth. Put it on air.** An offline CRT-inspired mystery anthology for the Kiroween **Resurrection** theme. A long-dead local television station returns, but its live signal has overwritten pieces of the record. Compare it with the original archive, recover the evidence, then broadcast a correction without rewriting the past.

## Play
Unpack the project with its `assets/` folder intact and open `index.html` in a recent browser. No account, build, installation, or connection is needed to play. Use the on-screen keypad or number keys; EN/CS switches language. Sound is off by default. Progress is saved locally and each case can be reset separately.

**Česky:** Rozbal složku i s adresářem `assets/`. Otevři `index.html` v prohlížeči, nahoře přepni na **CS** a vyber případ. Internet ani přihlášení nejsou potřeba. Zapnutý časovaný přepis umožňuje hrát i bez videa.

## Four cases
- **Harbour Blackout:** compare an overwritten line, inspect the recorded lamp signal, align two map layers, reconstruct the missing page, and verify the emergency packet before broadcasting.
- **The Last Train:** solve a timetable and reconstruct a route across midnight.
- **The Ghost Forecast:** recalibrate a compass and draft the bridge warning.
- **The Lighthouse Signal:** read a flash sequence and transmit a reply.

## Kiro and verification
The anthology and original puzzle baseline were built with OpenAI assistance. Kiro IDE added the emergency-packet finale: compare the receiver fields to their archive values, verify their order and channel, and block broadcasting until the verification succeeds. The original Kiro requirements, design, and task checklist are in `.kiro/specs/emergency-broadcast-verification/`. Subsequent v0.4.1 stability and touch improvements were separate post-Kiro QA work.

Run `node tests/smoke.mjs` for deterministic tests, including draft and archive isolation, language switching and reload, and the packet gate. The optional `python tests/browser_smoke.py` suite uses Python Playwright and a Chrome/Chromium install. Desktop and 390 px/320 px touch-emulated passes exercised media playback, the timed transcript, and every case.

Assets were produced for this project: the harbour plate was generated with OpenAI ImageGen, then processed locally into the fictional tape. Effects and audio were synthesized; the poster is a frame of that tape. No third-party footage or audio is bundled.

**Version:** v0.4.1. Licensed under the [MIT License](LICENSE).
