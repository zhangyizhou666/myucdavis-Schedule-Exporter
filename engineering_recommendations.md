# ScheduleMate Extension – Engineering Improvement Recommendations

> Author: Engineering Manager (AI)
> Date: {{TODAY}}

## 1. Purpose of This Document
This document lists concrete, high-level improvement tasks for the **ScheduleMate** browser extension.  It is intended as an actionable roadmap for the next implementation cycle.  Each recommendation is scoped to be understandable and independently achievable by a developer or AI agent (e.g. *Cloud 4 Sonnet*).

---

## 2. Guiding Principles
1. **Maintain User-Visible Behaviour** – Refactors must not break core features (export, colour coding, RMP ratings, etc.).
2. **Incremental & Testable** – Prefer small, verifiable steps over a big-bang rewrite.
3. **Performance & Maintainability First** – Optimise hot paths; keep code modular and readable.
4. **Modern Chrome MV3 Compliance** – Align with Manifest V3 best practices.

---

## 3. Recommended Changes
### 3.1 Code Organisation & Modularisation
| ID | Recommendation | Rationale |
|----|----------------|-----------|
| **CO-1** | Split current `content.js` (≈2 400 LOC) into ES modules under `src/`. Suggested modules: `core/initialisation.js`, `features/rmp.js`, `features/conflict.js`, `ui/sortButtons.js`, `utils/time.js`, etc. | Reduces cognitive load, enables selective imports and tree-shaking. |
| **CO-2** | Migrate build to **Vite** (or Rollup) to bundle ES modules into `content.js` and `popup.js`. | Enables modern syntax (import/export, async/await) without worrying about browser support. |
| **CO-3** | Convert helper classes (`Course`, `Final`) and utilities to **TypeScript** for type-safety. | Catches many runtime bugs at compile time; improves editor DX. |

### 3.2 CSS & Style Management
| ID | Recommendation | Rationale |
|----|----------------|-----------|
| **CSS-1** | Consolidate injected styles (`addScheduleMateStyles`) and `styles.css` into a single file. Inject via manifest `"css"` only. | Removes duplication/inconsistency of colour class names. |
| **CSS-2** | Create a SCSS (or CSS Modules) pipeline under the bundler to allow variables (primary colour, UC Davis palette). | Easier theming and future visual tweaks. |

### 3.3 State & Memory Management
| ID | Recommendation | Rationale |
|----|----------------|-----------|
| **SM-1** | Encapsulate global mutable state inside a singleton `ScheduleMateStore` (using closure or class). | Prevents accidental pollution of `window` & eases testing. |
| **SM-2** | Ensure `MutationObserver`, `setInterval`, and scroll listeners are **disconnected** in `beforeunload` and `runtime.onSuspend`. | Avoids memory leaks on long-lived tabs. |

### 3.4 Performance Optimisations
| ID | Recommendation | Hot Path | Rationale |
|----|----------------|----------|-----------|
| **P-1** | Cache parsed time ranges & conflict results on DOM elements via `dataset.*` to skip recomputation in `updateCourseUI`. | Sorting / observer | Cuts repeated regex & date math. |
| **P-2** | Short-circuit `forceLoadAllCourses` once `Load More` button not present **or** course count stabilises over two scans. | Infinite scroll | Reduces unnecessary scrolling & waits. |
| **P-3** | Lazy-load RMP JSON when **first** rating lookup is requested, not during every initialisation. | Initial load | Faster page startup for users who do not open instructor details. |

### 3.5 Data Handling & Networking
| ID | Recommendation | Rationale |
|----|----------------|-----------|
| **D-1** | Compress `uc_davis_professors.json` & `uc_davis_legacyIds.json` (gzip in `web_accessible_resources`) and fetch with `fetch(url).then(res.blob())`. | Lower download size, quicker parse. |
| **D-2** | Introduce schema version to `scheduleMatePreferences`; perform migration when outdated. | Forward-compatibility for new settings. |

### 3.6 Reliability & Testing
| ID | Recommendation | Rationale |
|----|----------------|-----------|
| **T-1** | Add Jest (or Vitest) unit tests for `utils/time.js` (convertTime12to24, parseTimeRange) and `Course.conflicts`. | Guarantees core algorithms stay correct during refactor. |
| **T-2** | Add basic Playwright e2e to load ScheduleBuilder test page & assert colour coding / RMP badge render. | Prevents regression in DOM selectors. |

### 3.7 Developer Experience
| ID | Recommendation | Rationale |
|----|----------------|-----------|
| **DX-1** | Introduce ESLint + Prettier + Husky pre-commit hook. | Enforces consistent style & catches common errors. |
| **DX-2** | Reduce noisy `console.log`; wrap in `debug()` that checks `scheduleMatePreferences.debug` flag. | Cleaner DevTools, optional verbose mode. |

### 3.8 Feature Clean-up / Removal
| ID | Recommendation | Rationale |
|----|----------------|-----------|
| **CLN-1** | Remove `background.js` (only prints message) or merge into service worker script used for downloads. | Fewer moving parts. |
| **CLN-2** | Delete unused placeholders (`inject_button.js`, empty `core/features/utils` dir) to declutter repo. | Smaller footprint, clarity. |

---

## 4. Delivery Roadmap (Suggested Order)
1. **CO-1, CO-2** – Create module structure & bundler (foundation).  
2. **CSS-1, CSS-2** – Consolidate styling.  
3. **SM-1, SM-2** – State encapsulation & cleanup hooks.  
4. **P-1, P-2, P-3** – Performance improvements.  
5. **D-1, D-2** – Data & settings migration.  
6. **T-1, T-2** – Testing harness.  
7. **DX-1, DX-2** – Developer tooling.  
8. **CLN-1, CLN-2** – Codebase clean-up.

Each stage should pass existing manual smoke-tests **before** proceeding.

---

## 5. Risks & Mitigations
* **Bundling Complexity** – Use minimal config (Vite defaults) and commit build artefacts until CI is ready.
* **TypeScript Migration Overhead** – Start with `// @ts-nocheck` comments and gradually raise `strict` flags.
* **UC Davis DOM Changes** – Abstract selectors into constants; add Playwright tests to detect breakage early.

---

## 6. Acceptance Criteria
A change is considered complete when:
1. Feature parity with current production behaviour is verified.
2. Unit & e2e tests pass in CI.
3. Linting shows zero errors; bundle size ≤ current size + 10 %.
4. No new console errors or high-frequency warnings.

---

## 7. Appendix – File & Module Structure (After Refactor)
```
src/
  core/
    init.ts              // bootstrap & observers
    store.ts             // global state singleton
  features/
    rmp.ts               // RateMyProfessor handling
    conflict.ts          // conflict detection logic
  ui/
    sortButtons.ts       // colour & rating sort UI
    notifications.ts     // toast messages
  utils/
    time.ts              // convertTime12to24, parseTimeRange
    dom.ts               // helper selectors, class utils
popup/
  index.ts
  popup.html
styles/
  main.scss
manifest.json
```

---

## 8. Next Steps for Claude 4 Sonnet
1. Fork repo & create a *refactor* branch.
2. Implement tasks according to **Section 4** order, committing after each ID.
3. Open PR with check-list referencing IDs (CO-1, CSS-1, …).
4. Tag engineering manager (you) for review.

> End of document. 