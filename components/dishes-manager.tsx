'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, Save, ChevronDown } from 'lucide-react'

interface DishesManagerProps {
  supabase: SupabaseClient
  companyId?: string | null
}

type Recipe = {
  id: string
  name: string
  category: string | null
  portions: number | null
}

type Location = {
  id: string
  name: string
}

type Dish = {
  id: string
  recipe_id: string
  location_id: string
  dish_name: string
  menu_price_net: number | null
  menu_price_gross: number | null
  vat_rate: number | null
  margin_target: number | null
  food_cost_target: number | null
  status: string | null
}

type Ingredient = {
  id: string
  name: string
  base_unit: string
  category: string
}

type InventoryProduct = {
  id: string
  name: string
  unit: string
  last_price?: number | null
}

type RecipeIngredient = {
  id: string
  ingredient_id: string | null
  product_id?: string | null
  source?: 'ingredient' | 'product' | null
  quantity: number
  unit: string
  cost_per_unit?: number | null
  ingredients?: { name: string; base_unit: string; category: string } | { name: string; base_unit: string; category: string }[] | null
  inventory_products?: { name: string; unit: string } | null
}

export function DishesManager({ supabase, companyId }: DishesManagerProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [dishes, setDishes] = useState<Dish[]>([])
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('')
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([])
  const [recipeCost, setRecipeCost] = useState<number>(0)
  const [newRecipe, setNewRecipe] = useState({ name: '', category: '', portions: '1' })
  const [newItem, setNewItem] = useState({ ingredientId: '', productId: '', source: 'ingredient', quantity: '1', unit: '' })
  const [newDish, setNewDish] = useState({
    recipeId: '',
    locationId: '',
    dishName: '',
    priceNet: '',
    priceGross: '',
    vatRate: '8',
    marginTarget: '0.70',
    foodCostTarget: '0.30',
    status: 'active',
  })
  const [editingDishId, setEditingDishId] = useState<string | null>(null)
  const [editingDish, setEditingDish] = useState<Partial<Dish>>({})
  const [savingRecipe, setSavingRecipe] = useState(false)
  const [savingDish, setSavingDish] = useState(false)
  const [savingIngredient, setSavingIngredient] = useState(false)

  const handleError = (label: string, error: any) => {
    const msg = error?.message || error?.error?.message || String(error)
    alert(`${label}: ${msg}`)
  }

  const selectedRecipe = useMemo(
    () => recipes.find(r => r.id === selectedRecipeId) || null,
    [recipes, selectedRecipeId]
  )

  useEffect(() => {
    fetchRecipes()
    fetchIngredients()
    fetchProducts()
    fetchLocations()
    fetchDishes()
  }, [])

  useEffect(() => {
    if (selectedRecipeId) fetchRecipeIngredients(selectedRecipeId)
    else setRecipeIngredients([])
  }, [selectedRecipeId])

  useEffect(() => {
    if (selectedRecipeId) {
      computeRecipeCost(selectedRecipeId, recipeIngredients)
    }
  }, [recipeIngredients, selectedRecipeId])

  const fetchRecipes = async () => {
    const { data } = await supabase.from('recipes').select('id, name, category, portions').order('name')
    setRecipes((data as Recipe[]) || [])
  }

  const fetchIngredients = async () => {
    const { data } = await supabase.from('ingredients').select('id, name, base_unit, category').order('name')
    setIngredients((data as Ingredient[]) || [])
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('inventory_products').select('id, name, unit, last_price').eq('active', true).order('name')
    setProducts((data as InventoryProduct[]) || [])
  }

  const fetchLocations = async () => {
    if (!companyId) {
      setLocations([])
      return
    }

    const { data } = await supabase
      .from('locations')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name')

    setLocations((data as Location[]) || [])
    if (data && data.length > 0 && !newDish.locationId) {
      setNewDish((prev) => ({ ...prev, locationId: data[0].id }))
    }
  }

  const fetchDishes = async () => {
    const { data } = await supabase
      .from('dishes')
      .select('id, recipe_id, location_id, dish_name, menu_price_net, menu_price_gross, vat_rate, margin_target, food_cost_target, status')
      .order('dish_name')

    setDishes((data as Dish[]) || [])
  }

  const fetchRecipeIngredients = async (recipeId: string) => {
    const { data } = await supabase
      .from('recipe_ingredients')
      .select('id, ingredient_id, product_id, source, quantity, unit, cost_per_unit, ingredients(name, base_unit, category), inventory_products(name, unit)')
      .eq('recipe_id', recipeId)
      .order('id')

    setRecipeIngredients((data as unknown as RecipeIngredient[]) || [])
    await computeRecipeCost(recipeId, (data as unknown as RecipeIngredient[]) || [])
  }

  const computeRecipeCost = async (recipeId: string, items?: RecipeIngredient[]) => {
    const ingredientsList = items || recipeIngredients
    if (!ingredientsList.length) {
      setRecipeCost(0)
      return
    }

    const ingredientItems = ingredientsList.filter(i => i.source !== 'product' && i.ingredient_id)
    const productItems = ingredientsList.filter(i => i.source === 'product' && i.product_id)

    const ingredientIds = ingredientItems.map(i => i.ingredient_id as string)
    const latestIngPrice: Record<string, number> = {}
    if (ingredientIds.length) {
      const { data: prices } = await supabase
        .from('ingredient_prices_history')
        .select('ingredient_id, price, recorded_at')
        .in('ingredient_id', ingredientIds)
        .order('recorded_at', { ascending: false })
      ;(prices || []).forEach((p: any) => {
        if (latestIngPrice[p.ingredient_id] === undefined) {
          latestIngPrice[p.ingredient_id] = Number(p.price || 0)
        }
      })
    }

    const productIds = productItems.map(i => i.product_id as string)
    const prodPrice: Record<string, number> = {}
    if (productIds.length) {
      const { data: prods } = await supabase
        .from('inventory_products')
        .select('id, last_price')
        .in('id', productIds)
      ;(prods || []).forEach((p: any) => { prodPrice[p.id] = Number(p.last_price || 0) })
    }

    const total = ingredientsList.reduce((sum, item) => {
      let price = 0
      if (item.source === 'product' && item.product_id) {
        price = prodPrice[item.product_id] ?? Number(item.cost_per_unit || 0)
      } else if (item.ingredient_id) {
        price = latestIngPrice[item.ingredient_id] ?? Number(item.cost_per_unit || 0)
      }
      return sum + (Number(item.quantity || 0) * price)
    }, 0)

    setRecipeCost(Number(total.toFixed(2)))
  }

  const addRecipe = async () => {
    if (!newRecipe.name.trim()) {
      alert('Podaj nazwę dania')
      return
    }
    setSavingRecipe(true)
    const { data, error } = await supabase.from('recipes').insert({
      name: newRecipe.name.trim(),
      category: newRecipe.category || null,
      portions: Number(newRecipe.portions) || 1,
      active: true,
    }).select()
    if (error) {
      handleError('Błąd dodawania receptury', error)
      setSavingRecipe(false)
      return
    }
    if (data && data.length > 0) {
      setNewRecipe({ name: '', category: '', portions: '1' })
      setSelectedRecipeId(data[0].id)
      fetchRecipes()
    }
    setSavingRecipe(false)
  }

  const deleteRecipe = async (id: string) => {
    if (!confirm('Usunąć danie i wszystkie składniki receptury?')) return
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (error) {
      handleError('Błąd usuwania receptury', error)
      return
    }
    if (selectedRecipeId === id) setSelectedRecipeId('')
    fetchRecipes()
  }

  const addDish = async () => {
    if (!newDish.recipeId || !newDish.locationId || !newDish.dishName.trim()) {
      alert('Uzupełnij recepturę, lokalizację i nazwę dania')
      return
    }
    setSavingDish(true)

    const vatRate = Number(newDish.vatRate) || 0
    const priceNet = newDish.priceNet ? Number(newDish.priceNet) : null
    const priceGross = newDish.priceGross
      ? Number(newDish.priceGross)
      : (priceNet !== null ? Number((priceNet * (1 + vatRate / 100)).toFixed(2)) : null)

    const { error } = await supabase.from('dishes').insert({
      recipe_id: newDish.recipeId,
      location_id: newDish.locationId,
      dish_name: newDish.dishName.trim(),
      menu_price_net: priceNet,
      menu_price_gross: priceGross,
      vat_rate: vatRate,
      margin_target: Number(newDish.marginTarget) || 0.7,
      food_cost_target: Number(newDish.foodCostTarget) || 0.3,
      status: newDish.status,
      company_id: companyId || null,
    })
    if (error) {
      handleError('Błąd dodawania dania', error)
      setSavingDish(false)
      return
    }
    if (!error) {
      setNewDish({
        recipeId: '',
        locationId: newDish.locationId,
        dishName: '',
        priceNet: '',
        priceGross: '',
        vatRate: '8',
        marginTarget: '0.70',
        foodCostTarget: '0.30',
        status: 'active',
      })
      fetchDishes()
    }
    setSavingDish(false)
  }

  const saveDish = async (dish: Dish) => {
    const { error } = await supabase
      .from('dishes')
      .update({
        dish_name: dish.dish_name,
        menu_price_net: dish.menu_price_net,
        menu_price_gross: dish.menu_price_gross,
        vat_rate: dish.vat_rate,
        margin_target: dish.margin_target,
        food_cost_target: dish.food_cost_target,
        status: dish.status,
      })
      .eq('id', dish.id)
    if (error) {
      handleError('Błąd zapisu dania', error)
      return
    }
    setEditingDishId(null)
    setEditingDish({})
    fetchDishes()
  }

  const deleteDish = async (id: string) => {
    if (!confirm('Usunąć danie z menu?')) return
    const { error } = await supabase.from('dishes').delete().eq('id', id)
    if (error) {
      handleError('Błąd usuwania dania', error)
      return
    }
    fetchDishes()
  }

  const addRecipeIngredient = async () => {
    if (!selectedRecipeId) { alert('Wybierz recepturę'); return }
    const isProduct = newItem.source === 'product'
    if (isProduct && !newItem.productId) { alert('Wybierz produkt'); return }
    if (!isProduct && !newItem.ingredientId) { alert('Wybierz składnik'); return }
    setSavingIngredient(true)

    const unit = newItem.unit
      || (isProduct ? products.find(p => p.id === newItem.productId)?.unit : ingredients.find(i => i.id === newItem.ingredientId)?.base_unit)
      || 'kg'

    const row: any = {
      recipe_id: selectedRecipeId,
      quantity: Number(newItem.quantity) || 0,
      unit,
      source: newItem.source,
    }
    if (isProduct) {
      row.product_id = newItem.productId
      row.ingredient_id = null
    } else {
      row.ingredient_id = newItem.ingredientId
      row.product_id = null
    }

    const { error } = await supabase.from('recipe_ingredients').insert(row)
    if (error) {
      handleError('Błąd dodawania składnika', error)
      setSavingIngredient(false)
      return
    }
    setNewItem({ ingredientId: '', productId: '', source: 'ingredient', quantity: '1', unit: '' })
    fetchRecipeIngredients(selectedRecipeId)
    setSavingIngredient(false)
  }

  const updateRecipeIngredient = async (item: RecipeIngredient) => {
    const { error } = await supabase
      .from('recipe_ingredients')
      .update({ quantity: item.quantity, unit: item.unit })
      .eq('id', item.id)
    if (error) {
      handleError('Błąd aktualizacji składnika', error)
      return
    }
    fetchRecipeIngredients(selectedRecipeId)
  }

  const removeRecipeIngredient = async (id: string) => {
    const { error } = await supabase.from('recipe_ingredients').delete().eq('id', id)
    if (error) {
      handleError('Błąd usuwania składnika', error)
      return
    }
    fetchRecipeIngredients(selectedRecipeId)
  }

  const statusCls = (s: string | null) =>
    s === 'active' ? 'status-green' : 'status-gray'

  return (
    <div className="space-y-6">

      {/* ── Section: Dania w menu ────────────────────── */}
      <section className="bg-white border border-[#E5E7EB] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <div>
            <h2 className="text-[14px] font-semibold text-[#111827]">Dania w menu</h2>
            <p className="text-[12px] text-[#6B7280] mt-0.5">{dishes.length} pozycji</p>
          </div>
        </div>

        {/* Add dish form */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">
            Nowe danie
          </p>
          <div className="grid grid-cols-6 gap-2 items-end">
            <div>
              <Label className="text-[11px] text-[#6B7280] mb-1 block">Receptura</Label>
              <Select value={newDish.recipeId} onValueChange={(val) => setNewDish({ ...newDish, recipeId: val })}>
                <SelectTrigger className="h-8 text-[13px]">
                  <SelectValue placeholder="Wybierz…" />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-[#6B7280] mb-1 block">Lokalizacja</Label>
              <Select value={newDish.locationId} onValueChange={(val) => setNewDish({ ...newDish, locationId: val })}>
                <SelectTrigger className="h-8 text-[13px]">
                  <SelectValue placeholder="Wybierz…" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Nazwa dania"
              value={newDish.dishName}
              onChange={(e) => setNewDish({ ...newDish, dishName: e.target.value })}
              className="h-8 text-[13px]"
            />
            <Input
              type="number"
              placeholder="Cena netto"
              value={newDish.priceNet}
              onChange={(e) => setNewDish({ ...newDish, priceNet: e.target.value })}
              className="h-8 text-[13px]"
            />
            <Input
              type="number"
              placeholder="VAT %"
              value={newDish.vatRate}
              onChange={(e) => setNewDish({ ...newDish, vatRate: e.target.value })}
              className="h-8 text-[13px]"
            />
            <Button
              onClick={addDish}
              disabled={savingDish}
              className="h-8 text-[13px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              {savingDish ? 'Dodawanie…' : 'Dodaj'}
            </Button>
          </div>
        </div>

        {/* Dishes table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                {['Danie', 'Receptura', 'Netto', 'Brutto', 'VAT%', 'Status', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] bg-[#F9FAFB] ${i > 1 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dishes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-[#9CA3AF]">
                    Brak dań w menu. Dodaj pierwsze danie powyżej.
                  </td>
                </tr>
              )}
              {dishes.map((d) => (
                <tr key={d.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                  {editingDishId === d.id ? (
                    <>
                      <td className="px-4 py-2">
                        <Input
                          value={editingDish.dish_name || d.dish_name}
                          onChange={(e) => setEditingDish({ ...editingDish, dish_name: e.target.value })}
                          className="h-7 text-[13px]"
                        />
                      </td>
                      <td className="px-4 py-2 text-[12px] text-[#6B7280]">
                        {recipes.find(r => r.id === d.recipe_id)?.name || d.recipe_id}
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={editingDish.menu_price_net ?? d.menu_price_net ?? ''}
                          onChange={(e) => setEditingDish({ ...editingDish, menu_price_net: Number(e.target.value) })}
                          className="h-7 text-[13px] text-right w-24 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={editingDish.menu_price_gross ?? d.menu_price_gross ?? ''}
                          onChange={(e) => setEditingDish({ ...editingDish, menu_price_gross: Number(e.target.value) })}
                          className="h-7 text-[13px] text-right w-24 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={editingDish.vat_rate ?? d.vat_rate ?? 8}
                          onChange={(e) => setEditingDish({ ...editingDish, vat_rate: Number(e.target.value) })}
                          className="h-7 text-[13px] text-right w-16 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={editingDish.status ?? d.status ?? 'active'}
                          onChange={(e) => setEditingDish({ ...editingDish, status: e.target.value })}
                          className="h-7 text-[13px] w-24 ml-auto"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => saveDish({ ...d, ...editingDish } as Dish)}
                            className="h-7 px-2.5 rounded text-[12px] font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" /> Zapisz
                          </button>
                          <button
                            onClick={() => setEditingDishId(null)}
                            className="h-7 px-2 rounded text-[12px] text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
                          >
                            Anuluj
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-[13px] font-medium text-[#111827]">{d.dish_name}</td>
                      <td className="px-4 py-3 text-[12px] text-[#6B7280]">
                        {recipes.find(r => r.id === d.recipe_id)?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-right tabular-nums text-[#374151]">
                        {d.menu_price_net != null ? `${d.menu_price_net.toFixed(2)} zł` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-right tabular-nums font-semibold text-[#111827]">
                        {d.menu_price_gross != null ? `${d.menu_price_gross.toFixed(2)} zł` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-right tabular-nums text-[#374151]">
                        {d.vat_rate ?? 8}%
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusCls(d.status)}>
                          {d.status === 'active' ? 'Aktywne' : d.status ?? 'active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => { setEditingDishId(d.id); setEditingDish(d) }}
                            className="h-7 px-2.5 rounded text-[12px] font-medium border border-[#E5E7EB] text-[#374151] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                          >
                            Edytuj
                          </button>
                          <button
                            onClick={() => deleteDish(d.id)}
                            className="h-7 px-2 rounded text-[12px] text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section: Receptury ──────────────────────── */}
      <section className="bg-white border border-[#E5E7EB] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <div>
            <h2 className="text-[14px] font-semibold text-[#111827]">Receptury</h2>
            <p className="text-[12px] text-[#6B7280] mt-0.5">{recipes.length} receptur</p>
          </div>
        </div>

        {/* Add recipe form */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">
            Nowa receptura
          </p>
          <div className="grid grid-cols-4 gap-2 items-end">
            <Input
              placeholder="Nazwa receptury"
              value={newRecipe.name}
              onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
              className="h-8 text-[13px]"
            />
            <Input
              placeholder="Kategoria (opcjonalnie)"
              value={newRecipe.category}
              onChange={(e) => setNewRecipe({ ...newRecipe, category: e.target.value })}
              className="h-8 text-[13px]"
            />
            <Input
              placeholder="Porcje"
              type="number"
              value={newRecipe.portions}
              onChange={(e) => setNewRecipe({ ...newRecipe, portions: e.target.value })}
              className="h-8 text-[13px]"
            />
            <Button
              onClick={addRecipe}
              disabled={savingRecipe}
              className="h-8 text-[13px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              {savingRecipe ? 'Dodawanie…' : 'Dodaj recepturę'}
            </Button>
          </div>
        </div>

        {/* Recipe selector */}
        <div className="px-5 py-4">
          <div className="flex gap-3 items-center">
            <div className="flex-1 max-w-sm">
              <Label className="text-[11px] text-[#6B7280] mb-1.5 block">Wybierz recepturę do edycji składników</Label>
              <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Wybierz recepturę…" />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRecipe && (
              <button
                onClick={() => deleteRecipe(selectedRecipe.id)}
                className="mt-5 h-9 px-3 rounded-md text-[13px] font-medium border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] hover:border-[#FECACA] transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Usuń recepturę
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Section: Składniki receptury ─────────────── */}
      {selectedRecipe && (
        <section className="bg-white border border-[#E5E7EB] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
            <div>
              <h2 className="text-[14px] font-semibold text-[#111827]">
                Składniki — {selectedRecipe.name}
              </h2>
              <p className="text-[12px] text-[#6B7280] mt-0.5">
                Koszt receptury:&nbsp;
                <span className="font-semibold tabular-nums text-[#111827]">
                  {recipeCost.toFixed(2)} zł
                </span>
              </p>
            </div>
          </div>

          {/* Add ingredient form */}
          <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">
              Dodaj składnik / produkt
            </p>
            <div className="grid grid-cols-5 gap-2 items-end">
              <div>
                <Label className="text-[11px] text-[#6B7280] mb-1 block">Typ</Label>
                <Select value={newItem.source} onValueChange={(val) => setNewItem({ ...newItem, source: val, ingredientId: '', productId: '' })}>
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingredient">Składnik</SelectItem>
                    <SelectItem value="product">Produkt magazynowy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-[#6B7280] mb-1 block">
                  {newItem.source === 'product' ? 'Produkt' : 'Składnik'}
                </Label>
                {newItem.source === 'product' ? (
                  <Select value={newItem.productId} onValueChange={(val) => setNewItem({ ...newItem, productId: val })}>
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue placeholder="Wybierz…" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={newItem.ingredientId} onValueChange={(val) => setNewItem({ ...newItem, ingredientId: val })}>
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue placeholder="Wybierz…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients.map((ing) => (
                        <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label className="text-[11px] text-[#6B7280] mb-1 block">Ilość</Label>
                <Input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  className="h-8 text-[13px]"
                />
              </div>
              <div>
                <Label className="text-[11px] text-[#6B7280] mb-1 block">Jednostka</Label>
                <Input
                  placeholder="kg / g / l"
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  className="h-8 text-[13px]"
                />
              </div>
              <Button
                onClick={addRecipeIngredient}
                disabled={savingIngredient}
                className="h-8 text-[13px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5" />
                {savingIngredient ? 'Dodawanie…' : 'Dodaj'}
              </Button>
            </div>
          </div>

          {/* Ingredients table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  {['Składnik / Produkt', 'Typ', 'Ilość', 'Jednostka', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] bg-[#F9FAFB] ${i === 4 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recipeIngredients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-[#9CA3AF]">
                      Brak składników. Dodaj pierwszy składnik powyżej.
                    </td>
                  </tr>
                )}
                {recipeIngredients.map((ri) => (
                  <tr key={ri.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-2.5 text-[13px] font-medium text-[#111827]">
                      {ri.source === 'product'
                        ? (ri.inventory_products?.name || ri.product_id || '—')
                        : (Array.isArray(ri.ingredients)
                          ? (ri.ingredients[0]?.name || ri.ingredient_id)
                          : (ri.ingredients?.name || ri.ingredient_id))}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${ri.source === 'product' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                        {ri.source === 'product' ? 'Produkt' : 'Składnik'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={ri.quantity}
                        onChange={(e) =>
                          setRecipeIngredients((prev) =>
                            prev.map((p) => (p.id === ri.id ? { ...p, quantity: Number(e.target.value) } : p))
                          )
                        }
                        className="h-7 text-[13px] w-24 tabular-nums"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={ri.unit}
                        onChange={(e) =>
                          setRecipeIngredients((prev) =>
                            prev.map((p) => (p.id === ri.id ? { ...p, unit: e.target.value } : p))
                          )
                        }
                        className="h-7 text-[13px] w-20"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => updateRecipeIngredient(ri)}
                          className="h-7 px-2.5 rounded text-[12px] font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors flex items-center gap-1"
                        >
                          <Save className="w-3 h-3" /> Zapisz
                        </button>
                        <button
                          onClick={() => removeRecipeIngredient(ri.id)}
                          className="h-7 px-2 rounded text-[12px] text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
