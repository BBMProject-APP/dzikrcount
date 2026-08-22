package com.dzikr.bbm.presentation.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.dzikr.bbm.presentation.viewmodel.DhikrViewModel
// IMPORT TAMBAHAN UNTUK ADMOB
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

class MainActivity : ComponentActivity() {
    private val viewModel: DhikrViewModel by viewModels()

    // Registrasi launcher untuk meminta izin mikrofon secara runtime
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            Toast.makeText(this, "Izin mikrofon aktif untuk kontrol suara", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Fitur respons suara (mic) tidak dapat digunakan tanpa izin", Toast.LENGTH_LONG).show()
        }
    }

    // KELOMPOK FITUR ADMOB INTERSTITIAL (IKLAN PENUH LAYAR)
    companion object {
        var mInterstitialAd: InterstitialAd? = null

        // 1. Fungsi untuk mengunduh iklan Interstitial di latar belakang (mencicil data)
        fun loadInterstitial(activity: ComponentActivity) {
            val adRequest = AdRequest.Builder().build()
            InterstitialAd.load(
                activity,
                "ca-app-pub-8960108261064180/3648385366", // ID Interstitial Asli Anda
                adRequest,
                object : InterstitialAdLoadCallback() {
                    override fun onAdFailedToLoad(adError: LoadAdError) {
                        mInterstitialAd = null
                    }

                    override fun onAdLoaded(interstitialAd: InterstitialAd) {
                        mInterstitialAd = interstitialAd
                    }
                }
            )
        }

        // 2. Fungsi untuk menampilkan iklan Interstitial saat count zikir tercapai
        fun showInterstitial(activity: ComponentActivity, onAdClosed: () -> Unit) {
            if (mInterstitialAd != null) {
                mInterstitialAd?.fullScreenContentCallback = object : com.google.android.gms.ads.FullScreenContentCallback() {
                    override fun onAdDismissedFullScreenContent() {
                        // Setelah iklan ditutup pengguna, reset ke null & cicil load iklan baru
                        mInterstitialAd = null
                        loadInterstitial(activity)
                        onAdClosed() // Jalankan aksi zikir selanjutnya (misal reset count)
                    }
                    override fun onAdFailedToShowFullScreenContent(adError: com.google.android.gms.ads.AdError) {
                        mInterstitialAd = null
                        onAdClosed()
                    }
                }
                mInterstitialAd?.show(activity)
            } else {
                // Jika iklan belum siap/gagal download, langsung eksekusi aksi zikir tanpa nunggu iklan
                onAdClosed()
                loadInterstitial(activity)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // A. NYALAKAN MESIN ADMOB SAAT COLD START
        MobileAds.initialize(this) {}

        // B. MULAI CICIL DOWNLOAD IKLAN INTERSTITIAL SEJAK AWAL
        loadInterstitial(this)

        // Cek dan minta izin mikrofon saat aplikasi pertama kali dibuka
        checkAndRequestMicrophonePermission()

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    // SELESAI: Berikan 'this' (MainActivity) ke dalam Screen agar layout bisa memicu iklan
                    DhikrPlayerScreen(viewModel = viewModel, activity = this)
                }
            }
        }
    }

    private fun checkAndRequestMicrophonePermission() {
        when {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED -> {
                // Izin sudah ada, aman bosku
            }
            else -> {
                // Izin belum ada, langsung munculkan pop-up minta izin
                requestPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }
}