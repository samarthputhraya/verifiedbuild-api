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
