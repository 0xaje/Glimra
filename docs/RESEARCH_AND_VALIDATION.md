# Research & Validation — Glimra

**Project:** Glimra — Control without a touch  
**Last reviewed:** November 18, 2026  
**Scope:** Research supporting hands-free presentation controls, plus evidence actually recorded for Glimra.

## Why this matters

Presentations often require a keyboard, mouse, or clicker to change pages. For some speakers—including people who cannot comfortably operate handheld controls—this adds friction. Glimra explores camera-based gestures as another way to present PDFs without reaching for an input device.

Accessibility is a broad motivation, not a claim that everyone with a disability would need or benefit from this product:

- WHO estimates **1.3 billion people**, or **16% of the world's population**, experience significant disability. This is a global disability estimate, **not** Glimra's addressable market. [WHO: Disability](https://www.who.int/en/news-room/fact-sheets/detail/disability-and-health).
- WHO reports **more than 2.5 billion people** need one or more assistive products, potentially increasing to **3.5 billion by 2050**. This covers many categories of products; it does **not** indicate demand for blink-controlled presentation software. [WHO: Assistive technology](https://www.who.int/news-room/fact-sheets/detail/assistive-technology).

## Technical research basis

- A published research article, **“Eye-blink detection system for human–computer interaction,”** discusses eye-blink-based user interfaces as a possible input route for people who cannot easily use hands or speech. This supports feasibility of the interaction category, **not** measured Glimra reliability. [Research article, Springer](https://link.springer.com/article/10.1007/s10209-011-0256-6).
- The official **Presage SmartSpectra SDK** describes facial analysis features including landmarks and eye-blink detection. Those are upstream SDK capabilities, not proof that Glimra's optional Eyes mode has passed a live acceptance test. [Presage documentation](https://smartspectra.presagetech.com/docs/) and [official GitHub repository](https://github.com/Presage-Security/SmartSpectra).

## What Glimra actually does today

The Windows application opens and presents local PDFs. Its **Head mode** interprets facial-landmark movements from the real SmartSpectra native SDK: a controlled head turn navigates pages and a nod can scroll when scrollable content is present. Keyboard control is also available.

The optional **Eyes mode** is integrated with the SDK blink-detection signal, but **has not passed real-camera hardware acceptance**. Do not describe blink navigation as verified production functionality. Packaged Ubuntu camera operation also remains unverified.

See [README](../README.md), [Architecture](ARCHITECTURE.md), and [Test evidence](TEST_REPORT.md).

## Existing firsthand evidence — November 9, 2026

According to the project's [test report](TEST_REPORT.md), an independent real-hardware diagnostic on the presenter's Windows computer recorded:

| Measurement | Recorded result |
| --- | ---: |
| Decoded SmartSpectra metrics packets | 487 |
| Stable 478-point facial-landmark packets | 416 |
| Valid quality checks | 566 |
| Low-FPS warnings | 0 |
| SDK errors during the diagnostic | 0 |

The presenter also reported that live native-powered Head mode worked and had improved significantly, while further polish and presenter handoff testing remained necessary. The same diagnostic recorded **zero detected blink starts**, so it does not validate Eyes mode.

**Interpretation:** These values establish that real SDK data and facial landmarks were observed in a specific session. They are **not** a gesture-accuracy rate, a false-positive rate, or proof of reliability across cameras, users, or lighting conditions.

## What still needs validation

Before claiming robust hands-free use, capture genuine physical-device test runs with: operating system and camera type; lighting and distance; session duration; attempted and correctly recognized head turns; unintended commands; response time from gesture to page change; presenter handoff; repeated use; and actual blink-detection and recognition results in Eyes mode.

Use real event timestamps and device observations. Report errors and failed attempts alongside successes. Avoid mock or simulated gesture results in public performance claims.

A useful measurement plan:

| Measure | Calculation |
| --- | --- |
| Head gesture recognition rate | Correct recognized intended commands / intended attempts |
| Unintended action count | Unrequested page changes during a timed observation |
| Gesture-to-action latency | Page-change timestamp minus accepted-gesture timestamp |
| Eyes mode recognition | Only after genuine SDK-detected blinks appear on hardware |
| Reliability | Repeated sessions across actual cameras, lighting, and presenters |

Do not publish numerical performance claims until the numerator, denominator, test conditions, and evidence are available.

## Summary

Glimra combines established accessibility motivation and documented camera-based face/blink analysis with an implemented PDF presentation workflow. **Head mode has real-device evidence; Eyes mode remains an unverified option.** The research justifies investigating hands-free control, while Glimra's own measured test results determine whether it is reliable in practice.
