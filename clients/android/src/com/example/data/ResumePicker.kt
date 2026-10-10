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
