# SLA Tracker Dashboard

Monitor order processing performance across brands and countries with real-time SLA tracking and analytics.

## Features

- 📊 **Real-time Dashboard**: Monitor SLA performance across multiple brands and countries
- 🔄 **Automated ETL Sync**: Hourly data synchronization from master database
- 📈 **Performance Analytics**: Track on-time, at-risk, and breached orders
- 🎯 **SLA Monitoring**: Real-time status updates with configurable TAT thresholds
- 📱 **Responsive Design**: Modern UI built with Next.js and Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+ 
- MySQL 8.0+
- Redis (for queue implementation)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sla-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env.local
   # Edit .env.local with your database credentials
   ```

4. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

5. **Build the application**
   ```bash
   npm run build
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Setup ETL Cron Jobs**
   ```bash
   npm run etl:setup
   ```

7. **Verify deployment (optional)**
   ```bash
   # Check system health
   npm run etl:health
   
   # Monitor ETL status
   npm run etl:monitor
   ```
