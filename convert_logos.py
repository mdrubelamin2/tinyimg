# /// script
# requires-python = ">=3.11"
# dependencies =[
#     "playwright",
#     "pillow",
#     "httpx[http2]",
#     "scour"
# ]
# ///

import asyncio
import io
import subprocess
from pathlib import Path

import httpx
from PIL import Image
from playwright.async_api import async_playwright

URLS =[
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_space_nation_b7b1d20c3d/logo_space_nation_b7b1d20c3d.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_Titulum_63459d1ec7/logo_Titulum_63459d1ec7.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_vstat_85122a61eb/logo_vstat_85122a61eb.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_wonder_people_e9f9daaf8a/logo_wonder_people_e9f9daaf8a.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/Million_Victories_Logo_4a2ee7a1b1/Million_Victories_Logo_4a2ee7a1b1.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/Giiku_Logo_f0f1be1896/Giiku_Logo_f0f1be1896.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_101_XP_3795e76506/logo_101_XP_3795e76506.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_artstorm_ab3eeccd75/logo_artstorm_ab3eeccd75.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_bot_ion_5eaf313ba9/logo_bot_ion_5eaf313ba9.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_hong_kong_bc78729fed/logo_hong_kong_bc78729fed.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_gudongmiao_d750002eb4/logo_gudongmiao_d750002eb4.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_hongkong_yuan_398ccff563/logo_hongkong_yuan_398ccff563.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_imperia_27b27d2a59/logo_imperia_27b27d2a59.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_jtg_3a8783d1af/logo_jtg_3a8783d1af.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_mighty_cat_11645dc58c/logo_mighty_cat_11645dc58c.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_Million_Victories_c4a823f147/logo_Million_Victories_c4a823f147.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_mitrofanov_a7e84dffe6/logo_mitrofanov_a7e84dffe6.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_noble_legacy_81c5b7584f/logo_noble_legacy_81c5b7584f.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_osk_41f1a4aa80/logo_osk_41f1a4aa80.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_Panoramik_4806ce5cf3/logo_Panoramik_4806ce5cf3.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_serverdev_416e621a73/logo_serverdev_416e621a73.svg",
    "https://storage.googleapis.com/strapi-v2-bucket-prod/logo_snakehead_2cc3909b8d/logo_snakehead_2cc3909b8d.svg"
]

def setup_browser_engine():
    """Downloads the headless Chromium binary for Playwright if missing (One-time setup)."""
    print("🔧 Ensuring Chromium rendering engine is installed...")
    subprocess.run(["uv", "run", "playwright", "install", "chromium"], check=True)

async def process_url(client: httpx.AsyncClient, context, url: str, output_dir: Path) -> None:
    filename = url.split('/')[-1] # Keep the .svg extension!
    output_path = output_dir / filename

    try:
        # 1. Fetch the raw SVG markup
        response = await client.get(url)
        response.raise_for_status()
        raw_svg_text = response.text
        raw_svg_size = len(raw_svg_text.encode('utf-8'))
        
        # 2. Stage 1 Optimization (SVGO Equivalent in Python)
        # We run the SVG through Scour to aggressively minify internal vector math,
        # remove designer metadata, and compress the true SVG string.
        def optimize_svg_math(svg_string: str) -> str:
            import scour.scour as scour
            options = scour.sanitizeOptions()
            options.remove_metadata = True
            options.strip_comments = True
            options.enable_viewboxing = False
            options.shorten_ids = True
            options.strip_ids = True
            try:
                # Scour expects string/bytes in specific formats based on its CLI origins
                return scour.scourString(svg_string, options)
            except Exception:
                # Fallback if scour fails on a malformed SVG
                return svg_string
                
        optimized_svg_text = await asyncio.to_thread(optimize_svg_math, raw_svg_text)
        optimized_svg_size = len(optimized_svg_text.encode('utf-8'))
        
        # 3. Inject the *raw* vector into a transparent HTML document for rendering
        # We MUST use the raw SVG here to ensure Playwright captures the exact,
        # original hardcoded width/height bounds, as Scour sometimes strips them
        # in favor of a responsive viewBox.
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ margin: 0; background: transparent !important; }}
                svg {{ display: block; }}
            </style>
        </head>
        <body>
            {raw_svg_text}
        </body>
        </html>
        """
        
        # 3. Render in Headless Chrome
        page = await context.new_page()
        await page.set_content(html_content, wait_until="networkidle")
        
        # 4. Take a transparent screenshot of the precise SVG bounding box
        svg_locator = page.locator("svg").first
        
        # We need the original dimensions to trick the frontend
        box = await svg_locator.bounding_box()
        orig_width = box['width']
        orig_height = box['height']
        
        png_bytes = await svg_locator.screenshot(omit_background=True, type="png")
        await page.close()
        
        # 5. The "Tech Lead" Intelligence Check: Compare Sizes
        def save_optimal_asset():
            import base64
            
            with Image.open(io.BytesIO(png_bytes)) as img:
                webp_buffer = io.BytesIO()
                img.save(webp_buffer, format="WEBP", quality=100)
                b64_string = base64.b64encode(webp_buffer.getvalue()).decode('utf-8')
                
                # Build the Wrapper SVG using WebP mime-type
                svg_wrapper = f'''<svg width="{orig_width}" height="{orig_height}" viewBox="0 0 {orig_width} {orig_height}" xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/webp;base64,{b64_string}" width="{orig_width}" height="{orig_height}" />
</svg>'''
                
                wrapper_size = len(svg_wrapper.encode('utf-8'))
                
                with open(output_path, "w", encoding="utf-8") as f:
                    # ARCHITECTURE DECISION (2026): The 15% Vector Bias Handicap
                    # A pure SVG provides infinite zoom, crisp sub-pixel typography, and CSS styling.
                    # A rasterized AVIF wrapper destroys those capabilities.
                    # Therefore, a pure SVG is theoretically "worth" more bytes than an AVIF.
                    # 
                    # Why specifically 15% (0.85 multiplier)?
                    # - 5% is too strict: We would sacrifice infinite zoom to save a trivial 1-2 KB, 
                    #   which takes milliseconds to load and offers zero real-world Core Web Vitals benefit.
                    # - 30% is too loose: We would allow a bloated 100 KB SVG to stay, even if an AVIF
                    #   could crush it down to 71 KB. That wastes 29 KB of network bandwidth per logo.
                    # - 15% is the mathematical sweet spot. It permits slight mathematical bloat in 
                    #   exchange for infinite scalability, but aggressively rasterizes true UX blockers.
                    if wrapper_size < (optimized_svg_size * 0.85):
                        # Win! The WebP successfully proved it removes >15% of the file bloat.
                        f.write(svg_wrapper)
                        print(f"✅ WIN: WebP Wrapper | File: {filename}")
                    else:
                        # Loss. The SVG is lightweight enough that the 15% WebP savings 
                        # isn't worth destroying the infinite vector math over.
                        f.write(optimized_svg_text)
                        print(f"👑 WIN: Scour Vector | File: {filename}")
                        
                    print(f"   ├─ 1. Original SVG:   {raw_svg_size/1024:>6.1f} KB")
                    print(f"   ├─ 2. Scour Minified: {optimized_svg_size/1024:>6.1f} KB")
                    print(f"   └─ 3. 2.0x WebP Wrap: {wrapper_size/1024:>6.1f} KB\n")
        
        await asyncio.to_thread(save_optimal_asset)
        
    except Exception as e:
        print(f"❌ Error with {filename}: {e}")

async def main() -> None:
    setup_browser_engine()
    
    output_dir = Path("perfect_webp_logos")
    output_dir.mkdir(exist_ok=True)
    
    print(f"\n🚀 Rendering {len(URLS)} complex SVGs using Chromium Engine...")
    
    async with async_playwright() as p:
        # Launch Chrome and render at exactly 3.0x scale.
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(device_scale_factor=2.0)
        
        async with httpx.AsyncClient(http2=True) as client:
            tasks =[process_url(client, context, url, output_dir) for url in URLS]
            await asyncio.gather(*tasks)
            
        await browser.close()
        
    print(f"\n🎉 Done! All perfectly accurate images are in: {output_dir.absolute()}")

if __name__ == "__main__":
    asyncio.run(main())
