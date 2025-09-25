"use client"

import React, { useState, useEffect, Suspense, useRef } from "react"
import LoadingSkeleton from "@/components/ui/loading-skeleton"
import { Calendar, Moon, Sun } from "lucide-react"
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context"
import LogoutButton from "@/components/auth/logout-button"
import { Filters } from "@/components/dashboard/filters"
import { FilterFirstScreen } from "@/components/dashboard/filter-first-screen"
import { useTheme } from "next-themes"
import { SLAChart } from "@/components/dashboard/sla-chart"
import SlaBadges from "@/components/dashboard/sla-badges"
import OverlayLoader from "@/components/ui/overlay-loader"

// Local UI primitive for this placeholder layout only
const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = "" }) => (
  <div
    className={
      "rounded-xl shadow-xs " +
      className
    }
  >
    {children}
  </div>
)

// Colors for the inline gauge
const GAUGE_COLORS = {
  onTime: "#10B981",
  atRisk: "#F59E0B",
  breached: "#EF4444",
  track: "#EAEAEA"
}

// Minimal types for Gauge.js to avoid any
type GaugePointerOptions = { length: number; strokeWidth: number; color: string }
type GaugeStaticZone = { strokeStyle: string; min: number; max: number; height?: number }
type GaugeOptions = {
  angle: number
  lineWidth: number
  radiusScale: number
  pointer: GaugePointerOptions
  limitMax: boolean
  limitMin: boolean
  colorStart: string
  colorStop: string
  strokeColor: string
  generateGradient: boolean
  highDpiSupport: boolean
  staticZones: GaugeStaticZone[]
}
type GaugeInstance = {
  maxValue: number
  setMinValue: (n: number) => void
  animationSpeed: number
  set: (n: number) => void
}
type GaugeConstructor = new (canvas: HTMLCanvasElement) => { setOptions: (opts: GaugeOptions) => GaugeInstance }
declare global { interface Window { Gauge?: GaugeConstructor } }

function HeaderTitle() {
  const { filters, filterOptions } = useDashboard()
  const getDynamicTitle = () => {
    const brandCode = filters.brands?.[0]
    const countryCode = filters.countries?.[0]
    const brandName = brandCode ? filterOptions.brands.find(b => b.code === brandCode)?.name : null
    const countryName = brandCode && countryCode ? filterOptions.brandCountries[brandCode]?.find(c => c.code === countryCode)?.name : null

    if (brandName && countryName) return { title: `${brandName} • ${countryName}`, subtitle: 'SLA Performance Dashboard' }
    if (brandName) return { title: `${brandName} Dashboard`, subtitle: 'SLA Performance Tracking' }
    if (countryName) return { title: `${countryName} Operations`, subtitle: 'SLA Performance Dashboard' }
    return { title: 'E-commerce Orders SLA Tracker Dashboard', subtitle: 'Monitor order processing performance' }
  }
  const { title, subtitle } = getDynamicTitle()
  return (
    <div className="flex items-baseline gap-2">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">{title}</h1>
        <p className="text-sm text-gray-600 dark:text-[#B9CAD6] mt-1">{subtitle}</p>
      </div>
    </div>
  )
}

function DashboardContent() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { hasSelectedFilters, filters, navigateToOrders, loading: dashboardLoading, error: dashboardError, dashboardV2Data } = useDashboard()

  // Use centralized v2 data from context
  const summary = dashboardV2Data

  // Overlay with display time
  const [overlayVisible, setOverlayVisible] = useState(false)
  const overlayStartRef = useRef<number | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const MIN_OVERLAY_TIME = 2000;

  useEffect(() => {
    if (!hasSelectedFilters) return;
  
    if (dashboardLoading) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      if (!overlayVisible) {
        overlayStartRef.current = Date.now();
        setOverlayVisible(true);
      }
    } else {
      const startedAt = overlayStartRef.current;
      if (startedAt == null) {
        setOverlayVisible(false);
        return;
      }
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_OVERLAY_TIME - elapsed);
      hideTimeoutRef.current = setTimeout(() => {
        setOverlayVisible(false);
        hideTimeoutRef.current = null;
      }, remaining);
    }
  
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [dashboardLoading, hasSelectedFilters, overlayVisible]);
  

  // Local UI helpers brought from former components
  const Pill: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className }) => (
    <span className={"inline-flex items-center rounded-full bg-gray-900/80 dark:bg-black/80 px-3 py-1 text-xs font-semibold tracking-wide text-white " + (className || "")}>{children}</span>
  )

  function VerticalLabel({ text, color }: { text: string; color?: string }) {
    const normalized = (text || "").toUpperCase()
    const resolvedColor = color
      ?? (normalized === 'CRITICAL' ? '#FF5A5F'
      : normalized === 'URGENT' ? '#FF6F3D'
      : normalized === 'RISK' ? '#F59E0B'
      : '#10B981')
    return (
      <div className="hidden sm:flex items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-2">
          <span className="relative flex size-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: resolvedColor }}></span>
            <span className="relative inline-flex size-4 rounded-full" style={{ backgroundColor: resolvedColor }}></span>
          </span>
          <div className="text-gray-700 dark:text-[#B9CAD6] text-xl font-extrabold tracking-widest" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            {text}
          </div>
        </div>
      </div>
    )
  }

  // Gauge.js using completion_rate from v2 summary
  const Gauge: React.FC<{ value: number }> = ({ value }) => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
    const gaugeRef = React.useRef<GaugeInstance | null>(null)
    const clamped = Math.max(0, Math.min(100, Number(value) || 0))

    useEffect(() => {
      const ensureGaugeJs = async () => {
        if (typeof window !== 'undefined' && window.Gauge) return
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://bernii.github.io/gauge.js/dist/gauge.min.js'
          script.async = true
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Gauge.js'))
          document.body.appendChild(script)
        })
      }

      const setCanvasSize = () => {
        if (!canvasRef.current) return
        const parent = canvasRef.current.parentElement
        if (!parent) return
        const rect = parent.getBoundingClientRect()
        canvasRef.current.setAttribute('width', String(Math.floor(rect.width)))
        canvasRef.current.setAttribute('height', String(Math.floor(rect.height)))
      }

      const init = async () => {
        await ensureGaugeJs()
        if (!canvasRef.current || !window.Gauge) return
        setCanvasSize()
        const opts = {
          angle: 0,
          lineWidth: 0.22,
          radiusScale: 1.0,
          pointer: { length: 0.6, strokeWidth: 0.035, color: theme === "dark" ? '#FFFFFF' : '#000000' },
          limitMax: true,
          limitMin: true,
          colorStart: GAUGE_COLORS.onTime,
          colorStop: GAUGE_COLORS.breached,
          strokeColor: '#2E3A46',
          generateGradient: false,
          highDpiSupport: true,
          staticZones: [
            { strokeStyle: GAUGE_COLORS.breached, min: 0, max: 70 },
            { strokeStyle: GAUGE_COLORS.atRisk, min: 70, max: 90 },
            { strokeStyle: GAUGE_COLORS.onTime, min: 90, max: 100 }
          ]
        }
        const GaugeCtor = window.Gauge!
        gaugeRef.current = new GaugeCtor(canvasRef.current).setOptions(opts)
        gaugeRef.current.maxValue = 100
        gaugeRef.current.setMinValue(0)
        gaugeRef.current.animationSpeed = 50
        gaugeRef.current.set(clamped)

        // Handle resize: reinitialize gauge to fit new size
        const onResize = () => {
          setCanvasSize()
          if (!canvasRef.current) return
          gaugeRef.current = new GaugeCtor(canvasRef.current).setOptions(opts)
          gaugeRef.current.maxValue = 100
          gaugeRef.current.setMinValue(0)
          gaugeRef.current.animationSpeed = 320
          gaugeRef.current.set(clamped)
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }

      const cleanupPromise = init()
      return () => {
        gaugeRef.current = null
        void cleanupPromise
      }
    }, [clamped])

    useEffect(() => {
      if (gaugeRef.current) {
        gaugeRef.current.set(clamped)
      }
    }, [clamped])

    return (
      <div className="w-full h-[320px] sm:h-[200px]">
        <div className="flex items-end justify-between px-2">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">Completion Rate</div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{clamped.toFixed(1)}%</div>
        </div>
        <div className="mt-2 h-[calc(90%-1rem)]">
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', maxWidth: '100%' }} />
        </div>
        <div className="mt-2 text-l text-gray-600 dark:text-[#B9CAD6] flex items-center gap-3 px-2">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#10B981' }}></span>Good</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#F59E0B' }}></span>Average</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#EF4444' }}></span>Poor</span>
        </div>
      </div>
    )
  }

  const criticalNotProcessed = summary?.stage_breakdown?.find(s => s.stage === 'Not Processed')?.critical ?? 0
  const criticalProcessed = summary?.stage_breakdown?.find(s => s.stage === 'Processed')?.critical ?? 0
  const criticalShipped = summary?.stage_breakdown?.find(s => s.stage === 'Shipped')?.critical ?? 0
  const urgentNotProcessed = summary?.stage_breakdown?.find(s => s.stage === 'Not Processed')?.urgent ?? 0
  const urgentProcessed = summary?.stage_breakdown?.find(s => s.stage === 'Processed')?.urgent ?? 0
  const urgentShipped = summary?.stage_breakdown?.find(s => s.stage === 'Shipped')?.urgent ?? 0
  const riskNotProcessed = summary?.stage_breakdown?.find(s => s.stage === 'Not Processed')?.on_risk ?? 0
  const riskProcessed = summary?.stage_breakdown?.find(s => s.stage === 'Processed')?.on_risk ?? 0
  const riskShipped = summary?.stage_breakdown?.find(s => s.stage === 'Shipped')?.on_risk ?? 0

  return (
    <>
      {!hasSelectedFilters ? (
        <FilterFirstScreen />
      ) : (
      <div className="h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-black text-gray-900 dark:text-white flex flex-col transition-colors duration-200">
        {overlayVisible && <OverlayLoader message="Updating dashboard..." />}
        {/* Header (full width, no container) */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <HeaderTitle />
            <div className="flex items-center gap-3">
              <div className="hidden md:block w-[460px]">
                <Filters />
              </div>
              <button
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="p-3 rounded-xl border border-gray-200 dark:border-[#2E3A46] bg-white/80 dark:bg-[#1B2A36] text-gray-700 dark:text-white hover:bg-white dark:hover:bg-[#243344] backdrop-blur-sm transition-all duration-200"
                aria-label="Toggle theme"
                suppressHydrationWarning
              >
                {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <LogoutButton />
            </div>
          </div>

          {/* SLA badges */}
          <SlaBadges />
          <div className="flex items-center gap-2 text-gray-600 dark:text-[#B9CAD6] text-sm mt-4">
                <Calendar className="h-5 w-5" />
                <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
        </div>
        

        {/* Content Grid viewport height on fullscreen mode*/}
        <div className="flex-1 px-6 pb-6">
          {dashboardLoading ? (
            <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-4 overflow-auto pr-1">
                <Card className="bg-white/60 dark:bg-black backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-0 shadow-sm"><div className="p-12"><LoadingSkeleton className="h-16 w-full rounded" /></div></Card>
                <Card className="bg-white/60 dark:bg-black backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-0 shadow-sm"><div className="p-12"><LoadingSkeleton className="h-16 w-full rounded" /></div></Card>
                <Card className="bg-white/60 dark:bg-black backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-0 shadow-sm"><div className="p-12"><LoadingSkeleton className="h-16 w-full rounded" /></div></Card>
              </div>
              <div className="lg:col-span-4 space-y-4 overflow-auto pl-1">
                <div className="grid grid-cols-3 gap-4">
                  <LoadingSkeleton className="h-24 w-full rounded-xl" />
                  <LoadingSkeleton className="h-24 w-full rounded-xl col-span-2" />
                  <LoadingSkeleton className="h-24 w-full rounded-xl" />
                  <LoadingSkeleton className="h-24 w-full rounded-xl" />
                  <LoadingSkeleton className="h-24 w-full rounded-xl" />
                </div>
                <Card className="bg-white/60 dark:bg-black backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-0 shadow-sm">
                  <div className="origin-top scale-[0.8] pt-10">
                    <LoadingSkeleton className="w-full h-[200px] rounded-xl" />
                    <div className="mt-3 flex items-center gap-2 p-4">
                      <LoadingSkeleton className="h-3 w-20 rounded" />
                      <LoadingSkeleton className="h-3 w-16 rounded" />
                      <LoadingSkeleton className="h-3 w-12 rounded" />
                    </div>
                  </div>
                </Card>
                <Card className="bg-white/60 dark:bg-black backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-0 shadow-sm">
                  <div className="origin-top scale-[0.95]"><LoadingSkeleton className="w-full h-[600px] rounded-xl" /></div>
                </Card>
              </div>
            </div>
          ) : dashboardError ? (
            <div className="text-sm text-red-500">Failed to load dashboard data</div>
          ) : (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Stack (inline) */}
              <div className="lg:col-span-8 space-y-4 overflow-auto pr-1">
                <Card className="p-0 border border-red-500 dark:border-[#fc343e] bg-red-50/80 dark:bg-[#c0262641] backdrop-blur-sm">
                  <div className="grid grid-cols-12">
                    <div className="col-span-1 flex items-center justify-center bg-red-100 dark:bg-[#5a272f] rounded-l-xl">
                      <VerticalLabel text="CRITICAL" />
                    </div>
                    <div className="col-span-11 grid grid-cols-1 sm:grid-cols-3 gap-4 p-12">
                      <Card className="p-1 h-full cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors" >
                        <div className="flex flex-col items-center text-center gap-3" onClick={() => navigateToOrders({ stage: 'Not Processed', severity: 'Critical', from_date: filters.from_date, to_date: filters.to_date })}>
                          <Pill>Pending OMS Sync</Pill>
                          <div className="text-[3.5rem] md:text-[4rem] lg:text-[5rem] leading-none font-extrabold tracking-tight text-gray-900 dark:text-white">{criticalNotProcessed.toLocaleString()}</div>
                          <div className="text-sm font-medium text-gray-600 dark:text-[#B9CAD6]">Over 60 minutes</div>
                        </div>
                      </Card>
                      <Card className="p-1 h-full cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors" >
                        <div className="flex flex-col items-center text-center gap-3" onClick={() => navigateToOrders({ stage: 'Processed', severity: 'Critical', from_date: filters.from_date, to_date: filters.to_date })}>
                          <Pill>Pending Shipment</Pill>
                          <div className="text-[3.5rem] md:text-[4rem] lg:text-[5rem] leading-none font-extrabold tracking-tight text-gray-900 dark:text-white">{criticalProcessed.toLocaleString()}</div>
                          <div className="text-sm font-medium text-gray-600 dark:text-[#B9CAD6]">Over 6 Days</div>
                        </div>
                      </Card>
                      <Card className="p-1 h-full cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors" >
                        <div className="flex flex-col items-center text-center gap-3" onClick={() => navigateToOrders({ stage: 'Shipped', severity: 'Critical', from_date: filters.from_date, to_date: filters.to_date })}>
                          <Pill>Pending Delivery</Pill>
                          <div className="text-[3.5rem] md:text-[4rem] lg:text-[5rem] leading-none font-extrabold tracking-tight text-gray-900 dark:text-white">{criticalShipped.toLocaleString()}</div>
                          <div className="text-sm font-medium text-gray-600 dark:text-[#B9CAD6]">Over 14 Days</div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </Card>

                <Card className="p-0 border border-orange-500 dark:border-[#fa6f3c] bg-orange-50/80 dark:bg-[#f9611620] backdrop-blur-sm">
                  <div className="grid grid-cols-12">
                    <div className="col-span-1 flex items-center justify-center bg-orange-100 dark:bg-[#462627] rounded-l-xl">
                      <VerticalLabel text="URGENT" />
                    </div>
                    <div className="col-span-11 grid grid-cols-1 sm:grid-cols-3 gap-4 p-12">
                      <Card className="p-1 h-full cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors" >
                        <div className="flex flex-col items-center text-center gap-3" onClick={() => navigateToOrders({ stage: 'Not Processed', severity: 'Urgent', from_date: filters.from_date, to_date: filters.to_date })}>
                          <Pill>Pending OMS Sync</Pill>
                          <div className="text-[96px] leading-none font-extrabold tracking-tight text-gray-900 dark:text-white">{urgentNotProcessed.toLocaleString()}</div>
                          <div className="text-sm font-medium text-gray-600 dark:text-[#B9CAD6]">Over 30 minutes</div>
                        </div>
                      </Card>
                      <Card className="p-1 h-full cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors" >
                        <div className="flex flex-col items-center text-center gap-3" onClick={() => navigateToOrders({ stage: 'Processed', severity: 'Urgent', from_date: filters.from_date, to_date: filters.to_date })}>
                          <Pill>Pending Shipment</Pill>
                          <div className="text-[96px] leading-none font-extrabold tracking-tight text-gray-900 dark:text-white">{urgentProcessed.toLocaleString()}</div>
                          <div className="text-sm font-medium text-gray-600 dark:text-[#B9CAD6]">Over 3 Days</div>
                        </div>
                      </Card>
                      <Card className="p-1 h-full cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors" >
                        <div className="flex flex-col items-center text-center gap-3" onClick={() => navigateToOrders({ stage: 'Shipped', severity: 'Urgent', from_date: filters.from_date, to_date: filters.to_date })}>
                          <Pill>Pending Delivery</Pill>
                          <div className="text-[96px] leading-none font-extrabold tracking-tight text-gray-900 dark:text-white">{urgentShipped.toLocaleString()}</div>
                          <div className="text-sm font-medium text-gray-600 dark:text-[#B9CAD6]">Over 7 Days</div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </Card>

                <Card className="p-0 border border-yellow-500 dark:border-[#f69f0b] bg-yellow-50/80 dark:bg-[#f9bf2b22] backdrop-blur-sm">
                  <div className="grid grid-cols-12">
                    <div className="col-span-1 flex items-center justify-center bg-yellow-100 dark:bg-[#362721] rounded-l-xl">
                      <VerticalLabel text="RISK" />
                    </div>
                    <div className="col-span-11 grid grid-cols-1 sm:grid-cols-3 gap-4 p-12">
                      <Card className="p-1 h-full cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors" >
                        <div className="flex flex-col items-center text-center gap-3" onClick={() => navigateToOrders({ stage: 'Not Processed', sla_status: 'At Risk', from_date: filters.from_date, to_date: filters.to_date })}>
                          <Pill>Pending OMS Sync</Pill>
                          <div className="text-[96px] leading-none font-extrabold tracking-tight text-gray-900 dark:text-white">{riskNotProcessed.toLocaleString()}</div>
                          <div className="text-sm font-medium text-gray-600 dark:text-[#B9CAD6]">Over 24 minutes</div>
                        </div>
                      </Card>
                      <Card className="p-1 h-full cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors" >
                        <div className="flex flex-col items-center text-center gap-3" onClick={() => navigateToOrders({ stage: 'Processed', sla_status: 'At Risk', from_date: filters.from_date, to_date: filters.to_date })}>
                          <Pill>Pending Shipment</Pill>
                          <div className="text-[96px] leading-none font-extrabold tracking-tight text-gray-900 dark:text-white">{riskProcessed.toLocaleString()}</div>
                          <div className="text-sm font-medium text-gray-600 dark:text-[#B9CAD6]">Over 2 Days</div>
                        </div>
                      </Card>
                      <Card className="p-1 h-full cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors" >
                        <div className="flex flex-col items-center text-center gap-3" onClick={() => navigateToOrders({ stage: 'Shipped', sla_status: 'At Risk', from_date: filters.from_date, to_date: filters.to_date })}>
                          <Pill>Pending Delivery</Pill>
                          <div className="text-[96px] leading-none font-extrabold tracking-tight text-gray-900 dark:text-white">{riskShipped.toLocaleString()}</div>
                          <div className="text-sm font-medium text-gray-600 dark:text-[#B9CAD6]">Over 4 Days</div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </Card>
              </div>

            {/* Right stack */}
            <div className="lg:col-span-4 space-y-4 overflow-auto pl-1">
                {/* Top KPI cards (inline) */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div
                      className="cursor-pointer hover:bg-white/5 transition-colors rounded-lg -m-6 p-6"
                      onClick={() => navigateToOrders({ from_date: filters.from_date, to_date: filters.to_date })}
                    >
                      <div className="text-sm text-gray-600 dark:text-[#B9CAD6] font-semibold">Placed</div>
                      <div className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{(summary?.kpis.placed_orders ?? 0).toLocaleString()}</div>
                    </div>
                  </Card>
                  <Card className="col-span-2 p-0 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="rounded-lg -m-6 p-6">
                      <div className="mt-3 flex items-stretch">
                        <div
                          className="flex-1 p-4 text-center cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5"
                          onClick={() => navigateToOrders({ fulfilment_status: 'fulfilled', sla_status: 'On Time', from_date: filters.from_date, to_date: filters.to_date })}
                        >
                          <div className="text-xs text-gray-600 dark:text-[#B9CAD6] font-semibold">Fulfilled - On Time</div>
                          <div className="mt-1 text-3xl font-extrabold text-[#45C394]">
                            {(summary?.kpis.fulfilled_orders ?? 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="w-px self-stretch bg-gray-200 dark:bg-gray-700"></div>
                        <div
                          className="flex-1 p-4 text-center cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5"
                          onClick={() => navigateToOrders({ fulfilment_status: 'fulfilled', sla_status: 'Breached', from_date: filters.from_date, to_date: filters.to_date })}
                        >
                          <div className="text-xs text-gray-600 dark:text-[#B9CAD6] font-semibold">Fulfilled - Breached</div>
                          <div className="mt-1 text-3xl font-extrabold text-[#FF5A5F]">
                            {(summary?.kpis.fulfilled_breached_orders ?? 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div
                      className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors rounded-lg -m-6 p-6"
                      onClick={() => navigateToOrders({ severity: 'Critical', from_date: filters.from_date, to_date: filters.to_date })}
                    >
                      <div className="text-sm text-gray-600 dark:text-[#B9CAD6] font-semibold">Critical - P0</div>
                      <div className="mt-2 text-3xl font-extrabold text-[#FF5A5F]">{(summary?.kpis.total_critical_orders ?? 0).toLocaleString()}</div>
                    </div>
                  </Card>
                  <Card className="p-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div
                      className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors rounded-lg -m-6 p-6"
                      onClick={() => navigateToOrders({ severity: 'Urgent', from_date: filters.from_date, to_date: filters.to_date })}
                    >
                      <div className="text-sm text-gray-600 dark:text-[#B9CAD6] font-semibold">Urgent - P1</div>
                      <div className="mt-2 text-3xl font-extrabold text-[#FF6F3D]">{(summary?.kpis.total_urgent_orders ?? 0).toLocaleString()}</div>
                    </div>
                  </Card>
                  <Card className="p-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div
                      className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors rounded-lg -m-6 p-6"
                      onClick={() => navigateToOrders({ sla_status: 'At Risk', pending_status: 'pending', from_date: filters.from_date, to_date: filters.to_date })}
                    >
                      <div className="text-sm text-gray-600 dark:text-[#B9CAD6] font-semibold">At Risk</div>
                      <div className="mt-2 text-3xl font-extrabold text-[#F59E0B]">{(summary?.kpis.at_risk_orders ?? 0).toLocaleString()}</div>
                    </div>
                  </Card>
                </div>

                {/* Donut/Gauge using fulfillment_rate */}
              <Card className="bg-white/60 dark:bg-black backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-0 shadow-sm">
                  <div className="origin-top scale-[0.82] pt-8"><Gauge value={summary?.kpis.fulfillment_rate ?? 0} /></div>
              </Card>

              {/* Gauge.js SLA chart */}
              <Card className="bg-white/60 dark:bg-black backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-0 shadow-sm">
                <div className="origin-top scale-[0.99]"><SLAChart /></div>
              </Card>
            </div>
          </div>
          )}
        </div>
      </div>
      )}
    </>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-black text-gray-900 dark:text-white flex items-center justify-center transition-colors duration-200">
        <div className="w-full max-w-5xl px-6">
          <LoadingSkeleton className="h-8 w-80 rounded mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <LoadingSkeleton className="h-40 w-full rounded-xl" />
              <LoadingSkeleton className="h-40 w-full rounded-xl" />
              <LoadingSkeleton className="h-40 w-full rounded-xl" />
            </div>
            <div className="lg:col-span-4 space-y-4">
              <LoadingSkeleton className="h-24 w-full rounded-xl" />
              <LoadingSkeleton className="h-72 w-full rounded-xl" />
              <LoadingSkeleton className="h-72 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    }>
      <DashboardProvider>
        <DashboardContent />
      </DashboardProvider>
    </Suspense>
  )
}


