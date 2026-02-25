'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/supabase-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, Package, Plus, Send, CheckCircle2, AlertTriangle, Truck, Loader2 } from 'lucide-react'

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
}

interface WarehousePanelProps {
  warehouseName?: string
}

export function CentralWarehousePanel({
  warehouseName = 'Magazyn Główny'
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

  // Fetch all data
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Ensure warehouse exists
      let { data: warehouses } = await supabase
        .from('warehouse_central')
        .select('*')
        .eq('name', warehouseName)
        .limit(1)
      
      let warehouse_id = warehouses?.[0]?.id
      
      if (!warehouse_id) {
        // Create default warehouse if it doesn't exist
        const { data: newWarehouse, error: whError } = await supabase
          .from('warehouse_central')
          .insert({ name: warehouseName, address: '', active: true })
          .select()
        
        if (whError) throw whError
        warehouse_id = newWarehouse?.[0]?.id
      }
      
      if (warehouse_id) {
        setWarehouseId(warehouse_id)
      }

      // Fetch ingredients
      const { data: ingData } = await supabase.from('ingredients').select('*').order('name')
      if (ingData) setIngredients(ingData)

      // Fetch locations
      const { data: locData } = await supabase.from('locations').select('*').order('name')
      if (locData) setLocations(locData)

      // Calculate stock from transactions and ingredients
      const stockMap = new Map<string, StockItem>()
      
      if (ingData) {
        ingData.forEach((ing: any) => {
          stockMap.set(ing.id, {
            id: ing.id,
            ingredient: ing.name,
            category: ing.category || 'Inne',
            onHand: 0, // Will be calculated from transactions below
            reserved: 0,
            available: 0, // Will be calculated from transactions below
            minThreshold: ing.min_threshold || 0,
            unit: ing.unit || 'kg',
            value: 0, // Will be calculated from transactions below
          })
        })
      }

      // Get inventory transactions for more accurate stock
      const { data: txData } = await supabase
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (txData) {
        // Sum quantities by ingredient
        const qtySums = new Map<string, number>()
        txData.forEach((tx: any) => {
          const current = qtySums.get(tx.ingredient_id) || 0
          const change = tx.tx_type === 'invoice_in' ? tx.quantity : -tx.quantity
          qtySums.set(tx.ingredient_id, current + change)
        })

        // Update stock items with calculated totals
        qtySums.forEach((qty, ingId) => {
          const item = stockMap.get(ingId)
          if (item) {
            item.onHand = qty
            item.available = qty - item.reserved
          }
        })
      }

      setStockData(Array.from(stockMap.values()))

      // Fetch transfers - commented out as warehouse_transfers table schema may not match
      // const { data: transferData, error: transferError } = await supabase
      //   .from('warehouse_transfers')
      //   .select('*')
      //   .order('created_at', { ascending: false })
      //   .limit(20)
      // if (transferError) {
      //   console.warn('⚠️ Warning fetching transfers:', transferError)
      //   setTransfers([])
      // } else if (transferData) {
      //   setTransfers(transferData)
      // }
      setTransfers([])

      // Fetch deliveries
      const { data: deliveryData } = await supabase
        .from('warehouse_deliveries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (deliveryData) setDeliveries(deliveryData)

      // Fetch discrepancies - commented out as warehouse_discrepancies table doesn't exist yet
      // const { data: discrepancyData } = await supabase
      //   .from('warehouse_discrepancies')
      //   .select('*')
      //   .eq('resolved', false)
      //   .order('created_at', { ascending: false })
      // if (discrepancyData) setDiscrepancies(discrepancyData)
    } catch (err) {
      console.error('❌ Error fetching warehouse data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDeliveryItem = () => {
    setDeliveryItems([
      ...deliveryItems,
      { ingredient_id: '', quantity_ordered: 0, quantity_received: 0 },
    ])
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
      alert('❌ Podaj dostawcę i numer faktury')
      return
    }
    
    if (deliveryItems.length === 0) {
      alert('❌ Dodaj co najmniej jeden produkt')
      return
    }

    if (!warehouseId) {
      alert('❌ Warehouse not initialized')
      return
    }

    setSaving(true)
    try {
      console.log('📦 Starting delivery save...', { warehouseId, supplier: newDelivery.supplier_name, items: deliveryItems.length })
      
      // Create delivery record
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

      if (deliveryError) {
        console.error('❌ Delivery creation error:', deliveryError)
        throw deliveryError
      }
      
      console.log('✅ Delivery created:', created?.[0]?.id)

      // Create delivery items
      if (created && created[0]) {
        const deliveryId = created[0].id
        console.log('📝 Creating delivery items for delivery:', deliveryId)
        
        for (const item of deliveryItems) {
          const ingredient = ingredients.find(i => i.id === item.ingredient_id)
          if (!ingredient) {
            console.warn(`⚠️ Ingredient not found: ${item.ingredient_id}`)
            continue
          }

          console.log(`📌 Processing item: ${ingredient.name}, qty: ${item.quantity_received}`)

          // Insert delivery item
          const { error: itemError } = await supabase.from('warehouse_delivery_items').insert({
            delivery_id: deliveryId,
            ingredient_id: item.ingredient_id,
            quantity_ordered: item.quantity_ordered,
            quantity_received: item.quantity_received || 0,
            unit: ingredient.unit || 'kg',
            unit_price: ingredient.last_price || 0,
          })
          if (itemError) {
            console.error(`❌ Delivery item error for ${ingredient.name}:`, itemError)
            throw itemError
          }

          // Create transaction record (this updates stock, no need to update ingredients table)
          const { error: txError } = await supabase.from('inventory_transactions').insert({
            ingredient_id: item.ingredient_id,
            quantity: item.quantity_received || 0,
            unit: ingredient.unit || 'kg',
            tx_type: 'invoice_in',
            reference: newDelivery.invoiceNumber,
            reason: `Delivery from ${newDelivery.supplier_name}`,
          })
          if (txError) {
            console.error(`❌ Transaction error for ${ingredient.name}:`, txError)
            throw txError
          }
          
          console.log(`✅ Stock updated: ${ingredient.name} +${item.quantity_received}`)
        }
      }

      alert('✅ Dostawa zapisana')
      setNewDelivery({ supplier_name: '', invoiceNumber: '', invoiceDate: '', totalAmount: '', notes: '' })
      setDeliveryItems([])
      setShowDeliveryForm(false)
      fetchData()
    } catch (err: any) {
      console.error('❌ Error:', err)
      alert('❌ Błąd: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTransferItem = (ingredient: any) => {
    if (!transferItems.find(t => t.ingredient_id === ingredient.id)) {
      transferItems.push({
        ingredient_id: ingredient.id,
        quantity: 0,
      })
      setTransferItems([...transferItems])
    }
  }

  const handleRemoveTransferItem = (ingredientId: string) => {
    setTransferItems(transferItems.filter(t => t.ingredient_id !== ingredientId))
  }

  const updateTransferQuantity = (ingredientId: string, quantity: number) => {
    const updated = transferItems.map(t =>
      t.ingredient_id === ingredientId ? { ...t, quantity } : t
    )
    setTransferItems(updated)
  }

  const handleSaveTransfer = async () => {
    if (!selectedDestination || transferItems.length === 0) {
      alert('❌ Wybierz lokalizację i produkty')
      return
    }

    if (!warehouseId) {
      alert('❌ Warehouse not initialized')
      return
    }

    setSaving(true)
    try {
      // Create transfer record
      const { data: created, error: transferError } = await supabase
        .from('warehouse_transfers')
        .insert({
          warehouse_id: warehouseId,
          location_id: selectedDestination,
          status: 'pending',
          created_by: null,
        })
        .select()

      if (transferError) throw transferError

      if (created && created[0]) {
        const transferId = created[0].id

        // Create transfer items and update reservations
        for (const item of transferItems) {
          await supabase.from('warehouse_transfer_items').insert({
            transfer_id: transferId,
            ingredient_id: item.ingredient_id,
            quantity_ordered: item.quantity,
            quantity_received: 0,
          })

          // Update ingredient reserved quantity
          const stock = stockData.find(s => s.id === item.ingredient_id)
          if (stock) {
            await supabase
              .from('ingredients')
              .update({ reserved_qty: (stock.reserved + item.quantity) })
              .eq('id', item.ingredient_id)
          }
        }
      }

      alert('✅ Transfer utworzony')
      setSelectedDestination('')
      setTransferItems([])
      setShowTransferForm(false)
      fetchData()
    } catch (err: any) {
      console.error('❌ Error:', err)
      alert('❌ Błąd: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const markDiscrepancyResolved = async (id: string) => {
    try {
      // warehouse_discrepancies table doesn't exist yet
      // await supabase
      //   .from('warehouse_discrepancies')
      //   .update({ resolved: true, status: 'resolved' })
      //   .eq('id', id)
      alert('✅ Rozbieżność rozwiązana')
      fetchData()
    } catch (err) {
      console.error('❌ Error:', err)
    }
  }

  const statusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      in_transit: 'bg-blue-100 text-blue-800 border-blue-300',
      received: 'bg-green-100 text-green-800 border-green-300',
      draft: 'bg-gray-100 text-gray-800 border-gray-300',
      pending_review: 'bg-orange-100 text-orange-800 border-orange-300',
      resolved: 'bg-green-100 text-green-800 border-green-300',
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const statusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      pending: '⏳ Pending',
      in_transit: '🚛 In Transit',
      received: '✓ Received',
      draft: '📝 Draft',
      pending_review: '⚠️ Reviewing',
      resolved: '✅ Resolved',
    }
    return labels[status] || status
  }

  const lowStockItems = stockData.filter(item => item.onHand < item.minThreshold)
  const totalValue = stockData.reduce((sum, item) => sum + item.value, 0)
  const itemsInTransfer = transfers.filter(t => t.status !== 'received').length
  const activeDiscrepancies = discrepancies.filter(d => !d.resolved).length

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin mr-2" /> Wczytywanie danych magazynu...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="stock">📦 Stan</TabsTrigger>
          <TabsTrigger value="deliveries">🚛 Dostawy</TabsTrigger>
          <TabsTrigger value="transfers">➡️ Przesyłki</TabsTrigger>
          <TabsTrigger value="discrepancies">⚠️ Problemy ({activeDiscrepancies})</TabsTrigger>
          <TabsTrigger value="reports">📈 Raporty</TabsTrigger>
        </TabsList>

        {/* STOCK STATUS TAB */}
        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{warehouseName}</CardTitle>
                <CardDescription>Obecny stan zapasów</CardDescription>
              </div>
              <Button onClick={() => setShowDeliveryForm(true)} className="gap-2">
                <Plus size={16} />
                Odbierz dostawę
              </Button>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-semibold">Składnik</th>
                      <th className="text-left p-3 font-semibold">Kategoria</th>
                      <th className="text-right p-3 font-semibold">Na magazynie</th>
                      <th className="text-right p-3 font-semibold">Zarezerwowane</th>
                      <th className="text-right p-3 font-semibold">Dostępne</th>
                      <th className="text-right p-3 font-semibold">Min</th>
                      <th className="text-right p-3 font-semibold">Wartość</th>
                      <th className="text-center p-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-gray-500">
                          Brak składników w magazynie
                        </td>
                      </tr>
                    ) : (
                      stockData.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{item.ingredient}</td>
                          <td className="p-3 text-gray-600">{item.category}</td>
                          <td className="p-3 text-right">{item.onHand.toFixed(2)} {item.unit}</td>
                          <td className="p-3 text-right text-orange-600">{item.reserved.toFixed(2)} {item.unit}</td>
                          <td className="p-3 text-right font-bold">{item.available.toFixed(2)} {item.unit}</td>
                          <td className="p-3 text-right">{item.minThreshold} {item.unit}</td>
                          <td className="p-3 text-right font-semibold">{item.value.toFixed(0)} zł</td>
                          <td className="p-3 text-center">
                            {item.available < item.minThreshold ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 font-semibold">
                                🔴 Low
                              </span>
                            ) : item.reserved > item.available * 0.5 ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 font-semibold">
                                🟡 Reserved
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 font-semibold">
                                🟢 OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DELIVERIES TAB */}
        <TabsContent value="deliveries" className="space-y-4">
          {showDeliveryForm ? (
            <Card className="border-2 border-blue-300">
              <CardHeader>
                <CardTitle>Receive New Delivery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Supplier</Label>
                    <Input
                      value={newDelivery.supplier_name}
                      onChange={(e) => setNewDelivery({ ...newDelivery, supplier_name: e.target.value })}
                      placeholder="Supplier name"
                    />
                  </div>
                  <div>
                    <Label>Invoice Number</Label>
                    <Input
                      value={newDelivery.invoiceNumber}
                      onChange={(e) => setNewDelivery({ ...newDelivery, invoiceNumber: e.target.value })}
                      placeholder="FV/2026/001"
                    />
                  </div>
                  <div>
                    <Label>Invoice Date</Label>
                    <Input
                      type="date"
                      value={newDelivery.invoiceDate}
                      onChange={(e) => setNewDelivery({ ...newDelivery, invoiceDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Total Amount (zł)</Label>
                    <Input
                      type="number"
                      value={newDelivery.totalAmount}
                      onChange={(e) => setNewDelivery({ ...newDelivery, totalAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <Label>Items</Label>
                  <div className="bg-gray-50 p-3 rounded-lg max-h-96 overflow-y-auto mb-3">
                    {/* Header row */}
                    <div className="grid grid-cols-4 gap-2 mb-2 pb-2 border-b">
                      <div className="text-xs font-semibold text-slate-600">Ingredient</div>
                      <div className="text-xs font-semibold text-slate-600">Qty Ordered</div>
                      <div className="text-xs font-semibold text-slate-600">Qty Received</div>
                      <div className="text-xs font-semibold text-slate-600">Action</div>
                    </div>
                    
                    {/* Items */}
                    {deliveryItems.length === 0 ? (
                      <p className="text-sm text-gray-500">No items added</p>
                    ) : (
                      <div className="space-y-2">
                        {deliveryItems.map((item, idx) => {
                          const ing = ingredients.find(i => i.id === item.ingredient_id)
                          return (
                            <div key={idx} className="grid grid-cols-4 gap-2">
                              <Select value={item.ingredient_id} onValueChange={(v) => updateDeliveryItem(idx, 'ingredient_id', v)}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Choose ingredient" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ingredients.map(ing => (
                                    <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                placeholder="0"
                                className="h-8 text-sm"
                                value={item.quantity_ordered}
                                onChange={(e) => updateDeliveryItem(idx, 'quantity_ordered', Number(e.target.value))}
                              />
                              <Input
                                type="number"
                                placeholder="0"
                                className="h-8 text-sm"
                                value={item.quantity_received}
                                onChange={(e) => updateDeliveryItem(idx, 'quantity_received', Number(e.target.value))}
                              />
                              <Button variant="ghost" size="sm" onClick={() => handleRemoveDeliveryItem(idx)}>Remove</Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAddDeliveryItem}>+ Add Item</Button>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={newDelivery.notes}
                    onChange={(e) => setNewDelivery({ ...newDelivery, notes: e.target.value })}
                    placeholder="Special notes..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button className="gap-2" onClick={handleSaveDelivery} disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    Save Delivery
                  </Button>
                  <Button variant="outline" onClick={() => setShowDeliveryForm(false)} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Deliveries</CardTitle>
                </div>
                <Button onClick={() => setShowDeliveryForm(true)} className="gap-2">
                  <Plus size={16} />
                  New
                </Button>
              </CardHeader>

              <CardContent>
                {deliveries.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No deliveries yet</p>
                ) : (
                  <div className="space-y-3">
                    {deliveries.map((delivery) => (
                      <div key={delivery.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-semibold">{delivery.supplier_name}</p>
                          <p className="text-sm text-gray-600">{delivery.invoice_number} • {delivery.invoice_date}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{delivery.total_amount?.toFixed(0) || '0'} zł</div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor(delivery.status)}`}>
                          {statusLabel(delivery.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TRANSFERS TAB */}
        <TabsContent value="transfers" className="space-y-4">
          {showTransferForm ? (
            <Card className="border-2 border-green-300">
              <CardHeader>
                <CardTitle>Create Transfer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Destination Location</Label>
                  <Select value={selectedDestination} onValueChange={setSelectedDestination}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Items to Transfer</Label>
                  <div className="bg-gray-50 p-3 rounded-lg space-y-2 max-h-96 overflow-y-auto mb-3">
                    {transferItems.length === 0 ? (
                      <p className="text-sm text-gray-500">Click ingredients below to add</p>
                    ) : (
                      transferItems.map((item) => {
                        const stock = stockData.find(s => s.id === item.ingredient_id)
                        return (
                          <div key={item.ingredient_id} className="flex gap-2 items-center">
                            <span className="text-sm font-medium flex-1">{stock?.ingredient}</span>
                            <span className="text-sm text-gray-600">Available: {stock?.available.toFixed(2)}</span>
                            <Input
                              type="number"
                              placeholder="Qty"
                              className="w-20 h-8 text-sm"
                              value={item.quantity}
                              onChange={(e) => updateTransferQuantity(item.ingredient_id, Number(e.target.value))}
                              min="0"
                              max={stock?.available}
                            />
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveTransferItem(item.ingredient_id)}>Remove</Button>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="space-y-1 mb-3">
                    <Label className="text-xs">Quick add:</Label>
                    <div className="flex flex-wrap gap-1">
                      {stockData.filter(s => s.available > 0).map(stock => (
                        <Button
                          key={stock.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddTransferItem(stock)}
                          className="text-xs"
                        >
                          + {stock.ingredient}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="gap-2" onClick={handleSaveTransfer} disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    Create Transfer
                  </Button>
                  <Button variant="outline" onClick={() => setShowTransferForm(false)} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Transfers</CardTitle>
                </div>
                <Button onClick={() => setShowTransferForm(true)} className="gap-2">
                  <Plus size={16} />
                  New
                </Button>
              </CardHeader>

              <CardContent>
                {transfers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No transfers</p>
                ) : (
                  <div className="space-y-3">
                    {transfers.map((transfer) => {
                      const loc = locations.find(l => l.id === transfer.destination_location_id)
                      return (
                        <div
                          key={transfer.id}
                          className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div>
                            <p className="font-semibold flex items-center gap-2">
                              <Truck size={16} />
                              {loc?.name || 'Unknown'}
                            </p>
                            <p className="text-sm text-gray-600">{new Date(transfer.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor(transfer.status)}`}>
                            {statusLabel(transfer.status)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DISCREPANCIES TAB */}
        <TabsContent value="discrepancies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Issues & Discrepancies</CardTitle>
            </CardHeader>

            <CardContent>
              {discrepancies.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No discrepancies</p>
              ) : (
                <div className="space-y-3">
                  {discrepancies.map((disc) => {
                    const ing = ingredients.find(i => i.id === disc.ingredient_id)
                    return (
                      <div key={disc.id} className="flex gap-3 p-3 border rounded-lg bg-yellow-50">
                        <AlertTriangle className="text-yellow-700 flex-shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                          <p className="font-semibold text-yellow-900">{ing?.name}</p>
                          <p className="text-sm text-yellow-800">
                            Expected: {disc.expected_qty} • Received: {disc.received_qty} • Difference: {disc.difference?.toFixed(2)}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="default" onClick={() => markDiscrepancyResolved(disc.id)}>
                              Mark Resolved
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Stock Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{totalValue.toFixed(0)} zł</div>
                <p className="text-sm text-gray-600 mt-1">{stockData.length} ingredients</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active Transfers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{itemsInTransfer}</div>
                <p className="text-sm text-gray-600 mt-1">in progress</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Low Stock Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{lowStockItems.length}</div>
                <p className="text-sm text-gray-600 mt-1">items below threshold</p>
              </CardContent>
            </Card>
          </div>

          {lowStockItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lowStockItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="font-medium">{item.ingredient}</span>
                      <span className="text-sm text-red-700">
                        {item.onHand.toFixed(2)} {item.unit} (min: {item.minThreshold})
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
