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
