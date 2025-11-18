/**
 * TechEvent type definition
 * Used by UI components to type event data
 */
export interface TechEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  city: string;
  neighborhood: string;
  techStack: string[];
  eventType: "workshop" | "conference" | "meetup" | "hackathon" | "networking";
  source: "Eventbrite" | "Meetup" | "Luma";
  sourceUrl: string;
  externalUrl?: string; // Alias for sourceUrl, used by API
  price: string;
  attendees: number;
  maxAttendees: number;
  imageUrl: string;
  organizer: string;
  organizerRating: number;
  isOnline: boolean;
  isSoldOut: boolean;
  registrationDeadline: string;
  qualityScore: number;
}


