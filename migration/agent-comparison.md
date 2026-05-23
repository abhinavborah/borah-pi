# Agent Comparison: Your Agents vs disler's Agents

## Your Agents — COMPREHENSIVE

| Agent | Tools | Features |
|-------|-------|----------|
| **scout** | read, grep, find, ls, bash, write, intercom | /zoom-out skill, context.md output, contact_supervisor |
| **planner** | read, grep, find, ls, write, context7_*, deepwiki_*, intercom | /grill-with-docs, /to-issues, plan.md output, thinking:high |
| **reviewer** | read, grep, find, ls, bash, write, contact_supervisor | fresh context, correctness/tests/simplicity angles |
| **context-builder** | Full MCP toolkit (firecrawl, deepwiki, context7, web_search) | context.md + meta-prompt output |
| **delegate** | read, grep, find, ls, bash, write, edit, intercom | Fork context, parent-like behavior |
| **oracle** | read, grep, find, ls, bash, write, intercom | /diagnose skill, /grill-with-docs, high thinking |
| **worker** | Full toolkit + edit | /tdd, /diagnose skills, plan.md context |

**Total: 7 agents with comprehensive features**

### Key Features Your Agents Have (disler's don't):
- ✅ Thinking level configuration (low/medium/high)
- ✅ System prompt mode (replace/append)
- ✅ Project context inheritance (inheritProjectContext)
- ✅ MCP tools (context7, deepwiki, firecrawl variants)
- ✅ Skill invocations (/zoom-out, /grill-with-docs, /to-issues, /diagnose, /tdd)
- ✅ Supervisor coordination (contact_supervisor patterns)
- ✅ Default context mode (fork/fresh)
- ✅ Default reads (context.md, plan.md)
- ✅ Output file configuration

---

## disler's Agents — MINIMAL PLACEHOLDERS

| Agent | Tools | Description |
|-------|-------|-------------|
| **scout** | read, grep, find, ls | "Investigate quickly, do NOT modify" |
| **planner** | read, grep, find, ls | "Produce clear, actionable plans" |
| **reviewer** | read, bash, grep, find, ls | "Review for bugs, security, style" |
| **builder** | (minimal) | Basic implementation agent |
| **documenter** | (minimal) | Documentation agent |
| **red-team** | (minimal) | Adversarial testing |
| **plan-reviewer** | (minimal) | Plan critique agent |

**Total: 7 agents as minimal placeholders**

---

## Recommendation

**Your agents are 10x more comprehensive.** They include:
1. MCP tool integrations (context7, deepwiki, firecrawl)
2. Mandatory skill patterns (/use zoom-out, /use diagnose, etc.)
3. Thinking level configuration
4. Supervisor coordination patterns

**Suggestion:** 
- Keep your agents (they're from npm:pi-subagents and are well-designed)
- Copy disler's additional agents: `builder.md`, `documenter.md`, `red-team.md`, `plan-reviewer.md`
- Copy disler's `teams.yaml` and `agent-chain.yaml` (adapt to use your agent names where applicable)

---

## Migration Approach

### Keep:
```
~/.pi/agent/agents/
├── scout.md      # Your comprehensive version
├── planner.md    # Your comprehensive version  
├── reviewer.md   # Your comprehensive version
├── context-builder.md
├── delegate.md
├── oracle.md
├── worker.md
└── pi-pi/       # pi-pi experts (already migrated)
```

### Add (from disler):
```
~/.pi/agent/agents/disler/  (new directory for disler's additions)
├── builder.md
├── documenter.md
├── red-team.md
├── plan-reviewer.md
├── teams.yaml      # adapt to use your agent names
└── agent-chain.yaml # adapt to use your agent names
```

### Modify (agent-team.ts):
- Change path scanning to include `agents/disler/` in addition to default dirs
- OR adapt teams.yaml/agent-chain.yaml to reference your existing agents

---
*Created: 2026-05-22*