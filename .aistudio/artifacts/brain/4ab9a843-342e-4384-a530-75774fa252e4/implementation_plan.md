# Pbazar Partner Dashboard: Enhancement Plan

Pbazar is evolving its partner ecosystem to include robust product management tools (SEO, image processing), secure order tracking, and scam prevention systems. This plan outlines the technical strategy for these enhancements.

## User Review & Critical Decisions

> [!IMPORTANT]
> The immediate focus is on Product SEO and the Image-to-URL converter tool. Subsequent phases will address order management, admin dashboard enhancements, and security hardening.

- **Confirmed Priority**: Product SEO & Image Converter Tools.
- **Order Records Format**: Excel/CSV and PDF formats are confirmed.
- **Decision Required**: Confirmation on the structure of the Scam Catcher reporting system.

---

## 1. Overview & Core Concept

- **What It Does**: Enhances seller capabilities to list products with SEO optimization, automated image-to-URL conversion, and provides admins with comprehensive tools to monitor, manage, and secure the marketplace.
- **Target Audience**: Sellers (for product management) and Admins (for oversight, moderation, and business intelligence).
- **Key Value**: Improved discoverability via SEO, streamlined listing workflows via automated image handling, and marketplace trust via anti-scam monitoring.

## 2. User Experience & Visual Design

- **Visual Identity**: Clean, utilitarian interface matching the existing Pbazar dashboard. Emphasis on clarity in tables and forms.
- **Key Flow**: 
    - **SEO**: Product listing form will include fields for Meta Title, Meta Description, and Slug.
    - **Image Converter**: Drag-and-drop zone that handles image upload, conversion to public URL, and automatic insertion into the product form.
    - **Order Records**: New "Records" view with options to download reports as PDF/Excel.

## 3. Key Product Decisions & Trade-Offs

- **Image Converter**: Chosen approach is client-side image processing followed by Firebase Storage upload and URL retrieval, ensuring fast user feedback without overloading the server.
- **Scam Catcher**: Adopting a heuristic-based detection system initially, which will log suspicious seller activity (e.g., high cancellation rates, unusual price deviations) for admin review.
- **SEO Implementation**: Using server-side rendering/dynamic meta tags for product pages to ensure maximum search engine visibility.

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram
```
┌─────────────┐     ┌──────────────────────┐     ┌──────────────┐
│  Client UI  │ <─> │ Firebase/Auth/Proxy  │ <─> │  Firestore   │
└─────────────┘     └──────────────────────┘     └──────────────┘
       │                      │
       └─> [Image Converter] ─┘
```

- **Data Model**: Expanding `products` collection with `seo` object, and adding `orderRecords` collection.
- **State**: Centralized store for product management, filtering, and admin dashboard views.
- **Key Sequences**: 
    - **Image to URL**: Image Select -> Upload to Storage -> Get Download URL -> Set in Form State.
    - **Order Export**: Query orders -> Generate data object -> PDF/Excel library formatting -> Download.
