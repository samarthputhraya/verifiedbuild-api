# Android client code (master copies)

These are the Kotlin files that [docs/ai-studio-android-prompts.md](../../docs/ai-studio-android-prompts.md) asks AI Studio to add to the Android app, unchanged. If the API contract changes, change them here first, re-test, then update the prompt.

- `src/com/example/data/api/`: request and response models for every student endpoint, the Retrofit interface, and `ApiClient`, which turns every error into the API's plain-English message.
- `src/com/example/viva/VivaController.kt`: the viva flow (follow-ups, next question, resume, double-submit recovery).
- `src/com/example/data/SessionStore.kt`, `ResumePicker.kt`, `src/com/example/audio/AnswerRecorder.kt`: the Android-only helpers.

How they were tested (2026-10-10):
- All 7 files compile against the Android 15 framework (Robolectric `android-all`) with Kotlin 2.2.10, with no warnings.
- `harness/` parses all 12 `examples/*.json` contract samples and runs against the live API:
  - every student endpoint and its error cases (unknown user, someone else's repo, unknown student, applying before finishing, answering twice);
  - a voice answer sent as AAC/m4a, the format Android's MediaRecorder produces;
  - follow-ups, apply, and the full `VivaController` flow, including resuming in a second instance and a stale double submit.
