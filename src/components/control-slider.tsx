import { Slider } from "@/components/ui/slider"

type ControlSliderProps = {
  hint: string
  label: string
  max: number
  min: number
  step?: number
  suffix?: string
  value: number
  onValueChange: (value: number) => void
}

export function ControlSlider({
  hint,
  label,
  max,
  min,
  step = 1,
  suffix = "",
  value,
  onValueChange,
}: ControlSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-full border border-border/70 bg-background px-2.5 py-1 font-mono text-xs text-foreground">
          {value}
          {suffix}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(values) => onValueChange(values[0] ?? value)}
      />
    </div>
  )
}
