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
  ruin: 94,
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

function loadImageFromBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Bad encoded image."))
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

  const tinyScale = clamp(0.18 - ruin * 0.0016, 0.01, 0.14)
  const tinyWidth = clamp(Math.round(originalWidth * tinyScale), 8, originalWidth)
  const tinyHeight = clamp(Math.round(originalHeight * tinyScale), 8, originalHeight)
  const baseQuality = clamp(0.22 - ruin * 0.0018, 0.01, 0.16)
  const passCount = Math.round(clamp(4 + (ruin - 55) / 7, 4, 12))

  const tinyCanvas = document.createElement("canvas")
  tinyCanvas.width = tinyWidth
  tinyCanvas.height = tinyHeight
  const tinyContext = tinyCanvas.getContext("2d")

  const workCanvas = document.createElement("canvas")
  workCanvas.width = originalWidth
  workCanvas.height = originalHeight
  const workContext = workCanvas.getContext("2d")

  if (!tinyContext || !workContext) {
    throw new Error("No 2D context.")
  }

  tinyContext.imageSmoothingEnabled = true
  tinyContext.clearRect(0, 0, tinyWidth, tinyHeight)
  tinyContext.drawImage(sourceImage, 0, 0, tinyWidth, tinyHeight)

  // Upscale back to original size using nearest-neighbor to keep large blocks.
  workContext.imageSmoothingEnabled = false
  workContext.clearRect(0, 0, originalWidth, originalHeight)
  workContext.drawImage(tinyCanvas, 0, 0, originalWidth, originalHeight)

  // Re-encode repeatedly at very low quality for heavy compression artifacts.
  for (let pass = 0; pass < passCount; pass += 1) {
    const passQuality = clamp(baseQuality - pass * 0.012, 0.005, baseQuality)
    const passBlob = await canvasToBlob(workCanvas, format, passQuality)
    const passImage = await loadImageFromBlob(passBlob)

    workContext.imageSmoothingEnabled = false
    workContext.clearRect(0, 0, originalWidth, originalHeight)
    workContext.drawImage(passImage, 0, 0, originalWidth, originalHeight)
  }

  const finalQuality = clamp(baseQuality * 0.55, 0.005, 0.12)
  const blob = await canvasToBlob(workCanvas, format, finalQuality)

  return {
    blob,
    url: URL.createObjectURL(blob),
    width: originalWidth,
    height: originalHeight,
    bytes: blob.size,
  }
}
