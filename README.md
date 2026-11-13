# CNED DIGITAL

CNED DIGITAL is a frontend-only institutional demonstration of a project governance and infrastructure investment monitoring platform. The UI preserves the supplied Sneat Bootstrap 5 layout, styles, assets, and responsive navigation.

All portfolio, KPI, alert, document, message, and field-report data is illustrative. The application does not connect to a backend, database, Ministry of Finance, Treasury, external messaging, GPS, or map service. Demo authentication is local browser state and is not production security.

## Run locally

From the repository root:

```bash
npm start
```

Open [http://localhost:8080](http://localhost:8080). Python 3 is required; no dependency installation is needed to run the prototype.

## Demo accounts

The login page includes a development-only account list. All accounts use the demo password `CNED2026!`.

| Username | Workspace |
| --- | --- |
| `direction` | Direction CNED |
| `pmo` | CNED / PMO |
| `mo` | Maître d’ouvrage |
| `bet` | Bureau d’études / contrôle |
| `entreprise` | Contractant |
| `finance` | Contrôle budgétaire |

## Reference and role scope

`data/reference.json` is structured from `references/TAQADDUM_43_KPI_Referentiel_1.xlsx`. It contains the 43 KPI definitions, 17 alert rules, R/S/V and D/I permission matrices, six role profiles, and seven interface mappings. KPI visibility and alert visibility/action controls are filtered by the workbook matrix and the active account’s project scope.

The original Sneat archive and workbook remain in `references/`. Sneat assets and pages are retained in the repository; the root `index.html` is the CNED DIGITAL application entry point.

## Prototype interactions

- Role-specific dashboards, sidebars, project scopes, KPI and alert access.
- KPI filters and threshold details; alert lifecycle, assignee, dates, comments, and confidence.
- Project detail tabs, portfolio filtering, financial monitoring, planning, and offline-style field reports.
- Local Algeria map, contextual discussions, document metadata previews, notifications, and CSV exports.
- French default language and Arabic/RTL layout toggle.

Browser-side state is stored in local/session storage. Logout returns to the institutional login screen.
