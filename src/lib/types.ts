export interface Order {
  order_no: string;
  order_status: string;
  shipping_status: string;
  confirmation_status: string;
  processing_time?: Date;
  shipped_time?: Date;
  delivered_time?: Date;
  processed_tat?: string; // formatted time string (e.g., "2h 30m")
  shipped_tat?: string; // formatted time string (e.g., "2d 5h")
  delivered_tat?: string; // formatted time string (e.g., "7d 12h")
  order_date: Date;
  brand_name: string;
  country_code: string;
  updated_at: Date;
}

export interface TatConfig {
  brand_name: string;
  country_code: string;
  processed_tat: string; // formatted time string (e.g., "2h 30m")
  shipped_tat: string; // formatted time string (e.g., "2d 5h")
  delivered_tat: string; // formatted time string (e.g., "7d 12h")
  risk_pct: number; // percentage
  created_at: Date;
  updated_at: Date;
}

export interface SLADailySummary {
  summary_date: Date;
  brand_name: string;
  country_code: string;
  stage: 'Not Processed' | 'Processed' | 'Shipped' | 'Delivered';
  orders_total: number;
  orders_on_time: number;
  orders_on_risk: number;
  orders_breached: number;
  avg_delay_sec: number;
  refreshed_at: Date;
}

// ========== UPDATED: New API Structure Types ==========

export interface KPISummary {
  total_orders: number;
  on_time_orders: number;
  on_risk_orders: number;
  breached_orders: number;
  // NEW: Action Required + SLA Status + Stage combinations
  action_required_breached_processed: number;
  action_required_breached_shipped: number;
  action_required_breached_delivered: number;
  action_required_at_risk_processed: number;
  action_required_at_risk_shipped: number;
  action_required_at_risk_delivered: number;
  action_required_on_time_processed: number;
  action_required_on_time_shipped: number;
  action_required_on_time_delivered: number;
  fulfilled_orders: number;
  // Existing pending metrics
  pending_orders: number;
  at_risk_pending_orders: number;
  breached_pending_orders: number;
  completion_rate: number;
  pending_rate: number;
  avg_delay_seconds: number;
  avg_pending_hours: number;
  last_refresh?: string | null;
}

export interface StageKPI {
  stage: string;
  total_orders: number;
  on_time_orders: number;
  on_risk_orders: number;
  breached_orders: number;
  completion_rate: number;
  avg_delay_seconds: number;
}

export interface ChartData {
  date: string;
  total_orders: number;
  on_time_orders: number;
  on_risk_orders: number;
  breached_orders: number;
  completion_rate: number;
  pending_rate?: number; // Optional for backward compatibility
}

export interface StageBreakdown {
  stage: string;
  total: number;
  on_time: number;
  on_risk: number;
  breached: number;
  pending: number;
  at_risk_pending: number;
  breached_pending: number;
  completion_rate: number;
  pending_rate: number;
  avg_pending_hours: number;
}

export interface DashboardSummary {
  kpis: KPISummary;
  stage_breakdown: StageBreakdown[];
  chart_data: ChartData[];
  stage_kpis: StageKPI[];
}

// ========== LEGACY: Keep these for backward compatibility ==========

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
  sla_status?: string;
  stage?: string;
  from_date?: string;
  to_date?: string;
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