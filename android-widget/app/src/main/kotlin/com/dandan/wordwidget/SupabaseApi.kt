package com.dandan.wordwidget

import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Minimal Supabase REST API helper.
 * Uses HttpURLConnection directly — no external dependencies needed.
 */
object SupabaseApi {
    private const val SUPABASE_URL = "https://hxhyaumawnmsbqwediqe.supabase.co"
    private const val ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4aHlhdW1hd25tc2Jxd2VkaXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDI2ODAsImV4cCI6MjA5MDgxODY4MH0.NEXiKaMfI_PS6LxyiYHSzHOqsOBHTuHICLDErVNJckY"

    private val mainHandler = Handler(Looper.getMainLooper())

    fun insertWord(
        word: String,
        ageMonths: Int?,
        notes: String?,
        cdiCategory: String?,
        subCategory: String?,
        callback: (success: Boolean, error: String?) -> Unit
    ) {
        Thread {
            try {
                val url = URL("$SUPABASE_URL/rest/v1/words")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("apikey", ANON_KEY)
                conn.setRequestProperty("Authorization", "Bearer $ANON_KEY")
                conn.setRequestProperty("Prefer", "return=minimal")
                conn.connectTimeout = 10000
                conn.readTimeout = 10000
                conn.doOutput = true

                val json = JSONObject().apply {
                    put("word", word)
                    if (ageMonths != null) put("age_months", ageMonths)
                    if (!notes.isNullOrBlank()) put("notes", notes)
                    if (!cdiCategory.isNullOrBlank()) put("cdi_category", cdiCategory)
                    if (!subCategory.isNullOrBlank()) put("sub_category", subCategory)
                }

                conn.outputStream.use { os ->
                    os.write(json.toString().toByteArray(Charsets.UTF_8))
                }

                val code = conn.responseCode
                if (code in 200..299) {
                    mainHandler.post { callback(true, null) }
                } else {
                    val errorBody = try {
                        BufferedReader(InputStreamReader(conn.errorStream)).readText()
                    } catch (e: Exception) { "HTTP $code" }
                    mainHandler.post { callback(false, errorBody) }
                }
                conn.disconnect()
            } catch (e: Exception) {
                mainHandler.post { callback(false, e.message) }
            }
        }.start()
    }

    fun getWordCount(callback: (count: Int?) -> Unit) {
        Thread {
            try {
                val url = URL("$SUPABASE_URL/rest/v1/words?select=id&linked_to=is.null")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("apikey", ANON_KEY)
                conn.setRequestProperty("Authorization", "Bearer $ANON_KEY")
                conn.setRequestProperty("Prefer", "count=exact")
                conn.connectTimeout = 5000
                conn.readTimeout = 5000

                val code = conn.responseCode
                if (code == 200) {
                    val range = conn.getHeaderField("Content-Range")
                    val count = range?.substringAfterLast("/")?.toIntOrNull()
                    mainHandler.post { callback(count) }
                } else {
                    mainHandler.post { callback(null) }
                }
                conn.disconnect()
            } catch (e: Exception) {
                mainHandler.post { callback(null) }
            }
        }.start()
    }
}
