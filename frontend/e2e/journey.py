from playwright.sync_api import sync_playwright
import json
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={"width":1440,"height":900})
    pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:5173/"); pg.wait_for_selector("h1")
    pg.screenshot(path="/tmp/shots/01-overview-1440.png", full_page=True)
    pg.get_by_role("link",name="Start a Cost Analysis").first.click()
    pg.get_by_role("button",name="Try an example").click()
    pg.screenshot(path="/tmp/shots/02-step1.png")
    for i in range(3):
        pg.get_by_role("button",name="Continue").click(); pg.wait_for_timeout(300)
        pg.screenshot(path=f"/tmp/shots/0{3+i}-step{2+i}.png", full_page=True)
    pg.get_by_role("button",name="Compare Cloud Options").click()
    pg.wait_for_timeout(500); pg.screenshot(path="/tmp/shots/06-loading.png")
    pg.wait_for_selector("text=Why we recommend this", timeout=15000)
    pg.wait_for_timeout(500)
    pg.screenshot(path="/tmp/shots/07-results-1440.png", full_page=True)
    print("hero:", pg.locator("#decision").inner_text().replace("\n"," | ")[:300])
    print("egress insight present:", pg.locator("#egress").count())
    # horizontal overflow check at widths
    for w,h in [(1440,900),(1024,768),(768,1024),(390,844)]:
        pg.set_viewport_size({"width":w,"height":h}); pg.wait_for_timeout(250)
        ov=pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        print(w,"page horizontal overflow px:",ov)
        pg.screenshot(path=f"/tmp/shots/08-results-{w}.png")
    # export csv
    pg.set_viewport_size({"width":1440,"height":900})
    with pg.expect_download() as d: pg.get_by_role("button",name="Export CSV").click()
    print("csv:", d.value.suggested_filename)
    with pg.expect_download(timeout=20000) as d: pg.get_by_role("button",name="Export PDF").click()
    d.value.save_as("/tmp/shots/out.pdf"); print("pdf:", d.value.suggested_filename)
    # save + my analyses
    pg.get_by_role("button",name="Save analysis").click(); pg.get_by_role("button",name="Save",exact=True).click()
    pg.get_by_role("navigation",name="Sections").get_by_role("link",name="My Analyses").click()
    pg.wait_for_selector("table"); pg.screenshot(path="/tmp/shots/09-myanalyses.png")
    pg.get_by_role("navigation",name="Sections").get_by_role("link",name="Pricing Data").click()
    pg.wait_for_selector("table"); pg.screenshot(path="/tmp/shots/10-pricing.png")
    print("pricing rows shown:", pg.locator("table tbody tr").count())
    for w in (1024,768,390):
        pg.set_viewport_size({"width":w,"height":900}); pg.goto("http://localhost:5173/"); pg.wait_for_selector("h1"); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(800)
        print(w,"overview overflow:", pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth"))
        pg.screenshot(path=f"/tmp/shots/11-overview-{w}.png")
        pg.goto("http://localhost:5173/analysis/new"); pg.get_by_role("button",name="Try an example").click()
        print(w,"wizard overflow:", pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth"))
    print("console errors:", errs)
    b.close()
