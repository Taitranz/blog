---
title: "Socslingo: A Duolingo-Inspired Java Clone Post-Mortem"
date: "10-11-2025 00:09:39"
description: "Socslingo: A Duolingo-Inspired Java Clone Post-Mortem"
tags:
  - Java
  - "Post Mortem"
  - "Desktop Development"
  - JavaFX
---

![Socslingo Preview](../../assets/images/socslingo_preview.png)

This was my first real exposure to `Java`. Coming from other languages, I had six weeks to deliver a functional language learning application as a university project, juggling this alongside other coursework and commitments. The brief was straightforward: build something that demonstrates understanding of object-oriented programming, database integration, and GUI development. What emerged was far more ambitious than the requirements demanded.

The compressed timeline and parallel demands meant that every technical decision became a calculated trade-off between ideal architecture and shipping features, where pragmatism consistently won out over perfectionism. There were moments where I knew the "right" way to solve a problem but opted for the "fast" way instead. Sometimes this was copy-pasting an entire controller and modifying it rather than extracting shared logic. Other times it was hardcoding a path because externalising it to a config file would take an extra hour.

Looking back at the final codebase, the scale is somewhat absurd for a six-week solo project:
- 26 controllers managing different aspects of the UI
- 37 `FXML` view files defining layouts
- 21 `CSS` stylesheets for styling (with significant duplication)
- An intricate web of managers, services, and data access objects that make up the application's architecture

The project contains roughly 8,000 lines of `Java` code across models, services, controllers, and data access layers, plus another few thousand lines of `FXML` and `CSS`. For someone learning `Java` for the first time, this represented both an ambitious vision and the necessary compromises that emerged from working at such intensity.

## What We Built: Feature Overview

Socslingo emerged as a feature-rich language learning platform, particularly focused on Japanese language study. The application attempts to recreate several core Duolingo mechanics while adding some unique twists.

The authentication system supports full user registration and login with `SHA-256` password hashing (more on the security implications later). Once logged in, users land on a home dashboard that shows their learning statistics and provides access to different study modes. The profile system allows users to upload custom banner images, which get automatically resized to 720x405 pixels and cached for performance. The profile also displays character recognition statistics, tracking how many Hiragana, Katakana, and Kanji characters the user has correctly identified.

At the heart of the application is a flashcard system that's more sophisticated than initially planned:
- Users can create individual flashcards with front and back text (typically Japanese on one side, English on the other)
- Flashcards can be organised into custom decks, with a many-to-many relationship allowing a single flashcard to exist in multiple decks
- The deck management interface includes a right sidebar showing all available flashcards, drag-and-drop style addition/removal of cards from decks, and real-time previews
- When studying, flashcards appear with 3D flip animations, randomised order to prevent memorisation of sequence rather than content, and progress tracking showing how many cards remain in the session

The character recognition activities are where the Duolingo inspiration is most apparent. Users can practice Hiragana, Katakana, or Kanji through multiple-choice quizzes that present a character and ask them to select the correct reading. The activity screen includes:
- A progress bar showing advancement through the lesson
- A heart-based lives system (starting with 5 hearts, losing one for each incorrect answer or skipped question)
- Dynamic UI feedback where the bottom section transitions colour (green for correct, red for incorrect) with smooth animations
- Background preloading of the next question while the user is answering the current one, creating a seamless experience with no loading delays between questions

The UI throughout features extensive animations:
- Fade transitions when switching between major screens
- Card flip rotations using 3D transforms
- Progress bar animations that smoothly fill rather than jump to values
- Colour transitions on UI elements responding to user actions
- An animated gradient that bounces across a status bar when navigation buttons are clicked

An intermission screen featuring the application mascot (a small character graphic) appears with fade effects when transitioning into major activities, providing visual breathing room and hiding any background loading.

Scene management handles the complexity of multiple views with different layout requirements:
- Some views (like the home page and deck management) show both left and right sidebars for navigation and context-sensitive tools
- Others (like the activity screens) hide both sidebars entirely to maximise focus on the learning content
- The `SceneManager` preloads frequently-used scenes like login and registration to eliminate loading delays
- It manages sophisticated fade in/out transitions with proper timing coordination

## The Good: What Actually Worked

### Architecture That Scaled

The layered architecture followed a fairly standard `MVC` pattern, though implemented without any framework beyond `JavaFX` itself. The separation between controllers (UI logic), services (business logic), data access objects (database operations), and managers (cross-cutting concerns like sessions and scenes) created clear boundaries that actually held up as the codebase grew.

The data flow follows a consistent pattern:
- Controllers handle `FXML`-bound UI events and call Services
- Services contain business logic and call `DAOs`
- `DAOs` handle all `SQL` operations and return Model objects

When I needed to add character recognition statistics tracking late in development, I could create `CharacterRecognitionStatisticsDAO` with methods like `updateStatistics(userId, correct, incorrect)`, wrap it in a `CharacterService` with business logic for determining when to update stats, and integrate it into the `ProfileController` to display the data, all without touching the existing flashcard or deck systems.

The `ControllerManager` acts as a primitive dependency injection container. While it's basically a giant switch statement mapping controller classes to their instantiated versions with injected dependencies, it at least keeps all that wiring in one place. Every controller gets its dependencies through constructor injection, which made it reasonably clear what each controller needed. The downside is that adding a new controller means updating the `ControllerManager`'s call method, adding the service/`DAO` dependencies if they're new, and making sure the instantiation order doesn't cause any issues.

### Scene Management

The `SceneManager` centralised navigation logic in a way that actually paid off as the application grew. It manages a single `Stage` (`JavaFX`'s top-level window container) and swaps out the `Scene`'s root `Node` when switching views, rather than creating multiple stages or windows. This keeps memory usage lower and provides a consistent window size and position.

The preloading strategy loads the login and registration `FXML` files once during initialisation, parses them into the scene graph, applies `CSS`, and caches the resulting `Parent` nodes in a `HashMap` keyed by `FXML` path. When the user switches between login and registration (which happens frequently during testing and development), the app just swaps in the cached `Node` with no file I/O or parsing overhead. Non-preloaded scenes get loaded on-demand but still go through the same centralised loading process, applying `CSS` and setting up fade transitions consistently.

The intermission screen deserves its own mention because it demonstrates thinking about user experience beyond pure functionality. When entering character recognition activities, there's a brief pause where the `SceneManager` shows a cute mascot graphic with fade-in and fade-out animations. This serves multiple purposes:
- It provides visual feedback that something is happening
- It gives the preloading system time to prepare the next activity in the background without the user seeing a frozen UI
- It creates a psychological "moment" before entering a focused learning session

The screen gets preloaded once and reused across all activity transitions, with `ImageView` sizing bound to the container dimensions so it scales appropriately.

### Image Caching System

The `ImageCache` implementation uses `JavaFX`'s `Service` and `Task` classes for asynchronous loading, which was surprisingly tricky to get right for a first `Java` project. The cache follows the singleton pattern (for better or worse) and maintains a `ConcurrentHashMap<Integer, Image>` mapping user IDs to their banner images.

On application startup, before showing any UI, the cache scans the `profile_banners` directory, identifies all image files, extracts user IDs from filenames (which follow the pattern `banner_user_{id}_{timestamp}.{ext}`), and spawns background threads using `JavaFX`'s `Service` to load each image. The `Service` pattern provides proper lifecycle management, error handling, and the ability to update UI (via `Platform.runLater`) when loading completes. Each image gets loaded with quality settings maximised (`new Image(uri, 0, 0, true, true, true)`) to preserve the resizing work done during upload.

The `ProfileController` can then immediately request cached images without any I/O delay. When a user uploads a new banner, the process:
- Deletes the old image file
- Saves the new one (resizing it to exactly 720x405 pixels using `Java AWT`'s `BufferedImage` with bicubic interpolation for quality)
- Updates the database path
- Removes the old image from the cache
- Preloads the new one in the background

This means subsequent profile views show the new image instantly.

The major flaw is that nothing ever gets evicted from the cache. Every banner image loaded stays in memory until the application closes. For the expected use case (single user on a desktop machine), this is fine. For a multi-user deployment or long-running instance, this would be a memory leak. An `LRU` cache with size limits would have been the proper solution, but that would have required implementing or integrating a caching library, and honestly, premature optimisation wasn't the goal.

### Comprehensive Logging

Using `SLF4J` with `Logback` throughout the codebase created an audit trail that helped during development. Every controller, service, and `DAO` logs its operations. When character recognition activities failed to load, the logs showed which `FXML` file couldn't be found. When database operations failed, the logs indicated which `SQL` statement and parameters were involved. This made debugging more straightforward than hunting through stack traces alone.

### UI Animations

The application uses `JavaFX`'s timeline and transition APIs throughout:
- Flashcard flips use `RotateTransition` with 3D axis rotation
- The continue/check button morphs between states with style class manipulation and colour transitions
- The progress bar animates using `KeyFrame` timelines
- The bottom section of activity screens changes colour based on answer correctness

These animations add polish, though they do add complexity to controllers that are already doing too much.

## The Okay: Functional But Not Optimal

### State Management

The application relies heavily on `SessionManager` for user state and `SelectedCategory` for activity configuration. While functional, these global singletons create hidden dependencies that make testing difficult and can lead to stale state bugs. For example, the character practice activities read from `SelectedCategory.getSelectedCategory()`, which means the category selection logic is scattered rather than explicitly passed through the call chain. Similarly, almost every controller accesses `SessionManager.getInstance().getCurrentUser()` directly. A more robust approach would have been to inject these dependencies or use a proper state management pattern, but for a six-week timeline, these singletons kept things moving.

### Database Connection Management

The `DatabaseManager` follows the singleton pattern and creates new connections on demand with `getConnection()`. Each data access method opens a connection, executes `SQL`, and closes it in `try-with-resources` blocks. This works and prevents connection leaks, but it means we're opening and closing database connections constantly rather than using connection pooling. For a desktop `SQLite` application with single-user access, the performance impact is negligible, but it represents a scalability limitation. The code also hardcodes the database path (`"src/main/database/socslingo_database.db"`) rather than making it configurable, which complicated testing and deployment.

### Manual Dependency Wiring

The `ControllerManager` creates services and data access objects manually, instantiating dependencies at construction time. This pattern appears throughout:

```java
public Object call(Class<?> controllerClass) {
    if (controllerClass == LoginController.class) {
        return new LoginController(userService);
    }
    if (controllerClass == FlashcardController.class) {
        return new FlashcardController(flashcardService);
    }
    // ... 26 more controllers
}
```

It works, but adding a new controller requires updating this method. A dependency injection framework like `Spring` or even a simpler solution with reflection would have reduced boilerplate and made the system more maintainable. However, for someone learning `Java` for the first time, manually wiring dependencies probably provided better understanding of how objects relate to each other.

### FXML and CSS Proliferation

With 37 `FXML` files and 21 `CSS` files, there's significant duplication in styling and layout. Many views share similar structures (a main content area, buttons with similar styling, headers with similar layouts) yet each is defined separately. `JavaFX` doesn't have component composition patterns like modern web frameworks, so we ended up with repeated `FXML` structures. The `CSS` files show similar patterns; multiple files define variations on button styles that could have been consolidated using better class naming strategies. This made consistent styling changes painful.

### Test Coverage

The test suite consists entirely of basic model unit tests: verifying getters, setters, constructors, and `toString` methods. While these tests are well-written and provide value, they're essentially testing `Java`'s built-in functionality rather than application logic. There are no tests for services, data access objects, or controllers. The business logic that determines whether a flashcard answer is correct, how decks are managed, or how character recognition activities are scored goes untested. For a university project under time pressure, this is understandable (the application works as demonstrated) but it represents technical debt that would need addressing before any production use.

## The Bad: Compromises and Shortcuts

### Hardcoded Constants and Magic Strings

Throughout the codebase, `FXML` paths, `CSS` paths, and resource paths are repeated as string literals. `PrimaryController` contains a button-to-`FXML` mapping with strings like `"/com/socslingo/views/home.fxml"` scattered across multiple methods. If we renamed a view file, we'd need to find and replace it in multiple locations. `CSS` class names are similarly hardcoded; `ActivityMainController` manipulates classes like `"activity-continue-button__label--medium-type-incorrect-hover"` directly in code. These long, hyphenated names are fragile. A typo means a silently failing style change that's hard to debug.

### Inconsistent Error Handling

Error handling varies wildly across the codebase:
- Some methods show `Alert` dialogues to users
- Some log errors and return `null` or `false`
- Some throw `RuntimeExceptions` wrapped around caught exceptions
- Some silently fail

`LoginController` shows an error label when authentication fails. `DeckController` shows `Alert` popups. `CharacterRecognitionDataAccess` logs errors and returns empty lists. This inconsistency means users get unpredictable feedback, and developers can't trust return values. A unified error handling strategy with proper exception hierarchies would have been much cleaner.

### Password Hashing

While we hash passwords, we use plain `SHA-256` without salting:

```java
MessageDigest message_digest = MessageDigest.getInstance("SHA-256");
byte[] hashed_bytes = message_digest.digest(password.getBytes("UTF-8"));
```

This is better than plaintext, but `SHA-256` is designed to be fast, which makes it vulnerable to rainbow table and brute force attacks. Modern password hashing should use slow algorithms like `bcrypt`, `scrypt`, or `Argon2` with per-user salts. The codebase actually includes `jbcrypt` as a dependency in the `pom.xml`, but we never used it. This represents a security vulnerability that stems from not understanding security best practices (understandable for a first project, but concerning for any real-world use).

### Duplicated Code

The `ActivityMainController` and `CharacterPracticeActivityMainController` share enormous amounts of duplicate code, representing probably the single worst architectural decision in the entire project. Both files are over 500 lines, and at least 70% of that code is nearly identical between them.

Both controllers manage:
- A hearts system with the exact same logic: integer counter starting at 5, decrements on wrong answers or skips, check for zero and exit the activity
- Progress bars with identical animation code using `Timeline` and `KeyFrame`
- Check/continue button logic that morphs the button between states, applying and removing the same `CSS` classes (`activity-continue-button__label--medium-type-correct-hover`, `activity-button--medium-type-check-answer-unclickable`, etc.)
- Skip functionality that changes the bottom section colour, shows replacement UI, and decreases hearts
- Background preloading of the next activity using the same `Service` pattern
- Fade transitions with identical `FadeTransition` configurations

The only differences are minor:
- One activity type uses a three-option multiple choice layout, the other uses character matching pairs
- The button styling class names vary slightly
- The `FXML` paths being loaded are different

That's it. Everything else is copy-pasted.

This violates `DRY` principles so badly that when I found a bug in the heart system in one controller, I had to remember to fix it in the other. When I wanted to change the animation duration, I updated it in one place, tested it, liked it, then forgot to update the other until noticing the inconsistency later. An abstract `BaseActivityController` with template methods for the activity-specific behaviour would have eliminated all this duplication. Or even just extracting the common methods into an `ActivityHelper` utility class. But under time pressure, copying `ActivityMainController.java`, renaming it to `CharacterPracticeActivityMainController.java`, and modifying the 30% that was different was faster than properly refactoring. That's the kind of technical debt that compounds quickly.

### Image Processing Without Error Boundaries

The `ProfileController` includes sophisticated image resizing code using `Java AWT`'s `BufferedImage`:

```java
BufferedImage finalImage = resizeAndCropImage(originalImage, 720, 405, hasAlpha);
```

However, if the user selects a corrupt image, an unsupported format, or an extremely large image that causes memory issues, the error handling is minimal. The method logs exceptions but doesn't provide clear user feedback about what went wrong or how to fix it. The image processing happens synchronously on the UI thread, which could freeze the application with large images. For a profile banner feature, this is acceptable, but it shows a gap in robust file handling.

## The Worst: Design Flaws and Technical Debt

### The God Controller Problem

`PrimaryController` has grown to 829 lines and manages far too many responsibilities. It's become the de facto "main application controller" that everything else depends on, and that's a problem. The class handles:
- Scene switching (maintaining the primary `Stage`, loading `FXML`, applying `CSS`)
- Sidebar visibility (both left nav sidebar and right context sidebar, with animated transitions)
- Context menu management (including mouse enter/exit timing logic)
- Button action routing (a giant switch statement mapping button IDs to `FXML` paths)
- Animations (gradient wave effects on the status bar)
- Intermission screen preloading
- Serves as a singleton accessed throughout the application via `getInstance()`

Let's look at what's actually in this file:
- `switchContent(String fxml_path)` and its overload with fade durations handle loading new views
- `showSidebar()` and `hideSidebar()` manage left sidebar animations with `TranslateTransition`
- `showRightSidebar()` and `hideRightSidebar()` do the same for the right sidebar
- `preloadIntermissionScreen()` loads and caches the mascot animation screen
- `loadStartupScreen(Node nextContent)` orchestrates a complex sequence of fade-to-white, hide-sidebar, show-intermission, fade-in-content transitions
- `setupContextMenu()` configures the "More" button's context menu with 3-second auto-hide delay
- `applyAnimatedGlowEffect()` adds a pulsing drop shadow to the status bar
- `applyWaveAnimation()` creates an animated gradient that bounces across the status bar
- `handleButtonAction(ActionEvent event)` maps button IDs to `FXML` paths using a `HashMap` lookup
- `setActiveButton(Button active_button)` manages button styling to show which navigation item is selected
- `setSidebarVisibility(boolean visible)` determines whether sidebars should show based on the current view

All of this in one class. The singleton pattern (accessible via `PrimaryController.getInstance()`) means virtually every other controller in the system has access to this, and many of them call it directly. `ActivityMainController` calls `PrimaryController.getInstance().switchToHome()` when exiting an activity. `DeckManagementController` accesses the deck management button through `PrimaryController.getInstance().getDeckManagementButton()` to trigger its animation. This creates a massive coupling problem where changing `PrimaryController`'s API ripples through the entire application.

The correct design would separate these concerns:
- A `NavigationService` handling scene switching with clear methods like `navigate(String route)`
- An `AnimationManager` for UI effects
- A `LayoutController` for sidebar visibility
- A proper router that maps logical routes to `FXML` paths rather than having button IDs hardcoded everywhere

Each concern could then be tested, modified, and reasoned about independently. But that level of architectural planning wasn't happening when you're learning `Java` syntax while simultaneously trying to ship features.

### Lack of Data Validation

User inputs are minimally validated throughout the application:
- When creating flashcards, we check if text fields are empty but don't limit length, check for `SQL` injection patterns, or sanitise input
- When creating decks, we check for empty names but allow duplicate names, special characters that might cause filesystem issues (since deck names could theoretically be used for file exports), or `SQL`-problematic strings
- The user registration checks if usernames are taken but doesn't enforce password strength, email format validation, or username character restrictions

This permissive approach works for a controlled university demo but would be exploited in any real-world scenario.

### Tightly Coupled Activity System

The activity system reveals the consequences of rushing. `ActivityMainController` directly instantiates `ActivityCharacterRecognition` controllers, calls `setMainController` on them, and expects them to call back to `enableCheckButton`. This tight coupling means:
- Activities must know about their parent controller
- The parent must know implementation details of child activities
- Testing activities in isolation is impossible
- Adding new activity types requires modifying `ActivityMainController`
- The relationship is bidirectional and fragile

A better design would use an event system or callback interfaces where activities publish events (`answerSubmitted`, `activityCompleted`) and the main controller subscribes, decoupling the two and making the system extensible.

### No Separation of Concerns in Controllers

Controllers handle far too much:
- `FlashcardController` manages UI events, calls services, handles animations, formats dates, and directly manipulates style classes
- `ProfileController` loads images, processes them, saves them to disk, updates the database, manages the cache, and handles UI updates

This violates single responsibility and makes the controllers impossible to unit test without a full `JavaFX` environment. View models or presenters could have separated UI state from business logic, but `JavaFX` doesn't provide this pattern out of the box, and adding it would have required more architectural planning than we had time for.

### Incomplete Features and Dead Code

The codebase shows evidence of abandoned features:
- `HomeController` is essentially empty with just a comment about adding methods
- There are multiple "test" files like `ActivityMainTestController` that seem to be experimental versions
- The `path/to/` directory contains a lone `ProfileController.java` that appears to be a duplicate or old version
- The `button_development.fxml` file suggests UI experimentation

These artifacts indicate rapid iteration without cleanup, which is understandable given time constraints but contributes to cognitive overhead when navigating the code.

## Performance and Scalability Issues

### Memory Management

The `ImageCache` preloads all banner images on startup and keeps them in memory forever. For a small user base, this is fine, but it doesn't scale. A single 720x405 image at 32-bit colour depth is roughly 1.1MB. With a hundred users, that's 110MB of cached images that might never be viewed. The cache has no eviction policy, no size limits, and no way to reclaim memory. A production system would need `LRU` caching with size limits, but implementing that would have taken time away from feature development.

### Database Design Limitations

The database schema, inferred from the data access code, has limitations:
- The `flashcard_decks_table` and `flashcards_table` relationship uses a junction table (`deck_flashcards`), which is correct for many-to-many relationships, but there's no cascading delete logic visible in the code. If a user is deleted, their decks, flashcards, and statistics remain orphaned
- The `character_recognition_activities_table` stores all possible questions statically rather than generating them dynamically, which means adding new characters requires manual database updates
- The `user_table` stores passwords and profile banners in the same table as user data, which violates separation of concerns (profile metadata should be separate from authentication credentials)

### JavaFX Thread Safety

The codebase uses `Platform.runLater` in several places when updating UI from background threads (image loading, preloading activities), which is correct. However, the pattern isn't consistently applied. Some methods assume they're on the `JavaFX` Application Thread without verification. If future development adds more background processing, race conditions could emerge. `JavaFX`'s single-threaded UI model requires discipline that's hard to maintain without explicit threading policies.

## What I Learned and Would Do Differently

### Understanding Java Through Practice

Learning `Java` by building a real application rather than following tutorials provided invaluable experience. I learned about interfaces, abstract classes, generics, lambdas, streams, and exception handling not as abstract concepts but as tools to solve real problems. The `try-with-resources` pattern for database connections, the use of `Optional` for nullable values (though inconsistently applied), and the difference between checked and unchecked exceptions all made sense in context. The `Maven` dependency management, package structure, and classpath issues that plague beginners became clear through trial and error. This hands-on approach was messy but effective for building intuition about the language.

### JavaFX's Strengths and Frustrations

`JavaFX` proved capable of building rich desktop applications with sophisticated animations and layouts. The Scene Builder tool helped visualise `FXML`, even if we ended up editing much of it manually for fine-grained control. The `CSS` styling allowed separation of appearance from structure, though the limited selector support and property names that don't quite match web standards created confusion. The built-in transition and animation APIs were powerful but verbose. Achieving what might take a few lines of `CSS` animation code required creating `Timeline` objects, `KeyFrames`, and `KeyValues` explicitly. The `FXML` loading and controller injection worked well once understood, but error messages when `FXML` was malformed or resource paths were wrong were cryptic. Overall, `JavaFX` was a reasonable choice for this project, though frameworks like `Electron` or even web technologies might have offered faster iteration for UI-heavy work.

### The Cost of Velocity

Prioritising development velocity meant accumulating technical debt that became apparent as features were added. The decision to copy and modify existing controllers rather than refactor for reusability saved time initially but created maintenance burden. The inconsistent error handling, minimal validation, and lack of tests all reflect the trade-off between shipping features and building quality. In a six-week timeline for a demo project, this was arguably the right choice (a polished, feature-complete application that works for demo purposes is more valuable than a smaller, perfectly-architected application). However, this experience taught me to recognise the moments where a few hours of refactoring would have prevented days of debugging later. The `ActivityMainController` duplication is a prime example; extracting the common functionality after the second copy-paste would have been faster in the long run.

## How It Can Be Improved

### Architectural Refactoring

The application desperately needs extraction of common concerns into reusable components:
- An `ActivityManager` base class could handle hearts, progress tracking, button state management, and animation coordination, with specific activity types extending it
- A `ValidationService` could centralise input validation with configurable rules
- An `ErrorHandler` service could provide consistent error feedback to users while logging appropriately
- Extracting a `NavigationService` from `PrimaryController` would clarify routing logic and make it testable

These refactorings don't add features but dramatically improve maintainability.

### Security Improvements

Implementing proper password hashing with `bcrypt`, adding password strength requirements, and salting passwords would address the most critical security flaw. Input sanitisation to prevent `SQL` injection, even though `SQLite` with parameterised queries is relatively safe, would add defence in depth. Adding session timeout and logout-on-inactivity would prevent unauthorised access on shared machines. Encrypting the local `SQLite` database would protect data at rest. Adding audit logging for authentication events would support security monitoring. None of these are complex, but they require prioritisation.

### Testing Strategy

A comprehensive testing strategy would start with service layer tests, mocking the data access layer to verify business logic. Integration tests would verify the full stack from controller to database. UI tests using `TestFX` could automate common user workflows. Property-based tests could generate random flashcards and deck combinations to find edge cases. Mutation testing could verify test effectiveness. This testing pyramid would catch regressions and enable confident refactoring. The initial investment would be substantial but pay dividends in reduced debugging time.

### Database Improvements

Migrating from `SQLite` to a more robust database like `PostgreSQL` would enable better concurrency, more sophisticated querying, and production readiness. Adding database migrations using `Flyway` or `Liquibase` would version control schema changes. Implementing soft deletes (marking records as deleted rather than removing them) would enable data recovery. Adding database indexes on frequently queried columns would improve performance. Normalising the user table to separate authentication from profile data would improve security. These database improvements would require reworking the data access layer but would future-proof the application.

### Configuration Management

Externalising configuration (database paths, resource locations, animation durations, API keys if we added external services) into a properties file or environment variables would make the application more flexible. Different configurations for development, testing, and production would support proper deployment. This would eliminate the hardcoded paths scattered throughout and enable easier testing with mock databases.

### Accessibility and Internationalisation

The application currently has no accessibility support. Adding `ARIA` labels for screen readers, keyboard navigation support beyond the default tab order, and proper focus management would make it usable for users with disabilities. Internationalisation support using resource bundles would allow translating the UI into multiple languages, appropriate for a language learning application. Both require upfront architectural support rather than being addable as afterthoughts.

### Performance Optimisation

Profiling the application would identify bottlenecks:
- The repeated opening of database connections could be pooled
- The image loading could be made truly async with progress indicators
- The `FXML` parsing could be cached or pre-compiled
- Large lists could use virtual scrolling
- `CSS` could be minified

These optimisations aren't necessary for current performance but would enable scaling to larger datasets.

## Conclusion

Socslingo is what you get when you learn `Java` by building something real under a tight deadline. It works, it demos well, and it has more features than it probably should for a six-week project. The layered architecture is standard `MVC`, the animations are perhaps over-engineered, and the feature set is broad but shallow. The security is questionable, there are barely any meaningful tests, and there's enough duplicated code to make any experienced developer wince.

Looking back, it's a snapshot of learning under pressure. The code reflects every shortcut taken, every "I'll fix this later" that never got fixed, and every moment where shipping something that worked beat building something properly. That's not necessarily wrong for a university project with a hard deadline, but it does mean the codebase is more of a learning artifact than production-ready software. The expectations at university weren't particularly high, and this project scored near-perfect marks based on demonstrating working features and meeting the requirements. But scoring well doesn't change the fact that I could see substantial issues with the codebase even while building it. The assessment criteria valued functionality over code quality, which is understandable for an educational setting but doesn't reflect the standards actual software development demands.

I've outlined various improvements above (architectural refactoring, security fixes, proper testing, database improvements), but I haven't gone back to implement them. I'm currently preoccupied with Valgo, a new project that's demanding my attention, and frankly, the idea of refactoring a completed university project doesn't compete with building something new. However, the exercise of identifying these issues has been valuable in itself. The main lesson I've taken forward is the importance of upfront research and architectural planning. For future projects, I'm spending more time researching patterns, best practices, and potential pitfalls before writing code. Understanding the trade-offs of different approaches before committing to one prevents the kind of technical debt that accumulated in Socslingo. It's slower initially, but faster overall when you're not constantly refactoring or living with decisions made in ignorance.

The value wasn't in writing perfect code. It was in discovering what happens when you don't, and learning to recognise the difference. That's probably worth more than following best practices from a tutorial would have been.
