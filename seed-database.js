const { PrismaClient } = require('@prisma/client');

async function seedDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🌱 Seeding database with sample events...');
    
    // Sample events data
    const sampleEvents = [
      {
        title: 'React Workshop: Building Modern UIs',
        description: 'Learn React fundamentals and build a modern web application',
        eventType: 'workshop',
        eventDate: new Date('2024-12-15T10:00:00Z'),
        eventEndDate: new Date('2024-12-15T16:00:00Z'),
        venueName: 'Tech Hub SF',
        venueAddress: '123 Market St, San Francisco, CA',
        city: 'San Francisco',
        country: 'US',
        isOnline: false,
        isFree: false,
        priceMin: 50,
        priceMax: 50,
        currency: 'USD',
        organizerName: 'SF React Meetup',
        organizerDescription: 'San Francisco React community',
        organizerRating: 4.8,
        capacity: 50,
        registeredCount: 23,
        techStack: ['React', 'TypeScript', 'Next.js'],
        qualityScore: 8.5,
        externalUrl: 'https://example.com/react-workshop',
        imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=500',
        sourcePlatform: 'eventbrite',
        sourceId: 'react-workshop-001',
      },
      {
        title: 'AI & Machine Learning Conference 2024',
        description: 'Explore the latest in AI, ML, and data science',
        eventType: 'conference',
        eventDate: new Date('2024-12-20T09:00:00Z'),
        eventEndDate: new Date('2024-12-22T17:00:00Z'),
        venueName: 'Moscone Center',
        venueAddress: '747 Howard St, San Francisco, CA',
        city: 'San Francisco',
        country: 'US',
        isOnline: false,
        isFree: false,
        priceMin: 299,
        priceMax: 599,
        currency: 'USD',
        organizerName: 'AI Conference Inc',
        organizerDescription: 'Leading AI conference organizer',
        organizerRating: 4.9,
        capacity: 1000,
        registeredCount: 456,
        techStack: ['Python', 'TensorFlow', 'PyTorch', 'AI', 'ML'],
        qualityScore: 9.2,
        externalUrl: 'https://example.com/ai-conference',
        imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=500',
        sourcePlatform: 'luma',
        sourceId: 'ai-conf-2024',
      },
      {
        title: 'JavaScript Meetup: Async Patterns',
        description: 'Deep dive into async JavaScript patterns and best practices',
        eventType: 'meetup',
        eventDate: new Date('2024-12-10T18:30:00Z'),
        eventEndDate: new Date('2024-12-10T21:00:00Z'),
        venueName: 'WeWork SOMA',
        venueAddress: '456 Mission St, San Francisco, CA',
        city: 'San Francisco',
        country: 'US',
        isOnline: true,
        isFree: true,
        priceMin: 0,
        priceMax: 0,
        currency: 'USD',
        organizerName: 'SF JavaScript Meetup',
        organizerDescription: 'San Francisco JavaScript community',
        organizerRating: 4.6,
        capacity: 100,
        registeredCount: 67,
        techStack: ['JavaScript', 'Node.js', 'Async/Await'],
        qualityScore: 7.8,
        externalUrl: 'https://example.com/js-meetup',
        imageUrl: 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=500',
        sourcePlatform: 'meetup',
        sourceId: 'js-meetup-async',
      },
      {
        title: '24-Hour Hackathon: Climate Tech',
        description: 'Build solutions for climate change in 24 hours',
        eventType: 'hackathon',
        eventDate: new Date('2024-12-28T09:00:00Z'),
        eventEndDate: new Date('2024-12-29T09:00:00Z'),
        venueName: 'Innovation Lab',
        venueAddress: '789 Folsom St, San Francisco, CA',
        city: 'San Francisco',
        country: 'US',
        isOnline: false,
        isFree: true,
        priceMin: 0,
        priceMax: 0,
        currency: 'USD',
        organizerName: 'Climate Tech Hub',
        organizerDescription: 'Climate technology innovation center',
        organizerRating: 4.7,
        capacity: 200,
        registeredCount: 89,
        techStack: ['React', 'Python', 'IoT', 'Climate Tech'],
        qualityScore: 8.1,
        externalUrl: 'https://example.com/climate-hackathon',
        imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500',
        sourcePlatform: 'eventbrite',
        sourceId: 'climate-hackathon-2024',
      },
      {
        title: 'Python Data Science Workshop',
        description: 'Learn data analysis with Python, Pandas, and Jupyter',
        eventType: 'workshop',
        eventDate: new Date('2024-12-12T14:00:00Z'),
        eventEndDate: new Date('2024-12-12T18:00:00Z'),
        venueName: 'Data Science Academy',
        venueAddress: '321 California St, San Francisco, CA',
        city: 'San Francisco',
        country: 'US',
        isOnline: false,
        isFree: false,
        priceMin: 75,
        priceMax: 75,
        currency: 'USD',
        organizerName: 'SF Data Science',
        organizerDescription: 'Data science education and community',
        organizerRating: 4.5,
        capacity: 30,
        registeredCount: 18,
        techStack: ['Python', 'Pandas', 'Jupyter', 'Data Science'],
        qualityScore: 7.9,
        externalUrl: 'https://example.com/python-workshop',
        imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500',
        sourcePlatform: 'meetup',
        sourceId: 'python-ds-workshop',
      }
    ];

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await prisma.eventCategory.deleteMany();
    await prisma.savedEvent.deleteMany();
    await prisma.scrapingJob.deleteMany();
    await prisma.event.deleteMany();
    await prisma.user.deleteMany();

    // Insert sample events
    console.log('📝 Inserting sample events...');
    for (const eventData of sampleEvents) {
      const event = await prisma.event.create({
        data: eventData,
      });
      console.log(`✅ Created event: ${event.title}`);
    }

    // Create sample scraping jobs
    console.log('📝 Creating sample scraping jobs...');
    const scrapingJobs = [
      {
        platform: 'eventbrite',
        status: 'completed',
        startedAt: new Date('2024-12-01T06:00:00Z'),
        completedAt: new Date('2024-12-01T06:30:00Z'),
        eventsScraped: 15,
      },
      {
        platform: 'meetup',
        status: 'completed',
        startedAt: new Date('2024-12-01T06:30:00Z'),
        completedAt: new Date('2024-12-01T07:00:00Z'),
        eventsScraped: 8,
      },
      {
        platform: 'luma',
        status: 'pending',
        startedAt: new Date('2024-12-01T07:00:00Z'),
        eventsScraped: 0,
      }
    ];

    for (const jobData of scrapingJobs) {
      const job = await prisma.scrapingJob.create({
        data: jobData,
      });
      console.log(`✅ Created scraping job: ${job.platform} - ${job.status}`);
    }

    // Verify data
    const eventCount = await prisma.event.count();
    const jobCount = await prisma.scrapingJob.count();
    
    console.log('\n🎉 Database seeded successfully!');
    console.log(`📊 Events: ${eventCount}`);
    console.log(`📊 Scraping Jobs: ${jobCount}`);
    
    // Show sample data
    const sampleEvent = await prisma.event.findFirst({
      include: {
        eventCategories: true,
      },
    });
    
    if (sampleEvent) {
      console.log('\n📋 Sample Event:');
      console.log(`   Title: ${sampleEvent.title}`);
      console.log(`   City: ${sampleEvent.city}`);
      console.log(`   Type: ${sampleEvent.eventType}`);
      console.log(`   Tech Stack: ${sampleEvent.techStack.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDatabase();


