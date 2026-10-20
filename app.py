import os
import time
import json
import uuid
import queue
import threading
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify, Response, send_file

from scraper import GoogleMapsScraper
from excel_manager import (
    export_excel_bytes,
    export_csv_bytes,
    parse_uploaded_file,
    save_excel_file,
    EXPORTS_DIR
)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32 MB max upload

# Store active background scraping jobs
ACTIVE_JOBS = {}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/locate", methods=["GET"])
def locate_user():
    """Fallback IP geolocation endpoint if browser GPS is unavailable or blocked."""
    try:
        # Try geojs.io first (fast and free)
        resp = requests.get("https://get.geojs.io/v1/ip/geo.json", timeout=4)
        if resp.status_code == 200:
            d = resp.json()
            return jsonify({
                "success": True,
                "latitude": float(d.get("latitude", 0)),
                "longitude": float(d.get("longitude", 0)),
                "city": d.get("city", "Unknown City"),
                "region": d.get("region", ""),
                "country": d.get("country", "")
            })
    except Exception:
        pass

    try:
        # Fallback to ipapi.co
        resp2 = requests.get("https://ipapi.co/json/", timeout=4)
        if resp2.status_code == 200:
            d2 = resp2.json()
            return jsonify({
                "success": True,
                "latitude": float(d2.get("latitude", 0)),
                "longitude": float(d2.get("longitude", 0)),
                "city": d2.get("city", "Unknown City"),
                "region": d2.get("region", ""),
                "country": d2.get("country_name", "")
            })
    except Exception:
        pass

    return jsonify({"success": False, "error": "Could not determine location from IP"}), 404

@app.route("/api/scrape/start", methods=["POST"])
def start_scrape():
    data = request.get_json() or {}
    query = data.get("query", "").strip()
    limit = int(data.get("limit", 25))
    headless = bool(data.get("headless", True))
    enrich_lead = bool(data.get("enrich_lead", True))
    user_lat = data.get("user_lat")
    user_lng = data.get("user_lng")
    radius_km = float(data.get("radius_km", 50.0))
    strict_radius = bool(data.get("strict_radius", False))
    near_me = bool(data.get("near_me", False))
    location_name = data.get("location_name", "").strip()

    if not query:
        return jsonify({"error": "Query cannot be empty"}), 400

    job_id = str(uuid.uuid4())[:8]
    event_queue = queue.Queue()
    stop_event = threading.Event()

    job_state = {
        "id": job_id,
        "query": query,
        "limit": limit,
        "user_lat": user_lat,
        "user_lng": user_lng,
        "radius_km": radius_km,
        "strict_radius": strict_radius,
        "near_me": near_me,
        "location_name": location_name,
        "status": "running",
        "progress": 0,
        "leads": [],
        "logs": [],
        "queue": event_queue,
        "stop_event": stop_event,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    ACTIVE_JOBS[job_id] = job_state

    def callback_handler(event_data):
        event_type = event_data.get("type")
        msg = event_data.get("message", "")
        lead = event_data.get("data")
        prog = event_data.get("progress", 0)

        job_state["progress"] = prog
        if msg:
            timestamp = datetime.now().strftime("%H:%M:%S")
            log_entry = f"[{timestamp}] {msg}"
            job_state["logs"].append(log_entry)

        if event_type == "lead" and lead:
            job_state["leads"].append(lead)

        if event_type == "complete":
            job_state["status"] = "completed"
            job_state["progress"] = 100
        elif event_type == "error":
            job_state["status"] = "error"

        # Push to SSE stream queue
        event_queue.put(event_data)

    def worker():
        try:
            scraper = GoogleMapsScraper(
                query=query,
                limit=limit,
                headless=headless,
                enrich_lead=enrich_lead,
                user_lat=user_lat,
                user_lng=user_lng,
                radius_km=radius_km,
                strict_radius=strict_radius,
                near_me=near_me,
                location_name=location_name,
                callback=callback_handler,
                stop_event=stop_event
            )
            scraper.run()
        except Exception as ex:
            callback_handler({
                "type": "error",
                "message": f"Worker error: {str(ex)}",
                "progress": 100
            })
        finally:
            if job_state["status"] == "running":
                job_state["status"] = "completed" if not stop_event.is_set() else "stopped"
            event_queue.put({"type": "end"})

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

    return jsonify({
        "job_id": job_id,
        "status": "started",
        "query": query,
        "limit": limit,
        "near_me": near_me,
        "radius_km": radius_km
    })

@app.route("/api/scrape/stream/<job_id>")
def scrape_stream(job_id):
    if job_id not in ACTIVE_JOBS:
        return jsonify({"error": "Job not found"}), 404

    job = ACTIVE_JOBS[job_id]
    q = job["queue"]

    def event_generator():
        # First yield existing state
        init_payload = {
            "type": "init",
            "status": job["status"],
            "progress": job["progress"],
            "leads": job["leads"],
            "logs": job["logs"][-25:]
        }
        yield f"data: {json.dumps(init_payload)}\n\n"

        while True:
            try:
                event = q.get(timeout=25)
                if event.get("type") == "end":
                    yield f"data: {json.dumps({'type': 'end', 'status': job['status']})}\n\n"
                    break
                yield f"data: {json.dumps(event)}\n\n"
            except queue.Empty:
                # Keep-alive ping
                yield f": ping\n\n"

    return Response(event_generator(), mimetype="text/event-stream")

@app.route("/api/scrape/stop/<job_id>", methods=["POST"])
def stop_scrape(job_id):
    if job_id not in ACTIVE_JOBS:
        return jsonify({"error": "Job not found"}), 404

    job = ACTIVE_JOBS[job_id]
    job["stop_event"].set()
    job["status"] = "stopped"
    job["queue"].put({
        "type": "log",
        "message": "Scrape operation stopped by user.",
        "progress": job["progress"]
    })
    return jsonify({"success": True, "message": "Stop signal sent"})

@app.route("/api/scrape/status/<job_id>", methods=["GET"])
def get_job_status(job_id):
    if job_id not in ACTIVE_JOBS:
        return jsonify({"error": "Job not found"}), 404

    job = ACTIVE_JOBS[job_id]
    return jsonify({
        "id": job["id"],
        "status": job["status"],
        "progress": job["progress"],
        "total_leads": len(job["leads"]),
        "logs": job["logs"][-30:]
    })

@app.route("/api/export/excel", methods=["POST"])
def export_excel():
    data = request.get_json() or {}
    leads = data.get("leads", [])
    filename = data.get("filename", f"Leads_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    if not filename.endswith(".xlsx"):
        filename += ".xlsx"

    excel_io = export_excel_bytes(leads, sheet_title="Leads Data")
    return send_file(
        excel_io,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@app.route("/api/export/csv", methods=["POST"])
def export_csv():
    data = request.get_json() or {}
    leads = data.get("leads", [])
    filename = data.get("filename", f"Leads_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    if not filename.endswith(".csv"):
        filename += ".csv"

    csv_io = export_csv_bytes(leads)
    return send_file(
        csv_io,
        as_attachment=True,
        download_name=filename,
        mimetype="text/csv"
    )

@app.route("/api/import", methods=["POST"])
def import_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    try:
        leads = parse_uploaded_file(file)
        return jsonify({
            "success": True,
            "filename": file.filename,
            "total": len(leads),
            "leads": leads
        })
    except Exception as e:
        return jsonify({"error": f"Failed to parse file: {str(e)}"}), 500

@app.route("/api/saved-sheets", methods=["GET"])
def list_saved_sheets():
    files = []
    if os.path.exists(EXPORTS_DIR):
        for f in os.listdir(EXPORTS_DIR):
            if f.endswith((".xlsx", ".csv")):
                fp = os.path.join(EXPORTS_DIR, f)
                stat = os.stat(fp)
                files.append({
                    "filename": f,
                    "size_kb": round(stat.st_size / 1024, 1),
                    "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")
                })
    files.sort(key=lambda x: x["modified"], reverse=True)
    return jsonify({"files": files})

@app.route("/api/saved-sheets/save", methods=["POST"])
def save_sheet():
    data = request.get_json() or {}
    leads = data.get("leads", [])
    filename = data.get("filename", "").strip() or f"Leads_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    filepath = save_excel_file(leads, filename)
    return jsonify({
        "success": True,
        "message": f"Saved sheet as {os.path.basename(filepath)}",
        "filepath": filepath
    })

@app.route("/api/saved-sheets/<filename>", methods=["GET"])
def load_saved_sheet(filename):
    filepath = os.path.join(EXPORTS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404

    with open(filepath, "rb") as f:
        class DummyStorage:
            def __init__(self, fname, stream):
                self.filename = fname
                self.stream = stream
        wrapper = DummyStorage(filename, f)
        leads = parse_uploaded_file(wrapper)

    return jsonify({"filename": filename, "leads": leads, "total": len(leads)})

if __name__ == "__main__":
    print("=" * 60)
    print("MapLead Studio v2.0 - Ultra Glassmorphism & 50km Radar")
    print("Server running at: http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)
