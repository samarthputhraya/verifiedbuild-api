# Android client code (master copies)

These are the Kotlin files that [docs/ai-studio-android-prompts.md](../../docs/ai-studio-android-prompts.md) asks AI Studio to add to the Android app, unchanged. If the API contract changes, change them here first, re-test, then update the prompt.

- `src/com/example/data/api/`: request and response models for every student endpoint, the Retrofit interface, and `ApiClient`, which turns every error into the API's plain-English message.
- `src/com/example/viva/VivaController.kt`: the viva flow (follow-ups, next question, resume, double-submit recovery).
- `src/com/example/data/SessionStore.kt`, `ResumePicker.kt`, `src/com/example/audio/AnswerRecorder.kt`: the Android-only helpers.

How they were tested (2026-10-10, contract v1.1):
- All 7 files compile against the Android 15 framework (Robolectric `android-all`) with Kotlin 2.2.10, with no warnings.
- `harness/` parses the 11 student-facing `examples/*.json` contract samples and runs against the API with real GitHub and Gemini:
  - sign-up, repos and analyze (with `contribution`);
  - a voice answer sent as AAC/m4a, the format Android's MediaRecorder produces;
  - follow-ups, `viva_in_progress`, evidence with code snippets;
  - a hackathon added, verified by the viva, then deleted;
  - apply, and every error case;
  - the full `VivaController` flow, including resuming in a second instance and a stale double submit.
- Stage 1 of the prompt carries the v1 versions of `ApiModels.kt` and `VerifiedBuildApi.kt` (git commit `7c0084d`). Stage 3 replaces them with the v1.1 versions here.
