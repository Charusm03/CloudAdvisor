"""Run axe-core on every screen in Chromium. Usage: python e2e/a11y.py (servers running on 5000/5173)."""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
AXE = pathlib.Path(__file__).resolve().parent.parent / "node_modules/axe-core/axe.min.js"
BASE = "http://localhost:5173"
def audit(pg, name):
    pg.add_script_tag(path=str(AXE))
    r = pg.evaluate("axe.run(document, {runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']})")
    v = r["violations"]; print(f"{name}: {len(v)} violation(s)")
    for x in v:
        print("  -", x["id"], x["impact"], "|", x["help"])
        for n in x["nodes"][:3]: print("      ", n["target"], "|", (n.get("any") or n.get("all") or [{}])[0].get("message","")[:120])
    return len(v)
total = 0
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.goto(BASE); pg.wait_for_selector("h1"); pg.wait_for_load_state("networkidle"); total += audit(pg, "overview")
    pg.goto(BASE + "/analysis/new"); pg.wait_for_selector("h2"); total += audit(pg, "wizard step 1")
    pg.get_by_role("button", name="Try an example").click()
    for i in (2, 3, 4):
        pg.get_by_role("button", name="Continue").click(); pg.wait_for_timeout(350); total += audit(pg, f"wizard step {i}")
    pg.get_by_role("button", name="Compare Cloud Options").click(); pg.wait_for_selector("text=Why we recommend this", timeout=15000); pg.wait_for_timeout(600)
    total += audit(pg, "results")
    pg.get_by_role("button", name="Show all assumptions").click(); pg.get_by_role("button", name="Save analysis").click(); total += audit(pg, "results (assumptions open, save open)")
    pg.get_by_role("button", name="Save", exact=True).click()
    for path, name in (("/analyses", "my analyses (with data)"), ("/pricing", "pricing data"), ("/methodology", "methodology")):
        pg.get_by_role("navigation", name="Sections").get_by_role("link", name={"/analyses":"My Analyses","/pricing":"Pricing Data","/methodology":"Methodology"}[path]).click()
        pg.wait_for_selector("h1"); pg.wait_for_timeout(500); total += audit(pg, name)
    pg.evaluate("localStorage.clear()"); pg.goto(BASE + "/analyses"); pg.wait_for_selector("h2"); total += audit(pg, "my analyses (empty)")
    m = b.new_page(viewport={"width": 390, "height": 844}); m.goto(BASE); m.wait_for_selector("h1"); m.wait_for_load_state("networkidle"); total += audit(m, "overview @390")
    b.close()
print("TOTAL violations:", total); sys.exit(1 if total else 0)
