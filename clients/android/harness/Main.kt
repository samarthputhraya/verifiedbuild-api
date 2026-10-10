import com.example.data.api.*
import kotlinx.coroutines.runBlocking
import java.io.File
import java.util.Base64

var failures = 0

fun check(label: String, ok: Boolean, extra: Any? = null) {
    println((if (ok) "PASS " else "FAIL ") + label + if (!ok && extra != null) "  -> $extra" else "")
    if (!ok) failures++
}

fun <T> ok(label: String, r: ApiResult<T>): T? = when (r) {
    is ApiResult.Ok -> { check(label, true); r.value }
    is ApiResult.Err -> { check(label, false, r); null }
}

fun main(args: Array<String>) = runBlocking {
    val examples = File(args[0])
    val m = ApiClient.moshi
    val pairs = listOf(
        "get_health" to HealthResponse::class.java, "post_students" to StudentCreatedResponse::class.java,
        "get_github_repos" to ReposResponse::class.java, "post_analyze" to AnalyzeResponse::class.java,
        "get_viva" to VivaStateResponse::class.java, "post_viva_answer" to AnswerResponse::class.java,
        "get_report" to ReportResponse::class.java, "get_listings" to ListingsResponse::class.java,
        "post_apply" to ApplyResponse::class.java,
    )
    for ((name, cls) in pairs) {
        val parsed: Any? = try { m.adapter(cls).fromJson(File(examples, "$name.json").readText()) } catch (e: Exception) { e }
        check("example $name parses", parsed != null && parsed !is Exception, parsed)
    }
    val rep = m.adapter(ReportResponse::class.java).fromJson(File(examples, "get_report.json").readText())!!
    check("report example fields mapped",
        rep.buildHistory?.yourCommitShare == 1.0 && !rep.evidence[0].hadFollowUp && rep.claimedVsVerified.size == 4 && rep.skills["backend"] == 81, rep)
    val req = m.adapter(AnswerRequest::class.java).toJson(AnswerRequest(questionId = "q1", isFollowUp = false, mode = "text", answerText = "hi"))
    check("request JSON uses API names and drops nulls",
        req == "{\"question_id\":\"q1\",\"is_follow_up\":false,\"mode\":\"text\",\"answer_text\":\"hi\",\"pasted\":false}", req)

    // ---- live API ----
    ok("live health", ApiClient.call { health() })
    val listings = ok("live listings", ApiClient.call { listings() })
    check("6 listings", listings?.listings?.size == 6, listings?.listings?.size)
    val bad = ApiClient.call { createStudent(StudentCreateRequest("X", "x@y.co", "C", "no-such-user-zz-998877", listOf("ai"))) }
    check("unknown GitHub user -> GITHUB_USER_NOT_FOUND with message", bad is ApiResult.Err && bad.code == "GITHUB_USER_NOT_FOUND" && bad.message.isNotBlank(), bad)
    val badBody = ApiClient.call { createStudent(StudentCreateRequest("X", "x@y.co", "C", "samarthputhraya", listOf("cooking"))) }
    check("bad interest -> VALIDATION 422", badBody is ApiResult.Err && badBody.code == "VALIDATION" && badBody.httpStatus == 422, badBody)
    val st = ok("live sign-up", ApiClient.call {
        createStudent(StudentCreateRequest("Kotlin Harness (delete me)", "kt@example.com", "Test College", "SamarthPuthraya",
            listOf("ai", "security"), skills = listOf("Python", "React")))
    }) ?: return@runBlocking
    println("STUDENT_ID=${st.studentId}")
    check("canonical username returned", st.githubUsername == "samarthputhraya", st.githubUsername)
    val repos = ok("live repos", ApiClient.call { listRepos(st.githubUsername) })
    check("repos listed", (repos?.repos?.size ?: 0) > 0)
    val early = ok("live report before viva", ApiClient.call { report(st.studentId) })
    check("report before viva: repo null, in_progress, matches present",
        early?.repo == null && early?.status == "in_progress" && early.buildHistory == null && early.matches.size == 6, early)
    val notOwned = ApiClient.call { analyze(AnalyzeRequest(st.studentId, "torvalds/linux")) }
    check("someone else's repo -> REPO_NOT_OWNED", notOwned is ApiResult.Err && notOwned.code == "REPO_NOT_OWNED", notOwned)
    val missing = ApiClient.call { report("00000000-0000-0000-0000-000000000000") }
    check("unknown student -> STUDENT_NOT_FOUND 404", missing is ApiResult.Err && missing.code == "STUDENT_NOT_FOUND" && missing.httpStatus == 404, missing)

    val a = ok("live analyze", ApiClient.call { analyze(AnalyzeRequest(st.studentId, "samarthputhraya/kavach")) }) ?: return@runBlocking
    check("5 questions with snippets", a.questions.size == 5 && a.questions.all { it.snippet.isNotBlank() && it.snippetStartLine >= 1 }, a.questions)
    val notDone = ApiClient.call { apply(ApplyRequest(st.studentId, "l-promtal-backend", true)) }
    check("apply before done -> VIVA_NOT_DONE", notDone is ApiResult.Err && notDone.code == "VIVA_NOT_DONE", notDone)

    val m4a = Base64.getEncoder().encodeToString(File(args[1]).readBytes())
    for (q in a.questions) {
        val body = if (q.id == "q1") AnswerRequest(q.id, false, "voice", audioBase64 = m4a, audioMime = "audio/mp4", durationS = 30)
        else AnswerRequest(q.id, false, "text", answerText = "I am not sure, it handles the main logic.", durationS = 20, pasted = q.id == "q5")
        val r = ok("answer ${q.id} (${body.mode})", ApiClient.call { submitAnswer(a.sessionId, body) }) ?: continue
        if (q.id == "q1") check("m4a voice answer transcribed", r.transcript.length > 20, r.transcript)
        if (r.followUp != null) {
            val s = ok("viva state with pending follow-up", ApiClient.call { vivaState(a.sessionId) })
            check("pending follow-up matches", s?.pendingFollowUp?.questionId == q.id && s?.currentQuestionId == q.id, s)
            ok("follow-up ${q.id}", ApiClient.call {
                submitAnswer(a.sessionId, AnswerRequest(q.id, true, "text", answerText = "It splits the work so each part can be tested.", durationS = 15))
            })
        }
    }
    val dup = ApiClient.call { submitAnswer(a.sessionId, AnswerRequest("q2", false, "text", answerText = "again")) }
    check("second answer -> ALREADY_ANSWERED 409", dup is ApiResult.Err && dup.code == "ALREADY_ANSWERED" && dup.httpStatus == 409, dup)
    val fin = ok("viva state at end", ApiClient.call { vivaState(a.sessionId) })
    check("viva done, no current question", fin?.status == "done" && fin.currentQuestionId == null && fin.answered.size == 5, fin)
    val done = ok("live report after viva", ApiClient.call { report(st.studentId) }) ?: return@runBlocking
    check("report done with evidence and build history",
        done.status == "done" && done.evidence.size == 5 && done.buildHistory != null && done.repo?.fullName == "samarthputhraya/kavach", done)
    check("q1 evidence recorded as voice; q5 as pasted",
        done.evidence.first { it.questionId == "q1" }.mode == "voice" && done.evidence.first { it.questionId == "q5" }.pasted)
    println("   overall=${done.overall} skills=${done.skills} levels=${done.claimedVsVerified.map { it.name + ":" + it.level }}")
    val applied = ok("live apply", ApiClient.call { apply(ApplyRequest(st.studentId, done.matches.first().listingId, true)) })
    check("apply returns match", applied?.status == "applied" && applied.match == done.matches.first().match, applied)
    val again = ok("report shows applied", ApiClient.call { report(st.studentId) })
    check("applied flag set", again?.matches?.first { it.listingId == done.matches.first().listingId }?.applied == true)
    if (args.size > 2 && args[2] == "flow") {
        println("--- VivaController flow")
        vivaFlowTest("samarthputhraya", "samarthputhraya/kavach")
    }
    println(if (failures == 0) "\nALL PASSED" else "\n$failures FAILED")
}
