import { Calendar, MapPin, Users, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TechEvent } from "@/data/sampleEvents";
import { useState } from "react";

interface EventCardProps {
  event: TechEvent;
}

export const EventCard = ({ event }: EventCardProps) => {
  const [isSaved, setIsSaved] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
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
    <Card className="group relative bg-card border-0 overflow-hidden transition-all duration-300 hover:bg-surface-hover hover:shadow-spotify-hover cursor-pointer flex h-40">
      {/* Image Section - Left Side */}
      <div className="relative w-56 flex-shrink-0 overflow-hidden bg-muted/50">
        <img 
          src={event.imageUrl} 
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        {/* Price Badge */}
        <div className="absolute top-2 left-2">
          <Badge className={`${event.price === 'Free' ? 'bg-success text-background' : 'bg-background/90 text-foreground'} backdrop-blur-md border-0 font-semibold text-xs`}>
            {event.price}
          </Badge>
        </div>
      </div>

      {/* Content Section - Right Side */}
      <div className="flex-1 p-5 flex flex-col justify-between relative min-w-0">
        {/* Save Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsSaved(!isSaved);
          }}
          className="absolute top-2 right-2 p-2 rounded-full bg-background/60 backdrop-blur-md hover:bg-background/80 transition-all duration-200 hover:scale-110 opacity-0 group-hover:opacity-100"
        >
          <Heart 
            className={`h-4 w-4 transition-all ${isSaved ? 'fill-primary text-primary' : 'text-foreground'}`}
          />
        </button>

        <div className="space-y-2.5 pr-10">
          {/* Title */}
          <h3 className="font-heading font-bold text-base leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {event.title}
          </h3>

          {/* Event Type & Date */}
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="capitalize border-border bg-transparent text-xs">
              {event.eventType}
            </Badge>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs">{formatDate(event.date)}</span>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xs truncate">{event.neighborhood}, {event.city}</span>
          </div>

          {/* Tech Stack */}
          <div className="flex flex-wrap gap-1.5">
            {event.techStack.slice(0, 3).map((tech) => (
              <span 
                key={tech} 
                className={`text-xs px-2 py-0.5 rounded-full border ${getTechColor(tech)}`}
              >
                {tech}
              </span>
            ))}
            {event.techStack.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-border/50 bg-muted/20 text-muted-foreground">
                +{event.techStack.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{event.attendees} going</span>
          </div>
          <span className="text-xs text-muted-foreground">{event.source}</span>
        </div>
      </div>
    </Card>
  );
};