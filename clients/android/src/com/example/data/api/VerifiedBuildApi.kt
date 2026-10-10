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
