# CELUPRO - Cell Phone Repair Management System

## Overview
CELUPRO is a complete web application for managing cell phone repair workshops. It allows managing technical entries, tracking failures, assigning repairs, generating thermal tickets, and more.

**Current State**: Fully functional and running in Replit environment
**Last Updated**: November 15, 2025

## Architecture

### Technology Stack
- **Backend**: Flask (Python) REST API with JWT authentication
- **Frontend**: HTML5, Bootstrap 5, Vanilla JavaScript
- **Database**: SQLite (local, portable)
- **Printing**: ESC/POS thermal printer support

### Port Configuration (Replit-Specific)
- **Frontend Server**: Port 5000 (0.0.0.0) - Web interface
- **Backend API**: Port 8000 (127.0.0.1) - REST API endpoints
- **Database**: SQLite file at `database/celupro.db`

### Project Structure
```
.
├── backend/              # Flask API server
│   ├── app.py           # Main backend application (Port 8000)
│   ├── models/          # Data models (User, Marca, Falla, Ingreso, etc.)
│   ├── utils/           # Utilities (thermal_printer.py)
│   └── requirements.txt
├── frontend/            # Web interface
│   ├── server.py        # Frontend Flask server (Port 5000)
│   ├── templates/       # HTML templates (login.html, dashboard.html)
│   └── static/          # CSS, JS, and assets
├── database/            # Database files
│   ├── init_db.py       # Database initialization script
│   ├── SCHEMA.sql       # Database schema
│   └── celupro.db       # SQLite database (created on first run)
└── main.py             # Unified startup script for Replit
```

## Running the Application

### Start Command
The application starts automatically via the configured workflow:
```bash
python main.py
```

This starts both:
1. Backend API server (port 8000)
2. Frontend web server (port 5000)

### Default Credentials
- **Username**: admin
- **Password**: admin123

### Accessing the Application
Access the web interface through Replit's webview on port 5000.

## Key Features

### Authentication & Roles
- JWT-based secure authentication
- 3 roles: Admin, Employee, Technician
- Role-based permissions and access control

### Technical Entry Management
- Complete intake forms with client and device data
- Track device condition (display, touch, buttons, etc.)
- Multiple initial failures per entry
- Auto-generated entry numbers

### Technician Panel
- View pending entries
- Add/modify failures
- Update repair values
- Change failure status
- Change entry status

### Administration
- **Users**: CRUD operations, role assignment
- **Brands & Models**: Dynamic management
- **Failures**: Configurable catalog with pricing
- **Configuration**: Business name, phone, email, logo

### Thermal Printing
- Generate ESC/POS tickets (58mm)
- Custom PNG logo support
- Client and device data
- Diagnosed failures and total value

### Database
Tables: users, brands, models, entries, failures, notes, configuration
- Pre-populated with default data (brands, models, common failures)
- Admin user created on initialization

## API Endpoints

### Authentication
- POST `/api/auth/login` - User login
- GET `/api/auth/me` - Get current user

### Brands & Models
- GET `/api/marcas` - Get all brands
- GET `/api/marcas/<id>/modelos` - Get models for a brand
- POST/PUT/DELETE `/api/marcas` - Manage brands (admin)
- POST/PUT/DELETE `/api/modelos` - Manage models (admin)

### Failures
- GET `/api/fallas` - Get all failures from catalog
- POST/PUT/DELETE `/api/fallas` - Manage failures

### Technical Entries
- POST `/api/ingresos` - Create new entry
- GET `/api/ingresos` - List entries with filters
- GET `/api/ingresos/<id>` - Get specific entry
- PUT `/api/ingresos/<id>/estado` - Update entry status
- DELETE `/api/ingresos/<id>` - Delete entry (admin)

### Administration
- GET/POST/PUT/DELETE `/api/admin/usuarios` - User management
- GET/PUT `/api/admin/configuracion` - Business configuration

## Environment Configuration

### Replit-Specific Changes Made
1. **Port Configuration**: Frontend moved to port 5000, backend to port 8000
2. **Host Binding**: Frontend uses 0.0.0.0, backend uses 127.0.0.1
3. **API Proxy**: Frontend server proxies all /api/* requests to backend at 127.0.0.1:8000
4. **API Endpoint**: Frontend JS uses relative paths (/api) instead of absolute URLs
5. **Unified Startup**: Created main.py to launch both servers
6. **Workflow**: Configured to run main.py with webview on port 5000
7. **Password Security**: Database initialization now uses hashed passwords

### Dependencies Installed
All Python dependencies installed via uv:
- Flask, Flask-CORS, Flask-JWT-Extended
- Pillow (image processing)
- python-escpos (thermal printing)
- qrcode (QR code generation)
- requests, python-dotenv, Werkzeug

## Security Features
- Passwords hashed with Werkzeug
- JWT tokens for sessions
- Role validation on backend
- CORS configured
- Input sanitization in database queries

## Database Initialization
Database is automatically initialized on first run with:
- Default admin user (admin/admin123)
- Popular phone brands (Apple, Samsung, Xiaomi, etc.)
- Common models for major brands
- Pre-configured failure catalog with suggested prices
- Business configuration defaults

## Known Limitations
- Thermal printing requires local printer setup (ESC/POS compatible)
- Logo upload saves to frontend/static/logos (ensure directory exists)
- SQLite database is not suitable for high-concurrency production use
- No built-in backup mechanism (manual backup of celupro.db required)

## Troubleshooting

### Database Issues
If database gets corrupted:
```bash
cd database
rm celupro.db
python init_db.py
```

### Port Conflicts
If ports are in use, check and kill processes:
```bash
lsof -i :5000
lsof -i :8000
```

## Future Enhancements
- PDF reports generation
- Statistics dashboards
- SMS/Email notifications
- Automatic backups
- Multi-branch synchronization
- Native mobile app
- Online payment integration

## User Preferences
(None specified yet)

## Recent Changes
- **2025-11-15 (v2)**: Complete UI/UX overhaul for admin panel
  - **Replaced prompt()-based forms with inline collapsible forms**
  - Forms now appear within the same interface (no pop-ups)
  - Added proper validation and error feedback
  - Improved user experience with clear save/cancel buttons
  - Forms automatically hide after successful submission
  - Fixed JWT token authentication in all API calls
  - All CRUD operations (Users, Brands, Failures) now working correctly
  
- **2025-11-15 (v1)**: Fixed login and API connectivity issues
  - Added API proxy in frontend server to route requests to backend
  - Fixed password hashing in database initialization
  - Removed demo credentials display from login page
  - Updated JavaScript to use relative API paths instead of absolute URLs
  - All API calls now go through frontend server proxy at port 5000
  
- **2025-11-15**: Initial Replit setup completed
  - Configured ports for Replit environment
  - Created unified startup script
  - Initialized database with default data
  - Set up workflow for automatic startup
