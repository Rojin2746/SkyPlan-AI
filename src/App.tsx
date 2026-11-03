import { useState, type FormEvent } from 'react'
import {
  ArrowDownUp,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Compass,
  Globe2,
  MapPin,
  Menu,
  Plane,
  Search,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react'

type Flight = {
  airline: string
  code: string
  departure: string
  arrival: string
  duration: string
  price: number
  stops: string
  booking_token?: string | null
  departure_token?: string | null
}

type BookingOption = {
  provider: string
  price: number | string | null
  currency: string
  ticket_type: string
  booking_url?: string | null
  booking_post_data?: string | null
  booking_phone?: string | null
}

type FlightSort = 'recommended' | 'price_low' | 'price_high' | 'duration'

type ItineraryDay = {
  day: number
  morning: string
  afternoon: string
  evening: string
  estimated_budget: number
}
type SavedTrip = {
  id: number
  destination: string
  days: number
  budget: number
  travel_style: string
  itinerary: ItineraryDay[]
  created_at: string
}
const demoFlights: Flight[] = [
  {
    airline: 'IndiGo',
    code: '6E 204',
    departure: '06:15',
    arrival: '08:50',
    duration: '2h 35m',
    price: 4299,
    stops: 'Non-stop',
  },
  {
    airline: 'Air India',
    code: 'AI 672',
    departure: '10:30',
    arrival: '13:05',
    duration: '2h 35m',
    price: 5180,
    stops: 'Non-stop',
  },
  {
    airline: 'Akasa Air',
    code: 'QP 1384',
    departure: '16:45',
    arrival: '19:30',
    duration: '2h 45m',
    price: 4760,
    stops: 'Non-stop',
  },
]

const destinations = [
  {
    name: 'Bali',
    country: 'Indonesia',
    price: '₹24,999',
    tag: 'Island escape',
    image:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Dubai',
    country: 'United Arab Emirates',
    price: '₹18,499',
    tag: 'City & luxury',
    image:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Paris',
    country: 'France',
    price: '₹42,999',
    tag: 'Romantic getaway',
    image:
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Singapore',
    country: 'Singapore',
    price: '₹16,999',
    tag: 'Adventure awaits',
    image:
      'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=900&q=85',
  },
]


function App() {
  const [tripType, setTripType] = useState<'round' | 'oneway'>('round')
  const [from, setFrom] = useState('Kochi (COK)')
  const [to, setTo] = useState('Dubai (DXB)')
  const [departDate, setDepartDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [passengers, setPassengers] = useState('1 Adult')
  const [showFlights, setShowFlights] = useState(false)
  const [flights, setFlights] = useState<typeof demoFlights>(demoFlights)
  const [returnFlights, setReturnFlights] = useState<Flight[]>([])
  const [, setSelectedReturnFlight] = useState<Flight | null>(null)
  const [flightStage, setFlightStage] = useState<'outbound' | 'return' | 'booking'>('outbound')
  const [airlineFilter, setAirlineFilter] = useState('all')
  const [maxStopsFilter, setMaxStopsFilter] = useState('all')
  const [sortBy, setSortBy] = useState<FlightSort>('recommended')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null)
  const [bookingOptions, setBookingOptions] = useState<BookingOption[]>([])
  const [isLoadingBookingOptions, setIsLoadingBookingOptions] = useState(false)
  const [bookingMessage, setBookingMessage] = useState('')
  const [destination, setDestination] = useState('Bali')
  const [days, setDays] = useState('5')
  const [budget, setBudget] = useState('50000')
  const [travelStyle, setTravelStyle] = useState('Culture & sightseeing')
  
  const [plan, setPlan] = useState(false)
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([])
  const [savingTrip, setSavingTrip] = useState(false)
  const [showMyTrips, setShowMyTrips] = useState(false)
  const [editingTripId, setEditingTripId] = useState<number | null>(null)
  const [editDestination, setEditDestination] = useState('')
  const [editDays, setEditDays] = useState(3)
  const [editBudget, setEditBudget] = useState(15000)
  const [editTravelStyle, setEditTravelStyle] = useState('Nature and sightseeing')
  const [updatingTrip, setUpdatingTrip] = useState(false)
  const [deletingTripId, setDeletingTripId] = useState<number | null>(null)
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([])
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)


  // Add the two new lines here
  const [fromCategory, setFromCategory] = useState<'domestic' | 'international'>('domestic')
  const [toCategory, setToCategory] = useState<'international' | 'domestic'>('international')

  // Keep the rest of your existing code below
  const [menuOpen, setMenuOpen] = useState(false)
  function swapCities() {
  setFrom(to)
  setTo(from)
  setFromCategory(toCategory)
  setToCategory(fromCategory)
}


function getDurationMinutes(duration: string): number {
  const hours = Number(duration.match(/(\d+)h/)?.[1] ?? 0)
  const minutes = Number(duration.match(/(\d+)m/)?.[1] ?? 0)
  return hours * 60 + minutes
}

const filteredFlights = flights
  .filter((flight) => {
    return (
      airlineFilter === 'all' ||
      flight.airline === airlineFilter
    )
  })
  .filter((flight) => {
    if (maxStopsFilter === 'all') return true

    const stops = flight.stops.toLowerCase()
    const stopCount = stops.includes('non-stop')
      ? 0
      : Number(stops.match(/\d+/)?.[0] ?? 0)

    return stopCount <= Number(maxStopsFilter)
  })
  .slice()
  .sort((a, b) => {
    if (sortBy === 'price_low') return a.price - b.price
    if (sortBy === 'price_high') return b.price - a.price

    if (sortBy === 'duration') {
      return getDurationMinutes(a.duration) -
        getDurationMinutes(b.duration)
    }

    return 0
  })


 async function searchFlights(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()

  if (tripType === 'round' && !returnDate) {
    window.alert('Please select a return date.')
    return
  }

  if (
    tripType === 'round' &&
    returnDate &&
    returnDate < departDate
  ) {
    window.alert('Return date cannot be before departure date.')
    return
  }

  if (from === to) {
    window.alert('Departure and destination must be different.')
    return
  }

  const passengerCount = Number.parseInt(passengers, 10) || 1

  setIsSearching(true)
  setShowFlights(false)
  setSelectedFlight(null)
  setBookingOptions([])
  setBookingMessage('')
  setAirlineFilter('all')
  setMaxStopsFilter('all')
  setSortBy('recommended')

  try {
    const response = await fetch(
      'http://127.0.0.1:8000/api/flights/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: from,
          destination: to,
          departure_date: departDate,
          return_date: tripType === 'round' ? returnDate : null,
          trip_type: tripType,
          passengers: passengerCount,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Flight search failed.')
    }

    setFlights(data.results)
    setReturnFlights([])
    setSelectedReturnFlight(null)
    setFlightStage('outbound')
    setShowFlights(true)

    setTimeout(() => {
      document
        .getElementById('flight-results')
        ?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  } catch (error) {
    console.error('Flight search error:', error)

    window.alert(
      error instanceof Error
        ? error.message
        : 'Unable to search flights. Please try again.'
    )
  } finally {
    setIsSearching(false)
  }
}
 

async function selectFlight(flight: Flight) {
  setBookingOptions([])
  setBookingMessage('')

  // STEP 1: Find return flights after selecting an outbound flight.
  if (tripType === 'round' && flightStage === 'outbound') {
    if (!flight.departure_token) {
      setBookingMessage(
        'This flight does not have a departure token. Please choose another flight.'
      )
      window.alert(
        'This outbound flight cannot be used to search for return flights. Please choose another flight.'
      )
      return
    }

    setIsLoadingBookingOptions(true)

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/api/flights/booking-options',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            departure_token: flight.departure_token,
            departure_id: from.match(/\(([A-Z]{3})\)/)?.[1] ?? from,
            arrival_id: to.match(/\(([A-Z]{3})\)/)?.[1] ?? to,
            outbound_date: departDate,
            return_date: tripType === 'round' ? returnDate : undefined,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Could not retrieve return flights.'
        )
      }

      const options: Flight[] = Array.isArray(data.return_flights)
        ? data.return_flights
        : []

      setReturnFlights(options)
      setSelectedReturnFlight(null)
      setFlightStage('return')

      if (options.length === 0) {
        window.alert(data.message || 'No return flights were found.')
      }

      setTimeout(() => {
        document
          .getElementById('return-flight-results')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (error) {
      console.error('Return-flight search error:', error)

      window.alert(
        error instanceof Error
          ? error.message
          : 'Unable to retrieve return flights.'
      )
    } finally {
      setIsLoadingBookingOptions(false)
    }

    return
  }

  // STEP 2: Select a return flight, or a one-way flight.
  if (!flight.booking_token) {
    window.alert(
      'Booking options are not available for this flight. Please choose another flight.'
    )
    return
  }

  setSelectedFlight(flight)

  if (tripType === 'round' && flightStage === 'return') {
    setSelectedReturnFlight(flight)
    setFlightStage('booking')
  }

  setIsLoadingBookingOptions(true)

  try {
    console.log('BOOKING REQUEST:', {
    departDate,
    returnDate,
    outbound_date: departDate,
  })

    const response = await fetch(
      'http://127.0.0.1:8000/api/flights/booking-options',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_token: flight.booking_token,
          departure_id: from.match(/\(([A-Z]{3})\)/)?.[1] ?? from,
          arrival_id: to.match(/\(([A-Z]{3})\)/)?.[1] ?? to,
          outbound_date: departDate,
          return_date: tripType === 'round' ? returnDate : undefined,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        typeof data.detail === 'string'
          ? data.detail
          : 'Could not retrieve booking options.'
      )
    }

    setBookingOptions(
      Array.isArray(data.booking_options)
        ? data.booking_options
        : []
    )

    setBookingMessage(
      data.message || 'Booking options returned by the flight provider.'
    )
  } catch (error) {
    console.error('Booking options error:', error)

    setBookingMessage(
      error instanceof Error
        ? error.message
        : 'Unable to retrieve booking options.'
    )
  } finally {
    setIsLoadingBookingOptions(false)
  }
}



  function chooseDestination(name: string) {
    setDestination(name)
    document.getElementById('ai-planner')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  
  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const budgetAmount = Number(budget)
    const dayCount = Number(days)

    if (!destination.trim()) {
      window.alert('Please enter a destination.')
      return
    }

    if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
      window.alert('Please enter a valid budget.')
      return
    }

    setIsGeneratingPlan(true)
    setPlan(false)

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/api/itinerary',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destination: destination.trim(),
            days: dayCount,
            budget: budgetAmount,
            travel_style: travelStyle,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Unable to generate the itinerary.'
        )
      }

      

      setItinerary(data.itinerary)
      setPlan(true)
    } catch (error) {
      console.error('Itinerary generation error:', error)

      window.alert(
        error instanceof Error
          ? error.message
          : 'Could not connect to the backend. Check that the Python server is running.'
      )
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  async function saveTrip() {
    setSavingTrip(true)

    try {
      const response = await fetch('http://127.0.0.1:8000/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destination.trim(),
          days: Number(days),
          budget: Number(budget),
          travel_style: travelStyle,
          itinerary,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Could not save the trip.'
        )
      }

      window.alert('Trip saved successfully!')
      await loadSavedTrips()
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : 'Could not save the trip.'
      )
    } finally {
      setSavingTrip(false)
    }
  }

  async function loadSavedTrips() {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/trips')
      if (!response.ok) throw new Error('Could not load saved trips.')

      const data = await response.json()
      setSavedTrips(data)
    } catch (error) {
      console.error('Loading saved trips failed:', error)
      window.alert('Could not load saved trips. Check your backend.')
    }
  }
  
  async function deleteTrip(tripId: number) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this saved trip? This action cannot be undone.'
    )

    if (!confirmed) return

    setDeletingTripId(tripId)

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/trips/${tripId}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Could not delete the saved trip.'
        )
      }

      await loadSavedTrips()
      window.alert('Trip deleted successfully!')
    } catch (error) {
      console.error('Deleting saved trip failed:', error)

      window.alert(
        error instanceof Error
          ? error.message
          : 'Could not delete the saved trip. Please try again.'
      )
    } finally {
      setDeletingTripId(null)
    }
  }
  
function startEditTrip(trip: SavedTrip) {
  setEditingTripId(trip.id)
  setEditDestination(trip.destination)
  setEditDays(trip.days)
  setEditBudget(Number(trip.budget))
  setEditTravelStyle(trip.travel_style)
}

async function updateTrip(trip: SavedTrip) {
  if (!editDestination.trim() || editDays < 1 || editBudget <= 0) {
    window.alert('Enter a destination, at least 1 day, and a budget greater than zero.')
    return
  }

  setUpdatingTrip(true)

  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/trips/${trip.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destination: editDestination.trim(),
          days: editDays,
          budget: editBudget,
          travel_style: editTravelStyle,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Could not update the trip.')
    }

    setEditingTripId(null)
    await loadSavedTrips()
    window.alert('Trip updated successfully!')
  } catch (error) {
    window.alert(
      error instanceof Error ? error.message : 'Could not update the trip.'
    )
  } finally {
    setUpdatingTrip(false)
  }
}



  async function openMyTrips() {
    setShowMyTrips(true)
    await loadSavedTrips()

    setTimeout(() => {
      document.getElementById('my-trips')?.scrollIntoView({
        behavior: 'smooth',
      })
    }, 100)
  }


  return (
    <div className="min-h-screen bg-[#f6f9ff] text-[#10243e]">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <Plane size={21} />
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              Sky<span className="text-blue-600">Plan</span>
              <span className="ml-1 text-xs font-medium text-slate-400">AI</span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
            <a href="#flights" className="transition hover:text-blue-600">Flights</a>
            <a href="#destinations" className="transition hover:text-blue-600">Destinations</a>
            <a href="#ai-planner" className="transition hover:text-blue-600">AI Trip Planner</a>
            <a href="#why-us" className="transition hover:text-blue-600">About</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={openMyTrips}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Trip History
            </button>
            <button
              onClick={() => document.getElementById('flights')?.scrollIntoView({ behavior: 'smooth' })}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700"
            >
              Plan a trip
            </button>
          </div>

          <button
            className="rounded-lg p-2 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-4 border-t border-slate-100 bg-white px-6 py-5 text-sm font-semibold md:hidden">
            <a onClick={() => setMenuOpen(false)} href="#flights">Flights</a>
            <a onClick={() => setMenuOpen(false)} href="#destinations">Destinations</a>
            <a onClick={() => setMenuOpen(false)} href="#ai-planner">AI Trip Planner</a>
            <a onClick={() => setMenuOpen(false)} href="#why-us">About</a>
          </nav>
        )}
        
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#102b56]">
          <div
            className="absolute inset-0 -z-20 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=2000&q=90')",
            }}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#071a36]/95 via-[#0b2c53]/80 to-[#0b2c53]/30" />

          <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-36 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pb-44 lg:pt-28">
            <div className="max-w-2xl text-white">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
                <Sparkles size={16} className="text-sky-300" />
                Your personal AI travel companion
              </div>
              <h1 className="text-4xl font-black leading-[1.12] tracking-tight sm:text-6xl lg:text-7xl">
                Your next
                <br />
                adventure,
                <br />
                <span className="text-sky-300">beautifully planned.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-blue-50/85 sm:text-lg">
                Discover destinations, explore flight options, and create
                personalized travel itineraries with the power of AI.
              </p>

              <div className="mt-8 flex flex-wrap gap-6 text-sm text-white/90">
                <div className="flex items-center gap-2">
                  <Check size={17} className="text-sky-300" />
                  Personalized itineraries
                </div>
                <div className="flex items-center gap-2">
                  <Check size={17} className="text-sky-300" />
                  Budget-aware planning
                </div>
              </div>
            </div>

            <div className="hidden items-center justify-center lg:flex">
              <div className="w-full max-w-sm rotate-2 rounded-[2rem] border border-white/30 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
                <div className="overflow-hidden rounded-[1.5rem] bg-white p-5 text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                        <Compass size={19} />
                      </span>
                      Your next getaway
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      AI pick
                    </span>
                  </div>
                  <img
                    src="https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=800&q=85"
                    alt="Tropical island destination"
                    className="mt-5 h-44 w-full rounded-2xl object-cover"
                  />
                  <h3 className="mt-4 text-xl font-extrabold">Bali, Indonesia</h3>
                  <p className="mt-1 text-sm text-slate-500">5 days · Nature · Culture · Relaxation</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-xs text-slate-500">Suggested budget</p>
                      <p className="text-lg font-extrabold text-blue-700">₹50,000</p>
                    </div>
                    <span className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">
                      Explore
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="flights" className="relative z-10 mx-auto -mt-24 max-w-7xl scroll-mt-24 px-4 sm:px-5 lg:px-8">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-slate-900/10 sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold">Find your flight</h2>
                <p className="mt-1 text-sm text-slate-500">Start your journey with the right flight.</p>
              </div>
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => setTripType('round')}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tripType === 'round' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                >
                  Round trip
                </button>
                <button
                  onClick={() => setTripType('oneway')}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tripType === 'oneway' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                >
                  One way
                </button>
              </div>
            </div>

            <form onSubmit={searchFlights}>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_0.85fr]">
                <label className="relative rounded-2xl border border-slate-200 p-4 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                  <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Plane size={14} /> From
                  </span>
                <div className="space-y-2">
                  <select
                    value={fromCategory}
                    onChange={(e) => {
                      const category = e.target.value as 'domestic' | 'international'
                      setFromCategory(category)
                      setFrom(category === 'domestic' ? 'Kochi (COK)' : 'Dubai (DXB)')
                    }}
                    className="w-full bg-transparent text-xs font-semibold text-slate-500 outline-none"
                  >
                    <option value="domestic">Domestic — India</option>
                    <option value="international">International</option>
                  </select>
                  <select
                    required
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full min-w-0 bg-transparent text-sm font-bold outline-none"
                  >
                    {fromCategory === 'domestic' ? (
                      <>
                        <option value="Kochi (COK)">Kochi (COK)</option>
                        <option value="Bengaluru (BLR)">Bengaluru (BLR)</option>
                        <option value="Mumbai (BOM)">Mumbai (BOM)</option>
                        <option value="Delhi (DEL)">Delhi (DEL)</option>
                        <option value="Chennai (MAA)">Chennai (MAA)</option>
                        <option value="Hyderabad (HYD)">Hyderabad (HYD)</option>
                        <option value="Kolkata (CCU)">Kolkata (CCU)</option>
                        <option value="Goa (GOI)">Goa (GOI)</option>
                      </>
                    ) : (
                      <>
                        <option value="Dubai (DXB)">Dubai (DXB)</option>
                        <option value="Singapore (SIN)">Singapore (SIN)</option>
                        <option value="London (LHR)">London (LHR)</option>
                        <option value="Paris (CDG)">Paris (CDG)</option>
                        <option value="Tokyo (HND)">Tokyo (HND)</option>
                        <option value="New York (JFK)">New York (JFK)</option>
                        <option value="Bangkok (BKK)">Bangkok (BKK)</option>
                        <option value="Bali (DPS)">Bali (DPS)</option>
                      </>
                    )}
                  </select>
                </div>

                </label>

                <label className="relative rounded-2xl border border-slate-200 p-4 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                  <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <MapPin size={14} /> To
                  </span>
                  
                <div className="space-y-2">
                  <select
                    value={toCategory}
                    onChange={(e) => {
                      const category = e.target.value as 'domestic' | 'international'
                      setToCategory(category)
                      setTo(category === 'domestic' ? 'Mumbai (BOM)' : 'Dubai (DXB)')
                    }}
                    className="w-full bg-transparent text-xs font-semibold text-slate-500 outline-none"
                  >
                    <option value="domestic">Domestic — India</option>
                    <option value="international">International</option>
                  </select>

                  <select
                    required
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full min-w-0 bg-transparent text-sm font-bold outline-none"
                  >
                    {toCategory === 'domestic' ? (
                      <>
                        <option value="Kochi (COK)">Kochi (COK)</option>
                        <option value="Bengaluru (BLR)">Bengaluru (BLR)</option>
                        <option value="Mumbai (BOM)">Mumbai (BOM)</option>
                        <option value="Delhi (DEL)">Delhi (DEL)</option>
                        <option value="Chennai (MAA)">Chennai (MAA)</option>
                        <option value="Hyderabad (HYD)">Hyderabad (HYD)</option>
                        <option value="Kolkata (CCU)">Kolkata (CCU)</option>
                        <option value="Goa (GOI)">Goa (GOI)</option>
                      </>
                    ) : (
                      <>
                        <option value="Dubai (DXB)">Dubai (DXB)</option>
                        <option value="Singapore (SIN)">Singapore (SIN)</option>
                        <option value="London (LHR)">London (LHR)</option>
                        <option value="Paris (CDG)">Paris (CDG)</option>
                        <option value="Tokyo (HND)">Tokyo (HND)</option>
                        <option value="New York (JFK)">New York (JFK)</option>
                        <option value="Bangkok (BKK)">Bangkok (BKK)</option>
                        <option value="Bali (DPS)">Bali (DPS)</option>
                      </>
                    )}
                  </select>
                </div>

                  <button
                    type="button"
                    onClick={swapCities}
                    aria-label="Swap departure and destination"
                    className="absolute -left-5 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm transition hover:bg-blue-50 lg:flex"
                  >
                    <ArrowDownUp size={16} />
                  </button>
                </label>

                <label className="rounded-2xl border border-slate-200 p-4 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                  <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <CalendarDays size={14} /> Departure
                  </span>
                  <input
                    required
                    type="date"
                    value={departDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDepartDate(e.target.value)}
                    className="w-full min-w-0 bg-transparent text-sm font-bold outline-none"
                  />
                </label>

                
        {tripType === 'round' && (
          <label className="rounded-2xl border border-slate-200 p-4">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <CalendarDays size={14} /> Return
            </span>
            <input
              required
              type="date"
              value={returnDate}
              min={departDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full min-w-0 bg-transparent text-sm font-bold outline-none"
            />
          </label>
        )}


                <label className="rounded-2xl border border-slate-200 p-4 md:col-span-2 lg:col-span-1">
                  <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Users size={14} /> Travellers
                  </span>
                  <select
                    value={passengers}
                    onChange={(e) => setPassengers(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold outline-none"
                  >
                    <option>1 Adult</option>
                    <option>2 Adults</option>
                    <option>3 Adults</option>
                    <option>4 Adults</option>
                    <option>5 Adults</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <p className="text-xs leading-5 text-slate-400">
                  Flight prices and availability may change.
                </p>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Search size={18} />
                  {isSearching ? 'Searching...' : 'Search flights'}
                </button>
              </div>
            </form>
          </div>
        </section>

        {showFlights && (
          <section id="flight-results" className="mx-auto max-w-7xl scroll-mt-28 px-5 pt-10 lg:px-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-blue-600">FLIGHT SEARCH RESULTS</p>
                <h2 className="mt-1 text-2xl font-extrabold">
                  {from} <ArrowRight className="mx-1 inline" size={20} /> {to}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {departDate}{tripType === 'round' && returnDate ? ` · Return ${returnDate}` : ''} · {passengers}
                </p>
              </div>
              <button onClick={() => setShowFlights(false)} className="text-sm font-bold text-slate-500 hover:text-blue-600">
                Hide results
              </button>
            </div>
            
            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold">Filter and sort flights</h3>
                <span className="text-sm text-slate-500">
                  {filteredFlights.length} result{filteredFlights.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-600">
                    Airline
                  </span>
                  <select
                    value={airlineFilter}
                    onChange={(e) => setAirlineFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="all">All airlines</option>
                    {[...new Set(flights.map((flight) => flight.airline))].map(
                      (airline) => (
                        <option key={airline} value={airline}>
                          {airline}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-600">
                    Stops
                  </span>
                  <select
                    value={maxStopsFilter}
                    onChange={(e) => setMaxStopsFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="all">Any number of stops</option>
                    <option value="0">Non-stop only</option>
                    <option value="1">Maximum 1 stop</option>
                    <option value="2">Maximum 2 stops</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-600">
                    Sort by
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as FlightSort)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="recommended">Recommended order</option>
                    <option value="price_low">Price: low to high</option>
                    <option value="price_high">Price: high to low</option>
                    <option value="duration">Shortest duration</option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAirlineFilter('all')
                  setMaxStopsFilter('all')
                  setSortBy('recommended')
                }}
                className="mt-4 text-sm font-bold text-blue-600 hover:text-blue-800"
              >
                Reset filters
              </button>
            </div>

            <div className="space-y-3">
              {filteredFlights.map((flight) => (
                <article key={flight.code} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Plane size={22} />
                    </span>
                    <div>
                      <p className="font-extrabold">{flight.airline}</p>
                      <p className="text-xs text-slate-500">{flight.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 sm:gap-8">
                    <div>
                      <p className="text-lg font-extrabold">{flight.departure}</p>
                      <p className="text-xs text-slate-500">Departure</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-slate-500">{flight.duration}</p>
                      <div className="my-1 h-px w-16 bg-blue-200 sm:w-24" />
                      <p className="text-xs text-emerald-600">{flight.stops}</p>
                    </div>
                    <div>
                      <p className="text-lg font-extrabold">{flight.arrival}</p>
                      <p className="text-xs text-slate-500">Arrival</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:border-0 sm:pt-0">
                    <div>
                      <p className="text-xl font-black text-blue-700">{flight.price != null ? `₹${Number(flight.price).toLocaleString('en-IN')}` : 'Price N/A'}</p>
                      <p className="text-xs text-slate-400">Displayed fare</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectFlight(flight)}
                      disabled={isLoadingBookingOptions && selectedFlight?.code === flight.code}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isLoadingBookingOptions && selectedFlight?.code === flight.code
                        ? 'Loading...'
                        : 'View booking'}
                    </button>
                  </div>
                </article>
              ))}
              
              {tripType === 'round' && flightStage === 'return' && (
                <section
                  id="return-flight-results"
                  className="scroll-mt-28 space-y-4 pt-6"
                >
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                    <p className="text-sm font-bold uppercase tracking-wider text-blue-600">
                      Step 2 of 2
                    </p>
                    <h3 className="mt-1 text-xl font-extrabold text-slate-900">
                      Choose your return flight
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {to} → {from} · Return date: {returnDate}
                    </p>
                  </div>

                  {returnFlights.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6">
                      <p className="font-bold">No return flights found</p>
                      <p className="mt-2 text-sm text-slate-500">
                        Try selecting a different outbound flight or changing your travel dates.
                      </p>
                      <button
                        type="button"
                        onClick={() => setFlightStage('outbound')}
                        className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                      >
                        Back to outbound flights
                      </button>
                    </div>
                  ) : (
                    returnFlights.map((flight, index) => (
                      <article
                        key={`${flight.code}-${index}`}
                        className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Plane size={22} />
                          </span>
                          <div>
                            <p className="font-extrabold">{flight.airline}</p>
                            <p className="text-xs text-slate-500">{flight.code}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-5 sm:gap-8">
                          <div>
                            <p className="text-lg font-extrabold">{flight.departure}</p>
                            <p className="text-xs text-slate-500">Departure</p>
                          </div>

                          <div className="text-center">
                            <p className="text-xs font-semibold text-slate-500">
                              {flight.duration}
                            </p>
                            <div className="my-1 h-px w-16 bg-blue-200 sm:w-24" />
                            <p className="text-xs text-emerald-600">{flight.stops}</p>
                          </div>

                          <div>
                            <p className="text-lg font-extrabold">{flight.arrival}</p>
                            <p className="text-xs text-slate-500">Arrival</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:border-0 sm:pt-0">
                          <div>
                            <p className="text-xl font-black text-blue-700">
                              {flight.price != null ? `₹${Number(flight.price).toLocaleString('en-IN')}` : 'Price N/A'}
                            </p>
                            <p className="text-xs text-slate-400">Displayed fare</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => selectFlight(flight)}
                            disabled={isLoadingBookingOptions}
                            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                          >
                            {isLoadingBookingOptions
                              ? 'Loading...'
                              : 'View booking'}
                          </button>
                        </div>
                      </article>
                    ))
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setFlightStage('outbound')
                      setReturnFlights([])
                      setSelectedReturnFlight(null)
                      setBookingMessage('')
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    ← Back to outbound flights
                  </button>
                </section>
              )}

              {selectedFlight && (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="booking-dialog-title"
                >
                  <section className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-200 bg-white p-5 pt-12 shadow-2xl sm:p-6 sm:pt-12">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFlight(null)
                        setBookingOptions([])
                        setBookingMessage('')
                      }}
                      aria-label="Close booking options"
                      className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <X size={22} />
                    </button>

                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-blue-600">
                          Selected flight
                        </p>
                        <h3
                          id="booking-dialog-title"
                          className="mt-1 text-lg font-extrabold"
                        >
                          Booking options · {selectedFlight.airline} · {selectedFlight.code}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedFlight.departure} – {selectedFlight.arrival}
                          {' · '}{selectedFlight.duration}
                          {' · '}{selectedFlight.stops}
                        </p>
                      </div>

                      <p className="pr-8 text-xl font-black text-blue-700">
                        ₹{selectedFlight.price.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <h4 className="font-extrabold">Booking options</h4>

                      {isLoadingBookingOptions ? (
                        <p className="mt-2 text-sm text-slate-500">
                          Retrieving booking options from the flight provider...
                        </p>
                      ) : (
                        <>
                          {bookingMessage && (
                            <p className="mt-2 text-sm text-slate-600">
                              {bookingMessage}
                            </p>
                          )}

                          {bookingOptions.length > 0 && (
                            <div className="mt-3 space-y-3">
                              {bookingOptions.map((option, index) => (
                                <div
                                  key={`${option.provider}-${index}`}
                                  className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div>
                                    <p className="font-bold">{option.provider}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {option.ticket_type}
                                      {option.booking_phone
                                        ? ` · Phone: ${option.booking_phone}`
                                        : ''}
                                    </p>
                                  </div>

                                  <div className="flex items-center justify-between gap-4">
                                    <p className="font-extrabold text-blue-700">
                                      {option.price != null
                                        ? `${option.currency === 'INR' ? '₹' : `${option.currency} `}${Number(option.price).toLocaleString('en-IN')}`
                                        : 'Price unavailable'}
                                    </p>    
                                    {option.booking_url &&
                                    /^https?:\/\//i.test(option.booking_url) &&
                                    !/google\.com\/travel\/clk/i.test(option.booking_url) ? (
                                      <a
                                        href={option.booking_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                                      >
                                        Continue to booking
                                      </a>
                                    ) : option.booking_url &&
                                      option.booking_post_data ? (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          // Open a tab immediately so the browser does not block it
                                          // while the booking URL is being resolved.
                                          const bookingTab = window.open('about:blank', '_blank')

                                          if (!bookingTab) {
                                            setBookingMessage(
                                              'Your browser blocked the booking tab. Allow pop-ups and try again.'
                                            )
                                            return
                                          }

                                          bookingTab.opener = null
                                          bookingTab.document.title = 'Opening booking page...'

                                          try {
                                            const response = await fetch(
                                              'http://127.0.0.1:8000/api/flights/resolve-booking',
                                              {
                                                method: 'POST',
                                                headers: {
                                                  'Content-Type': 'application/json',
                                                },
                                                body: JSON.stringify({
                                                  booking_url: option.booking_url,
                                                  post_data: option.booking_post_data,
                                                }),
                                              }
                                            )

                                            const data = await response.json()

                                            if (!response.ok || typeof data.url !== 'string') {
                                              throw new Error(
                                                data.detail || 'Could not resolve this booking link.'
                                              )
                                            }

                                            const destination = new URL(data.url)

                                            if (destination.protocol !== 'https:') {
                                              throw new Error('The provider returned an invalid booking link.')
                                            }

                                            bookingTab.location.replace(destination.href)
                                          } catch (error) {
                                            bookingTab.close()

                                            setBookingMessage(
                                              error instanceof Error
                                                ? error.message
                                                : 'Could not open the booking page. Please try again.'
                                            )
                                          }
                                        }}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                                      >
                                        Continue to booking
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled
                                        title="The provider did not supply a usable direct booking link."
                                        className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500"
                                      >
                                        Link unavailable
                                      </button>
                                    )}

                                  </div>
                                </div>
                              ))}

                              {!bookingOptions.some(
                                (option) =>
                                  option.booking_url &&
                                  /^https?:\/\//i.test(option.booking_url)
                              ) && (
                                <p className="mt-3 text-xs leading-5 text-amber-700">
                                  Direct booking links were not supplied for these options.
                                  Confirm the flight and fare on the provider's website before purchasing.
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                </div>
              )}


              {filteredFlights.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                  <Plane className="mx-auto mb-3 text-slate-400" size={28} />
                  <h3 className="font-bold">No matching flights</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Try changing your airline or stop filters.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        <section id="destinations" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-blue-600">Made for explorers</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Destinations to fall for</h2>
              <p className="mt-3 max-w-xl text-slate-500">Find your next favourite place, from vibrant cities to peaceful island escapes.</p>
            </div>
            <button
              onClick={() => document.getElementById('ai-planner')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800"
            >
              Explore with AI <ArrowRight size={17} />
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map((place) => (
              <button
                key={place.name}
                onClick={() => chooseDestination(place.name)}
                className="group overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={place.image}
                    alt={`${place.name}, ${place.country}`}
                    className="h-56 w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
                    {place.tag}
                  </span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-extrabold">{place.name}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                        <MapPin size={14} /> {place.country}
                      </p>
                    </div>
                    <ArrowRight size={18} className="mt-1 text-blue-600 transition group-hover:translate-x-1" />
                  </div>
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-400">Example trip budget from</p>
                    <p className="mt-1 text-lg font-black text-blue-700">{place.price}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">Destination budgets are illustrative estimates, not guaranteed prices.</p>
        </section>

        <section id="ai-planner" className="scroll-mt-24 bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:px-8">
            <div className="flex flex-col justify-center">
              <span className="flex w-fit items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                <Sparkles size={16} /> Powered by AI
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
                A trip that fits
                <span className="text-blue-600"> your way.</span>
              </h2>
              <p className="mt-5 max-w-lg leading-7 text-slate-500">
                Tell us where you want to go, how long you have, and your budget.
                Start with a personalized sample itinerary, then we'll connect
                the planner to a real AI service in a later stage.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  'Day-by-day travel schedule',
                  'Activities matched to your interests',
                  'Budget-conscious trip suggestions',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check size={16} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-[#f7faff] p-5 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                  <Sparkles size={23} />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold">Build your itinerary</h3>
                  <p className="text-sm text-slate-500">Your preferences, your adventure.</p>
                </div>
              </div>

              <form onSubmit={createPlan} className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Where would you like to go?</span>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      required
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Enter a destination"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-sm font-bold">Trip duration</span>
                    <div className="relative">
                      <select value={days} onChange={(e) => setDays(e.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 outline-none focus:border-blue-500">
                        <option value="3">3 days</option>
                        <option value="5">5 days</option>
                        <option value="7">7 days</option>
                        <option value="10">10 days</option>
                        <option value="14">14 days</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    </div>
                  </label>
                  <label>
                    <span className="mb-2 block text-sm font-bold">Total budget (₹)</span>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                      <input
                        required
                        type="number"
                        min="1000"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 outline-none focus:border-blue-500"
                      />
                    </div>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold">What do you enjoy?</span>
                  <select value={travelStyle} onChange={(e) => setTravelStyle(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500">
                    <option>Culture & sightseeing</option>
                    <option>Nature & adventure</option>
                    <option>Food & local experiences</option>
                    <option>Relaxation & beaches</option>
                    <option>Shopping & nightlife</option>
                  </select>
                </label>

                <button
                  type="submit"
                  disabled={isGeneratingPlan}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 font-extrabold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles size={19} />
                  {isGeneratingPlan
                    ? 'Generating itinerary...'
                    : 'Generate my itinerary'}
                </button>

                <p className="text-center text-xs text-slate-400">This first version uses a local sample itinerary, not a live AI model.</p>
              </form>

              {plan && (
                <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-5">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-blue-600">
                    Your generated itinerary
                  </p>

                  <h4 className="mt-1 text-xl font-black">
                    {destination} in {days} days
                  </h4>

                  <p className="mt-1 text-sm text-slate-500">
                    {travelStyle} · Total budget ₹
                    {Number(budget).toLocaleString('en-IN')}
                  </p>

                  <div className="mt-4 space-y-4">
                    {itinerary.map((item) => (
                      <div
                        key={item.day}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <h5 className="font-extrabold text-blue-700">
                          Day {item.day}
                        </h5>

                        <div className="mt-3 space-y-3 text-sm text-slate-600">
                          <p>
                            <strong>Morning:</strong> {item.morning}
                          </p>
                          <p>
                            <strong>Afternoon:</strong> {item.afternoon}
                          </p>
                          <p>
                            <strong>Evening:</strong> {item.evening}
                          </p>
                        </div>

                        <p className="mt-3 border-t border-slate-200 pt-3 text-sm font-bold">
                          Estimated daily budget: ₹
                          {item.estimated_budget.toLocaleString('en-IN')}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-xs leading-5 text-slate-400">
                    Sample itinerary generated by backend planning logic.
                    Activities and expenses are estimates, not verified live information.
                  </p>
                  <button
                    type="button"
                    onClick={saveTrip}
                    disabled={savingTrip}
                    className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingTrip ? 'Saving trip...' : 'Save Trip'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlan(false)}
                    className="mt-4 rounded-lg px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50"
                  >
                    Close itinerary
                  </button>
                </div>
              )}

            </div>
          </div>
        </section>
        
        {showMyTrips && (
          <section
            id="my-trips"
            className="mx-auto max-w-7xl scroll-mt-24 px-5 py-12 lg:px-8"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-3xl font-black">Trip History </h2>
              <button
                onClick={() => setShowMyTrips(false)}
                className="rounded-lg border px-4 py-2"
              >
                Close
              </button>
            </div>

            {savedTrips.length === 0 ? (
              <p className="rounded-xl border bg-white p-6 text-slate-500">
                No saved trips yet. Generate an itinerary and click Save Trip.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {savedTrips.map((trip) => (
                  <article
                    key={trip.id}
                    className="rounded-2xl border bg-white p-5 shadow-sm"
                  >  
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-extrabold">
                      {trip.destination}
                    </h3>

                    <button
                      type="button"
                      onClick={() => deleteTrip(trip.id)}
                      disabled={deletingTripId === trip.id}
                      className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                  
                    {editingTripId === trip.id ? (
                      <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
                        <label className="block text-sm font-semibold">
                          Destination
                          <input
                            value={editDestination}
                            onChange={(e) => setEditDestination(e.target.value)}
                            className="mt-1 w-full rounded-lg border bg-white p-2"
                            required
                          />
                        </label>

                        <label className="block text-sm font-semibold">
                          Number of days
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={editDays}
                            onChange={(e) => setEditDays(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border bg-white p-2"
                          />
                        </label>

                        <label className="block text-sm font-semibold">
                          Budget (₹)
                          <input
                            type="number"
                            min="1"
                            value={editBudget}
                            onChange={(e) => setEditBudget(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border bg-white p-2"
                          />
                        </label>

                        <label className="block text-sm font-semibold">
                          Travel style
                          <select
                            value={editTravelStyle}
                            onChange={(e) => setEditTravelStyle(e.target.value)}
                            className="mt-1 w-full rounded-lg border bg-white p-2"
                          >
                            <option>Nature and sightseeing</option>
                            <option>Adventure</option>
                            <option>Relaxation</option>
                            <option>Culture and history</option>
                            <option>Food and shopping</option>
                          </select>
                        </label>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateTrip(trip)}
                            disabled={updatingTrip}
                            className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-50"
                          >
                            {updatingTrip ? 'Saving...' : 'Save Changes'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingTripId(null)}
                            className="rounded-lg border bg-white px-4 py-2 font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditTrip(trip)}
                        className="mt-3 rounded-lg border border-blue-200 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
                      >
                        Edit Trip
                      </button>
                    )}


                    <p className="mt-2 text-sm text-slate-500">
                      {trip.days} days · {trip.travel_style}
                    </p>
                    <p className="mt-2 font-bold text-blue-700">
                      Budget: ₹{Number(trip.budget).toLocaleString('en-IN')}
                    </p>

                    {trip.itinerary.map((item: ItineraryDay) => (
                      <div key={item.day} className="mt-4 rounded-lg bg-slate-50 p-3">
                        <h4 className="font-bold">Day {item.day}</h4>
                        <p className="mt-2 text-sm">Morning: {item.morning}</p>
                        <p className="mt-1 text-sm">Afternoon: {item.afternoon}</p>
                        <p className="mt-1 text-sm">Evening: {item.evening}</p>
                        <p className="mt-2 text-sm font-semibold">
                          Estimated budget: ₹
                          {Number(item.estimated_budget).toLocaleString('en-IN')}
                        </p>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}


        <section id="why-us" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-blue-600">Travel smarter</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Everything for a better journey</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-500">
              One place to explore destinations, compare sample flight options, and organize your travel ideas.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              { icon: <Globe2 size={23} />, title: 'Explore the world', desc: 'Browse inspiring destinations and start planning your next adventure.' },
              { icon: <Sparkles size={23} />, title: 'Plan with AI', desc: 'Create a starting itinerary tailored to your duration, interests, and budget.' },
              { icon: <Wallet size={23} />, title: 'Keep costs in view', desc: 'Use your budget as a guide while organizing the trip you want.' },
            ].map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  {feature.icon}
                </span>
                <h3 className="mt-5 text-lg font-extrabold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-[#10243e] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500">
              <Plane size={19} />
            </span>
            <span className="text-lg font-extrabold">SkyPlan AI</span>
          </div>
          <p className="text-sm text-slate-300">Plan less. Explore more. Make every trip yours.</p>
          <p className="text-xs text-slate-400">Student project · Demo version</p>
        </div>
      </footer>
    </div>
  )
}

export default App
