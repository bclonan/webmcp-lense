import { ulid } from 'ulid'
import type { CapturedFrame, CaptureGeometry } from '@lens/protocol'
import { VisualChangeDetector } from './VisualChangeDetector'
export class ScreenCaptureService {
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null
  private sampleId = 0
  private lastSample = 0
  private generation = 0
  readonly detector = new VisualChangeDetector()
  constructor(
    private onChange: (difference: number) => void,
    private onStop: () => void,
    private interval: () => number,
  ) {}
  async start() {
    if (!navigator.mediaDevices?.getDisplayMedia)
      throw new Error(
        'Screen sharing is unavailable. Open Lens on localhost or HTTPS in a supporting browser.',
      )
    this.stop()
    const generation = ++this.generation
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    if (generation !== this.generation) {
      stream.getTracks().forEach((t) => t.stop())
      throw new Error('Screen sharing was cancelled.')
    }
    this.stream = stream
    this.video = document.createElement('video')
    this.video.muted = true
    this.video.playsInline = true
    this.video.srcObject = stream
    stream.getVideoTracks()[0].addEventListener('ended', () => this.stop(), { once: true })
    try {
      await this.video.play()
    } catch (error) {
      this.stop()
      throw error
    }
    if (generation !== this.generation) throw new Error('Screen sharing was cancelled.')
    this.detector.reset()
    this.lastSample = 0
    this.sample()
    return stream
  }
  stop() {
    ++this.generation
    const stream = this.stream,
      video = this.video
    this.stream = null
    this.video = null
    if (video) {
      if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(this.sampleId)
      else cancelAnimationFrame(this.sampleId)
      video.pause()
      video.srcObject = null
    }
    stream?.getTracks().forEach((track) => track.stop())
    this.detector.reset()
    if (stream) this.onStop()
  }
  getStream() {
    return this.stream
  }
  getVideo() {
    return this.video
  }
  getGeometry(): CaptureGeometry {
    return {
      captureWidth: this.video?.videoWidth ?? 0,
      captureHeight: this.video?.videoHeight ?? 0,
      desktopBounds: { x: 0, y: 0, width: 0, height: 0 },
      displayScale: 1,
      calibrated: false,
    }
  }
  captureFrame(): CapturedFrame {
    const video = this.video
    if (!video?.videoWidth) throw new Error('No shared video frame is available.')
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(video, 0, 0)
    return {
      id: ulid(),
      timestamp: Date.now(),
      width: canvas.width,
      height: canvas.height,
      pixels: ctx.getImageData(0, 0, canvas.width, canvas.height),
    }
  }
  private sample() {
    const video = this.video
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 40
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const tick = (time: number) => {
      if (this.video !== video) return
      if (video.videoWidth && time - this.lastSample >= this.interval()) {
        this.lastSample = time
        ctx.drawImage(video, 0, 0, 64, 40)
        const result = this.detector.compare(ctx.getImageData(0, 0, 64, 40).data)
        if (result.changed) this.onChange(result.difference)
      }
      this.sampleId = video.requestVideoFrameCallback
        ? video.requestVideoFrameCallback(tick)
        : requestAnimationFrame(tick)
    }
    this.sampleId = video.requestVideoFrameCallback
      ? video.requestVideoFrameCallback(tick)
      : requestAnimationFrame(tick)
  }
}
