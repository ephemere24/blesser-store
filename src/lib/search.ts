import Fuse from 'fuse.js'

export interface SearchableProduct {
  id: number
  name: string
  price: number
  category: string
  specs?: string | null
  flavors?: { name: string }[]
}

// Grupos de términos equivalentes. Cada palabra de un grupo es sinónimo de las demás.
// Amplía libremente: añade una fila o una palabra a una fila existente.
const SYNONYMS: string[][] = [
  ['vaper', 'vape', 'pod', 'desechable', 'cachimba', 'pen'],
  ['liquido', 'eliquid', 'esencia', 'sales', 'nicotina'],
  ['fresa', 'strawberry', 'fresas'],
  ['menta', 'mint', 'hierbabuena', 'menthol', 'mentol'],
  ['sandia', 'watermelon'],
  ['mango'],
  ['platano', 'banana', 'plátano'],
  ['arandano', 'blueberry', 'arandanos'],
  ['frambuesa', 'raspberry'],
  ['uva', 'grape'],
  ['manzana', 'apple'],
  ['melocoton', 'peach', 'durazno'],
  ['limon', 'lemon'],
  ['lima', 'lime'],
  ['cola', 'cocacola', 'refresco'],
  ['hielo', 'ice', 'frio', 'cool'],
  ['energetica', 'energy', 'redbull'],
  ['cereza', 'cherry'],
  ['pina', 'pineapple', 'piña'],
  ['coco', 'coconut'],
  ['mora', 'blackberry'],
  ['tabaco', 'tobacco'],
  ['chicle', 'gum', 'bubblegum'],
  ['maracuya', 'passion', 'passionfruit', 'maracuyá'],
  ['naranja', 'orange'],
]

// Quita acentos y pasa a minúsculas.
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').trim()
}

// Mapa término(normalizado) -> grupo completo de sinónimos (normalizados).
const SYN_MAP: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>()
  for (const group of SYNONYMS) {
    const norm = group.map(normalize)
    for (const t of norm) m.set(t, norm)
  }
  return m
})()

const PRICE_MARGIN = 0.15 // ±15%
const PRICE_MIN_ABS = 1 // margen mínimo ±1€

// Detecta un número (precio) en la query, p. ej. "10", "10€", "10 eur".
function extractPrice(q: string): number | null {
  const m = normalize(q).match(/(\d+(?:[.,]\d+)?)\s*(?:e|eur|euros)?\b/)
  if (!m) return null
  const v = parseFloat(m[1].replace(',', '.'))
  return isNaN(v) ? null : v
}

// Quita el token numérico de la parte de texto.
function stripPrice(q: string): string {
  return normalize(q).replace(/\b\d+(?:[.,]\d+)?\s*(?:e|eur|euros)?\b/g, '').trim()
}

export function makeFuse<T extends SearchableProduct>(products: T[]): Fuse<T> {
  return new Fuse(products, {
    includeScore: true,
    threshold: 0.4, // tolerancia a erratas (0 = exacto, 1 = todo)
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'category', weight: 0.2 },
      { name: 'flavors.name', weight: 0.2 },
      { name: 'specs', weight: 0.1 },
    ],
  })
}

/**
 * Busca productos con tolerancia a erratas + sinónimos + precio aproximado.
 * - Varias palabras → deben coincidir TODAS (AND).
 * - Sinónimos de una palabra → basta con UNA (OR).
 * - Número en la query → filtra por precio cercano (±15%, mín ±1€).
 * Devuelve los productos ordenados por relevancia.
 */
export function searchProducts<T extends SearchableProduct>(
  fuse: Fuse<T>,
  all: T[],
  rawQuery: string
): T[] {
  const q = rawQuery.trim()
  if (!q) return all

  const price = extractPrice(q)
  const textPart = stripPrice(q)

  let textMatches: T[] | null = null
  if (textPart) {
    const tokens = textPart.split(/\s+/).filter(Boolean)
    let acc: Set<number> | null = null
    const bestScore = new Map<number, number>()

    for (const tok of tokens) {
      const syns = SYN_MAP.get(tok) ?? [tok]
      const idsForToken = new Set<number>()
      for (const s of syns) {
        for (const r of fuse.search(s)) {
          idsForToken.add(r.item.id)
          const sc = r.score ?? 1
          const prev = bestScore.get(r.item.id)
          if (prev == null || sc < prev) bestScore.set(r.item.id, sc)
        }
      }
      acc = acc == null ? idsForToken : new Set([...acc].filter((id: number) => idsForToken.has(id)))
    }

    const ids = acc ?? new Set<number>()
    textMatches = all
      .filter(p => ids.has(p.id))
      .sort((a, b) => (bestScore.get(a.id) ?? 1) - (bestScore.get(b.id) ?? 1))
  }

  let priceMatches: T[] | null = null
  if (price != null) {
    const margin = Math.max(price * PRICE_MARGIN, PRICE_MIN_ABS)
    priceMatches = all.filter(p => Math.abs(p.price - price) <= margin)
  }

  // Combinar: texto + precio → intersección. Solo uno → ese.
  if (textMatches && priceMatches) {
    const okIds = new Set(priceMatches.map(p => p.id))
    return textMatches.filter(p => okIds.has(p.id))
  }
  if (textMatches) return textMatches
  if (priceMatches) return priceMatches
  return all
}

// Trocea un texto resaltando coincidencias (sin acentos) de los tokens de la query.
export function splitHighlight(text: string, rawQuery: string): { text: string; hit: boolean }[] {
  const tokens = stripPrice(rawQuery).split(/\s+/).filter(t => t.length >= 2)
  if (tokens.length === 0) return [{ text, hit: false }]
  const normText = normalize(text)
  // Marca por índice si forma parte de alguna coincidencia.
  const marks = new Array(text.length).fill(false)
  for (const tok of tokens) {
    let from = 0
    while (true) {
      const idx = normText.indexOf(tok, from)
      if (idx === -1) break
      for (let i = idx; i < idx + tok.length && i < marks.length; i++) marks[i] = true
      from = idx + tok.length
    }
  }
  const parts: { text: string; hit: boolean }[] = []
  let cur = ''
  let curHit = marks[0] ?? false
  for (let i = 0; i < text.length; i++) {
    if (marks[i] === curHit) cur += text[i]
    else {
      parts.push({ text: cur, hit: curHit })
      cur = text[i]
      curHit = marks[i]
    }
  }
  if (cur) parts.push({ text: cur, hit: curHit })
  return parts
}
