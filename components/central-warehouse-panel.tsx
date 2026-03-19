'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Plus, Send, CheckCircle2, Truck, Loader2 } from 'lucide-react'

interface StockItem {
  id: string
  ingredient: string
  category: string
  onHand: number
  reserved: number
  available: number
  minThreshold: number
  unit: string
  value: number
}

interface TransferItem {
  ingredient_id: string
  quantity: number
}

interface DeliveryItem {
  ingredient_id: string
  quantity_ordered: number
  quantity_received: number
  expiry_date?: string | null
}

interface WarehousePanelProps {
  warehouseName?: string
  companyId?: string | null
}

export function CentralWarehousePanel({
  warehouseName = 'Magazyn Główny',
  companyId,
}: WarehousePanelProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('stock')
  const [showDeliveryForm, setShowDeliveryForm] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [selectedDestination, setSelectedDestination] = useState('')
  const [transferItems, setTransferItems] = useState<TransferItem[]>([])
  const [stockData, setStockData] = useState<StockItem[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [discrepancies, setDiscrepancies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ingredients, setIngredients] = useState<any[]>([])
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([])
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const [newDelivery, setNewDelivery] = useState({
    supplier_name: '',
    invoiceNumber: '',
    invoiceDate: '',
    totalAmount: '',
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      let { data: warehouses } = await supabase
        .from('warehouse_central')
        .select('*')
        .eq('name', warehouseName)
        .limit(1)

      let warehouse_id = warehouses?.[0]?.id

      if (!warehouse_id) {
        const { data: newWarehouse, error: whError } = await supabase
          .from('warehouse_central')
          .insert({ name: warehouseName, address: '', active: true })
          .select()
        if (whError) throw whError
        warehouse_id = newWarehouse?.[0]?.id
      }

      if (warehouse_id) setWarehouseId(warehouse_id)

      const { data: ingData } = await supabase.from('ingredients').select('*').order('name')
      if (ingData) setIngredients(ingData)
      const { data: prodData } = await supabase.from('inventory_products').select('*').order('name')

      if (companyId) {
        const { data: locData } = await supabase
          .from('locations')
          .select('*')
          .eq('company_id', companyId)
          .order('name')
        if (locData) setLocations(locData)
      } else {
        const { data: locData } = await supabase.from('locations').select('*').order('name')
        if (locData) setLocations(locData)
      }

      const stockMap = new Map<string, StockItem>()
      if (ingData) {
        ingData.forEach((ing: any) => {
          stockMap.set(`ing_${ing.id}`, {
            id: ing.id,
            ingredient: ing.name,
            category: ing.category || 'Inne',
            onHand: 0,
            reserved: 0,
            available: 0,
            minThreshold: ing.min_threshold || 0,
            unit: ing.unit || 'kg',
            value: 0,
          })
        })
      }
      if (prodData) {
        prodData.forEach((prod: any) => {
          stockMap.set(`prod_${prod.id}`, {
            id: prod.id,
            ingredient: prod.name,
            category: prod.category || 'Produkty',
            onHand: 0,
            reserved: 0,
            available: 0,
            minThreshold: 0,
            unit: prod.unit || 'szt',
            value: 0,
          })
        })
      }

      const { data: txData } = await supabase
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false })

      if (txData) {
        const ingQtySums = new Map<string, number>()
        const prodQtySums = new Map<string, number>()
        txData.forEach((tx: any) => {
          const change = tx.tx_type === 'invoice_in' ? tx.quantity : -tx.quantity
          if (tx.ingredient_id) {
            ingQtySums.set(tx.ingredient_id, (ingQtySums.get(tx.ingredient_id) || 0) + change)
          }
          if (tx.product_id) {
            prodQtySums.set(tx.product_id, (prodQtySums.get(tx.product_id) || 0) + change)
          }
        })
        ingQtySums.forEach((qty, ingId) => {
          const item = stockMap.get(`ing_${ingId}`)
          if (item) { item.onHand = qty; item.available = qty - item.reserved }
        })
        prodQtySums.forEach((qty, prodId) => {
          const item = stockMap.get(`prod_${prodId}`)
          if (item) { item.onHand = qty; item.available = qty - item.reserved }
        })
      }

      setStockData(Array.from(stockMap.values()))
      setTransfers([])

      const { data: deliveryData } = await supabase
        .from('warehouse_deliveries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (deliveryData) setDeliveries(deliveryData)
    } catch (err) {
      console.error('Error fetching warehouse data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDeliveryItem = () => {
    setDeliveryItems([...deliveryItems, { ingredient_id: '', quantity_ordered: 0, quantity_received: 0, expiry_date: null }])
  }

  const handleRemoveDeliveryItem = (index: number) => {
    setDeliveryItems(deliveryItems.filter((_, i) => i !== index))
  }

  const updateDeliveryItem = (index: number, field: string, value: any) => {
    const updated = [...deliveryItems]
    ;(updated[index] as any)[field] = value
    setDeliveryItems(updated)
  }

  const handleSaveDelivery = async () => {
    if (!newDelivery.supplier_name || !newDelivery.invoiceNumber) {
      alert('Podaj dostawcę i numer faktury')
      return
    }
    if (deliveryItems.length === 0) {
      alert('Dodaj co najmniej jeden produkt')
      return
    }
    if (!warehouseId) {
      alert('Warehouse not initialized')
      return
    }

    setSaving(true)
    try {
      const { data: created, error: deliveryError } = await supabase
        .from('warehouse_deliveries')
        .insert({
          warehouse_id: warehouseId,
          supplier_name: newDelivery.supplier_name,
          invoice_number: newDelivery.invoiceNumber,
          invoice_date: newDelivery.invoiceDate || null,
          total_amount: Number(newDelivery.totalAmount) || 0,
          notes: newDelivery.notes || null,
          status: 'received',
        })
        .select()

      if (deliveryError) throw deliveryError

      if (created && created[0]) {
        const deliveryId = created[0].id
        for (const item of deliveryItems) {
          const ingredient = ingredients.find(i => i.id === item.ingredient_id)
          if (!ingredient) continue

          const { error: itemError } = await supabase.from('warehouse_delivery_items').insert({
            delivery_id: deliveryId,
            ingredient_id: item.ingredient_id,
            quantity_ordered: item.quantity_ordered,
            quantity_received: item.quantity_received || 0,
            unit: ingredient.unit || 'kg',
            unit_price: ingredient.last_price || 0,
            expiry_date: item.expiry_date || null,
          })
          if (itemError) throw itemError

          const { error: txError } = await supabase.from('inventory_transactions').insert({
            ingredient_id: item.ingredient_id,
            quantity: item.quantity_received || 0,
            unit: ingredient.unit || 'kg',
            tx_type: 'invoice_in',
            reference: newDelivery.invoiceNumber,
            reason: `Delivery from ${newDelivery.supplier_name}`,
          })
          if (txError) throw txError
        }
      }

      alert('Dostawa zapisana')
      setNewDelivery({ supplier_name: '', invoiceNumber: '', invoiceDate: '', totalAmount: '', notes: '' })
      setDeliveryItems([])
      setShowDeliveryForm(false)
      fetchData()
    } catch (err: any) {
      console.error('Error:', err)
      alert('Błąd: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTransferItem = (ingredient: any) => {
    if (!transferItems.find(t => t.ingredient_id === ingredient.id)) {
      transferItems.push({ ingredient_id: ingredient.id, quantity: 0 })
      setTransferItems([...transferItems])
    }
  }

  const handleRemoveTransferItem = (ingredientId: string) => {
    setTransferItems(transferItems.filter(t => t.ingredient_id !== ingredientId))
  }

  const updateTransferQuantity = (ingredientId: string, quantity: number) => {
    setTransferItems(transferItems.map(t => t.ingredient_id === ingredientId ? { ...t, quantity } : t))
  }

  const handleSaveTransfer = async () => {
    if (!selectedDestination || transferItems.length === 0) {
      alert('Wybierz lokalizację i produkty')
      return
    }
    if (!warehouseId) {
      alert('Warehouse not initialized')
      return
    }

    setSaving(true)
    try {
      const { data: created, error: transferError } = await supabase
        .from('warehouse_transfers')
        .insert({ warehouse_id: warehouseId, location_id: selectedDestination, status: 'pending', created_by: null })
        .select()

      if (transferError) throw transferError

      if (created && created[0]) {
        const transferId = created[0].id
        for (const item of transferItems) {
          await supabase.from('warehouse_transfer_items').insert({
            transfer_id: transferId,
            ingredient_id: item.ingredient_id,
            quantity_ordered: item.quantity,
            quantity_received: 0,
          })
          const stock = stockData.find(s => s.id === item.ingredient_id)
          if (stock) {
            await supabase
              .from('ingredients')
              .update({ reserved_qty: (stock.reserved + item.quantity) })
              .eq('id', item.ingredient_id)
          }
        }
      }

      alert('Transfer utworzony')
      setSelectedDestination('')
      setTransferItems([])
      setShowTransferForm(false)
      fetchData()
    } catch (err: any) {
      console.error('Error:', err)
      alert('Błąd: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const markDiscrepancyResolved = async (id: string) => {
    try {
      alert('Rozbieżność rozwiązana')
      fetchData()
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const statusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-[#FFFBEB] text-[#D97706] border-[#F59E0B]',
      in_transit: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
      received: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
      draft: 'bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB]',
      pending_review: 'bg-[#FFF7ED] text-[#EA580C] border-[#FDBA74]',
      resolved: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
    }
    return colors[status] || 'bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB]'
  }

  const statusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      pending: 'Oczekuje',
      in_transit: 'W trasie',
      received: 'Odebrane',
      draft: 'Szkic',
      pending_review: 'Do weryfikacji',
      resolved: 'Rozwiązane',
    }
    return labels[status] || status
  }

  const lowStockItems = stockData.filter(item => item.onHand < item.minThreshold)
  const totalValue = stockData.reduce((sum, item) => sum + item.value, 0)
  const itemsInTransfer = transfers.filter(t => t.status !== 'received').length
  const activeDiscrepancies = discrepancies.filter(d => !d.resolved).length

  if (loading) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-lg flex items-center justify-center py-12 text-[13px] text-[#6B7280]">
        <Loader2 className="animate-spin mr-2 w-4 h-4" /> Wczytywanie danych magazynu...
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-[#E5E7EB] mb-5">
          <TabsList className="h-9 bg-transparent p-0 gap-1">
            <TabsTrigger value="stock" className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=inactive]:text-[#6B7280]">Stan</TabsTrigger>
            <TabsTrigger value="deliveries" className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=inactive]:text-[#6B7280]">Dostawy</TabsTrigger>
            <TabsTrigger value="transfers" className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=inactive]:text-[#6B7280]">Przesyłki</TabsTrigger>
            <TabsTrigger value="discrepancies" className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=inactive]:text-[#6B7280]">Problemy ({activeDiscrepancies})</TabsTrigger>
            <TabsTrigger value="reports" className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=inactive]:text-[#6B7280]">Raporty</TabsTrigger>
          </TabsList>
        </div>

        {/* STOCK STATUS TAB */}
        <TabsContent value="stock" className="space-y-4">
          <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-[#111827]">{warehouseName}</p>
                <p className="text-[11px] text-[#6B7280]">Obecny stan zapasów</p>
              </div>
              <button
                onClick={() => setShowDeliveryForm(true)}
                className="h-8 px-3 rounded-lg bg-[#111827] text-white text-[12px] font-medium hover:bg-[#1F2937] flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Odbierz dostawę
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="py-2.5 px-4 text-left">Składnik</th>
                    <th className="pr-3 text-left">Kategoria</th>
                    <th className="pr-3 text-right">Na magazynie</th>
                    <th className="pr-3 text-right">Zarezerwowane</th>
                    <th className="pr-3 text-right">Dostępne</th>
                    <th className="pr-3 text-right">Min</th>
                    <th className="pr-3 text-right">Wartość</th>
                    <th className="pr-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[12px] text-[#6B7280]">
                        Brak składników w magazynie
                      </td>
                    </tr>
                  ) : (
                    stockData.map((item) => (
                      <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                        <td className="py-2.5 px-4 font-semibold text-[#111827]">{item.ingredient}</td>
                        <td className="pr-3 text-[#6B7280]">{item.category}</td>
                        <td className="pr-3 text-right text-[#374151]">{item.onHand.toFixed(2)} {item.unit}</td>
                        <td className="pr-3 text-right text-[#D97706]">{item.reserved.toFixed(2)} {item.unit}</td>
                        <td className="pr-3 text-right font-semibold text-[#111827]">{item.available.toFixed(2)} {item.unit}</td>
                        <td className="pr-3 text-right text-[#6B7280]">{item.minThreshold} {item.unit}</td>
                        <td className="pr-3 text-right font-semibold text-[#111827]">{item.value.toFixed(0)} zł</td>
                        <td className="pr-4 py-2 text-center">
                          {item.available < item.minThreshold ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626]">Niski</span>
                          ) : item.reserved > item.available * 0.5 ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FFFBEB] text-[#D97706]">Zarezerwowany</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F0FDF4] text-[#16A34A]">OK</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* DELIVERIES TAB */}
        <TabsContent value="deliveries" className="space-y-4">
          {showDeliveryForm ? (
            <div className="bg-white border border-[#2563EB] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5E7EB]">
                <p className="text-[13px] font-semibold text-[#111827]">Odbierz nową dostawę</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Dostawca</Label>
                    <Input value={newDelivery.supplier_name} onChange={(e) => setNewDelivery({ ...newDelivery, supplier_name: e.target.value })} placeholder="Nazwa dostawcy" className="h-8 text-[13px]" />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Numer faktury</Label>
                    <Input value={newDelivery.invoiceNumber} onChange={(e) => setNewDelivery({ ...newDelivery, invoiceNumber: e.target.value })} placeholder="FV/2026/001" className="h-8 text-[13px]" />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Data faktury</Label>
                    <Input type="date" value={newDelivery.invoiceDate} onChange={(e) => setNewDelivery({ ...newDelivery, invoiceDate: e.target.value })} className="h-8 text-[13px]" />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Kwota (zł)</Label>
                    <Input type="number" value={newDelivery.totalAmount} onChange={(e) => setNewDelivery({ ...newDelivery, totalAmount: e.target.value })} placeholder="0.00" className="h-8 text-[13px]" />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Pozycje</Label>
                  <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 max-h-96 overflow-y-auto mb-2">
                    <div className="grid grid-cols-5 gap-2 mb-2 pb-2 border-b border-[#E5E7EB]">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Składnik</div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Zamówione</div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Odebrane</div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Data ważności</div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Akcja</div>
                    </div>
                    {deliveryItems.length === 0 ? (
                      <p className="text-[12px] text-[#6B7280] py-2">Brak pozycji</p>
                    ) : (
                      <div className="space-y-2">
                        {deliveryItems.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-5 gap-2">
                            <Select value={item.ingredient_id} onValueChange={(v) => updateDeliveryItem(idx, 'ingredient_id', v)}>
                              <SelectTrigger className="h-8 text-[12px]">
                                <SelectValue placeholder="Wybierz..." />
                              </SelectTrigger>
                              <SelectContent>
                                {ingredients.map(ing => (
                                  <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input type="number" placeholder="0" className="h-8 text-[12px]" value={item.quantity_ordered} onChange={(e) => updateDeliveryItem(idx, 'quantity_ordered', Number(e.target.value))} />
                            <Input type="number" placeholder="0" className="h-8 text-[12px]" value={item.quantity_received} onChange={(e) => updateDeliveryItem(idx, 'quantity_received', Number(e.target.value))} />
                            <Input type="date" className="h-8 text-[12px]" value={item.expiry_date || ''} onChange={(e) => updateDeliveryItem(idx, 'expiry_date', e.target.value || null)} />
                            <button onClick={() => handleRemoveDeliveryItem(idx)} className="h-8 px-2 text-[11px] text-[#DC2626] hover:bg-[#FEF2F2] rounded-md">Usuń</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={handleAddDeliveryItem} className="h-7 px-3 text-[12px] font-medium text-[#2563EB] border border-[#2563EB] rounded-lg hover:bg-[#EFF6FF]">
                    + Dodaj pozycję
                  </button>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Uwagi</Label>
                  <Textarea value={newDelivery.notes} onChange={(e) => setNewDelivery({ ...newDelivery, notes: e.target.value })} placeholder="Uwagi..." rows={2} className="text-[13px]" />
                </div>

                <div className="flex gap-2">
                  <button onClick={handleSaveDelivery} disabled={saving} className="h-8 px-4 rounded-lg bg-[#111827] text-white text-[12px] font-medium hover:bg-[#1F2937] flex items-center gap-1.5 disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Zapisz dostawę
                  </button>
                  <button onClick={() => setShowDeliveryForm(false)} disabled={saving} className="h-8 px-4 rounded-lg border border-[#E5E7EB] text-[12px] font-medium text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-50">
                    Anuluj
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[#111827]">Ostatnie dostawy</p>
                <button onClick={() => setShowDeliveryForm(true)} className="h-8 px-3 rounded-lg bg-[#111827] text-white text-[12px] font-medium hover:bg-[#1F2937] flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Nowa
                </button>
              </div>
              {deliveries.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-[#6B7280]">Brak dostaw</p>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {deliveries.map((delivery) => (
                    <div key={delivery.id} className="flex justify-between items-center px-5 py-3">
                      <div>
                        <p className="text-[13px] font-semibold text-[#111827]">{delivery.supplier_name}</p>
                        <p className="text-[11px] text-[#6B7280]">{delivery.invoice_number} · {delivery.invoice_date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-bold text-[#111827]">{delivery.total_amount?.toFixed(0) || '0'} zł</span>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusColor(delivery.status)}`}>
                          {statusLabel(delivery.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* TRANSFERS TAB */}
        <TabsContent value="transfers" className="space-y-4">
          {showTransferForm ? (
            <div className="bg-white border border-[#16A34A] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5E7EB]">
                <p className="text-[13px] font-semibold text-[#111827]">Utwórz przesyłkę</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Lokalizacja docelowa</Label>
                  <Select value={selectedDestination} onValueChange={setSelectedDestination}>
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue placeholder="Wybierz lokalizację..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Pozycje do przesłania</Label>
                  <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 space-y-2 max-h-96 overflow-y-auto mb-2">
                    {transferItems.length === 0 ? (
                      <p className="text-[12px] text-[#6B7280]">Kliknij na składniki poniżej, aby dodać</p>
                    ) : (
                      transferItems.map((item) => {
                        const stock = stockData.find(s => s.id === item.ingredient_id)
                        return (
                          <div key={item.ingredient_id} className="flex gap-2 items-center">
                            <span className="text-[12px] font-medium flex-1 text-[#111827]">{stock?.ingredient}</span>
                            <span className="text-[11px] text-[#6B7280]">Dostępne: {stock?.available.toFixed(2)}</span>
                            <Input
                              type="number"
                              placeholder="Ilość"
                              className="w-20 h-8 text-[12px]"
                              value={item.quantity}
                              onChange={(e) => updateTransferQuantity(item.ingredient_id, Number(e.target.value))}
                              min="0"
                              max={stock?.available}
                            />
                            <button onClick={() => handleRemoveTransferItem(item.ingredient_id)} className="h-8 px-2 text-[11px] text-[#DC2626] hover:bg-[#FEF2F2] rounded-md">Usuń</button>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {stockData.filter(s => s.available > 0).map(stock => (
                      <button
                        key={stock.id}
                        onClick={() => handleAddTransferItem(stock)}
                        className="h-7 px-2.5 text-[11px] font-medium border border-[#E5E7EB] rounded-md text-[#374151] hover:bg-[#F9FAFB]"
                      >
                        + {stock.ingredient}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={handleSaveTransfer} disabled={saving} className="h-8 px-4 rounded-lg bg-[#111827] text-white text-[12px] font-medium hover:bg-[#1F2937] flex items-center gap-1.5 disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    Utwórz przesyłkę
                  </button>
                  <button onClick={() => setShowTransferForm(false)} disabled={saving} className="h-8 px-4 rounded-lg border border-[#E5E7EB] text-[12px] font-medium text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-50">
                    Anuluj
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[#111827]">Przesyłki</p>
                <button onClick={() => setShowTransferForm(true)} className="h-8 px-3 rounded-lg bg-[#111827] text-white text-[12px] font-medium hover:bg-[#1F2937] flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Nowa
                </button>
              </div>
              {transfers.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-[#6B7280]">Brak przesyłek</p>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {transfers.map((transfer) => {
                    const loc = locations.find(l => l.id === transfer.destination_location_id)
                    return (
                      <div key={transfer.id} className="flex justify-between items-center px-5 py-3">
                        <div>
                          <p className="text-[13px] font-semibold text-[#111827] flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-[#6B7280]" />
                            {loc?.name || 'Nieznana'}
                          </p>
                          <p className="text-[11px] text-[#6B7280]">{new Date(transfer.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusColor(transfer.status)}`}>
                          {statusLabel(transfer.status)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* DISCREPANCIES TAB */}
        <TabsContent value="discrepancies" className="space-y-4">
          <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E5E7EB]">
              <p className="text-[13px] font-semibold text-[#111827]">Problemy i rozbieżności</p>
            </div>
            {discrepancies.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-[#6B7280]">Brak rozbieżności</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {discrepancies.map((disc) => {
                  const ing = ingredients.find(i => i.id === disc.ingredient_id)
                  return (
                    <div key={disc.id} className="flex gap-3 px-5 py-4">
                      <div className="w-8 h-8 rounded-md bg-[#FFFBEB] flex items-center justify-center shrink-0">
                        <AlertTriangle className="text-[#D97706] w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#111827]">{ing?.name}</p>
                        <p className="text-[12px] text-[#6B7280]">
                          Oczekiwano: {disc.expected_qty} · Odebrano: {disc.received_qty} · Różnica: {disc.difference?.toFixed(2)}
                        </p>
                        <button onClick={() => markDiscrepancyResolved(disc.id)} className="mt-2 h-7 px-3 text-[11px] font-medium border border-[#E5E7EB] rounded-md text-[#374151] hover:bg-[#F9FAFB]">
                          Oznacz jako rozwiązane
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Wartość magazynu</p>
              <p className="text-[26px] font-bold text-[#2563EB] mt-1 leading-none">{totalValue.toFixed(0)} zł</p>
              <p className="text-[12px] text-[#6B7280] mt-1.5">{stockData.length} składników</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Aktywne przesyłki</p>
              <p className="text-[26px] font-bold text-[#D97706] mt-1 leading-none">{itemsInTransfer}</p>
              <p className="text-[12px] text-[#6B7280] mt-1.5">w trakcie</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Niskie stany</p>
              <p className="text-[26px] font-bold text-[#DC2626] mt-1 leading-none">{lowStockItems.length}</p>
              <p className="text-[12px] text-[#6B7280] mt-1.5">poniżej progu</p>
            </div>
          </div>

          {lowStockItems.length > 0 && (
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5E7EB]">
                <p className="text-[13px] font-semibold text-[#111827]">Niskie stany magazynowe</p>
              </div>
              <div className="divide-y divide-[#F3F4F6]">
                {lowStockItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center px-5 py-3">
                    <span className="text-[13px] font-medium text-[#111827]">{item.ingredient}</span>
                    <span className="text-[12px] text-[#DC2626] font-medium">
                      {item.onHand.toFixed(2)} {item.unit} (min: {item.minThreshold})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
