import { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  className?: string;
}

export const SearchBar = ({ searchQuery, onSearchChange, className = "" }: SearchBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches] = useState([
    'React workshop', 'AI meetup', 'Python conference', 'Blockchain hackathon'
  ]);
  const [trendingTopics] = useState([
    'AI/ML', 'Web3', 'React', 'Python', 'DevOps', 'Cybersecurity'
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearSearch = () => {
    onSearchChange('');
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSearchChange(suggestion);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={inputRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search events, technologies, locations..."
          className="pl-10 pr-10 bg-surface border-border focus:ring-primary/50"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
            onClick={handleClearSearch}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Search Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          <div className="p-4">
            {searchQuery === '' && (
              <>
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Recent Searches</span>
                    </div>
                    <div className="space-y-1">
                      {recentSearches.map((search, index) => (
                        <button
                          key={index}
                          className="block w-full text-left px-2 py-1 text-sm hover:bg-muted rounded"
                          onClick={() => handleSuggestionClick(search)}
                        >
                          {search}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending Topics */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Trending Topics</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {trendingTopics.map((topic, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs"
                        onClick={() => handleSuggestionClick(topic)}
                      >
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Search Results Preview */}
            {searchQuery && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  Search suggestions for "{searchQuery}"
                </div>
                <div className="space-y-1">
                  <button
                    className="block w-full text-left px-2 py-1 text-sm hover:bg-muted rounded"
                    onClick={() => handleSuggestionClick(`${searchQuery} workshop`)}
                  >
                    {searchQuery} <span className="text-muted-foreground">workshop</span>
                  </button>
                  <button
                    className="block w-full text-left px-2 py-1 text-sm hover:bg-muted rounded"
                    onClick={() => handleSuggestionClick(`${searchQuery} meetup`)}
                  >
                    {searchQuery} <span className="text-muted-foreground">meetup</span>
                  </button>
                  <button
                    className="block w-full text-left px-2 py-1 text-sm hover:bg-muted rounded"
                    onClick={() => handleSuggestionClick(`${searchQuery} conference`)}
                  >
                    {searchQuery} <span className="text-muted-foreground">conference</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};