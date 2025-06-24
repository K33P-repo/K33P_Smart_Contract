# K33P Identity System Frontend

This is a minimal React frontend for the K33P Identity System, providing interfaces for signup, signin, and refund functionality.

## Features

- User registration with phone number and wallet address
- User authentication
- UTXO management and refund functionality
- Responsive design
- JWT-based authentication
- Error boundary for graceful error handling
- Loading indicators for better user experience
- Mock API for development without backend
- 404 page for non-existent routes

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- K33P backend server running (locally or deployed)

## Installation

1. Clone the repository (if not already done)
2. Navigate to the frontend directory:
   ```
   cd frontend
   ```
3. Install dependencies:
   ```
   npm install
   ```
   or
   ```
   yarn install
   ```

## Configuration

The application is configured to connect to the backend API based on the environment:

- Development: `http://localhost:3001/api`
- Production: `https://k33p-backend.onrender.com/api`

You can modify these URLs in `src/services/api.js` if needed.

## Running the Application

### Development Mode

```bash
# Using npm
npm start

# Or using the provided script (Windows)
./start.bat
```

This will start the development server at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
# Using npm
npm run build

# Or using the provided script (Windows)
./build.bat
```

This will create an optimized production build in the `build` folder that can be deployed to hosting services like Render or Vercel.

## Deployment

### Deploying to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the service:
   - Build Command: `cd frontend && npm install && npm run build`
   - Start Command: `cd frontend && npx serve -s build`
   - Auto-Deploy: Enable

### Deploying to Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Navigate to the frontend directory
3. Run: `vercel`
4. Follow the prompts to deploy

Alternatively, you can connect your GitHub repository to Vercel for automatic deployments.

## Project Structure

```
frontend/
├── public/              # Static files
│   ├── index.html      # HTML template
│   ├── logo.svg        # Application logo
│   ├── manifest.json   # PWA manifest
│   └── robots.txt      # Robots file
├── src/                # Source code
│   ├── components/     # Reusable components
│   │   ├── Alert.js    # Alert component
│   │   ├── ErrorBoundary.js # Error handling
│   │   ├── Footer.js   # Footer component
│   │   ├── Navbar.js   # Navigation bar
│   │   ├── PrivateRoute.js # Route protection
│   │   └── Spinner.js  # Loading spinner
│   ├── context/        # React context
│   │   └── AuthContext.js # Authentication context
│   ├── pages/          # Page components
│   │   ├── Home.js     # Home page
│   │   ├── NotFound.js # 404 page
│   │   ├── Refund.js   # Refund page
│   │   ├── Signin.js   # Sign-in page
│   │   └── Signup.js   # Sign-up page
│   ├── services/       # API services
│   │   ├── api.js      # API client
│   │   └── mockApi.js  # Mock API for development
│   ├── App.css         # App styles
│   ├── App.js          # Main app component
│   ├── index.css       # Global styles
│   ├── index.js        # Entry point
│   └── reportWebVitals.js # Performance reporting
├── .env                # Environment variables
├── .gitignore          # Git ignore file
├── build.bat           # Build script for Windows
├── package.json        # Dependencies and scripts
├── README.md           # Project documentation
└── start.bat           # Start script for Windows
```

## License

This project is part of the K33P Identity System and is subject to its licensing terms.