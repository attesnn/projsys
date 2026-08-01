# Agent instructions

Before changing this codebase, read **[README.md](./README.md)** in full. It is the continuity brief for product intent, domain invariants, tab behavior, Gantt scales, allocation metrics, stakeholder roles, conflicts, storage, and file ownership.

Do not reintroduce removed features (column locking, task `due`-only model, assignment-row Resource allocation, stored `allocationPct` on Assignment) unless the user asks.

Stakeholder **resource** mode is a demo persona switch (not auth): keep data scoped via `effectiveResourceFilterId` and do not restore manager-only tabs/actions while that role is active.
