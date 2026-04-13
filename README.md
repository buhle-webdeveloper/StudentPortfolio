# StudentPortfolio 

A career guidance platform for South African high school learners. Student Portfolio helps students explore career paths, understand subject requirements, compare salaries, and plan their studies — all in a clean, accessible interface built with vanilla web technologies.

## Features

- **Career Explorer** — Browse and search a curated catalogue of South African career paths, with detailed modals showing subjects, salaries, institutions, and job outlook.
- **User Dashboard** — Personalised dashboard with saved careers, study goals, a weekly study checklist, and progress tracking.
- **Admin Panel** — Admin-only interface for viewing all registered users, career analytics, most-saved careers, and grade distribution charts.
- **World Bank API Integration** — Live South African secondary school enrollment statistics pulled from the World Bank REST API, with graceful offline fallback.
- **Search and Filtering** — Real-time search across career titles, descriptions, skills, and subjects, plus category filter chips.
- **Study Guides** — Practical study tips for maths, languages, essay writing, time management, and more.
- **Authentication** — Client-side registration and login with SHA-256 password hashing (Web Crypto API) and role-based access control (student / admin).

## Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Semantic page structure and accessibility (ARIA) |
| CSS3 | Design tokens, responsive layouts, modals, animations |
| Vanilla JavaScript (ES6+) | All interactivity — no frameworks or build tools |
| World Bank REST API | Live South African education statistics |
| localStorage | Persistent user accounts, sessions, goals, and saved careers |
| Web Crypto API | SHA-256 password hashing before storage |

## Project Structure

```
StudentPortfolio/
├── index.html              # Landing page
├── auth.html               # Login / Register page
├── dashboard.html          # Student dashboard
├── explore.html            # Career explorer + study guides
├── admin.html              # Admin panel
├── REPORT.md               # Project report
├── README.md               # This file
│
├── assets/
│   ├── css/
│   │   ├── tokens.css      # Design tokens (colours, spacing, typography)
│   │   ├── landing.css     # Landing page styles
│   │   ├── auth.css        # Auth page styles
│   │   ├── shell.css       # Dashboard / admin shell layout
│   │   └── explore.css     # Explore page styles
│   ├── images/             # Category images and logo
│   └── js/
│       ├── auth.js         # Authentication module (login, register, sessions)
│       ├── api.js          # Data layer (careers JSON + World Bank API)
│       ├── landing.js      # Landing page interactions
│       ├── dashboard.js    # Student dashboard logic
│       ├── explore.js      # Career grid, search, modals, study guides
│       ├── admin.js        # Admin panel logic
│       └── shell.js        # Shared sidebar/topbar behaviour
│
└── data/
    ├── careers.json        # Career catalogue (JSON)
    └── careers-data.js     # Inline career data (file:// fallback)
```

## Setup / Installation

No build step is required. The project is a static site.

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd StudentPortfolio
   ```

2. **Open in a browser**

   *Option A — Live Server (recommended):*
   Open the project folder in VS Code and launch with the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension. This avoids CORS issues when loading `careers.json` via `fetch`.

   *Option B — Direct file open:*
   Open `index.html` directly in your browser. The app includes an inline data fallback (`data/careers-data.js`) so it works on the `file://` protocol without a server.

3. **Default admin account**
   Register a new account and set the role to `admin` during registration to access the admin panel at `admin.html`.

## API Documentation

### World Bank REST API

The platform fetches live South African education statistics from the World Bank Open Data API.

**Endpoint used:**

```
GET https://api.worldbank.org/v2/country/ZA/indicator/SE.SEC.ENRR?format=json&mrv=5
```

| Parameter | Value | Meaning |
|---|---|---|
| `country` | `ZA` | South Africa (ISO 3166-1 alpha-2) |
| `indicator` | `SE.SEC.ENRR` | Secondary school gross enrollment rate (%) |
| `format` | `json` | Response format |
| `mrv` | `5` | Most recent 5 data points |

**Response shape:**

```json
[
  { "page": 1, "pages": 1, "total": 5 },
  [
    { "date": "2023", "value": 93.12, ... },
    { "date": "2022", "value": 92.45, ... }
  ]
]
```

The app extracts `json[1]`, filters out null values, rounds percentages, and displays year-over-year trends on the landing page and dashboard. If the API is unreachable, static fallback data is used.


## Team Members

| *Buhle Jongile* |
| *Simphiwe Mathebula* | 
| ** | 
| ** | 
| ** | 
| ** |
| ** | 
| ** |

## License

This project is for educational purposes. All rights reserved unless otherwise stated.
