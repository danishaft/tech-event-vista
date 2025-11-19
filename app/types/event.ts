export interface TechEvent {
  id: string;
  title: string;
  description: string;
  date: string; // Formatted date string
  eventType: 'conference' | 'hackathon' | 'meetup' | 'networking' | 'workshop';
  price: string; // "Free" or "$XX"
  imageUrl?: string;
  city: string;
  neighborhood: string;
  attendees: number;
  organizerRating: number;
  techStack: string[];
  externalUrl?: string;
  source: 'Eventbrite' | 'Luma' | 'Meetup';
}

