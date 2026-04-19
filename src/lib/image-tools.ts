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
  ruin: 92,
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

  const detailScale = clamp(0.86 - ruin * 0.0031, 0.48, 0.82)
  const detailWidth = clamp(Math.round(originalWidth * detailScale), 24, originalWidth)
  const detailHeight = clamp(Math.round(originalHeight * detailScale), 24, originalHeight)
  const baseQuality = clamp(0.24 - ruin * 0.0021, 0.012, 0.14)
  const passCount = Math.round(clamp(5 + (ruin - 55) / 6, 5, 12))

  const detailCanvas = document.createElement("canvas")
  detailCanvas.width = detailWidth
  detailCanvas.height = detailHeight
  const detailContext = detailCanvas.getContext("2d")

  const workCanvas = document.createElement("canvas")
  workCanvas.width = originalWidth
  workCanvas.height = originalHeight
  const workContext = workCanvas.getContext("2d")

  if (!detailContext || !workContext) {
    throw new Error("No 2D context.")
  }

  detailContext.imageSmoothingEnabled = true
  detailContext.clearRect(0, 0, detailWidth, detailHeight)
  detailContext.drawImage(sourceImage, 0, 0, detailWidth, detailHeight)

  // Keep the original output size, but soften detail before compression so it feels crushed, not pixel-art.
  workContext.imageSmoothingEnabled = true
  workContext.clearRect(0, 0, originalWidth, originalHeight)
  workContext.drawImage(detailCanvas, 0, 0, originalWidth, originalHeight)

  // Re-encode repeatedly at very low quality for dirty JPEG artifacts without blocky nearest-neighbor scaling.
  for (let pass = 0; pass < passCount; pass += 1) {
    const passQuality = clamp(baseQuality - pass * 0.01, 0.006, baseQuality)
    const passBlob = await canvasToBlob(workCanvas, format, passQuality)
    const passImage = await loadImageFromBlob(passBlob)

    workContext.imageSmoothingEnabled = true
    workContext.clearRect(0, 0, originalWidth, originalHeight)
    workContext.drawImage(passImage, 0, 0, originalWidth, originalHeight)
  }

  const finalQuality = clamp(baseQuality * 0.6, 0.006, 0.1)
  const blob = await canvasToBlob(workCanvas, format, finalQuality)

  return {
    blob,
    url: URL.createObjectURL(blob),
    width: originalWidth,
    height: originalHeight,
    bytes: blob.size,
  }
}
