'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Filter, Calendar, MapPin, DollarSign, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FilterBarProps {
  selectedFilters: {
    eventType: string;
    city: string;
    price: string;
    date: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  onSearch?: (query: string) => void;
  isSearching?: boolean;
}

export const FilterBar = ({ selectedFilters, onFilterChange, onClearFilters, onSearch, isSearching }: FilterBarProps) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const hasActiveFilters = Object.values(selectedFilters).some(value => value !== "all");

  // Initialize search query from URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlQuery = searchParams.get('q') || '';
      if (urlQuery) {
        setSearchQuery(urlQuery);
      }
    }
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
    } else if (searchQuery.trim()) {
      // Fallback: navigate to search page
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}&platform=eventbrite`);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg md:rounded-xl p-4 md:p-6 mb-8 shadow-sm">
      {/* Search Bar - Top */}
      <div className="mb-4 pb-4 border-b border-border">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search events, technologies, locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            className="pl-10 pr-24 bg-surface border-border focus:ring-primary/50"
            disabled={isSearching}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Button 
              size="sm" 
              disabled={isSearching || !searchQuery.trim()} 
              onClick={handleSearch}
              className="h-8 rounded-doow-sm"
            >
              {isSearching ? 'Searching…' : 'Search'}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Filters:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedFilters.eventType} onValueChange={(value) => onFilterChange("eventType", value)}>
            <SelectTrigger className="w-32 h-9 bg-surface border-border rounded-doow-sm">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="workshop">Workshop</SelectItem>
              <SelectItem value="conference">Conference</SelectItem>
              <SelectItem value="meetup">Meetup</SelectItem>
              <SelectItem value="hackathon">Hackathon</SelectItem>
              <SelectItem value="networking">Networking</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedFilters.city} onValueChange={(value) => onFilterChange("city", value)}>
            <SelectTrigger className="w-40 h-9 bg-surface border-border rounded-doow-sm">
              <MapPin className="h-3 w-3" />
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              <SelectItem value="San Francisco">San Francisco</SelectItem>
              <SelectItem value="New York">New York</SelectItem>
              <SelectItem value="Seattle">Seattle</SelectItem>
              <SelectItem value="Austin">Austin</SelectItem>
              <SelectItem value="Los Angeles">Los Angeles</SelectItem>
              <SelectItem value="Chicago">Chicago</SelectItem>
              <SelectItem value="Boston">Boston</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedFilters.price} onValueChange={(value) => onFilterChange("price", value)}>
            <SelectTrigger className="w-28 h-9 bg-surface border-border rounded-doow-sm">
              <DollarSign className="h-3 w-3" />
              <SelectValue placeholder="Price" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prices</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedFilters.date} onValueChange={(value) => onFilterChange("date", value)}>
            <SelectTrigger className="w-36 h-9 bg-surface border-border rounded-doow-sm">
              <Calendar className="h-3 w-3" />
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="next-month">Next Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClearFilters}
            className="h-9 rounded-doow-sm border-border"
          >
            Clear All
          </Button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {selectedFilters.eventType !== "all" && (
            <Badge variant="secondary" className="text-xs">
              {selectedFilters.eventType}
            </Badge>
          )}
          {selectedFilters.city !== "all" && (
            <Badge variant="secondary" className="text-xs">
              {selectedFilters.city}
            </Badge>
          )}
          {selectedFilters.price !== "all" && (
            <Badge variant="secondary" className="text-xs">
              {selectedFilters.price}
            </Badge>
          )}
          {selectedFilters.date !== "all" && (
            <Badge variant="secondary" className="text-xs">
              {selectedFilters.date}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};