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
| `documenter`      | Documentation and README generation                                      | fork    |
| `red-team`        | Security and adversarial testing                                         | fork    |
| `plan-reviewer`   | Plan critic — reviews and validates plans before execution              | fork    |
| `bowser`          | Headless browser automation via Playwright CLI                          | fork    |

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

## Worktrees (parallel agent isolation — required, not optional)

**Rule:** any time you spawn parallel subagents that edit files, each agent MUST run in its own git worktree. No worktree = race conditions on shared files. This is a hard requirement, not optional.

[worktrunk](https://worktrunk.dev/) is the CLI for this. It wraps `git worktree` with branch-addressed commands, hooks, and a multi-worktree dashboard. Install once, then `wt` is the only command you need.

### Setup (once)

```bash
brew install worktrunk
wt config shell install   # required: lets wt switch actually change directories
```

### Single-agent isolation

```bash
wt switch --create feat/my-task    # create branch + worktree, cd into it
# ... do your work in the worktree ...
wt step commit                     # commit staged changes
wt merge main                      # squash + rebase + ff merge + auto-remove
# or: gh pr create && wt remove    # PR workflow
```

### Parallel agents (one worktree per subagent)

Each subagent gets its own branch and worktree. The `-x` flag launches a command inside the worktree:

```bash
wt switch -x pi -c feat/auth-flow    -- 'add user authentication' &
wt switch -x pi -c fix/pagination    -- 'fix the pagination bug' &
wt switch -x pi -c test/api-coverage -- 'add API tests' &
wait
wt list
```

`wt switch` creates the branch from the default branch, makes the worktree, and `cd`s into it. Path follows the template `~/repo.<branch>` by default.

### Tracking the fleet: `wt list`

```bash
wt list                  # compact: branch, status, divergence, last commit
wt list --full           # + CI status and LLM summaries
wt list --format=json    # machine-readable for scripts / orchestrators
```

Key symbols in the Status column:

| Symbol | Meaning |
|---|---|
| `@` | current worktree (your shell is here) |
| `^` | primary worktree (default branch) |
| `+` | other worktree |
| `+` / `!` / `?` | staged / modified / untracked |
| `↑` / `↓` / `↕` | ahead / behind / diverged from default branch |
| `_` | empty (same as default branch, clean — safe to remove) |
| `⊂` | integrated (already in default branch via different history) |

### Cleanup

A worktree is safe to remove when `wt list` shows it as `_` (empty) or `⊂` (integrated):

```bash
wt remove feat/auth-flow
```

If you used `wt merge main` already, the worktree and branch are removed in one shot.

### Configuration (optional)

Default worktree path is `~/repo.<branch>`. Override via `~/.config/worktrunk/config.toml`:

```toml
worktree-path = "{{ repo_path }}/.worktrees/{{ branch | sanitize }}"
```

Per-project config in `.config/wt.toml` (hooks, dev servers, etc).

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
| Handoff to another session  | `/coms`                           |
