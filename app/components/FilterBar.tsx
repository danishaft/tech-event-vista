import { Filter, Calendar, MapPin, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
}

export const FilterBar = ({ selectedFilters, onFilterChange, onClearFilters }: FilterBarProps) => {
  const hasActiveFilters = Object.values(selectedFilters).some(value => value !== "all");

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Filters:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedFilters.eventType} onValueChange={(value) => onFilterChange("eventType", value)}>
            <SelectTrigger className="w-32 h-8 bg-surface">
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
            <SelectTrigger className="w-40 h-8 bg-surface">
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
            <SelectTrigger className="w-28 h-8 bg-surface">
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
            <SelectTrigger className="w-36 h-8 bg-surface">
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
            className="h-8"
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