# Skills (Matt Pocock)

Small, composable, engineering-focused skills. Use at the right moment.

## Productivity Skills

| Skill       | Use when...                                        |
| ----------- | -------------------------------------------------- |
| `/grill-me` | Non-code plans/designs — stress-test before acting |
| `/handoff`  | Compact conversation for another agent to pick up  |

## Engineering Skills

| Skill                            | When to use                                                                            | Best with         |
| -------------------------------- | -------------------------------------------------------------------------------------- | ----------------- |
| `/diagnose`                      | Hard bugs or performance regressions — reproduce → minimize → hypothesize → fix → test | `oracle`          |
| `/grill-with-docs`               | Grilling session + building shared language + ADRs                                     | before `planner`  |
| `/tdd`                           | Test-driven development — red-green-refactor loop                                      | before `builder`  |
| `/triage`                        | Incoming bugs/features — triage through a state machine                                | `researcher`      |
| `/to-prd`                        | Convert a feature request into a PRD for the issue tracker                             | after `grill-me`  |
| `/to-issues`                     | Break a plan into independently-grabbable issues                                       | after `planner`   |
| `/zoom-out`                      | High-level code context — explain code in system terms                                 | `scout`           |
| `/improve-codebase-architecture` | Refactoring opportunities — consolidate, decouple, testability                         | periodic audits   |
| `/prototype`                     | Throwaway prototype — sanity-check data model, UI, or design                           | before committing |

## Skill Workflow Mapping

| Phase         | Skills to invoke                                                  |
| ------------- | ----------------------------------------------------------------- |
| **Clarify**   | `/grill-me` or `/grill-with-docs` → shared language, ADRs         |
| **Scout**     | `/zoom-out` for system-level context                              |
| **Research**  | `/triage` for issues; `researcher` subagent for external evidence |
| **Plan**      | `/grill-with-docs` check; `/to-issues` to break into tickets      |
| **Implement** | `/tdd` for new features; `/diagnose` for bugs                     |
| **Review**    | parallel fresh-context `reviewer` subagents                       |
| **Refactor**  | `/improve-codebase-architecture` periodic audits                  |
| **Prototype** | `/prototype` for design exploration                               |
