package com.unbaked0692.vtt.realtimeaudio

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean

class RealtimeAudioModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private val sampleRate = 24000
  private val chunkSamples = 1200
  private val isCapturing = AtomicBoolean(false)
  private var audioRecord: AudioRecord? = null
  private var captureThread: HandlerThread? = null

  override fun getName(): String = "RealtimeAudioModule"

  @ReactMethod
  fun start(promise: Promise) {
    if (isCapturing.get()) {
      promise.resolve(null)
      return
    }
    if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("permission_denied", "Microphone permission was denied")
      return
    }

    val minBufferSize = AudioRecord.getMinBufferSize(
      sampleRate,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT
    )
    if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
      promise.reject("invalid_state", "Unable to determine AudioRecord buffer size")
      return
    }
    val bufferSize = maxOf(minBufferSize, chunkSamples * 2 * 2)
    val recorder = AudioRecord(
      MediaRecorder.AudioSource.VOICE_RECOGNITION,
      sampleRate,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
      bufferSize
    )
    if (recorder.state != AudioRecord.STATE_INITIALIZED) {
      recorder.release()
      promise.reject("invalid_state", "AudioRecord failed to initialize")
      return
    }

    RealtimeAudioForegroundService.start(reactContext)
    audioRecord = recorder
    isCapturing.set(true)
    val thread = HandlerThread("RealtimeAudioCapture")
    thread.start()
    captureThread = thread
    Handler(thread.looper).post {
      captureLoop(recorder)
    }
    promise.resolve(null)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    stopCapture()
    promise.resolve(null)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by NativeEventEmitter.
  }

  override fun invalidate() {
    stopCapture()
    super.invalidate()
  }

  private fun captureLoop(recorder: AudioRecord) {
    val buffer = ShortArray(chunkSamples)
    try {
      recorder.startRecording()
      if (recorder.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
        throw IllegalStateException("AudioRecord failed to start recording")
      }
      while (isCapturing.get()) {
        val read = recorder.read(buffer, 0, buffer.size)
        if (read > 0) {
          emitChunk(buffer, read)
        } else if (read < 0) {
          throw IllegalStateException("AudioRecord read failed with code $read")
        }
      }
    } catch (error: Throwable) {
      emitError(error.message ?: "Realtime audio capture failed")
    } finally {
      isCapturing.set(false)
      try {
        recorder.stop()
      } catch (_: Throwable) {
      }
      recorder.release()
      if (audioRecord === recorder) {
        audioRecord = null
      }
      RealtimeAudioForegroundService.stop(reactContext)
    }
  }

  private fun stopCapture() {
    isCapturing.set(false)
    audioRecord?.let {
      try {
        it.stop()
      } catch (_: Throwable) {
      }
    }
    captureThread?.quitSafely()
    captureThread = null
    RealtimeAudioForegroundService.stop(reactContext)
  }

  private fun emitChunk(buffer: ShortArray, read: Int) {
    val bytes = ByteBuffer.allocate(read * 2).order(ByteOrder.LITTLE_ENDIAN)
    for (index in 0 until read) {
      bytes.putShort(buffer[index])
    }
    val base64 = Base64.encodeToString(bytes.array(), Base64.NO_WRAP)
    val payload = Arguments.createMap()
    payload.putString("chunk", base64)
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("realtimeAudioFrame", payload)
  }

  private fun emitError(message: String) {
    val payload = Arguments.createMap()
    payload.putString("message", message)
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("realtimeAudioError", payload)
  }
}
