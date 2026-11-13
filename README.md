# CNED DIGITAL

CNED DIGITAL is a frontend-only institutional demonstration of a project governance and infrastructure investment monitoring platform. The UI preserves the supplied Sneat Bootstrap 5 layout, styles, assets, and responsive navigation.

The role-based demo portfolio, KPI, alert, document, message, and field-report data is illustrative. Direction and PMO reference views separately show an attributed historical CNED sample. The application does not connect to an institutional backend, database, Ministry of Finance, Treasury, external messaging, or GPS. OpenStreetMap tiles are fetched for the map; demo authentication is local browser state and is not production security.

## Run locally

From the repository root:

```bash
npm install --legacy-peer-deps
npm start
```

The legacy template has peer-dependency constraints that require npm’s compatibility flag. Open [http://localhost:8080](http://localhost:8080). Python 3 is required for the static server. Leaflet is installed from the package manifest; the interactive basemap uses OpenStreetMap tiles and therefore needs an internet connection. If tiles cannot load, the local project and wilaya data remain available.

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

The historical CNED dashboard sample is in `data/cned-reference.js` and is dated 30 June 2025. It contains 11 detailed projects; the national portfolio totals are reported separately for 51 projects and must not be interpreted as totals calculated from the 11-project sample. Missing source values are shown as unavailable rather than inferred. PMO field updates are browser-local demonstration data and are not submitted to an institutional system.

The 69 bilingual wilaya records in `data/wilayas.js` use indicative points derived from the [Algeria-Cities dataset](https://github.com/ihahachi/Algeria-Cities) (MIT). They are not administrative boundaries, and regional groupings are for map filtering only. Map tiles are provided by OpenStreetMap and are not bundled with the application.

The login image is Chris Hunkeler’s [Maqam Echahid photograph](https://commons.wikimedia.org/wiki/File:Martyrs%27_Memorial_seen_from_Le_Jardin_d%27Essai_(34985839343).jpg), used under CC BY-SA 2.0; attribution is also displayed on the login screen.

The original Sneat archive and workbook remain in `references/`. Sneat assets and pages are retained in the repository; the root `index.html` is the CNED DIGITAL application entry point.

## Prototype interactions

- Role-specific dashboards, sidebars, project scopes, KPI and alert access.
- KPI filters and threshold details; alert lifecycle, assignee, dates, comments, and confidence.
- Project detail tabs, portfolio filtering, financial monitoring, planning, and offline-style field reports.
- Leaflet Algeria map with project and indicative wilaya layers, contextual discussions, document metadata previews, notifications, and CSV exports.
- French default language and Arabic/RTL layout toggle.

Browser-side state is stored in local/session storage. Logout returns to the institutional login screen.
