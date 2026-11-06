# Tasks: Comprehensive README & .gitignore Modernization

**Input**: Design documents from `specs/010-update-readme-gitignore/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

## Format: `[ID] [P?] [Story] Description with exact file path`

- **[P]**: Can run in parallel (different files or independent concerns)
- **[Story]**: Associated user story from `spec.md` (`[US1]`, `[US2]`, `[US3]`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Validation harness setup and baseline integrity preparation

- [X] T001 Initialize validation script commands in `specs/010-update-readme-gitignore/quickstart.md`
- [X] T002 [P] Verify baseline git status and confirm working tree cleanliness in repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Structural audit of existing repository files against design contracts

**⚠️ CRITICAL**: Must be completed before finalizing individual user story content

- [X] T003 Audit existing `README.md` against structural contract `specs/010-update-readme-gitignore/contracts/readme-structure.md`
- [X] T004 [P] Audit existing `.gitignore` against exclusion rules in `specs/010-update-readme-gitignore/contracts/gitignore-rules.md`

---

## Phase 3: User Story 1 - Bilingual Documentation with English Precedence and No Emojis (Priority: P1) 🎯 MVP

**Goal**: Deliver a clean, professional bilingual README where English appears first, Persian follows, and zero emojis are present.

**Independent Test**: Execute Scenario 1 and Scenario 2 in `quickstart.md` to confirm English precedes Persian, navigation anchors work, and 0 emojis exist.

### Implementation for User Story 1

- [X] T005 [P] [US1] Author complete English section at top of `README.md` with zero emojis
- [X] T006 [P] [US1] Author complete Persian section below English section in `README.md` with zero emojis
- [X] T007 [US1] Add bidirectional language navigation anchors `[English](#english)` and `[فارسی (Persian)](#فارسی-persian)` to `README.md`
- [X] T008 [US1] Execute automated Python unicode character inspection against `README.md` per `specs/010-update-readme-gitignore/quickstart.md`

**Checkpoint**: User Story 1 is complete. `README.md` is bilingual, English-first, and 100% emoji-free.

---

## Phase 4: User Story 2 - Clear, Step-by-Step App Usage Guide Reflecting Current Features (Priority: P1)

**Goal**: Provide a simple, contiguous 5-step onboarding and usage guide accurately documenting all modern application features.

**Independent Test**: Execute Scenario 3 in `quickstart.md` to confirm Steps 1 through 5 are sequentially numbered and all modern features are documented.

### Implementation for User Story 2

- [X] T009 [P] [US2] Update English onboarding guide with contiguous Steps 1 through 5 and modern UI features (Theme Toggle, Thinking Mode, Markdown rendering, copy buttons) in `README.md`
- [X] T010 [P] [US2] Update Persian onboarding guide with contiguous گام‌های ۱ تا ۵ and modern UI features in `README.md`
- [X] T011 [US2] Document essential lifecycle management and release packaging commands (`./deploy.sh` and `./build-release.sh`) in `README.md`
- [X] T012 [US2] Verify step numbering continuity (Steps 1 to 5) across both language sections in `README.md`

**Checkpoint**: User Story 2 is complete. Onboarding is intuitive, step-by-step, and fully synchronized with app capabilities.

---

## Phase 5: User Story 3 - Comprehensive Repository Cleanliness and .gitignore Auditing (Priority: P2)

**Goal**: Ensure `.gitignore` exhaustively excludes distribution packages, transient release files, test caches, and local editor metadata.

**Independent Test**: Execute Scenario 4 in `quickstart.md` using `git check-ignore` against packaging, environment, and cache patterns.

### Implementation for User Story 3

- [X] T013 [P] [US3] Add packaging archive rules (`*.tar.gz`, `*.tar`, `*.tgz`, `*.zip`, `checksums.sha256`, `manifest.json`) to `.gitignore`
- [X] T014 [P] [US3] Add runtime cache, bytecode, and editor rules (`.cache/`, `*.pyc`, `.vscode/`, `.idea/`) to `.gitignore`
- [X] T015 [US3] Validate environment exclusion preserving `!.env.example` in `.gitignore`
- [X] T016 [US3] Execute `git check-ignore` test suite against release, cache, and secret paths per `specs/010-update-readme-gitignore/quickstart.md`

**Checkpoint**: User Story 3 is complete. Repository ignore rules prevent all transient leakage.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final end-to-end verification and documentation alignment

- [X] T017 [P] Verify markdown formatting, code block syntax, and table alignment in `README.md`
- [X] T018 Execute full end-to-end verification scenarios from `specs/010-update-readme-gitignore/quickstart.md`
- [X] T019 Review git status and confirm zero untracked artifacts or unwanted changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — executes immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — blocks all user story implementation.
- **User Story 1 (Phase 3)**: Depends on Phase 2 — implements bilingual layout and no-emoji policy.
- **User Story 2 (Phase 4)**: Depends on Phase 3 — builds upon bilingual sections to detail step-by-step guidance.
- **User Story 3 (Phase 5)**: Depends on Phase 2 — operates independently on `.gitignore`.
- **Polish (Phase 6)**: Depends on completion of all user stories.

### Parallel Opportunities

- **Within Phase 3 (US1)**: T005 (English section) and T006 (Persian section) can be authored in parallel.
- **Within Phase 4 (US2)**: T009 (English steps) and T010 (Persian steps) can be authored in parallel.
- **Between US2 and US3**: User Story 2 (`README.md`) and User Story 3 (`.gitignore`) touch completely different files and can proceed in parallel.

---

## Parallel Example: User Stories 2 & 3

```bash
# Developer / Agent A (User Story 2):
Task: "Update English onboarding guide with contiguous Steps 1 through 5 in README.md"
Task: "Update Persian onboarding guide with contiguous گام‌های ۱ تا ۵ in README.md"

# Developer / Agent B (User Story 3):
Task: "Add packaging archive rules to .gitignore"
Task: "Add runtime cache, bytecode, and editor rules to .gitignore"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup (Phase 1) & Foundational Audit (Phase 2).
2. Complete User Story 1 (Phase 3): English-first bilingual format without emojis.
3. Validate with Scenario 1 & 2 in `quickstart.md`.

### Incremental Delivery
1. Add User Story 2 (Phase 4): Step-by-step guide with full feature coverage.
2. Add User Story 3 (Phase 5): `.gitignore` enhancements and `check-ignore` verification.
3. Run Phase 6 Polish & final validation suite.
