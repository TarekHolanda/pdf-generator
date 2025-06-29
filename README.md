# HC PDF Generator

A Node.js service for generating PDF invoices using Puppeteer.

## Features

- Generate PDF invoices from HTML templates
- Optimized for cloud deployment (Render)
- CORS enabled for web app integration
- Health check endpoint

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on `http://localhost:3001`

## API Endpoints

### POST /generate-invoice
Generates a PDF invoice from the provided data.

**Request Body:**
```json
{
    "invoiceNumber": "INV-001",
    "date": "2024-01-15",
    "dueDate": "2024-02-15",
    "client": {
        "name": "John Doe",
        "email": "john@example.com",
        "address": "123 Main St"
    },
    "items": [
        {
            "description": "Web Development",
            "quantity": 1,
            "rate": 100,
            "amount": 100
        }
    ],
    "subtotal": 100,
    "tax": 10,
    "total": 110
}
```

**Response:** PDF file with `Content-Type: application/pdf`

### GET /health
Health check endpoint.

**Response:**
```json
{
    "status": "ok",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "environment": "production",
    "render": true
}
```

## Deployment on Render

This service is configured for deployment on Render with the following setup:

1. **Build Command:** `npm install`
2. **Start Command:** `npm start`
3. **Environment Variables:**
   - `NODE_ENV=production`
   - `RENDER=true`

### Build Process

The build process automatically:
1. Installs Node.js dependencies
2. Installs Chrome for Puppeteer (via postinstall script)
3. Sets up the environment for cloud deployment

### Troubleshooting

If you encounter Chrome-related errors on Render:

1. Check the build logs to ensure Chrome was installed successfully
2. Check the health endpoint: `https://your-app.onrender.com/health`
3. Review the application logs for detailed error messages
4. The service will automatically retry with minimal options if the initial launch fails

### Common Issues

**Error: Could not find Chrome**
- Solution: The postinstall script should install Chrome automatically. Check build logs.

**Error: Browser was not found at the configured executablePath**
- Solution: The service now lets Puppeteer find Chrome automatically without specifying a path.

**Error: Timeout**
- Solution: The service includes proper timeouts and error handling with fallback options.

## Environment Variables

- `PORT`: Server port (default: 3001)
- `DOMAIN`: Allowed CORS origin (default: http://localhost:3000)
- `NODE_ENV`: Environment (development/production)
- `RENDER`: Set to true on Render deployment

## Dependencies

- Express.js - Web framework
- Puppeteer - PDF generation
- CORS - Cross-origin resource sharing
- Body-parser - Request body parsing 