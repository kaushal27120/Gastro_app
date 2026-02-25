// ============================================================
// Supabase queries for warehouse components
// ============================================================

import { createClient } from '@/app/utils/supabse/client'

const supabase = createClient()

// Fetch warehouse stock
export async function getWarehouseStock(warehouseId: string) {
  const { data, error } = await supabase
    .from('central_warehouse_stock')
    .select(`
      id,
      ingredient_id,
      quantity,
      warehouse_id,
      updated_at
    `)
    .eq('warehouse_id', warehouseId)

  if (error) console.error('Error fetching stock:', error)
  return data || []
}

// Fetch ingredient details
export async function getIngredientDetails(ingredientId: string) {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, category, unit')
    .eq('id', ingredientId)
    .single()

  if (error) console.error('Error fetching ingredient:', error)
  return data
}

// Fetch all warehouses
export async function getWarehouses() {
  const { data, error } = await supabase
    .from('warehouse_central')
    .select('id, name, address, active')
    .eq('active', true)

  if (error) console.error('Error fetching warehouses:', error)
  return data || []
}

// Create warehouse
export async function createWarehouse(name: string, address: string) {
  const { data, error } = await supabase
    .from('warehouse_central')
    .insert([{ name, address, active: true }])
    .select()

  if (error) console.error('Error creating warehouse:', error)
  return data?.[0]
}

// Fetch deliveries
export async function getDeliveries(warehouseId: string) {
  const { data, error } = await supabase
    .from('warehouse_deliveries')
    .select(`
      id,
      warehouse_id,
      supplier_name,
      invoice_number,
      invoice_date,
      delivery_date,
      total_amount,
      status,
      created_at
    `)
    .eq('warehouse_id', warehouseId)
    .order('created_at', { ascending: false })

  if (error) console.error('Error fetching deliveries:', error)
  return data || []
}

// Create delivery
export async function createDelivery(warehouseId: string, delivery: any) {
  const { data, error } = await supabase
    .from('warehouse_deliveries')
    .insert([
      {
        warehouse_id: warehouseId,
        supplier_name: delivery.supplier,
        invoice_number: delivery.invoiceNumber,
        invoice_date: delivery.invoiceDate,
        delivery_date: delivery.deliveryDate,
        total_amount: delivery.totalAmount,
        status: 'draft',
        notes: delivery.notes,
      },
    ])
    .select()

  if (error) console.error('Error creating delivery:', error)
  return data?.[0]
}

// Fetch transfers
export async function getTransfers(warehouseId: string) {
  const { data, error } = await supabase
    .from('warehouse_transfers')
    .select(`
      id,
      warehouse_id,
      location_id,
      status,
      sent_at,
      received_at,
      priority,
      created_at
    `)
    .eq('warehouse_id', warehouseId)
    .order('created_at', { ascending: false })

  if (error) console.error('Error fetching transfers:', error)
  return data || []
}

// Create transfer
export async function createTransfer(warehouseId: string, locationId: string, priority: string = 'normal') {
  const { data, error } = await supabase
    .from('warehouse_transfers')
    .insert([
      {
        warehouse_id: warehouseId,
        location_id: locationId,
        status: 'pending',
        priority,
      },
    ])
    .select()

  if (error) console.error('Error creating transfer:', error)
  return data?.[0]
}

// Fetch transfer items
export async function getTransferItems(transferId: string) {
  const { data, error } = await supabase
    .from('warehouse_transfer_items')
    .select('id, ingredient_id, quantity_sent, quantity_received, unit')
    .eq('transfer_id', transferId)

  if (error) console.error('Error fetching transfer items:', error)
  return data || []
}

// Add transfer item
export async function addTransferItem(
  transferId: string,
  ingredientId: string,
  quantitySent: number,
  unit: string,
  costPrice: number
) {
  const { data, error } = await supabase
    .from('warehouse_transfer_items')
    .insert([
      {
        transfer_id: transferId,
        ingredient_id: ingredientId,
        quantity_sent: quantitySent,
        unit,
        cost_price: costPrice,
      },
    ])
    .select()

  if (error) console.error('Error adding transfer item:', error)
  return data?.[0]
}

// Fetch deviations
export async function getDeviations(warehouseId: string, periodStart: string, periodEnd: string) {
  const { data, error } = await supabase
    .from('warehouse_deviations')
    .select(`
      id,
      ingredient_id,
      theoretical_usage,
      actual_usage,
      deviation_qty,
      deviation_pct,
      deviation_value,
      status,
      explanation_notes,
      potential_causes,
      created_at
    `)
    .eq('warehouse_id', warehouseId)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd)
    .order('deviation_pct', { ascending: false })

  if (error) console.error('Error fetching deviations:', error)
  return data || []
}

// Update stock quantity
export async function updateStockQuantity(
  warehouseId: string,
  ingredientId: string,
  newQuantity: number
) {
  const { data, error } = await supabase
    .from('central_warehouse_stock')
    .update({ quantity: newQuantity })
    .eq('warehouse_id', warehouseId)
    .eq('ingredient_id', ingredientId)
    .select()

  if (error) console.error('Error updating stock:', error)
  return data?.[0]
}

// Create or get stock entry
export async function getOrCreateStockEntry(
  warehouseId: string,
  ingredientId: string
) {
  // Try to get existing
  const { data: existing } = await supabase
    .from('central_warehouse_stock')
    .select('id')
    .eq('warehouse_id', warehouseId)
    .eq('ingredient_id', ingredientId)
    .single()

  if (existing) return existing

  // Create new
  const { data: created, error } = await supabase
    .from('central_warehouse_stock')
    .insert([
      {
        warehouse_id: warehouseId,
        ingredient_id: ingredientId,
        quantity: 0,
      },
    ])
    .select()

  if (error) console.error('Error creating stock entry:', error)
  return created?.[0]
}
