import { z } from 'zod';

export const dashboardFiltersSchema = z.object({
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  brand: z.string().optional(),
  country: z.string().optional(),
});

export const orderFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  order_status: z.string().optional(),
  risk_flag: z.coerce.boolean().optional(),
  order_no: z.string().optional(),
  brand: z.string().optional(),
  country: z.string().optional(),
  sla_status: z.string().optional(),
  severity: z.string().optional(),
  stage: z.string().optional(),
  pending_status: z.enum(['pending', 'normal']).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  confirmation_status: z.string().optional(),
  fulfilment_status: z.string().optional(),
  kpi_mode: z.coerce.boolean().optional().default(false),
});

export const tatConfigSchema = z.object({
  brand_name: z.string().min(1),
  country_code: z.string().min(2).max(3),
  processed_tat: z.string().min(1),
  shipped_tat: z.string().min(1),
  delivered_tat: z.string().min(1),
  risk_pct: z.number().min(1).max(100).default(80),
  urgent_pct: z.number().min(50).max(200).default(100),
  critical_pct: z.number().min(50).max(300).default(150),
});

export type DashboardFiltersInput = z.infer<typeof dashboardFiltersSchema>;
export type OrderFiltersInput = z.infer<typeof orderFiltersSchema>;
export type TatConfigInput = z.infer<typeof tatConfigSchema>; 