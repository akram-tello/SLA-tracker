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