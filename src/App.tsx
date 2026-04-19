import { Download, ImagePlus, LoaderCircle, WandSparkles } from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  buildDownloadName,
  cloneSettings,
  defaultSettings,
  findPresetId,
  formatBytes,
  outputFormats,
  presets,
  renderProcessedImage,
  type ImageSettings,
  type OutputFormat,
  type ProcessedImage,
} from "@/lib/image-tools"
import { cn } from "@/lib/utils"

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const renderTokenRef = useRef(0)

  const [settings, setSettings] = useState<ImageSettings>(cloneSettings(defaultSettings))
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [result, setResult] = useState<ProcessedImage | null>(null)
  const [format, setFormat] = useState<OutputFormat>("image/jpeg")
  const [isDragging, setIsDragging] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deferredSettings = useDeferredValue(settings)
  const deferredFormat = useDeferredValue(format)
  const activePresetId = useMemo(() => findPresetId(settings), [settings])
  const activePreset = presets.find((preset) => preset.id === activePresetId)

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

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) {
        return
      }

      if (!file.type.startsWith("image/")) {
        setError("Only image files are supported right now.")
        return
      }

      setError(null)
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

    const currentToken = ++renderTokenRef.current
    setIsRendering(true)
    setError(null)

    try {
      const nextResult = await renderProcessedImage(sourceFile, deferredSettings, deferredFormat)

      if (currentToken !== renderTokenRef.current) {
        URL.revokeObjectURL(nextResult.url)
        return
      }

      startTransition(() => {
        replaceResult(nextResult)
      })
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Something went wrong while processing."
      setError(message)
    } finally {
      if (currentToken === renderTokenRef.current) {
        setIsRendering(false)
      }
    }
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void processImage()
  }, [sourceFile, deferredFormat, deferredSettings])

  const handleDownload = () => {
    if (!result || !sourceFile) {
      return
    }

    const link = document.createElement("a")
    link.href = result.url
    link.download = buildDownloadName(sourceFile.name, activePresetId, format)
    link.click()
  }

  const updateSetting = <Key extends keyof ImageSettings>(key: Key, value: ImageSettings[Key]) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }))
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-[28px] border border-border bg-card px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-foreground">
                  t00ls
                </span>
                <span>image tools</span>
                <span>browser only</span>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                  Meme Cruncher
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Upload an image, wreck the quality on purpose, and export it. No backend, no API,
                  no waiting.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                size="lg"
                className="rounded-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus />
                Upload
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full"
                onClick={handleDownload}
                disabled={!result}
              >
                <Download />
                Export
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="border-border bg-card shadow-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Tools</CardTitle>
                <CardDescription>Small browser utilities for image jokes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <ToolRow
                  active
                  title="Meme Cruncher"
                  copy="Downsize, blur, upscale."
                />
                <ToolRow title="Caption Burner" copy="Soon" />
                <ToolRow title="Reaction Cropper" copy="Soon" />
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Upload</CardTitle>
                <CardDescription>Drag, drop, click, or paste an image.</CardDescription>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  className={cn(
                    "flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed px-4 py-8 text-center transition",
                    isDragging
                      ? "border-foreground bg-muted"
                      : "border-border bg-background hover:border-foreground/35"
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
                  <div className="rounded-full border border-border bg-card p-3">
                    <ImagePlus className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Choose an image</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      JPG, PNG, WEBP. Clipboard paste works too.
                    </p>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                />
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Presets</CardTitle>
                <CardDescription>Start from a fixed damage profile.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {presets.map((preset) => {
                  const isActive = preset.id === activePresetId

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition",
                        isActive
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-foreground hover:border-foreground/35"
                      )}
                      onClick={() => setSettings(cloneSettings(preset.settings))}
                    >
                      <div>
                        <p className="text-sm font-medium">{preset.name}</p>
                        <p
                          className={cn(
                            "mt-1 text-xs",
                            isActive ? "text-background/70" : "text-muted-foreground"
                          )}
                        >
                          {preset.description}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-1 font-mono text-[11px]",
                          isActive
                            ? "border-background/20 text-background/80"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {preset.settings.crush}%
                      </span>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-4">
            <Card className="border-border bg-card shadow-none">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-base">Preview</CardTitle>
                    <CardDescription>Original and processed output side by side.</CardDescription>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {outputFormats.map((item) => (
                      <Button
                        key={item.value}
                        variant={format === item.value ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setFormat(item.value)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  <PreviewPane
                    label="Original"
                    meta={sourceFile ? sourceFile.type.replace("image/", "") : null}
                    imageUrl={sourceUrl}
                    alt="Original upload preview"
                    emptyLabel="Upload an image to begin."
                  />
                  <PreviewPane
                    label="Processed"
                    meta={
                      isRendering
                        ? "rendering"
                        : result
                          ? formatBytes(result.bytes)
                          : null
                    }
                    imageUrl={result?.url ?? null}
                    alt="Processed upload preview"
                    emptyLabel="Your processed result appears here."
                    busy={isRendering}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <DataTile
                    label="Preset"
                    value={activePreset?.name ?? "Custom"}
                  />
                  <DataTile
                    label="Output"
                    value={result ? `${result.width} x ${result.height}` : "Waiting"}
                  />
                  <DataTile
                    label="Status"
                    value={error ? "Error" : result ? "Ready" : "Idle"}
                  />
                </div>

                {error ? (
                  <div className="rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Controls</CardTitle>
                    <CardDescription>Fine-tune how ruined the image should look.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                    <WandSparkles className="size-3.5" />
                    {activePreset?.name ?? "Custom"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <ControlSlider
                    label="Crush"
                    hint="Lower size before scaling back up."
                    min={4}
                    max={36}
                    suffix="%"
                    value={settings.crush}
                    onValueChange={(value) => updateSetting("crush", value)}
                  />
                  <ControlSlider
                    label="Blur"
                    hint="Softness applied after the crush."
                    min={0}
                    max={8}
                    step={0.2}
                    value={settings.blur}
                    onValueChange={(value) => updateSetting("blur", value)}
                  />
                  <ControlSlider
                    label="Upscale"
                    hint="Final size of the exported result."
                    min={100}
                    max={180}
                    suffix="%"
                    value={settings.upscale}
                    onValueChange={(value) => updateSetting("upscale", value)}
                  />
                  <ControlSlider
                    label="Contrast"
                    hint="Push edges and darks harder."
                    min={70}
                    max={150}
                    suffix="%"
                    value={settings.contrast}
                    onValueChange={(value) => updateSetting("contrast", value)}
                  />
                  <ControlSlider
                    label="Noise"
                    hint="Adds texture and fake compression grit."
                    min={0}
                    max={36}
                    value={settings.noise}
                    onValueChange={(value) => updateSetting("noise", value)}
                  />
                </div>

                <Separator />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Scaling style</p>
                    <p className="text-xs text-muted-foreground">
                      Crisp blocky edges or smoother scaling.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:w-[260px]">
                    <Button
                      variant={settings.smoothing === "pixelated" ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => updateSetting("smoothing", "pixelated")}
                    >
                      Pixelated
                    </Button>
                    <Button
                      variant={settings.smoothing === "smooth" ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => updateSetting("smoothing", "smooth")}
                    >
                      Smooth
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  )
}

function ToolRow({
  active = false,
  copy,
  title,
}: {
  active?: boolean
  copy: string
  title: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-3",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-background"
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className={cn("mt-1 text-xs", active ? "text-background/70" : "text-muted-foreground")}>
        {copy}
      </p>
    </div>
  )
}

function PreviewPane({
  alt,
  busy = false,
  emptyLabel,
  imageUrl,
  label,
  meta,
}: {
  alt: string
  busy?: boolean
  emptyLabel: string
  imageUrl: string | null
  label: string
  meta: string | null
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
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
      <div className="flex min-h-[320px] items-center justify-center p-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            className="max-h-[30rem] w-full rounded-[18px] object-contain"
          />
        ) : (
          <div className="flex h-full min-h-[280px] w-full items-center justify-center rounded-[18px] border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  )
}

function DataTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export default App
