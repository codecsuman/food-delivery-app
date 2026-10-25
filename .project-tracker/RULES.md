# Project Tracking Rules — Mandatory for All Agents (Human & AI)

> **Purpose:** Ensure `.project-docs/`, `.project-tracker/`, and `.bug-reports/` stay accurate and useful for any future developer or AI agent.
> **Location:** `C:\Users\SUMAN JHANP\PROGRAMMING\MERN\food-app-yt-main/.project-tracker/RULES.md`
> **Last Updated:** 2026-10-18

---

## 🚨 Golden Rule

> **Any modification to the project codebase, configuration, dependencies, deployment, or environment MUST be accompanied by updates to the tracking files.** No exceptions.

---

## 📋 Required Updates per Change Type

| Change Type | Files to Update | What to Update |
|-------------|-----------------|----------------|
| **New feature** | `CHANGELOG.md`, `CURRENT_STATE.md`, `PROJECT_OVERVIEW.md` (if API/architecture changes) | Add entry, refresh feature list, update endpoints/architecture |
| **Bug fix** | `CHANGELOG.md`, `CURRENT_STATE.md`, `BUG_LOG.md` (mark fixed) | Add entry, update status, mark bug resolved |
| **Refactor** | `CHANGELOG.md`, `CURRENT_STATE.md` | Add entry, update affected component descriptions |
| **Config/Env change** | `CHANGELOG.md`, `CURRENT_STATE.md`, `PROJECT_OVERVIEW.md` (env section) | Add entry, update env docs, note deployment impact |
| **Dependency update** | `CHANGELOG.md`, `CURRENT_STATE.md` | Add entry, note version changes & breaking changes |
| **Deployment change** | `CHANGELOG.md`, `CURRENT_STATE.md`, `PROJECT_OVERVIEW.md` (deployment section) | Add entry, update URLs, env requirements |
| **Security fix** | `CHANGELOG.md`, `CURRENT_STATE.md`, `PROJECT_OVERVIEW.md` (security section) | Add entry, document vulnerability & fix |
| **Bug discovered** | `BUG_LOG.md` | Add new bug entry with severity, reproduction steps, affected files |

---

## 📝 Update Procedures

### 1. CHANGELOG.md (`.project-tracker/CHANGELOG.md`)
- **Prepend** new entries at the top (newest first)
- Use format: `## YYYY-MM-DD | Author | type | files | description`
- Include bullet points for multiple changes in one session
- Reference related bug IDs from `BUG_LOG.md` if applicable (e.g., `Fixes #BUG-003`)

### 2. CURRENT_STATE.md (`.project-tracker/CURRENT_STATE.md`)
- Keep a **living snapshot** of what's implemented, in-progress, and known issues
- Update the relevant section(s) only — don't rewrite the whole file
- Track: features ✅/🚧/❌, API endpoints, env vars, deployment status, known bugs

### 3. PROJECT_OVERVIEW.md (`.project-docs/PROJECT_OVERVIEW.md`)
- Update **only when architecture, API contracts, or major features change**
- Keep the "Key Features", "API Endpoints", "Environment Variables", "Known Issues" sections current
- This is the **quick-reference** for new agents — keep it concise

### 4. BUG_LOG.md (`.bug-reports/BUG_LOG.md`)
- **Every bug found** (by testing, user report, or code review) gets an entry immediately
- Use the bug template (see `BUG_LOG.md`)
- Assign unique ID: `BUG-XXX` (incrementing)
- Mark status: `Open` → `In Progress` → `Fixed` → `Verified`
- Link to `CHANGELOG.md` entry when fixed

---

## 🤖 AI Agent Instructions

When you (an AI agent) make **any** change to the project:

1. **Before finishing your task**, update all applicable tracking files per the table above
2. **Do not wait for the user to ask** — this is part of the deliverable
3. If you discover a bug while working, **log it in `BUG_LOG.md` immediately** (even if you fix it in the same session)
4. Use the current date (`YYYY-MM-DD`) and identify yourself as `AI Agent (OpenCode)` or similar
5. If you're unsure whether a change warrants tracking, **track it anyway** — over-documentation is better than gaps

---

## 👤 Human Developer Instructions

When you make changes directly (IDE, terminal, GitHub UI):

1. **Update tracking files in the same commit** (or immediately after)
2. Treat tracking updates as **part of the feature/fix**, not optional cleanup
3. If you're in a hurry, at minimum update `CHANGELOG.md` — fill in details later

---

## 🔒 Git Integration

- **These three folders are git-ignored** (see `.gitignore`):
  - `.project-docs/`
  - `.project-tracker/`
  - `.bug-reports/`
- **Do NOT commit them** — they contain local-only context, secrets references, and work-in-progress notes
- If you want to share project docs, copy relevant sections to `README.md` or a wiki

---

## 📂 Folder Structure & Purpose

```
.project-docs/
  └── PROJECT_OVERVIEW.md       # High-level reference for any agent (architecture, APIs, env, features)

.project-tracker/
  ├── CHANGELOG.md              # Chronological log of ALL changes
  ├── RULES.md                  # This file — mandatory rules
  └── CURRENT_STATE.md          # Living snapshot of implementation status

.bug-reports/
  └── BUG_LOG.md                # All discovered bugs (UI/UX, logic, performance, security)
```

---

## ✅ Compliance Checklist (run mentally after every change)

- [ ] Did I update `CHANGELOG.md` with date, author, type, files, description?
- [ ] Did I update `CURRENT_STATE.md` for any feature/status changes?
- [ ] Did I update `PROJECT_OVERVIEW.md` if APIs/architecture/env changed?
- [ ] Did I log any discovered bugs in `BUG_LOG.md`?
- [ ] Did I mark fixed bugs as `Verified` in `BUG_LOG.md`?
- [ ] Are the three folders still in `.gitignore`?

---

## 🎯 Example Workflow

**Scenario:** You add a new "Save for Later" feature to the cart.

1. Implement the feature (frontend + backend)
2. Update `CHANGELOG.md`:
   ```markdown
   ## 2026-10-20 | Your Name | feat | client/src/components/Cart.tsx, server/controller/order.controller.ts | Added "Save for Later" to cart — moves items to a saved list, persists in user profile
   ```
3. Update `CURRENT_STATE.md` → Features → Customer → add "Save for Later" ✅
4. Update `PROJECT_OVERVIEW.md` → Key Features → Customer → add bullet
5. If you found a bug while testing (e.g., "saved items disappear on logout"), log in `BUG_LOG.md`

---

## 📌 Remember

> These tracking files are **your external brain**. Six months from now, you (or another AI) will thank you for keeping them current. The 2 minutes you spend updating them saves hours of re-discovery later.

**Enforcement:** If you notice tracking files are stale, **stop and update them** before continuing other work.