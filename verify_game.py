from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    # Navigate using file protocol to verify the static client game
    current_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = f"file://{os.path.join(current_dir, 'index.html')}"

    page.goto(index_path)
    page.wait_for_timeout(1000)

    # 1. Start the game by clicking ENGAGE SYSTEM
    page.click("#launchButton")
    page.wait_for_timeout(1000)

    # 2. Select beam weapon
    page.click("button[data-attack='beam']")
    page.wait_for_timeout(1000)

    # 3. Fire beam weapon multiple times
    for _ in range(3):
        page.click("#fireButton")
        page.wait_for_timeout(600)

    # 4. Select meteor weapon and fire
    page.click("button[data-attack='meteor']")
    page.wait_for_timeout(1000)
    page.click("#fireButton")
    page.wait_for_timeout(1500)

    # Take screenshot of active arena
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
