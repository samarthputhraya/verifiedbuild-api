import com.example.data.api.*
import com.example.viva.VivaController
import kotlinx.coroutines.runBlocking

// Live test of VivaController: follow-ups, resuming in a second controller, a stale double submit, finishing.
fun vivaFlowTest(studentGithub: String, repo: String): String = runBlocking {
    val st = (ApiClient.call {
        createStudent(StudentCreateRequest("Viva Flow Test (delete me)", "flow@example.com", "Test", studentGithub, listOf("ai")))
    } as ApiResult.Ok).value
    println("STUDENT_ID=${st.studentId}")
    val analysis = (ApiClient.call { analyze(AnalyzeRequest(st.studentId, repo)) } as ApiResult.Ok).value

    val a = VivaController()
    a.startFrom(analysis)
    check("starts on q1", a.state.value.currentQuestionId == "q1" && a.state.value.questionNumber == 1)
    a.submit(mode = "text", answerText = "not sure", durationS = 10)
    check("weak answer keeps q1 open with a follow-up", a.state.value.currentQuestionId == "q1" && a.state.value.followUp != null && a.state.value.lastTranscript == "not sure", a.state.value)
    a.submit(mode = "text", answerText = "It keeps each part separate so it can be tested.", durationS = 10)
    check("follow-up answered moves to q2", a.state.value.currentQuestionId == "q2" && a.state.value.followUp == null && a.state.value.answeredIds == listOf("q1"), a.state.value)

    val b = VivaController()
    b.resume(analysis.sessionId, analysis.timeLimitS)
    check("second controller resumes at q2", b.state.value.currentQuestionId == "q2" && b.state.value.answeredIds == listOf("q1") && b.state.value.questions.size == 5, b.state.value)
    b.submit(mode = "text", answerText = "I don't know", durationS = 5)
    // a is now stale: it still thinks q2 has no answer. Its submit must recover, not break.
    a.submit(mode = "text", answerText = "stale double submit", durationS = 5)
    check("stale submit recovers from ALREADY_ANSWERED", a.state.value.error == null && a.state.value.currentQuestionId == b.state.value.currentQuestionId && a.state.value.followUp == b.state.value.followUp, a.state.value to b.state.value)

    val empty = VivaController(); empty.resume(analysis.sessionId)
    empty.submit(mode = "text", answerText = "   ")
    check("empty answer -> EMPTY_ANSWER, not retryable", empty.state.value.error?.code == "EMPTY_ANSWER" && !empty.state.value.canRetry, empty.state.value.error)

    var guard = 0
    while (!b.state.value.done && guard++ < 12) {
        b.submit(mode = "text", answerText = "It splits the logic into small functions.", durationS = 8)
        if (b.state.value.error != null) { check("no error while finishing", false, b.state.value.error); break }
    }
    check("viva finished", b.state.value.done && b.state.value.currentQuestionId == null && b.state.value.answeredIds.size == 5, b.state.value)
    val c = VivaController(); c.resume(analysis.sessionId)
    check("resume after finish says done", c.state.value.done && c.state.value.currentQuestion == null)
    st.studentId
}
