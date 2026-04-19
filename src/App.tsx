import { Download, ImagePlus, LoaderCircle } from "lucide-react"
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"

import { ControlSlider } from "@/components/control-slider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  buildDownloadName,
  defaultSettings,
  formatBytes,
  renderProcessedImage,
  type ImageSettings,
  type OutputFormat,
  type ProcessedImage,
} from "@/lib/image-tools"
import { cn } from "@/lib/utils"

const loadingJokes = [
  "Ruining proof",
  "Destroying memories",
  "Killing pixels",
  "Making it worse",
  "Blame compression",
]

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const renderTokenRef = useRef(0)

  const [settings, setSettings] = useState<ImageSettings>(defaultSettings)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [result, setResult] = useState<ProcessedImage | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jokeIndex, setJokeIndex] = useState(0)

  const format: OutputFormat = "image/jpeg"
  const deferredSettings = useDeferredValue(settings)

  const replaceSourceUrl = useCallback((nextUrl: string | null) => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current)
    }

    sourceUrlRef.current = nextUrl
    setSourceUrl(nextUrl)
  }, [])

  const replaceResult = useCallback((nextResult: ProcessedImage | null) => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
    }

    resultUrlRef.current = nextResult?.url ?? null
    setResult(nextResult)
  }, [])

  useEffect(() => {
    return () => {
      if (sourceUrlRef.current) {
        URL.revokeObjectURL(sourceUrlRef.current)
      }
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isRendering) {
      return
    }

    const interval = window.setInterval(() => {
      setJokeIndex((current) => (current + 1) % loadingJokes.length)
    }, 900)

    return () => window.clearInterval(interval)
  }, [isRendering])

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) {
        return
      }

      if (!file.type.startsWith("image/")) {
        setError("Bad file.")
        return
      }

      setError(null)
      setJokeIndex(0)
      replaceSourceUrl(URL.createObjectURL(file))
      replaceResult(null)

      startTransition(() => {
        setSourceFile(file)
      })
    },
    [replaceResult, replaceSourceUrl]
  )

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith("image/")
      )

      if (item) {
        handleFile(item.getAsFile())
      }
    }

    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [handleFile])

  const processImage = useEffectEvent(async () => {
    if (!sourceFile) {
      return
    }

    const token = ++renderTokenRef.current
    setIsRendering(true)
    setError(null)

    try {
      const nextResult = await renderProcessedImage(sourceFile, deferredSettings, format)

      if (token !== renderTokenRef.current) {
        URL.revokeObjectURL(nextResult.url)
        return
      }

      startTransition(() => {
        replaceResult(nextResult)
      })
    } catch {
      setError("Ruin failed.")
    } finally {
      if (token === renderTokenRef.current) {
        setIsRendering(false)
      }
    }
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void processImage()
  }, [sourceFile, deferredSettings])

  const handleDownload = () => {
    if (!result || !sourceFile) {
      return
    }

    const link = document.createElement("a")
    link.href = result.url
    link.download = buildDownloadName(sourceFile.name, settings.ruin, format)
    link.click()
  }

  const loadingText = useMemo(() => loadingJokes[jokeIndex] ?? loadingJokes[0], [jokeIndex])

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Card className="overflow-hidden border-border bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_36px_120px_-42px_rgba(0,0,0,0.9)]">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                bad jpg
              </p>
              <h1 className="text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">Make it worse</h1>
              <p className="text-sm text-muted-foreground">Drop image. Ruin image. Save image.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="lg"
                className="rounded-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus />
                Pick image
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={handleDownload}
                disabled={!result}
              >
                <Download />
                Save mess
              </Button>
            </div>

            <button
              type="button"
              className={cn(
                "flex min-h-32 w-full items-center justify-center rounded-2xl border border-dashed px-4 text-sm transition",
                isDragging
                  ? "border-foreground bg-muted text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/45"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                handleFile(event.dataTransfer.files[0] ?? null)
              }}
            >
              Drop or paste
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />

            <ControlSlider
              label="Ruin"
              hint="More ruin."
              min={55}
              max={100}
              value={settings.ruin}
              onValueChange={(value) => setSettings({ ruin: value })}
            />

            {error ? (
              <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <PreviewPanel
            title="Before"
            imageUrl={sourceUrl}
            emptyText="No image."
            alt="Original preview"
            meta={sourceFile ? sourceFile.type.replace("image/", "") : null}
          />
          <PreviewPanel
            title="After"
            imageUrl={result?.url ?? null}
            emptyText="No mess."
            alt="Ruined preview"
            meta={
              isRendering
                ? loadingText
                : result
                  ? `${formatBytes(result.bytes)}`
                  : null
            }
            busy={isRendering}
          />
        </div>
      </div>
    </main>
  )
}

function PreviewPanel({
  alt,
  busy = false,
  emptyText,
  imageUrl,
  meta,
  title,
}: {
  alt: string
  busy?: boolean
  emptyText: string
  imageUrl: string | null
  meta: string | null
  title: string
}) {
  return (
    <Card className="border-border bg-card shadow-none">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">{title}</p>
          <div className="text-xs text-muted-foreground">
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="size-3.5 animate-spin" />
                {meta}
              </span>
            ) : (
              meta
            )}
          </div>
        </div>
        <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-border bg-background p-3">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={alt}
              className="max-h-[28rem] w-full rounded-xl object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default App
