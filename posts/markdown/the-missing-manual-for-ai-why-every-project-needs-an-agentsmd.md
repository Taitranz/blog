---
title: "The Missing Manual for AI: Why Every Project Needs an AGENTS.md"
date: "21-11-2025 23:26:04"
description: "The Missing Manual for AI: Why Every Project Needs an AGENTS.md"
tags:
  - "AI Agents"
  - "Repository Engineering"
  - "LLM Context"
  - "Software Architecture"
---
![AGENTS.md Preview](../../assets/images/the_missing_manual_for_ai.png)

# The Missing Manual for AI: Why Every Project Needs an `AGENTS.md`

We are currently witnessing a fundamental shift in how software is built. We have moved past the era of "AI as a fancy autocomplete" and entered the era of "AI as an autonomous agent." These agents can plan, navigate file systems, execute terminal commands, and implement complex features across multiple files.

However, there is a catch.

While these models are incredibly smart, they are also incredibly ignorant. They have read the entire internet, yet they know absolutely nothing about your specific project. They do not know your variable naming conventions. They do not know why you chose SQLite over PostgreSQL. They do not know that you strictly forbid the use of `try/except: pass`.

When you drop a new human engineer into a codebase, you give them an onboarding buddy, a wiki, and a few days to read the docs. When you drop an AI agent into a codebase, it usually gets none of that. It is expected to perform instantly, often leading to subtle architectural violations, reinvention of existing wheels, and "drift" in coding style.

This is where **`AGENTS.md`** comes in.

It is a simple concept with profound implications: A Markdown file at the root of your repository, written specifically for an AI to read. It is not a `README.md` for humans. It is a system prompt for your repository.

In this post, we will explore why `AGENTS.md` is the most critical file you aren't writing, how to structure it, and why the token cost is a trade-off you should happily make.

## The "Senior Dev with Amnesia" Problem

Imagine hiring a Senior Staff Engineer from Google. They know Python inside and out. They know distributed systems. They know algorithms.

Now imagine that every time they sit down to write code for you, they have total amnesia about your company.

They sit down and think: *"I need to add a user. I'll just write a direct SQL query."*
You shout: *"No! We use an ORM!"*
They say: *"Oh, right. I'll use SQLAlchemy."*
You shout: *"No! We use Django ORM!"*

This is what interacting with an AI agent feels like without `AGENTS.md`. You spend the first ten turns of every conversation correcting its assumptions.

*   "Don't use `unittest`, use `pytest`."
*   "We don't use f-strings for logging, use lazy interpolation."
*   "This is a hexagonal architecture, you can't import the database in the domain layer."

This "Correction Loop" is exhausting. It wastes your time, and crucially, it wastes your context window.

## What is `AGENTS.md`?

`AGENTS.md` is a high-density context file. It acts as a bridge between the model's general training and your project's specific reality.

It serves three primary functions:

1.  **Orientation:** It tells the agent where things are.
2.  **Constraint:** It tells the agent what is forbidden.
3.  **Instruction:** It tells the agent how to perform common tasks.

Unlike a human `README`, which might be full of marketing fluff or setup instructions, `AGENTS.md` is purely functional. It is dense, imperative, and unambiguous.

## The Anatomy of an Effective `AGENTS.md`

Based on our experiments with large-scale agentic workflows, here is the ideal structure for an `AGENTS.md` file.

### 1. The "High-Level Map"

The first thing an agent does is scan the file list. Without context, a file named `utils.py` could mean anything.

Your `AGENTS.md` should start with a pragmatic map:

> **System Architecture**
> *   `core/`: Pure domain logic. No external dependencies.
> *   `adapters/`: Infrastructure code (Database, API clients).
> *   `gui/`: Qt/VisPy frontend code.
> *   `shared/`: Dependency Injection container and config.

This prevents the "grep search" phase where the agent blindly reads five unrelated files trying to find where the user model is defined.

### 2. The "Negative Constraints" (The Rules)

AI models are eager to please. If you ask for a feature, they will give you the quickest solution, which is often the dirtiest one. You need to explicitly block bad patterns.

We call these **Critical Rules**:

> **Critical Rules**
> 1.  **No Logic in UI:** Never put business logic in `Qt` widgets. Use the `Controller` classes.
> 2.  **Thread Safety:** The GUI runs on the main thread. All heavy computation must be offloaded to `Worker` threads.
> 3.  **No Raw SQL:** Always use the `Repository` interface.
> 4.  **No Emojis:** Do not add emojis to code comments or commit messages.

These negative constraints are powerful because they prune the search space. The agent stops considering "quick hacks" because you have explicitly forbidden them.

### 3. The "Tech Stack" Reality Check

You would be surprised how often an AI guesses the wrong version of a library. It might generate code for `Pydantic v1` when you are on `v2`.

Your `AGENTS.md` must be specific:

> **Tech Stack**
> *   **Language:** Python 3.13.8
> *   **Frontend:** PySide6 (Qt6)
> *   **Backend:** SQLite with WAL mode
> *   **Key Libs:** VisPy (OpenGL), CuPy (CUDA acceleration)

This eliminates the "Import Error" loop where the agent tries to import a module that was deprecated three years ago.

### 4. The "Known Issues" (Here Be Dragons)

Every codebase has skeletons. Maybe there is a specific function that crashes if you call it too fast. Maybe there is a circular dependency in the user module that you haven't fixed yet.

Tell the agent about them!

> **Known Issues**
> *   **VisPy Crashes:** Rapidly switching intervals can crash the canvas. Use the `QMutex` lock when updating chart data.
> *   **OANDA Data Gaps:** The data feed sometimes returns gaps. Use the `GapFiller` service, do not try to interpolate manually.

This turns a potential 2-hour debugging nightmare into a simple "Oh, I need to use the mutex" moment for the agent.

## The Token Economics: A Business Case

The most common objection to `AGENTS.md` is token usage.

*"My context window is 128k (or 200k) tokens. Why should I fill 2,000 of them with static documentation at the start of every single chat? That costs money!"*

Let's do the maths.

**Scenario A: The "Save Tokens" Approach**

1.  You prompt the agent: "Add a button to fetch historical data." (50 tokens)
2.  The agent hallucinates a solution using `requests` directly in the UI thread. (500 tokens output)
3.  You read it and type: "No, you blocked the UI. Use the async worker." (50 tokens)
4.  The agent apologises and rewrites it, but forgets to use the `LoggingManager`. (500 tokens output)
5.  You correct it again: "Use structured logging." (20 tokens)
6.  The agent rewrites it again. (500 tokens output)

**Total Cost:** ~1,600 tokens + 15 minutes of your time + frustration.

**Scenario B: The "`AGENTS.md`" Approach**

1.  You inject `AGENTS.md` into the system prompt. (2,000 tokens)
2.  You prompt: "Add a button to fetch historical data." (50 tokens)
3.  The agent reads the rules: *UI must use Workers. Use LoggingManager.*
4.  The agent generates the correct, async, logged solution on the first try. (500 tokens output)

**Total Cost:** ~2,550 tokens + 0 minutes of your time.

Yes, the *raw token count* is higher in Scenario B. But the **Engineering Value** is infinitely higher. You traded cheap compute tokens for expensive human attention tokens.

Furthermore, context caching is becoming standard. Many providers now cache the prefix of your prompt (the system instructions and files). Since `AGENTS.md` rarely changes between chats, you often pay the "read cost" only once per session or day, making the economics even more favourable.

## From Prompt Engineering to "Repository Engineering"

We are moving away from the art of writing the perfect prompt into the chat box. We are moving towards **Repository Engineering**: structuring your code and documentation so that it is "machine-readable" by default.

`AGENTS.md` is the flagship of this movement.

It acknowledges that your code is going to be read by machines more often than by humans. It optimises for that reality.

### How to Write Your Own `AGENTS.md`

Do not overthink it. You do not need perfect prose. Agents prefer bullet points.

1.  **Start Small:** Create the file. List your stack. List your top 3 "Do Not Do This" rules.
2.  **Iterate:** Every time the agent makes a mistake that you have to correct, add a rule to `AGENTS.md`.
    *   *Agent used `print()`?* -> Add rule: "Use `logger.info()`".
    *   *Agent created a new `utils.py`?* -> Add rule: "Put utilities in `shared/utilities`".
3.  **Link Deeper:** As your project grows, `AGENTS.md` should become an index. Point to `docs/architecture.md` or `docs/testing.md`. The agent can decide to read those if it needs deep detail, but `AGENTS.md` gives it the overview.

## Conclusion

The difference between a frustrating AI experience and a magical one is often just Context.

We are used to carrying the context in our heads. We know where the bodies are buried. We know why the `UserFactory` is implemented that way. But the AI doesn't.

`AGENTS.md` is how you download your mental model of the software into the agent's working memory. It is a bridge. It is a guardrail. And in a world where we pay by the token but profit by the feature, it is the most efficient way to scale your software development.

So, go ahead. Create the file. Give your agent a brain. Your future self (and your token budget) will thank you.

