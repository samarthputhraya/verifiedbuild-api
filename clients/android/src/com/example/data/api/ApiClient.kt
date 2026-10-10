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

    // The recruiter web dashboard. Leave empty until SAM sends the link; empty hides the link in the app.
    const val RECRUITER_WEB_URL = ""
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
