"use client"

import React from "react"

interface OverlayLoaderProps {
  message?: string
}

export default function OverlayLoader({ message = "Updating dashboard..." }: OverlayLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4" role="status" aria-live="polite" aria-busy="true">
        <div className="h-12 w-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
        <p className="text-white text-sm font-medium">{message}</p>
      </div>
    </div>
  )
}
