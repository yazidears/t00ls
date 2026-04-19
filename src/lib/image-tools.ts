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

function loadImageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("JPEG pass failed."))
    image.src = dataUrl
  })
}

function ruinPass(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  ruin: number
) {
  const imageData = context.getImageData(0, 0, width, height)
  const { data } = imageData
  const quant = clamp(Math.round(10 + ruin * 0.45), 12, 56)
  const noisePower = ruin / 100

  for (let i = 0; i < data.length; i += 4) {
    const jitter = (Math.random() - 0.5) * 255 * 0.42 * noisePower

    data[i] = clamp(Math.round((data[i] + jitter) / quant) * quant, 0, 255)
    data[i + 1] = clamp(Math.round((data[i + 1] + jitter) / quant) * quant, 0, 255)
    data[i + 2] = clamp(Math.round((data[i + 2] + jitter) / quant) * quant, 0, 255)
  }

  context.putImageData(imageData, 0, 0)
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
  const tinyScale = clamp(0.21 - ruin * 0.0019, 0.02, 0.22)
  const tinyWidth = clamp(Math.round(originalWidth * tinyScale), 8, originalWidth)
  const tinyHeight = clamp(Math.round(originalHeight * tinyScale), 8, originalHeight)
  const outputScale = 1 + ruin * 0.0034
  const outputWidth = clamp(Math.round(originalWidth * outputScale), 80, 6000)
  const outputHeight = clamp(Math.round(originalHeight * outputScale), 80, 6000)

  const tinyCanvas = document.createElement("canvas")
  tinyCanvas.width = tinyWidth
  tinyCanvas.height = tinyHeight

  const tinyContext = tinyCanvas.getContext("2d")

  if (!tinyContext) {
    throw new Error("No 2D context.")
  }

  tinyContext.imageSmoothingEnabled = true
  tinyContext.drawImage(sourceImage, 0, 0, tinyWidth, tinyHeight)

  const cycles = clamp(2 + Math.floor(ruin / 18), 2, 7)
  for (let cycle = 0; cycle < cycles; cycle++) {
    const cycleQuality = clamp(0.26 - ruin * 0.0024 - cycle * 0.03, 0.02, 0.3)
    const dataUrl = tinyCanvas.toDataURL("image/jpeg", cycleQuality)
    const loopImage = await loadImageFromDataUrl(dataUrl)
    const shake = cycle % 2 === 0 ? 1 : -1

    tinyContext.clearRect(0, 0, tinyWidth, tinyHeight)
    tinyContext.filter = `blur(${clamp(0.2 + ruin * 0.01, 0.2, 1.5)}px)`
    tinyContext.drawImage(
      loopImage,
      shake,
      -shake,
      tinyWidth - shake,
      tinyHeight + shake
    )
    tinyContext.filter = "none"
    ruinPass(tinyContext, tinyWidth, tinyHeight, ruin)
  }

  const outputCanvas = document.createElement("canvas")
  outputCanvas.width = outputWidth
  outputCanvas.height = outputHeight

  const outputContext = outputCanvas.getContext("2d")

  if (!outputContext) {
    throw new Error("No output context.")
  }

  outputContext.imageSmoothingEnabled = true
  outputContext.filter = `blur(${clamp(0.6 + ruin * 0.024, 0.7, 3.8)}px) contrast(${clamp(
    86 + ruin * 0.35,
    90,
    122
  )}%)`
  outputContext.drawImage(tinyCanvas, 0, 0, outputWidth, outputHeight)
  outputContext.filter = "none"
  ruinPass(outputContext, outputWidth, outputHeight, ruin)

  const finalQuality = clamp(0.24 - ruin * 0.002, 0.02, 0.25)
  const blob = await canvasToBlob(outputCanvas, format, finalQuality)

  return {
    blob,
    url: URL.createObjectURL(blob),
    width: outputWidth,
    height: outputHeight,
    bytes: blob.size,
  }
}
