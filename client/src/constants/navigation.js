import { Compass, Boxes, Plus, ClipboardList, Truck, TrendingUp, Search, HandHeart } from 'lucide-react'

export const navByRole = {
  donor: [{ to: '/app', label: 'Overview', icon: Compass }, { to: '/app/donations', label: 'My listings', icon: Boxes }, { to: '/app/new', label: 'Share food', icon: Plus }, { to: '/app/requests', label: 'Requests', icon: ClipboardList }, { to: '/app/deliveries', label: 'Deliveries', icon: Truck }, { to: '/app/impact', label: 'Impact', icon: TrendingUp }],
  recipient: [{ to: '/app', label: 'Overview', icon: Compass }, { to: '/app/donations', label: 'Find food', icon: Search }, { to: '/app/requests', label: 'My requests', icon: ClipboardList }, { to: '/app/deliveries', label: 'Pickups & deliveries', icon: Truck }, { to: '/app/distributions', label: 'Distribution records', icon: HandHeart }, { to: '/app/impact', label: 'Community impact', icon: TrendingUp }],
  partner: [{ to: '/app', label: 'Today', icon: Compass }, { to: '/app/deliveries', label: 'My deliveries', icon: Truck }, { to: '/app/impact', label: 'My contribution', icon: TrendingUp }],
}
