# BearingPoint — Performance Lever Platform

Application web professionnelle de gestion de leviers de performance pour les missions de transformation industrielle BearingPoint.

## Stack Technique

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + Framer Motion
- **Charts**: Recharts
- **Backend/BDD**: Firebase Firestore
- **Import Excel**: SheetJS (xlsx)
- **State**: Zustand
- **Routing**: React Router v6
- **Tables**: TanStack Table v8
- **Forms**: React Hook Form

## Installation

```bash
npm install
```

## Configuration Firebase

1. Copiez `.env.example` en `.env.local`
2. Renseignez vos paramètres Firebase

```bash
cp .env.example .env.local
```

## Lancement

```bash
npm run dev
```

## Build Production

```bash
npm run build
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard Exécutif — KPIs, Waterfall, Phasing |
| `/baseline` | Baseline des Coûts (éditable, import Excel) |
| `/levers` | Performance Levers — table complète, création, import |
| `/savings-by-type` | Restitution par Nature de Coût |
| `/phasing` | Phasing des Savings |
| `/organization` | Organisation & FTE Savings |
| `/capex-opex` | CAPEX & OPEX Phasing |
| `/out-of-scope` | Leviers hors périmètre / No Go |
| `/admin` | Administration (projets, usines, config) |

## Structure Firestore

- `projects/{id}` — Projets
- `plants/{id}` — Usines par projet
- `baselines/{id}` — Baselines de coûts par usine
- `levers/{id}` — Leviers de performance

---
*Version 1.0 — BearingPoint — Usage interne mission transformation industrielle*
