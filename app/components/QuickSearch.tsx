'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Brain, 
  Globe, 
  Code, 
  Database, 
  Cloud, 
  Shield, 
  Link, 
  Rocket,
  MapPin,
  Users,
  Calendar,
  Zap
} from 'lucide-react'

// Tech Categories - Using exact queries from daily scraping that work with Apify actors
const techCategories = [
  {
    name: 'Tech Conference 2025',
    query: 'tech conference 2025',
    icon: Users,
    color: 'bg-blue-500/10 text-blue-600'
  },
  {
    name: 'React Workshop 2025', 
    query: 'react workshop 2025',
    icon: Code,
    color: 'bg-cyan-500/10 text-cyan-600'
  },
  {
    name: 'JavaScript Meetup 2025',
    query: 'javascript meetup 2025',
    icon: Code,
    color: 'bg-yellow-500/10 text-yellow-600'
  },
  {
    name: 'Python Conference 2025',
    query: 'python conference 2025',
    icon: Code,
    color: 'bg-green-500/10 text-green-600'
  },
  {
    name: 'Machine Learning 2025',
    query: 'machine learning 2025',
    icon: Brain,
    color: 'bg-purple-500/10 text-purple-600'
  },
  {
    name: 'Data Science 2025',
    query: 'data science 2025',
    icon: Database,
    color: 'bg-orange-500/10 text-orange-600'
  },
  {
    name: 'Web Development 2025',
    query: 'web development 2025',
    icon: Globe,
    color: 'bg-sky-500/10 text-sky-600'
  },
  {
    name: 'Frontend 2025',
    query: 'frontend 2025',
    icon: Code,
    color: 'bg-indigo-500/10 text-indigo-600'
  }
]

// Top Tech Cities - Using exact cities from daily scraping that work with Apify actors
const techCities = [
  {
    name: 'Seattle',
    slug: 'seattle',
    icon: '☕',
    state: 'WA'
  },
  {
    name: 'San Francisco',
    slug: 'san-francisco',
    icon: '🌉',
    state: 'CA'
  },
  {
    name: 'New York',
    slug: 'new-york',
    icon: '🗽',
    state: 'NY'
  }
]

// Event Types - Using exact queries that work with our actors
const eventTypes = [
  {
    name: 'Tech Conference 2025',
    query: 'tech conference 2025',
    icon: Users,
    color: 'bg-blue-500/10 text-blue-600'
  },
  {
    name: 'React Workshop 2025',
    query: 'react workshop 2025', 
    icon: Zap,
    color: 'bg-green-500/10 text-green-600'
  },
  {
    name: 'JavaScript Meetup 2025',
    query: 'javascript meetup 2025',
    icon: Users,
    color: 'bg-purple-500/10 text-purple-600'
  },
  {
    name: 'Python Conference 2025',
    query: 'python conference 2025',
    icon: Code,
    color: 'bg-orange-500/10 text-orange-600'
  },
  {
    name: 'Machine Learning 2025',
    query: 'machine learning 2025',
    icon: Brain,
    color: 'bg-pink-500/10 text-pink-600'
  },
  {
    name: 'Data Science 2025',
    query: 'data science 2025',
    icon: Database,
    color: 'bg-indigo-500/10 text-indigo-600'
  }
]

export const QuickSearch = () => {
  const router = useRouter()

  const handleCategorySearch = (query: string) => {
    // For Luma actor: uses query parameter, city defaults to "all"
    router.push(`/search?query=${encodeURIComponent(query)}&platform=luma&type=category`)
  }

  const handleCitySearch = (citySlug: string) => {
    // For Eventbrite actor: uses city + default tech query
    router.push(`/search?city=${citySlug}&query=tech%20conference%202025&platform=eventbrite&type=city`)
  }

  const handleEventTypeSearch = (query: string) => {
    // For Luma actor: uses query parameter, city defaults to "all"
    router.push(`/search?query=${encodeURIComponent(query)}&platform=luma&type=event`)
  }

  return (
    <div className="space-y-12">
      {/* Tech Categories Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-2xl font-bold">Popular Tech Searches</h2>
          <Badge variant="secondary" className="text-xs">
            {techCategories.length} searches
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {techCategories.map((category) => {
            const IconComponent = category.icon
            return (
              <Card 
                key={category.name}
                className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 bg-card border-border"
                onClick={() => handleCategorySearch(category.query)}
              >
                <CardContent className="p-4 text-center">
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center ${category.color}`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium text-sm leading-tight group-hover:text-primary transition-colors">
                    {category.name}
                  </h3>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Top Cities Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-2xl font-bold">Tech Events by City</h2>
          <Badge variant="secondary" className="text-xs">
            {techCities.length} cities
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {techCities.map((city) => (
            <Card 
              key={city.name}
              className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 bg-card border-border"
              onClick={() => handleCitySearch(city.slug)}
            >
              <CardContent className="p-4 text-center">
                <div className="text-3xl mb-2">{city.icon}</div>
                <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                  {city.name}
                </h3>
                <p className="text-xs text-muted-foreground">{city.state}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Event Types Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-2xl font-bold">More Tech Searches</h2>
          <Badge variant="secondary" className="text-xs">
            {eventTypes.length} searches
          </Badge>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {eventTypes.map((type) => {
            const IconComponent = type.icon
            return (
              <Button
                key={type.name}
                variant="outline"
                className="group h-auto p-3 hover:shadow-md transition-all duration-200"
                onClick={() => handleEventTypeSearch(type.query)}
              >
                <div className={`w-8 h-8 mr-3 rounded-lg flex items-center justify-center ${type.color}`}>
                  <IconComponent className="h-4 w-4" />
                </div>
                <span className="font-medium group-hover:text-primary transition-colors">
                  {type.name}
                </span>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
