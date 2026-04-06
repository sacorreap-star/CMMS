export interface Machine {
  id: number;
  name: string;
  type: string;
  status: 'operational' | 'maintenance' | 'down';
  last_maintenance: string | null;
  description: string;
  avg_daily_hours: number;
}

export interface Company {
  id: number;
  name: string;
}

export interface Personnel {
  id: number;
  name: string;
  company_id: number;
  company_name?: string;
}

export interface FunctionalNode {
  id: number;
  machine_id: number;
  parent_id: number | null;
  name: string;
  is_consumable: boolean;
  is_critical: boolean;
  life_expectancy_hours: number | null;
  current_hours: number;
  part_number: string | null;
  supplier: string | null;
}

export interface MaintenanceSchedule {
  id: number;
  machine_id: number;
  machine_name: string;
  part_id: number | null;
  part_name: string | null;
  task_name: string;
  frequency_days: number | null;
  frequency_hours: number | null;
  personnel_id: number | null;
  personnel_name?: string;
  company_name?: string;
  required_items: string | null;
  start_date: string | null;
  last_done: string | null;
  next_due: string;
  description: string;
}

export interface WorkOrder {
  id: number;
  machine_id: number;
  machine_name: string;
  part_id: number | null;
  part_name: string | null;
  description: string;
  type: 'preventive' | 'corrective' | 'consumable_change' | 'unplanned_failure';
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  started_at: string | null;
  closed_at: string | null;
  duration_minutes: number | null;
  technician: string | null;
  personnel_id: number | null;
  schedule_id: number | null;
  diagnostic_notes: string | null;
}

export interface InventoryItem {
  id: number;
  part_name: string;
  stock_level: number;
  min_stock: number;
  unit_price: number;
  entry_date: string;
}

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  inventory_id: number;
  part_name?: string;
  quantity: number;
  unit_price: number;
  description?: string;
}

export interface PurchaseOrder {
  id: number;
  supplier_id: number;
  supplier_name?: string;
  status: 'pending' | 'received' | 'cancelled';
  total_amount: number;
  created_at: string;
  received_at: string | null;
  scheduled_date: string | null;
  description?: string;
  items: PurchaseOrderItem[];
}

export interface TechnicalName {
  id: number;
  name: string;
  colloquial_name?: string;
  description?: string;
}

export interface ManufacturerRecommendation {
  id: number;
  machine_id: number;
  machine_name?: string;
  type: 'maintenance' | 'spare_part' | 'lubricant' | 'consumable';
  item_name: string;
  specification: string | null;
  frequency_hours: number | null;
  frequency_days: number | null;
  part_number: string | null;
  description: string | null;
}

export interface KPI {
  totalOrders: number;
  mttr: number;
  machineStatus: { status: string; count: number }[];
  compliance: number;
  pendingTasks: number;
  totalMachines: number;
  finance?: {
    totalCost: number;
    costByType: { type: string; total: number }[];
  };
  hr?: {
    personnelWorkload: { name: string; tasks: number; total_minutes: number }[];
  };
}
