# Inter-Session Coordination (pi-intercom)

Coordinate with other pi sessions on the same machine. The `npm:pi-intercom` package is not currently installed in this setup — this file documents the protocol for when the extension is present (e.g. when copied locally to `~/.pi/agent/extensions/`).

## When to Coordinate

**When:** Same codebase (parallel work), reference codebase (consulting patterns), related repos (shared libraries).

**Not when:** Unrelated codebases, trivial questions, or when you can proceed independently.

## Principles

- Prefer `send` for notifications; `ask` only when blocked waiting for input
- `ask` is blocking — one pending ask at a time
- Name sessions with `/name` for stable intercom targeting

## Quick Reference

```typescript
intercom({ action: "list" }); // List active sessions
intercom({ action: "send", to: "session", message: "..." }); // Fire-and-forget
intercom({ action: "ask", to: "session", message: "..." }); // Blocking wait
intercom({ action: "reply", message: "..." }); // Reply to pending ask
```

## Planner-Builder Pattern

```
Planner session                    Builder session
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
