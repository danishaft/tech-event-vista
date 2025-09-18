import { Bell, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/SearchBar";

interface HeaderProps {
  onMobileMenuToggle: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const Header = ({ onMobileMenuToggle, searchQuery, onSearchChange }: HeaderProps) => {
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
        <SearchBar 
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          className="hidden md:flex flex-1 max-w-md mx-8"
        />

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
          
          <Button variant="default" size="sm" className="hidden sm:flex">
            Sign In
          </Button>
        </div>
      </div>
      
      {/* Mobile Search */}
      <div className="md:hidden mt-3">
        <SearchBar 
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
      </div>
    </header>
  );
};