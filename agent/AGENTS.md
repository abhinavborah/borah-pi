# Global Agent Instructions

## Core Orchestration Pattern

For non-trivial work, follow this loop:

```
clarify → scout/research → planner → worker → parallel fresh reviewers → worker fix → validate
```

**Key rules:**
- One writer thread only: `worker` implements, `reviewer` never silently edits
- Fork for advisory threads (`oracle`); fresh context for adversarial reviewers
- Escalate unapproved decisions upward; don't decide alone

---

## Subagents (pi-subagents)

Delegate focused work to child agents via `subagent(...)` or slash commands (`/run`, `/chain`, `/parallel`).

### Builtin Agents & When to Use

| Agent | Use when... | Context |
|-------|-------------|---------|
| `scout` | Fast codebase recon — entry points, key types, data flow, risks | fresh |
| `researcher` | Web/docs research — official docs, specs, benchmarks, evidence | fresh |
| `planner` | Turn requirements into a concrete implementation plan | fork |
| `worker` | Implementation — edits files, validates, escalates unapproved decisions | fork |
| `reviewer` | Code review with distinct angles — correctness, tests, simplicity | fresh |
| `context-builder` | Stronger handoff pass — gathers context + meta-prompt | fresh |
| `oracle` | Second opinion before acting — challenges assumptions, no edits | fork |
| `delegate` | Lightweight generic delegate when you want parent-like behavior | fork |

### Common Workflows

**Clarify → Plan → Implement → Review:**
```typescript
subagent({
  chain: [
    { agent: "scout", task: "Map the auth flow" },
    { agent: "planner", task: "Plan from {previous}" },
    { agent: "worker", task: "Implement approved plan" }
  ]
})
```

**Parallel reviewers after implementation:**
```typescript
subagent({
  tasks: [
    { agent: "reviewer", task: "Correctness + regressions", output: false },
    { agent: "reviewer", task: "Tests + validation", output: false },
    { agent: "reviewer", task: "Simplicity + maintainability", output: false }
  ],
  context: "fresh"
})
```

**Solve hard bug:**
```typescript
subagent({ agent: "oracle", task: "Investigate this bug before we edit. Propose best next move." })
```

### Subagent Constraints

- Max nesting depth: 2 (recursive delegation blocked by default)
- Forking requires a persisted parent session
- Forked runs inherit parent history (branched threads, not fresh filtered)
- Fresh context for adversarial reviewers; fork for advisory/oracle threads
- Keep conversational authority clear — child agents advise, parent decides

---

## Skills (Matt Pocock)

Small, composable, engineering-focused skills. Use at the right moment.

### Productivity Skills

| Skill | Use when... |
|-------|-------------|
| `/caveman` | Ultra-compact communication (~75% token reduction) |
| `/grill-me` | Non-code plans/designs — stress-test before acting |
| `/handoff` | Compact conversation for another agent to pick up |

### Engineering Skills

| Skill | When to use | Best with |
|-------|-------------|------------|
| `/diagnose` | Hard bugs or performance regressions — reproduce → minimize → hypothesize → fix → test | `oracle` |
| `/grill-with-docs` | Grilling session + building shared language + ADRs | before `planner` |
| `/tdd` | Test-driven development — red-green-refactor loop | before `worker` |
| `/triage` | Incoming bugs/features — triage through a state machine | `researcher` |
| `/to-prd` | Convert a feature request into a PRD for the issue tracker | after `grill-me` |
| `/to-issues` | Break a plan into independently-grabbable issues | after `planner` |
| `/zoom-out` | High-level code context — explain code in system terms | `scout` |
| `/improve-codebase-architecture` | Refactoring opportunities — consolidate, decouple, testability | periodic audits |
| `/prototype` | Throwaway prototype — sanity-check data model, UI, or design | before committing |

### Skill Workflow Mapping

| Phase | Skills to invoke |
|-------|-----------------|
| **Clarify** | `/grill-me` or `/grill-with-docs` → shared language, ADRs |
| **Scout** | `/zoom-out` for system-level context |
| **Research** | `/triage` for issues; `researcher` subagent for external evidence |
| **Plan** | `/grill-with-docs` check; `/to-issues` to break into tickets |
| **Implement** | `/tdd` for new features; `/diagnose` for bugs |
| **Review** | parallel fresh-context `reviewer` subagents |
| **Refactor** | `/improve-codebase-architecture` periodic audits |
| **Prototype** | `/prototype` for design exploration |

---

## Inter-Session Coordination (pi-intercom)

Coordinate with other pi sessions on the same machine.

### When to Coordinate

**When:** Same codebase (parallel work), reference codebase (consulting patterns), related repos (shared libraries).

**Not when:** Unrelated codebases, trivial questions, or when you can proceed independently.

### Principles

- Prefer `send` for notifications; `ask` only when blocked waiting for input
- `ask` is blocking — one pending ask at a time
- Name sessions with `/name` for stable intercom targeting

### Quick Reference

```typescript
intercom({ action: "list" })                    // List active sessions
intercom({ action: "send", to: "session", message: "..." })  // Fire-and-forget
intercom({ action: "ask", to: "session", message: "..." })   // Blocking wait
intercom({ action: "reply", message: "..." })  // Reply to pending ask
```

### Planner-Worker Pattern

```
Planner session                    Worker session
     │                                  │
     ├─── send(task) ──────────────────►│
     │                                  ├── implement
     │                                  ├── ask(clarification)
     │◄──────────────────────────────────┤
     │     reply(answer)                  │
     │                                  ├── continue
     │                                  ├── ask(completion)
     │◄──────────────────────────────────┤
     │     reply(approved)                │
```

---

## MCP: Web Scraping

Use firecrawl MCP for web research:
- `firecrawl_scrape` — single URL → markdown + metadata
- `firecrawl_map` — discover all URLs on a site
- `firecrawl_search` — web search
- `firecrawl_crawl` — crawl entire website
- `firecrawl_extract` — structured data extraction
- `firecrawl_agent` — autonomous research agent

Requires Firecrawl running at `http://localhost:3002`.

**Fallback:** If firecrawl is unavailable or fails, use `pi-web-access` (`code_search`, `fetch_content`) as a fallback for web research and code lookups.

---

## Quick Reference Card

| Situation | Action |
|-----------|--------|
| Understand unfamiliar code | `/run scout "Map X"` |
| Need external evidence | `/run researcher "Research X"` |
| Hard decision before acting | `/run oracle "Advise on X"` |
| Complex work ahead | `/grill-with-docs` first, then `/run planner` |
| Implement feature | `/run worker` (after plan approved) |
| After implementation | Parallel `/run reviewer` (fresh context) |
| Bug investigation | `/diagnose` or `/run oracle` |
| New feature idea | `/grill-me` → `/to-prd` |
| Breaking down a plan | `/to-issues` |
| Periodic codebase health | `/improve-codebase-architecture` |
| Design exploration | `/prototype` |
| Compact mode | `/caveman` |
| Handoff to another session | `/intercom` (Alt+M) |

---

## Anti-Patterns to Avoid

1. **Don't chain reviewers** — run parallel fresh-context reviewers, then synthesize
2. **Don't let a reviewer edit silently** — reviewer suggests, worker applies
3. **Don't skip clarification** — use `/grill-me` or `/grill-with-docs` before planning
4. **Don't fork for adversarial review** — use fresh context for reviewers
5. **Don't delegate orchestration** — parent owns workflow, children execute tasks
6. **Don't use `ask` casually** — it's blocking; use `send` for notifications
7. **Don't guess on unapproved decisions** — escalate via `contact_supervisor` or `intercom`