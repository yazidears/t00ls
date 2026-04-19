import { Download, ImagePlus, LoaderCircle, ScanFace, Sparkles } from "lucide-react"
import {
  useCallback,
  startTransition,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    <main className="min-h-screen bg-background px-4 py-4 text-foreground sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 shadow-[0_24px_120px_-48px_rgba(0,0,0,0.65)] backdrop-blur">
          <div className="grid gap-10 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:px-10">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                <span className="rounded-full border border-border/70 bg-secondary px-3 py-1 text-foreground">
                  t00ls
                </span>
                <span>No backend</span>
                <span>GitHub Pages-ready</span>
                <span>Phone-first</span>
              </div>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-balance sm:text-5xl lg:text-6xl">
                  Tiny browser-native image sabotage tools.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Upload a photo, apply a cursed preset, tweak the damage, and export it instantly.
                  Everything stays in the browser, so it works cleanly on GitHub Pages with zero
                  backend glue.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="rounded-full px-6"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus />
                  Choose an image
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full px-6"
                  onClick={handleDownload}
                  disabled={!result}
                >
                  <Download />
                  Export result
                </Button>
              </div>
            </div>

            <Card className="border-border/70 bg-background/80 shadow-none">
              <CardHeader className="gap-3">
                <CardTitle className="text-base">How it works</CardTitle>
                <CardDescription className="leading-6">
                  Downsize the image, soften it, and blow it back up with just enough texture to
                  look delightfully wrong.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-secondary/70 p-4">
                  <Sparkles className="mt-0.5 size-4 text-foreground" />
                  <p>Preset cards act like mini tools, so the site already feels like a toolbox.</p>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-secondary/70 p-4">
                  <ScanFace className="mt-0.5 size-4 text-foreground" />
                  <p>Paste screenshots directly from your clipboard if dragging feels slower.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="overflow-hidden border-border/70 bg-card/85 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Upload</CardTitle>
                <CardDescription>Drag, drop, browse, or paste from the clipboard.</CardDescription>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  className={cn(
                    "group flex min-h-52 w-full flex-col items-center justify-center rounded-[1.5rem] border border-dashed px-5 py-8 text-center transition",
                    isDragging
                      ? "border-foreground bg-secondary"
                      : "border-border/80 bg-secondary/60 hover:border-foreground/40 hover:bg-secondary"
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
                  <div className="mb-4 rounded-full border border-border/70 bg-background p-3 shadow-sm transition group-hover:scale-[1.03]">
                    <ImagePlus className="size-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Drop an image here or tap to browse
                  </p>
                  <p className="mt-2 max-w-xs text-xs leading-6 text-muted-foreground">
                    Best for JPG, PNG, or WEBP. Large images still stay local to your browser.
                  </p>
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

            <Card className="border-border/70 bg-card/85 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Preset tools</CardTitle>
                <CardDescription>Start with a vibe, then fine-tune the destruction.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {presets.map((preset) => {
                  const isActive = preset.id === activePresetId

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={cn(
                        "rounded-[1.25rem] border p-4 text-left transition",
                        isActive
                          ? "border-foreground bg-secondary"
                          : "border-border/70 bg-background hover:border-foreground/30 hover:bg-secondary/70"
                      )}
                      onClick={() => setSettings(cloneSettings(preset.settings))}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            {preset.eyebrow}
                          </p>
                          <p className="mt-1 text-sm font-medium text-foreground">{preset.name}</p>
                        </div>
                        <span className="rounded-full border border-border/70 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                          {preset.settings.crush}%
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-6 text-muted-foreground">
                        {preset.description}
                      </p>
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/85 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Manual controls</CardTitle>
                <CardDescription>
                  Make it cleaner, messier, blurrier, or aggressively forum-coded.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ControlSlider
                  label="Crush"
                  hint="How tiny the image gets before we blow it back up."
                  min={4}
                  max={36}
                  suffix="%"
                  value={settings.crush}
                  onValueChange={(value) => updateSetting("crush", value)}
                />
                <ControlSlider
                  label="Blur"
                  hint="A little softness goes a long way."
                  min={0}
                  max={8}
                  step={0.2}
                  value={settings.blur}
                  onValueChange={(value) => updateSetting("blur", value)}
                />
                <ControlSlider
                  label="Upscale"
                  hint="Push the final export larger for extra meme energy."
                  min={100}
                  max={180}
                  suffix="%"
                  value={settings.upscale}
                  onValueChange={(value) => updateSetting("upscale", value)}
                />
                <ControlSlider
                  label="Contrast"
                  hint="Boost it when the image needs more bite."
                  min={70}
                  max={150}
                  suffix="%"
                  value={settings.contrast}
                  onValueChange={(value) => updateSetting("contrast", value)}
                />
                <ControlSlider
                  label="Noise"
                  hint="Adds a dusty low-quality texture to the output."
                  min={0}
                  max={36}
                  value={settings.noise}
                  onValueChange={(value) => updateSetting("noise", value)}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Scaling style</p>
                      <p className="text-xs text-muted-foreground">
                        Pick between crispy pixels or a smoother blur.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
          </div>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/85 shadow-none">
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Preview</CardTitle>
                    <CardDescription>
                      Original on one side, processed output on the other.
                    </CardDescription>
                  </div>
                  <Tabs
                    value={format}
                    onValueChange={(value) => setFormat(value as OutputFormat)}
                    className="w-full sm:w-auto"
                  >
                    <TabsList className="grid w-full grid-cols-3 rounded-full bg-secondary sm:w-[15rem]">
                      {outputFormats.map((item) => (
                        <TabsTrigger key={item.value} value={item.value} className="rounded-full">
                          {item.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-secondary/60">
                    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                      <p className="text-sm font-medium text-foreground">Original</p>
                      {sourceFile ? (
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {sourceFile.type.replace("image/", "")}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex min-h-[20rem] items-center justify-center p-4">
                      {sourceUrl ? (
                        <img
                          src={sourceUrl}
                          alt="Original upload preview"
                          className="max-h-[28rem] w-full rounded-[1.25rem] object-contain"
                        />
                      ) : (
                        <PreviewPlaceholder label="Upload something chaotic." />
                      )}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-secondary/60">
                    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                      <p className="text-sm font-medium text-foreground">Processed</p>
                      {isRendering ? (
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <LoaderCircle className="size-3.5 animate-spin" />
                          rendering
                        </span>
                      ) : result ? (
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {formatBytes(result.bytes)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex min-h-[20rem] items-center justify-center p-4">
                      {result ? (
                        <img
                          src={result.url}
                          alt="Processed upload preview"
                          className="max-h-[28rem] w-full rounded-[1.25rem] object-contain"
                        />
                      ) : (
                        <PreviewPlaceholder label="The processed preview lands here." />
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile
                    label="Active tool"
                    value={
                      activePresetId === "custom"
                        ? "Custom"
                        : presets.find((preset) => preset.id === activePresetId)?.name ?? "Custom"
                    }
                  />
                  <StatTile
                    label="Export size"
                    value={result ? `${result.width} x ${result.height}` : "Waiting"}
                  />
                  <StatTile
                    label="Status"
                    value={error ? "Needs attention" : result ? "Ready to export" : "Idle"}
                  />
                </div>

                {error ? (
                  <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Tabs defaultValue="notes">
              <TabsList className="grid w-full grid-cols-2 rounded-full bg-card/85">
                <TabsTrigger value="notes" className="rounded-full">
                  Notes
                </TabsTrigger>
                <TabsTrigger value="workflow" className="rounded-full">
                  Workflow
                </TabsTrigger>
              </TabsList>
              <TabsContent value="notes">
                <Card className="border-border/70 bg-card/85 shadow-none">
                  <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
                    <InfoTile
                      title="100% client-side"
                      copy="Image data never leaves the tab, which keeps hosting trivial and private."
                    />
                    <InfoTile
                      title="Portfolio-friendly"
                      copy="The UI is minimal by design, so the tool reads polished instead of gimmicky."
                    />
                    <InfoTile
                      title="Responsive"
                      copy="Controls, preview panes, and exports all work cleanly on phones."
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="workflow">
                <Card className="border-border/70 bg-card/85 shadow-none">
                  <CardContent className="space-y-4 pt-6">
                    <WorkflowRow
                      index="01"
                      title="Upload"
                      copy="Choose an image from your device, drag it in, or paste straight from the clipboard."
                    />
                    <WorkflowRow
                      index="02"
                      title="Mess it up"
                      copy="Pick a preset tool and tune the crush, blur, contrast, and noise sliders."
                    />
                    <WorkflowRow
                      index="03"
                      title="Export"
                      copy="Download a JPG, PNG, or WEBP instantly with no backend round-trip."
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </main>
  )
}

function PreviewPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-[1.5rem] border border-dashed border-border/70 bg-background/70 px-6 py-10 text-center">
      <div className="rounded-full border border-border/70 bg-secondary p-3">
        <Sparkles className="size-4" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs leading-6 text-muted-foreground">
        Nothing renders server-side here. Once you upload, the browser does the rest.
      </p>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-border/70 bg-secondary/60 px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function InfoTile({ copy, title }: { copy: string; title: string }) {
  return (
    <div className="rounded-[1.25rem] border border-border/70 bg-secondary/60 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  )
}

function WorkflowRow({
  copy,
  index,
  title,
}: {
  copy: string
  index: string
  title: string
}) {
  return (
    <div className="flex items-start gap-4 rounded-[1.25rem] border border-border/70 bg-secondary/60 p-4">
      <div className="rounded-full border border-border/70 bg-background px-3 py-1 font-mono text-xs text-muted-foreground">
        {index}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
      </div>
    </div>
  )
}

export default App
