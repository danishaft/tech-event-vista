import { useState } from 'react';
import { X, MapPin, Calendar, DollarSign, Users, Monitor, Star, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AdvancedFilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filters: any;
  onFilterChange: (key: string, value: any) => void;
  onClearAll: () => void;
}

export const AdvancedFilterSidebar = ({ 
  isOpen, 
  onClose, 
  filters, 
  onFilterChange, 
  onClearAll 
}: AdvancedFilterSidebarProps) => {
  const [locationRadius, setLocationRadius] = useState([25]);
  const [priceRange, setPriceRange] = useState([0, 100]);

  const techStacks = [
    'React', 'Vue.js', 'Angular', 'Python', 'JavaScript', 'TypeScript', 
    'Node.js', 'Go', 'Rust', 'Docker', 'Kubernetes', 'AWS', 'AI/ML',
    'Machine Learning', 'TensorFlow', 'Next.js', 'Flutter', 'Unity',
    'Blockchain', 'Web3', 'Solidity'
  ];

  const eventTypes = [
    { value: 'workshop', label: 'Workshop', icon: '🛠️' },
    { value: 'conference', label: 'Conference', icon: '🎤' },
    { value: 'meetup', label: 'Meetup', icon: '👥' },
    { value: 'hackathon', label: 'Hackathon', icon: '💻' },
    { value: 'networking', label: 'Networking', icon: '🤝' }
  ];

  const cities = [
    'San Francisco', 'New York', 'Seattle', 'Austin', 'Los Angeles', 
    'Chicago', 'Boston', 'Mountain View', 'Brooklyn', 'Portland',
    'Denver', 'Atlanta', 'Miami', 'Sacramento'
  ];

  const eventFormats = [
    { value: 'in-person', label: 'In-person', icon: <MapPin className="h-4 w-4" /> },
    { value: 'online', label: 'Online', icon: <Monitor className="h-4 w-4" /> },
    { value: 'hybrid', label: 'Hybrid', icon: <Users className="h-4 w-4" /> }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:relative lg:inset-auto">
      {/* Overlay for mobile */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm lg:hidden" onClick={onClose} />
      
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-80 bg-card border-r border-border overflow-y-auto lg:relative lg:w-72 lg:h-auto">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Filters</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClearAll}>
                Clear All
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Location & Radius */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </h3>
              <Select value={filters.city} onValueChange={(value) => onFilterChange('city', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="mt-4">
                <label className="text-sm text-muted-foreground mb-2 block">
                  Radius: {locationRadius[0]} miles
                </label>
                <Slider
                  value={locationRadius}
                  onValueChange={setLocationRadius}
                  max={50}
                  min={5}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>

            {/* Tech Stack */}
            <div>
              <h3 className="font-medium mb-3">Tech Stack</h3>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {techStacks.map(tech => (
                  <div key={tech} className="flex items-center space-x-2">
                    <Checkbox 
                      id={tech}
                      checked={filters.techStack?.includes(tech)}
                      onCheckedChange={(checked) => {
                        const current = filters.techStack || [];
                        const updated = checked 
                          ? [...current, tech]
                          : current.filter((t: string) => t !== tech);
                        onFilterChange('techStack', updated);
                      }}
                    />
                    <label htmlFor={tech} className="text-sm truncate">{tech}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Type */}
            <div>
              <h3 className="font-medium mb-3">Event Type</h3>
              <div className="space-y-2">
                {eventTypes.map(type => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <Checkbox 
                      id={type.value}
                      checked={filters.eventType?.includes(type.value)}
                      onCheckedChange={(checked) => {
                        const current = filters.eventType || [];
                        const updated = checked 
                          ? [...current, type.value]
                          : current.filter((t: string) => t !== type.value);
                        onFilterChange('eventType', updated);
                      }}
                    />
                    <label htmlFor={type.value} className="text-sm flex items-center gap-2">
                      <span>{type.icon}</span>
                      {type.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </h3>
              <Select value={filters.dateRange} onValueChange={(value) => onFilterChange('dateRange', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="next-month">Next Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Price Range
              </h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="free"
                    checked={filters.price?.includes('free')}
                    onCheckedChange={(checked) => {
                      const current = filters.price || [];
                      const updated = checked 
                        ? [...current, 'free']
                        : current.filter((p: string) => p !== 'free');
                      onFilterChange('price', updated);
                    }}
                  />
                  <label htmlFor="free" className="text-sm">Free</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="paid"
                    checked={filters.price?.includes('paid')}
                    onCheckedChange={(checked) => {
                      const current = filters.price || [];
                      const updated = checked 
                        ? [...current, 'paid']
                        : current.filter((p: string) => p !== 'paid');
                      onFilterChange('price', updated);
                    }}
                  />
                  <label htmlFor="paid" className="text-sm">Paid ($1-$50+)</label>
                </div>
              </div>
            </div>

            {/* Event Format */}
            <div>
              <h3 className="font-medium mb-3">Event Format</h3>
              <div className="space-y-2">
                {eventFormats.map(format => (
                  <div key={format.value} className="flex items-center space-x-2">
                    <Checkbox 
                      id={format.value}
                      checked={filters.format?.includes(format.value)}
                      onCheckedChange={(checked) => {
                        const current = filters.format || [];
                        const updated = checked 
                          ? [...current, format.value]
                          : current.filter((f: string) => f !== format.value);
                        onFilterChange('format', updated);
                      }}
                    />
                    <label htmlFor={format.value} className="text-sm flex items-center gap-2">
                      {format.icon}
                      {format.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Organizer Rating */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Star className="h-4 w-4" />
                Organizer Rating
              </h3>
              <Select value={filters.rating} onValueChange={(value) => onFilterChange('rating', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select minimum rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="4.5">4.5+ Stars</SelectItem>
                  <SelectItem value="4.0">4.0+ Stars</SelectItem>
                  <SelectItem value="3.5">3.5+ Stars</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};