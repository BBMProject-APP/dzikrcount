package com.dzikr.bbm.presentation.service

import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.android.controller.ServiceController

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class DhikrPlaybackServiceTest {

    private lateinit var serviceController: ServiceController<DhikrPlaybackService>
    private lateinit var service: DhikrPlaybackService
    private val context: Context = ApplicationProvider.getApplicationContext()

    @Before
    fun setUp() {
        DhikrPlaybackService.resetStateForTesting()
        serviceController = Robolectric.buildService(DhikrPlaybackService::class.java)
        service = serviceController.get()
        serviceController.create()
    }

    @After
    fun tearDown() {
        serviceController.destroy()
    }

    @Test
    fun `initial state is correct`() = runTest {
        assertFalse(DhikrPlaybackService.isPlaying.value)
        assertEquals(0, DhikrPlaybackService.currentCount.value)
        assertEquals(1.0f, DhikrPlaybackService.playbackSpeed.value)
        assertEquals("", DhikrPlaybackService.activeDhikrId.value)
    }

    @Test
    fun `ACTION_SET_DHIKR updates state correctly`() = runTest {
        val dhikrId = "test_dhikr"
        val targetCount = 33
        val audioUri = "asset:///test.mp3"
        
        val intent = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_SET_DHIKR
            putExtra("dhikr_id", dhikrId)
            putExtra("target_count", targetCount)
            putExtra("audio_uri", audioUri)
        }

        serviceController.withIntent(intent).startCommand(0, 0)

        assertEquals(dhikrId, DhikrPlaybackService.activeDhikrId.value)
        assertEquals(targetCount, DhikrPlaybackService.targetCount.value)
        assertEquals(0, DhikrPlaybackService.currentCount.value)
    }

    @Test
    fun `ACTION_SET_SPEED updates playback speed`() = runTest {
        val speed = 1.5f
        val intent = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_SET_SPEED
            putExtra("speed", speed)
        }

        serviceController.withIntent(intent).startCommand(0, 0)

        assertEquals(speed, DhikrPlaybackService.playbackSpeed.value)
    }

    @Test
    fun `ACTION_STOP resets state and stops service`() = runTest {
        // First set some state
        val intentSet = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_SET_DHIKR
            putExtra("dhikr_id", "test")
        }
        serviceController.withIntent(intentSet).startCommand(0, 0)
        
        val intentStop = Intent(context, DhikrPlaybackService::class.java).apply {
            action = DhikrPlaybackService.ACTION_STOP
        }

        serviceController.withIntent(intentStop).startCommand(0, 0)

        assertFalse(DhikrPlaybackService.isPlaying.value)
        assertEquals(0, DhikrPlaybackService.currentCount.value)
    }
}
