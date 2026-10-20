# 🗺️ MapLead Studio - Google Maps Scraper & Lead Data Extractor

Ek powerful, fast aur modern tool jo Google Maps se businesses/leads extract karta hai aur live **in-browser editable Excel spreadsheet** provide karta hai jise aap directly browser me edit kar sakte hain aur professionally formatted **Excel (`.xlsx`)** ya **CSV** format me download kar sakte hain.

---

## 🚀 Key Features

1. **Google Maps High-Speed Scraper (`scraper.py`)**:
   - Searches any keyword and city (e.g. *Gyms in Mumbai*, *Dentists in Delhi*, *Web Agencies in Bangalore*).
   - Extracts:
     - 🏢 **Business Name**
     - 🏷️ **Category / Industry**
     - ⭐ **Rating & Total Reviews**
     - 📞 **Phone Number**
     - 🌐 **Website URL**
     - 📍 **Full Address**
     - 🗺️ **Google Maps Direct URL**
2. **Deep Contact Enrichment (`enricher.py`)**:
   - If a business has a website, the tool automatically crawls the website in the background to extract:
     - ✉️ **Email Address** (info@, contact@, support@, etc.)
     - 📷 **Instagram Profile**
     - 💼 **LinkedIn Profile**
     - 👥 **Facebook Page**
     - 🐦 **Twitter / X Profile**
3. **In-Browser Editable Spreadsheet Engine (`templates/index.html`, `static/js/app.js`)**:
   - **Direct In-Cell Editing**: Double-click or click any cell to edit data inline.
   - **Lead CRM Status**: Set lead status per row (*New*, *Qualified*, *Contacted*, *Converted*, *Do Not Contact*) with color-coded badges.
   - **Row Controls**: Add blank rows, delete selected rows, or clear sheet.
   - **Instant Search/Filter**: Filter leads by name, city, phone or category in real-time.
   - **Column Sorting**: Click any header to sort ascending or descending.
4. **Professional Excel (`.xlsx`) Export (`excel_manager.py`)**:
   - Generates beautifully styled Excel sheets with:
     - Dark Navy styled headers (`#1E293B`) with white bold text.
     - Auto-fitted column widths (no clipped content).
     - Clickable hyperlinks for Websites, Google Maps, and Social Profiles.
     - Alternating zebra row striping (`#F8FAFC`).
     - Frozen header row for smooth scrolling.
5. **Universal Import & Saved History**:
   - Import any existing `.xlsx` or `.csv` file to view and edit in the web UI.
   - Save sheets to the server and reload previous scrape sessions anytime.
6. **Modern Dark & Light UI**:
   - Sleek glassmorphism SaaS dashboard with real-time SSE progress bar, metrics counters, and live terminal logs.

---

## 📁 Project Structure

```
d:/tmp/
├── app.py                  # Flask server with API routes, SSE streams, job management
├── scraper.py              # Playwright-based Google Maps extractor
├── enricher.py             # Website contact & social profile crawler
├── excel_manager.py        # openpyxl engine for styled Excel generation & parsing
├── requirements.txt        # Python dependencies
├── run.bat                 # One-click Windows launcher
├── templates/
│   └── index.html          # Web UI with interactive spreadsheet
├── static/
│   ├── css/
│   │   └── style.css       # Dark/Light theme styles, glassmorphism, responsive grid
│   └── js/
│       └── app.js          # Spreadsheet controller, SSE events, filtering, exports
└── exports/                # Auto-saved Excel sheets directory
```

---

## ⚡ How to Run

### Method 1: One-Click Batch Launcher (Windows)
Double-click [`run.bat`](file:///d:/tmp/run.bat) in File Explorer.

### Method 2: Command Line
```powershell
python app.py
```

Then open your browser at:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🛠️ Usage Guide

1. **Enter Query**: Enter your target niche and location (e.g. `Real Estate in Gurgaon`).
2. **Set Limit**: Adjust the slider for the number of leads you want (e.g. 25, 50, 100).
3. **Toggles**: Keep *Deep Contact Enrichment* enabled to fetch emails and social links from company websites.
4. **Click "Start Scraping"**:
   - Watch live logs and progress in real-time.
   - Leads appear dynamically in the spreadsheet table as they are discovered.
5. **Edit Leads**:
   - Click into any cell to update phone numbers, emails, notes, or business names.
   - Change the **Lead Status** dropdown to track your sales outreach.
6. **Export**:
   - Click **Export Data** -> **Download Excel (.xlsx)** for a styled workbook.
   - Or export as **CSV** or copy directly to clipboard.
