from playwright.sync_api import sync_playwright
import time
import subprocess
import os

def run(playwright):
    # Start server on 8000
    server = subprocess.Popen(["python3", "-m", "http.server", "8000"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)

    try:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

        # New entry point
        page.goto("http://localhost:8000/index.html")

        print("Started Verification")

        # Click Start
        page.wait_for_selector("#start-overlay")
        page.click("#start-overlay")
        print("Clicked Start")

        time.sleep(2)

        # Check video
        video_time = page.evaluate("document.getElementById('intro-video').currentTime")
        print(f"Video Time: {video_time}")

        # Wait for textbox
        page.wait_for_selector("#textbox", state="visible", timeout=10000)
        print("Textbox Visible")

        content = page.text_content("#dialogue-text")
        print(f"Text: {content}")

        if "gasp" in content:
            print("SUCCESS: Text matches")
        else:
            print("FAILURE: Text mismatch")

        page.screenshot(path="verification_final.png")

    finally:
        server.kill()
        try:
            browser.close()
        except:
            pass

with sync_playwright() as playwright:
    run(playwright)
