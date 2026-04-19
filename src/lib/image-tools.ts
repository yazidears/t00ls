export type OutputFormat = "image/jpeg" | "image/png" | "image/webp"

export type ImageSettings = {
  crush: number
  blur: number
  upscale: number
  contrast: number
  noise: number
  smoothing: "pixelated" | "smooth"
}

export type ImagePreset = {
  id: string
  name: string
  eyebrow: string
  description: string
  settings: ImageSettings
}

export type ProcessedImage = {
  blob: Blob
  url: string
  width: number
  height: number
  bytes: number
}

export const defaultSettings: ImageSettings = {
  crush: 12,
  blur: 1.4,
  upscale: 100,
  contrast: 108,
  noise: 10,
  smoothing: "pixelated",
}

export const presets: ImagePreset[] = [
  {
    id: "cursed-meme",
    name: "Cursed Meme",
    eyebrow: "Starter pack",
    description: "Crunch the image just enough to feel suspiciously reposted.",
    settings: {
      crush: 12,
      blur: 1.4,
      upscale: 100,
      contrast: 108,
      noise: 10,
      smoothing: "pixelated",
    },
  },
  {
    id: "pocket-fax",
    name: "Pocket Fax",
    eyebrow: "Tiny attachment",
    description: "Soft, blurry, and very clearly sent through four apps.",
    settings: {
      crush: 18,
      blur: 2.8,
      upscale: 100,
      contrast: 118,
      noise: 24,
      smoothing: "smooth",
    },
  },
  {
    id: "forum-artifact",
    name: "Forum Artifact",
    eyebrow: "2008 energy",
    description: "Sharper edges, boosted size, and a threadbare internet feel.",
    settings: {
      crush: 9,
      blur: 0.6,
      upscale: 148,
      contrast: 114,
      noise: 8,
      smoothing: "pixelated",
    },
  },
  {
    id: "soft-evidence",
    name: "Soft Evidence",
    eyebrow: "Unhelpful proof",
    description: "The image equivalent of saying 'trust me, I saw it happen.'",
    settings: {
      crush: 24,
      blur: 4.2,
      upscale: 100,
      contrast: 96,
      noise: 18,
      smoothing: "smooth",
    },
  },
]

export const outputFormats = [
  { value: "image/jpeg", label: "JPG", extension: "jpg" },
  { value: "image/png", label: "PNG", extension: "png" },
  { value: "image/webp", label: "WEBP", extension: "webp" },
] as const

export function cloneSettings(settings: ImageSettings): ImageSettings {
  return { ...settings }
}

export function matchesSettings(a: ImageSettings, b: ImageSettings) {
  return (
    a.crush === b.crush &&
    a.blur === b.blur &&
    a.upscale === b.upscale &&
    a.contrast === b.contrast &&
    a.noise === b.noise &&
    a.smoothing === b.smoothing
  )
}

export function findPresetId(settings: ImageSettings) {
  return presets.find((preset) => matchesSettings(preset.settings, settings))?.id ?? "custom"
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

export function buildDownloadName(name: string, presetId: string, format: OutputFormat) {
  const cleaned = name.replace(/\.[^.]+$/, "")
  const extension = outputFormats.find((item) => item.value === format)?.extension ?? "jpg"

  return `${cleaned}-${presetId}.${extension}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat) {
  const quality = format === "image/png" ? undefined : 0.92

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("The browser could not export the processed image."))
          return
        }

        resolve(blob)
      },
      format,
      quality
    )
  })
}

function applyNoise(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
) {
  if (amount <= 0) {
    return
  }

  const imageData = context.getImageData(0, 0, width, height)
  const intensity = amount / 100
  const { data } = imageData

  for (let index = 0; index < data.length; index += 4) {
    const jitter = (Math.random() - 0.5) * 255 * intensity

    data[index] = clamp(data[index] + jitter, 0, 255)
    data[index + 1] = clamp(data[index + 1] + jitter, 0, 255)
    data[index + 2] = clamp(data[index + 2] + jitter, 0, 255)
  }

  context.putImageData(imageData, 0, 0)
}

function loadImage(file: File) {
  const url = URL.createObjectURL(file)

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("That file could not be decoded as an image."))
    }
    image.src = url
  })
}

export async function renderProcessedImage(
  file: File,
  settings: ImageSettings,
  format: OutputFormat
): Promise<ProcessedImage> {
  const image = await loadImage(file)
  const originalWidth = image.naturalWidth || image.width
  const originalHeight = image.naturalHeight || image.height
  const crushedScale = settings.crush / 100
  const crushedWidth = clamp(Math.round(originalWidth * crushedScale), 18, originalWidth)
  const crushedHeight = clamp(Math.round(originalHeight * crushedScale), 18, originalHeight)
  const outputWidth = clamp(Math.round(originalWidth * (settings.upscale / 100)), 48, 6000)
  const outputHeight = clamp(Math.round(originalHeight * (settings.upscale / 100)), 48, 6000)

  const crushedCanvas = document.createElement("canvas")
  crushedCanvas.width = crushedWidth
  crushedCanvas.height = crushedHeight

  const crushedContext = crushedCanvas.getContext("2d")

  if (!crushedContext) {
    throw new Error("The browser could not create a 2D canvas context.")
  }

  crushedContext.imageSmoothingEnabled = true
  crushedContext.drawImage(image, 0, 0, crushedWidth, crushedHeight)

  const outputCanvas = document.createElement("canvas")
  outputCanvas.width = outputWidth
  outputCanvas.height = outputHeight

  const outputContext = outputCanvas.getContext("2d")

  if (!outputContext) {
    throw new Error("The browser could not create an output canvas context.")
  }

  outputContext.imageSmoothingEnabled = settings.smoothing === "smooth"
  outputContext.filter = `blur(${settings.blur}px) contrast(${settings.contrast}%)`
  outputContext.drawImage(crushedCanvas, 0, 0, outputWidth, outputHeight)
  outputContext.filter = "none"
  applyNoise(outputContext, outputWidth, outputHeight, settings.noise)

  const blob = await canvasToBlob(outputCanvas, format)

  return {
    blob,
    url: URL.createObjectURL(blob),
    width: outputWidth,
    height: outputHeight,
    bytes: blob.size,
  }
}
