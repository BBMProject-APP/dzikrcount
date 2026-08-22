package com.dzikr.bbm.presentation.viewmodel

import android.app.Application
import android.content.Intent
import androidx.lifecycle.AndroidViewModel
import com.dzikr.bbm.domain.model.DhikrItem
import com.dzikr.bbm.presentation.service.DhikrPlaybackService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

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
// 1. Daftar semua dzikir yang tersedia (Gunakan huruf kecil & underscore untuk ID)
    val dhikrList = listOf(
        DhikrItem(
            id = "shalawat_jibril",
            name = "Shalawat Jibril",
            arabic = "صَلَّى اللهُ عَلَى مُحَمَّد",
            transliteration = "Shallallahu 'Ala Muhammad",
            translation = "May Allah bless Muhammad with His grace."
        ),
        DhikrItem(
            id = "astaghfirullah",
            name = "Astaghfirullahal adziim",
            arabic = "أَسْتَغْفِرُ اللهَ الْعَظِيمَ",
            transliteration = "Astaghfirullahal 'Adziim",
            translation = "I seek forgiveness from Allah the Almighty."
        ),
        DhikrItem(
            id = "yaa_fattaah_yaa_razzaaq",
            name = "Yaa Fattaahu Yaa Razzaaqu",
            arabic = "يَا فَتَّاحُ يَا رَزَّاقُ",
            transliteration = "Yaa Fattaahu Yaa Razzaaqu",
            translation = "O Opener (of doors), O Provider of sustenance."
        ),
        DhikrItem(
            id = "yaa_lathiif",
            name = "Yaa Lathiif",
            arabic = "يَا لَطِيفُ",
            transliteration = "Yaa Lathiif",
            translation = "O Most Gentle / Subtle."
        ),
        DhikrItem(
            id = "yaa_kaafii",
            name = "Yaa Kaafii",
            arabic = "يَا كَافِي",
            transliteration = "Yaa Kaafii",
            translation = "O All-Sufficient One."
        )
    )

    // 2. Setelan awal aplikasi saat pertama kali dibuka (Default: Sholawat Jibril)
    private val _activeDhikr = MutableStateFlow(dhikrList[0])
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
            putExtra("audio_uri", "asset:///audio/" + dhikr.id + ".ogg")
        }
        context.startService(intent)
    }

    fun start() {
        // PENGAMAN: Jika di Service id-nya masih kosong, paksa load dzikir aktif saat ini terlebih dahulu
        if (activeDhikrId.value.isEmpty()) {
            val currentDhikr = _activeDhikr.value
            val selectIntent = Intent(context, DhikrPlaybackService::class.java).apply {
                action = DhikrPlaybackService.ACTION_SET_DHIKR
                putExtra("dhikr_id", currentDhikr.id)
                // Beri target count default, misal 33 atau 100
                putExtra("target_count", 100)
                putExtra("audio_uri", "asset:///audio/${currentDhikr.id}.ogg")
            }
            context.startService(selectIntent)
        }

        // Baru setelah itu kirim perintah START seperti biasa
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
    // Fungsi untuk memperbarui target hitungan
    fun updateTargetCount(newTarget: Int) {
        val intent = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_SET_DHIKR
            putExtra("dhikr_id", activeDhikr.value.id)
            putExtra("target_count", newTarget)
            // Pastikan ekstensi audio sesuai dengan yang Anda pakai (.ogg atau .mp3)
            putExtra("audio_uri", "asset:///audio/${activeDhikr.value.id}.ogg")
        }
        context.startService(intent)
    }
    val isMuted: StateFlow<Boolean> = DhikrPlaybackService.isMuted

    fun toggleMute(mute: Boolean) {
        val intent = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_TOGGLE_MUTE
            putExtra("is_muted", mute)
        }
        context.startService(intent)
    }
    fun setPlaybackSpeed(speed: Float) {
        val intent = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_SET_SPEED
            putExtra("speed", speed)
        }
        context.startService(intent)
    }
}
