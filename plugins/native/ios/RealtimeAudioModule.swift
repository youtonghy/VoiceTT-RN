import AVFoundation
import React

@objc(RealtimeAudioModule)
class RealtimeAudioModule: RCTEventEmitter {
  private let sampleRate: Double = 24000
  private let chunkSamples = 1200
  private let audioEngine = AVAudioEngine()
  private var isCapturing = false
  private var pendingSamples: [Int16] = []
  private var interruptionObserver: NSObjectProtocol?

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["realtimeAudioFrame", "realtimeAudioError"]
  }

  @objc(start:rejecter:)
  func start(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if isCapturing {
      resolve(nil)
      return
    }

    AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
      guard let self else { return }
      if !granted {
        reject("permission_denied", "Microphone permission was denied", nil)
        return
      }

      do {
        try self.startCapture()
        resolve(nil)
      } catch {
        self.emitError("Failed to start realtime audio capture")
        reject("start_failed", "Failed to start realtime audio capture", error)
      }
    }
  }

  @objc(stop:rejecter:)
  func stop(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    stopCapture()
    resolve(nil)
  }

  private func startCapture() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
    try session.setPreferredSampleRate(sampleRate)
    try session.setActive(true, options: [])

    pendingSamples.removeAll(keepingCapacity: true)
    let inputNode = audioEngine.inputNode
    let inputFormat = inputNode.inputFormat(forBus: 0)
    inputNode.removeTap(onBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: AVAudioFrameCount(chunkSamples), format: inputFormat) {
      [weak self] buffer, _ in
      self?.handleBuffer(buffer)
    }

    audioEngine.prepare()
    try audioEngine.start()
    observeAudioInterruptions()
    isCapturing = true
  }

  private func stopCapture() {
    if let observer = interruptionObserver {
      NotificationCenter.default.removeObserver(observer)
      self.interruptionObserver = nil
    }
    if audioEngine.isRunning {
      audioEngine.inputNode.removeTap(onBus: 0)
      audioEngine.stop()
    }
    pendingSamples.removeAll(keepingCapacity: false)
    isCapturing = false
  }

  private func observeAudioInterruptions() {
    if let observer = interruptionObserver {
      NotificationCenter.default.removeObserver(observer)
      self.interruptionObserver = nil
    }

    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] notification in
      guard let self,
            let typeValue = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
        return
      }
      if type == .began {
        self.emitError("Audio session interrupted")
        self.stopCapture()
      }
    }
  }

  private func handleBuffer(_ buffer: AVAudioPCMBuffer) {
    guard let channelData = buffer.floatChannelData else {
      return
    }
    let frameCount = Int(buffer.frameLength)
    let channelCount = Int(buffer.format.channelCount)
    let sourceRate = buffer.format.sampleRate
    if frameCount <= 0 || sourceRate <= 0 || channelCount <= 0 {
      return
    }

    let outputCount = max(1, Int((Double(frameCount) * sampleRate / sourceRate).rounded()))
    var samples = [Int16]()
    samples.reserveCapacity(outputCount)

    for outputIndex in 0..<outputCount {
      let sourceIndex = min(frameCount - 1, Int((Double(outputIndex) * sourceRate / sampleRate).rounded()))
      var mixed: Float = 0
      for channel in 0..<channelCount {
        mixed += channelData[channel][sourceIndex]
      }
      mixed /= Float(channelCount)
      let clamped = max(-1, min(1, mixed))
      let scaled = clamped < 0 ? clamped * 32768.0 : clamped * Float(Int16.max)
      samples.append(Int16(scaled))
    }

    pendingSamples.append(contentsOf: samples)
    while pendingSamples.count >= chunkSamples {
      let chunk = Array(pendingSamples.prefix(chunkSamples))
      pendingSamples.removeFirst(chunkSamples)
      emit(samples: chunk)
    }
  }

  private func emit(samples: [Int16]) {
    var littleEndianSamples = samples.map { $0.littleEndian }
    let data = littleEndianSamples.withUnsafeBufferPointer { pointer in
      Data(buffer: pointer)
    }
    sendEvent(withName: "realtimeAudioFrame", body: ["chunk": data.base64EncodedString()])
  }

  private func emitError(_ message: String) {
    sendEvent(withName: "realtimeAudioError", body: ["message": message])
  }
}
