# VerifiedBuild Android app: AI Studio prompts (v2)

For: Ayush. From: SAM. Backend contract: `API_CONTRACT.md` **v1.1** in `verifiedbuild-api`.

---

## Part A: read this first (for you, not for AI Studio)

### What we're building

The student app of VerifiedBuild. A student signs up, picks a GitHub repo (their own, or a hackathon repo they committed to), and answers 5 questions about specific lines of that code, by voice or text, in any language. They get a report of what they **showed**, next to what they **claimed**, with their own words and the code as evidence. Internships are matched on verified skills, interests and verified hackathons.

Your app keeps its screens and its look. What changes:

| Today | After these prompts |
|---|---|
| The phone calls Gemini and GitHub directly, with a key built into the app | The phone calls only our API. No keys in the app. |
| Questions come from the README and file names | Questions point at real lines of the student's code, and on team repos at the files they changed |
| If Gemini fails, the app shows made-up scores, praise and resume details | No made-up results anywhere. If something fails, the student sees the reason and can retry. |
| Sample students, Google/Atlassian/Razorpay recruiters, invented hackathon wins | Real data only. Hackathons are claims until a viva verifies them. |
| Data lives on one phone | Data lives in our database, so the recruiter dashboard (web) sees it instantly |
| Student, recruiter and admin screens | Student screens only. Recruiters use the web dashboard SAM is building. |

### The 7 stages, and why in this order

| Stage | What it builds | About |
|---|---|---|
| 1 | Removes the phone-side AI and invented data, adds the tested API layer | 20 min |
| 2 | Sign-up and dashboard | 30 min |
| 3 | API v1.1 update, repo picker, analyzing, and the **"What we found in your repo"** screen | 40 min |
| 4 | The viva: questions on real code, voice or text, follow-ups | 45 min |
| 5 | The report: **You said / You showed**, the code next to each answer, matches, apply | 45 min |
| 6 | Hackathons: add them, verify them with a viva (team repos supported) | 30 min |
| 7 | Cleanup, polish and demo readiness | 30 min |

Each stage leaves the app building and working, so if time runs out you can stop after any stage and still demo.

Stages 1 and 2 are the same as in the first version of this file; only the stage numbers and the recruiter-dashboard link changed, and Stage 7 sets the link if you already ran Stage 1. If you've already done them, carry on with Stage 3.

### How to run the prompts

1. **Set up GitHub sync first.** Connect this AI Studio app to GitHub and create a repo called `verifiedbuild-app`. Add `samarthputhraya` as a collaborator. Work only in that repo, and don't upload zips to `verifiedbuild-api`.
2. **Paste one stage at a time** into the AI Studio Build chat, everything from `STAGE N` to `END OF STAGE N`.
3. **After each stage:**
   1. Make sure the build passes.
   2. Install it on a real Android phone. Build the APK from AI Studio, or open the GitHub repo in Android Studio.
   3. Run that stage's checks in Part C.
   4. Commit with the stage's commit message.
4. **Don't start the next stage until every check passes.** If one fails, use the fix prompts in Part D.
5. **If AI Studio seems to forget the rules,** paste "Read PROJECT_RULES.md in the project root and follow it exactly." and then the stage again.
6. **Before Stage 3,** open `https://verifiedbuild-api-215071922486.asia-south1.run.app/api/health` and check that it says `"version":"v1.1"`. If it still says v1, message SAM.

### Rules for us both, so we don't create conflicts

- You work only in `verifiedbuild-app`, SAM only in `verifiedbuild-api`.
- **The API shapes are fixed by `API_CONTRACT.md`.** Need a field or an endpoint that isn't there? Message SAM; don't add it or guess.
- **SAM tested the Kotlin files the stages add** against the live API: every endpoint, follow-ups, voice from an m4a recording, team repos, hackathons, errors and apply. Don't let AI Studio change them. Only a stage prompt from SAM replaces them, and Stage 3 does that once, on purpose.
- **When the API does something unexpected,** send SAM the screen, what you did, the error message shown and the time. Better still, open an issue on `verifiedbuild-api`.

---

## Part B: the prompts (paste into AI Studio)

### STAGE 1: foundation: remove the local AI and data, add the API layer

````text
STAGE 1 of 7. Read all of this before changing anything.

CONTEXT
This Android app becomes the student app of "VerifiedBuild". A student signs up, picks one of their GitHub repos, answers 5 questions about their own code (by voice or typing), then sees a report of their verified skills and matched internships. A backend API (already live) does ALL the work: it reads the repo, writes the questions, transcribes and scores answers, and computes the report and matches. The app is only the UI for that API.

In this stage you remove the parts of the app that must not exist (direct Gemini and GitHub calls, sample data, recruiter and admin screens), add a tested API layer, and replace the navigation with a new skeleton. Later stages rebuild each student screen on top of it.

STEP 1: Create a file named PROJECT_RULES.md in the project root with exactly this content. You must follow it in this stage and in every later stage.

----- PROJECT_RULES.md starts -----
# PROJECT_RULES.md: VerifiedBuild student app

These rules apply to every change in this project. Read them before each task.

## What this app is
- The student app of VerifiedBuild. A student signs up, picks one of their public GitHub repos, answers 5 questions about their own code by voice or text, and sees a report of verified skills and matched internships.
- Recruiters do not use this app. They use a separate web dashboard.
- The VerifiedBuild API does all the work. This app is only its UI.

## Data and AI
1. All data comes from the VerifiedBuild API through ApiClient.call { ... } (package com.example.data.api). ApiConfig.API_BASE is the only server this app talks to.
2. The app never calls Gemini, Firebase AI, GitHub or any other AI or data service, and holds no API keys.
3. Never invent data: no sample students, companies, recruiters, hackathons, scores, default values (like 85) or "fallback" results. If a call fails, show the API's message and a way to retry. If a value is missing, show nothing or "—".
4. The phone stores only what SessionStore holds (student id, name, GitHub username, viva session id, time limit). Questions, answers and reports always come from the API.
5. Never show a score or a rubric during the viva. Scores appear only on the report, when its status is "done".

## Files you must not change
6. These files were tested against the live API. Do not edit, rename, reformat or "improve" them: data/api/ApiModels.kt, data/api/VerifiedBuildApi.kt, data/api/ApiClient.kt, data/SessionStore.kt, data/ResumePicker.kt, audio/AnswerRecorder.kt, viva/VivaController.kt. If a task seems to need a change there, stop and say exactly what is missing.
7. Do not change Gradle files, signing configs, applicationId, namespace or AndroidManifest.xml. Do not add libraries.
8. Never add an endpoint or a field that isn't in ApiModels.kt.

## Errors and loading
9. Show ApiResult.Err.message exactly as given: the API writes it in plain English. Use code only for logic (for example STUDENT_NOT_FOUND or ALREADY_APPLIED).
10. Every button that starts an API call is disabled until the call finishes. Every screen that loads data has a loading state and an error state with Retry, and lists have an empty state.

## Code structure
11. Screens are composables that take state and callbacks. All state and all API calls live in AppViewModel, and in VivaController for the viva.
12. Keep the existing visual style: the colours in ui/theme/Color.kt, MaterialTheme typography, and ui/components (StatusBadge, SkillChip, ScoreBadge, Floating3DBackground, InteractiveRadarChart).
13. minSdk is 24. Don't use java.time or other API 26+ classes without a version check.

## Words
14. Use plain English and short sentences. Say "verify", "show" and "prove". Never use these words in anything a user sees: detect, catch, cheat, flag, suspicious, integrity, fraud, plagiarism, AI-powered, revolutionary, seamless, leverage, empower.
15. "Pasted" and the build history are neutral facts. Never style them as warnings.
16. The app name is VerifiedBuild.

## Fixed vocabularies (send exactly these values)
Skill tags, in this order, with display names:
backend = Backend, frontend = Frontend, data = Data, ai_ml = AI/ML, devops = DevOps, security = Security

Verified levels, with labels and colours (text colour on background colour):
strong = "Strong" (AccentEmerald on AccentEmeraldLight)
partial = "Partial" (AccentAmber on AccentAmberLight)
not_verified = "Not verified" (AccentRose on AccentRoseLight)
not_shown = "Not shown" (TextTertiaryMuted on NeutralWarmSurfaceVariant)

Interests (send the id, show the label):
ai = AI, data = Data, web = Web, mobile = Mobile, saas = SaaS, fintech = FinTech, edtech = EdTech, hrtech = HR-Tech, security = Security, devtools = Dev tools, growth = Growth, healthcare = Healthcare

Skill chips (show and send exactly this text):
Python, JavaScript, TypeScript, Java, C++, React, Next.js, HTML/CSS, Flutter, Android, Node.js, FastAPI, Django, Flask, Spring, SQL, MongoDB, Pandas, Machine Learning, Deep Learning, LLMs/GenAI, Docker, Cloud (AWS/GCP/Azure), CI/CD, Security

Difficulty labels: easy = Easy, medium = Medium, hard = Hard
----- PROJECT_RULES.md ends -----

STEP 2: Delete these files completely:
- app/src/main/java/com/example/viewmodel/MainViewModel.kt
- app/src/main/java/com/example/data/repository/AppRepository.kt
- app/src/main/java/com/example/network/GitHubService.kt
- app/src/main/java/com/example/speech/SpeechRecognitionHelper.kt
- app/src/main/java/com/example/ui/screens/RoleSelectionScreen.kt
- app/src/main/java/com/example/ui/screens/admin/AdminCommandCenterScreen.kt
- app/src/main/java/com/example/ui/screens/admin/AdminCampaignScreen.kt
- app/src/main/java/com/example/ui/screens/recruiter/RecruiterPortalScreen.kt
- app/src/test/java/com/example/NexusInternPlatformTest.kt
Keep for now, because later stages rewrite or remove them and the build needs them until then: the files in ui/screens/student/, data/model/Entities.kt, data/dao/AppDao.kt, data/db/AppDatabase.kt and network/GeminiAiService.kt. New code must not use any of these.
Keep for good, and reuse in new screens: ui/components/ and ui/theme/.

STEP 3: Add these 7 files with EXACTLY this content, character for character. They were tested against the live API. Do not rename, reformat, "improve" or add to them.

File: app/src/main/java/com/example/data/api/ApiModels.kt
```kotlin
package com.example.data.api

import com.squareup.moshi.Json

// Every request and response of the VerifiedBuild API (contract v1).
// Field names in @Json(...) must match the API exactly. Do not rename them.
// A "?" type means the API can send null there; handle it in the UI.

// ---------- Errors: every non-2xx response has this body ----------
data class ApiErrorBody(
    val code: String,
    val message: String,
)

data class ApiErrorEnvelope(
    val error: ApiErrorBody,
)

// ---------- GET /api/health ----------
data class HealthResponse(
    val ok: Boolean,
    @param:Json(name = "demo_mode") val demoMode: Boolean,
    val version: String,
)

// ---------- POST /api/students ----------
data class StudentCreateRequest(
    val name: String,
    val email: String,
    val college: String,
    @param:Json(name = "github_username") val githubUsername: String,
    val interests: List<String>,
    val skills: List<String>? = null,
    @param:Json(name = "resume_base64") val resumeBase64: String? = null,
    @param:Json(name = "resume_mime") val resumeMime: String? = null,
)

data class ClaimedSkill(
    val name: String,
    val tag: String,
)

data class StudentCreatedResponse(
    @param:Json(name = "student_id") val studentId: String,
    @param:Json(name = "github_username") val githubUsername: String,
    @param:Json(name = "claimed_skills") val claimedSkills: List<ClaimedSkill>,
    @param:Json(name = "claimed_from") val claimedFrom: String,
)

// ---------- GET /api/github/{username}/repos ----------
data class RepoSummary(
    @param:Json(name = "full_name") val fullName: String,
    val description: String?,
    val language: String?,
    val stars: Int,
    @param:Json(name = "pushed_at") val pushedAt: String?,
)

data class ReposResponse(
    val repos: List<RepoSummary>,
)

// ---------- POST /api/analyze ----------
data class AnalyzeRequest(
    @param:Json(name = "student_id") val studentId: String,
    @param:Json(name = "repo_full_name") val repoFullName: String,
)

data class AnalyzedRepo(
    @param:Json(name = "full_name") val fullName: String,
    val languages: Map<String, Double>,
    @param:Json(name = "files_read") val filesRead: Int,
)

data class RepoSkill(
    val tag: String,
    val evidence: String,
)

data class VivaQuestion(
    val id: String,
    val file: String,
    val lines: String,
    val snippet: String,
    @param:Json(name = "snippet_start_line") val snippetStartLine: Int,
    val question: String,
    val skill: String,
    val difficulty: String,
)

data class AnalyzeResponse(
    @param:Json(name = "session_id") val sessionId: String,
    val repo: AnalyzedRepo,
    @param:Json(name = "repo_skills") val repoSkills: List<RepoSkill>,
    val questions: List<VivaQuestion>,
    @param:Json(name = "time_limit_s") val timeLimitS: Int,
)

// ---------- GET /api/viva/{session_id} ----------
data class PendingFollowUp(
    @param:Json(name = "question_id") val questionId: String,
    @param:Json(name = "follow_up") val followUp: String,
)

data class VivaStateResponse(
    @param:Json(name = "session_id") val sessionId: String,
    @param:Json(name = "student_id") val studentId: String,
    val status: String,
    val questions: List<VivaQuestion>,
    val answered: List<String>,
    @param:Json(name = "current_question_id") val currentQuestionId: String?,
    @param:Json(name = "pending_follow_up") val pendingFollowUp: PendingFollowUp?,
)

// ---------- POST /api/viva/{session_id}/answer ----------
data class AnswerRequest(
    @param:Json(name = "question_id") val questionId: String,
    @param:Json(name = "is_follow_up") val isFollowUp: Boolean,
    val mode: String, // "voice" or "text"
    @param:Json(name = "answer_text") val answerText: String? = null,
    @param:Json(name = "audio_base64") val audioBase64: String? = null,
    @param:Json(name = "audio_mime") val audioMime: String? = null,
    @param:Json(name = "duration_s") val durationS: Int? = null,
    val pasted: Boolean = false,
)

data class AnswerResponse(
    @param:Json(name = "question_id") val questionId: String,
    val transcript: String,
    val recorded: Boolean,
    @param:Json(name = "follow_up") val followUp: String?,
    @param:Json(name = "next_question_id") val nextQuestionId: String?,
    val done: Boolean,
)

// ---------- GET /api/report/{student_id} ----------
data class ReportStudent(
    @param:Json(name = "student_id") val studentId: String,
    val name: String,
    val college: String,
    @param:Json(name = "github_username") val githubUsername: String,
)

data class ReportRepo(
    @param:Json(name = "full_name") val fullName: String,
)

data class ClaimedVsVerified(
    val name: String,
    val tag: String,
    val claimed: Boolean,
    val level: String, // "strong", "partial", "not_verified" or "not_shown"
)

data class EvidenceItem(
    @param:Json(name = "question_id") val questionId: String,
    val file: String,
    val lines: String,
    val question: String,
    @param:Json(name = "answer_excerpt") val answerExcerpt: String,
    @param:Json(name = "evidence_quote") val evidenceQuote: String,
    val covered: List<String>,
    val missed: List<String>,
    val score: Int, // 0-10
    val skill: String,
    val mode: String,
    val pasted: Boolean,
    @param:Json(name = "duration_s") val durationS: Int?,
    @param:Json(name = "had_follow_up") val hadFollowUp: Boolean,
)

data class BuildHistory(
    val commits: Int,
    @param:Json(name = "active_days") val activeDays: Int,
    @param:Json(name = "span_days") val spanDays: Int,
    val authors: Int,
    @param:Json(name = "your_commit_share") val yourCommitShare: Double,
    @param:Json(name = "median_lines_per_commit") val medianLinesPerCommit: Int,
)

data class MatchItem(
    @param:Json(name = "listing_id") val listingId: String,
    val title: String,
    val venture: String,
    val match: Int, // 0-100
    val why: String,
    val applied: Boolean,
)

data class ReportResponse(
    val student: ReportStudent,
    val repo: ReportRepo?,
    val status: String, // "in_progress" or "done"
    val overall: Int, // 0-100
    val skills: Map<String, Int>, // only tags that were asked, 0-100
    @param:Json(name = "claimed_vs_verified") val claimedVsVerified: List<ClaimedVsVerified>,
    val evidence: List<EvidenceItem>,
    @param:Json(name = "build_history") val buildHistory: BuildHistory?,
    val matches: List<MatchItem>,
)

// ---------- GET /api/listings ----------
data class Listing(
    val id: String,
    val title: String,
    val venture: String,
    val description: String,
    @param:Json(name = "required_skills") val requiredSkills: Map<String, Double>,
    val tags: List<String>,
)

data class ListingsResponse(
    val listings: List<Listing>,
)

// ---------- POST /api/apply ----------
data class ApplyRequest(
    @param:Json(name = "student_id") val studentId: String,
    @param:Json(name = "listing_id") val listingId: String,
    @param:Json(name = "share_consent") val shareConsent: Boolean,
)

data class ApplyResponse(
    @param:Json(name = "application_id") val applicationId: String,
    val status: String,
    val match: Int,
)
```

File: app/src/main/java/com/example/data/api/VerifiedBuildApi.kt
```kotlin
package com.example.data.api

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

// The student-facing endpoints of the VerifiedBuild API. Paths have no leading "/"
// because ApiConfig.API_BASE ends with "/". The app never calls /api/admin/*.
interface VerifiedBuildApi {
    @GET("api/health")
    suspend fun health(): HealthResponse

    @POST("api/students")
    suspend fun createStudent(@Body body: StudentCreateRequest): StudentCreatedResponse

    @GET("api/github/{username}/repos")
    suspend fun listRepos(@Path("username") username: String): ReposResponse

    @POST("api/analyze")
    suspend fun analyze(@Body body: AnalyzeRequest): AnalyzeResponse

    @GET("api/viva/{sessionId}")
    suspend fun vivaState(@Path("sessionId") sessionId: String): VivaStateResponse

    @POST("api/viva/{sessionId}/answer")
    suspend fun submitAnswer(@Path("sessionId") sessionId: String, @Body body: AnswerRequest): AnswerResponse

    @GET("api/report/{studentId}")
    suspend fun report(@Path("studentId") studentId: String): ReportResponse

    @GET("api/listings")
    suspend fun listings(): ListingsResponse

    @POST("api/apply")
    suspend fun apply(@Body body: ApplyRequest): ApplyResponse
}
```

File: app/src/main/java/com/example/data/api/ApiClient.kt
```kotlin
package com.example.data.api

import com.squareup.moshi.JsonDataException
import com.squareup.moshi.JsonEncodingException
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit

object ApiConfig {
    // The live VerifiedBuild API. Must end with "/".
    const val API_BASE = "https://verifiedbuild-api-215071922486.asia-south1.run.app/"

    // The recruiter web dashboard. Empty would hide the link in the app.
    const val RECRUITER_WEB_URL = "https://verifiedbuild-api-215071922486.asia-south1.run.app/recruiter/"
}

// The result of every API call. The UI shows `message` exactly as given: the API writes it in plain English.
sealed class ApiResult<out T> {
    data class Ok<out T>(val value: T) : ApiResult<T>()
    data class Err(val code: String, val message: String, val httpStatus: Int?) : ApiResult<Nothing>()
}

object ApiClient {
    val moshi: Moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    // Analyze can take up to a minute, and voice answers upload audio, so timeouts are long.
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .callTimeout(150, TimeUnit.SECONDS)
        .build()

    val api: VerifiedBuildApi = Retrofit.Builder()
        .baseUrl(ApiConfig.API_BASE)
        .client(http)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()
        .create(VerifiedBuildApi::class.java)

    private val errorAdapter = moshi.adapter(ApiErrorEnvelope::class.java)

    // Usage: when (val r = ApiClient.call { report(studentId) }) { is ApiResult.Ok -> ...; is ApiResult.Err -> ... }
    suspend fun <T> call(block: suspend VerifiedBuildApi.() -> T): ApiResult<T> =
        try {
            ApiResult.Ok(api.block())
        } catch (e: HttpException) {
            val body = try {
                e.response()?.errorBody()?.string()?.let { errorAdapter.fromJson(it) }
            } catch (_: Exception) {
                null
            }
            ApiResult.Err(
                code = body?.error?.code ?: "HTTP_${e.code()}",
                message = body?.error?.message ?: "Something went wrong on our side. Please try again.",
                httpStatus = e.code(),
            )
        } catch (e: JsonDataException) {
            ApiResult.Err("BAD_RESPONSE", "The app and the server disagree about the data. Please update the app.", null)
        } catch (e: JsonEncodingException) {
            ApiResult.Err("BAD_RESPONSE", "The app and the server disagree about the data. Please update the app.", null)
        } catch (e: IOException) {
            ApiResult.Err("NETWORK", "We couldn't reach the server. Check your internet connection and try again.", null)
        }
}
```

File: app/src/main/java/com/example/data/SessionStore.kt
```kotlin
package com.example.data

import android.content.Context

// The few things the app remembers between launches. Everything else comes from the API.
class SessionStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("verifiedbuild", Context.MODE_PRIVATE)

    var studentId: String?
        get() = prefs.getString(KEY_STUDENT_ID, null)
        set(value) = prefs.edit().putString(KEY_STUDENT_ID, value).apply()

    var studentName: String?
        get() = prefs.getString(KEY_STUDENT_NAME, null)
        set(value) = prefs.edit().putString(KEY_STUDENT_NAME, value).apply()

    var githubUsername: String?
        get() = prefs.getString(KEY_GITHUB_USERNAME, null)
        set(value) = prefs.edit().putString(KEY_GITHUB_USERNAME, value).apply()

    // The viva in progress, so it can be continued after the app is closed.
    var sessionId: String?
        get() = prefs.getString(KEY_SESSION_ID, null)
        set(value) = prefs.edit().putString(KEY_SESSION_ID, value).apply()

    var timeLimitS: Int
        get() = prefs.getInt(KEY_TIME_LIMIT_S, 90)
        set(value) = prefs.edit().putInt(KEY_TIME_LIMIT_S, value).apply()

    // "Sign out": forget this student on this phone. Their data stays on the server.
    fun clear() {
        prefs.edit().clear().apply()
    }

    private companion object {
        const val KEY_STUDENT_ID = "student_id"
        const val KEY_STUDENT_NAME = "student_name"
        const val KEY_GITHUB_USERNAME = "github_username"
        const val KEY_SESSION_ID = "session_id"
        const val KEY_TIME_LIMIT_S = "time_limit_s"
    }
}
```

File: app/src/main/java/com/example/data/ResumePicker.kt
```kotlin
package com.example.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64

sealed class PickedResume {
    data class Ok(val base64: String, val fileName: String) : PickedResume()
    data class Rejected(val message: String) : PickedResume()
}

private const val MAX_RESUME_BYTES = 5L * 1024 * 1024

// Reads the PDF the student picked (from ActivityResultContracts.OpenDocument), checks it,
// and encodes it for POST /api/students. The API reads the resume; the app never does.
fun readResumePdf(context: Context, uri: Uri): PickedResume {
    val resolver = context.contentResolver
    val mime = resolver.getType(uri)
    if (mime != null && mime != "application/pdf") {
        return PickedResume.Rejected("Please pick a PDF file.")
    }
    var fileName = "resume.pdf"
    var size = -1L
    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
        if (c.moveToFirst()) {
            if (!c.isNull(0)) fileName = c.getString(0)
            if (!c.isNull(1)) size = c.getLong(1)
        }
    }
    if (size > MAX_RESUME_BYTES) {
        return PickedResume.Rejected("That PDF is over 5 MB. Please pick a smaller file.")
    }
    val bytes = try {
        resolver.openInputStream(uri)?.use { it.readBytes() }
    } catch (e: Exception) {
        null
    } ?: return PickedResume.Rejected("We couldn't open that file. Please try another PDF.")
    if (bytes.size > MAX_RESUME_BYTES) {
        return PickedResume.Rejected("That PDF is over 5 MB. Please pick a smaller file.")
    }
    if (bytes.size < 5 || String(bytes, 0, 4, Charsets.US_ASCII) != "%PDF") {
        return PickedResume.Rejected("That file isn't a readable PDF.")
    }
    return PickedResume.Ok(Base64.encodeToString(bytes, Base64.NO_WRAP), fileName)
}
```

File: app/src/main/java/com/example/audio/AnswerRecorder.kt
```kotlin
package com.example.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.os.SystemClock
import android.util.Base64
import java.io.File

data class RecordedAnswer(
    val audioBase64: String,
    val mime: String,
    val seconds: Int,
)

// Records one spoken answer as AAC audio in an .m4a file. The API converts and transcribes it,
// so Hindi, Telugu and mixed answers work the same as English. Needs the RECORD_AUDIO permission.
class AnswerRecorder(private val context: Context) {
    private var recorder: MediaRecorder? = null
    private var output: File? = null
    private var startedAt = 0L

    val isRecording: Boolean get() = recorder != null

    // Throws if the microphone can't be opened; show "We couldn't start the microphone" and offer typing.
    fun start() {
        discard()
        val file = File(context.cacheDir, "answer_${System.currentTimeMillis()}.m4a")
        val r = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()
        try {
            r.setAudioSource(MediaRecorder.AudioSource.MIC)
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            r.setAudioChannels(1)
            r.setAudioSamplingRate(44_100)
            r.setAudioEncodingBitRate(64_000)
            r.setOutputFile(file.absolutePath)
            r.prepare()
            r.start()
        } catch (e: Exception) {
            r.release()
            file.delete()
            throw e
        }
        recorder = r
        output = file
        startedAt = SystemClock.elapsedRealtime()
    }

    // Seconds recorded so far, for the on-screen timer.
    fun elapsedSeconds(): Int =
        if (recorder == null) 0 else ((SystemClock.elapsedRealtime() - startedAt) / 1000).toInt()

    // Stops and returns the recording, or null if nothing usable was captured (for example, stopped within a second).
    fun stop(): RecordedAnswer? {
        val r = recorder ?: return null
        val seconds = elapsedSeconds()
        val stoppedCleanly = try {
            r.stop()
            true
        } catch (e: RuntimeException) {
            false
        }
        r.release()
        recorder = null
        val file = output
        output = null
        if (!stoppedCleanly || file == null || !file.exists() || file.length() < 2_000) {
            file?.delete()
            return null
        }
        val base64 = Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
        file.delete()
        return RecordedAnswer(audioBase64 = base64, mime = "audio/mp4", seconds = seconds)
    }

    // Throw away a recording in progress (leaving the screen, or "Record again").
    fun discard() {
        recorder?.let {
            try {
                it.stop()
            } catch (_: RuntimeException) {
            }
            it.release()
        }
        recorder = null
        output?.delete()
        output = null
    }
}
```

File: app/src/main/java/com/example/viva/VivaController.kt
```kotlin
package com.example.viva

import com.example.data.api.AnalyzeResponse
import com.example.data.api.AnswerRequest
import com.example.data.api.ApiClient
import com.example.data.api.ApiResult
import com.example.data.api.VivaQuestion
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

// The viva flow, in one place: which question is open, whether a follow-up is waiting,
// and what happens after each answer. The UI only reads `state` and calls the functions.
// It has no Android code, so it behaves the same in tests and on the phone.

data class VivaUiState(
    val sessionId: String = "",
    val questions: List<VivaQuestion> = emptyList(),
    val timeLimitS: Int = 90,
    val currentQuestionId: String? = null, // null when the viva is finished
    val followUp: String? = null,          // non-null: the student is answering this follow-up for the current question
    val answeredIds: List<String> = emptyList(),
    val lastTranscript: String? = null,    // what the API recorded for the last answer; show it as "We heard: ..."
    val loading: Boolean = false,
    val error: ApiResult.Err? = null,
    val done: Boolean = false,
) {
    val currentQuestion: VivaQuestion? get() = questions.firstOrNull { it.id == currentQuestionId }

    // 1-based position of the current question, e.g. "Question 2 of 5". 0 when there is none.
    val questionNumber: Int get() = questions.indexOfFirst { it.id == currentQuestionId } + 1

    // Errors where sending the same answer again can work. For the others the student must change the answer.
    val canRetry: Boolean get() = error != null && error.code in RETRYABLE
}

private val RETRYABLE = setOf("AI_FAILED", "NETWORK", "DB_UNAVAILABLE", "DB_ERROR", "INTERNAL", "HTTP_500", "HTTP_502", "HTTP_503", "HTTP_504")

class VivaController {
    private val _state = MutableStateFlow(VivaUiState())
    val state: StateFlow<VivaUiState> = _state.asStateFlow()

    private var failedRequest: AnswerRequest? = null

    /** A new viva, straight from POST /api/analyze. */
    fun startFrom(analysis: AnalyzeResponse) {
        failedRequest = null
        _state.value = VivaUiState(
            sessionId = analysis.sessionId,
            questions = analysis.questions,
            timeLimitS = analysis.timeLimitS,
            currentQuestionId = analysis.questions.firstOrNull()?.id,
        )
    }

    /** Continue a viva from the server's record: after an app restart, or when our local state is out of date. */
    suspend fun resume(sessionId: String, timeLimitS: Int = 90) {
        failedRequest = null
        _state.value = _state.value.copy(loading = true, error = null)
        when (val r = ApiClient.call { vivaState(sessionId) }) {
            is ApiResult.Ok -> {
                val s = r.value
                _state.value = VivaUiState(
                    sessionId = s.sessionId,
                    questions = s.questions,
                    timeLimitS = timeLimitS,
                    currentQuestionId = if (s.status == "done") null else s.currentQuestionId,
                    followUp = s.pendingFollowUp?.followUp,
                    answeredIds = s.answered,
                    done = s.status == "done",
                )
            }
            is ApiResult.Err -> _state.value = _state.value.copy(loading = false, error = r)
        }
    }

    /** Send the answer to the current question (or to its follow-up, if one is waiting). */
    suspend fun submit(
        mode: String, // "voice" or "text"
        answerText: String? = null,
        audioBase64: String? = null,
        audioMime: String? = null,
        durationS: Int? = null,
        pasted: Boolean = false,
    ) {
        val s = _state.value
        val questionId = s.currentQuestionId ?: return
        if (s.loading) return // a submit is already on its way: ignore double taps
        send(
            AnswerRequest(
                questionId = questionId,
                isFollowUp = s.followUp != null,
                mode = mode,
                answerText = answerText?.trim()?.takeIf { it.isNotEmpty() },
                audioBase64 = audioBase64,
                audioMime = audioMime,
                durationS = durationS,
                pasted = pasted,
            ),
        )
    }

    /** Send the last failed answer again. Only offer this when state.canRetry is true. */
    suspend fun retry() {
        failedRequest?.let { send(it) }
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }

    fun clearTranscript() {
        _state.value = _state.value.copy(lastTranscript = null)
    }

    private suspend fun send(request: AnswerRequest) {
        val s = _state.value
        failedRequest = null
        _state.value = s.copy(loading = true, error = null)
        when (val r = ApiClient.call { submitAnswer(s.sessionId, request) }) {
            is ApiResult.Ok -> {
                val a = r.value
                _state.value = if (a.followUp != null) {
                    // Same question stays open; the next submit answers the follow-up.
                    s.copy(loading = false, error = null, followUp = a.followUp, lastTranscript = a.transcript)
                } else {
                    s.copy(
                        loading = false,
                        error = null,
                        followUp = null,
                        lastTranscript = a.transcript,
                        answeredIds = (s.answeredIds + a.questionId).distinct(),
                        currentQuestionId = a.nextQuestionId,
                        done = a.done,
                    )
                }
            }
            is ApiResult.Err -> {
                if (r.code == "ALREADY_ANSWERED") {
                    // The server already has this answer (e.g. sent twice). Reload where the viva really is.
                    resume(s.sessionId, s.timeLimitS)
                } else {
                    failedRequest = request
                    _state.value = s.copy(loading = false, error = r)
                }
            }
        }
    }
}
```

STEP 4: Create app/src/main/java/com/example/viewmodel/AppViewModel.kt: one AndroidViewModel that owns navigation and all screen state.
- Navigation: a sealed class Screen with exactly these destinations (later stages fill them in):
    Welcome, Onboarding, Dashboard, RepoPicker, Analyzing(repoFullName: String), Viva, VivaComplete, Report
  Keep the current screen in a StateFlow<Screen> and a back stack. Provide navigate(to, clearStack = false), replace(to) (swaps the current screen without adding to the stack), and back(). back() returns false when the stack is empty, so the activity can close.
- Start screen: if SessionStore.studentId is not null, start on Dashboard, otherwise on Welcome.
- Hold exactly one SessionStore(application), one VivaController(), and one AnswerRecorder(application). In onCleared(), call recorder.discard().
- A generic load state for screens: sealed class Load<out T> { Idle, Loading, Ready(value: T), Failed(error: ApiResult.Err) }.
- Run every API call through ApiClient.call { ... } inside viewModelScope. Never call ApiClient from a composable.
- In this stage, add: val health: StateFlow<Load<HealthResponse>>, checked once in init and again by fun retryHealth().

STEP 5: Create app/src/main/java/com/example/ui/VerifiedBuildApp.kt with the root composable VerifiedBuildApp(viewModel: AppViewModel = viewModel()). It switches on the current Screen:
- Welcome: the WelcomeScreen below.
- Every other destination: a temporary placeholder screen showing the destination's name, the text "Built in a later stage", and a Back button. These placeholders are removed in later stages.
- System back: use BackHandler(enabled = true) { if (!viewModel.back()) activity.finish() }.

STEP 6: Create app/src/main/java/com/example/ui/screens/WelcomeScreen.kt, in the app's current visual style (reuse Floating3DBackground and the colours in ui/theme/Color.kt):
- Title: "VerifiedBuild"
- Line 1: "Show what you can really build."
- Line 2: "Pick one of your GitHub repos, answer 5 questions about your own code, and get matched to internships on the skills you show."
- Primary button: "Get started", which goes to Onboarding.
- A small status line from health: Loading shows "Connecting…"; Ready shows "Connected"; Failed shows the error message and a "Retry" text button.
- Only if ApiConfig.RECRUITER_WEB_URL is not empty: a text button "Hiring? Open the recruiter dashboard" that opens that URL in the browser (Intent.ACTION_VIEW). Hide it when the URL is empty.

STEP 7: In MainActivity.kt, delete the NexusInternApp composable and every import it used. setContent must show VerifiedBuildApp() inside the existing theme and Surface.

STEP 8: In app/src/main/res/values/strings.xml, set app_name to VerifiedBuild.

DO NOT
- Do not change any Gradle file, the signing configs, applicationId, namespace or the AndroidManifest.
- Do not add libraries. Retrofit, Moshi, OkHttp and coroutines are already dependencies.
- Do not add Room, Firebase or Gemini calls anywhere. Do not keep or create any sample data.

DONE WHEN
- The project builds.
- The app opens on the Welcome screen and shows "Connected".
- No Kotlin file outside network/GeminiAiService.kt and the old student screens references GeminiAiService, AppRepository, AppDatabase, AppDao, MainViewModel or ScreenDestination.

END OF STAGE 1
````

Commit message: `Remove local AI and sample data; add the VerifiedBuild API layer`

---

### STAGE 2: sign-up and dashboard

````text
STAGE 2 of 7. First read PROJECT_RULES.md in the project root and follow it exactly.

GOAL
A student creates a profile through POST /api/students, and sees a dashboard built from GET /api/report/{student_id}.

PART 1: Onboarding screen
Rewrite app/src/main/java/com/example/ui/screens/student/StudentOnboardingScreen.kt. Keep its visual style and layout patterns, but replace its parameters and logic. It must no longer use StudentEntity, HackathonEntity or GeminiAiService. The composable takes UI state and callbacks from AppViewModel only.

Fields, in this order:
1. Full name: required, at most 100 characters.
2. Email: required, at most 200 characters, must look like name@domain.tld.
3. College: required, at most 150 characters.
4. GitHub username: required. Helper text: "We only read your public repos."
   Normalise before validating and sending: trim; remove a leading "https://github.com/", "http://github.com/", "github.com/" or "@"; remove a trailing "/"; keep only the part before any further "/".
   Valid means it matches ^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$. Otherwise show "That doesn't look like a GitHub username."
5. Interests: FilterChips for the 12 interests in PROJECT_RULES.md. Show the label, send the id. At least 1 is required: "Pick at least one interest."
6. Skills. Show both options under the heading "Your skills":
   a. "Upload your resume (PDF, under 5 MB)". Use rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) with arrayOf("application/pdf"), then readResumePdf(context, uri).
      - On Ok: show the file name with a "Remove" button.
      - On Rejected: show its message.
   b. FilterChips for the 25 skill chips in PROJECT_RULES.md. Show and send the exact chip text.
   Show the line: "With a resume, we read your skills from it. Without one, we use the chips you pick."
   Require a resume OR at least 1 chip: "Upload a resume or pick at least one skill."

Delete these from the screen, with all their state and code: email verification and the verification code, branch, academic year, CGPA, experience, projects, the resume text box, "Extract Resume Fields", and hackathon entries.

Submit button "Create my profile":
- While submitting, disable the form and show "Checking your GitHub…" (or "Checking your GitHub and reading your resume…" when a resume is attached).
- Send StudentCreateRequest:
    name, email, college, githubUsername (normalised), interests (the ids),
    skills (the chosen chips; null if none),
    resumeBase64 (from PickedResume.Ok; null if none),
    resumeMime = "application/pdf" (only if a resume is attached; otherwise null).
- On ApiResult.Ok:
  - store.studentId = value.studentId
  - store.studentName = the name typed
  - store.githubUsername = value.githubUsername (GitHub's own spelling)
  - then navigate(Dashboard, clearStack = true).
- On ApiResult.Err: show error.message under the button and keep everything the student typed. If code == "RESUME_UNREADABLE", also show a button "Continue without resume" that removes the resume and submits again with the chips (only if at least 1 chip is selected; otherwise ask them to pick skills).

PART 2: Dashboard screen
Rewrite app/src/main/java/com/example/ui/screens/student/StudentDashboardScreen.kt in the same visual style. Remove the Connections, Notifications and Portfolio/hackathon tabs, and the "Add project" dialog, completely.

Data:
- AppViewModel loads GET /api/report/{store.studentId} each time the Dashboard opens, and on a Refresh action. Keep it as StateFlow<Load<ReportResponse>> (reportState), which later stages reuse.
- It also loads GET /api/listings once and keeps it as StateFlow<Load<ListingsResponse>>.
- If the report call fails with code STUDENT_NOT_FOUND: call store.clear(), then navigate(Welcome, clearStack = true) and show the message "We couldn't find your profile. Please sign up again."

Layout:
- Header: "Hi, {first name from store.studentName}", then "@{report.student.githubUsername} · {report.student.college}".
  An overflow menu with "Sign out on this phone". Confirm with "This only removes your profile from this phone." Then store.clear() and navigate(Welcome, clearStack = true).
- One main card, depending on the report:
  A) report.repo == null (no viva yet):
     Title "Verify your skills".
     Text "Pick one of your GitHub repos. We'll read the code and ask you 5 questions about it. It takes about 8 minutes."
     Button "Pick a repo" goes to RepoPicker.
  B) report.repo != null and report.status == "in_progress":
     Title "Finish your viva".
     Text "{report.repo.fullName} · {report.evidence.size} of 5 answered".
     Button "Continue": if store.sessionId != null, call viva.resume(store.sessionId, store.timeLimitS), then navigate(Viva). If store.sessionId is null, show "Pick the repo again to restart" and go to RepoPicker.
  C) report.status == "done":
     Title "Your verified profile".
     Show "{report.overall}/100" with ScoreBadge and the repo name.
     Button "View report" goes to Report.
     Text button "Verify another repo" goes to RepoPicker.
- Internships section:
  - If status == "done": show the top 3 of report.matches, in the order given. For each: title, venture, "{match}% match", and the why text. Then a link "See all and apply" that goes to Report.
  - Otherwise: list the listings (title and venture only, no percentages), with the note "Finish a viva to see how well you match each one."
- Loading: a progress indicator. Failed (other codes): the message and a Retry button.

PART 3: Wire it up and clean up
- VerifiedBuildApp: Onboarding and Dashboard show the new screens instead of placeholders.
- Welcome "Get started" goes to Onboarding. Back from Onboarding returns to Welcome. Back from Dashboard closes the app.
- Delete app/src/main/java/com/example/network/GeminiAiService.kt. Nothing may reference it now.

DO NOT
- Do not change the 7 files from Stage 1, Gradle files, the manifest, applicationId or namespace.
- Do not show percentages or scores anywhere before report.status is "done".

DONE WHEN
- The project builds.
- Signing up with chips only, and with a PDF resume, both reach the Dashboard.
- The username "no-such-user-zz-998877" shows the API's message and keeps the form filled in.
- Closing and reopening the app opens the Dashboard. Signing out returns to Welcome.

END OF STAGE 2
````

Commit message: `Sign up through the API and show the dashboard`

---

### STAGE 3: API v1.1, repo picker, analyzing, "What we found in your repo"

````text
STAGE 3 of 7. First read PROJECT_RULES.md in the project root and follow it exactly.

WHERE THE PROJECT IS NOW
- data/api/ (the API layer), viva/VivaController.kt, audio/AnswerRecorder.kt, data/SessionStore.kt and data/ResumePicker.kt exist, and are locked by rule 6 of PROJECT_RULES.md.
- AppViewModel owns navigation: Screen = Welcome, Onboarding, Dashboard, RepoPicker, Analyzing(repoFullName), Viva, VivaComplete, Report. It also has navigate, replace and back.
- Welcome, Onboarding and Dashboard are real screens. RepoPicker, Analyzing, Viva, VivaComplete and Report are still placeholders.
- AppViewModel holds reportState (Load<ReportResponse>) and the listings (Load<ListingsResponse>).

GOAL
- Move the API layer to contract v1.1.
- Let the student pick a repo and start a viva.
- Show a "What we found in your repo" screen before the first question.

FIRST, PLAN
Before changing code, list the files you will create, change and delete in this stage. Then make the changes.

PART 1: API layer v1.1 (an allowed exception to rule 6)
SAM updated two of the locked files for API contract v1.1 and tested them against the live API. Replace the WHOLE content of these two files with exactly the text below, character for character. This prompt is the permission rule 6 asks for. Change no other locked file.

File: app/src/main/java/com/example/data/api/ApiModels.kt
```kotlin
package com.example.data.api

import com.squareup.moshi.Json

// Every request and response of the VerifiedBuild API (contract v1.1).
// Field names in @Json(...) must match the API exactly. Do not rename them.
// A "?" type means the API can send null there; handle it in the UI.

// ---------- Errors: every non-2xx response has this body ----------
data class ApiErrorBody(
    val code: String,
    val message: String,
)

data class ApiErrorEnvelope(
    val error: ApiErrorBody,
)

// ---------- GET /api/health ----------
data class HealthResponse(
    val ok: Boolean,
    @param:Json(name = "demo_mode") val demoMode: Boolean,
    val version: String,
)

// ---------- POST /api/students ----------
data class StudentCreateRequest(
    val name: String,
    val email: String,
    val college: String,
    @param:Json(name = "github_username") val githubUsername: String,
    val interests: List<String>,
    val skills: List<String>? = null,
    @param:Json(name = "resume_base64") val resumeBase64: String? = null,
    @param:Json(name = "resume_mime") val resumeMime: String? = null,
)

data class ClaimedSkill(
    val name: String,
    val tag: String,
)

data class StudentCreatedResponse(
    @param:Json(name = "student_id") val studentId: String,
    @param:Json(name = "github_username") val githubUsername: String,
    @param:Json(name = "claimed_skills") val claimedSkills: List<ClaimedSkill>,
    @param:Json(name = "claimed_from") val claimedFrom: String,
)

// ---------- GET /api/github/{username}/repos ----------
data class RepoSummary(
    @param:Json(name = "full_name") val fullName: String,
    val description: String?,
    val language: String?,
    val stars: Int,
    @param:Json(name = "pushed_at") val pushedAt: String?,
)

data class ReposResponse(
    val repos: List<RepoSummary>,
)

// ---------- POST /api/analyze ----------
data class AnalyzeRequest(
    @param:Json(name = "student_id") val studentId: String,
    @param:Json(name = "repo_full_name") val repoFullName: String,
)

data class AnalyzedRepo(
    @param:Json(name = "full_name") val fullName: String,
    val languages: Map<String, Double>,
    @param:Json(name = "files_read") val filesRead: Int,
)

data class RepoSkill(
    val tag: String,
    val evidence: String,
)

data class VivaQuestion(
    val id: String,
    val file: String,
    val lines: String,
    val snippet: String,
    @param:Json(name = "snippet_start_line") val snippetStartLine: Int,
    val question: String,
    val skill: String,
    val difficulty: String,
)

// Team repo: someone else owns it or several people committed. Questions then focus on focusFiles,
// the files this student changed.
data class Contribution(
    @param:Json(name = "team_repo") val teamRepo: Boolean,
    @param:Json(name = "your_commits") val yourCommits: Int,
    @param:Json(name = "focus_files") val focusFiles: List<String>,
)

data class AnalyzeResponse(
    @param:Json(name = "session_id") val sessionId: String,
    val repo: AnalyzedRepo,
    @param:Json(name = "repo_skills") val repoSkills: List<RepoSkill>,
    val contribution: Contribution,
    val questions: List<VivaQuestion>,
    @param:Json(name = "time_limit_s") val timeLimitS: Int,
)

// ---------- GET /api/viva/{session_id} ----------
data class PendingFollowUp(
    @param:Json(name = "question_id") val questionId: String,
    @param:Json(name = "follow_up") val followUp: String,
)

data class VivaStateResponse(
    @param:Json(name = "session_id") val sessionId: String,
    @param:Json(name = "student_id") val studentId: String,
    val status: String,
    val questions: List<VivaQuestion>,
    val answered: List<String>,
    @param:Json(name = "current_question_id") val currentQuestionId: String?,
    @param:Json(name = "pending_follow_up") val pendingFollowUp: PendingFollowUp?,
)

// ---------- POST /api/viva/{session_id}/answer ----------
data class AnswerRequest(
    @param:Json(name = "question_id") val questionId: String,
    @param:Json(name = "is_follow_up") val isFollowUp: Boolean,
    val mode: String, // "voice" or "text"
    @param:Json(name = "answer_text") val answerText: String? = null,
    @param:Json(name = "audio_base64") val audioBase64: String? = null,
    @param:Json(name = "audio_mime") val audioMime: String? = null,
    @param:Json(name = "duration_s") val durationS: Int? = null,
    val pasted: Boolean = false,
)

data class AnswerResponse(
    @param:Json(name = "question_id") val questionId: String,
    val transcript: String,
    val recorded: Boolean,
    @param:Json(name = "follow_up") val followUp: String?,
    @param:Json(name = "next_question_id") val nextQuestionId: String?,
    val done: Boolean,
)

// ---------- GET /api/report/{student_id} ----------
data class ReportStudent(
    @param:Json(name = "student_id") val studentId: String,
    val name: String,
    val college: String,
    @param:Json(name = "github_username") val githubUsername: String,
)

data class ReportRepo(
    @param:Json(name = "full_name") val fullName: String,
)

data class ClaimedVsVerified(
    val name: String,
    val tag: String,
    val claimed: Boolean,
    val level: String, // "strong", "partial", "not_verified" or "not_shown"
)

data class EvidenceItem(
    @param:Json(name = "question_id") val questionId: String,
    @param:Json(name = "repo_full_name") val repoFullName: String,
    val file: String,
    val lines: String,
    val snippet: String, // the code the question was about; show it next to the answer
    @param:Json(name = "snippet_start_line") val snippetStartLine: Int,
    val question: String,
    @param:Json(name = "answer_excerpt") val answerExcerpt: String,
    @param:Json(name = "evidence_quote") val evidenceQuote: String,
    val covered: List<String>,
    val missed: List<String>,
    val score: Int, // 0-10
    val skill: String,
    val mode: String,
    val pasted: Boolean,
    @param:Json(name = "duration_s") val durationS: Int?,
    @param:Json(name = "had_follow_up") val hadFollowUp: Boolean,
)

data class BuildHistory(
    val commits: Int,
    @param:Json(name = "active_days") val activeDays: Int,
    @param:Json(name = "span_days") val spanDays: Int,
    val authors: Int,
    @param:Json(name = "your_commit_share") val yourCommitShare: Double,
    @param:Json(name = "median_lines_per_commit") val medianLinesPerCommit: Int,
)

// A hackathon on the student's profile. Only a claim until verified by a finished viva on its repo.
data class HackathonItem(
    @param:Json(name = "hackathon_id") val hackathonId: String,
    val event: String,
    val year: Int,
    val result: String, // "winner", "finalist" or "participant"
    @param:Json(name = "team_size") val teamSize: Int,
    @param:Json(name = "repo_full_name") val repoFullName: String,
    val verified: Boolean,
    @param:Json(name = "viva_score") val vivaScore: Int?, // null until verified
    @param:Json(name = "your_commit_share") val yourCommitShare: Double?, // null until verified
)

// An unfinished viva, so the app can offer "Continue".
data class VivaInProgress(
    @param:Json(name = "session_id") val sessionId: String,
    @param:Json(name = "repo_full_name") val repoFullName: String?,
    val answered: Int,
    val total: Int,
)

data class MatchItem(
    @param:Json(name = "listing_id") val listingId: String,
    val title: String,
    val venture: String,
    val match: Int, // 0-100
    val why: String,
    val applied: Boolean,
)

data class ReportResponse(
    val student: ReportStudent,
    val repo: ReportRepo?,
    val status: String, // "in_progress" or "done"
    val overall: Int, // 0-100
    val skills: Map<String, Int>, // only tags that were asked, 0-100
    @param:Json(name = "claimed_vs_verified") val claimedVsVerified: List<ClaimedVsVerified>,
    val evidence: List<EvidenceItem>,
    @param:Json(name = "build_history") val buildHistory: BuildHistory?,
    val hackathons: List<HackathonItem>,
    @param:Json(name = "viva_in_progress") val vivaInProgress: VivaInProgress?,
    val matches: List<MatchItem>,
)

// ---------- GET /api/listings ----------
data class Listing(
    val id: String,
    val title: String,
    val venture: String,
    val description: String,
    @param:Json(name = "required_skills") val requiredSkills: Map<String, Double>,
    val tags: List<String>,
)

data class ListingsResponse(
    val listings: List<Listing>,
)

// ---------- POST /api/apply ----------
data class ApplyRequest(
    @param:Json(name = "student_id") val studentId: String,
    @param:Json(name = "listing_id") val listingId: String,
    @param:Json(name = "share_consent") val shareConsent: Boolean,
)

data class ApplyResponse(
    @param:Json(name = "application_id") val applicationId: String,
    val status: String,
    val match: Int,
)

// ---------- POST /api/students/{student_id}/hackathons ----------
data class HackathonCreateRequest(
    val event: String,
    val year: Int,
    val result: String, // "winner", "finalist" or "participant"
    @param:Json(name = "team_size") val teamSize: Int,
    @param:Json(name = "repo_full_name") val repoFullName: String,
)

// ---------- DELETE /api/students/{student_id}/hackathons/{hackathon_id} ----------
data class OkResponse(
    val ok: Boolean,
)
```

File: app/src/main/java/com/example/data/api/VerifiedBuildApi.kt
```kotlin
package com.example.data.api

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

// The student-facing endpoints of the VerifiedBuild API. Paths have no leading "/"
// because ApiConfig.API_BASE ends with "/". The app never calls /api/admin/*.
interface VerifiedBuildApi {
    @GET("api/health")
    suspend fun health(): HealthResponse

    @POST("api/students")
    suspend fun createStudent(@Body body: StudentCreateRequest): StudentCreatedResponse

    @GET("api/github/{username}/repos")
    suspend fun listRepos(@Path("username") username: String): ReposResponse

    @POST("api/analyze")
    suspend fun analyze(@Body body: AnalyzeRequest): AnalyzeResponse

    @GET("api/viva/{sessionId}")
    suspend fun vivaState(@Path("sessionId") sessionId: String): VivaStateResponse

    @POST("api/viva/{sessionId}/answer")
    suspend fun submitAnswer(@Path("sessionId") sessionId: String, @Body body: AnswerRequest): AnswerResponse

    @GET("api/report/{studentId}")
    suspend fun report(@Path("studentId") studentId: String): ReportResponse

    @GET("api/listings")
    suspend fun listings(): ListingsResponse

    @POST("api/apply")
    suspend fun apply(@Body body: ApplyRequest): ApplyResponse

    @POST("api/students/{studentId}/hackathons")
    suspend fun addHackathon(@Path("studentId") studentId: String, @Body body: HackathonCreateRequest): HackathonItem

    @DELETE("api/students/{studentId}/hackathons/{hackathonId}")
    suspend fun deleteHackathon(@Path("studentId") studentId: String, @Path("hackathonId") hackathonId: String): OkResponse
}
```

Then add this section to the end of PROJECT_RULES.md, exactly:
----- add to PROJECT_RULES.md -----
## Contract v1.1 additions
- Hackathon results (send exactly): winner = "Winner", finalist = "Finalist", participant = "Participant".
- A hackathon entry is a claim until verified is true. Show unverified entries as "Not verified yet", never as achievements.
- A student can verify a repo they own, or a teammate's or organisation's repo they have commits in. On team repos the questions are about the files they changed.
- The report combines all finished vivas. Use report.vivaInProgress (not SessionStore) to decide whether a viva can be continued.
----- end -----

PART 2: Dashboard "Continue" uses the server's record
In StudentDashboardScreen and AppViewModel:
- Card B ("Finish your viva") now shows when report.vivaInProgress != null, whatever report.status is.
  - Text: "{repo name of vivaInProgress.repoFullName} · {answered} of {total} answered".
  - "Continue" calls viva.resume(vivaInProgress.sessionId, store.timeLimitS), then goes to Viva. If viva.state.error is set after resume, show its message on the Dashboard instead.
- If status == "done" AND vivaInProgress != null: show card C first, then card B below it, smaller.
- Card A shows only when report.repo == null and vivaInProgress == null.

PART 3: Repo picker
Create app/src/main/java/com/example/ui/screens/student/RepoPickerScreen.kt.
- On open, AppViewModel loads GET /api/github/{store.githubUsername}/repos as Load<ReposResponse>.
- Each row:
  - the repo name (the part after "/") in bold;
  - the description, or "No description" in muted text;
  - "{language or 'Code'} · ★ {stars} · Updated {first 10 characters of pushedAt}". Don't use java.time: minSdk is 24.
- Empty list: "No public repos found on @{username}. Push a project to GitHub, then tap Refresh." Add a Refresh button.
- Below the list, a text button "Verify a team repo instead" that opens a small dialog with an "owner/repo" text field.
  - Accept a full GitHub URL too: strip "https://github.com/" and anything after the second path part.
  - Valid means ^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$.
  - Helper text: "A teammate's or organisation's repo you have commits in."
  - "Start" goes to Analyzing(that repo).
- Tapping a repo opens a dialog:
  Title "Verify {repo name}?"
  Text "We'll read the code and ask you 5 questions about it. Answer by speaking or typing, in any language. Each question has 90 seconds."
  If report.vivaInProgress != null, add: "Your unfinished viva on {its repo name} will stay unfinished."
  Buttons "Start" and "Cancel". Start does navigate(Analyzing(fullName)).
- Back goes to Dashboard.

PART 4: Analyzing
Create app/src/main/java/com/example/ui/screens/student/AnalyzingScreen.kt.
- When Analyzing(repoFullName) becomes the current screen, AppViewModel starts POST /api/analyze ONCE with AnalyzeRequest(store.studentId, repoFullName).
  - Keep the Job in the ViewModel and ignore repeat calls while it runs; rotation must not start a second analyze.
  - Cancel the Job if the student presses Back.
- UI: an indeterminate progress indicator and "Reading {repo name} and writing 5 questions about your code. This usually takes 15–30 seconds." No fake step-by-step progress.
- On Ok:
  - Keep the AnalyzeResponse in AppViewModel as lastAnalysis.
  - store.sessionId = sessionId; store.timeLimitS = timeLimitS.
  - viva.startFrom(value).
  - replace(RepoFound).
- On Err: show error.message with "Try again" (runs analyze again) and "Pick another repo" (back to RepoPicker).

PART 5: "What we found in your repo"
Add the destination RepoFound to Screen. Create app/src/main/java/com/example/ui/screens/student/RepoFoundScreen.kt, built from lastAnalysis only.
- Title: "We read {repo name}". Subtitle: "{repo.filesRead} files read".
- A languages bar: one horizontal bar split by repo.languages percentages (largest first; anything after the 4th grouped as "Other"), with a legend under it showing name and %.
- If contribution.teamRepo: a card titled "Team repo".
  Text: "You made {yourCommits} commits here. Your questions are about the files you changed:"
  Then up to 5 of focusFiles in monospace.
- "What your code shows": one row per repoSkills item, with the tag display-name chip and its evidence sentence.
- Note: "Your 5 questions point at specific lines of this code. Each has 90 seconds. Speak or type, in any language."
- Primary button "Start question 1" does replace(Viva).
- Back goes to Dashboard; the viva stays saved and can be continued.

PART 6: Wire it up
- VerifiedBuildApp: RepoPicker, Analyzing and RepoFound show the new screens. Viva, VivaComplete and Report stay placeholders until Stages 4 and 5.
- Dashboard "Pick a repo" and "Verify another repo" go to RepoPicker.

DO NOT
- Do not change any locked file other than the two this stage replaces.
- Do not change Gradle files, the manifest, applicationId or namespace.
- Do not compute or invent anything on the RepoFound screen. Every number and sentence comes from the AnalyzeResponse.

DONE WHEN
- The project builds.
- Picking one of your repos shows Analyzing, then "We read …" with real languages, files read and skills with evidence. "Start question 1" opens the Viva placeholder.
- A teammate's repo you have commits in shows the "Team repo" card. A repo you have no commits in shows the API's REPO_NOT_OWNED message.
- Leaving and reopening the app shows "Finish your viva" on the Dashboard.

REPORT BACK
List every file you created, changed or deleted.

END OF STAGE 3
````

Commit message: `Update the API layer to v1.1 and add repo picking and the repo summary screen`

---

### STAGE 4: the viva

````text
STAGE 4 of 7. First read PROJECT_RULES.md in the project root and follow it exactly.

WHERE THE PROJECT IS NOW
- The API layer is v1.1.
- RepoPicker → Analyzing → RepoFound work, and "Start question 1" does replace(Viva).
- Viva and VivaComplete are placeholders. VivaController already holds the viva state, and AppViewModel.lastAnalysis holds the analyze response.

GOAL
The student answers 5 questions about their code, by voice or text, with follow-ups for weak answers. The viva can be left and continued later.

FIRST, PLAN
Before changing code, list the files you will create, change and delete in this stage. Then make the changes.

PART 1: Viva screen
Create app/src/main/java/com/example/ui/screens/student/VivaScreen.kt. You may reuse layout ideas and styling from AiInterviewScreen.kt, then DELETE AiInterviewScreen.kt and ProjectDetailScreen.kt.
The screen reads ONLY viva.state (VivaUiState), plus lastAnalysis for the label below. It calls only the VivaController functions, through AppViewModel. Never show a score or a rubric (the API doesn't send them).

Top bar:
- "Question {questionNumber} of {questions.size}" and a LinearProgressIndicator at answeredIds.size / questions.size.
- A close (X) button. It asks "Leave the viva? Your answers so far are saved. You can continue from your dashboard." with Leave and Stay. Leave discards any recording and goes to Dashboard.
- Keep the screen awake while this screen shows: LocalView.current.keepScreenOn = true inside a DisposableEffect, reset in onDispose.

Question area, for currentQuestion:
- Chips: difficulty ("Easy", "Medium", "Hard") and the skill display name.
- If lastAnalysis?.contribution?.focusFiles contains currentQuestion.file: a small label "You changed this file".
- A code card:
  - header "{file} · lines {lines}";
  - the snippet in monospace, each line prefixed by its line number starting at snippetStartLine;
  - no wrapping, horizontal scroll, maximum height 280dp with vertical scroll;
  - no copy button.
- The question text, large.
- If state.followUp != null: show the original question smaller and muted, with a highlighted card above it titled "One more chance on this question" holding the followUp text. VivaController sends the next answer to the follow-up.
- If state.lastTranscript != null: a small card "Answer saved. We heard: “{lastTranscript}”" with a close icon that calls viva.clearTranscript().

Timer:
- Restart a countdown from state.timeLimitS whenever the current question or the follow-up changes. Show it as m:ss.
- At 0: if recording, stop it but KEEP the recording. Show "Time's up. Submit what you have."
- Never submit automatically.

Answer area, with two tabs: "Speak" (the default) and "Type".
Keep the answer input (the RecordedAnswer, the typed text, the pasted flag and when the question appeared) in AppViewModel, not in the composable, so rotation loses nothing. Reset it when the question or follow-up changes, but NOT after an error, so the same answer can be retried.

Speak tab:
- Ask for RECORD_AUDIO with rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) the first time the mic is tapped.
  If denied, show "Microphone access is off. You can type your answer instead." and switch to Type.
- Idle: a big round mic button and "Tap to start speaking". It calls recorder.start(). If start() throws, show "We couldn't start the microphone. You can type your answer instead."
- Recording: a red stop button and "Recording {m:ss} · tap to stop", updated once a second from recorder.elapsedSeconds().
- Stopped: val rec = recorder.stop().
  - If rec is null: "That recording was too short. Please try again."
  - Otherwise show "Recorded {m:ss}" with "Submit answer" and "Record again" (Record again discards it and starts over).
- Submit: viva.submit(mode = "voice", audioBase64 = rec.audioBase64, audioMime = rec.mime, durationS = rec.seconds).

Type tab:
- A multi-line OutlinedTextField, at least 6 lines, placeholder "Explain in your own words. Any language is fine." Stop input at 6000 characters.
- Paste rule: if one onValueChange makes the text 25 or more characters longer at once, set pasted = true for this answer. It stays true until the question changes.
- Submit (enabled when the text isn't blank):
  viva.submit(mode = "text", answerText = text, durationS = seconds since this question or follow-up appeared (at most 3600), pasted = pasted).

While state.loading:
- Disable all input and buttons.
- Show "Saving your answer…". Spoken answers take about 6 s, typed about 3 s.

Errors (state.error != null):
- Show error.message in a card.
- If state.canRetry: a "Try again" button that calls viva.retry().
- Otherwise: an "OK" button that calls viva.clearError(), and the student records or types again.

When state.done becomes true: replace(VivaComplete).
The Back button on this screen shows the same Leave dialog.

PART 2: Viva complete
Create app/src/main/java/com/example/ui/screens/student/VivaCompleteScreen.kt:
- Title "Viva complete". Text "Your report is ready."
- When it opens:
  - set store.sessionId = null;
  - reload reportState;
  - if a report.hackathons item has the same repoFullName as the viva (lastAnalysis?.repo?.fullName) and verified is true, show a highlighted card: "This viva also verified: {Result} at {event} {year}".
- Buttons "See my report" (goes to Report) and "Back to dashboard".
- Back goes to Dashboard.

PART 3: Wire it up
- VerifiedBuildApp: Viva and VivaComplete show the new screens. Remove their placeholders.

DO NOT
- Do not change the locked files, Gradle files, the manifest, applicationId or namespace.
- Do not use Android SpeechRecognizer, Gemini or any transcription in the app. The API transcribes the audio.
- Do not store questions or answers on the phone. The API is the record.

DONE WHEN
- The project builds.
- A full viva works on a real phone:
  - 5 questions, answered by voice and by text;
  - a weak typed answer ("not sure") gets "One more chance on this question";
  - leaving and continuing from the Dashboard resumes at the right question;
  - it ends on Viva complete.

REPORT BACK
List every file you created, changed or deleted.

END OF STAGE 4
````

Commit message: `Answer the viva by voice or text, with follow-ups and resume`

---

### STAGE 5: the report: You said / You showed, code next to every answer, matches, apply

````text
STAGE 5 of 7. First read PROJECT_RULES.md in the project root and follow it exactly.

WHERE THE PROJECT IS NOW
- The whole viva works, and ends on VivaComplete.
- Report is a placeholder.
- reportState and the listings are loaded by AppViewModel.

GOAL
The report a judge remembers:
- what the student claimed next to what they showed;
- every answer next to the exact code it was about;
- verified hackathons;
- internships matched on verified skills, with a consent step to apply.

FIRST, PLAN
Before changing code, list the files you will create, change and delete in this stage. Then make the changes.

PART 1: Radar chart
Change app/src/main/java/com/example/ui/components/RadarChart.kt:
- InteractiveRadarChart now takes dimensions: List<RadarDimension> instead of AssessmentReportEntity. Keep its drawing, animation and tap-to-select.
- Remove the 8 hard-coded dimensions and their hard-coded descriptions and recommendations.
- RadarDimension keeps its fields (title, score, description, recommendation). If recommendation is blank, don't draw it.
- RadarChart.kt must not import anything from data/model.

PART 2: Report screen
Create app/src/main/java/com/example/ui/screens/student/ReportScreen.kt. Reuse the visual style of AssessmentReportScreen.kt, then DELETE AssessmentReportScreen.kt.
Reload reportState when the screen opens.

If report.status != "done":
- Show only a card "Finish your viva to see your scores", with the Dashboard's Continue behaviour (report.vivaInProgress).
- Show no numbers.

If report.status == "done", show these sections in order:

1. Header: student name, college, "@{githubUsername}".
   - If report.evidence spans more than one repoFullName: "Based on {n} repos" with the repo names.
   - Otherwise: "Repo: {repo.fullName}".

2. Overall: "{overall}/100" (large, ScoreBadge), with the caption "Average score of every answer".
   When the screen first opens, animate the number counting up from 0 over about 800 ms.

3. "You said / You showed": a two-column table with the column headers "You said" and "You showed". One row per report.claimedVsVerified item, in order:
   - claimed == true: left = the skill name as a SkillChip; right = the level chip.
   - claimed == false: left = "—" in muted text; right = the tag display name and the level chip, with a small "not on your profile" under it.
   - Level chip labels and colours come from PROJECT_RULES.md.
   - Caption: "Only what you showed counts toward matches."

4. Radar chart: 6 dimensions, one per skill tag in the order and with the display names in PROJECT_RULES.md.
   - title = the tag display name;
   - score = report.skills[tag] ?: 0;
   - description = "{level label} · {score}/100" when the tag is in report.skills, otherwise "Not shown · your repo had no question on this skill";
     the level label comes from the API's thresholds: 70 or more is Strong, 40–69 is Partial, below 40 is Not verified. That is the only thing the app derives; it never computes a score;
   - recommendation = "".

5. "Your hackathons" (only if report.hackathons is not empty). One row per item:
   - "{Result} · {event} {year}" and "{repo name} · team of {teamSize}".
   - verified == true: an emerald "Verified" chip, then "Viva {vivaScore}/100 · {round(yourCommitShare * 100)}% of commits by you". If yourCommitShare is null, leave out that part.
   - verified == false: a neutral "Not verified yet" chip, with a "Verify now" button that goes to Analyzing(repoFullName).

6. "Your answers": one card per report.evidence item, in order:
   - "Q{n} · {skill display name} · {score}/10";
   - the question;
   - "Your answer:" and answerExcerpt;
   - if evidenceQuote is not blank: the quote in italics, between curly quotes, with a left border;
   - "Covered" with a ✓ per item (emerald), and "Missed" with a • per item (muted). Hide either if empty.
   - a "Show the code" toggle that expands a code block:
     - header "{repoFullName} · {file} · lines {lines}";
     - the snippet with line numbers from snippetStartLine;
     - monospace, horizontal scroll, maximum height 240dp.
   - a footer of plain facts, all in the same neutral grey: a Mic icon with "Spoken" or a Keyboard icon with "Typed"; "{durationS}s" if not null; "Follow-up asked" if hadFollowUp; "Text was pasted" if pasted.

7. "How the repo was built (from GitHub)": only if buildHistory != null.
   - if commits is 100 or less: "{commits} commits over {spanDays} days, active on {activeDays} days";
     if more than 100: "{commits} commits in total. The last 100 span {spanDays} days, active on {activeDays} days" (the API measures days and authors over the last 100 commits only)
   - "{authors} author(s) · {round(yourCommitShare * 100)}% of those commits by you"
   - "Median {medianLinesPerCommit} lines changed per commit"
   - Use the singular for 1 ("1 commit over 1 day", "1 author", "1 line"), and leave out "active on …" when spanDays is 1.
   - Caption: "Facts from GitHub. They don't change your score."

8. "Internships matched on what you showed": one card per report.matches item, in order:
   - title, venture, "{match}% match" (ScoreBadge), and the why text;
   - the listing's description and tags, joined from the listings by id = listingId (tags as SkillChip with the interest labels);
   - an Apply button, or a disabled "Applied ✓" if applied.

PART 3: Apply with consent
- Apply opens a dialog:
  Title "Apply to {title} at {venture}?"
  Text "Applying shares your VerifiedBuild report (scores, answers, code evidence and hackathons) with {venture} for this role. Nobody else sees it."
  Checkbox "I agree to share my report with {venture}."
  "Apply" is enabled only when the box is checked, plus a "Cancel" button.
- On Apply: POST /api/apply with ApplyRequest(store.studentId, listingId, shareConsent = true). Disable the dialog while it's sending.
- On Ok: close the dialog, show the snackbar "Applied. {venture} can now see your report.", and reload the report.
- On Err:
  - code == "ALREADY_APPLIED": close the dialog and reload;
  - otherwise: show error.message in the dialog.

PART 4: Wire it up
- VerifiedBuildApp: Report shows ReportScreen. Remove its placeholder. Back goes to Dashboard.
- Dashboard "View report" and "See all and apply", and VivaComplete "See my report", go to Report.

DO NOT
- Do not change the locked files, Gradle files, the manifest, applicationId or namespace.
- Do not use warning colours or words for "pasted", for the build history, or for "Not verified yet". They are neutral facts.
- Do not compute any score. Show the API's numbers exactly.

DONE WHEN
- The project builds.
- After a finished viva, the report shows every section with the API's numbers, and "Show the code" opens the right lines.
- Applying needs the tick box, a second apply is impossible, and the card shows "Applied ✓".

REPORT BACK
List every file you created, changed or deleted.

END OF STAGE 5
````

Commit message: `Show the report with claimed vs shown, code evidence, matches and consent to apply`

---

### STAGE 6: hackathons

````text
STAGE 6 of 7. First read PROJECT_RULES.md in the project root and follow it exactly.

WHERE THE PROJECT IS NOW
- Sign-up, dashboard, repo picker, analyzing, RepoFound, the viva and the report all work.
- The report already lists report.hackathons, with "Verify now" for unverified ones.

GOAL
Students add their hackathons (event, result, team size, project repo) and verify each one with a viva on its repo. This is the third input of the problem statement, next to skills and interests.

FIRST, PLAN
Before changing code, list the files you will create, change and delete in this stage. Then make the changes.

PART 1: "Your hackathons" on the Dashboard
- Add a section "Your hackathons" below the main card(s), built from report.hackathons. Use the same row layout as the report (Verified chip / Not verified yet chip, and "Verify now").
- Empty state: "Add the hackathons you've done. Each one counts toward your matches once you verify it with a viva on its repo."
- Button "Add a hackathon".
- Each row has an overflow menu with "Remove". Confirm with "Remove {event} {year} from your profile?", then DELETE /api/students/{store.studentId}/hackathons/{hackathonId} and reload the report.

PART 2: Add a hackathon
Create app/src/main/java/com/example/ui/screens/student/AddHackathonSheet.kt, a ModalBottomSheet opened from the Dashboard:
- Event name: required, at most 120 characters, placeholder "e.g. Smart City Hackathon".
- Year: a number field, default = the current year. Use Calendar.getInstance(), not java.time. Must be between 2000 and 2100.
- Result: three segmented buttons, Winner / Finalist / Participant. Send "winner", "finalist" or "participant".
- Team size: a stepper from 1 to 20, default 1.
- Project repo, with two options:
  a. "One of my repos": a dropdown filled from GET /api/github/{store.githubUsername}/repos. Reuse the repo list already loaded for RepoPicker if there is one.
  b. "A teammate's or organisation's repo": an "owner/repo" text field, with the same normalising and validation as in RepoPicker's team-repo dialog.
     Helper: "You need commits in it. On team repos, your viva asks about the files you changed."
- Button "Add":
  - POST /api/students/{store.studentId}/hackathons with HackathonCreateRequest(event, year, result, teamSize, repoFullName).
  - Disable the sheet while it's sending.
  - On Ok: close the sheet, reload the report, and show the snackbar "Added. Verify it with a viva on {repo name}." with the action "Verify now", which goes to Analyzing(repoFullName).
  - On Err: show error.message in the sheet and keep what was typed. REPO_NOT_OWNED and REPO_NOT_FOUND come with clear messages from the API.

PART 3: Verify flow
- "Verify now", from the Dashboard, the Report or the snackbar, goes to Analyzing(repoFullName). The rest is the normal flow: RepoFound, Viva, VivaComplete.
- VivaComplete already shows "This viva also verified: …" (Stage 4). Make sure it appears after verifying a hackathon repo.

DO NOT
- Do not change the locked files, Gradle files, the manifest, applicationId or namespace.
- Do not show an unverified hackathon as an achievement: no trophy icons or celebratory colours until verified is true.
- Do not invent example hackathons, and do not prefill the event name.

DONE WHEN
- The project builds.
- Adding a hackathon on one of your repos shows it as "Not verified yet". Verify now → a viva → VivaComplete says it was verified → the Dashboard and Report show "Verified" with the viva score.
- A repo you have no commits in is refused with the API's message.
- Remove takes the entry off after confirmation.

REPORT BACK
List every file you created, changed or deleted.

END OF STAGE 6
````

Commit message: `Add hackathons and verify them with a viva on their repo`

---

### STAGE 7: cleanup, polish and demo readiness

````text
STAGE 7 of 7. First read PROJECT_RULES.md in the project root and follow it exactly.

WHERE THE PROJECT IS NOW
Every screen is built: Welcome, Onboarding, Dashboard (with hackathons), RepoPicker, Analyzing, RepoFound, Viva, VivaComplete and Report.

GOAL
Remove what's left of the old app, check the rules across the whole project, and make the app feel solid in a live demo.

FIRST, PLAN
Before changing code, list the files you will create, change and delete in this stage. Then make the changes.

PART 1: Delete the old local data layer
- Delete app/src/main/java/com/example/data/model/Entities.kt, app/src/main/java/com/example/data/dao/AppDao.kt and app/src/main/java/com/example/data/db/AppDatabase.kt.
- Fix anything that still referenced them. No Kotlin file may import com.example.data.model, com.example.data.dao, com.example.data.db or com.example.network.
- Remove every placeholder screen. Leave the Gradle files exactly as they are, even if some dependencies are now unused.

PART 2: Search the whole project and fix every hit
- Banned in Kotlin code: BuildConfig.GEMINI_API_KEY, "generativelanguage", "api.github.com", "firebase.ai", "SpeechRecognizer", "androidx.room". The app talks only to ApiConfig.API_BASE.
- No invented people, companies, colleges, events or data in strings, sample data or hard-coded values. Remove any such use of: Google, Atlassian, Razorpay, IIT, VIT, BITS, HackMIT, NeurIPS, Smart India Hackathon, Aarav, Ananya, Rohan, Vikram, Sarah, Aditya, CloudPulse, CloudMatrix, "749210", or default scores such as 85.
  (The "e.g. Smart City Hackathon" placeholder in AddHackathonSheet is allowed: it's a hint, not data.)
  Package names and imports (com.google.*, androidx.*, com.squareup.*) are code, not data. Do not touch them, or any identifier that merely contains these letters.
- Banned words in user-visible text: detect, catch, cheat, flag, suspicious, integrity, fraud, plagiarism, AI-powered, revolutionary, seamless, leverage, empower.
- No user-visible "NexusIntern". Leave rootProject.name and applicationId unchanged.

PART 3: States and back behaviour
- Every screen that loads data has a progress indicator, the API's error message with Retry, and an empty state for lists.
- Every button that starts an API call is disabled until it finishes.
- Back:
  - Welcome and Dashboard close the app.
  - Onboarding goes to Welcome.
  - RepoPicker goes to Dashboard.
  - Analyzing cancels and goes to RepoPicker.
  - RepoFound goes to Dashboard.
  - Viva shows the Leave dialog.
  - VivaComplete and Report go to Dashboard.

PART 3b: Recruiter link (an allowed exception to rule 6)
In app/src/main/java/com/example/data/api/ApiClient.kt, make sure the RECRUITER_WEB_URL line reads exactly:
    const val RECRUITER_WEB_URL = "https://verifiedbuild-api-215071922486.asia-south1.run.app/recruiter/"
Change nothing else in that file. If the line is already correct, leave it. The Welcome screen then shows "Hiring? Open the recruiter dashboard".

PART 4: Feel
- Haptics: LocalHapticFeedback.current.performHapticFeedback(HapticFeedbackType.LongPress) when recording starts, when it stops, and when "Answer saved" appears.
- Transitions: a short fade (about 200 ms) when the viva moves to the next question or a follow-up appears. Use AnimatedContent keyed by questionId + followUp.
- The Report's overall number counts up once per screen visit (from Stage 5). Make sure it doesn't restart on rotation.

PART 5: Accessibility and layout
- Every icon-only button has a contentDescription.
- Touch targets are at least 48dp.
- Text uses MaterialTheme typography, so it scales with the system font size.
- Every screen scrolls on a 360dp-wide phone with nothing cut off, including at the largest system font.

PART 6: Report back
List:
(1) every file you deleted;
(2) every file you created or changed;
(3) the result of each search in Part 2, with any remaining hit and why it stays.

DONE WHEN
- The project builds.
- The Part 2 searches are clean.
- The full journey works on a real phone, from a fresh install: Welcome → sign up → dashboard → add a hackathon → verify it (repo found → 5 answers with voice, text and a follow-up → viva complete) → report → apply.

END OF STAGE 7
````

Commit message: `Remove the old local data layer, polish every screen and check the rules`

---

## Part C: checks to run on a real phone after each stage

Use your own GitHub username, and one of your public repos with real code.

**Stage 1**
- [ ] The app opens on Welcome and shows "Connected".
- [ ] In airplane mode, Welcome shows an error and Retry. Turn the network back on, tap Retry, and it shows "Connected".
- [ ] Recruiter and admin screens are gone. The launcher name is "VerifiedBuild".

**Stage 2**
- [ ] Sign up with skill chips only. You land on the Dashboard with "Verify your skills".
- [ ] Sign out, then sign up again with a PDF resume. It works, and takes a few seconds longer.
- [ ] The username `no-such-user-zz-998877` shows "We couldn't find that GitHub username." and keeps what you typed.
- [ ] Pasting `https://github.com/yourname` into the username field still works.
- [ ] Close the app fully and reopen it. It opens on the Dashboard.
- [ ] No percentages are shown before a viva.

**Stage 3**
- [ ] `/api/health` shows `"version":"v1.1"` before you start.
- [ ] Your repos are listed, newest first.
- [ ] Picking one shows Analyzing for about 15–30 s, then "We read …" with the languages bar, files read, and skills with evidence sentences that mention your real files.
- [ ] Rotating during Analyzing doesn't start a second analyze.
- [ ] "Verify a team repo instead" with a teammate's repo you committed to shows the "Team repo" card. With `torvalds/linux` it shows the API's refusal.
- [ ] Press Back on "We read …", close the app and reopen it. The Dashboard shows "Finish your viva".

**Stage 4**
- [ ] Question 1 of 5 shows real code with the right line numbers.
- [ ] A voice answer shows "Answer saved. We heard: …" after about 6 s.
- [ ] A Hindi, Telugu or Hinglish answer keeps your words in the transcript.
- [ ] A typed "not sure" gets "One more chance on this question".
- [ ] Tapping Submit twice quickly records one answer, and the viva carries on normally.
- [ ] X → Leave, close the app, reopen, then Continue on the Dashboard: it resumes at the right question.
- [ ] Let the timer reach 0 while recording. The recording stops, is kept, and can be submitted.
- [ ] After question 5 you see "Viva complete".

**Stage 5**
- [ ] The report shows, in order: overall (counting up), You said / You showed, the radar with "Not shown" axes, your answers with "Show the code" opening the right lines, build history, and internships.
- [ ] The numbers match `/api/report/<student_id>` in a browser (SAM can give you the id).
- [ ] Apply is disabled until you tick the box. After applying the card shows "Applied ✓", and SAM sees you in the recruiter shortlist.

**Stage 6**
- [ ] Add a hackathon on one of your repos. It shows "Not verified yet".
- [ ] Verify now → viva → "This viva also verified: …" → it shows "Verified · Viva N/100" on the Dashboard and the Report.
- [ ] The match percentages on the Report go up a little after verifying (verified hackathons count 15%).
- [ ] A hackathon on a repo you've never committed to is refused with the API's message.
- [ ] Remove works after confirming.

**Stage 7**
- [ ] The full journey from a fresh install (uninstall first).
- [ ] At the largest system font nothing is cut off.
- [ ] You feel a small vibration when recording starts and stops.
- [ ] Welcome shows "Hiring? Open the recruiter dashboard", and it opens the dashboard in the browser.

---

## Part D: when something breaks

**Build error:** paste this into AI Studio, filled in:

```text
The build fails with this error:
<paste the exact error lines>
Fix only this error. Follow PROJECT_RULES.md. Do not change the locked files (data/api/*, data/SessionStore.kt, data/ResumePicker.kt, audio/AnswerRecorder.kt, viva/VivaController.kt), Gradle files, the manifest, applicationId or namespace. Tell me which files you changed.
```

**A screen behaves wrongly:** paste this, filled in:

```text
On the <screen> screen, when I <what you did>, I expected <what the stage prompt says should happen> but got <what happened>.
Fix only this, following PROJECT_RULES.md and the stage prompt. Do not change the locked files. Tell me which files you changed.
```

**The API returns something unexpected,** or a locked file looks wrong: don't fix it in the app. Message SAM with the screen, what you did, the message shown, and the time.

---

## Part E: demo-day phone setup

- **Mirror the phone to the laptop** with scrcpy over USB (free and open source; no Wi-Fi needed), so the judges see the phone on the projector. Practise it once.
- **Phone settings:** Do Not Disturb on, brightness up, screen timeout at 10 minutes, default font size, battery over 80%, notifications cleared.
- **Network:** venue Wi-Fi, with a phone hotspot ready as backup. Check `/api/health` on the phone's browser right before you go on stage.
- **Accounts:** one phone signed in as the persona, with a finished viva and a verified hackathon (for the report), and a second, fresh install ready for the live part (sign-up → repo → one spoken answer).
- **Backup video:** record the full journey with the phone's screen recorder after Stage 7. It's also a required submission.
