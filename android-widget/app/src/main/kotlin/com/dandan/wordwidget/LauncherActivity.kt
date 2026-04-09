package com.dandan.wordwidget

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast

/**
 * Minimal launcher activity that redirects to the PWA.
 * This exists because Android requires a launcher activity,
 * but the main app experience is the PWA in the browser.
 */
class LauncherActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Toast.makeText(this, getString(R.string.launcher_message), Toast.LENGTH_LONG).show()
        // Open the PWA in the browser
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://tm9hbqn.github.io/Wordbydandan/"))
        startActivity(intent)
        finish()
    }
}
