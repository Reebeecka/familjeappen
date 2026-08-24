import {
  ListTodo,
  ShoppingCart,
  StickyNote,
  House,
  Gift,
  Heart,
  Star,
  Car,
  Plane,
  BookOpen,
  Dumbbell,
  PawPrint,
} from 'lucide-react'

// Namngivna nycklar sparas i lists.icon. Äldre listor kan innehålla
// emoji-strängar – då faller vi tillbaka på typens standardikon.
export const LIST_ICONS = {
  check: ListTodo,
  cart: ShoppingCart,
  note: StickyNote,
  home: House,
  gift: Gift,
  heart: Heart,
  star: Star,
  car: Car,
  plane: Plane,
  book: BookOpen,
  fitness: Dumbbell,
  pet: PawPrint,
}

export const LIST_ICON_KEYS = Object.keys(LIST_ICONS)

export const DEFAULT_LIST_ICON = {
  todo: 'check',
  shopping: 'cart',
  simple: 'note',
}

function resolveKey(icon, type) {
  if (icon && LIST_ICONS[icon]) return icon
  return DEFAULT_LIST_ICON[type] ?? 'note'
}

export function ListIcon({ icon, type = 'todo', size = 20, strokeWidth = 1.75, ...props }) {
  const Component = LIST_ICONS[resolveKey(icon, type)]
  return <Component size={size} strokeWidth={strokeWidth} {...props} />
}
