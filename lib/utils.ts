import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date for display (Thai locale)
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

// Format timestamp Bangkok time
export function formatTimestamp(): string {
  return new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ISO timestamp for Bangkok
export function nowBangkok(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T') + '+07:00'
}

// Nights between two dates
export function countNights(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn)
  const b = new Date(checkOut)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

// Retention expiry: check_out + 2 years
export function retentionExpiry(checkOut: string): string {
  const d = new Date(checkOut)
  d.setFullYear(d.getFullYear() + 2)
  return d.toISOString()
}

// Compress image before upload
export async function compressImage(file: File): Promise<File> {
  const imageCompression = (await import('browser-image-compression')).default
  return imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  })
}
