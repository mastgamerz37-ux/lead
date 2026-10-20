import re
import urllib.parse
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Optional

EMAIL_REGEX = re.compile(
    r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
)

OBFUSCATED_EMAIL_REGEX = re.compile(
    r'([a-zA-Z0-9_.+-]+)\s*(?:\[at\]|\(at\)|@)\s*([a-zA-Z0-9-]+)\s*(?:\[dot\]|\(dot\)|\.)\s*([a-zA-Z0-9-.]+)',
    re.IGNORECASE
)

WHATSAPP_REGEX = re.compile(
    r'(?:https?:\/\/)?(?:api\.whatsapp\.com\/send\?phone=|wa\.me\/|web\.whatsapp\.com\/send\?phone=)(\+?\d+)',
    re.IGNORECASE
)

# Common extensions or strings to filter out false-positive emails
EXCLUDE_EXTS = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.css', '.js', '.woff', '.woff2')
EXCLUDE_DOMAINS = ('sentry.io', 'wixpress.com', 'example.com', 'domain.com', 'email.com', 'google.com', 'schema.org')

def decode_cloudflare_email(cf_hash: str) -> Optional[str]:
    """Decodes Cloudflare email protection hash."""
    try:
        r = int(cf_hash[:2], 16)
        email = ''.join([chr(int(cf_hash[i:i+2], 16) ^ r) for i in range(2, len(cf_hash), 2)])
        return email if "@" in email else None
    except Exception:
        return None

def clean_email(email: str) -> Optional[str]:
    if not email:
        return None
    email = email.strip().lower().rstrip('.,;')
    if any(email.endswith(ext) for ext in EXCLUDE_EXTS):
        return None
    if any(domain in email for domain in EXCLUDE_DOMAINS):
        return None
    if len(email) > 60 or len(email) < 6:
        return None
    if ".." in email or email.count("@") != 1:
        return None
    return email

def clean_phone_number(raw_phone: str) -> str:
    """Formats phone into standard readable format."""
    digits = re.sub(r'\D', '', raw_phone)
    if len(digits) >= 10:
        return raw_phone.strip()
    return ""

def extract_social_links(soup: BeautifulSoup, base_url: str) -> Dict[str, str]:
    socials = {
        "instagram": "",
        "facebook": "",
        "linkedin": "",
        "twitter": "",
        "youtube": "",
        "whatsapp": ""
    }
    
    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        href_lower = href.lower()
        
        # WhatsApp link
        if not socials["whatsapp"]:
            wa_match = WHATSAPP_REGEX.search(href)
            if wa_match:
                digits = re.sub(r'\D', '', wa_match.group(1))
                if len(digits) >= 10:
                    socials["whatsapp"] = f"https://wa.me/{digits}"
            elif "whatsapp.com" in href_lower or "wa.me" in href_lower:
                socials["whatsapp"] = href

        # Instagram
        if not socials["instagram"] and "instagram.com/" in href_lower:
            if not any(skip in href_lower for skip in ['/p/', '/reel/', '/stories/', '/explore/']):
                socials["instagram"] = href
        # Facebook
        elif not socials["facebook"] and "facebook.com/" in href_lower:
            if not any(skip in href_lower for skip in ['sharer', 'share.php', '/dialog/']):
                socials["facebook"] = href
        # LinkedIn
        elif not socials["linkedin"] and "linkedin.com/" in href_lower:
            if not any(skip in href_lower for skip in ['shareArticle', 'sharing']):
                socials["linkedin"] = href
        # Twitter / X
        elif not socials["twitter"] and ("twitter.com/" in href_lower or "x.com/" in href_lower):
            if not any(skip in href_lower for skip in ['share', 'intent/tweet']):
                socials["twitter"] = href
        # YouTube
        elif not socials["youtube"] and ("youtube.com/" in href_lower or "youtu.be/" in href_lower):
            if "watch?" not in href_lower and "/embed/" not in href_lower:
                socials["youtube"] = href
            
    return socials

def enrich_website(website_url: str, timeout: int = 5) -> Dict:
    """
    Crawls a website URL to extract emails, WhatsApp links, and social media profiles.
    Tries homepage and contact pages if no email is found.
    """
    result = {
        "email": "",
        "instagram": "",
        "facebook": "",
        "linkedin": "",
        "twitter": "",
        "youtube": "",
        "whatsapp": "",
        "extra_phone": ""
    }
    
    if not website_url or not website_url.startswith("http"):
        return result
        
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
    }

    found_emails = set()
    found_phones = set()
    found_socials = {}
    contact_urls_to_check = []

    def inspect_html(html_text: str, current_url: str):
        soup = BeautifulSoup(html_text, 'html.parser')
        
        # 1. Cloudflare protected emails
        for cf in soup.select('[data-cfemail]'):
            cf_hash = cf.get('data-cfemail', '')
            decoded = decode_cloudflare_email(cf_hash)
            cleaned = clean_email(decoded) if decoded else None
            if cleaned:
                found_emails.add(cleaned)

        # 2. Check mailto: links
        for mailto in soup.select('a[href^="mailto:"]'):
            href = mailto.get('href', '')
            raw_email = href.replace('mailto:', '').split('?')[0].strip()
            cleaned = clean_email(raw_email)
            if cleaned:
                found_emails.add(cleaned)
                
        # 3. Check tel: links
        for tel_el in soup.select('a[href^="tel:"]'):
            href = tel_el.get('href', '')
            raw_phone = href.replace('tel:', '').split('?')[0].strip()
            cleaned_p = clean_phone_number(raw_phone)
            if cleaned_p:
                found_phones.add(cleaned_p)

        # 4. Standard regex
        for match in EMAIL_REGEX.findall(html_text):
            cleaned = clean_email(match)
            if cleaned:
                found_emails.add(cleaned)

        # 5. Obfuscated regex
        for obf in OBFUSCATED_EMAIL_REGEX.findall(html_text):
            composed = f"{obf[0]}@{obf[1]}.{obf[2]}"
            cleaned = clean_email(composed)
            if cleaned:
                found_emails.add(cleaned)
                
        # 6. Social and WhatsApp links
        extracted = extract_social_links(soup, current_url)
        for k, v in extracted.items():
            if v and not found_socials.get(k):
                found_socials[k] = v

        return soup

    try:
        resp = requests.get(website_url, headers=headers, timeout=timeout, allow_redirects=True)
        if resp.status_code == 200:
            soup = inspect_html(resp.text, website_url)
            
            # Find candidate contact links if no email found yet
            if not found_emails:
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    anchor_text = a.get_text().strip().lower()
                    if any(w in anchor_text or w in href.lower() for w in ['contact', 'about', 'support', 'reach']):
                        full_contact_url = urllib.parse.urljoin(website_url, href)
                        if full_contact_url != website_url and full_contact_url not in contact_urls_to_check:
                            contact_urls_to_check.append(full_contact_url)
                            if len(contact_urls_to_check) >= 2:
                                break
    except Exception:
        pass

    # Check contact page if still no email
    if not found_emails and contact_urls_to_check:
        try:
            c_url = contact_urls_to_check[0]
            resp2 = requests.get(c_url, headers=headers, timeout=timeout, allow_redirects=True)
            if resp2.status_code == 200:
                inspect_html(resp2.text, c_url)
        except Exception:
            pass

    if found_emails:
        # Prefer emails that have common business prefixes
        sorted_emails = sorted(list(found_emails), key=lambda e: (
            0 if any(p in e for p in ['info', 'contact', 'hello', 'support', 'sales', 'office', 'admin']) else 1
        ))
        result["email"] = sorted_emails[0]

    if found_phones and not result.get("extra_phone"):
        result["extra_phone"] = list(found_phones)[0]

    result.update(found_socials)
    return result
