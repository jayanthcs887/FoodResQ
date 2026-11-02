const demoDonations = [
  { id: 'd1', title: 'Roasted harvest bowls', organization: 'Little Fern Kitchen', category: 'Prepared meals', foodType: 'Vegetarian', quantity: 36, unit: 'portions', portions: 36, locality: 'Brooklyn', address: '248 Wythe Avenue, Brooklyn', deadline: 'Today, 7:30 PM', time: Date.now() + 1000 * 60 * 60 * 2.5, storage: 'Chilled, sealed containers', status: 'available', distance: '0.8 mi', donor: 'demo-donor', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=85' },
  { id: 'd2', title: 'Fresh sourdough & rolls', organization: 'Daybreak Bakehouse', category: 'Bakery', foodType: 'Vegan', quantity: 24, unit: 'boxes', portions: 24, locality: 'Williamsburg', address: '19 Berry Street, Brooklyn', deadline: 'Today, 8:00 PM', time: Date.now() + 1000 * 60 * 60 * 3, storage: 'Room temperature, paper-wrapped', status: 'available', distance: '1.4 mi', donor: 'demo-other', image: 'https://images.unsplash.com/photo-1585478259715-876acc5be8eb?auto=format&fit=crop&w=700&q=85' },
  { id: 'd3', title: 'Seasonal market produce', organization: 'Sunday Market Co-op', category: 'Produce', foodType: 'Vegan', quantity: 18, unit: 'kg', portions: 42, locality: 'Greenpoint', address: '82 Franklin Street, Brooklyn', deadline: 'Tomorrow, 10:00 AM', time: Date.now() + 1000 * 60 * 60 * 16, storage: 'Fresh, reusable crates', status: 'available', distance: '2.1 mi', donor: 'demo-other', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=700&q=85' },
  { id: 'd4', title: 'Lentil stew & rice', organization: 'Little Fern Kitchen', category: 'Prepared meals', foodType: 'Vegan', quantity: 28, unit: 'portions', portions: 28, locality: 'Brooklyn', address: '248 Wythe Avenue, Brooklyn', deadline: 'Yesterday, 8:00 PM', time: Date.now() - 1000 * 60 * 60 * 5, storage: 'Chilled, sealed containers', status: 'delivered', distance: '0.8 mi', donor: 'demo-donor', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=85' },
]

const DEMO_USERS = {
  donor: { id: 'demo-donor', name: 'Maya Chen', email: 'maya@littlefern.demo', role: 'donor', organization: 'Little Fern Kitchen', locality: 'Brooklyn' },
  recipient: { id: 'demo-recipient', name: 'Elena Rivera', email: 'elena@harbor.demo', role: 'recipient', organization: 'Harbor Community Table', locality: 'Brooklyn' },
  partner: { id: 'demo-partner', name: 'Sam Okafor', email: 'sam@rescue.demo', role: 'partner', organization: 'FoodResQ Delivery', locality: 'Brooklyn' },
}

const initialData = {
  donations: demoDonations,
  requests: [{ id: 'r1', donationId: 'd1', organization: 'Harbor Community Table', quantity: 16, status: 'pending', time: '18 min ago', note: 'We can collect before the 7:30pm deadline.', recipient: 'demo-recipient' }],
  notices: [{ id: 'n1', title: 'A nearby match is waiting', message: 'Fresh sourdough & rolls · 1.4 mi away', time: '18 min ago', unread: true }, { id: 'n2', title: 'Delivery completed', message: '28 portions reached Harbor Community Table.', time: 'Yesterday', unread: false }],
  incidents: [],
  distributions: [],
  deliveries: [{ id: 'trip-1', donationId: 'd1', title: 'Roasted harvest bowls', organization: 'Little Fern Kitchen', to: 'Harbor Community Table', status: 'to_pickup', distance: '0.8 mi', deadline: 'Today, 7:30 PM', donor: 'demo-donor', recipient: 'demo-recipient', partner: 'demo-partner', portions: 36, lat: 40.7168, lng: -73.9596, updatedAt: Date.now() - 1000 * 60 * 3 }],
}

export { DEMO_USERS, demoDonations, initialData }
