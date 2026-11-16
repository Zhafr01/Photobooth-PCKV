declare module "gifshot" {
  interface GifOptions {
    images: string[];
    interval?: number;
    gifWidth?: number;
    gifHeight?: number;
    numFrames?: number;
  }

  interface GifCallbackObj {
    error: boolean;
    errorCode?: string;
    errorMsg?: string;
    image: string;
  }

  export function createGIF(
    options: GifOptions,
    callback: (obj: GifCallbackObj) => void
  ): void;

  export function isSupported(): boolean;
}

