package com.dzikr.bbm.presentation.receiver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.dzikr.bbm.presentation.ui.MainActivity

/**
 * BroadcastReceiver triggered by AlarmManager to post gentle notifications for Dhikr sessions.
 * Helps users maintain spiritual consistency and keep up with their daily streaks.
 */
class DhikrReminderReceiver : BroadcastReceiver() {
    companion object {
        const val CHANNEL_ID = "dhikr_reminders_channel"
        const val NOTIFICATION_ID_BASE = 2000
    }

    override fun onReceive(context: Context, intent: Intent) {
        val dhikrId = intent.getStringExtra("dhikr_id") ?: "general"
        val dhikrName = intent.getStringExtra("dhikr_name") ?: "Dhikr & Salawat"
        
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Dhikr Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Daily spiritual consistency alerts and reminders"
            }
            notificationManager.createNotificationChannel(channel)
        }
        
        // This will fail until MainActivity is created, but that's okay for now.
        val mainIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("dhikr_id", dhikrId)
        }
        
        val pendingIntent = android.app.PendingIntent.getActivity(
            context,
            dhikrId.hashCode(),
            mainIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Spiritual Consistency Reminder")
            .setContentText("It's time for your daily session: $dhikrName. Keep your spiritual consistency alive!")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
            
        notificationManager.notify(NOTIFICATION_ID_BASE + dhikrId.hashCode(), notification)
    }
}
