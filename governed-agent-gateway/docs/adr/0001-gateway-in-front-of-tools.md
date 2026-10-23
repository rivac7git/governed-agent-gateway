# ADR 0001: One gateway in front of every tool

**Status:** accepted

## Context
An agent connected straight to business systems makes every tool its own security decision. Reviewers cannot answer "what may it do, and what did it do?" without reading each tool.

## Decision
All tools sit behind one gateway. Policy lives in a registry (tier, read/write mode, approver, active flag), not in tool code. Writes are never executed on the model's call; approval is a human-only path outside MCP. Every decision is written to a hash-chained audit log.

## Consequences
- Adding or disabling a tool is a registry change, reviewable by a security team.
- Controls are testable in one place, so evals can target them and mutants can prove the evals bite.
- The gateway is a single point of failure and a single point of policy. Accepted: that is the point.
- Tiers are a coarse model. Finer, per-field policy is a later extension.
