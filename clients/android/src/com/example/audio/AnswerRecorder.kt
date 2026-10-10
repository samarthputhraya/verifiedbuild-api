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
