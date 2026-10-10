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
