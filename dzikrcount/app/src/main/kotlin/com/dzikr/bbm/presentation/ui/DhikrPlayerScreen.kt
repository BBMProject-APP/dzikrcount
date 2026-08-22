package com.dzikr.bbm.presentation.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.activity.ComponentActivity
import com.dzikr.bbm.presentation.viewmodel.DhikrViewModel
// IMPORT ADMOB COMPONENT
import androidx.compose.ui.viewinterop.AndroidView
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView

/**
 * Komponen Jembatan untuk Menampilkan Iklan Banner AdMob
 */
@Composable
fun DhikrBannerAd(modifier: Modifier = Modifier) {
    AndroidView(
        modifier = modifier.fillMaxWidth(),
        factory = { context ->
            AdView(context).apply {
                setAdSize(AdSize.BANNER)
                adUnitId = "ca-app-pub-8960108261064180/1465075150" // ID Banner Asli Anda
                loadAd(AdRequest.Builder().build())
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DhikrPlayerScreen(
    viewModel: DhikrViewModel,
    activity: ComponentActivity,
    modifier: Modifier = Modifier
) {
    val currentCount by viewModel.currentCount.collectAsState()
    val targetCount by viewModel.targetCount.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val activeDhikr by viewModel.activeDhikr.collectAsState()

    val currentSpeed by viewModel.playbackSpeed.collectAsState()
    val isMuted by viewModel.isMuted.collectAsState()

    // Breathing pulse animation
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val rawPulseScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 3000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )
    val pulseScale = if (isPlaying) rawPulseScale else 1.0f

    // Pemicu Iklan Interstitial Otomatis ketika Target Tercapai
    LaunchedEffect(currentCount, targetCount) {
        if (currentCount >= targetCount && targetCount > 0) {
            MainActivity.showInterstitial(activity) {
                // Aksi setelah iklan ditutup: reset hitungan via viewModel Anda jika diperlukan
                viewModel.emergencyMute() // Contoh: Hentikan player / Reset
            }
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Dhikr & Shalawat Count", fontWeight = FontWeight.SemiBold, color = Color(0xFFE2E8F0)) },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF0F172A)
                )
            )
        },
        containerColor = Color(0xFF0F172A),
        modifier = modifier
    ) { paddingValues ->

        // COLUMN INDUK UTAMA
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {

            // LAYER 1: AREA KONTEN APLIKASI UTAMA (Didorong ke atas dengan weight 1f)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {

                // ==========================================
                // DROPDOWN MENU SELECTION PANEL
                // ==========================================
                var expanded by remember { mutableStateOf(false) }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { expanded = true }
                    ) {
                        Row(
                            modifier = Modifier
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Dzikr: ${activeDhikr.name}",
                                color = Color.White,
                                fontWeight = FontWeight.Medium,
                                fontSize = 14.sp
                            )
                            Text(text = "▼", color = Color(0xFF34D399), fontSize = 12.sp)
                        }
                    }

                    DropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false },
                        modifier = Modifier
                            .fillMaxWidth(0.9f)
                            .background(Color(0xFF1E293B))
                    ) {
                        viewModel.dhikrList.forEach { dhikr ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = dhikr.name,
                                        color = if (dhikr.id == activeDhikr.id) Color(0xFF34D399) else Color.White,
                                        fontWeight = if (dhikr.id == activeDhikr.id) FontWeight.Bold else FontWeight.Normal
                                    )
                                },
                                onClick = {
                                    viewModel.selectDhikr(dhikr, target = targetCount)
                                    expanded = false
                                }
                            )
                        }
                    }
                }

                // ==========================================
                // TEXT DISPLAY PANEL
                // ==========================================
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = activeDhikr.arabic,
                        fontSize = 32.sp,
                        textAlign = TextAlign.Center,
                        color = Color(0xFF34D399),
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Serif,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = activeDhikr.transliteration,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center,
                        color = Color(0xFF94A3B8),
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

                // ==========================================
                // DIKECILKAN: CIRCULAR PROGRESS TRACKER (240dp -> 200dp)
                // ==========================================
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(200.dp) // DIKECILKAN BIAR LAYAR LONGGAR BOSKU
                        .padding(6.dp)
                ) {
                    val progress = currentCount.toFloat() / targetCount.toFloat().coerceAtLeast(1f)

                    Canvas(modifier = Modifier.fillMaxSize()) {
                        drawCircle(
                            brush = Brush.radialGradient(
                                colors = listOf(Color(0x1A10B981), Color(0x0010B981)),
                                center = center,
                                radius = size.minDimension / 2 * pulseScale
                            )
                        )
                    }

                    val animatedProgress by animateFloatAsState(
                        targetValue = progress,
                        animationSpec = tween(durationMillis = 600, easing = EaseOutQuad),
                        label = "progress"
                    )

                    Canvas(modifier = Modifier.size(165.dp)) { // DIKECILKAN DARI 200dp
                        drawCircle(
                            color = Color(0xFF1E293B),
                            style = Stroke(width = 8.dp.toPx(), cap = StrokeCap.Round)
                        )
                        drawArc(
                            color = Color(0xFF10B981),
                            startAngle = -90f,
                            sweepAngle = animatedProgress * 360f,
                            useCenter = false,
                            style = Stroke(width = 10.dp.toPx(), cap = StrokeCap.Round)
                        )
                    }

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "$currentCount",
                            fontSize = 40.sp, // Disesuaikan sedikit dengan wadah baru
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "of $targetCount",
                            fontSize = 13.sp,
                            color = Color(0xFF64748B)
                        )
                        Text(
                            text = if (isPlaying) "RECITING" else "PAUSED",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = if (isPlaying) Color(0xFF34D399) else Color(0xFF64748B),
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }

                    Box(modifier = Modifier.matchParentSize()) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(top = 4.dp, end = 4.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isMuted) Color(0xFF7F1D1D) else Color(0xFF1E293B))
                                .clickable { viewModel.toggleMute(!isMuted) }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "Tally Only",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isMuted) Color.White else Color(0xFF94A3B8)
                                )
                                Text(text = if (isMuted) "🔇" else "🔊", fontSize = 12.sp)
                            }
                        }
                    }
                }

                // ==========================================
                // TARGET COUNT SELECTION PANEL
                // ==========================================
                val activeTarget by viewModel.targetCount.collectAsState()
                var showCustomDialog by remember { mutableStateOf(false) }
                var customInputText by remember { mutableStateOf("") }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val targets = listOf(100, 1000)
                    targets.forEach { target ->
                        val isSelected = activeTarget == target
                        Button(
                            onClick = { viewModel.updateTargetCount(target) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isSelected) Color(0xFF34D399) else Color(0xFF1E293B)
                            ),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = target.toString(),
                                color = if (isSelected) Color.Black else Color.White,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    val isCustomSelected = activeTarget != 100 && activeTarget != 1000
                    Button(
                        onClick = { showCustomDialog = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isCustomSelected) Color(0xFF34D399) else Color(0xFF1E293B)
                        ),
                        modifier = Modifier.weight(1.2f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = if (isCustomSelected) "Custom: $activeTarget" else "Custom",
                            color = if (isCustomSelected) Color.Black else Color.White,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1
                        )
                    }
                }

                if (showCustomDialog) {
                    AlertDialog(
                        onDismissRequest = { showCustomDialog = false },
                        title = { Text(text = "Set Custom Target", color = Color.White) },
                        containerColor = Color(0xFF1E293B),
                        text = {
                            OutlinedTextField(
                                value = customInputText,
                                onValueChange = { input ->
                                    if (input.all { it.isDigit() }) customInputText = input
                                },
                                label = { Text("Enter target number", color = Color(0xFF34D399)) },
                                singleLine = true,
                                textStyle = androidx.compose.ui.text.TextStyle(
                                    color = Color(0xFF34D399),
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold
                                ),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedTextColor = Color(0xFF34D399),
                                    unfocusedTextColor = Color(0xFF34D399),
                                    focusedBorderColor = Color(0xFF34D399),
                                    unfocusedBorderColor = Color(0xFF64748B),
                                    cursorColor = Color(0xFF34D399)
                                )
                            )
                        },
                        confirmButton = {
                            TextButton(
                                onClick = {
                                    val enteredNumber = customInputText.toIntOrNull() ?: 100
                                    if (enteredNumber > 0) viewModel.updateTargetCount(enteredNumber)
                                    showCustomDialog = false
                                    customInputText = ""
                                }
                            ) {
                                Text("OK", color = Color(0xFF34D399), fontWeight = FontWeight.Bold)
                            }
                        },
                        dismissButton = {
                            TextButton(onClick = { showCustomDialog = false }) { Text("Cancel", color = Color.Gray) }
                        }
                    )
                }

                // ==========================================
                // PLAYBACK SPEED CONTROLLER PANEL
                // ==========================================
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
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
                                text = "${currentSpeed}x",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF10B981)
                            )
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            listOf(0.5f, 1.0f, 1.25f, 1.5f, 2.0f).forEach { speed ->
                                val isSelected = currentSpeed == speed
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
                                        text = "${speed}x",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isSelected) Color(0xFF0F172A) else Color.White
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // ==========================================
                // ACTION BUTTONS PANEL (START & STOP/RESET)
                // ==========================================
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = { if (isPlaying) viewModel.pause() else viewModel.start() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isPlaying) Color(0xFF334155) else Color(0xFF10B981)
                        ),
                        modifier = Modifier
                            .height(50.dp)
                            .weight(1f)
                            .padding(end = 6.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(if (isPlaying) "Pause" else "Start recitation", fontWeight = FontWeight.SemiBold)
                    }

                    Button(
                        onClick = { viewModel.emergencyMute() },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .height(50.dp)
                            .weight(1f)
                            .padding(start = 6.dp)
                    ) {
                        Text(
                            text = "STOP/RESET",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            // LAYER 2: BUFFER JARAK SUCI 🛡️ (Agar Jempol 100% Aman dari Salah Klik Iklan)
            Spacer(modifier = Modifier.height(16.dp))

            // LAYER 3: IKLAN BANNER (Terpatri abadi dengan tenang di area paling bawah layar)
            DhikrBannerAd()
        }
    }
}