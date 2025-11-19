'use client'

import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'

interface FeaturedCity {
  name: string
  slug: string
  imageUrl: string
  eventCount: number
}

const featuredCities: FeaturedCity[] = [
  {
    name: 'San Francisco',
    slug: 'san-francisco',
    imageUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=200&h=200&fit=crop',
    eventCount: 127
  },
  {
    name: 'New York',
    slug: 'new-york',
    imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=200&h=200&fit=crop',
    eventCount: 98
  },
  {
    name: 'Seattle',
    slug: 'seattle',
    imageUrl: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=200&h=200&fit=crop',
    eventCount: 76
  },
  {
    name: 'Austin',
    slug: 'austin',
    imageUrl: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=200&h=200&fit=crop',
    eventCount: 65
  },
  {
    name: 'Boston',
    slug: 'boston',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    eventCount: 54
  },
  {
    name: 'Los Angeles',
    slug: 'los-angeles',
    imageUrl: 'https://images.unsplash.com/photo-1515895306158-367fac5f3a0e?w=200&h=200&fit=crop',
    eventCount: 89
  },
  {
    name: 'Chicago',
    slug: 'chicago',
    imageUrl: 'https://images.unsplash.com/photo-1513026705753-bc3fffca8bf4?w=200&h=200&fit=crop',
    eventCount: 72
  },
  {
    name: 'Denver',
    slug: 'denver',
    imageUrl: 'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=200&h=200&fit=crop',
    eventCount: 43
  },
]

export const FeaturedEvents = () => {
  const router = useRouter()

  const handleCityClick = (citySlug: string) => {
    router.push(`/search?city=${citySlug}&platform=eventbrite`)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-spacing-section pb-spacing-content">
      {/* Section Header */}
      <div className="mb-8">
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-2 text-foreground">
          Featured Events by City
        </h2>
        <p className="text-muted-foreground text-base md:text-lg">
          Popular cities where Tech Event Vista recommends events for you
        </p>
      </div>

      {/* Rectangular Cards Grid - ARKLYTE Style */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 md:gap-6">
        {featuredCities.map((city) => (
          <Card
            key={city.slug}
            onClick={() => handleCityClick(city.slug)}
            className="group cursor-pointer bg-card border border-border rounded-lg md:rounded-xl hover:shadow-card-hover transition-all duration-300 hover:scale-105 overflow-hidden"
          >
            <div className="flex flex-col items-center p-4 md:p-6">
              {/* Circular Image */}
              <div className="relative w-20 h-20 md:w-24 md:h-24 mb-3 rounded-full overflow-hidden border-2 border-border group-hover:border-primary/50 transition-colors">
                <img
                  src={city.imageUrl}
                  alt={city.name}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* City Name */}
              <h3 className="font-semibold text-sm md:text-base text-foreground mb-1 group-hover:text-primary transition-colors text-center">
                {city.name}
              </h3>
              
              {/* Event Count */}
              <p className="text-xs md:text-sm text-muted-foreground text-center">
                {city.eventCount} events found
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

