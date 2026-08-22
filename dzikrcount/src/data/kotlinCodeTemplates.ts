export interface CodeFile {
  name: string;
  path: string;
  language: string;
  content: string;
}

export const KOTLIN_TEMPLATES: CodeFile[] = [
  {
    name: "DhikrPlaybackService.kt",
    path: "presentation/service/DhikrPlaybackService.kt",
    language: "kotlin",
    content: `package dhikrsalawat.presentation.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.media3.common.AudioAttributes as Media3AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackParameters
import androidx.media3.exoplayer.ExoPlayer
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import dhikrsalawat.R
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Android Jetpack Media3 Foreground Service for background audio looping.
 * Implements gapless playback of sacred Dhikr/Salawat loops, handles audio focus,
 * manages notification state, and provides emergency immediate suspension.
 */
class DhikrPlaybackService : LifecycleService(), Player.Listener {

    private var exoPlayer: ExoPlayer? = null
    private var audioManager: AudioManager? = null
    private var focusRequest: AudioFocusRequest? = null

    companion object {
        const val CHANNEL_ID = "dhikr_service_channel"
        const val NOTIFICATION_ID = 1001
        
        // Actions
        const val ACTION_START = "ACTION_START"
        const val ACTION_PAUSE = "ACTION_PAUSE"
        const val ACTION_STOP = "ACTION_STOP" // Emergency stop
        const val ACTION_SET_DHIKR = "ACTION_SET_DHIKR"
        const val ACTION_SET_SPEED = "ACTION_SET_SPEED"

        // State flows accessible to UI / ViewModels
        private val _currentCount = MutableStateFlow(0)
        val currentCount = _currentCount.asStateFlow()

        private val _playbackSpeed = MutableStateFlow(1.0f)
        val playbackSpeed = _playbackSpeed.asStateFlow()

        private val _isPlaying = MutableStateFlow(false)
        val isPlaying = _isPlaying.asStateFlow()

        private val _targetCount = MutableStateFlow(100)
        val targetCount = _targetCount.asStateFlow()
        
        private val _activeDhikrId = MutableStateFlow("")
        val activeDhikrId = _activeDhikrId.asStateFlow()
    }

    override fun onCreate() {
        super.onCreate()
        setupAudioManager()
        initializeExoPlayer()
        createNotificationChannel()
    }

    private fun setupAudioManager() {
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
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
        if (requestAudioFocus()) {
            exoPlayer?.play()
            _isPlaying.value = true
            updateNotification("Reciting Dhikr...", true)
            startForeground(NOTIFICATION_ID, buildNotification("Reciting Dhikr...", true))
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
        abandonAudioFocus()
        _isPlaying.value = false
        _currentCount.value = 0
        updateNotification("Emergency Muted", false)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // Player.Listener callback triggered when media transitions, loops, or finishes
    override fun onPositionDiscontinuity(
        oldPosition: Player.PositionInfo,
        newPosition: Player.PositionInfo,
        reason: Int
    ) {
        super.onPositionDiscontinuity(oldPosition, newPosition, reason)
        
        // REASON_AUTO_TRANSITION indicates a loop point has been reached (REPEAT_MODE_ONE)
        if (reason == Player.DISCONTINUITY_REASON_AUTO_TRANSITION) {
            lifecycleScope.launch {
                val nextCount = _currentCount.value + 1
                if (nextCount >= _targetCount.value) {
                    _currentCount.value = _targetCount.value
                    handleCompletion()
                } else {
                    _currentCount.value = nextCount
                    updateNotification("Reciting Dhikr (\${nextCount}/\${_targetCount.value})", true)
                }
            }
        }
    }

    private fun handleCompletion() {
        exoPlayer?.pause()
        _isPlaying.value = false
        abandonAudioFocus()
        updateNotification("Completed Dhikr Target!", false)
        stopForeground(STOP_FOREGROUND_DETACH)
    }

    private fun requestAudioFocus(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val playbackAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
                
            focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(playbackAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener { focusChange ->
                    when (focusChange) {
                        AudioManager.AUDIOFOCUS_LOSS -> handleEmergencyStop()
                        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> handlePause()
                        AudioManager.AUDIOFOCUS_GAIN -> handlePlay()
                    }
                }
                .build()
            
            return audioManager?.requestAudioFocus(focusRequest!!) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        } else {
            @Suppress("DEPRECATION")
            val result = audioManager?.requestAudioFocus(
                { focusChange ->
                    if (focusChange == AudioManager.AUDIOFOCUS_LOSS) handleEmergencyStop()
                },
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            )
            return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        }
    }

    private fun abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
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

    private fun buildNotification(contentText: String, isPlaying: Boolean): android.app.Notification {
        val intent = Intent(this, Class.forName("dhikrsalawat.presentation.ui.MainActivity"))
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Actions for Play, Pause, Emergency Stop
        val pauseIntent = Intent(this, DhikrPlaybackService::class.java).apply { action = ACTION_PAUSE }
        val pPauseIntent = PendingIntent.getService(this, 1, pauseIntent, PendingIntent.FLAG_IMMUTABLE)

        val playIntent = Intent(this, DhikrPlaybackService::class.java).apply { action = ACTION_START }
        val pPlayIntent = PendingIntent.getService(this, 2, playIntent, PendingIntent.FLAG_IMMUTABLE)

        val stopIntent = Intent(this, DhikrPlaybackService::class.java).apply { action = ACTION_STOP }
        val pStopIntent = PendingIntent.getService(this, 3, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_dhikr_notification)
            .setContentTitle("Dzikr & Salawat Count")
            .setContentText(contentText)
            .setOngoing(isPlaying)
            .setSilent(true)
            .setContentIntent(pendingIntent)
            .setStyle(androidx.media.app.NotificationCompat.MediaStyle())

        if (isPlaying) {
            builder.addAction(R.drawable.ic_pause, "Pause", pPauseIntent)
        } else {
            builder.addAction(R.drawable.ic_play, "Play", pPlayIntent)
        }
        
        // ALWAYS provide emergency stopping right in the notification panel
        builder.addAction(R.drawable.ic_emergency_stop, "EMERGENCY MUTE", pStopIntent)

        return builder.build()
    }

    private fun updateNotification(text: String, isPlaying: Boolean) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(text, isPlaying))
    }

    override fun onDestroy() {
        exoPlayer?.release()
        exoPlayer = null
        super.onDestroy()
    }
}`
  },
  {
    name: "DhikrPlayerScreen.kt",
    path: "presentation/ui/DhikrPlayerScreen.kt",
    language: "kotlin",
    content: `package dhikrsalawat.presentation.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dhikrsalawat.presentation.viewmodel.DhikrViewModel
import kotlinx.coroutines.launch

/**
 * Jetpack Compose UI representing the highly-polished Dhikr Player.
 * Includes a breathing circular tracker, ambient sound mixer overlays,
 * emergency immediate stop button, and accessibility hooks.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DhikrPlayerScreen(
    viewModel: DhikrViewModel,
    modifier: Modifier = Modifier
) {
    val currentCount by viewModel.currentCount.collectAsState()
    val targetCount by viewModel.targetCount.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val activeDhikr by viewModel.activeDhikr.collectAsState()

    // Breathing pulse animation for progress ring and background depth
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = if (isPlaying) 1.06f else 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 3000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Dzikr & Salawat Count", fontWeight = FontWeight.SemiBold, color = Color(0xFFE2E8F0)) },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF0F172A)
                )
            )
        },
        containerColor = Color(0xFF0F172A), // Dark slate/emerald theme
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            
            // 1. Text Synchronization Display Panel
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Sacred Arabic Typography with Custom Amiri or Lateef pairing
                Text(
                    text = activeDhikr.arabic,
                    fontSize = 32.sp,
                    textAlign = TextAlign.Center,
                    color = Color(0xFF34D399), // Mint green
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
                
                Spacer(modifier = Modifier.height(12.dp))
                
                Text(
                    text = activeDhikr.transliteration,
                    fontSize = 16.sp,
                    textAlign = TextAlign.Center,
                    color = Color(0xFF94A3B8), // Muted grey
                    modifier = Modifier.padding(horizontal = 24.dp)
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = activeDhikr.translation,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    color = Color(0xFF64748B),
                    modifier = Modifier.padding(horizontal = 32.dp)
                )
            }

            // 2. Breathing Circular Progress Tracker
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(260.dp)
                    .padding(16.dp)
            ) {
                val progress = currentCount.toFloat() / targetCount.toFloat().coerceAtLeast(1f)

                // Outer ambient glow ring responsive to play pulse
                Canvas(modifier = Modifier.fillMaxSize()) {
                    drawCircle(
                        brush = Brush.radialGradient(
                            colors = listOf(Color(0x1A10B981), Color(0x0010B981)),
                            center = center,
                            radius = size.minDimension / 2 * pulseScale
                        )
                    )
                }

                // Smoothly animated progress stroke
                val animatedProgress by animateFloatAsState(
                    targetValue = progress,
                    animationSpec = tween(durationMillis = 600, easing = EaseOutQuad),
                    label = "progress"
                )

                Canvas(modifier = Modifier.size(200.dp)) {
                    // Base background ring
                    drawCircle(
                        color = Color(0xFF1E293B),
                        style = Stroke(width = 10.dp.toPx(), cap = StrokeCap.Round)
                    )
                    // Filled active ring
                    drawArc(
                        color = Color(0xFF10B981), // Emerald
                        startAngle = -90f,
                        sweepAngle = animatedProgress * 360f,
                        useCenter = false,
                        style = Stroke(width = 12.dp.toPx(), cap = StrokeCap.Round)
                    )
                }

                // Center Counter Data Display
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$currentCount",
                        fontSize = 44.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = "of $targetCount",
                        fontSize = 14.sp,
                        color = Color(0xFF64748B)
                    )
                    Text(
                        text = if (isPlaying) "RECITING" else "PAUSED",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = if (isPlaying) Color(0xFF34D399) else Color(0xFF64748B),
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }

            // 3. Elegant Ambient Layer Volume Control Panel
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Ambient Soundscapes Mixer",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF94A3B8),
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    
                    // Rain Volume Control
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 4.dp)
                    ) {
                        Text("Rain Loop", fontSize = 12.sp, color = Color.White, modifier = Modifier.width(80.dp))
                        Slider(
                            value = viewModel.rainVolume.collectAsState().value,
                            onValueChange = { viewModel.setRainVolume(it) },
                            colors = SliderDefaults.colors(
                                thumbColor = Color(0xFF10B981),
                                activeTrackColor = Color(0xFF10B981)
                            ),
                            modifier = Modifier.weight(1f)
                        )
                    }

                    // Water Stream Volume Control
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 4.dp)
                    ) {
                        Text("Stream Water", fontSize = 12.sp, color = Color.White, modifier = Modifier.width(80.dp))
                        Slider(
                            value = viewModel.streamVolume.collectAsState().value,
                            onValueChange = { viewModel.setStreamVolume(it) },
                            colors = SliderDefaults.colors(
                                thumbColor = Color(0xFF10B981),
                                activeTrackColor = Color(0xFF10B981)
                            ),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // Playback Speed Controller Panel (Preserves Pitch with PlaybackParameters)
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Playback Speed (Pitch Preserved)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF94A3B8)
                        )
                        Text(
                            text = "\${viewModel.playbackSpeed.collectAsState().value}x",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF10B981)
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(0.5f, 1.0f, 1.25f, 1.5f, 2.0f).forEach { speed ->
                            val isSelected = viewModel.playbackSpeed.collectAsState().value == speed
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(36.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSelected) Color(0xFF10B981) else Color(0xFF334155))
                                    .clickable { viewModel.setPlaybackSpeed(speed) }
                            ) {
                                Text(
                                    text = "\${speed}x",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) Color(0xFF0F172A) else Color.White
                                )
                            }
                        }
                    }
                }
            }

            // 4. Critical Navigation & Emergency Controls Panel
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Secondary Play/Pause Button
                Button(
                    onClick = { if (isPlaying) viewModel.pause() else viewModel.start() },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isPlaying) Color(0xFF334155) else Color(0xFF10B981)
                    ),
                    modifier = Modifier
                        .height(52.dp)
                        .weight(1f)
                        .padding(end = 8.dp)
                ) {
                    Text(if (isPlaying) "Pause" else "Start recitation", fontWeight = FontWeight.SemiBold)
                }

                // CRITICAL MANDATE: IMMEDIATE EMERGENCY MUTING / STOP
                Button(
                    onClick = { viewModel.emergencyMute() },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFFEF4444) // Striking, prominent red
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .height(52.dp)
                        .weight(1f)
                        .padding(start = 8.dp)
                ) {
                    Text(
                        text = "EMERGENCY MUTE",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}`
  },
  {
    name: "DhikrViewModel.kt",
    path: "presentation/viewmodel/DhikrViewModel.kt",
    language: "kotlin",
    content: `package dhikrsalawat.presentation.viewmodel

import android.app.Application
import android.content.Intent
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import dhikrsalawat.domain.model.DhikrItem
import dhikrsalawat.presentation.service.DhikrPlaybackService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * ViewModel acting as state mediator between Compose presentation layout and Jetpack Media3 Service.
 */
class DhikrViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val context = application.applicationContext

    // Collect variables directly from service flows to synchronize service state instantly to UI
    val currentCount: StateFlow<Int> = DhikrPlaybackService.currentCount
    val isPlaying: StateFlow<Boolean> = DhikrPlaybackService.isPlaying
    val targetCount: StateFlow<Int> = DhikrPlaybackService.targetCount
    val activeDhikrId: StateFlow<String> = DhikrPlaybackService.activeDhikrId
    val playbackSpeed: StateFlow<Float> = DhikrPlaybackService.playbackSpeed

    // Static selection state
    private val _activeDhikr = MutableStateFlow(
        DhikrItem(
            id = "sholawat_jibril",
            name = "Sholawat Jibril",
            arabic = "صَلَّى اللهُ عَلَى مُحَمَّد",
            transliteration = "Shallallahu 'Ala Muhammad",
            translation = "May Allah bless Muhammad with His grace."
        )
    )
    val activeDhikr: StateFlow<DhikrItem> = _activeDhikr

    // Volume states for synthetic/local ambient mixers
    private val _rainVolume = MutableStateFlow(0.2f)
    val rainVolume = _rainVolume.asStateFlow()

    private val _streamVolume = MutableStateFlow(0.0f)
    val streamVolume = _streamVolume.asStateFlow()

    fun selectDhikr(dhikr: DhikrItem, target: Int) {
        _activeDhikr.value = dhikr
        val intent = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_SET_DHIKR
            putExtra("dhikr_id", dhikr.id)
            putExtra("target_count", target)
            // Example asset reference or online cache URI
            putExtra("audio_uri", "asset:///audio/" + dhikr.id + ".mp3")
        }
        context.startService(intent)
    }

    fun start() {
        val intent = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_START
        }
        context.startService(intent)
    }

    fun pause() {
        val intent = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_PAUSE
        }
        context.startService(intent)
    }

    /**
     * Immediately suspends and stops background audio. Survives system constraints.
     */
    fun emergencyMute() {
        val intent = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_STOP
        }
        context.startService(intent)
    }

    fun setRainVolume(volume: Float) {
        _rainVolume.value = volume
        // Real-world implementation: Update rain sound synthesis or ExoPlayer secondary track volume
    }

    fun setStreamVolume(volume: Float) {
        _streamVolume.value = volume
        // Real-world implementation: Update water stream stream generator or player track volume
    }

    fun setPlaybackSpeed(speed: Float) {
        val intent = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_SET_SPEED
            putExtra("speed", speed)
        }
        context.startService(intent)
    }
}`
  },
  {
    name: "PlayDhikrUseCase.kt",
    path: "domain/usecase/PlayDhikrUseCase.kt",
    language: "kotlin",
    content: `package dhikrsalawat.domain.usecase

import dhikrsalawat.domain.model.DhikrItem

/**
 * Domain-layer usecase to represent atomic playback controller for dhikr loops,
 * abstracting the player service trigger and ensuring separation of concerns.
 */
class PlayDhikrUseCase(
    private val repository: DhikrRepository
) {
    suspend fun execute(dhikr: DhikrItem, targetLoop: Int): Result<Unit> {
        return try {
            repository.prepareDhikrPlayback(dhikr, targetLoop)
            repository.startRecitation()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun stopImmediately(): Result<Unit> {
        return try {
            repository.emergencyStop()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}`
  },
  {
    name: "DhikrItem.kt",
    path: "domain/model/DhikrItem.kt",
    language: "kotlin",
    content: `package dhikrsalawat.domain.model

/**
 * Domain Model defining core entities of a Dhikr loop unit.
 */
data class DhikrItem(
    val id: String,
    val name: String,
    val arabic: String,
    val transliteration: String,
    val translation: String
)
`
  },
  {
    name: "AndroidManifest.xml",
    path: "AndroidManifest.xml",
    language: "xml",
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="dhikrsalawat">

    <!-- Essential Android Permissions for Background Services and Wake locks -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.DzikrSalawat">
        
        <activity
            android:name=".presentation.ui.MainActivity"
            android:exported="true"
            android:theme="@style/Theme.DzikrSalawat">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Media Playback Foreground Service declaration with its type -->
        <service
            android:name=".presentation.service.DhikrPlaybackService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />

        <!-- Reliable Background Alarm Receiver for Gentle Reminders -->
        <receiver
            android:name=".presentation.receiver.DhikrReminderReceiver"
            android:enabled="true"
            android:exported="false" />

    </application>
</manifest>`
  },
  {
    name: "build.gradle.kts",
    path: "build.gradle.kts",
    language: "kotlin",
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "dhikrsalawat"
    compileSdk = 34

    defaultConfig {
        applicationId = "dhikrsalawat"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
}

dependencies {
    // Jetpack Compose Essentials
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    
    // Media3 (ExoPlayer) - Crucial for precise audio looping and background services
    implementation("androidx.media3:media3-exoplayer:1.2.1")
    implementation("androidx.media3:media3-session:1.2.1")
    implementation("androidx.media3:media3-common:1.2.1")

    // Clean Architecture & DI
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-service:2.7.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
`
  },
  {
    name: "VoiceCommandRecognizer.kt",
    path: "presentation/voice/VoiceCommandRecognizer.kt",
    language: "kotlin",
    content: `package dhikrsalawat.presentation.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import dhikrsalawat.presentation.service.DhikrPlaybackService
import java.util.Locale

/**
 * Hands-free Voice Recitation Manager utilizing native Android SpeechRecognizer.
 * Listens for pause, resume, reset, or count update commands.
 */
class VoiceCommandRecognizer(private val context: Context) {

    private var speechRecognizer: SpeechRecognizer? = null
    private val recognizerIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }

    init {
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onError(error: Int) {
                        Log.e("VoiceCommandRecognizer", "Speech error: $error")
                        // Automatically restart listener for continuous hands-free monitoring
                        if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                            startListening()
                        }
                    }

                    override fun onResults(results: Bundle?) {
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        if (!matches.isNullOrEmpty()) {
                            val command = matches[0].lowercase(Locale.getDefault()).trim()
                            processCommand(command)
                        }
                        // Continue listening in background
                        startListening()
                    }

                    override fun onPartialResults(partialResults: Bundle?) {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
            }
        }
    }

    fun startListening() {
        speechRecognizer?.startListening(recognizerIntent)
    }

    fun stopListening() {
        speechRecognizer?.stopListening()
    }

    fun destroy() {
        speechRecognizer?.destroy()
        speechRecognizer = null
    }

    private fun processCommand(command: String) {
        val serviceIntent = Intent(context, DhikrPlaybackService::class.java)
        
        when {
            command.contains("pause") || command.contains("stop") -> {
                serviceIntent.action = DhikrPlaybackService.ACTION_PAUSE
                context.startService(serviceIntent)
            }
            command.contains("resume") || command.contains("play") -> {
                serviceIntent.action = DhikrPlaybackService.ACTION_START
                context.startService(serviceIntent)
            }
            command.contains("reset") || command.contains("clear") -> {
                // Set count to 0 command dispatch
                val intent = Intent(context, DhikrPlaybackService::class.java).apply {
                    action = DhikrPlaybackService.ACTION_SET_DHIKR
                    putExtra("dhikr_id", DhikrPlaybackService.activeDhikrId.value)
                    putExtra("target_count", DhikrPlaybackService.targetCount.value)
                }
                context.startService(intent)
            }
        }
    }
}
`
  },
  {
    name: "DhikrReminderReceiver.kt",
    path: "presentation/receiver/DhikrReminderReceiver.kt",
    language: "kotlin",
    content: `package dhikrsalawat.presentation.receiver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import dhikrsalawat.R
import dhikrsalawat.presentation.ui.MainActivity

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
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Spiritual Consistency Reminder")
            .setContentText("It's time for your daily session: $dhikrName. Keep your spiritual consistency alive!")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
            
        notificationManager.notify(NOTIFICATION_ID_BASE + dhikrId.hashCode(), notification)
    }
}
`
  },
  {
    name: "DhikrReminderScheduler.kt",
    path: "presentation/receiver/DhikrReminderScheduler.kt",
    language: "kotlin",
    content: `package dhikrsalawat.presentation.receiver

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/**
 * Scheduler helper that leverages Android's AlarmManager for reliable daily background reminders.
 */
class DhikrReminderScheduler(private val context: Context) {
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    fun scheduleDailyReminder(dhikrId: String, dhikrName: String, hour: Int, minute: Int) {
        val intent = Intent(context, DhikrReminderReceiver::class.java).apply {
            putExtra("dhikr_id", dhikrId)
            putExtra("dhikr_name", dhikrName)
        }
        
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            dhikrId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            
            // If the time is in the past, schedule for tomorrow
            if (before(Calendar.getInstance())) {
                add(Calendar.DATE, 1)
            }
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                calendar.timeInMillis,
                pendingIntent
            )
        } else {
            alarmManager.setExact(
                AlarmManager.RTC_WAKEUP,
                calendar.timeInMillis,
                pendingIntent
            )
        }
    }

    fun cancelReminder(dhikrId: String) {
        val intent = Intent(context, DhikrReminderReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            dhikrId.hashCode(),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }
}
`
  }
];
