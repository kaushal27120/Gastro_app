"use client"

import React, { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/supabase-client'
import { Input } from './ui/input'

type Product = { id: string; name: string; unit?: string; last_price?: number; category?: string }

export default function ProductAutocomplete({ value, onChange, onSelect, className }: {
  value: string
  onChange: (v: string) => void
  onSelect?: (prod: Product) => void
  className?: string
}) {
  const supabase = createClient()
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    if (!query || query.trim().length < 1) { setResults([]); return }
    timer.current = window.setTimeout(async () => {
      const q = query.trim()
      const { data } = await supabase
        .from('inventory_products')
        .select('id,name,unit,last_price,category')
        .ilike('name', `%${q}%`)
        .eq('active', true)
        .limit(8)
      setResults((data as Product[]) || [])
      setOpen(true)
    }, 200)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <div className={`relative ${className || ''}`} ref={rootRef}>
      <Input
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setQuery(e.target.value)
          onChange(e.target.value)
        }}
        className="h-9"
        placeholder="Szukaj produktu..."
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 bg-white border w-full mt-1 max-h-48 overflow-auto shadow-lg rounded">
          {results.map(r => (
            <li
              key={r.id}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => { onSelect?.(r); setQuery(r.name); setOpen(false) }}
            >
              <div className="font-medium text-sm">{r.name}</div>
              <div className="text-xs text-slate-500">
                {r.category || ''}{r.category && r.unit ? ' · ' : ''}{r.unit || ''}
                {r.last_price ? ` · ${r.last_price} zł` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
