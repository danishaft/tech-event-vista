/**
 * Fetch full event details from external URLs
 * Used to get complete descriptions and organizer info when scrapers don't get it
 */

import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { createBrowser, configurePage, delay } from './puppeteerScraping'

puppeteer.use(StealthPlugin())

export interface EventDetails {
  description?: string
  organizerName?: string
  organizerDescription?: string
  fullDescription?: string
}

/**
 * Fetch event details from Eventbrite event page
 */
export async function fetchEventbriteDetails(url: string): Promise<EventDetails | null> {
  const browser = await createBrowser()
  
  try {
    const page = await browser.newPage()
    await configurePage(page)
    
    console.log(`   🔍 Fetching details from: ${url}`)
    
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })
    
    await delay(3000) // Wait for content to load
    
    const details = await page.evaluate(() => {
      // Try to find description
      const descSelectors = [
        '[data-testid="event-description"]',
        '[class*="event-description"]',
        '[class*="description"]',
        '[data-automation="event-description"]',
        'div[class*="RichText"]'
      ]
      
      let description = ''
      for (const selector of descSelectors) {
        const el = document.querySelector(selector)
        if (el) {
          description = el.textContent?.trim() || ''
          if (description.length > 100) break
        }
      }
      
      // Try to find organizer
      const orgSelectors = [
        '[data-testid="organizer-name"]',
        '[class*="organizer"]',
        '[class*="host"]',
        'a[href*="/organizer/"]'
      ]
      
      let organizerName = ''
      for (const selector of orgSelectors) {
        const el = document.querySelector(selector)
        if (el) {
          organizerName = el.textContent?.trim() || ''
          if (organizerName.length > 0 && organizerName.length < 100) break
        }
      }
      
      return {
        description: description || '',
        organizerName: organizerName || ''
      }
    })
    
    await browser.close()
    
    if (details.description && details.description.length >= 100) {
      console.log(`   ✅ Fetched description (${details.description.length} chars)`)
      if (details.organizerName) {
        console.log(`   ✅ Fetched organizer: ${details.organizerName}`)
      }
      return details
    }
    
    return null
  } catch (error) {
    console.error(`   ❌ Error fetching details from ${url}:`, error)
    await browser.close()
    return null
  }
}

/**
 * Fetch event details from Luma event page
 */
export async function fetchLumaDetails(url: string): Promise<EventDetails | null> {
  const browser = await createBrowser()
  
  try {
    const page = await browser.newPage()
    await configurePage(page)
    
    console.log(`   🔍 Fetching details from: ${url}`)
    
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })
    
    await delay(3000)
    
    const details = await page.evaluate(() => {
      // Luma description selectors
      const descSelectors = [
        '[class*="description"]',
        '[class*="event-description"]',
        'div[class*="RichText"]'
      ]
      
      let description = ''
      for (const selector of descSelectors) {
        const el = document.querySelector(selector)
        if (el) {
          description = el.textContent?.trim() || ''
          if (description.length > 100) break
        }
      }
      
      // Luma organizer/host selectors
      const orgSelectors = [
        '[class*="host"]',
        '[class*="organizer"]',
        'a[href*="/calendar/"]'
      ]
      
      let organizerName = ''
      for (const selector of orgSelectors) {
        const el = document.querySelector(selector)
        if (el) {
          organizerName = el.textContent?.trim() || ''
          if (organizerName.length > 0 && organizerName.length < 100) break
        }
      }
      
      return {
        description: description || '',
        organizerName: organizerName || ''
      }
    })
    
    await browser.close()
    
    if (details.description && details.description.length >= 100) {
      console.log(`   ✅ Fetched description (${details.description.length} chars)`)
      if (details.organizerName) {
        console.log(`   ✅ Fetched organizer: ${details.organizerName}`)
      }
      return details
    }
    
    return null
  } catch (error) {
    console.error(`   ❌ Error fetching details from ${url}:`, error)
    await browser.close()
    return null
  }
}

