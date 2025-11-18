import { Search, Bell, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onMobileMenuToggle: () => void;
  onSearch?: (query: string) => void;
  isSearching?: boolean;
}

export const Header = ({ onMobileMenuToggle, onSearch, isSearching }: HeaderProps) => {
  const router = useRouter();
  return (
    <header className="bg-background border-b border-border px-4 py-3 sticky top-0 z-50 backdrop-blur-sm bg-background/80">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo and Mobile Menu */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMobileMenuToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">TR</span>
            </div>
            <span className="font-heading font-bold text-xl">Tech Event Radar</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search events, technologies, locations..."
              className="pl-10 pr-24 bg-surface border-border focus:ring-primary/50"
              disabled={isSearching}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onSearch) {
                  const value = (e.target as HTMLInputElement).value.trim();
                  if (value) onSearch(value);
                }
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Button size="sm" disabled={isSearching} onClick={(e) => {
                const input = (e.currentTarget.parentElement?.parentElement?.querySelector('input') as HTMLInputElement) || null;
                const value = input?.value?.trim();
                if (value && onSearch) onSearch(value);
              }}>{isSearching ? 'Searching…' : 'Search'}</Button>
            </div>
          </div>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs px-1 min-w-5 h-5 flex items-center justify-center">
              3
            </Badge>
          </Button>
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Mobile Search */}
      <div className="md:hidden mt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search events..."
            className="pl-10 pr-24 bg-surface border-border"
            disabled={isSearching}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onSearch) {
                const value = (e.target as HTMLInputElement).value.trim();
                if (value) onSearch(value);
              }
            }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Button size="sm" disabled={isSearching} onClick={(e) => {
              const input = (e.currentTarget.parentElement?.parentElement?.querySelector('input') as HTMLInputElement) || null;
              const value = input?.value?.trim();
              if (value && onSearch) onSearch(value);
            }}>{isSearching ? 'Searching…' : 'Search'}</Button>
          </div>
        </div>
      </div>
    </header>
  );
};