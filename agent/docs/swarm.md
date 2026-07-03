# Swarm — Subagent Orchestration

Detailed reference for spawning, chaining, and orchestrating pi subagents. Read this before launching any subagent, chaining tasks, or running worktree-isolated workflows.

## Subagents

Delegate focused work to child agents via `subagent(...)` or slash commands (`/run`, `/chain`, `/parallel`).

### Builtin Agents & When to Use

| Agent             | Use when...                                                             | Context |
| ----------------- | ----------------------------------------------------------------------- | ------- |
| `scout`           | Fast codebase recon — entry points, key types, data flow, risks         | fresh   |
| `researcher`      | Web/docs research — official docs, specs, benchmarks, evidence          | fresh   |
| `planner`         | Turn requirements into a concrete implementation plan                   | fork    |
| `builder`         | Implementation — edits files, validates, escalates unapproved decisions | fork    |
| `reviewer`        | Code review with distinct angles — correctness, tests, simplicity       | fresh   |
| `context-builder` | Stronger handoff pass — gathers context + meta-prompt                   | fresh   |
| `oracle`          | Second opinion before acting — challenges assumptions, no edits         | fork    |
| `delegate`        | Lightweight generic delegate when you want parent-like behavior         | fork    |

### Common Workflows

**Clarify → Plan → Implement → Review:**

```typescript
subagent({
  chain: [
    { agent: "scout", task: "Map the auth flow" },
    { agent: "planner", task: "Plan from {previous}" },
    { agent: "builder", task: "Implement approved plan" },
  ],
});
```

**Parallel reviewers after implementation:**

```typescript
subagent({
  tasks: [
    { agent: "reviewer", task: "Correctness + regressions", output: false },
    { agent: "reviewer", task: "Tests + validation", output: false },
    { agent: "reviewer", task: "Simplicity + maintainability", output: false },
  ],
  context: "fresh",
});
```

**Solve hard bug:**

```typescript
subagent({
  agent: "oracle",
  task: "Investigate this bug before we edit. Propose best next move.",
});
```

### Subagent Constraints

- Max nesting depth: 2 (recursive delegation blocked by default)
- Forking requires a persisted parent session
- Forked runs inherit parent history (branched threads, not fresh filtered)
- Fresh context for adversarial reviewers; fork for advisory/oracle threads
- Keep conversational authority clear — child agents advise, parent decides

---

## Chain Inference

Use the **Core Orchestration Pattern** loop above. Skip steps only when the user asks for speed.

---

## Worktrees (parallel agent isolation)

For multi-agent parallel work, isolate each agent in its own worktree using [worktrunk](https://worktrunk.dev/):

```bash
brew install worktrunk && wt config shell install
pi install npm:pi-worktrunk   # status markers: 🤖 busy, 💬 idle
```

The `pi-worktrunk` extension updates `wt list` markers as pi lifecycle events fire (`session_start` → 💬, `agent_start` → 🤖, `agent_end` → 💬, `session_shutdown` → clear). Fails quietly when `wt` is unavailable.

Pattern: `wt switch -x pi -c <branch> -- '<task>'` creates a worktree and launches pi inside it.

---

## Quick Reference Card

| Situation                   | Action                                        |
| --------------------------- | --------------------------------------------- |
| Understand unfamiliar code  | `/run scout "Map X"`                          |
| Need external evidence      | `/run researcher "Research X"`                |
| Hard decision before acting | `/run oracle "Advise on X"`                   |
| Complex work ahead          | `/grill-with-docs` first, then `/run planner` |
| Implement feature           | `/run builder` (after plan approved)          |
| After implementation        | Parallel `/run reviewer` (fresh context)      |
| Bug investigation           | `/diagnose` or `/run oracle`                  |
| New feature idea            | `/grill-me` → `/to-prd`                       |
| Breaking down a plan        | `/to-issues`                                  |
| Periodic codebase health    | `/improve-codebase-architecture`              |
| Design exploration          | `/prototype`                                  |
| Compact mode                | `/caveman`                                    |
| Handoff to another session  | `/intercom` (Alt+M)                           |
