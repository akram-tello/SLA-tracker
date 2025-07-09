export interface Order {
  order_no: string;
  order_status: string;
  shipping_status: string;
  confirmation_status: string;
  processing_time?: Date;
  shipped_time?: Date;
  delivered_time?: Date;
  processed_tat?: number; // minutes
  shipped_tat?: number; // days
  delivered_tat?: number; // days
  order_date: Date;
  brand_name: string;
  country_code: string;
  updated_at: Date;
}

export interface TatConfig {
  brand_name: string;
  country_code: string;
  processed_tat: number; // minutes
  shipped_tat: number; // days
  delivered_tat: number; // days
  risk_pct: number; // percentage
  created_at: Date;
  updated_at: Date;
}

export interface SLADailySummary {
  summary_date: Date;
  brand_name: string;
  country_code: string;
  stage: 'Processed' | 'Shipped' | 'Delivered';
  orders_total: number;
  orders_on_time: number;
  orders_on_risk: number;
  orders_breached: number;
  avg_delay_sec: number;
  refreshed_at: Date;
}

export interface DashboardSummary {
  total_orders: number;
  sla_breached: number;
  on_risk: number;
  completed: number;
  chart_data: ChartData[];
  stage_breakdown: StageBreakdown[];
}

export interface ChartData {
  stage: string;
  on_time: number;
  on_risk: number;
  breached: number;
}

export interface StageBreakdown {
  stage: string;
  on_time: number;
  breached: number;
  on_risk: number;
  avg_delay: string;
}

export interface DashboardFilters {
  from_date: string;
  to_date: string;
  brand?: string;
  country?: string;
}

export interface OrderFilters {
  page: number;
  limit: number;
  order_status?: string;
  risk_flag?: boolean;
  order_no?: string;
  brand?: string;
  country?: string;
}

// ETL Configuration and Discovery Types
export interface TableDiscovery {
  source_table: string;
  target_table: string;
  brand_code: string;
  country_code: string;
  brand_name: string;
  exists_in_target: boolean;
  last_sync?: Date;
  master_record_count?: number;
  sla_record_count?: number;
}

export interface ColumnMapping {
  source_column: string;
  target_column: string;
  data_type: string;
  is_required: boolean;
  default_value?: string | number | Date;
  transformation?: string; // SQL expression for transformation
}

export interface ETLConfig {
  source_table: string;
  target_table: string;
  brand_code: string;
  country_code: string;
  brand_name: string;
  column_mappings: ColumnMapping[];
  batch_size: number;
  sync_strategy: 'full' | 'incremental';
  date_filter_column?: string;
  sync_window_days: number;
}

export interface ETLJobOptions {
  batch_size?: number;
  max_records?: number;
  sync_strategy?: 'full' | 'incremental';
  sync_window_days?: number;
}

export interface ETLPaginationResult {
  current_batch: number;
  total_batches: number;
  records_processed: number;
  has_more: boolean;
}

export interface BrandConfig {
  brand_code: string;
  brand_name: string;
  source_table_pattern: string;
  target_table_pattern: string;
}

export interface ETLJobResult {
  success: boolean;
  processed: number;
  errors: string[];
  duration: number;
} 