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

  const detailScale = clamp(0.92 - ruin * 0.0037, 0.5, 0.9)
  const detailWidth = clamp(Math.round(originalWidth * detailScale), 24, originalWidth)
  const detailHeight = clamp(Math.round(originalHeight * detailScale), 24, originalHeight)
  const baseQuality = clamp(0.46 - ruin * 0.0041, 0.04, 0.35)
  const passCount = Math.round(clamp(2 + (ruin - 55) / 10, 2, 7))

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
  detailContext.drawImage(sourceImage, 0, 0, detailWidth, detailHeight)

  workContext.imageSmoothingEnabled = true
  workContext.clearRect(0, 0, originalWidth, originalHeight)
  workContext.drawImage(detailCanvas, 0, 0, originalWidth, originalHeight)

  // Re-encode several times at low JPEG quality for visible compression artifacts.
  for (let pass = 0; pass < passCount; pass += 1) {
    const passQuality = clamp(baseQuality - pass * 0.03, 0.02, baseQuality)
    const passBlob = await canvasToBlob(workCanvas, format, passQuality)
    const passImage = await loadImageFromBlob(passBlob)

    workContext.clearRect(0, 0, originalWidth, originalHeight)
    workContext.drawImage(passImage, 0, 0, originalWidth, originalHeight)
  }

  const finalQuality = clamp(baseQuality * 0.84, 0.02, 0.3)
  const blob = await canvasToBlob(workCanvas, format, finalQuality)

  return {
    blob,
    url: URL.createObjectURL(blob),
    width: originalWidth,
    height: originalHeight,
    bytes: blob.size,
  }
}
