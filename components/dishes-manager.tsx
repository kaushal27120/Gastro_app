'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, Save } from 'lucide-react'

interface DishesManagerProps {
  supabase: SupabaseClient
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

type RecipeIngredient = {
  id: string
  ingredient_id: string
  quantity: number
  unit: string
  cost_per_unit?: number | null
  ingredients?: { name: string; base_unit: string; category: string } | { name: string; base_unit: string; category: string }[] | null
}

export function DishesManager({ supabase }: DishesManagerProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [dishes, setDishes] = useState<Dish[]>([])
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('')
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([])
  const [recipeCost, setRecipeCost] = useState<number>(0)
  const [newRecipe, setNewRecipe] = useState({ name: '', category: '', portions: '1' })
  const [newItem, setNewItem] = useState({ ingredientId: '', quantity: '1', unit: '' })
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

  const fetchLocations = async () => {
    const { data } = await supabase.from('locations').select('id, name').order('name')
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
      .select('id, ingredient_id, quantity, unit, cost_per_unit, ingredients(name, base_unit, category)')
      .eq('recipe_id', recipeId)
      .order('id')

    setRecipeIngredients((data as RecipeIngredient[]) || [])
    await computeRecipeCost(recipeId, (data as RecipeIngredient[]) || [])
  }

  const computeRecipeCost = async (recipeId: string, items?: RecipeIngredient[]) => {
    const ingredientsList = items || recipeIngredients
    if (!ingredientsList.length) {
      setRecipeCost(0)
      return
    }

    const ingredientIds = ingredientsList.map(i => i.ingredient_id)
    const { data: prices } = await supabase
      .from('ingredient_prices_history')
      .select('ingredient_id, price, recorded_at')
      .in('ingredient_id', ingredientIds)
      .order('recorded_at', { ascending: false })

    const latestPrice: Record<string, number> = {}
    ;(prices || []).forEach((p: any) => {
      if (latestPrice[p.ingredient_id] === undefined) {
        latestPrice[p.ingredient_id] = Number(p.price || 0)
      }
    })

    const total = ingredientsList.reduce((sum, item) => {
      const price = latestPrice[item.ingredient_id] ?? Number(item.cost_per_unit || 0)
      return sum + (Number(item.quantity || 0) * Number(price || 0))
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
    if (!selectedRecipeId || !newItem.ingredientId) {
      alert('Wybierz składnik i recepturę')
      return
    }
    setSavingIngredient(true)
    const unit = newItem.unit || ingredients.find(i => i.id === newItem.ingredientId)?.base_unit || 'kg'

    const { error } = await supabase.from('recipe_ingredients').insert({
      recipe_id: selectedRecipeId,
      ingredient_id: newItem.ingredientId,
      quantity: Number(newItem.quantity) || 0,
      unit,
    })

    if (error) {
      handleError('Błąd dodawania składnika', error)
      setSavingIngredient(false)
      return
    }
    if (!error) {
      setNewItem({ ingredientId: '', quantity: '1', unit: '' })
      fetchRecipeIngredients(selectedRecipeId)
    }
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Menu - Dania (ceny)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-6 gap-3 items-end">
            <div>
              <Label className="text-xs">Receptura</Label>
              <Select value={newDish.recipeId} onValueChange={(val) => setNewDish({ ...newDish, recipeId: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz" />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Lokalizacja</Label>
              <Select value={newDish.locationId} onValueChange={(val) => setNewDish({ ...newDish, locationId: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Nazwa dania"
              value={newDish.dishName}
              onChange={(e) => setNewDish({ ...newDish, dishName: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Cena net"
              value={newDish.priceNet}
              onChange={(e) => setNewDish({ ...newDish, priceNet: e.target.value })}
            />
            <Input
              type="number"
              placeholder="VAT %"
              value={newDish.vatRate}
              onChange={(e) => setNewDish({ ...newDish, vatRate: e.target.value })}
            />
            <Button onClick={addDish} className="gap-2" disabled={savingDish}>
              <Plus className="w-4 h-4" /> Dodaj danie
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">Danie</th>
                  <th className="text-left p-2">Receptura</th>
                  <th className="text-right p-2">Netto</th>
                  <th className="text-right p-2">Brutto</th>
                  <th className="text-right p-2">VAT%</th>
                  <th className="text-right p-2">Status</th>
                  <th className="text-right p-2">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((d) => (
                  <tr key={d.id} className="border-b">
                    {editingDishId === d.id ? (
                      <>
                        <td className="p-2">
                          <Input value={editingDish.dish_name || d.dish_name} onChange={(e) => setEditingDish({ ...editingDish, dish_name: e.target.value })} />
                        </td>
                        <td className="p-2 text-xs">
                          {recipes.find(r => r.id === d.recipe_id)?.name || d.recipe_id}
                        </td>
                        <td className="p-2">
                          <Input type="number" value={editingDish.menu_price_net ?? d.menu_price_net ?? ''} onChange={(e) => setEditingDish({ ...editingDish, menu_price_net: Number(e.target.value) })} />
                        </td>
                        <td className="p-2">
                          <Input type="number" value={editingDish.menu_price_gross ?? d.menu_price_gross ?? ''} onChange={(e) => setEditingDish({ ...editingDish, menu_price_gross: Number(e.target.value) })} />
                        </td>
                        <td className="p-2">
                          <Input type="number" value={editingDish.vat_rate ?? d.vat_rate ?? 8} onChange={(e) => setEditingDish({ ...editingDish, vat_rate: Number(e.target.value) })} />
                        </td>
                        <td className="p-2">
                          <Input value={editingDish.status ?? d.status ?? 'active'} onChange={(e) => setEditingDish({ ...editingDish, status: e.target.value })} />
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => saveDish({ ...d, ...editingDish } as Dish)}>
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setEditingDishId(null)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-2 font-medium">{d.dish_name}</td>
                        <td className="p-2 text-xs">{recipes.find(r => r.id === d.recipe_id)?.name || d.recipe_id}</td>
                        <td className="p-2 text-right">{d.menu_price_net ?? '-'}</td>
                        <td className="p-2 text-right">{d.menu_price_gross ?? '-'}</td>
                        <td className="p-2 text-right">{d.vat_rate ?? 8}</td>
                        <td className="p-2 text-right">{d.status ?? 'active'}</td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setEditingDishId(d.id); setEditingDish(d) }}>
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteDish(d.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dodaj nowe danie / recepturę</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-3">
          <Input
            placeholder="Nazwa dania"
            value={newRecipe.name}
            onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
          />
          <Input
            placeholder="Kategoria (opcjonalnie)"
            value={newRecipe.category}
            onChange={(e) => setNewRecipe({ ...newRecipe, category: e.target.value })}
          />
          <Input
            placeholder="Porcje"
            type="number"
            value={newRecipe.portions}
            onChange={(e) => setNewRecipe({ ...newRecipe, portions: e.target.value })}
          />
          <Button onClick={addRecipe} className="gap-2" disabled={savingRecipe}>
            <Plus className="w-4 h-4" /> Dodaj
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wybierz danie</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 items-center">
          <div className="flex-1">
            <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz danie..." />
              </SelectTrigger>
              <SelectContent>
                {recipes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedRecipe && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteRecipe(selectedRecipe.id)}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" /> Usuń danie
            </Button>
          )}
        </CardContent>
      </Card>

      {selectedRecipe && (
        <Card>
          <CardHeader>
            <CardTitle>Składniki dla: {selectedRecipe.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-600">
              Aktualny koszt receptury: <span className="font-semibold">{recipeCost.toFixed(2)} zł</span>
            </div>
            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs">Składnik</Label>
                <Select value={newItem.ingredientId} onValueChange={(val) => setNewItem({ ...newItem, ingredientId: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz składnik" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients.map((ing) => (
                      <SelectItem key={ing.id} value={ing.id}>
                        {ing.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ilość</Label>
                <Input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Jednostka</Label>
                <Input
                  placeholder="kg / g / l"
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                />
              </div>
              <Button onClick={addRecipeIngredient} className="gap-2" disabled={savingIngredient}>
                <Plus className="w-4 h-4" /> Dodaj składnik
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2">Składnik</th>
                    <th className="text-left p-2">Ilość</th>
                    <th className="text-left p-2">Jednostka</th>
                    <th className="text-right p-2">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {recipeIngredients.map((ri) => (
                    <tr key={ri.id} className="border-b">
                      <td className="p-2">
                        {Array.isArray(ri.ingredients)
                          ? (ri.ingredients[0]?.name || ri.ingredient_id)
                          : (ri.ingredients?.name || ri.ingredient_id)}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={ri.quantity}
                          onChange={(e) =>
                            setRecipeIngredients((prev) =>
                              prev.map((p) => (p.id === ri.id ? { ...p, quantity: Number(e.target.value) } : p))
                            )
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={ri.unit}
                          onChange={(e) =>
                            setRecipeIngredients((prev) =>
                              prev.map((p) => (p.id === ri.id ? { ...p, unit: e.target.value } : p))
                            )
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateRecipeIngredient(ri)}>
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => removeRecipeIngredient(ri.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
