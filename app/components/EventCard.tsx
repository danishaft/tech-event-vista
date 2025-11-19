import { Calendar, MapPin, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TechEvent } from "@/types/event";
import { useState } from "react";

interface EventCardProps {
  event: TechEvent;
  onClick: () => void;
}

export const EventCard = ({ event, onClick }: EventCardProps) => {
  const [isSaved, setIsSaved] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTechColor = (tech: string) => {
    const colors: Record<string, string> = {
      'React': 'bg-[#61dafb]/20 text-[#61dafb] border-[#61dafb]/30',
      'Python': 'bg-[#3776ab]/20 text-[#3776ab] border-[#3776ab]/30',
      'JavaScript': 'bg-[#f7df1e]/20 text-[#f7df1e] border-[#f7df1e]/30',
      'TypeScript': 'bg-[#3178c6]/20 text-[#3178c6] border-[#3178c6]/30',
      'AI/ML': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Node.js': 'bg-[#339933]/20 text-[#339933] border-[#339933]/30',
      'AWS': 'bg-[#ff9900]/20 text-[#ff9900] border-[#ff9900]/30',
    };
    return colors[tech] || 'bg-muted/20 text-muted-foreground border-border';
  };

  return (
    <Card 
      className="group relative bg-card border border-border overflow-hidden transition-all duration-300 hover:shadow-card-hover cursor-pointer rounded-lg"
      onClick={onClick}
    >
      {/* Image Section - Top (ARKLYTE Style) */}
      <div className="relative w-[calc(100%-24px)] h-48 md:h-56 overflow-hidden bg-muted/50 mx-3 mt-3 rounded-lg">
        <img 
          src={event.imageUrl} 
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent"></div>
        
        {/* Price Badge */}
        <div className="absolute top-3 left-3">
          <Badge className={`${event.price === 'Free' ? 'bg-success text-white' : 'bg-card/95 text-foreground'} border-0 font-semibold text-sm px-3 py-1 shadow-md`}>
            {event.price}
          </Badge>
        </div>

        {/* Save Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsSaved(!isSaved);
          }}
          className="absolute top-3 right-3 p-2 rounded-full bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-200 hover:scale-110 shadow-md"
        >
          <Heart 
            className={`h-5 w-5 transition-all ${isSaved ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
          />
        </button>
      </div>

      {/* Content Section - Bottom (ARKLYTE Style) */}
      <div className="p-5 md:p-6 space-y-3">
        {/* Title */}
        <h3 className="font-heading font-bold text-lg md:text-xl leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {event.title}
        </h3>

        {/* Date & Location */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm font-medium">{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm truncate">{event.neighborhood}, {event.city}</span>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="flex flex-wrap gap-2 pt-2">
          {event.techStack.slice(0, 3).map((tech) => (
            <span 
              key={tech} 
              className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getTechColor(tech)}`}
            >
              {tech}
            </span>
          ))}
          {event.techStack.length > 3 && (
            <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/20 text-muted-foreground font-medium">
              +{event.techStack.length - 3}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
