export type OutputFormat = "image/jpeg"

export type ImageSettings = {
  ruin: number
}

export type ProcessedImage = {
  blob: Blob
  url: string
  width: number
  height: number
  bytes: number
}

export const defaultSettings: ImageSettings = {
  ruin: 88,
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function buildDownloadName(name: string, ruin: number, format: OutputFormat) {
  const cleaned = name.replace(/\.[^.]+$/, "")
  const extension = format === "image/jpeg" ? "jpg" : "jpg"

  return `${cleaned}-ruined-${ruin}.${extension}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Export failed."))
          return
        }

        resolve(blob)
      },
      format,
      quality
    )
  })
}

function loadImageFromFile(file: File) {
  const url = URL.createObjectURL(file)

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Bad image file."))
    }
    image.src = url
  })
}

export async function renderProcessedImage(
  file: File,
  settings: ImageSettings,
  format: OutputFormat
): Promise<ProcessedImage> {
  const sourceImage = await loadImageFromFile(file)
  const ruin = clamp(settings.ruin, 1, 100)
  const originalWidth = sourceImage.naturalWidth || sourceImage.width
  const originalHeight = sourceImage.naturalHeight || sourceImage.height

  const tinyScale = clamp(0.25 - ruin * 0.0023, 0.02, 0.24)
  const tinyWidth = clamp(Math.round(originalWidth * tinyScale), 8, originalWidth)
  const tinyHeight = clamp(Math.round(originalHeight * tinyScale), 8, originalHeight)

  const outputWidth = clamp(Math.round(originalWidth), 80, 6000)
  const outputHeight = clamp(Math.round(originalHeight), 80, 6000)

  const tinyCanvas = document.createElement("canvas")
  tinyCanvas.width = tinyWidth
  tinyCanvas.height = tinyHeight

  const tinyContext = tinyCanvas.getContext("2d")

  if (!tinyContext) {
    throw new Error("No 2D context.")
  }

  tinyContext.imageSmoothingEnabled = true
  tinyContext.drawImage(sourceImage, 0, 0, tinyWidth, tinyHeight)

  const outputCanvas = document.createElement("canvas")
  outputCanvas.width = outputWidth
  outputCanvas.height = outputHeight

  const outputContext = outputCanvas.getContext("2d")

  if (!outputContext) {
    throw new Error("No output context.")
  }

  // Exact behavior requested: downscale first, then scale back up.
  outputContext.imageSmoothingEnabled = true
  outputContext.drawImage(tinyCanvas, 0, 0, outputWidth, outputHeight)

  const blob = await canvasToBlob(outputCanvas, format, 0.92)

  return {
    blob,
    url: URL.createObjectURL(blob),
    width: outputWidth,
    height: outputHeight,
    bytes: blob.size,
  }
}
