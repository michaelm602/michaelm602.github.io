# Likwit Blvd Website

A custom portfolio and e-commerce site for airbrush and digital artwork.  
Built to showcase original work, sell prints, and manage content securely through an admin interface.

Live site: https://www.likwitblvd.com

---

## Overview

Likwit Blvd is a modern React-based website combining a public art portfolio with a functional online shop.  
It supports secure admin-only uploads, dynamic galleries, and multiple payment options, while remaining lightweight and SEO-friendly.

The project is designed for real-world deployment, not demos — with production hosting, search indexing, and scalable backend services.

---

## Features

### Public
- Art gallery (airbrush + digital work)
- Shop with size-based pricing
- Cart drawer with persistent state
- Stripe Checkout integration
- PayPal Checkout integration
- SEO-ready (Open Graph tags, sitemap, robots.txt)

### Admin
- Firebase Auth–protected admin access
- Upload and manage images via Firebase Storage
- Firestore-backed metadata
- Restricted access (admin-only uploads)

---

## Tech Stack

### Frontend
- **React**
- **Vite**
- **Tailwind CSS**

### Backend / Services
- **Firebase**
  - Authentication
  - Firestore
  - Storage
- **Stripe** (payments)
- **PayPal** (payments)

### Hosting & Deployment
- **DigitalOcean App Platform**
- **GitHub** (manual deploy workflow)

---

## Local Development

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Setup
```bash
npm install
npm run dev
