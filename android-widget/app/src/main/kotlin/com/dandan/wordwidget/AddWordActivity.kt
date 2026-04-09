package com.dandan.wordwidget

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.util.Calendar

class AddWordActivity : Activity() {

    private lateinit var wordInput: EditText
    private lateinit var notesInput: EditText
    private lateinit var submitBtn: TextView
    private lateinit var ageContainer: LinearLayout
    private lateinit var categoryContainer: LinearLayout

    private var selectedAgeMonths: Int? = null
    private var selectedCategory: String? = null
    private var selectedSubCategory: String? = null
    private var submitting = false

    // Baby birthday: December 5, 2024
    private val babyBirthYear = 2024
    private val babyBirthMonth = 11 // 0-indexed: December
    private val babyBirthDay = 5

    // CDI categories matching the web app
    private data class Category(
        val key: String,
        val label: String,
        val color: Int,
        val subCategories: List<Pair<String, String>> = emptyList()
    )

    private val categories = listOf(
        Category("general_nominals", "שמות עצם כלליים", Color.parseColor("#6C5CE7"), listOf(
            "animals" to "חיות", "food_drink" to "אוכל ושתייה", "body_parts" to "גוף",
            "clothing" to "ביגוד", "household" to "בית", "toys_and_routines" to "צעצועים",
            "outside" to "חוץ"
        )),
        Category("specific_nominals", "שמות פרטיים", Color.parseColor("#FF6B9D"), listOf(
            "people" to "אנשים"
        )),
        Category("action_words", "מילות פעולה", Color.parseColor("#4DD0E1"), listOf(
            "actions" to "פעולות"
        )),
        Category("modifiers", "מתארים", Color.parseColor("#FFD93D"), listOf(
            "attributes" to "תכונות"
        )),
        Category("personal_social", "אינטראקציה וחברה", Color.parseColor("#CE93D8"), listOf(
            "routines_and_games" to "שגרה ומשחקים", "sound_effects" to "צלילים",
            "assertions" to "קביעות"
        )),
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_add_word)

        wordInput = findViewById(R.id.word_input)
        notesInput = findViewById(R.id.notes_input)
        submitBtn = findViewById(R.id.submit_btn)
        ageContainer = findViewById(R.id.age_buttons)
        categoryContainer = findViewById(R.id.category_buttons)

        // Tap outside to close
        findViewById<View>(R.id.overlay_bg).setOnClickListener { finish() }
        findViewById<TextView>(R.id.cancel_btn).setOnClickListener { finish() }

        buildAgeButtons()
        buildCategoryButtons()

        submitBtn.setOnClickListener { submitWord() }

        // Auto-focus word input
        wordInput.requestFocus()
        wordInput.postDelayed({
            val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(wordInput, InputMethodManager.SHOW_IMPLICIT)
        }, 200)
    }

    private fun calculateCurrentAgeMonths(): Int {
        val now = Calendar.getInstance()
        var months = (now.get(Calendar.YEAR) - babyBirthYear) * 12
        months += now.get(Calendar.MONTH) - babyBirthMonth
        if (now.get(Calendar.DAY_OF_MONTH) < babyBirthDay) months--
        return maxOf(0, months)
    }

    private fun ageMonthsToHebrew(months: Int): String {
        if (months == 0) return "לידה"
        val names = arrayOf(
            "", "חודש", "חודשיים", "3 חודשים", "4 חודשים", "5 חודשים",
            "6 חודשים", "7 חודשים", "8 חודשים", "9 חודשים", "10 חודשים",
            "11 חודשים"
        )
        if (months < 12) return names.getOrElse(months) { "$months חודשים" }
        val years = months / 12
        val rem = months % 12
        var text = when (years) {
            1 -> "שנה"
            2 -> "שנתיים"
            else -> "$years שנים"
        }
        if (rem > 0) {
            text += " ו" + names.getOrElse(rem) { "$rem ח׳" }
        }
        return text
    }

    private fun buildAgeButtons() {
        val currentAge = calculateCurrentAgeMonths()
        val start = maxOf(0, currentAge - 5)

        for (m in currentAge downTo start) {
            val btn = TextView(this).apply {
                text = if (m == currentAge) getString(R.string.dialog_now) else ageMonthsToHebrew(m)
                tag = m
                textSize = 14f
                setTextColor(Color.parseColor("#2D1B69"))
                setBackgroundResource(R.drawable.age_btn_bg)
                gravity = Gravity.CENTER
                setPadding(dp(14), dp(8), dp(14), dp(8))
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { marginEnd = dp(6) }
                layoutParams = params

                setOnClickListener { selectAge(m) }
            }
            ageContainer.addView(btn)

            // Pre-select current age
            if (m == currentAge) {
                selectAge(m)
                btn.isSelected = true
                btn.setTextColor(Color.WHITE)
            }
        }
    }

    private fun selectAge(months: Int) {
        selectedAgeMonths = months
        for (i in 0 until ageContainer.childCount) {
            val btn = ageContainer.getChildAt(i) as TextView
            val isSelected = btn.tag == months
            btn.isSelected = isSelected
            btn.setTextColor(if (isSelected) Color.WHITE else Color.parseColor("#2D1B69"))
        }
    }

    private fun buildCategoryButtons() {
        for (cat in categories) {
            val btn = TextView(this).apply {
                text = cat.label
                textSize = 12f
                setTextColor(Color.parseColor("#2D1B69"))
                setBackgroundResource(R.drawable.category_btn_bg)
                gravity = Gravity.CENTER
                setPadding(dp(12), dp(6), dp(12), dp(6))
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { marginEnd = dp(6); bottomMargin = dp(4) }
                layoutParams = params
                tag = cat.key

                setOnClickListener { selectCategory(cat) }
            }
            categoryContainer.addView(btn)
        }
    }

    private fun selectCategory(cat: Category) {
        if (selectedCategory == cat.key) {
            // Deselect
            selectedCategory = null
            selectedSubCategory = null
        } else {
            selectedCategory = cat.key
            selectedSubCategory = cat.subCategories.firstOrNull()?.first
        }

        // Update visual state
        for (i in 0 until categoryContainer.childCount) {
            val btn = categoryContainer.getChildAt(i) as TextView
            val isSelected = btn.tag == selectedCategory
            btn.isSelected = isSelected
            btn.setTypeface(null, if (isSelected) Typeface.BOLD else Typeface.NORMAL)
        }
    }

    private fun submitWord() {
        val word = wordInput.text.toString().trim()
        if (word.isEmpty()) {
            Toast.makeText(this, getString(R.string.error_empty), Toast.LENGTH_SHORT).show()
            return
        }
        if (submitting) return
        submitting = true

        // Hide keyboard
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(wordInput.windowToken, 0)

        submitBtn.text = "שומר..."
        submitBtn.alpha = 0.5f

        val notes = notesInput.text.toString().trim().ifEmpty { null }

        SupabaseApi.insertWord(
            word = word,
            ageMonths = selectedAgeMonths,
            notes = notes,
            cdiCategory = selectedCategory,
            subCategory = selectedSubCategory,
        ) { success, error ->
            if (success) {
                Toast.makeText(this, "\"$word\" ${getString(R.string.success_message)}", Toast.LENGTH_SHORT).show()
                // Refresh widget word count
                WordWidgetProvider.refreshAllWidgets(this)
                finish()
            } else {
                submitting = false
                submitBtn.text = getString(R.string.dialog_submit)
                submitBtn.alpha = 1f
                Toast.makeText(this, getString(R.string.error_message), Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }
}
