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
- Redis (optional, for future queue implementation)

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

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Setup ETL Cron Jobs (Optional but Recommended)**
   ```bash
   npm run etl:setup
   ```

## Production Deployment

### Environment Configuration

For production deployment, update your `.env.local` file:

```bash
# Production Database Configuration
MASTER_DB_HOST=your-master-db-host
MASTER_DB_PORT=3306
MASTER_DB_USER=readonly_user
MASTER_DB_PASSWORD=your-secure-password
MASTER_DB_NAME=ecom_orders_live

ANALYTICS_DB_HOST=your-analytics-db-host
ANALYTICS_DB_PORT=3306
ANALYTICS_DB_USER=analytics_user
ANALYTICS_DB_PASSWORD=your-secure-password
ANALYTICS_DB_NAME=sla_tracker

# Application Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# ETL Configuration - IMPORTANT for production
ETL_API_URL=https://yourdomain.com
```

### Deployment Steps

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Setup ETL cron jobs**
   ```bash
   npm run etl:setup
   ```

3. **Start the production server**
   ```bash
   npm start
   ```

4. **Verify deployment**
   ```bash
   # Check system health
   npm run etl:health
   
   # Monitor ETL status
   npm run etl:monitor
   ```

### Production Considerations

- ✅ **Set ETL_API_URL** to your production domain
- ✅ **Use secure database passwords**
- ✅ **Configure proper firewall rules**
- ✅ **Set up SSL certificates**
- ✅ **Configure log rotation**
- ✅ **Monitor system resources**

## ETL Automation Setup

### Automatic Hourly Sync

The system includes automated ETL sync jobs that run every hour to keep your data fresh:

#### Setup Cron Jobs
```bash
# Interactive setup (recommended)
npm run etl:setup

# Or manually add to crontab
echo "0 * * * * $(pwd)/scripts/etl-cron.sh" | crontab -
```

#### Monitor ETL Status
```bash
# Check overall status
npm run etl:monitor

# View recent logs
npm run etl:monitor -- -l 3

# Check API status
npm run etl:monitor -- -a

# View sync statistics
npm run etl:monitor -- -s
```

#### Manual ETL Operations
```bash
# Run manual sync
npm run etl:sync

# Check ETL status
npm run etl:status

# Check system health
npm run etl:health
```

### Cron Job Details

- **Schedule**: Every hour at minute 0 (e.g., 1:00, 2:00, 3:00...)
- **Script**: `scripts/etl-cron.sh`
- **Logs**: `logs/etl-sync-YYYYMMDD.log`
- **Errors**: `logs/etl-sync-errors-YYYYMMDD.log`
- **Timeout**: 5 minutes per sync

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ETL_API_URL` | API base URL for ETL operations | `http://localhost:3000` | Production: Yes |
| `MASTER_DB_HOST` | Master database host | `localhost` | Yes |
| `ANALYTICS_DB_HOST` | Analytics database host | `localhost` | Yes |
| `NODE_ENV` | Environment mode | `development` | No |

## API Endpoints

### ETL Management
- `POST /api/v1/etl/sync` - Run ETL sync
- `GET /api/v1/etl/status` - Check ETL status
- `GET /api/v1/etl/validate` - Validate data integrity
- `POST /api/v1/etl/cleanup` - Clean up orphaned data

### Dashboard
- `GET /api/v1/dashboard/summary` - Get dashboard data
- `GET /api/v1/dashboard/health` - Check system health
- `GET /api/v1/dashboard/filters` - Get filter options

### Orders
- `GET /api/v1/orders` - Get orders with filtering
- `GET /api/v1/orders/[orderNo]` - Get specific order details

## Database Configuration

### Master Database (Read-Only)
- **Purpose**: Source of order data
- **Access**: Read-only user
- **Tables**: `*_[country]_orders` pattern

### Analytics Database (Read/Write)
- **Purpose**: Processed data and summaries
- **Access**: Full read/write
- **Tables**: 
  - `orders_[brand]_[country]` - Processed order data
  - `sla_daily_summary` - Dashboard summaries
  - `tat_config` - SLA configuration

## TAT Configuration

SLA thresholds are configured in the `tat_config` table:

```sql
INSERT INTO tat_config (
  brand_name, country_code, 
  processed_tat, shipped_tat, delivered_tat, 
  risk_pct, pending_not_processed_time, 
  pending_processed_time, pending_shipped_time
) VALUES (
  'Victoria''s Secret', 'MY',
  '10m', '2d', '5d',
  80, '6h', '24h', '3d'
);
```

**Updates are immediate** - no restart required!

## Monitoring & Maintenance

### Log Files
- **Sync Logs**: `logs/etl-sync-YYYYMMDD.log`
- **Error Logs**: `logs/etl-sync-errors-YYYYMMDD.log`
- **Application Logs**: Check your server logs

### Health Checks
```bash
# Check system health
curl http://localhost:3000/api/v1/dashboard/health

# Monitor ETL status
npm run etl:monitor
```

### Performance Optimization
- **Batch Size**: 1000 records per batch
- **Rate Limiting**: 100ms delay between batches
- **Incremental Updates**: Only changed data is processed
- **Indexed Operations**: Optimized database queries

## Troubleshooting

### Common Issues

1. **ETL Sync Fails**
   ```bash
   # Check API status
   npm run etl:status
   
   # Check logs
   npm run etl:monitor -- -e 1
   ```

2. **Database Connection Issues**
   ```bash
   # Verify environment variables
   cat .env.local
   
   # Test database connectivity
   mysql -u $ANALYTICS_DB_USER -p$ANALYTICS_DB_PASSWORD -h $ANALYTICS_DB_HOST
   ```

3. **Cron Job Not Running**
   ```bash
   # Check cron status
   crontab -l
   
   # Test cron script manually
   ./scripts/etl-cron.sh
   ```

4. **Production API Issues**
   ```bash
   # Verify ETL_API_URL is set correctly
   echo $ETL_API_URL
   
   # Test API endpoint
   curl $ETL_API_URL/api/v1/etl/status
   ```

### Performance Issues

- **Large Datasets**: Consider reducing batch size in `scripts/etl-cron.sh`
- **High Memory Usage**: Monitor with `npm run etl:monitor -- -s`
- **Slow Syncs**: Check database performance and network latency

## Development

### Adding New Brands/Countries

1. **Add TAT Configuration**
   ```sql
   INSERT INTO tat_config (...) VALUES (...);
   ```

2. **ETL will auto-discover** new source tables matching `*_[country]_orders`

3. **Dashboard will automatically** include new data

### Customizing ETL Logic

- **Batch Size**: Modify `batchSize` in `src/lib/etl.ts`
- **Sync Frequency**: Update cron schedule in `scripts/setup-cron.sh`
- **Data Transformations**: Edit `buildSelectFieldsWithJoins()` in `src/lib/etl.ts`

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs with `npm run etl:monitor`
3. Check system health with `npm run etl:health`
4. Create an issue in the repository