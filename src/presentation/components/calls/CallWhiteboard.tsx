import React, { useEffect, useRef, useState, useCallback } from 'react'
import { 
  X, Trash2, Eraser, Pen, Square, Circle, 
  ArrowUpRight, StickyNote, Presentation,
  Download, LayoutGrid, Type as TextIcon
} from 'lucide-react'
import { Room, RoomEvent, Participant, DataPacket_Kind } from 'livekit-client'

// --- Types & Constants ---

type WhiteboardElementType = 'stroke' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'sticky'

interface WhiteboardPoint {
  x: number
  y: number
}

interface WhiteboardElement {
  id: string
  sender_id: string
  type: WhiteboardElementType
  color: string
  fill?: string
  stroke_width: number
  created_at: number
  points?: WhiteboardPoint[]
  start?: WhiteboardPoint
  end?: WhiteboardPoint
  position?: WhiteboardPoint
  text?: string
  is_eraser?: boolean
}


type WhiteboardBackground = 'white' | 'transparent' | 'grid' | 'pattern'

interface WhiteboardProps {
  room: Room
  onClose: () => void
  currentUserName: string
  isVisible: boolean
}

const PALETTE = [
  '#FF5252', // Red Accent
  '#FF9800', // Orange
  '#FFEB3B', // Yellow
  '#69F0AE', // Green Accent
  '#40C4FF', // Light Blue Accent
  '#000000', // Black
  '#FFFFFF', // White
]

const PEN_PRESETS = [2, 4, 8]
const ERASER_PRESETS = [12, 22, 36]

// --- Helper Functions ---

const formatColorForWeb = (color: string) => {
  if (!color) return 'rgba(0,0,0,1)'
  if (color.startsWith('#')) {
    if (color.length === 9) {
      // #AARRGGBB -> rgba(r, g, b, a)
      const a = parseInt(color.substring(1, 3), 16) / 255
      const r = parseInt(color.substring(3, 5), 16)
      const g = parseInt(color.substring(5, 7), 16)
      const b = parseInt(color.substring(7, 9), 16)
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`
    } else if (color.length === 7) {
      // #RRGGBB -> rgba(r, g, b, 1)
      const r = parseInt(color.substring(1, 3), 16)
      const g = parseInt(color.substring(3, 5), 16)
      const b = parseInt(color.substring(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, 1)`
    }
  }
  return color
}

const toARGB = (color: string) => {
  if (color.startsWith('#') && color.length === 7) {
    return `#FF${color.substring(1)}`
  }
  return color
}

const generateId = (identity: string) => `${identity}-${Date.now()}`

// --- Component ---

export default function CallWhiteboard({ room, onClose, currentUserName, isVisible }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // State
  const [elements, setElements] = useState<WhiteboardElement[]>([])
  const [tool, setTool] = useState<WhiteboardElementType | 'eraser'>('stroke')
  const [color, setColor] = useState(PALETTE[4]) // Default blue
  const [penWidth, setPenWidth] = useState(4)
  const [eraserWidth, setEraserWidth] = useState(22)
  const [isDrawing, setIsDrawing] = useState(false)
  const [background, setBackground] = useState<WhiteboardBackground>('pattern')
  const [activeTextElement, setActiveTextElement] = useState<{ id: string, type: 'text' | 'sticky', x: number, y: number } | null>(null)
  const [textInput, setTextInput] = useState('')
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null)
  
  const currentLocalElementRef = useRef<WhiteboardElement | null>(null)
  const remoteActiveElementsRef = useRef<Map<string, WhiteboardElement>>(new Map())
  const lastSentAtRef = useRef<number>(0)
  const dragPointerDeltaRef = useRef<{ x: number, y: number } | null>(null)
  const didDragRef = useRef(false)


  // --- Rendering ---

  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: WhiteboardElement, canvasWidth: number, canvasHeight: number) => {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    if (element.type === 'stroke') {
      if (!element.points || element.points.length < 2) return
      ctx.beginPath()
      ctx.strokeStyle = element.is_eraser ? (background === 'white' ? '#FFFFFF' : '#0F121A') : formatColorForWeb(element.color)
      ctx.lineWidth = element.stroke_width
      
      const p1 = element.points[0]
      ctx.moveTo(p1.x * canvasWidth, p1.y * canvasHeight)
      
      for (let i = 1; i < element.points.length; i++) {
        const p = element.points[i]
        ctx.lineTo(p.x * canvasWidth, p.y * canvasHeight)
      }
      ctx.stroke()
    } else if (element.type === 'rectangle') {
      if (!element.start || !element.end) return
      ctx.beginPath()
      ctx.strokeStyle = formatColorForWeb(element.color)
      ctx.lineWidth = element.stroke_width
      const x = element.start.x * canvasWidth
      const y = element.start.y * canvasHeight
      const w = (element.end.x - element.start.x) * canvasWidth
      const h = (element.end.y - element.start.y) * canvasHeight
      ctx.strokeRect(x, y, w, h)
      if (element.fill) {
        ctx.fillStyle = formatColorForWeb(element.fill)
        ctx.fillRect(x, y, w, h)
      }
    } else if (element.type === 'circle') {
      if (!element.start || !element.end) return
      ctx.beginPath()
      ctx.strokeStyle = formatColorForWeb(element.color)
      ctx.lineWidth = element.stroke_width
      const x1 = element.start.x * canvasWidth
      const y1 = element.start.y * canvasHeight
      const x2 = element.end.x * canvasWidth
      const y2 = element.end.y * canvasHeight
      const centerX = (x1 + x2) / 2
      const centerY = (y1 + y2) / 2
      const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.stroke()
      if (element.fill) {
        ctx.fillStyle = formatColorForWeb(element.fill)
        ctx.fill()
      }
    } else if (element.type === 'arrow') {
      if (!element.start || !element.end) return
      const x1 = element.start.x * canvasWidth
      const y1 = element.start.y * canvasHeight
      const x2 = element.end.x * canvasWidth
      const y2 = element.end.y * canvasHeight
      
      ctx.beginPath()
      ctx.strokeStyle = formatColorForWeb(element.color)
      ctx.lineWidth = element.stroke_width
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      
      // Arrow head
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const headLen = 15
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
      ctx.stroke()
    } else if (element.type === 'text' || element.type === 'sticky') {
      if (!element.position || !element.text) return
      const x = element.position.x * canvasWidth
      const y = element.position.y * canvasHeight
      const maxWidth = canvasWidth * 0.5
      
      const isSticky = element.type === 'sticky'
      const fontSize = isSticky ? 16 : 18
      const fontWeight = isSticky ? 500 : 600
      ctx.font = `${fontWeight} ${fontSize}px Inter, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      
      const words = element.text.split(' ')
      const lines: string[] = []
      let currentLine = ''
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      lines.push(currentLine)
      
      const visibleLines = lines.slice(0, 6)
      const lineHeight = fontSize * 1.2
      
      if (isSticky) {
        const pad = 10
        const textWidth = Math.max(...visibleLines.map(l => ctx.measureText(l).width))
        const textHeight = visibleLines.length * lineHeight
        const rectWidth = textWidth + pad * 2
        const rectHeight = textHeight + pad * 2
        
        const radius = 8
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.15)'
        ctx.shadowBlur = 10
        ctx.shadowOffsetY = 4
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + rectWidth - radius, y)
        ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + radius)
        ctx.lineTo(x + rectWidth, y + rectHeight - radius)
        ctx.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - radius, y + rectHeight)
        ctx.lineTo(x + radius, y + rectHeight)
        ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - radius)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.closePath()
        
        ctx.fillStyle = formatColorForWeb(element.fill || '#FFFFF59D')
        ctx.fill()
        ctx.restore()
        
        ctx.fillStyle = 'rgba(26, 26, 26, 1)' 
        visibleLines.forEach((line, i) => {
          ctx.fillText(line, x + pad, y + pad + i * lineHeight)
        })
      } else {
        ctx.fillStyle = formatColorForWeb(element.color)
        visibleLines.forEach((line, i) => {
          ctx.fillText(line, x, y + i * lineHeight)
        })
      }
    }
  }, [background])

  const drawAllWithElements = useCallback((els: WhiteboardElement[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    // Draw background
    if (background === 'transparent') {
      ctx.fillStyle = 'rgba(0,0,0,0)'
    } else {
      ctx.fillStyle = '#FFFFFF'
    }
    ctx.fillRect(0, 0, width, height)

    if (background === 'grid') {
      ctx.strokeStyle = 'rgba(215, 215, 215, 0.5)'
      ctx.lineWidth = 1
      const step = 24
      for (let x = 0; x < width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
      }
    } else if (background === 'pattern') {
      ctx.fillStyle = 'rgba(228, 228, 228, 0.8)'
      const step = 22
      for (let y = 10; y < height; y += step) {
        for (let x = 10; x < width; x += step) {
          ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    // Draw elements
    els.forEach(el => drawElement(ctx, el, width, height))
    
    // Draw remote active
    remoteActiveElementsRef.current.forEach(el => drawElement(ctx, el, width, height))
    
    // Draw local active
    if (currentLocalElementRef.current) {
      drawElement(ctx, currentLocalElementRef.current, width, height)
    }
  }, [background, drawElement])

  const drawAll = useCallback(() => {
    drawAllWithElements(elements)
  }, [elements, drawAllWithElements])

  // Trigger drawAll whenever it changes (due to elements or background updates)
  useEffect(() => {
    drawAll()
  }, [drawAll])

  // --- Synchronization ---

  const publishData = useCallback((data: any, reliable = true, destinationIdentities?: string[]) => {
    const encoder = new TextEncoder()
    const payload = encoder.encode(JSON.stringify(data))
    void room.localParticipant.publishData(payload, {
      reliable,
      topic: 'alem.whiteboard',
      destinationIdentities
    })
  }, [room])

  const sendSnapshot = useCallback((targetIdentity?: string) => {
    const elementsJson = elements.map(el => {
      const elJson: any = {
        id: el.id,
        sender_id: el.sender_id,
        type: el.type,
        color: toARGB(el.color),
        stroke_width: el.stroke_width,
        created_at: el.created_at,
      }
      if (el.fill) elJson.fill = toARGB(el.fill)
      if (el.text) elJson.text = el.text
      if (el.position) elJson.position = { x: el.position.x, y: el.position.y }
      if (el.start) elJson.start = { x: el.start.x, y: el.start.y }
      if (el.end) elJson.end = { x: el.end.x, y: el.end.y }
      if (el.points && el.points.length > 0) {
        elJson.points = el.points.map(p => ({ x: p.x, y: p.y }))
      }
      if (el.is_eraser) elJson.is_eraser = true
      return elJson
    })

    publishData({
      version: '2.0',
      type: 'whiteboard_snapshot',
      sender_id: room.localParticipant.identity,
      payload: {
        elements: elementsJson,
        background,
        brush_config: { pen_width: penWidth, eraser_width: eraserWidth }
      }
    }, true, targetIdentity ? [targetIdentity] : undefined)
  }, [publishData, room.localParticipant.identity, elements, background, penWidth, eraserWidth])

  const broadcastDrawEvent = useCallback((action: 'start' | 'move' | 'end', x: number, y: number, strokeId: string, isEraser = false) => {
    publishData({
      version: '2.0',
      type: 'draw_event',
      sender_id: room.localParticipant.identity,
      payload: {
        action,
        stroke_id: strokeId,
        x,
        y,
        color: toARGB(color),
        stroke_width: isEraser ? eraserWidth : penWidth,
        is_eraser: isEraser,
        is_final: action === 'end'
      }
    }, action !== 'move')
  }, [publishData, room.localParticipant.identity, color, penWidth, eraserWidth])

  const broadcastElementAdd = useCallback((element: WhiteboardElement) => {
    const elJson: any = {
      id: element.id,
      sender_id: element.sender_id,
      type: element.type,
      color: toARGB(element.color),
      stroke_width: element.stroke_width,
      created_at: element.created_at,
    }
    if (element.fill) elJson.fill = toARGB(element.fill)
    if (element.text) elJson.text = element.text
    if (element.position) elJson.position = { x: element.position.x, y: element.position.y }
    if (element.start) elJson.start = { x: element.start.x, y: element.start.y }
    if (element.end) elJson.end = { x: element.end.x, y: element.end.y }
    if (element.points && element.points.length > 0) {
      elJson.points = element.points.map(p => ({ x: p.x, y: p.y }))
    }
    if (element.is_eraser) elJson.is_eraser = true

    publishData({
      version: '2.0',
      type: 'whiteboard_element_add',
      sender_id: room.localParticipant.identity,
      payload: { element: elJson }
    }, true)
  }, [publishData, room.localParticipant.identity])

  const broadcastElementUpdate = useCallback((element: WhiteboardElement) => {
    const elJson: any = {
      id: element.id,
      sender_id: element.sender_id,
      type: element.type,
      color: toARGB(element.color),
      stroke_width: element.stroke_width,
      created_at: element.created_at,
    }
    if (element.fill) elJson.fill = toARGB(element.fill)
    if (element.text) elJson.text = element.text
    if (element.position) elJson.position = { x: element.position.x, y: element.position.y }
    if (element.start) elJson.start = { x: element.start.x, y: element.start.y }
    if (element.end) elJson.end = { x: element.end.x, y: element.end.y }
    if (element.points && element.points.length > 0) {
      elJson.points = element.points.map(p => ({ x: p.x, y: p.y }))
    }
    if (element.is_eraser) elJson.is_eraser = true

    publishData({
      version: '2.0',
      type: 'whiteboard_element_update',
      sender_id: room.localParticipant.identity,
      payload: {
        element_id: element.id,
        element: elJson
      }
    }, true)
  }, [publishData, room.localParticipant.identity])

  const broadcastClearAll = useCallback(() => {
    publishData({
      version: '2.0',
      type: 'draw_event',
      sender_id: room.localParticipant.identity,
      payload: { action: 'clear_all' }
    }, true)
  }, [publishData, room.localParticipant.identity])

  // --- Event Handlers ---

  useEffect(() => {
    const handleData = (payload: Uint8Array, _participant?: Participant, _kind?: DataPacket_Kind, topic?: string) => {
      if (topic !== 'alem.whiteboard') return
      
      try {
        const text = new TextDecoder().decode(payload)
        const data = JSON.parse(text)
        const senderId = data.sender_id
        const type = data.type
        const body = data.payload || {}
        
        if (senderId === room.localParticipant.identity) return

        switch (type) {
          case 'whiteboard_open':
            // Could show a notification or just ensure we're ready
            break
          case 'whiteboard_snapshot_request':
            sendSnapshot(senderId)
            break
          case 'whiteboard_snapshot':
            if (body.elements) setElements(body.elements)
            if (body.background) setBackground(body.background)
            if (body.brush_config) {
              setPenWidth(body.brush_config.pen_width)
              setEraserWidth(body.brush_config.eraser_width)
            }
            break
          case 'draw_event':
            const { action, stroke_id, x, y, is_eraser, color: strokeColor, stroke_width } = body
            if (action === 'clear_all') {
              setElements([])
              remoteActiveElementsRef.current.clear()
            } else if (action === 'start') {
              remoteActiveElementsRef.current.set(stroke_id, {
                id: stroke_id,
                sender_id: senderId,
                type: 'stroke',
                color: strokeColor,
                stroke_width: stroke_width,
                created_at: Date.now(),
                points: [{ x, y }],
                is_eraser: !!is_eraser
              })
            } else if (action === 'move') {
              const el = remoteActiveElementsRef.current.get(stroke_id)
              if (el && el.points) {
                el.points.push({ x, y })
              }
            } else if (action === 'end') {
              const el = remoteActiveElementsRef.current.get(stroke_id)
              if (el) {
                setElements(prev => [...prev, el])
                remoteActiveElementsRef.current.delete(stroke_id)
              }
            }
            break
          case 'whiteboard_element_add':
            if (body.element) {
              setElements(prev => [...prev, body.element])
            }
            break
          case 'whiteboard_element_update':
            if (body.element && body.element_id) {
              setElements(prev => prev.map(e => e.id === body.element_id ? body.element : e))
            }
            break
          case 'whiteboard_element_remove':
            if (body.element_id) {
              setElements(prev => prev.filter(e => e.id !== body.element_id))
            }
            break
          case 'whiteboard_background_change':
            if (body.background) setBackground(body.background)
            break
          case 'whiteboard_brush_config_change':
            if (body.brush_config) {
              setPenWidth(body.brush_config.pen_width)
              setEraserWidth(body.brush_config.eraser_width)
            }
            break
        }
        
        drawAll()
      } catch (e) {
        console.error('Whiteboard sync error:', e)
      }
    }

    room.on(RoomEvent.DataReceived, handleData)
    
    // Request snapshot on mount (passive)
    publishData({ version: '2.0', type: 'whiteboard_snapshot_request', sender_id: room.localParticipant.identity, payload: {} })

    return () => {
      room.off(RoomEvent.DataReceived, handleData)
    }
  }, [room, sendSnapshot, publishData, drawAll])

  // Broadcast "open" only when isVisible becomes true
  useEffect(() => {
    if (isVisible) {
      publishData({ version: '2.0', type: 'whiteboard_open', sender_id: room.localParticipant.identity, payload: {} })
    }
  }, [isVisible, room.localParticipant.identity, publishData])

  // --- Interaction ---

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / canvas.width
    const y = (e.clientY - rect.top) / canvas.height
    
    if (tool === 'text' || tool === 'sticky') {
      // Check for hit on existing text/sticky
      const hit = [...elements].reverse().find(el => {
        if (el.type !== 'text' && el.type !== 'sticky') return false
        if (!el.position || !el.text) return false
        
        // Approximate hit box
        const ex = el.position.x * canvas.width
        const ey = el.position.y * canvas.height
        const isSticky = el.type === 'sticky'
        const ctx = canvas.getContext('2d')
        if (!ctx) return false
        
        ctx.font = isSticky ? '500 16px Inter' : '600 18px Inter'
        const words = el.text.split(' ')
        const maxWidth = canvas.width * 0.5
        let linesCount = 0
        let currentLine = ''
        let maxLineWidth = 0
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          const metrics = ctx.measureText(testLine)
          if (metrics.width > maxWidth && currentLine) {
            maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width)
            linesCount++
            currentLine = word
          } else {
            currentLine = testLine
          }
        }
        linesCount = Math.min(6, linesCount + 1)
        maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width)
        
        const pad = isSticky ? 10 : 0
        const width = maxLineWidth + pad * 2
        const height = linesCount * (isSticky ? 19.2 : 21.6) + pad * 2
        
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        return mx >= ex && mx <= ex + width && my >= ey && my <= ey + height
      })

      if (hit) {
        setDraggingElementId(hit.id)
        dragPointerDeltaRef.current = {
          x: x - (hit.position?.x || 0),
          y: y - (hit.position?.y || 0)
        }
        didDragRef.current = false
        setIsDrawing(true)
        return
      }

      setActiveTextElement({
        id: generateId(room.localParticipant.identity),
        type: tool,
        x: x,
        y: y
      })
      return
    }

    const id = generateId(room.localParticipant.identity)
    const isEraser = tool === 'eraser'
    
    if (tool === 'stroke' || isEraser) {
      currentLocalElementRef.current = {
        id,
        sender_id: room.localParticipant.identity,
        type: 'stroke',
        color: color,
        stroke_width: isEraser ? eraserWidth : penWidth,
        created_at: Date.now(),
        points: [{ x, y }],
        is_eraser: isEraser
      }
      broadcastDrawEvent('start', x, y, id, isEraser)
    } else {
      // Shape
      currentLocalElementRef.current = {
        id,
        sender_id: room.localParticipant.identity,
        type: tool,
        color: color,
        stroke_width: penWidth,
        created_at: Date.now(),
        start: { x, y },
        end: { x, y }
      }
    }
    
    setIsDrawing(true)
    drawAll()
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / canvas.width
    const y = (e.clientY - rect.top) / canvas.height

    if (draggingElementId && dragPointerDeltaRef.current) {
      didDragRef.current = true
      const delta = dragPointerDeltaRef.current
      const nextX = Math.max(0, Math.min(1, x - delta.x))
      const nextY = Math.max(0, Math.min(1, y - delta.y))
      
      setElements(prev => prev.map(el => 
        el.id === draggingElementId 
          ? { ...el, position: { x: nextX, y: nextY } } 
          : el
      ))
      drawAll()
      return
    }

    if (!currentLocalElementRef.current) return
    
    const el = currentLocalElementRef.current
    if (el.type === 'stroke') {
      el.points?.push({ x, y })
      
      const now = Date.now()
      if (now - lastSentAtRef.current > 16) { // Throttle move events to ~60fps
        broadcastDrawEvent('move', x, y, el.id, !!el.is_eraser)
        lastSentAtRef.current = now
      }
    } else {
      // Shape
      el.end = { x, y }
    }
    
    drawAll()
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return
    
    if (draggingElementId) {
      if (didDragRef.current) {
        const dragged = elements.find(el => el.id === draggingElementId)
        if (dragged) broadcastElementUpdate(dragged)
      }
      setDraggingElementId(null)
      dragPointerDeltaRef.current = null
      setIsDrawing(false)
      const canvas = canvasRef.current
      if (canvas) canvas.releasePointerCapture(e.pointerId)
      return
    }

    if (!currentLocalElementRef.current) return
    
    const el = currentLocalElementRef.current
    if (el.type === 'stroke') {
      const lastPoint = el.points![el.points!.length - 1]
      broadcastDrawEvent('end', lastPoint.x, lastPoint.y, el.id, !!el.is_eraser)
    } else {
      // Shape
      broadcastElementAdd(el)
    }
    
    setElements(prev => [...prev, el])
    currentLocalElementRef.current = null
    setIsDrawing(false)
    drawAll()
    
    const canvas = canvasRef.current
    if (canvas) canvas.releasePointerCapture(e.pointerId)
  }

  const handleTextSubmit = (text: string) => {
    if (!activeTextElement) return
    const trimmed = text.trim()
    if (trimmed) {
      const el: WhiteboardElement = {
        id: activeTextElement.id,
        sender_id: room.localParticipant.identity || 'unknown',
        type: activeTextElement.type,
        color: color,
        stroke_width: penWidth,
        created_at: Date.now(),
        position: { x: activeTextElement.x, y: activeTextElement.y },
        text: trimmed,
        fill: activeTextElement.type === 'sticky' ? '#FFFFF59D' : undefined
      }
      setElements(prev => {
        const next = [...prev, el]
        // Trigger draw immediately with the new elements to avoid delay
        setTimeout(() => drawAllWithElements(next), 0)
        return next
      })
      broadcastElementAdd(el)
    }
    setActiveTextElement(null)
    setTextInput('')
  }

  const clearAll = () => {
    if (window.confirm('Очистить всю доску?')) {
      setElements([])
      remoteActiveElementsRef.current.clear()
      broadcastClearAll()
      drawAll()
    }
  }

  const downloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `whiteboard-${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (canvas && container) {
        canvas.width = container.clientWidth
        canvas.height = container.clientHeight
        drawAll()
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawAll])

  // --- UI Components ---

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: '#0F121A',
      display: 'flex',
      flexDirection: 'column',
      color: '#FFFFFF',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Header */}
      <div style={{
        height: 64,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#151924',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            borderRadius: 12, 
            background: 'rgba(48, 136, 255, 0.1)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Presentation size={22} style={{ color: '#3088FF' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Интерактивная доска</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{currentUserName} • LiveKit Sync</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HeaderAction icon={<Download size={19} />} onClick={downloadImage} tooltip="Скачать PNG" />
          <HeaderAction icon={<Trash2 size={19} />} onClick={clearAll} tooltip="Очистить всё" danger />
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.06)', margin: '0 8px' }} />
          <button 
            onClick={onClose} 
            style={{ 
              width: 38, 
              height: 38, 
              borderRadius: 12, 
              background: 'rgba(244, 63, 94, 0.15)', 
              color: '#F43F5E',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(244, 63, 94, 0.25)')}
            onMouseOut={e => (e.currentTarget.style.background = 'rgba(244, 63, 94, 0.15)')}
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: tool === 'stroke' ? 'crosshair' : 'default' }}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none', width: '100%', height: '100%' }}
        />

        {/* Text/Sticky Input Modal */}
        {activeTextElement && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200
          }}>
            <div style={{
              background: '#1C1F26',
              padding: 24,
              borderRadius: 20,
              width: 400,
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                {activeTextElement.type === 'sticky' ? 'Добавить заметку' : 'Добавить текст'}
              </div>
              <textarea
                autoFocus
                placeholder="Введите текст..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                style={{
                  width: '100%',
                  height: 120,
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 12,
                  color: '#FFFFFF',
                  fontSize: 15,
                  resize: 'none',
                  outline: 'none',
                  marginBottom: 16
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleTextSubmit(textInput)
                  }
                  if (e.key === 'Escape') {
                    setActiveTextElement(null)
                    setTextInput('')
                  }
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button 
                  onClick={() => {
                    setActiveTextElement(null)
                    setTextInput('')
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '8px 16px' }}
                >
                  Отмена
                </button>
                <button 
                  onClick={() => handleTextSubmit(textInput)}
                  style={{ background: '#3088FF', border: 'none', color: '#FFFFFF', borderRadius: 10, padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Toolbars */}
        <div style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          pointerEvents: 'none'
        }}>
          {/* Settings Bar */}
          <div style={{
            background: 'rgba(21, 25, 36, 0.85)',
            backdropFilter: 'blur(16px)',
            padding: '6px 12px',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            pointerEvents: 'auto'
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {PALETTE.map(c => (
                <button 
                  key={c} 
                  onClick={() => setColor(c)} 
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    background: c,
                    border: color === c ? '2px solid #3088FF' : '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: color === c ? `0 0 10px ${c}88` : 'none'
                  }} 
                />
              ))}
            </div>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginRight: 4 }}>Толщина</span>
              {(tool === 'eraser' ? ERASER_PRESETS : PEN_PRESETS).map(p => (
                <button
                  key={p}
                  onClick={() => tool === 'eraser' ? setEraserWidth(p) : setPenWidth(p)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: (tool === 'eraser' ? eraserWidth === p : penWidth === p) ? 'rgba(48, 136, 255, 0.2)' : 'transparent',
                    color: (tool === 'eraser' ? eraserWidth === p : penWidth === p) ? '#3088FF' : 'rgba(255,255,255,0.6)',
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <BgButton active={background === 'white'} onClick={() => setBackground('white')} icon={<div style={{ width: 14, height: 14, background: '#FFF', borderRadius: 3 }} />} />
              <BgButton active={background === 'pattern'} onClick={() => setBackground('pattern')} icon={<div style={{ width: 14, height: 14, background: '#FFF', borderRadius: 3, opacity: 0.2, display: 'flex', flexWrap: 'wrap', gap: 2, padding: 2 }}>{[1,2,3,4].map(i=><div key={i} style={{width:2,height:2,background:'#FFF',borderRadius:1}}/>)}</div>} />
              <BgButton active={background === 'grid'} onClick={() => setBackground('grid')} icon={<LayoutGrid size={14} />} />
            </div>
          </div>

          {/* Main Toolbar */}
          <div style={{
            background: 'rgba(21, 25, 36, 0.9)',
            backdropFilter: 'blur(20px)',
            padding: '8px',
            borderRadius: 22,
            display: 'flex',
            gap: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            pointerEvents: 'auto'
          }}>
            <ToolButton active={tool === 'stroke'} onClick={() => setTool('stroke')} icon={<Pen size={20} />} label="Перо" />
            <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={<Eraser size={20} />} label="Ластик" />
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', margin: 'auto 6px' }} />
            <ToolButton active={tool === 'rectangle'} onClick={() => setTool('rectangle')} icon={<Square size={20} />} label="Квадрат" />
            <ToolButton active={tool === 'circle'} onClick={() => setTool('circle')} icon={<Circle size={20} />} label="Круг" />
            <ToolButton active={tool === 'arrow'} onClick={() => setTool('arrow')} icon={<ArrowUpRight size={20} />} label="Стрелка" />
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', margin: 'auto 6px' }} />
            <ToolButton active={tool === 'text'} onClick={() => setTool('text')} icon={<TextIcon size={20} />} label="Текст" />
            <ToolButton active={tool === 'sticky'} onClick={() => setTool('sticky')} icon={<StickyNote size={20} />} label="Заметка" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick} 
      title={label}
      style={{
        width: 48,
        height: 48,
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? '#3088FF' : 'transparent',
        color: active ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative'
      }}
      onMouseOver={e => !active && (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseOut={e => !active && (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {active && (
        <div style={{
          position: 'absolute',
          bottom: -4,
          width: 4,
          height: 4,
          borderRadius: 2,
          background: '#FFF'
        }} />
      )}
    </button>
  )
}

function HeaderAction({ icon, onClick, tooltip, danger }: { icon: React.ReactNode, onClick: () => void, tooltip: string, danger?: boolean }) {
  return (
    <button 
      onClick={onClick}
      title={tooltip}
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        color: danger ? '#F43F5E' : 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }}
      onMouseOver={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
      }}
    >
      {icon}
    </button>
  )
}

function BgButton({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: active ? 'rgba(48, 136, 255, 0.2)' : 'transparent',
        color: active ? '#3088FF' : 'rgba(255,255,255,0.6)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {icon}
    </button>
  )
}
