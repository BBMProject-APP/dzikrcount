package com.dzikr.bbm.presentation.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.annotation.VisibleForTesting
import androidx.core.app.NotificationCompat
import androidx.media3.common.AudioAttributes as Media3AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackParameters
import androidx.media3.exoplayer.ExoPlayer
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

/**
 * Android Jetpack Media3 Foreground Service for background audio looping.
 * Implements gapless playback of sacred Dhikr/Salawat loops, handles audio focus,
 * manages notification state, and provides emergency immediate suspension.
 */

class DhikrPlaybackService : LifecycleService(), Player.Listener {
    private var toneGenerator: android.media.ToneGenerator? = null
    private var exoPlayer: ExoPlayer? = null

    companion object {
        const val CHANNEL_ID = "dhikr_service_channel"
        const val NOTIFICATION_ID = 1001
        
        // Actions
        const val ACTION_START = "ACTION_START"
        const val ACTION_PAUSE = "ACTION_PAUSE"
        const val ACTION_STOP = "ACTION_STOP" // Emergency stop
        const val ACTION_SET_DHIKR = "ACTION_SET_DHIKR"
        const val ACTION_SET_SPEED = "ACTION_SET_SPEED"
        const val ACTION_TOGGLE_MUTE = "ACTION_TOGGLE_MUTE"

        // State flows accessible to UI / ViewModels
        private val _currentCount = MutableStateFlow(0)
        val currentCount = _currentCount.asStateFlow()

        private val _isMuted = MutableStateFlow(false)
        val isMuted = _isMuted.asStateFlow()
        private val _playbackSpeed = MutableStateFlow(1.0f)
        val playbackSpeed = _playbackSpeed.asStateFlow()

        private val _isPlaying = MutableStateFlow(false)
        val isPlaying = _isPlaying.asStateFlow()

        private val _targetCount = MutableStateFlow(100)
        val targetCount = _targetCount.asStateFlow()
        
        private val _activeDhikrId = MutableStateFlow("")
        val activeDhikrId = _activeDhikrId.asStateFlow()

        @VisibleForTesting
        fun resetStateForTesting() {
            _currentCount.value = 0
            _playbackSpeed.value = 1.0f
            _isPlaying.value = false
            _targetCount.value = 100
            _activeDhikrId.value = ""
        }
    }

    override fun onCreate() {
        super.onCreate()
        initializeExoPlayer()
        createNotificationChannel()
        toneGenerator = android.media.ToneGenerator(android.media.AudioManager.STREAM_MUSIC, 60) // Volume 60%
    }

    private fun initializeExoPlayer() {
        // Build ExoPlayer with low-latency audio configuration and attributes for speech/dhikr
        exoPlayer = ExoPlayer.Builder(this)
            .setAudioAttributes(
                Media3AudioAttributes.Builder()
                    .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_SPEECH)
                    .setUsage(androidx.media3.common.C.USAGE_MEDIA)
                    .build(),
                true // Handles audio focus automatically
            )
            .build().apply {
                repeatMode = Player.REPEAT_MODE_ONE // Crucial for Gapless Looping on a single track
                addListener(this@DhikrPlaybackService)
            }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        
        when (intent?.action) {
            ACTION_START -> handlePlay()
            ACTION_PAUSE -> handlePause()
            ACTION_STOP -> handleEmergencyStop()
            ACTION_SET_SPEED -> {
                val speed = intent.getFloatExtra("speed", 1.0f)
                handleSetSpeed(speed)
            }
            ACTION_TOGGLE_MUTE -> {
                val mute = intent.getBooleanExtra("is_muted", false)
                handleToggleMute(mute)
            }
            ACTION_SET_DHIKR -> {
                val dhikrId = intent.getStringExtra("dhikr_id") ?: ""
                val target = intent.getIntExtra("target_count", 100)
                val audioUri = intent.getStringExtra("audio_uri") ?: ""
                setupDhikr(dhikrId, target, audioUri)
            }
        }
        
        return START_STICKY
    }

    private fun handleSetSpeed(speed: Float) {
        _playbackSpeed.value = speed
        exoPlayer?.let { player ->
            // PlaybackParameters(speed, pitch): sets speed and keeps pitch constant (1.0f) for time-stretching without warp distortion
            player.playbackParameters = PlaybackParameters(speed, 1.0f)
        }
    }
    private fun handleToggleMute(mute: Boolean) {
        _isMuted.value = mute
        exoPlayer?.let { player ->
            // Jika diklik mute, set volume player ke 0.0f (senyap). Jika tidak, kembalikan ke 1.0f (penuh)
            player.volume = if (mute) 0.0f else 1.0f
        }
    }
    private fun setupDhikr(dhikrId: String, target: Int, audioUri: String) {
        _activeDhikrId.value = dhikrId
        _targetCount.value = target
        _currentCount.value = 0
        
        exoPlayer?.let { player ->
            player.stop()
            player.clearMediaItems()
            // In a real application, you pass a local raw file or cached asset URI
            val mediaItem = MediaItem.fromUri(audioUri)
            player.setMediaItem(mediaItem)
            player.prepare()
        }
        
        updateNotification("Dhikr Prepared", false)
    }

    private fun handlePlay() {
        exoPlayer?.let { player ->
            // PENGAMAN: Jika player dalam kondisi IDLE atau putaran selesai, paksa prepare ulang
            if (player.playbackState == Player.STATE_IDLE) {
                player.prepare()
            }
            // Jika counter sudah mentok target tapi ditekan start lagi, reset ke 0 demi UX yang mulus
            if (_currentCount.value >= _targetCount.value) {
                _currentCount.value = 0
            }
            player.play()
            _isPlaying.value = true
            updateNotification("Reciting Dhikr...", true)
            startForeground(NOTIFICATION_ID, buildNotification("Reciting Dhikr...", true))
        }
    }

    // Player.Listener callback triggered when media transitions, loops, or finishes
    override fun onPositionDiscontinuity(
        oldPosition: Player.PositionInfo,
        newPosition: Player.PositionInfo,
        reason: Int
    ) {
        super.onPositionDiscontinuity(oldPosition, newPosition, reason)

        if (reason == Player.DISCONTINUITY_REASON_AUTO_TRANSITION || reason == Player.DISCONTINUITY_REASON_SEEK) {
            if (exoPlayer?.isPlaying == true) {
                lifecycleScope.launch {
                    val nextCount = _currentCount.value + 1
                    val target = _targetCount.value

                    // PENGAMAN SUARA TIK & BIP ABA-ABA FINISH
                    when {
                        // Jika sudah mencapai target, tidak membunyikan tik biasa (nanti dihandle handleCompletion)
                        nextCount >= target -> {
                            _currentCount.value = target
                            handleCompletion()
                        }
                        // Jika sisa 3, 2, atau 1 hitungan lagi menuju target (Aba-aba Bip Bip Bip!)
                        nextCount >= (target - 3) -> {
                            // TONE_CDMA_PIP memberikan bunyi "Bip" peringatan yang lebih tajam & tegas di headset
                            toneGenerator?.startTone(android.media.ToneGenerator.TONE_CDMA_PIP, 100)
                            _currentCount.value = nextCount
                            updateNotification("Reciting Dhikr (${nextCount}/${target})", true)
                        }
                        // Hitungan biasa: Bunyi "Tik" metronome standar
                        else -> {
                            toneGenerator?.startTone(android.media.ToneGenerator.TONE_PROP_BEEP, 50)
                            _currentCount.value = nextCount
                            updateNotification("Reciting Dhikr (${nextCount}/${target})", true)
                        }
                    }
                }
            }
        }
    }

    private fun handlePause() {
        exoPlayer?.pause()
        _isPlaying.value = false
        updateNotification("Paused", false)
        stopForeground(STOP_FOREGROUND_DETACH)
    }

    /**
     * Emergency Pause / Stop: Guarantees absolute silent execution immediately,
     * releasing audio hardware resources and cancelling foreground status.
     */
    private fun handleEmergencyStop() {
        exoPlayer?.stop()
        _isPlaying.value = false
        _currentCount.value = 0
        updateNotification("Emergency Muted", false)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun handleCompletion() {
        exoPlayer?.pause()
        _isPlaying.value = false

        // Perbaikan abandonAudioFocus: Panggil via audioManager sistem jika ada, atau komentari dulu jika fungsi internal Anda berbeda
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager
        // audioManager?.abandonAudioFocus(null) // Baris opsional standar Android lama, aman jika dilewati sementara

        updateNotification("Completed Dhikr Target!", false)
        stopForeground(STOP_FOREGROUND_DETACH)

        // EFEK SUARA FINISH "CLING/CORRECT" DI HEADSET
        lifecycleScope.launch {
            // Kombinasi 2 nada cepat (Rendah lalu Tinggi) untuk efek suara "Cling"
            toneGenerator?.startTone(android.media.ToneGenerator.TONE_PROP_BEEP2, 150)
            delay(180) // Sekarang dijamin hijau setelah di-import
            toneGenerator?.startTone(android.media.ToneGenerator.TONE_PROP_ACK, 250)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Dhikr Looping Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Handles background playback and gapless looping counter for Salawat/Dhikr."
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(contentText: String, isPlaying: Boolean): Notification {
        val intent = Intent(this, Class.forName("com.dzikr.bbm.presentation.ui.MainActivity"))

        // Amankan flag berdasarkan versi Android agar support Samsul Note 8
        val flagMutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val flags = flagMutable or PendingIntent.FLAG_UPDATE_CURRENT

        val pendingIntent = PendingIntent.getActivity(this, 0, intent, flags)

        val pauseIntent = Intent(this, DhikrPlaybackService::class.java).apply { action = ACTION_PAUSE }
        val pPauseIntent = PendingIntent.getService(this, 1, pauseIntent, flags)

        val playIntent = Intent(this, DhikrPlaybackService::class.java).apply { action = ACTION_START }
        val pPlayIntent = PendingIntent.getService(this, 2, playIntent, flags)

        val stopIntent = Intent(this, DhikrPlaybackService::class.java).apply { action = ACTION_STOP }
        val pStopIntent = PendingIntent.getService(this, 3, stopIntent, flags)

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Dzikr & Salawat Count")
            .setContentText(contentText)
            .setOngoing(isPlaying)
            .setSilent(true)
            .setContentIntent(pendingIntent)
            .setStyle(androidx.media.app.NotificationCompat.MediaStyle())

        if (isPlaying) {
            builder.addAction(android.R.drawable.ic_media_pause, "Pause", pPauseIntent)
        } else {
            builder.addAction(android.R.drawable.ic_media_play, "Play", pPlayIntent)
        }

        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "EMERGENCY MUTE", pStopIntent)

        return builder.build()
    }

    private fun updateNotification(text: String, isPlaying: Boolean) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(text, isPlaying))
    }

    override fun onDestroy() {
        exoPlayer?.release()
        exoPlayer = null
        toneGenerator?.release() // Lepas generator suara biar tidak bocor memori
        toneGenerator = null
        super.onDestroy()
    }
}
