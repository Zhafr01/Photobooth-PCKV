/**
 * faceTracker.ts
 * MediaPipe Face Detection wrapper for real-time face tracking.
 * Lazy-loads the WASM model on first use via jsDelivr CDN at runtime.
 */

export type FaceBox = { x: number; y: number; w: number; h: number };

interface MPDetection {
  boundingBox?: { originX: number; originY: number; width: number; height: number };
}

interface MPFaceDetector {
  detectForVideo(video: HTMLVideoElement, timestamp: number): { detections: MPDetection[] };
  close(): void;
}

class FaceTrackerSingleton {
  private detector: MPFaceDetector | null = null;
  private initPromise: Promise<boolean> | null = null;
  private ready = false;

  /**
   * Initialize MediaPipe FaceDetector.
   * Uses runtime dynamic import from CDN so Vite doesn't try to bundle it.
   */
  init(): Promise<boolean> {
    if (this.ready) return Promise.resolve(true);
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async (): Promise<boolean> => {
      try {
        const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

        // Runtime ESM import — bypasses Vite bundling
        const vision = await (Function(
          "url",
          "return import(url)"
        )(`${CDN}/vision_bundle.mjs`) as Promise<{
          FaceDetector: {
            createFromOptions(
              vision: unknown,
              options: object
            ): Promise<MPFaceDetector>;
          };
          FilesetResolver: {
            forVisionTasks(wasmPath: string): Promise<unknown>;
          };
        }>);

        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          `${CDN}/wasm`
        );

        this.detector = await vision.FaceDetector.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.45,
        });

        this.ready = true;
        return true;
      } catch (err) {
        console.warn("[FaceTracker] Init failed:", err);
        this.initPromise = null;
        return false;
      }
    })();

    return this.initPromise;
  }

  isReady(): boolean {
    return this.ready;
  }

  detect(video: HTMLVideoElement): FaceBox[] {
    if (!this.detector || !this.ready) return [];
    if (!video || video.readyState < 2 || video.videoWidth === 0) return [];
    try {
      const result = this.detector.detectForVideo(video, Date.now());
      return (result.detections || [])
        .filter((d) => d.boundingBox)
        .map((d) => ({
          x: d.boundingBox!.originX,
          y: d.boundingBox!.originY,
          w: d.boundingBox!.width,
          h: d.boundingBox!.height,
        }));
    } catch {
      return [];
    }
  }

  destroy() {
    try { this.detector?.close(); } catch { /* ignore */ }
    this.detector = null;
    this.ready = false;
    this.initPromise = null;
  }
}

export const faceTracker = new FaceTrackerSingleton();
