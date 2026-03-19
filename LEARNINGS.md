# Learnings

Things I've looked up so I don't search for the same thing twice.

<!-- Format: ## [Topic] / [Date] -->
<!-- Write what you learned, link to the source, note what you'd do differently. -->

## Coverage Checker Limitations / 2026-03-19 00:10
The BDD coverage checker in this project has limitations in identifying test coverage for certain scenarios. Specifically, it failed to recognize that the scenarios "end-to-end audio pipeline integration test" and "web workers for audio processing" were already covered by existing test files (src/main/services/audio-pipeline.test.ts and src/main/services/web-worker.test.ts) despite those tests existing and passing. The checker relies on exact text matching in test files, which can miss properly written tests if the matching algorithm is too strict or doesn't account for variations in how test names are formatted. This highlights the importance of manual verification when automated tools don't behave as expected.