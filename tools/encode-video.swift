// Web video encoder using macOS's built-in AVFoundation (no ffmpeg needed).
//
//   swift tools/encode-video.swift video <input> <output.mp4> [maxWidth=1920] [bitrateMbps=4]
//     → H.264 High profile MP4, no audio, fast-start, scaled down to maxWidth (plays in every browser)
//   swift tools/encode-video.swift frame <input> <output.jpg> [atFraction=0.4]
//     → one still frame (for the <video> poster)
import AVFoundation
import AppKit

func fail(_ msg: String) -> Never { FileHandle.standardError.write((msg + "\n").data(using: .utf8)!); exit(1) }

let args = CommandLine.arguments
guard args.count >= 4 else { fail("usage: encode-video.swift video|frame <input> <output> [options]") }
let mode = args[1], input = URL(fileURLWithPath: args[2]), output = URL(fileURLWithPath: args[3])
let asset = AVURLAsset(url: input)
let sem = DispatchSemaphore(value: 0)

func loadTrack() -> (AVAssetTrack, CGSize, CMTime) {
  var result: (AVAssetTrack, CGSize, CMTime)?
  Task {
    guard let track = try? await asset.loadTracks(withMediaType: .video).first else { fail("no video track") }
    let size = try await track.load(.naturalSize)
    let duration = try await asset.load(.duration)
    result = (track, size, duration)
    sem.signal()
  }
  sem.wait()
  return result!
}

let (track, size, duration) = loadTrack()

if mode == "frame" {
  let at = args.count > 4 ? Double(args[4])! : 0.4
  let gen = AVAssetImageGenerator(asset: asset)
  gen.appliesPreferredTrackTransform = true
  gen.requestedTimeToleranceBefore = .zero
  gen.requestedTimeToleranceAfter = .zero
  gen.maximumSize = CGSize(width: 1920, height: 1920)
  var image: CGImage?
  Task {
    image = try? await gen.image(at: CMTimeMultiplyByFloat64(duration, multiplier: at)).image
    sem.signal()
  }
  sem.wait()
  guard let cg = image else { fail("could not read frame") }
  let rep = NSBitmapImageRep(cgImage: cg)
  guard let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.9]) else { fail("jpeg failed") }
  try! data.write(to: output)
  print("frame \(cg.width)x\(cg.height) → \(output.path)")
  exit(0)
}

// ── video ──
let maxWidth = args.count > 4 ? Double(args[4])! : 1920
let mbps = args.count > 5 ? Double(args[5])! : 4
let scale = min(1, maxWidth / Double(size.width))
let w = Int((Double(size.width) * scale / 2).rounded()) * 2, h = Int((Double(size.height) * scale / 2).rounded()) * 2

try? FileManager.default.removeItem(at: output)
let reader = try! AVAssetReader(asset: asset)
let readerOut = AVAssetReaderTrackOutput(track: track, outputSettings: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
  kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h
])
readerOut.alwaysCopiesSampleData = false
reader.add(readerOut)

let writer = try! AVAssetWriter(outputURL: output, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true // "fast start": can begin playing before it has fully loaded
let fps = (try? { () -> Float in var r: Float = 30; Task { r = (try? await track.load(.nominalFrameRate)) ?? 30; sem.signal() }; sem.wait(); return r }()) ?? 30
let writerIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: Int(mbps * 1_000_000),
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalKey: Int((fps * 2).rounded()),
    AVVideoAllowFrameReorderingKey: true
  ]
])
writerIn.expectsMediaDataInRealTime = false
writer.add(writerIn)

guard reader.startReading() else { fail("reader: \(String(describing: reader.error))") }
writer.startWriting()
writer.startSession(atSourceTime: .zero)
let queue = DispatchQueue(label: "encode")
writerIn.requestMediaDataWhenReady(on: queue) {
  while writerIn.isReadyForMoreMediaData {
    if let buf = readerOut.copyNextSampleBuffer() { writerIn.append(buf) }
    else { writerIn.markAsFinished(); writer.finishWriting { sem.signal() }; return }
  }
}
sem.wait()
guard writer.status == .completed else { fail("writer: \(String(describing: writer.error))") }
let bytes = (try? FileManager.default.attributesOfItem(atPath: output.path)[.size] as? Int) ?? 0
print(String(format: "video %dx%d, %.1f Mbps → %@ (%.1f MB)", w, h, mbps, output.path, Double(bytes) / 1_048_576))
