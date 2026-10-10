import { useCallback, useLayoutEffect, useRef, useState } from 'react'

interface Layout {
  height: number
  top: number
  narrow: boolean
  imageWidth: number | undefined
  imageHeight: number | undefined
  imageLeft: number
  formTop: number
  fadeStart: number
  imageOverlap: boolean
}

// Artwork shares one continuous position across the form boundary.
export function useLoginLayout(imageSource: string, embeddedViewport?: { width: number; height: number }) {
  const pageRef = useRef<HTMLElement>(null)
  const formWrapRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const measureRef = useRef<() => void>(() => {})
  const [layout, setLayout] = useState<Layout>(() => ({
    height: embeddedViewport?.height ?? window.visualViewport?.height ?? window.innerHeight,
    top: embeddedViewport ? 0 : window.visualViewport?.offsetTop ?? 0,
    narrow: embeddedViewport ? embeddedViewport.width <= 900 : window.matchMedia('(max-width: 900px)').matches,
    imageWidth: undefined,
    imageHeight: undefined,
    imageLeft: 0,
    formTop: 0,
    fadeStart: 0,
    imageOverlap: false,
  }))
  const onImageLoad = useCallback(() => measureRef.current(), [])

  useLayoutEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow
    const bodyOverflow = document.body.style.overflow
    if (!embeddedViewport) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    }
    const viewport = embeddedViewport ? undefined : window.visualViewport
    const measure = () => {
      const height = embeddedViewport?.height ?? viewport?.height ?? window.innerHeight
      const top = viewport?.offsetTop ?? 0
      const width = embeddedViewport?.width ?? (pageRef.current?.getBoundingClientRect().width || window.innerWidth)
      const narrow = width <= 900
      const image = imageRef.current
      const ratio = image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0
        ? image.naturalWidth / image.naturalHeight : null
      let imageWidth: number | undefined = width
      let imageHeight: number | undefined = height
      if (narrow) imageHeight = ratio ? width / ratio : undefined
      else imageWidth = ratio ? height * ratio : undefined
      const wrap = formWrapRef.current
      const content = contentRef.current
      const spacing = wrap ? wrap.ownerDocument.defaultView?.getComputedStyle(wrap) : null
      const padding = spacing ? (parseFloat(spacing.paddingTop) || 0) + (parseFloat(spacing.paddingBottom) || 0) : 0
      const requiredFormHeight = (content?.scrollHeight ?? 0) + padding
      const formTop = narrow ? Math.min(imageHeight ?? 0, Math.max(0, height - requiredFormHeight)) : 0
      const imageLeft = narrow || imageWidth === undefined ? 0 : width / 3 - imageWidth / 2
      const formLeft = width * 1.1 / 2
      const fadeStart = narrow ? formTop : formLeft - imageLeft
      const imageOverlap = narrow
        ? imageHeight !== undefined && imageHeight > formTop
        : imageWidth !== undefined && imageLeft + imageWidth > formLeft
      const next = { height, top, narrow, imageWidth, imageHeight, imageLeft, formTop, fadeStart, imageOverlap }
      setLayout(previous => (Object.keys(next) as (keyof Layout)[]).every(key => previous[key] === next[key]) ? previous : next)
    }
    measureRef.current = measure
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (pageRef.current) observer?.observe(pageRef.current)
    if (contentRef.current) observer?.observe(contentRef.current)
    window.addEventListener('resize', measure)
    viewport?.addEventListener('resize', measure)
    viewport?.addEventListener('scroll', measure)
    measure()
    return () => {
      measureRef.current = () => {}
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      viewport?.removeEventListener('resize', measure)
      viewport?.removeEventListener('scroll', measure)
      if (!embeddedViewport) {
        document.documentElement.style.overflow = htmlOverflow
        document.body.style.overflow = bodyOverflow
      }
    }
  }, [imageSource, embeddedViewport])

  return { pageRef, formWrapRef, contentRef, imageRef, onImageLoad, ...layout }
}
