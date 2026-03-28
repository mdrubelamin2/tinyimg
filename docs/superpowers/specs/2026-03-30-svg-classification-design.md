# Design Spec: Adaptive SVG Classification & Optimization

**Date**: 2026-03-30
**Owner**: Tech Lead (Antigravity)
**Status**: Approved

## 1. Objective
To implement an intelligent, battle-tested classification system for SVGs in `tinyimg2`. The system will automatically detect the complexity of an incoming SVG and decide whether to serve it as a **Minified Vector** or a **Rasterized SVG Wrapper** to ensure optimal browser performance and file size.

## 2. Background
Large or complex SVGs (e.g., architectural diagrams, traced photos) cause significant browser "jank" (CPU/GPU lag) because they require thousands of real-time drawing operations per frame. By rasterizing these "Complex" SVGs into a high-fidelity **AVIF** and wrapping them back in an SVG container, we provide a perfect visual experience with zero performance cost.

## 3. Classification Architecture

### **3.1 The "1,500 / 5,000" Rule**
The classification will be based on three metrics derived from industry standards (Google Squoosh/Vercel):

1.  **Node Count (`N`)**: Total number of XML elements.
    *   *Threshold*: `> 1,500` nodes = **COMPLEX**.
2.  **Path Segment Count (`S`)**: Total number of drawing commands (`L`, `M`, `C`, `Z`) across all paths.
    *   *Threshold*: `> 5,000` segments = **COMPLEX**.
3.  **Raster Trigger Presence**: 
    *   Contains `<image>` tag = **HYBRID**.
    *   Contains `> 5` `<filter>`, `<mask>`, or `<clipPath>` tags = **COMPLEX**.

### **3.2 Output Decision Matrix**

| Classification | Action | Output Format |
| :--- | :--- | :--- |
| **SIMPLE** | Minify | Optimized Vector SVG (via SVGO) |
| **COMPLEX** | Wrap | AVIF-Rasterized SVG Wrapper |
| **HYBRID** | Wrap/Optimize | AVIF-Optimized Rasterized SVG Wrapper |

---

## 4. Technical Implementation

### **4.1 Fast-Regex Classifier**
Instead of a slow DOM parser, we will use a lightweight regex-based scanner in the Web Worker. This ensures the classification happens in `< 5ms`.

### **4.2 Rasterized SVG Wrapper Structure**
For **Complex/Hybrid** SVGs, the output will follow this structure:
```svg
<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/avif;base64,{optimized_raster_base64}" width="{width}" height="{height}" />
</svg>
```
*   **Raster Encoder**: AVIF (preferred for 2026 for quality-at-low-bitrate).
*   **Resolution**: Rendered at the SVG's natural dimensions (or scaled by DPR if requested).

---

## 5. Performance Targets
*   **Classification Speed**: `< 5ms` for a 1MB SVG.
*   **Render Budget**: Ensure "Complex" SVGs never exceed a `16ms` first-paint time in the browser.
*   **Privacy**: 100% client-side execution.

## 6. Success Criteria
1.  Simple icons remain as vectors (SVGO optimized).
2.  Complex maps or traced vectors are automatically rasterized into an AVIF wrapper.
3.  No browser "jank" occurs when loading a "Complex" SVG optimized by this system.
