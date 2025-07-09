# 📊 SLA Tracker Application

A Next.js-based dashboard for monitoring Service Level Agreement (SLA) performance across brands and countries. This application provides real-time insights into order processing stages, identifies breaches and at-risk orders, and offers comprehensive reporting capabilities.

## 🚀 Features

- **Real-time Dashboard**: Monitor SLA performance with KPI cards, interactive charts, and stage breakdown tables
- **Order Management**: View, filter, and export order backlogs with advanced search capabilities
- **Multi-brand Support**: Track performance across Victoria's Secret and Bath & Body Works
- **Geographic Insights**: Monitor performance by country (Malaysia, Singapore)
- **SLA Monitoring**: Identify breached, at-risk, and on-time orders with color-coded indicators
- **Export Functionality**: Download order data as CSV for further analysis
- **Responsive Design**: Clean, modern UI built with Tailwind CSS and shadcn/ui

## 🏗 Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Chart.js for visualizations
- **Backend**: Node.js, Express API routes
- **Database**: MySQL 8.x (master + analytics DBs)
- **Validation**: Zod for input validation
- **Date Handling**: date-fns for date manipulation

### Database Structure
- **Master DB** (`ecom_orders_live`): Read-only source database
- **Analytics DB** (`sla_tracker`): ETL target with optimized schema
  - `tat_config`: SLA configuration per brand/country
  - `orders_<brand>_<country>`: Order data tables
  - `sla_daily_summary`: Pre-aggregated performance metrics

## 🛠 Setup & Installation

### Prerequisites
- Node.js 18+ 
- MySQL 8.x
- Redis (for future BullMQ implementation)

### Installation Steps

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository-url>
   cd sla-tracker
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp env.example .env.local
   ```
   
   Update `.env.local` with your database credentials:
   ```env
   # Master Database (Read-only)
   MASTER_DB_HOST=localhost
   MASTER_DB_PORT=3306
   MASTER_DB_USER=readonly_user
   MASTER_DB_PASSWORD=your_password
   MASTER_DB_NAME=ecom_orders_live

   # Analytics Database
   ANALYTICS_DB_HOST=localhost
   ANALYTICS_DB_PORT=3306
   ANALYTICS_DB_USER=analytics_user
   ANALYTICS_DB_PASSWORD=your_password
   ANALYTICS_DB_NAME=sla_tracker

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=

   # Application Configuration
   NODE_ENV=development
   PORT=3000
   API_VERSION=v1
   ```

3. **Database Setup**
   ```bash
   # Create and populate the analytics database
   mysql -u your_user -p < migrations/001_create_schema.sql
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## 📖 Usage

### Dashboard (/)
- **Filter Options**: Select date ranges, brands, and countries
- **Quick Filters**: Today, Last 7 Days, This Month, Last Month
- **KPI Cards**: View total orders, SLA breached, on-risk, and completed orders
- **Performance Chart**: Stacked bar chart showing SLA performance by stage
- **Stage Breakdown**: Detailed table with performance metrics and average delays

### Orders (/orders)
- **Search & Filter**: Find orders by number, status, brand, country, or SLA risk
- **Pagination**: Navigate through large datasets efficiently
- **Export**: Download filtered results as CSV
- **SLA Status**: Color-coded badges for easy identification

## 🔧 API Endpoints

### Dashboard API
```
GET /api/v1/dashboard/summary
Query Parameters:
- from_date: YYYY-MM-DD
- to_date: YYYY-MM-DD
- brand: Brand name (optional)
- country: Country code (optional)
```

### Orders API
```
GET /api/v1/orders
Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 20, max: 100)
- order_status: Filter by order status
- risk_flag: Filter by SLA risk (true/false)
- order_no: Search by order number
- brand: Filter by brand
- country: Filter by country
```

## 📊 SLA Configuration

SLA thresholds are configured in the `tat_config` table:

| Brand | Country | Processing (min) | Shipping (days) | Delivery (days) | Risk % |
|-------|---------|------------------|-----------------|-----------------|--------|
| Victoria's Secret | MY | 120 | 2 | 7 | 80% |
| Victoria's Secret | SG | 90 | 1 | 5 | 80% |
| Bath & Body Works | MY | 150 | 3 | 10 | 75% |
| Bath & Body Works | SG | 100 | 2 | 7 | 75% |

## 🎨 UI/UX Features

- **Clean Design**: Modern, minimal interface focusing on data clarity
- **Color Coding**: 
  - 🟢 Green: On-time performance
  - 🟡 Yellow: At-risk orders
  - 🔴 Red: SLA breached
- **Responsive Layout**: Optimized for desktop, tablet, and mobile
- **Performance Badges**: Visual indicators for SLA performance levels
- **Loading States**: Smooth loading animations and skeleton screens

## 🔄 ETL Process (Future Implementation)

The application includes ETL utilities for future BullMQ integration:

- **Incremental Sync**: Only process new/updated records
- **Brand-Country Tables**: Dynamic table creation per business unit
- **Daily Aggregation**: Pre-calculate summary metrics for performance
- **Error Handling**: Comprehensive logging and retry mechanisms

## 🚦 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

### Code Structure
```
src/
├── app/                 # Next.js app router pages
│   ├── api/v1/         # API endpoints
│   ├── orders/         # Orders page
│   └── page.tsx        # Dashboard page
├── components/         # React components
│   ├── dashboard/      # Dashboard-specific components
│   └── ui/            # Reusable UI components
└── lib/               # Utilities and configurations
    ├── db.ts          # Database connections
    ├── types.ts       # TypeScript interfaces
    ├── validation.ts  # Zod schemas
    └── etl.ts         # ETL utilities
```

## 🔮 Phase 2 Roadmap

- JWT Authentication & RBAC
- Real-time alerts (Slack/Email)
- Advanced analytics and reporting
- BullMQ job queue implementation
- Docker containerization
- CI/CD pipeline
- Monitoring & observability

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions, please use the GitHub issue tracker or contact the development team.
