import re
import time
import math
import urllib.parse
from threading import Event
from typing import Callable, Dict, List, Optional, Tuple
from playwright.sync_api import sync_playwright

from enricher import enrich_website

PHONE_REGEX = re.compile(r'(\+?\d{1,4}[-.\s]?)?(\(?\d{2,5}\)?[-.\s]?)?[\d\s\-.]{6,14}\d')
RATING_REGEX = re.compile(r'(\d\.\d)')
REVIEWS_REGEX = re.compile(r'\(?(\d[\d,]*)\)?\s*(?:reviews?|ratings?)?', re.IGNORECASE)

# RegEx for coordinate extraction from Google Maps URLs
COORD_AT_REGEX = re.compile(r'@(-?\d+\.\d+),(-?\d+\.\d+)')
COORD_3D4D_REGEX = re.compile(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)')

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in kilometers."""
    R = 6371.0 # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def clean_google_url(url: str) -> str:
    """Extracts actual target URL if wrapped in Google redirect."""
    if not url:
        return ""
    if "google.com/url?" in url:
        parsed = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(parsed.query)
        if "q" in qs and qs["q"]:
            return qs["q"][0]
    return url

def format_whatsapp_number(phone_str: str) -> str:
    """Formats phone number to clean WhatsApp link digits."""
    digits = re.sub(r'\D', '', phone_str)
    if not digits:
        return ""
    # Indian mobile standard: 10 digits starting with 6,7,8,9
    if len(digits) == 10 and digits[0] in '6789':
        return f"91{digits}"
    # 11 digits starting with 0
    if len(digits) == 11 and digits.startswith('0') and digits[1] in '6789':
        return f"91{digits[1:]}"
    # Already with country code (e.g. 91xxxxxxxxxx)
    if len(digits) >= 11:
        return digits
    return ""

def sanitize_address(text: str) -> str:
    """Removes operational clutter (hours, dine-in tags) from address strings."""
    if not text:
        return "N/A"
    skip_phrases = [
        'open 24 hours', 'opens soon', 'closes soon', 'closed',
        'open ⋅ closes', 'open · closes', 'dine-in', 'takeaway',
        'delivery', 'no dine-in', 'temporarily closed', 'permanently closed'
    ]
    parts = [p.strip() for p in re.split(r'[·•|]', text) if p.strip()]
    cleaned_parts = [
        p for p in parts 
        if not any(skip in p.lower() for skip in skip_phrases) and not RATING_REGEX.match(p)
    ]
    return ", ".join(cleaned_parts) if cleaned_parts else text.strip()

class GoogleMapsScraper:
    def __init__(
        self,
        query: str,
        limit: int = 25,
        headless: bool = True,
        enrich_lead: bool = True,
        user_lat: Optional[float] = None,
        user_lng: Optional[float] = None,
        radius_km: float = 50.0,
        strict_radius: bool = False,
        near_me: bool = False,
        location_name: str = "",
        callback: Optional[Callable[[Dict], None]] = None,
        stop_event: Optional[Event] = None
    ):
        self.query = query.strip()
        self.limit = max(1, limit)
        self.headless = headless
        self.enrich_lead = enrich_lead
        self.user_lat = float(user_lat) if user_lat is not None else None
        self.user_lng = float(user_lng) if user_lng is not None else None
        self.radius_km = float(radius_km) if radius_km else 50.0
        self.strict_radius = strict_radius
        self.near_me = near_me
        self.location_name = location_name.strip()
        self.callback = callback
        self.stop_event = stop_event or Event()
        self.results: List[Dict] = []

    def notify(self, event_type: str, message: str, data: Optional[Dict] = None, progress: int = 0):
        if self.callback:
            self.callback({
                "type": event_type,
                "message": message,
                "data": data,
                "progress": progress,
                "total_found": len(self.results)
            })

    def construct_search_url(self) -> str:
        """Constructs Google Maps search URL with geolocation coordinates if available."""
        encoded_query = urllib.parse.quote(self.query)
        if self.user_lat is not None and self.user_lng is not None:
            # Zoom 11 gives roughly ~50km radius coverage on desktop Google Maps
            zoom = "11z" if self.radius_km >= 40 else "12z"
            return f"https://www.google.com/maps/search/{encoded_query}/@{self.user_lat},{self.user_lng},{zoom}"
        return f"https://www.google.com/maps/search/{encoded_query}"

    def extract_coordinates(self, url: str) -> Tuple[Optional[float], Optional[float]]:
        """Extracts latitude and longitude from place URL."""
        if not url:
            return None, None
        
        # Check !3d...!4d... pattern
        m_3d = COORD_3D4D_REGEX.search(url)
        if m_3d:
            try:
                return float(m_3d.group(1)), float(m_3d.group(2))
            except ValueError:
                pass

        # Check @lat,lng pattern
        m_at = COORD_AT_REGEX.search(url)
        if m_at:
            try:
                return float(m_at.group(1)), float(m_at.group(2))
            except ValueError:
                pass

        return None, None

    def run(self) -> List[Dict]:
        target_info = f"Near Me ({self.radius_km}km radius)" if self.near_me else f"'{self.query}'"
        if self.location_name:
            target_info += f" around {self.location_name}"
            
        self.notify("log", f"Starting Google Maps Scraper for: {target_info}", progress=5)
        
        search_url = self.construct_search_url()
        self.notify("log", f"Target Search URL: {search_url}", progress=8)
        
        with sync_playwright() as p:
            browser = None
            try:
                # Try launching with Chrome, Edge, or standard Chromium
                try:
                    browser = p.chromium.launch(channel="chrome", headless=self.headless)
                except Exception:
                    try:
                        browser = p.chromium.launch(channel="msedge", headless=self.headless)
                    except Exception:
                        browser = p.chromium.launch(headless=self.headless)

                context_kwargs = {
                    "locale": "en-US",
                    "viewport": {"width": 1366, "height": 850},
                    "user_agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/126.0.0.0 Safari/537.36"
                    )
                }

                # Inject geolocation if available
                if self.user_lat is not None and self.user_lng is not None:
                    context_kwargs["geolocation"] = {
                        "latitude": self.user_lat,
                        "longitude": self.user_lng,
                        "accuracy": 100
                    }
                    context_kwargs["permissions"] = ["geolocation"]

                context = browser.new_context(**context_kwargs)
                page = context.new_page()

                self.notify("log", "Navigating to Google Maps...", progress=12)
                page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
                time.sleep(2.5)

                # Dismiss consent dialogs if present
                for sel in ["button:has-text('Accept all')", "button:has-text('I agree')", "button:has-text('Accept')"]:
                    try:
                        btn = page.locator(sel)
                        if btn.count() > 0:
                            btn.first.click()
                            time.sleep(1)
                            break
                    except Exception:
                        pass

                # Locate feed element
                feed_selector = 'div[role="feed"]'
                try:
                    page.wait_for_selector(feed_selector, timeout=12000)
                except Exception:
                    # Sometimes only a single result is returned and redirected directly to place view
                    self.notify("log", "Checking if query redirected directly to a single business profile...")
                    single_title = page.locator('h1.DUwDvf, h1')
                    if single_title.count() > 0:
                        b_name = single_title.first.inner_text().strip()
                        self.notify("log", f"Single result detected: {b_name}")
                        # Extract directly from single place page
                        # Will continue flow below

                self.notify("log", "Google Maps feed active. Indexing places & verifying distances...", progress=16)

                seen_place_keys = set()
                consecutive_no_new_leads = 0
                max_scroll_attempts = 40

                for scroll_idx in range(max_scroll_attempts):
                    if self.stop_event.is_set():
                        self.notify("log", "Scraping cancelled by user.", progress=100)
                        break

                    if len(self.results) >= self.limit:
                        break

                    cards = page.locator('div[role="feed"] > div > div[jsaction]')
                    total_cards = cards.count()
                    new_in_this_batch = 0

                    for i in range(total_cards):
                        if self.stop_event.is_set() or len(self.results) >= self.limit:
                            break

                        card = cards.nth(i)
                        
                        # Check place link
                        link_el = card.locator('a[href*="/maps/place/"]')
                        if link_el.count() == 0:
                            continue

                        href = link_el.first.get_attribute("href") or ""
                        aria_title = link_el.first.get_attribute("aria-label") or ""
                        
                        place_key = href.split("?")[0] if href else aria_title
                        if not place_key or place_key in seen_place_keys:
                            continue

                        seen_place_keys.add(place_key)
                        new_in_this_batch += 1

                        # Extract text lines from card
                        raw_text = card.inner_text()
                        lines = [line.strip() for line in raw_text.split("\n") if line.strip()]

                        # Business name
                        business_name = aria_title or (lines[0] if lines else "Unknown Business")

                        # Coordinates & Distance calculation
                        p_lat, p_lng = self.extract_coordinates(href)
                        distance_km = None
                        distance_text = "N/A"

                        if p_lat is not None and p_lng is not None and self.user_lat is not None and self.user_lng is not None:
                            distance_km = haversine_distance_km(self.user_lat, self.user_lng, p_lat, p_lng)
                            distance_text = f"{distance_km} km"

                            # Strict 50km radius filter: Skip places outside radius if enabled
                            if self.strict_radius and distance_km > self.radius_km:
                                self.notify("log", f"Skipping '{business_name}' ({distance_km} km > {self.radius_km} km limit)")
                                continue

                        # Rating & reviews
                        rating = ""
                        reviews = ""
                        for line in lines:
                            r_match = RATING_REGEX.match(line)
                            if r_match and not rating:
                                val = float(r_match.group(1))
                                if 1.0 <= val <= 5.0:
                                    rating = str(val)
                            rev_match = REVIEWS_REGEX.search(line)
                            if rev_match and not reviews:
                                reviews = rev_match.group(1).replace(",", "")

                        # Category & Address & Phone
                        category = ""
                        address = ""
                        phone = ""

                        for line in lines[1:]:
                            if line == rating or f"({reviews})" in line:
                                continue
                            
                            # Phone number check
                            p_match = PHONE_REGEX.search(line)
                            if p_match and not phone:
                                potential_phone = p_match.group(0).strip()
                                digits = re.sub(r'\D', '', potential_phone)
                                if len(digits) >= 8:
                                    phone = potential_phone
                                    continue

                            # Category & Address splitting
                            if any(sym in line for sym in ['·', '•', '|']):
                                parts = [p.strip() for p in re.split(r'[·•|]', line) if p.strip()]
                                if parts:
                                    if not category:
                                        category = parts[0]
                                    if len(parts) > 1 and not address:
                                        address = sanitize_address(", ".join(parts[1:]))
                            elif not category and len(line) < 35 and not any(kw in line.lower() for kw in ['open', 'closed', 'opens', 'closes']):
                                category = line
                            elif not address and len(line) > 8 and not any(kw in line.lower() for kw in ['open', 'closed', 'opens', 'closes']):
                                address = sanitize_address(line)

                        # Website extraction
                        website = ""
                        web_link = card.locator('a[aria-label*="website" i], a[aria-label*="Website"]')
                        if web_link.count() > 0:
                            website = clean_google_url(web_link.first.get_attribute("href") or "")

                        # WhatsApp link derivation
                        whatsapp = ""
                        if phone:
                            wa_digits = format_whatsapp_number(phone)
                            if wa_digits:
                                whatsapp = f"https://wa.me/{wa_digits}"

                        # Build lead object
                        lead = {
                            "id": len(self.results) + 1,
                            "name": business_name,
                            "category": category or "Local Business",
                            "rating": rating or "N/A",
                            "reviews": reviews or "0",
                            "phone": phone or "N/A",
                            "whatsapp": whatsapp or "",
                            "distance_km": distance_km,
                            "distance_text": distance_text,
                            "latitude": p_lat,
                            "longitude": p_lng,
                            "address": address or "N/A",
                            "website": website or "",
                            "email": "",
                            "instagram": "",
                            "facebook": "",
                            "linkedin": "",
                            "twitter": "",
                            "maps_url": href,
                            "status": "New",
                            "notes": f"Scraped near {self.location_name}" if self.location_name else ""
                        }

                        # Contact Enrichment
                        if self.enrich_lead and lead["website"]:
                            self.notify("log", f"Enriching: Visiting {lead['website']} for contacts...")
                            try:
                                enrichment = enrich_website(lead["website"], timeout=5)
                                lead["email"] = enrichment.get("email", "")
                                lead["instagram"] = enrichment.get("instagram", "")
                                lead["facebook"] = enrichment.get("facebook", "")
                                lead["linkedin"] = enrichment.get("linkedin", "")
                                lead["twitter"] = enrichment.get("twitter", "")
                                if not lead["whatsapp"] and enrichment.get("whatsapp"):
                                    lead["whatsapp"] = enrichment.get("whatsapp")
                                if lead["phone"] == "N/A" and enrichment.get("extra_phone"):
                                    lead["phone"] = enrichment.get("extra_phone")
                            except Exception:
                                pass

                        self.results.append(lead)
                        calc_progress = min(95, int(16 + (len(self.results) / self.limit) * 80))
                        
                        dist_info = f" | Dist: {lead['distance_text']}" if distance_text != "N/A" else ""
                        phone_info = f" | Phone: {lead['phone']}" if lead['phone'] != 'N/A' else ""
                        email_info = f" | Email: {lead['email']}" if lead['email'] else ""
                        
                        self.notify(
                            "lead",
                            f"Verified [{len(self.results)}/{self.limit}]: {lead['name']}{dist_info}{phone_info}{email_info}",
                            data=lead,
                            progress=calc_progress
                        )

                    if new_in_this_batch == 0:
                        consecutive_no_new_leads += 1
                    else:
                        consecutive_no_new_leads = 0

                    if consecutive_no_new_leads >= 4:
                        end_text = page.locator("text='You\\'ve reached the end of the list.'")
                        if end_text.count() > 0 or consecutive_no_new_leads >= 6:
                            self.notify("log", "Reached the end of available Google Maps listings.")
                            break

                    # Scroll feed down to trigger infinite scroll load
                    try:
                        page.eval_on_selector(
                            feed_selector,
                            "el => el.scrollBy(0, el.clientHeight * 1.5)"
                        )
                        time.sleep(1.8)
                    except Exception:
                        time.sleep(1.5)

                self.notify("complete", f"Successfully extracted and noted {len(self.results)} verified leads!", progress=100)

            except Exception as e:
                self.notify("error", f"Scraper error: {str(e)}", progress=100)
            finally:
                if browser:
                    try:
                        browser.close()
                    except Exception:
                        pass

        return self.results
