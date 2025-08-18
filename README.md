# QuickBooks Analyzer - AI-Powered Financial Analysis for CPAs

A comprehensive web application that integrates QuickBooks Online data with AI-powered analysis using Perplexity Pro LLM to generate professional financial reports with PDF export capabilities.

## 🚀 Features

### Core Functionality
- **Clerk Authentication**: Secure Google Sign-In integration with Supabase backend
- **QuickBooks Online Integration**: Import financial data via secure API webhooks
- **AI-Powered Analysis**: Perplexity Pro LLM integration for intelligent financial insights
- **PDF Report Generation**: Professional report exports via webhook API
- **Real-time Dashboard**: Comprehensive financial metrics and visualizations

### Technical Features
- **Modern React Architecture**: Built with TypeScript, Vite, and Tailwind CSS
- **Professional UI Components**: Comprehensive design system with Radix UI primitives
- **Responsive Design**: Optimized for desktop and mobile workflows
- **Secure Data Flow**: All sensitive operations handled via secure webhooks
- **Type-Safe Development**: Full TypeScript implementation with proper type definitions

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling with custom design system
- **Radix UI** for accessible, unstyled components
- **Class Variance Authority** for component variants

### Backend Integration
- **Clerk** for authentication and user management
- **Supabase** for database and real-time features
- **Webhook Architecture** for secure third-party integrations:
  - QuickBooks Online API data import
  - Perplexity Pro LLM analysis
  - PDF generation service

### Data Flow
1. **Authentication**: User signs in via Clerk with Google OAuth
2. **QuickBooks Integration**: Secure OAuth connection to import financial data
3. **Data Processing**: Imported data stored in Supabase with proper normalization
4. **AI Analysis**: Financial data sent to Perplexity Pro via webhook for analysis
5. **Report Generation**: AI insights formatted and converted to PDF via webhook
6. **Dashboard Updates**: Real-time updates reflected in the dashboard UI

## 🎨 Design System

### Color Palette
- **Primary**: Blue (#3b82f6) - Professional, trustworthy
- **Success**: Green (#22c55e) - Positive metrics, profits
- **Warning**: Yellow (#eab308) - Caution, attention needed  
- **Error**: Red (#ef4444) - Negative metrics, losses
- **Neutral**: Gray scale for text and backgrounds

### Typography
- **Font Family**: Inter for optimal readability
- **Font Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- **Responsive Sizing**: Fluid typography across all device sizes

### Component System
- **Buttons**: Multiple variants with proper focus states
- **Cards**: Clean layouts with subtle shadows
- **Forms**: Accessible inputs with validation states
- **Progress Indicators**: Real-time status updates
- **Charts**: Custom financial data visualizations

## 📋 Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Clerk account with Google OAuth configured
- Supabase project with authentication enabled
- Backend API endpoints for webhook integrations

### Environment Configuration
1. Copy `.env.example` to `.env`
2. Configure Clerk authentication keys
3. Set up Supabase URL and anon key
4. Configure webhook endpoint URLs for your backend API

### Database Schema (Supabase)
Required tables for full functionality:
- `companies` - Company information and settings
- `financial_reports` - Generated reports and analysis
- `quickbooks_connections` - QB OAuth tokens and metadata

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

## 🔐 Security Considerations

### Authentication
- Clerk handles all authentication flows securely
- JWT tokens for API authentication
- Proper session management and refresh tokens

### Data Protection
- All financial data encrypted in transit and at rest
- Webhook endpoints use proper authentication headers
- QuickBooks OAuth tokens securely stored in Supabase
- No sensitive data stored in frontend localStorage

### API Security
- Rate limiting on webhook endpoints
- Input validation and sanitization
- Proper error handling without data exposure
- CORS configuration for production deployment

## 🎯 Usage Workflow

### Initial Setup
1. **Sign In**: User authenticates via Google OAuth through Clerk
2. **Connect QuickBooks**: OAuth flow to connect QB Online account
3. **Import Data**: Webhook imports financial data from QuickBooks API

### Report Generation
1. **Select Report Type**: Choose from financial health, cash flow, or profitability
2. **AI Processing**: Data sent to Perplexity Pro LLM via webhook
3. **Review Results**: AI-generated insights displayed in dashboard
4. **Export PDF**: Convert report to PDF via webhook for download

### Dashboard Features
- Real-time financial metrics and KPIs
- Interactive charts and visualizations  
- Historical data comparison and trends
- Quick access to recent reports and analyses

## 🚀 Deployment

The application is designed for deployment to:
- **Frontend**: Vercel, Netlify, or similar static hosting
- **Backend**: Your existing API infrastructure with webhook endpoints
- **Database**: Supabase (managed PostgreSQL)
- **Authentication**: Clerk (managed auth service)

## 🤝 Integration Points

### Required Webhook Endpoints
- `POST /webhooks/quickbooks` - Import financial data
- `POST /webhooks/perplexity` - Send data for AI analysis  
- `POST /webhooks/pdf-generate` - Convert reports to PDF

### Expected Data Formats
- QuickBooks: Standard QBO API response format
- Perplexity: JSON with analysis results and recommendations
- PDF: Markdown-compliant content for professional formatting

This platform provides a complete solution for CPAs needing professional financial analysis tools with modern UX and secure integrations.