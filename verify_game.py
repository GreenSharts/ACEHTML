from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8080/AceAttorney_Part1.html")

    # Wait for overlay
    page.wait_for_selector("#start-overlay")

    # Click to start
    page.click("#start-overlay")

    # Wait for intro card content
    # "August 3, 9:47 AM"
    page.wait_for_selector("#intro-text")

    # Wait a bit for typing to happen
    # 3 lines of intro text.
    page.wait_for_timeout(5000)

    # Take screenshot of Intro
    page.screenshot(path="verification_intro.png")

    # Click to advance (it might be waiting for input after typing)
    page.click("body")

    # Now BG fade in
    page.wait_for_timeout(1000)

    # Now Dialogue?
    # Phoenix: (Boy am I nervous!)
    # Wait for text
    page.wait_for_selector("#textbox")
    page.wait_for_timeout(2000)

    page.screenshot(path="verification_game.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
