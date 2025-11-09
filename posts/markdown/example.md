---
title: "Sample Markdown Post"
date: "2025-11-09"
description: "Demonstration post showing the markdown to HTML build pipeline."
tags:
  - Demo
  - Markdown
  - Automation
---

## Scaling AI-Assisted Development: A Documentation Architecture for Better Code Quality

### Introduction

Over the past year, I've transitioned to writing most of my code with AI assistance. Like many developers exploring AI-powered workflows, I initially treated AI coding assistants as smart autocomplete (helpful for boilerplate, decent at implementing straightforward features, but requiring constant supervision and correction).

The results were mixed. The AI would generate code that worked, but often violated project conventions, ignored architecture patterns, or required extensive refactoring. Each new chat session felt like onboarding a junior developer who had to re-learn the codebase from scratch.

I realised the bottleneck wasn't the AI's capabilities. It was how I was providing context. This post details a documentation architecture that solved this problem, dramatically improving the quality and consistency of AI-generated code.

### The Context Problem in AI-Assisted Development

#### How AI Coding Assistants Work

When you interact with an AI coding assistant, it needs to understand your codebase structure (where files live and how modules interact), your architecture patterns (Clean Architecture, DDD, MVVM, etc.), your coding standards (style guides, naming conventions, type safety requirements), your project constraints (Python version, dependencies, performance requirements), and your domain logic (business rules, data models, API contracts). Without this context, the AI falls back to generic patterns it learned during training. You might ask for a "service class" and get something that looks nothing like your existing service layer.

The AI needs to understand:

- Your codebase structure (where files live and how modules interact)
    

- Your architecture patterns (Clean Architecture, DDD, MVVM, etc.)
    

- Your coding standards (style guides, naming conventions, type safety requirements)
    

- Your project constraints (Python version, dependencies, performance requirements)
    

- Your domain logic (business rules, data models, API contracts)
    

#### The Traditional Approach: Search and Inference

Most AI workflows rely on two mechanisms for gathering context. First is semantic search, where the AI performs similarity searches across your codebase to find relevant code. This works reasonably well for localised changes but breaks down when understanding requires knowledge of multiple systems. Second is pattern inference, where the AI examines existing code to infer patterns and conventions. This is hit-or-miss. If the AI samples the wrong files or misunderstands a pattern, it propagates that misunderstanding.

The two main mechanisms:

- **Semantic Search**: Find relevant code through similarity searches (works for localised changes)
    

- **Pattern Inference**: Infer conventions from existing code (hit-or-miss approach)
    

#### Why This Breaks Down

As your project grows, these approaches encounter several problems:

- **Inconsistent sampling**: The AI might examine 3 files that follow one pattern and miss the 10 files that follow a different (better) pattern
    

- **Missing the "why"**: Code shows what you did, not why you did it. The AI sees you're using mutexes but might not understand your specific threading constraints
    

- **Context window limitations**: Even with large context windows, the AI can't keep your entire codebase in memory. It has to choose what to examine, and those choices aren't always optimal
    

- **Implicit knowledge**: Architecture decisions, known issues, and workarounds often live in developers' heads, not in code
    

- **Performance cost**: Extensive grepping and searching adds latency to every interaction
    

### The Solution: Structured Documentation Architecture

The approach that worked well inverts the problem: instead of making the AI work harder to infer context, provide explicit, structured documentation that's optimised for AI consumption.

This isn't about writing more documentation. It's about organising documentation into layers that match how AI assistants actually work.

#### Architecture Overview: Two-Layer System

The system has two distinct layers:

- **Layer 1: Navigation Files** - Small, always-loaded files that provide high-level rules and pointers
    

- **Layer 2: Reference Documentation** - Detailed documentation that gets loaded on-demand
    

Think of it like a website: Layer 1 is the homepage and navigation menu, Layer 2 is the individual pages you click through to.

Layer 1: The Entry Point Files

AGENTS.md / CLAUDE.md

This file lives in your project root and gets attached to every AI prompt. In Cursor and similar tools, you can configure this as an "always included" file.

What Goes Here:

​# Project Documentation

​

​## Start Here

​- [.agent/README.md](.agent/README.md) - Documentation index

​ - Quick system facts and tech stack

​ - Recent major features

​ - Complete documentation catalogue

​

​## System Architecture

​- [.agent/System/project_architecture.md](.agent/System/project_architecture.md)

​ - Codebase layout and module organisation

​ - Architecture patterns (Clean Architecture, DDD, Event-driven)

​ - Data model and database schema

​

​## Critical Rules

​

​### Code Quality Rules

​1. Never use `# type: ignore` - fix type issues properly

​2. No emojis in code, comments, or log messages

​3. Always run linters before completing: `mypy . ; ruff check`

​4. Use LoggingManager, not print statements

​5. Use typed domain objects (Value Objects) instead of raw dictionaries

​

​### AI Code Execution Policy

​NEVER run `python main.py` unless explicitly requested.

Key Principles:

The key to an effective entry point file is keeping it concise and focused. This file should be scannable in seconds. If it grows beyond a few hundred lines, you're doing it wrong. Don't duplicate documentation here; link to it instead. Rules that affect every code change (linting, type safety) go at the top. Update this whenever you add major documentation or change critical rules.

Key principles for the entry point file:

Brevity: Scannable in seconds, under a few hundred lines

Pointers over content: Link to documentation rather than duplicating it

Critical rules first: Linting and type safety rules at the top

Living document: Update when adding major docs or changing critical rules

Why This Works

When the AI starts working on a task, it reads this file first. It immediately knows:

What documentation exists and where to find it

What rules must never be violated

Where to look for specific information

This eliminates the "AI doesn't know what it doesn't know" problem. Instead of hoping the AI finds your architecture docs through semantic search, you tell it exactly where they are.

Layer 2: The .agent Folder

Structure

​.agent/

​├── README.md # Documentation index

​├── System/

​│ └── project_architecture.md # Complete system reference (1400+ lines)

​├── docs/

​│ ├── logging_guide.md # Feature-specific guides

​│ ├── forex_providers/

​│ │ ├── README.md

​│ │ └── oanda-data-gaps.md

​│ └── quirks/ # Known issues and workarounds

​│ ├── vispy-interval-switching-crash.md

​│ ├── border-radius-background-issue.md

​│ └── stylesheet-vs-palette.md

​├── rules/

​│ └── coding_preferences.md # Detailed coding standards

​└── technique/

​ └── batched-line-segments.md # Implementation techniques

The Documentation Index (.agent/README.md)

This is the second navigation layer. While AGENTS.md provides high-level pointers, README.md provides a detailed table of contents.

Example structure:

​# Project Documentation

​

​## Start Here

​- **[README.md]** - This file, documentation index

​- **[System/project_architecture.md]** - Complete system reference

​ - Section 1: Codebase Layout

​ - Section 2: Architecture Patterns

​ - Section 3: Performance Optimizations

​ - Section 4: Data Model

​

​## Feature Documentation

​

​### Logging System

​- [docs/logging_guide.md] - LoggingManager, decorators, correlation tracking

​

​### Implementation Quirks

​- [docs/quirks/vispy-interval-switching-crash.md] - Thread safety for VisPy

​

​## Quick Reference

​**Python Version:** 3.13.8

​**Tech Stack:** PySide6 (Qt6), VisPy (OpenGL), SQLite (WAL mode)

​**Key Patterns:** DI (ServiceContainer), Event Bus, Repository Pattern, Value Objects

Why the index matters:

When project_architecture.md is 1400 lines long, the AI needs a map. Without it, the AI either:

Reads the entire file (slow, wastes context window)

Tries to guess which section is relevant (often wrong)

Skips it entirely (loses critical context)

With an index that says "Section 3: Performance Optimizations includes event coalescing and mutex patterns," the AI can navigate directly to the relevant section.

Project Architecture Document

This is your comprehensive system reference. In my case, it's 1400+ lines covering:

Codebase Layout

​core/

​├── domain/ # Business logic, entities, value objects

​├── application/ # Use cases, application services

​└── infrastructure/ # Database, external APIs

​

​adapters/

​├── persistence/ # SQLite repository implementations

​└── external/ # Third-party service adapters

​

​gui/

​├── viewmodels/ # MVVM view models

​├── widgets/ # Qt custom widgets

​└── chart/ # VisPy chart components

​

​shared/

​├── events/ # Event bus and event definitions

​└── logging/ # LoggingManager

Architecture Patterns

The system uses several key architectural approaches:

Clean Architecture with clear layer boundaries

Domain-Driven Design with bounded contexts

Event-driven communication via EventBus

CQRS for read/write separation

Repository pattern for data access

Performance Patterns

To optimise performance, the system employs:

Event coalescing: Batching rapid events (mouse moves, resize events) to reduce processing

Mutex protection: QMutex for thread-safe data updates

Axis tick throttling: Debouncing expensive label recalculations

GPU acceleration: CuPy for RTX GPUs

Data Model

​# Domain Entity Example

​@dataclass

​class MarketDataPoint:

​ timestamp: datetime

​ open: Decimal

​ high: Decimal

​ low: Decimal

​ close: Decimal

​ volume: int

​

​# Value Object Example

​@dataclass(frozen=True)

​class TimeInterval:

​ value: str # "M1", "M5", "H1", "D1"

​

​ def to_seconds(self) -> int:

​ # ...

Key insight: This document serves as both AI reference and human onboarding. When a new developer (human or AI) joins, this is their system bible.

Feature-Specific Guides

Some features are complex enough to deserve dedicated documentation. In my project:

Logging Guide (docs/logging_guide.md)

​# Logging System

​

​## LoggingManager

​Central logging with profiles and keyword filtering.

​

​## Usage

​```python

​from shared.logging import get_logger

​

​logger = get_logger(__name__)

​logger.info("Processing data", extra={"correlation_id": ctx.correlation_id})

Decorators

@debug_trace - Trace function entry/exit

@timing - Measure execution time

Best Practices

Always use logger.info/debug, never print()

Include correlation_id for request tracing

Use structured logging with extra={}

​

​This level of detail would clutter `project_architecture.md`, but as a separate file, it's available when the AI is working on logging-related features.

​

​### Quirks Documentation

​

​This is documentation gold: known issues and their solutions.

​

​**Example: VisPy Thread Safety** (`docs/quirks/vispy-interval-switching-crash.md`)

​```markdown

​# VisPy Crash on Rapid Interval Switching

​

​## Problem

​Rapidly switching chart intervals crashes the application due to thread safety issues in VisPy updates.

​

​## Root Cause

​- Data updates happen on background threads

​- VisPy rendering happens on Qt main thread

​- No synchronisation leads to race conditions

​

​## Solution

​1. Protect chart data with QMutex

​2. Update data only when mutex can be acquired

​3. Skip updates if chart is mid-render

​

​## Implementation

​```python

​class ChartCanvas:

​ def __init__(self):

​ self._data_mutex = QMutex()

​

​ def update_data(self, data):

​ if self._data_mutex.tryLock(10): # 10ms timeout

​ try:

​ self._line.set_data(data)

​ finally:

​ self._data_mutex.unlock()

​

​**Why this matters**: Without this documentation, the AI might suggest data updates without mutex protection, reintroducing the bug. With it, the AI knows to use mutexes whenever touching VisPy data.

​

​### Coding Preferences

​

​Detailed coding standards that go beyond simple style rules:

​

​```markdown

​# Coding Preferences

​

​## Architecture Boundaries

​- `gui/` may import from `core/` but not vice versa

​- `core/domain/` must not import from `core/infrastructure/`

​- Use dependency injection for cross-layer communication

​

​## Error Handling

​- Use Result types for expected errors

​- Raise exceptions for programmer errors

​- Log all errors with context

​

​## Event-Driven Patterns

​- Coalesce rapid events (mouse moves, resize events)

​- Use QTimer with 250ms debounce for event coalescing

​- Always unsubscribe from EventBus in cleanup

​

​## Thread Safety

​- Use QMutex for shared data between threads

​- Throttle expensive operations (axis labels, tooltip updates)

​- Never update Qt widgets from background threads

​

​## Value Objects

​- Use dataclasses with frozen=True

​- Include validation in __post_init__

​- Prefer value objects over primitive types

Implementation: Step-by-Step Guide

Step 1: Create the Entry Point

Create AGENTS.md (or CLAUDE.md, COPILOT.md, etc.) in your project root:

​touch AGENTS.md

Start with the absolute minimum:

​# Project Documentation

​

​## Key Information

​**Python Version:** 3.x

​**Tech Stack:** [Your main frameworks]

​

​## Critical Rules

​1. [Your #1 must-follow rule]

​2. [Your #2 must-follow rule]

​

​## Documentation

​See `.agent/README.md` for complete documentation.

Configure your AI tool to always include this file.

Step 2: Create the .agent Folder

​mkdir .agent

​touch .agent/README.md

In .agent/README.md, create your documentation index. Start simple:

​# Documentation Index

​

​## Architecture

​- system_architecture.md (to be created)

​

​## Rules

​- coding_preferences.md (to be created)

Step 3: Document Your Architecture

This is the heavy lifting. Create .agent/System/project_architecture.md and document your folder structure (what's where and why), layer responsibilities (what each layer does), key patterns (architecture patterns you use consistently), data models (core entities and value objects), and dependencies (major libraries and why you chose them). Don't try to document everything at once. Start with a high-level folder structure (20 lines), 3-5 key architecture patterns (50 lines), and your most important domain entities (30 lines). You can expand this incrementally.

What to document:

Folder structure (what's where and why)

Layer responsibilities (what each layer does)

Key patterns (architecture patterns you use consistently)

Data models (core entities and value objects)

Dependencies (major libraries and why you chose them)

Alternative approach: You can use automated tools to generate an initial architecture document (see Resources section), but this is the lazier path. Automated generation saves time but requires you to thoroughly read and verify the output for correctness, completeness, and accuracy to your actual architecture decisions.

Step 4: Add Feature Documentation

As you build features with the AI, whenever you establish a pattern worth remembering, document it:

​mkdir .agent/docs

​touch .agent/docs/feature_name.md

Write just enough that the AI could implement a similar feature without asking questions.

Step 5: Capture Quirks

Every time you hit a weird bug or need a workaround, document it:

​mkdir .agent/docs/quirks

​touch .agent/docs/quirks/issue_description.md

Include:

Problem description

Root cause

Solution/workaround

Code example

Critical insight: Quirks documentation is especially important for issues involving technologies, libraries, or patterns that aren't well-represented in AI training data. When dealing with edge cases, unusual library combinations, or niche frameworks, the AI becomes fragile and falls apart easily without concrete examples. A documented quirk with a working code example prevents the AI from repeatedly suggesting solutions that don't work.

Step 6: Iterate

As you work with the AI, notice when it gets things wrong and ask yourself: "Could documentation have prevented this?" If yes, add or update documentation. Update AGENTS.md if you add new sections.

Benefits: Measuring Impact

Since implementing this architecture, I've seen concrete improvements:

1. Consistency

Before: AI would generate services with different error handling, logging, and structure from file to file.

After: AI consistently generates services that follow the same structure, use LoggingManager instead of print(), include proper error handling, and respect architecture boundaries.

AI now generates services that:

Follow the same structure

Use LoggingManager instead of print()

Include proper error handling

Respect architecture boundaries

Example: When I asked for a new data provider, the AI automatically created it in adapters/external/, implemented the repository interface from core/domain/, used the logging patterns from the logging guide, and included error handling that matched existing providers. No corrections needed.

The AI automatically:

Created it in adapters/external/

Implemented the repository interface from core/domain/

Used the logging patterns from the logging guide

Included error handling that matched existing providers

2. Reduced Iteration Cycles

Before: First AI generation, then 3-5 rounds of corrections, then final code

After: First AI generation, maybe 1 correction, then final code

Time saved per feature: ~30-40%

3. Fewer Linting Errors

Before: AI would generate code that failed mypy or ruff, requiring manual fixes

After: Because AGENTS.md says "Always run linters before completing," and the linter commands are documented, the AI catches issues before I see them.

Linting errors in first-pass code: Reduced by ~70%

4. Better Architectural Decisions

Before: AI might suggest putting business logic in GUI layer, or mixing concerns

After: AI suggests solutions that fit the existing architecture, respecting layer boundaries

Example: When I needed chart data caching, the AI suggested a repository layer for cache implementation (correct layer), event bus for cache invalidation (existing pattern), and value objects for cache keys (existing pattern). It didn't suggest bolting a cache onto the GUI layer, which it might have without architecture documentation.

The AI suggested:

Repository layer for cache implementation (correct layer)

Event bus for cache invalidation (existing pattern)

Value objects for cache keys (existing pattern)

5. Onboarding Speed

Before: Each new chat session required re-explaining project structure, patterns, rules

After: The AI references documentation automatically. New sessions are productive immediately.

6. Human Onboarding Benefit

An unexpected benefit: This documentation helps human developers too. When my colleague joined the project, they read the same documentation I wrote for the AI and were productive in hours, not days.

Key Principles and Best Practices

1. Layered Navigation is Critical

The documentation structure follows a clear path from AGENTS.md to .agent/README.md to specific docs. Each layer serves a purpose. Layer 1 contains what must always be known and pointers to everything else. Layer 2 is a detailed index that helps navigate large documents. Layer 3 contains detailed reference documentation. Don't collapse layers. A 1000-line AGENTS.md defeats the purpose.

The three layers:

Layer 1: What must always be known, pointers to everything else

Layer 2: Detailed index, helps navigate large documents

Layer 3: Detailed reference documentation

2. Pointers Over Duplication

When you're tempted to copy content from project_architecture.md into AGENTS.md, resist. Instead:

Bad:

​# AGENTS.md

​## Architecture Patterns

​We use Clean Architecture with:

​- Domain layer for business logic

​- Application layer for use cases

​...

Good:

​# AGENTS.md

​## Architecture

​See `.agent/System/project_architecture.md` for:

​- Codebase layout and module organisation

​- Architecture patterns (Clean Architecture, DDD)

​- Data model and domain entities

3. Living Documentation

Documentation that's out of date is worse than no documentation. It actively misleads the AI.

Make updating docs part of your workflow. Changed an architecture pattern? Update project_architecture.md. New critical rule? Update AGENTS.md. Fixed a nasty bug? Add a quirks document. I treat documentation updates the same way I treat tests: not optional.

4. Section Targeting in Large Files

When a file exceeds ~200 lines, add clear section headers:

​# Project Architecture

​

​## Table of Contents

​- [Section 1: Codebase Layout](#section-1-codebase-layout)

​- [Section 2: Architecture Patterns](#section-2-architecture-patterns)

​- [Section 3: Performance Optimisations](#section-3-performance-optimisations)

​

​## Section 1: Codebase Layout

​...

​

​## Section 2: Architecture Patterns

​...

This lets the AI (and humans) jump to relevant sections without reading the entire file.

5. Examples Are Essential

Whenever possible, include code examples:

Bad:

​Use Value Objects for domain data.

Good:

​Use Value Objects for domain data:

​

​```python

​@dataclass(frozen=True)

​class TimeInterval:

​ value: str # "M1", "M5", "H1"

​

​ def __post_init__(self):

​ if self.value not in VALID_INTERVALS:

​ raise ValueError(f"Invalid interval: {self.value}")

​

​The AI learns from examples much more effectively than from descriptions.

​

​### 6. Document the "Why"

​

​Code shows what you did. Documentation should explain why.

​

​**Bad**:

​```markdown

​Use QMutex when updating chart data.

Good:

​Use QMutex when updating chart data because:

​- Data updates happen on background threads

​- VisPy rendering happens on Qt main thread

​- Without synchronisation, race conditions cause crashes

​

​See docs/quirks/vispy-interval-switching-crash.md for details.

Common Pitfalls to Avoid

1. Too Much in AGENTS.md

I've seen developers try to cram everything into AGENTS.md because "it's always loaded."

Problem: A 2000-line AGENTS.md takes time to process and clutters every interaction.

Solution: Keep AGENTS.md under 300 lines. Use it as a map, not as the territory.

2. Documentation Without Structure

Just dumping markdown files in a folder doesn't help. The AI needs a navigation structure.

Problem: 20 markdown files in .agent/docs/ with no index.

Solution: Maintain .agent/README.md as a proper table of contents.

3. Stale Documentation

The worst documentation is documentation that's wrong.

Problem: You changed from logging library X to Y, but the docs still reference X. AI generates code using X.

Solution: Make documentation updates non-negotiable. If the PR changes patterns, it updates docs.

4. Over-Documentation

Not everything needs documentation. You don't need to document simple functions or straightforward CRUD operations.

Document:

Architecture patterns

Non-obvious design decisions

Known issues and workarounds

Complex features

Don't document:

Standard library usage

Simple utility functions

Self-explanatory code

5. Treating It As Reference Docs Only

This isn't API reference documentation. It's contextual documentation designed to help the AI make decisions.

Focus on:

"When to use pattern X vs pattern Y"

"Why we chose architecture Z"

"How feature A interacts with feature B"

Not:

"Function X takes parameter Y and returns Z" (that's what code comments and docstrings are for)

Alternatives and Comparisons

vs. Well-Written Code

Argument: "Good code should be self-documenting. If the AI reads my code, it should understand the patterns."

Response: This works for understanding what the code does, not why or when to use patterns. Code shows one solution but documentation can explain trade-offs. Finding the right code to read is the hard part. Code doesn't explain known issues or workarounds. Use both. Write clean code and maintain documentation.

Why documentation is still necessary:

Code shows one solution, documentation can explain trade-offs

Finding the right code to read is the hard part

Code doesn't explain known issues or workarounds

vs. AI Tools with "Codebase Understanding"

Argument: "My AI tool has codebase indexing. It understands my project without extra documentation."

Response: Indexing helps with "what exists" but not with architecture decisions and rationale, project-specific rules and conventions, known issues and their solutions, or performance optimisation patterns. Indexing and documentation are complementary, not alternatives.

What indexing misses:

Architecture decisions and rationale

Project-specific rules and conventions

Known issues and their solutions

Performance optimisation patterns

vs. Traditional Documentation Systems

Argument: "We already use Confluence/Notion/Wiki. Why duplicate in .agent/?"

Response: Traditional docs are optimised for human consumption with marketing language and formatting, scattered across multiple pages, potentially outdated information, and not structured for AI consumption. In contrast, .agent/ documentation is concise and factual, co-located with code, version controlled, and structured for AI parsing. If you have traditional docs, great. .agent/ is the AI-optimised layer on top.

Traditional docs:

Marketing language and formatting

Scattered across multiple pages

May include outdated information

Not structured for AI consumption

.agent/ documentation:

Concise and factual

Co-located with code

Version controlled

Structured for AI parsing

Advanced Patterns

Version Tracking in Architecture Docs

Add commit hashes to major documentation sections:

​## Performance Optimizations

​- Event coalescing implementation

​- Axis tick throttling with QTimer debouncing

​- Mutex protection for thread safety

​- **Last Updated:** Commit f09992e (2025-10-29)

This helps you know when documentation was last validated against actual code.

Migration Guides

When you make breaking architecture changes, document the migration:

​## Migration: Logging System Refactor (2025-10-15)

​

​### Old Pattern (Deprecated)

​```python

​print(f"Processing {item}")

New Pattern

​from shared.logging import get_logger

​logger = get_logger(__name__)

​logger.info("Processing item", extra={"item_id": item.id})

Migration Checklist

Replace all print() calls

Add correlation_id to log extra

Remove any old logging imports

​

​This helps the AI avoid using deprecated patterns.

​

​### Context-Specific Rules

​

​Sometimes rules apply only in specific contexts:

​

​```markdown

​## Thread Safety Rules

​

​### GUI Layer (gui/*)

​- NEVER update Qt widgets from background threads

​- Use QMetaObject.invokeMethod for cross-thread updates

​- All data updates must go through view models

​

​### Chart Layer (gui/chart/*)

​- Use QMutex.tryLock() for all VisPy data updates

​- 10ms timeout maximum to avoid blocking rendering

​- See docs/quirks/vispy-interval-switching-crash.md

The AI can apply different rules depending on what it's working on.

Measuring ROI

Documentation takes time. Is it worth it?

Initial investment:

Entry point file (AGENTS.md): 1-2 hours

Documentation index: 30 minutes

Initial architecture doc: 4-6 hours

Total: ~8 hours

Time-saving option: Using automated generation commands (generate_project_architecture.md and update_doc.md) can reduce initial documentation time to 2-3 hours. However, this is the lazier approach and requires thorough review time to verify accuracy, completeness, and architectural correctness. Budget at least 1-2 hours for reviewing and correcting automated output. The quality of your documentation still depends on your review and refinement.

Ongoing maintenance:

Update docs when patterns change: ~15 minutes per change

Add quirks documentation: ~30 minutes per issue

Estimate: 1-2 hours per month

Returns:

Time saved per feature: ~30-40% (measured in my project)

If you build 2-3 features per week, that's 2-4 hours saved weekly

Break-even: ~4 weeks

After the first month, it's pure profit. Plus, the documentation helps human developers too.

Conclusion

AI coding assistants are powerful, but they're only as good as the context you provide. Relying solely on semantic search and pattern inference works for small projects but breaks down as complexity grows.

Structured documentation architecture solves this by providing explicit context instead of forcing the AI to infer it, organising documentation in layers that match AI workflow, maintaining a single source of truth for architecture decisions, and capturing knowledge that doesn't live in code (the "why" and the quirks). The pattern is simple: an entry point file with rules and pointers, a documentation index for navigation, and detailed reference docs for architecture, features, and quirks.

How it solves the problem:

Providing explicit context instead of forcing the AI to infer it

Organising documentation in layers that match AI workflow

Maintaining a single source of truth for architecture decisions

Capturing knowledge that doesn't live in code (the "why" and the quirks)

The three-part pattern:

Entry point file with rules and pointers

Documentation index for navigation

Detailed reference docs for architecture, features, and quirks

The investment is modest (a few hours upfront, minimal ongoing maintenance), and the returns are substantial: more consistent code, fewer iterations, faster development, and better architecture adherence.

If you're writing significant amounts of code with AI assistance, structured documentation isn't optional. It's how you scale the practice from "helpful autocomplete" to "true pair programming."

The AI doesn't need to be perfect at inferring your codebase. It just needs good documentation to reference.

Resources

Want to implement this in your project? Create AGENTS.md in your project root with critical rules and pointers. Create .agent/README.md as your documentation index. Create .agent/System/project_architecture.md for architecture documentation. Configure your AI tool to always include AGENTS.md. Then document incrementally as you build. Start small. Even a basic structure will improve code quality. You can expand the documentation as your project grows.

Implementation steps:

Create AGENTS.md in project root with critical rules and pointers

Create .agent/README.md as your documentation index

Create .agent/System/project_architecture.md for architecture documentation

Configure your AI tool to always include AGENTS.md

Document incrementally as you build

Automated Architecture Generation

For those who want to save time on the initial setup, you can use automated codebase analysis tools to generate project_architecture.md. However, this is the lazier approach and comes with important caveats. Automated tools scan your codebase and generate documentation based on static analysis, but they can't understand your architectural intentions, design decisions, or the "why" behind your patterns.

If you use automated generation, you must thoroughly review the output for:

Accuracy of detected patterns and structures

Completeness of architecture decisions

Correctness of dependency relationships

Missing context about why certain patterns were chosen

Incorrect assumptions about your system design

Important: Use the best AI model available for documentation generation. High-quality documentation requires strong reasoning and comprehensive codebase analysis. In Cursor, use Claude Sonnet 4.5 or the latest frontier model. The quality of generated documentation directly correlates with the model's capabilities.

Initial Documentation Generation Command:

Save this as .cursor/commands/generate_project_architecture.md (or adapt for your AI tool):

​You are an expert codebase analyst and documentation maintainer.

​Goal: produce ONE authoritative architecture doc for new engineers and keep the docs index current.

​

​PRIMARY OUTPUT

​- Create or update `.agent/System/project_architecture.md`.

​- Also maintain `.agent/README.md` as an index.

​

​AGENT DOC STRUCTURE

​.agent

​- Tasks/ # PRDs & implementation plans (optional)

​- System/ # System architecture docs

​- SOP/ # Task SOPs (migrations, adding routes, etc.)

​- README.md # Index of all docs

​

​OPERATING MODES

​1) Initialise documentation

​ - Deep scan frontend and backend

​ - Generate `project_architecture.md` covering: project goal, structure, tech stack,

​ integration points, data/storage schema, core flows

​ - Update `.agent/README.md` with a clean index

​

​2) Update documentation

​ - Read `.agent/README.md` to understand existing docs

​ - Update only what changed in `project_architecture.md`

​ - Refresh `.agent/README.md` index

​

​CONTENT REQUIREMENTS FOR `project_architecture.md`

​# 1. Overview - 3-5 sentence system summary and project goal

​# 2. Codebase Layout - Key directories with roles

​# 3. Services and Modules - Purpose, entrypoints, key deps, interfaces

​# 4. Dependency Graphs - Package summary and internal import graphs

​# 5. Data Model - Stores, core entities, relations, migration strategy

​# 6. API Surface - Public endpoints, auth, external integrations

​# 7. Observability and Ops - Logging, metrics, tracing, health checks

​# 8. Security and Compliance - AuthN/Z model, secrets handling

​# 9. Runtime Topologies - Local, staging, prod environments

​# 10. Known Gaps and Risks - Uncertainties and architectural risks

​# 11. Quickstart for New Agents - Prerequisites, bootstrap steps

​# 12. Glossary - Domain terms and acronyms

​

​DOC QUALITY RULES

​- Consolidate. No overlap between files

​- Prefer concise bullets over prose. No marketing language

​- Include file references with line numbers where possible

Update Existing Documentation Command:

Save this as .cursor/commands/update_doc.md:

​You are an expert code documentation expert, your goal is to provide super accurate

​& up to date documentation of the codebase.

​

​# When asked to update documentation

​- **Check git commits first** to understand what has changed:

​ - Run `git log --oneline -30` to see recent commits

​ - Review commit messages and changed files

​- Read README.md first to understand what already exists

​- Update relevant parts in system & architecture design based on git commit analysis:

​ - New features and capabilities

​ - Architectural changes and refactorings

​ - Performance optimizations

​- Update the commit hash and date in documentation headers

​- Always update the README.md to include an index of all documentation files

​

​# Best Practices

​- **Be thorough**: Check at least 20-30 recent commits

​- **Cross-reference**: Add file references and line numbers

​- **Use semantic search**: When unclear about a feature

​- **Summarize changes**: Create a "Recent Major Features" section

​- **Verify accuracy**: Ensure file paths are still valid

Note: Always use the best available AI model when generating or updating documentation. Better models produce more accurate architecture analysis, better identify patterns, and generate more comprehensive documentation. The investment in frontier model usage pays off in documentation quality.

These commands work with AI coding assistants like Cursor, but require careful review of the generated output regardless of the model used.

_This approach has transformed how I work with AI coding assistants. The code quality is higher, the development velocity is faster, and onboarding (both AI and human) is dramatically easier. If you're exploring AI-assisted development at scale, structured documentation architecture is worth trying._
