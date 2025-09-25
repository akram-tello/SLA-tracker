"use client"

import React from "react"

type LoadingSkeletonProps = {
  className?: string
}

export default function LoadingSkeleton({ className = "" }: LoadingSkeletonProps) {
  return (
    <div className={"animate-pulse rounded bg-gray-200 dark:bg-gray-700 " + className} />
  )
}


