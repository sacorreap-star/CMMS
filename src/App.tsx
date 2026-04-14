import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  ClipboardList, 
  Package, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Wrench,
  ChevronRight,
  Plus,
  Play,
  Square,
  Stethoscope,
  Calendar,
  Trash2,
  Save,
  Undo,
  Redo,
  Edit2,
  X,
  Book,
  Image
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { 
  format, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  formatDistanceToNow
} from 'date-fns';
import { es } from 'date-fns/locale';

import { cn } from './lib/utils';
import { Machine, FunctionalNode, WorkOrder, KPI, MaintenanceSchedule, Company, Personnel, InventoryItem, PurchaseOrder, TechnicalName, ManufacturerRecommendation } from './types';
import { Document, Page, pdfjs } from 'react-pdf';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const parseLocalDate = (dateStr: string | null | undefined): Date => {
  if (!dateStr) return new Date();
  // Handle both T and space separators
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
  const parts = datePart.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
};

const ZoomControls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col bg-white border border-[#141414] shadow-md">
      <button onClick={() => zoomIn()} className="p-2 hover:bg-gray-100 border-b border-[#141414] font-bold" title="Acercar">+</button>
      <button onClick={() => zoomOut()} className="p-2 hover:bg-gray-100 border-b border-[#141414] font-bold" title="Alejar">-</button>
      <button onClick={() => resetTransform()} className="p-2 hover:bg-gray-100 text-[10px] font-bold uppercase" title="Restablecer">Reset</button>
    </div>
  );
};

const formatCurrency = (amount: number | string | null | undefined) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(num) + ' COP';
};

const isTaskDueOn = (s: MaintenanceSchedule, day: Date) => {
  if (!s.next_due) return false;
  const nextDue = typeof s.next_due === 'string' ? s.next_due : '';
  
  const firstDue = parseLocalDate(nextDue);
  firstDue.setHours(0, 0, 0, 0);
  
  const targetDay = new Date(day);
  targetDay.setHours(0, 0, 0, 0);
  
  // If it's a one-time thing or we don't have frequency info, just check next_due
  if (!s.frequency_hours && !s.frequency_days) {
    return isSameDay(firstDue, targetDay);
  }

  // Calculate interval in days
  let intervalDays = 0;
  if (s.frequency_hours) {
    intervalDays = Math.floor(s.frequency_hours / 8);
  } else if (s.frequency_days) {
    intervalDays = s.frequency_days;
  }

  if (intervalDays <= 0) {
    if (s.frequency_hours || s.frequency_days) {
      return targetDay.getTime() >= firstDue.getTime();
    }
    return isSameDay(firstDue, targetDay);
  }

  // Check if 'targetDay' is an occurrence
  // occurrence = firstDue + (N * intervalDays)
  const diffTime = targetDay.getTime() - firstDue.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays % intervalDays === 0;
};

function MaintenanceCalendar({ 
  schedules, 
  purchaseOrders,
  workOrders,
  onTaskClick 
}: { 
  schedules: MaintenanceSchedule[], 
  purchaseOrders: PurchaseOrder[],
  workOrders: WorkOrder[],
  onTaskClick: (task: MaintenanceSchedule) => void 
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="bg-white border border-[#141414] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-serif italic">Calendario de Operaciones</h3>
        <div className="flex items-center space-x-4">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 border border-[#141414]">
            <Undo className="w-4 h-4" />
          </button>
          <span className="font-mono text-sm uppercase font-bold">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 border border-[#141414]">
            <Redo className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-[#141414] border border-[#141414]">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="bg-[#E4E3E0] p-2 text-center text-[10px] uppercase font-bold tracking-widest">
            {day}
          </div>
        ))}
        {calendarDays.map((day, idx) => {
          const daySchedules = schedules.filter(s => isTaskDueOn(s, day));
          const dayPOs = purchaseOrders.filter(po => {
            if (po.status !== 'pending' || !po.scheduled_date) return false;
            const poDate = parseLocalDate(po.scheduled_date);
            return isSameDay(poDate, day);
          });
          
          // Find work orders for this day that are linked to a schedule
          const dayDoneSchedules = workOrders.filter(wo => {
            if (!wo.schedule_id || !wo.created_at) return false;
            const woDate = parseLocalDate(wo.created_at);
            return isSameDay(woDate, day);
          });

          const isCurrentMonth = isSameMonth(day, monthStart);
          
          return (
            <div 
              key={idx} 
              className={cn(
                "bg-white min-h-[100px] p-2 transition-colors",
                !isCurrentMonth && "bg-gray-50 opacity-30",
                isSameDay(day, new Date()) && "ring-2 ring-inset ring-[#141414]"
              )}
            >
              <span className={cn(
                "text-xs font-mono",
                isSameDay(day, new Date()) && "bg-[#141414] text-white px-1"
              )}>
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-1">
                {daySchedules.map((s, sIdx) => {
                  // Check if this schedule already has a work order for this day
                  const isDone = dayDoneSchedules.some(wo => wo.schedule_id === s.id);
                  if (isDone) return null; // Don't show in "due" list if already done
                  
                  return (
                    <div 
                      key={`${s.id}-${sIdx}`} 
                      onClick={() => {
                        onTaskClick(s);
                      }}
                      className="text-[9px] p-1 bg-[#141414] text-[#E4E3E0] leading-tight truncate cursor-pointer hover:bg-gray-800 transition-colors"
                      title={`${s.machine_name}: ${s.task_name}`}
                    >
                      {s.machine_name}: {s.task_name}
                    </div>
                  );
                })}
                {dayDoneSchedules.map((wo, woIdx) => (
                  <div 
                    key={`done-${wo.id}-${woIdx}`}
                    className="text-[9px] p-1 bg-emerald-600 text-white leading-tight truncate flex items-center"
                    title={`REALIZADO: ${wo.description}`}
                  >
                    <CheckCircle2 className="w-2 h-2 mr-1" />
                    {wo.machine_name}: {wo.description.replace('Mantenimiento programado: ', '')}
                  </div>
                ))}
                {dayPOs.map(po => (
                  <div 
                    key={po.id} 
                    className="text-[9px] p-1 bg-blue-600 text-white leading-tight truncate"
                    title={`OC #${po.id} - ${po.supplier_name}`}
                  >
                    OC #{po.id}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [functionalTree, setFunctionalTree] = useState<FunctionalNode[]>([]);
  const [treeEditState, setTreeEditState] = useState<FunctionalNode[]>([]);
  const [treeHistory, setTreeHistory] = useState<FunctionalNode[][]>([]);
  const [treeRedoStack, setTreeRedoStack] = useState<FunctionalNode[][]>([]);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  
  // Personnel & Companies
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [technicalNames, setTechnicalNames] = useState<TechnicalName[]>([]);
  const [manufacturerRecommendations, setManufacturerRecommendations] = useState<ManufacturerRecommendation[]>([]);
  
  // Modal states
  const [showFailureAnalysisModal, setShowFailureAnalysisModal] = useState(false);
  const [showTreeVisualizer, setShowTreeVisualizer] = useState(false);
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showNewWOModal, setShowNewWOModal] = useState(false);
  const [showAddPersonnelModal, setShowAddPersonnelModal] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editedTask, setEditedTask] = useState<MaintenanceSchedule | null>(null);
  const [diagnosticRootCause, setDiagnosticRootCause] = useState('');

  const [showTechnicalNameModal, setShowTechnicalNameModal] = useState(false);
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [showAddRecommendationModal, setShowAddRecommendationModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceSchedule | null>(null);

  // Form states
  const [newPart, setNewPart] = useState({ name: '', is_consumable: false, is_critical: false, life_expectancy_hours: '', part_number: '', supplier: '', parent_id: '' });
  const [newSchedule, setNewSchedule] = useState({ 
    machine_id: '', 
    part_id: '', 
    task_name: '', 
    frequency_hours: '',
    personnel_id: '',
    required_items: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    activities: [] as { id: number, description: string, is_completed: boolean, personnel_id?: number | null }[]
  });
  const [newWO, setNewWO] = useState({ machine_id: '', part_id: '', type: 'preventive', description: '', personnel_id: '', activities: [] as { id: number, description: string, is_completed: boolean, personnel_id?: number | null }[] });
  const [newPersonnel, setNewPersonnel] = useState({ name: '', company_id: '' });
  const [newCompany, setNewCompany] = useState({ name: '' });
  const [newTechnicalName, setNewTechnicalName] = useState({ name: '', colloquial_name: '', description: '' });
  const [newRecommendation, setNewRecommendation] = useState({
    machine_id: '',
    type: 'maintenance' as any,
    item_name: '',
    specification: '',
    frequency_hours: '',
    frequency_days: '',
    part_number: '',
    description: '',
    document_url: ''
  });
  const [technicalNameTarget, setTechnicalNameTarget] = useState<{ type: string, field: string } | null>(null);
  const [technicalNameSearch, setTechnicalNameSearch] = useState('');
  const [newMachine, setNewMachine] = useState({ name: '', type: '', description: '' });
  
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  }>({ show: false, message: '', onConfirm: () => {} });

  const [alertDialog, setAlertDialog] = useState<{
    show: boolean;
    message: string;
  }>({ show: false, message: '' });

  const askConfirmation = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ show: true, message, onConfirm });
  };

  const showAlert = (message: string) => {
    setAlertDialog({ show: true, message });
  };

  // Diagnostic state


  useEffect(() => {
    fetchData();
  }, []);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showStartWOModal, setShowStartWOModal] = useState(false);
  const [showEditWOModal, setShowEditWOModal] = useState(false);
  const [editingWO, setEditingWO] = useState<any>(null);
  const [woToStart, setWOToStart] = useState<number | null>(null);
  const [startWOPersonnelId, setStartWOPersonnelId] = useState('');
  const [startWODiagnostic, setStartWODiagnostic] = useState('');
  const [startWOActivities, setStartWOActivities] = useState<any[]>([]);
  const [showAddPersonnelInWO, setShowAddPersonnelInWO] = useState(false);
  const [showAddPersonnelInNewWO, setShowAddPersonnelInNewWO] = useState(false);
  const [newPersonnelTarget, setNewPersonnelTarget] = useState<{type: 'main' | 'activity', index?: number} | null>(null);
  const [newPersonnelInWO, setNewPersonnelInWO] = useState({ name: '', company_id: '' });
  const [showAddCompanyInWO, setShowAddCompanyInWO] = useState(false);
  const [newCompanyInWO, setNewCompanyInWO] = useState({ name: '' });
  const [showPOModal, setShowPOModal] = useState(false);
  const [showAddSupplierInline, setShowAddSupplierInline] = useState(false);
  const [editingPOId, setEditingPOId] = useState<number | null>(null);
  const [editingInventoryId, setEditingInventoryId] = useState<number | null>(null);
  const [newInventoryItem, setNewInventoryItem] = useState({ part_name: '', stock_level: '', min_stock: '', unit_price: '', entry_date: format(new Date(), 'yyyy-MM-dd') });
  const [newPO, setNewPO] = useState({ 
    supplier_id: '', 
    scheduled_date: '', 
    description: '',
    items: [] as { inventory_id?: number, part_name?: string, quantity: number, unit_price: number, description?: string }[] 
  });

  const [addingItem, setAddingItem] = useState({
    inventory_id: '',
    part_name: '',
    quantity: 1,
    unit_price: 0,
    description: ''
  });

  const fetchData = async () => {
    try {
      console.log("Fetching all data...");
      const [mRes, woRes, kpiRes, sRes, pRes, cRes, iRes, poRes, tnRes, mrRes] = await Promise.all([
        fetch('/api/machines'),
        fetch('/api/work-orders'),
        fetch('/api/kpis'),
        fetch('/api/schedules'),
        fetch('/api/personnel'),
        fetch('/api/companies'),
        fetch('/api/inventory'),
        fetch('/api/purchase-orders'),
        fetch('/api/technical-names'),
        fetch('/api/manufacturer-recommendations')
      ]);
      
      const results = [
        { name: 'machines', res: mRes },
        { name: 'work-orders', res: woRes },
        { name: 'kpis', res: kpiRes },
        { name: 'schedules', res: sRes },
        { name: 'personnel', res: pRes },
        { name: 'companies', res: cRes },
        { name: 'inventory', res: iRes },
        { name: 'purchase-orders', res: poRes },
        { name: 'technical-names', res: tnRes },
        { name: 'manufacturer-recommendations', res: mrRes }
      ];

      const failed = results.filter(r => !r.res.ok);
      if (failed.length > 0) {
        throw new Error(`Fetch failed for: ${failed.map(f => f.name).join(', ')}`);
      }
      
      setMachines(await mRes.json());
      setWorkOrders(await woRes.json());
      setKpis(await kpiRes.json());
      setSchedules(await sRes.json());
      setPersonnel(await pRes.json());
      setCompanies(await cRes.json());
      setInventory(await iRes.json());
      setPurchaseOrders(await poRes.json());
      setTechnicalNames(await tnRes.json());
      setManufacturerRecommendations(await mrRes.json());
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  const addManufacturerRecommendation = async () => {
    try {
      const res = await fetch('/api/manufacturer-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newRecommendation,
          machine_id: Number(newRecommendation.machine_id),
          frequency_hours: newRecommendation.frequency_hours ? Number(newRecommendation.frequency_hours) : null,
          frequency_days: newRecommendation.frequency_days ? Number(newRecommendation.frequency_days) : null
        })
      });
      if (!res.ok) {
        if (res.status === 413) {
          throw new Error("El archivo es demasiado grande para ser procesado por el servidor.");
        }
        throw new Error(`Error HTTP: ${res.status}`);
      }
      fetchData();
      setShowAddRecommendationModal(false);
      setNewRecommendation({
        machine_id: '',
        type: 'maintenance',
        item_name: '',
        specification: '',
        frequency_hours: '',
        frequency_days: '',
        part_number: '',
        description: '',
        document_url: ''
      });
    } catch (err: any) { 
      console.error(err); 
      showAlert(`Error al guardar: ${err.message}`);
    }
  };

  const deleteManufacturerRecommendation = async (id: number) => {
    askConfirmation('¿Eliminar esta recomendación del fabricante?', async () => {
      try {
        const res = await fetch(`/api/manufacturer-recommendations/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        fetchData();
      } catch (err) { console.error(err); }
    });
  };

  const addInventoryItem = async () => {
    try {
      const method = editingInventoryId ? 'PATCH' : 'POST';
      const url = editingInventoryId ? `/api/inventory/${editingInventoryId}` : '/api/inventory';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newInventoryItem,
          stock_level: Number(newInventoryItem.stock_level),
          min_stock: Number(newInventoryItem.min_stock),
          unit_price: Number(newInventoryItem.unit_price),
          entry_date: newInventoryItem.entry_date
        })
      });
      if (!res.ok) throw new Error('Failed');
      fetchData();
      setNewInventoryItem({ part_name: '', stock_level: '', min_stock: '', unit_price: '', entry_date: format(new Date(), 'yyyy-MM-dd') });
      setEditingInventoryId(null);
    } catch (err) { console.error(err); }
  };

  const deleteInventoryItem = async (id: number) => {
    askConfirmation('¿Eliminar este artículo del inventario?', async () => {
      try {
        const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        fetchData();
      } catch (err) { console.error(err); }
    });
  };

  const createPurchaseOrder = async () => {
    try {
      const url = editingPOId ? `/api/purchase-orders/${editingPOId}` : '/api/purchase-orders';
      const method = editingPOId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: Number(newPO.supplier_id),
          scheduled_date: newPO.scheduled_date || null,
          description: newPO.description || null,
          items: newPO.items
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed');
      }
      await fetchData();
      setShowPOModal(false);
      setEditingPOId(null);
      setShowAddSupplierInline(false);
      setNewPO({ supplier_id: '', scheduled_date: '', description: '', items: [] });
      setAddingItem({ inventory_id: '', part_name: '', quantity: 1, unit_price: 0, description: '' });
      showAlert(editingPOId ? "Orden de compra actualizada" : "Orden de compra generada exitosamente");
    } catch (err: any) { 
      console.error(err);
      showAlert(`Error: ${err.message}`);
    }
  };

  const deletePurchaseOrder = async (id: number) => {
    askConfirmation('¿Eliminar esta orden de compra?', async () => {
      try {
        const res = await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        fetchData();
      } catch (err) { console.error(err); }
    });
  };

  const receivePurchaseOrder = async (id: number) => {
    askConfirmation('¿Marcar esta orden como recibida? Esto actualizará el inventario.', async () => {
      try {
        const res = await fetch(`/api/purchase-orders/${id}/receive`, { 
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
        if (!res.ok) throw new Error('Failed');
        fetchData();
        showAlert("Orden de compra recibida. Inventario actualizado.");
      } catch (err) { 
        console.error(err);
        showAlert("Error al recibir la orden");
      }
    });
  };

  const addTechnicalName = async () => {
    try {
      const res = await fetch('/api/technical-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTechnicalName)
      });
      if (!res.ok) {
        const error = await res.json();
        showAlert(error.error || 'Error al agregar nombre técnico');
        return;
      }
      fetchData();
      setNewTechnicalName({ name: '', colloquial_name: '', description: '' });
    } catch (err) { console.error(err); }
  };

  const deleteTechnicalName = async (id: number) => {
    askConfirmation('¿Eliminar este nombre técnico de la biblioteca?', async () => {
      try {
        const res = await fetch(`/api/technical-names/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        fetchData();
      } catch (err) { console.error(err); }
    });
  };

  const addMachine = async () => {
    try {
      const res = await fetch('/api/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMachine)
      });
      if (!res.ok) throw new Error('Failed');
      fetchData();
      setNewMachine({ name: '', type: '', description: '' });
      setShowAddMachineModal(false);
      showAlert("Nueva máquina agregada exitosamente");
    } catch (err) { console.error(err); }
  };

  const deleteMachine = async (id: number) => {
    askConfirmation('¿Eliminar esta maquinaria? Esto también eliminará su árbol funcional y tareas programadas.', async () => {
      try {
        const res = await fetch(`/api/machines/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        fetchData();
      } catch (err) { console.error(err); }
    });
  };

  const addCompany = async () => {
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompany)
      });
      if (!res.ok) throw new Error('Failed');
      fetchData();
      setNewCompany({ name: '' });
      setShowAddCompanyModal(false);
    } catch (err) { console.error(err); }
  };

  const addPersonnel = async () => {
    try {
      const res = await fetch('/api/personnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPersonnel)
      });
      if (!res.ok) throw new Error('Failed');
      fetchData();
      setNewPersonnel({ name: '', company_id: '' });
    } catch (err) { console.error(err); }
  };

  const deletePersonnel = async (id: number) => {
    askConfirmation('¿Eliminar este responsable?', async () => {
      try {
        const res = await fetch(`/api/personnel/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        fetchData();
      } catch (err) { console.error(err); }
    });
  };

  const deleteCompany = async (id: number) => {
    askConfirmation('¿Eliminar esta empresa?', async () => {
      try {
        const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const error = await res.json();
          showAlert(error.error || 'Error al eliminar');
          return;
        }
        fetchData();
      } catch (err) { console.error(err); }
    });
  };

  const fetchTree = async (id: number) => {
    try {
      setFunctionalTree([]);
      const res = await fetch(`/api/machines/${id}/tree`);
      if (!res.ok) throw new Error(`Fetch tree failed: ${res.status}`);
      const data = await res.json();
      setFunctionalTree(data);
      setTreeEditState(data);
      setTreeHistory([]);
      setTreeRedoStack([]);
      setEditingNodeId(null);
      return data;
    } catch (err) {
      console.error("Error fetching tree:", err);
      return [];
    }
  };

  const pushToHistory = (state: FunctionalNode[]) => {
    setTreeHistory(prev => [...prev, [...state]]);
    setTreeRedoStack([]);
  };

  const addPartLocal = () => {
    if (!selectedMachine) return;
    
    pushToHistory(treeEditState);
    
    if (editingNodeId) {
      const newState = treeEditState.map(node => 
        node.id === editingNodeId 
          ? { 
              ...node, 
              name: newPart.name,
              is_consumable: newPart.is_consumable,
              is_critical: newPart.is_critical,
              life_expectancy_hours: newPart.life_expectancy_hours ? Number(newPart.life_expectancy_hours) : null,
              part_number: newPart.part_number,
              supplier: newPart.supplier,
              parent_id: newPart.parent_id ? Number(newPart.parent_id) : null,
            } 
          : node
      );
      setTreeEditState(newState);
      setEditingNodeId(null);
    } else {
      const newNode: FunctionalNode = {
        id: Date.now(), // Temporary ID
        machine_id: selectedMachine.id,
        name: newPart.name,
        is_consumable: newPart.is_consumable,
        is_critical: newPart.is_critical,
        life_expectancy_hours: newPart.life_expectancy_hours ? Number(newPart.life_expectancy_hours) : null,
        part_number: newPart.part_number,
        supplier: newPart.supplier,
        parent_id: newPart.parent_id ? Number(newPart.parent_id) : null,
        current_hours: 0
      };
      setTreeEditState([...treeEditState, newNode]);
    }
    
    setNewPart({ name: '', is_consumable: false, is_critical: false, life_expectancy_hours: '', part_number: '', supplier: '', parent_id: '' });
  };

  const deletePartLocal = (id: number) => {
    pushToHistory(treeEditState);
    const newState = treeEditState.filter(node => node.id !== id);
    setTreeEditState(newState);
  };

  const editPartLocal = (node: FunctionalNode) => {
    setEditingNodeId(node.id);
    setNewPart({
      name: node.name,
      is_consumable: node.is_consumable,
      is_critical: node.is_critical,
      life_expectancy_hours: node.life_expectancy_hours?.toString() || '',
      part_number: node.part_number || '',
      supplier: node.supplier || '',
      parent_id: node.parent_id?.toString() || ''
    });
  };

  const undoTreeChange = () => {
    if (treeHistory.length > 0) {
      const previousState = treeHistory[treeHistory.length - 1];
      setTreeRedoStack(prev => [[...treeEditState], ...prev]);
      setTreeEditState(previousState);
      setTreeHistory(prev => prev.slice(0, -1));
    }
  };

  const redoTreeChange = () => {
    if (treeRedoStack.length > 0) {
      const nextState = treeRedoStack[0];
      setTreeHistory(prev => [...prev, [...treeEditState]]);
      setTreeEditState(nextState);
      setTreeRedoStack(prev => prev.slice(1));
    }
  };

  const saveTreeChanges = async () => {
    if (!selectedMachine) return;
    try {
      const res = await fetch(`/api/machines/${selectedMachine.id}/tree/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(treeEditState)
      });
      if (!res.ok) throw new Error(`Sync tree failed: ${res.status}`);
      await fetchTree(selectedMachine.id);
    } catch (err) {
      console.error("Error saving tree:", err);
    }
  };

  const addPart = async () => {
    // Legacy - replaced by addPartLocal and saveTreeChanges
    addPartLocal();
  };

  const deletePart = async (id: number) => {
    // Legacy - replaced by deletePartLocal and saveTreeChanges
    deletePartLocal(id);
  };

  const addSchedule = async () => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSchedule)
      });
      if (!res.ok) throw new Error(`Add schedule failed: ${res.status}`);
      await fetchData();
      setNewSchedule({ 
        machine_id: '', 
        part_id: '', 
        task_name: '', 
        frequency_hours: '',
        personnel_id: '',
        required_items: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        activities: []
      });
      setShowScheduleModal(false);
    } catch (err) {
      console.error("Error adding schedule:", err);
    }
  };

  const deleteWorkOrder = async (id: number) => {
    askConfirmation('¿Eliminar esta orden de trabajo?', async () => {
      try {
        const res = await fetch(`/api/work-orders/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        fetchData();
      } catch (err) { console.error(err); }
    });
  };

  const deleteSchedule = async (id: number) => {
    askConfirmation('¿Eliminar esta tarea programada?', async () => {
      try {
        const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        fetchData();
      } catch (err) { console.error(err); }
    });
  };

  const updateSchedule = async (task: MaintenanceSchedule) => {
    try {
      const res = await fetch(`/api/schedules/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
      if (!res.ok) throw new Error(`Update schedule failed: ${res.status}`);
      await fetchData();
      setIsEditingTask(false);
    } catch (err) {
      console.error("Error updating schedule:", err);
      showAlert("Error al actualizar la programación");
    }
  };

  const createWorkOrderDirectly = async (task: MaintenanceSchedule) => {
    try {
      // If we are editing, save changes first
      if (isEditingTask && editedTask) {
        await updateSchedule(editedTask);
      }

      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: task.machine_id,
          part_id: task.part_id,
          schedule_id: task.id,
          personnel_id: task.personnel_id,
          type: 'preventive',
          description: `Mantenimiento programado: ${task.task_name}`,
          activities: task.activities ? task.activities.map(a => ({ ...a, is_completed: false })) : []
        })
      });
      if (!res.ok) throw new Error(`Create work order failed: ${res.status}`);
      
      // Update schedule's last_done and next_due
      const today = format(new Date(), 'yyyy-MM-dd');
      let nextDue = task.next_due;
      
      let intervalDays = 0;
      if (task.frequency_hours) {
        intervalDays = Math.floor(task.frequency_hours / 8);
      } else if (task.frequency_days) {
        intervalDays = task.frequency_days;
      }
      
      if (intervalDays > 0) {
        const next = new Date();
        next.setDate(next.getDate() + intervalDays);
        nextDue = format(next, 'yyyy-MM-dd');
      }

      await fetch(`/api/schedules/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...task,
          last_done: today,
          next_due: nextDue
        })
      });

      await fetchData();
      setActiveTab('work-orders');
      setShowTaskDetailsModal(false);
    } catch (err) {
      console.error("Error creating work order:", err);
      showAlert("Error al crear la orden de trabajo");
    }
  };

  const createWorkOrder = async (data: any) => {
    try {
      const machine_id = data.machine_id ? Number(data.machine_id) : null;
      const part_id = data.part_id ? Number(data.part_id) : null;

      if (!machine_id) {
        showAlert("Debe seleccionar una máquina");
        return;
      }

      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          machine_id,
          part_id
        })
      });
      if (!res.ok) throw new Error(`Create work order failed: ${res.status}`);
      await fetchData();
      setShowNewWOModal(false);
      setNewWO({ machine_id: '', part_id: '', type: 'preventive', description: '', personnel_id: '', activities: [] });
      setSelectedMachine(null);
      setFunctionalTree([]);
    } catch (err) {
      console.error("Error creating work order:", err);
    }
  };

  const startWorkOrder = (id: number) => {
    const wo = workOrders.find(w => w.id === id);
    setWOToStart(id);
    setStartWOPersonnelId(wo?.personnel_id ? String(wo.personnel_id) : '');
    setStartWODiagnostic(wo?.diagnostic_notes || '');
    setStartWOActivities(wo?.activities ? [...wo.activities] : []);
    setShowStartWOModal(true);
  };

  const confirmStartWorkOrder = async () => {
    if (!woToStart || !startWOPersonnelId) return;
    try {
      const res = await fetch(`/api/work-orders/${woToStart}/start`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          personnel_id: Number(startWOPersonnelId),
          diagnostic_notes: startWODiagnostic,
          activities: startWOActivities
        })
      });
      if (!res.ok) throw new Error(`Start work order failed: ${res.status}`);
      setShowStartWOModal(false);
      fetchData();
    } catch (err) {
      console.error("Error starting work order:", err);
      showAlert("Error al iniciar la orden de trabajo");
    }
  };

  const updateWorkOrder = async (data: any) => {
    try {
      const res = await fetch(`/api/work-orders/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Update work order failed: ${res.status}`);
      await fetchData();
      setShowEditWOModal(false);
    } catch (err) {
      console.error("Error updating work order:", err);
      showAlert("Error al actualizar la orden de trabajo");
    }
  };

  const toggleActivityCompletion = async (wo: any, activityIdx: number, isCompleted: boolean) => {
    try {
      const updatedActivities = [...wo.activities];
      updatedActivities[activityIdx].is_completed = isCompleted;
      
      const res = await fetch(`/api/work-orders/${wo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: updatedActivities })
      });
      if (!res.ok) throw new Error('Failed to update activity');
      fetchData();
    } catch (err) {
      console.error(err);
      showAlert("Error al actualizar la actividad");
    }
  };

  const closeWorkOrder = async (id: number) => {
    const wo = workOrders.find(w => w.id === id);
    if (wo && wo.activities && wo.activities.length > 0) {
      const allCompleted = wo.activities.every(a => a.is_completed);
      if (!allCompleted) {
        showAlert("No se puede finalizar la orden de trabajo porque hay actividades pendientes.");
        return;
      }
      const allAssigned = wo.activities.every(a => a.personnel_id);
      if (!allAssigned) {
        showAlert("No se puede finalizar la orden de trabajo porque hay actividades sin responsable asignado.");
        return;
      }
    }

    try {
      const res = await fetch(`/api/work-orders/${id}/close`, { method: 'PATCH' });
      if (!res.ok) throw new Error(`Close work order failed: ${res.status}`);
      fetchData();
    } catch (err) {
      console.error("Error closing work order:", err);
    }
  };

  const pendingSchedulesToday = schedules.filter(s => isTaskDueOn(s, new Date()) && !workOrders.some(wo => wo.schedule_id === s.id && isSameDay(parseLocalDate(wo.created_at), new Date())));
  const openWorkOrdersToday = workOrders.filter(wo => wo.schedule_id && isSameDay(parseLocalDate(wo.created_at), new Date()) && wo.status === 'open');
  const inProgressWorkOrdersToday = workOrders.filter(wo => wo.schedule_id && isSameDay(parseLocalDate(wo.created_at), new Date()) && wo.status === 'in_progress');
  const closedWorkOrdersToday = workOrders.filter(wo => wo.schedule_id && isSameDay(parseLocalDate(wo.created_at), new Date()) && wo.status === 'closed');

  return (
    <div className="flex h-screen bg-[#E4E3E0] text-[#141414] font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#141414] flex flex-col">
        <div className="p-6 border-bottom border-[#141414]">
          <h1 className="text-2xl font-bold tracking-tighter uppercase italic font-serif">AC Piles CMMS</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'machines', icon: Settings, label: 'Maquinaria' },
            { id: 'work-orders', icon: ClipboardList, label: 'Ordenes de Trabajo' },
            { id: 'inventory', icon: Package, label: 'Consumibles' },
            { id: 'manufacturer-specs', icon: Book, label: 'Especificaciones' },
            { id: 'kpis', icon: BarChart3, label: 'Reportes KPI' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium transition-all duration-200 border border-transparent",
                activeTab === item.id 
                  ? "bg-[#141414] text-[#E4E3E0]" 
                  : "hover:border-[#141414]"
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => { setTechnicalNameTarget(null); setShowTechnicalNameModal(true); }}
            className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium transition-all duration-200 border border-transparent hover:border-[#141414]"
          >
            <Book className="w-4 h-4" />
            <span>Biblioteca de Nombres</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <header className="flex justify-between items-end">
              <div>
                <p className="text-xs uppercase tracking-widest opacity-50 font-mono">Estado general</p>
                <h2 className="text-4xl font-serif italic">Estado de Planta</h2>
              </div>
              <div className="text-right font-mono text-sm opacity-50">
                {format(new Date(), 'dd MMM yyyy')}
              </div>
            </header>

            {/* Today's Tasks Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white border border-[#141414] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-serif italic">Tareas para Hoy</h3>
                      <p className="text-[10px] font-mono uppercase opacity-50">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
                    </div>
                    <div className="bg-[#141414] text-[#E4E3E0] px-3 py-1 text-[10px] font-mono uppercase">
                      {pendingSchedulesToday.length + openWorkOrdersToday.length} Pendientes
                    </div>
                  </div>
                  <div className="space-y-2">
                    {pendingSchedulesToday.length === 0 && openWorkOrdersToday.length === 0 ? (
                      <p className="text-xs italic opacity-50">No hay tareas programadas para hoy.</p>
                    ) : (
                      <>
                        {pendingSchedulesToday.map(s => (
                          <div 
                            key={s.id} 
                            className="flex items-center justify-between p-3 border border-[#141414]/10 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedTask(s);
                              setShowTaskDetailsModal(true);
                            }}
                          >
                            <div>
                              <p className="text-sm font-bold uppercase">{s.machine_name}</p>
                              <p className="text-xs opacity-60">{s.task_name} {s.part_name && `• ${s.part_name}`}</p>
                              {s.personnel_name && <p className="text-[10px] mt-1 font-mono">Responsable: {s.personnel_name} ({s.company_name})</p>}
                            </div>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  askConfirmation(`¿Desea generar una Orden de Trabajo para: ${s.task_name}?`, async () => {
                                    await createWorkOrderDirectly(s);
                                  });
                                }}
                                className="text-[10px] font-bold uppercase border border-[#141414] px-3 py-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                              >
                                Crear OT
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSchedule(s.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Eliminar Tarea Programada"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {openWorkOrdersToday.map(wo => (
                          <div 
                            key={`wo-${wo.id}`} 
                            className="flex items-center justify-between p-3 border border-amber-100 bg-amber-50/30 hover:bg-amber-50 transition-colors cursor-pointer"
                            onClick={() => {
                              setWOToStart(wo.id);
                              setStartWOPersonnelId(wo.personnel_id ? String(wo.personnel_id) : '');
                              setStartWODiagnostic(wo.diagnostic_notes || '');
                              setStartWOActivities(wo.activities || []);
                              setShowStartWOModal(true);
                            }}
                          >
                            <div>
                              <p className="text-sm font-bold uppercase text-amber-900">{wo.machine_name}</p>
                              <p className="text-xs opacity-60">{wo.description}</p>
                              <div className="flex items-center mt-1 space-x-2">
                                <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-1">OT Creada</span>
                                <span className="text-[9px] opacity-40 font-mono">{format(parseLocalDate(wo.created_at), 'HH:mm')}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWOToStart(wo.id);
                                  setStartWOPersonnelId(wo.personnel_id ? String(wo.personnel_id) : '');
                                  setStartWODiagnostic(wo.diagnostic_notes || '');
                                  setStartWOActivities(wo.activities || []);
                                  setShowStartWOModal(true);
                                }}
                                className="text-[10px] font-bold uppercase border border-amber-600 text-amber-700 px-3 py-1 hover:bg-amber-600 hover:text-white transition-colors"
                              >
                                Iniciar OT
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* In Progress Tasks Today */}
                <div className="bg-white border border-[#141414] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-serif italic">Tareas en Proceso</h3>
                      <p className="text-[10px] font-mono uppercase opacity-50">Órdenes de trabajo generadas hoy</p>
                    </div>
                    <div className="bg-blue-600 text-white px-3 py-1 text-[10px] font-mono uppercase">
                      {inProgressWorkOrdersToday.length} En Proceso
                    </div>
                  </div>
                  <div className="space-y-2">
                    {inProgressWorkOrdersToday.length === 0 ? (
                      <p className="text-xs italic opacity-50">No hay tareas en proceso hoy.</p>
                    ) : (
                      inProgressWorkOrdersToday.map(wo => (
                        <div key={wo.id} className="flex items-center justify-between p-3 border border-blue-100 bg-blue-50/30">
                          <div>
                            <p className="text-sm font-bold uppercase text-blue-900">{wo.machine_name}</p>
                            <p className="text-xs opacity-60">{wo.description}</p>
                            <div className="flex items-center mt-1 space-x-2">
                              <span className="text-[9px] font-bold uppercase bg-blue-100 text-blue-700 px-1">En Progreso</span>
                              <span className="text-[9px] opacity-40 font-mono">{format(parseLocalDate(wo.created_at), 'HH:mm')}</span>
                            </div>
                          </div>
                          <Play className="w-4 h-4 text-blue-600" />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Completed Tasks Today */}
                <div className="bg-white border border-[#141414] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-serif italic">Tareas Realizadas Hoy</h3>
                      <p className="text-[10px] font-mono uppercase opacity-50">Actividades completadas el día de hoy</p>
                    </div>
                    <div className="bg-emerald-600 text-white px-3 py-1 text-[10px] font-mono uppercase">
                      {workOrders.filter(wo => wo.schedule_id && isSameDay(parseLocalDate(wo.created_at), new Date()) && wo.status === 'closed').length} Realizadas
                    </div>
                  </div>
                  <div className="space-y-2">
                    {workOrders.filter(wo => wo.schedule_id && isSameDay(parseLocalDate(wo.created_at), new Date()) && wo.status === 'closed').length === 0 ? (
                      <p className="text-xs italic opacity-50">No se han realizado tareas programadas hoy.</p>
                    ) : (
                      workOrders.filter(wo => wo.schedule_id && isSameDay(parseLocalDate(wo.created_at), new Date()) && wo.status === 'closed').map(wo => (
                        <div key={wo.id} className="flex items-center justify-between p-3 border border-emerald-100 bg-emerald-50/30">
                          <div>
                            <p className="text-sm font-bold uppercase text-emerald-900">{wo.machine_name}</p>
                            <p className="text-xs opacity-60">{wo.description}</p>
                            <div className="flex items-center mt-1 space-x-2">
                              <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 px-1">Completada</span>
                              <span className="text-[9px] opacity-40 font-mono">{format(parseLocalDate(wo.created_at), 'HH:mm')}</span>
                            </div>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Scheduled Purchase Orders Widget */}
                <div className="bg-white border border-[#141414] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-serif italic">Ordenes de Compra Programadas</h3>
                      <p className="text-[10px] font-mono uppercase opacity-50">Próximas entregas y pedidos</p>
                    </div>
                    <div className="bg-blue-600 text-white px-3 py-1 text-[10px] font-mono uppercase">
                      {purchaseOrders.filter(po => po.status === 'pending' && po.scheduled_date).length} Pendientes
                    </div>
                  </div>
                  <div className="space-y-2">
                    {purchaseOrders.filter(po => po.status === 'pending' && po.scheduled_date).length === 0 ? (
                      <p className="text-xs italic opacity-50">No hay ordenes de compra programadas.</p>
                    ) : (
                      purchaseOrders
                        .filter(po => po.status === 'pending' && po.scheduled_date)
                        .sort((a, b) => parseLocalDate(a.scheduled_date).getTime() - parseLocalDate(b.scheduled_date).getTime())
                        .map(po => (
                          <div 
                            key={po.id} 
                            className="flex items-center justify-between p-3 border border-[#141414]/10 hover:bg-gray-50 transition-colors"
                          >
                            <div>
                              <p className="text-sm font-bold uppercase">OC #{po.id} - {po.supplier_name}</p>
                              <p className="text-xs opacity-60">
                                Programada para: {format(parseLocalDate(po.scheduled_date), 'dd/MM/yyyy')}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {po.items.map((item, i) => (
                                  <span key={i} className="text-[8px] bg-gray-100 px-1 py-0.5 rounded uppercase opacity-70">
                                    {item.part_name} ({item.quantity})
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button 
                              onClick={() => receivePurchaseOrder(po.id)}
                              className="text-[10px] font-bold uppercase border border-[#141414] px-3 py-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                            >
                              Recibir
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Calendar Section */}
                <MaintenanceCalendar 
                  schedules={schedules} 
                  purchaseOrders={purchaseOrders}
                  workOrders={workOrders}
                  onTaskClick={(task) => {
                    setSelectedTask(task);
                    setShowTaskDetailsModal(true);
                  }}
                />
              </div>

              {/* Machinery Availability Widget */}
              <div className="space-y-6">
                <div className="bg-white border border-[#141414] p-6">
                  <h3 className="text-xl font-serif italic mb-6">Disponibilidad</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-xs uppercase font-mono opacity-50">Operativas</span>
                      <span className="text-2xl font-mono">{machines.filter(m => m.status === 'operational').length}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-500" 
                        style={{ width: `${(machines.filter(m => m.status === 'operational').length / (machines.length || 1)) * 100}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-end pt-4">
                      <span className="text-xs uppercase font-mono opacity-50">En Intervención</span>
                      <span className="text-2xl font-mono">{machines.filter(m => m.status !== 'operational').length}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2">
                      <div 
                        className="bg-red-500 h-full transition-all duration-500" 
                        style={{ width: `${(machines.filter(m => m.status !== 'operational').length / (machines.length || 1)) * 100}%` }}
                      />
                    </div>

                    <div className="pt-8 border-t border-gray-100">
                      <p className="text-[10px] uppercase font-bold mb-4 opacity-30">Estado de Equipos</p>
                      <div className="space-y-3">
                        {machines.map(m => (
                          <div key={m.id} className="flex items-center justify-between">
                            <span className="text-xs font-medium">{m.name}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-[8px] uppercase opacity-40 font-mono">
                                {m.status === 'operational' ? 'Disponible' : 'Intervenida'}
                              </span>
                              <span className={cn(
                                "w-2 h-2 rounded-full",
                                m.status === 'operational' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                              )} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border border-[#141414] bg-[#141414] text-[#E4E3E0]">
                  <p className="text-[10px] uppercase font-mono opacity-50 mb-2">Disponibilidad de Planta</p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl font-mono">
                      {((machines.filter(m => m.status === 'operational').length / (machines.length || 1)) * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs opacity-50 italic font-serif">Uptime Global</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'machines' && (
          <div className="space-y-8">
            <header className="flex justify-between items-end">
              <div>
                <p className="text-xs uppercase tracking-widest opacity-50 font-mono">Inventario Técnico</p>
                <h2 className="text-4xl font-serif italic">Maquinaria y Equipos</h2>
              </div>
              <button 
                onClick={() => setShowAddMachineModal(true)}
                className="bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs font-bold uppercase flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" /> Agregar Máquina
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {machines.map((machine) => (
                <div 
                  key={machine.id} 
                  className="border border-[#141414] bg-white overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="p-6 flex justify-between items-start border-b border-[#141414]">
                    <div>
                      <h3 className="text-xl font-bold">{machine.name}</h3>
                      <p className="text-xs font-mono opacity-50">{machine.type}</p>
                    </div>
                    <span className={cn(
                      "px-2 py-1 text-[10px] uppercase font-bold tracking-tighter",
                      machine.status === 'operational' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {machine.status}
                    </span>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-sm opacity-70">{machine.description}</p>
                      <div className="flex flex-wrap gap-2 pt-4">
                        <button 
                          onClick={() => deleteMachine(machine.id)}
                          className="flex items-center space-x-1 text-red-600 hover:bg-red-50 px-2 py-1 border border-transparent hover:border-red-200 rounded transition-colors"
                          title="Eliminar Máquina"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase">Eliminar</span>
                        </button>
                        <button 
                          onClick={async () => {
                            setSelectedMachine(machine);
                            await fetchTree(machine.id);
                            if (machine.has_document) {
                              try {
                                const res = await fetch(`/api/machines/${machine.id}/document`);
                                if (res.ok) {
                                  const data = await res.json();
                                  setSelectedMachine(prev => prev ? { ...prev, functional_tree_image_url: data.functional_tree_image_url } : null);
                                }
                              } catch (err) {
                                console.error("Error fetching document:", err);
                              }
                            }
                            setShowTreeVisualizer(true);
                          }}
                          className="text-xs font-bold uppercase flex items-center hover:underline border border-[#141414] px-2 py-1"
                        >
                          <Settings className="w-3 h-3 mr-1" /> Árbol
                        </button>
                        <button 
                          onClick={async () => {
                            setSelectedMachine(machine);
                            await fetchTree(machine.id);
                            setNewSchedule({ ...newSchedule, machine_id: machine.id.toString() });
                            setShowScheduleModal(true);
                          }}
                          className="text-xs font-bold uppercase flex items-center hover:underline border border-[#141414] px-2 py-1"
                        >
                          <Calendar className="w-3 h-3 mr-1" /> Programar
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedMachine(machine);
                            fetchTree(machine.id).then(tree => {
                              setShowFailureAnalysisModal(true);
                            });
                          }}
                          className="bg-[#141414] text-[#E4E3E0] px-3 py-1 text-xs font-bold uppercase flex items-center"
                        >
                          <Stethoscope className="w-3 h-3 mr-1" /> Análisis de Falla
                        </button>
                      </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tree Visualizer Modal (Image/PDF Only) */}
            {showTreeVisualizer && selectedMachine && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-50">
                <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-6xl h-[90vh] flex flex-col">
                  <div className="p-6 border-b border-[#141414] flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-serif italic leading-none">Árbol Funcional: {selectedMachine.name}</h3>
                      <p className="text-[10px] font-mono uppercase opacity-50 mt-1">Visualización de la estructura</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <label className="cursor-pointer text-xs font-bold uppercase border border-[#141414] px-4 py-2 hover:bg-gray-100">
                        {selectedMachine.functional_tree_image_url ? 'Cambiar Documento' : 'Subir Documento'}
                        <input 
                          type="file" 
                          accept="image/*,.pdf" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > MAX_FILE_SIZE) {
                                showAlert("El archivo es demasiado grande. El tamaño máximo permitido es 10MB.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                const base64String = reader.result as string;
                                try {
                                  const res = await fetch(`/api/machines/${selectedMachine.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ functional_tree_image_url: base64String })
                                  });
                                  if (!res.ok) {
                                    if (res.status === 413) {
                                      throw new Error("El archivo es demasiado grande para ser procesado por el servidor.");
                                    }
                                    const errorData = await res.json().catch(() => ({}));
                                    throw new Error(errorData.error || `Error HTTP: ${res.status}`);
                                  }
                                  fetchData();
                                  setSelectedMachine({ ...selectedMachine, functional_tree_image_url: base64String });
                                } catch (err: any) {
                                  console.error(err);
                                  showAlert(`Error al subir el documento: ${err.message}`);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }} 
                        />
                      </label>
                      <button onClick={() => setShowTreeVisualizer(false)} className="text-xs font-bold uppercase hover:underline">Cerrar</button>
                    </div>
                  </div>
                  <div className="flex-1 bg-white relative overflow-hidden">
                    {selectedMachine.functional_tree_image_url ? (
                      <TransformWrapper
                        initialScale={1}
                        minScale={0.1}
                        maxScale={8}
                        centerOnInit={true}
                        limitToBounds={false}
                        wheel={{ step: 0.1 }}
                      >
                        <div className="w-full h-full relative bg-gray-50">
                          <ZoomControls />
                          
                          <TransformComponent wrapperClass="!w-full !h-full" contentClass="flex items-center justify-center m-auto">
                            {selectedMachine.functional_tree_image_url!.startsWith('data:application/pdf') ? (
                              <div className="flex flex-col items-center">
                                <Document 
                                  file={selectedMachine.functional_tree_image_url} 
                                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                  className="border border-[#141414] shadow-lg bg-white"
                                >
                                  <Page 
                                    pageNumber={pageNumber} 
                                    renderTextLayer={false} 
                                    renderAnnotationLayer={false} 
                                    devicePixelRatio={Math.max(window.devicePixelRatio || 1, 3)}
                                  />
                                </Document>
                              </div>
                            ) : (
                              <img 
                                src={selectedMachine.functional_tree_image_url} 
                                alt={`Árbol funcional de ${selectedMachine.name}`} 
                                className="max-w-full max-h-full object-contain border border-[#141414] shadow-lg bg-white"
                              />
                            )}
                          </TransformComponent>

                          {/* Pagination for PDF */}
                          {selectedMachine.functional_tree_image_url!.startsWith('data:application/pdf') && numPages && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-4 bg-white/90 backdrop-blur-sm p-2 border border-[#141414] shadow-md z-20">
                              <button 
                                disabled={pageNumber <= 1} 
                                onClick={() => setPageNumber(prev => prev - 1)}
                                className="px-3 py-1 border border-[#141414] text-xs font-bold uppercase disabled:opacity-50 hover:bg-gray-100"
                              >
                                Anterior
                              </button>
                              <span className="text-xs font-mono">
                                Página {pageNumber} de {numPages}
                              </span>
                              <button 
                                disabled={pageNumber >= numPages} 
                                onClick={() => setPageNumber(prev => prev + 1)}
                                className="px-3 py-1 border border-[#141414] text-xs font-bold uppercase disabled:opacity-50 hover:bg-gray-100"
                              >
                                Siguiente
                              </button>
                            </div>
                          )}
                        </div>
                      </TransformWrapper>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
                        <Image className="w-16 h-16 opacity-20 mb-4" />
                        <p className="text-sm font-bold uppercase opacity-50">No hay documento del árbol funcional</p>
                        <p className="text-xs italic opacity-40 mt-2">Utilice el botón "Subir Documento" para añadir una imagen o PDF.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}



            {/* Schedule Modal */}
            {showScheduleModal && selectedMachine && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-50">
                <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-2xl font-serif italic mb-6">Programar Mantenimiento</h3>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                        value={newSchedule.part_id}
                        onChange={e => setNewSchedule({...newSchedule, part_id: e.target.value})}
                      >
                        <option value="">Máquina General</option>
                        {functionalTree.map(node => (
                          <option key={node.id} value={node.id}>{node.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => { setTechnicalNameTarget({ type: 'schedule', field: 'task_name' }); setShowTechnicalNameModal(true); }}
                        className="border border-[#141414] px-2 hover:bg-gray-100"
                        title="Biblioteca de Nombres"
                      >
                        <Book className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        placeholder="Nombre de la tarea (ej: Cambio de rodamientos)" 
                        className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                        value={newSchedule.task_name}
                        onChange={e => setNewSchedule({...newSchedule, task_name: e.target.value})}
                      />
                      <button 
                        onClick={() => { setTechnicalNameTarget({ type: 'schedule', field: 'task_name' }); setShowTechnicalNameModal(true); }}
                        className="border border-[#141414] px-2 hover:bg-gray-100"
                      >
                        <Book className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50">Frecuencia (Horas)</label>
                        <input 
                          placeholder="Ej: 500" 
                          type="number"
                          className="w-full p-2 border border-[#141414] bg-white text-sm"
                          value={newSchedule.frequency_hours}
                          onChange={e => setNewSchedule({...newSchedule, frequency_hours: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50">Fecha de Inicio</label>
                        <input 
                          type="date"
                          className="w-full p-2 border border-[#141414] bg-white text-sm"
                          value={newSchedule.start_date}
                          onChange={e => setNewSchedule({...newSchedule, start_date: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50">Repuestos / Elementos Requeridos</label>
                      <div className="flex gap-2">
                        <textarea 
                          placeholder="Ej: 2 Rodamientos 6205, Grasa industrial..." 
                          className="flex-1 p-2 border border-[#141414] bg-white text-sm h-16"
                          value={newSchedule.required_items}
                          onChange={e => setNewSchedule({...newSchedule, required_items: e.target.value})}
                        />
                        <button 
                          onClick={() => { setTechnicalNameTarget({ type: 'schedule', field: 'required_items' }); setShowTechnicalNameModal(true); }}
                          className="border border-[#141414] px-2 hover:bg-gray-100 h-16"
                        >
                          <Book className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50">Descripción Técnica</label>
                      <div className="flex gap-2">
                        <textarea 
                          placeholder="Descripción técnica" 
                          className="flex-1 p-2 border border-[#141414] bg-white text-sm h-24"
                          value={newSchedule.description}
                          onChange={e => setNewSchedule({...newSchedule, description: e.target.value})}
                        />
                        <button 
                          onClick={() => { setTechnicalNameTarget({ type: 'schedule', field: 'description' }); setShowTechnicalNameModal(true); }}
                          className="border border-[#141414] px-2 hover:bg-gray-100 h-24"
                        >
                          <Book className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-50">Actividades (Opcional)</label>
                      {newSchedule.activities.map((activity, idx) => (
                        <div key={activity.id} className="flex flex-col space-y-1 p-2 border border-[#141414] bg-white">
                          <div className="flex items-center space-x-2">
                            <input 
                              type="text"
                              className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                              placeholder={`Actividad ${idx + 1}`}
                              value={activity.description}
                              onChange={e => {
                                const updated = [...newSchedule.activities];
                                updated[idx].description = e.target.value;
                                setNewSchedule({ ...newSchedule, activities: updated });
                              }}
                            />
                            <button 
                              onClick={() => {
                                const updated = newSchedule.activities.filter((_, i) => i !== idx);
                                setNewSchedule({ ...newSchedule, activities: updated });
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          setNewSchedule({ ...newSchedule, activities: [...newSchedule.activities, { id: Date.now(), description: '', is_completed: false }] });
                        }}
                        className="text-xs font-bold uppercase border border-[#141414] px-3 py-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                      >
                        + Agregar Actividad
                      </button>
                    </div>

                    <div className="flex space-x-2">
                      <button onClick={() => setShowScheduleModal(false)} className="flex-1 border border-[#141414] py-2 text-sm font-bold uppercase">Cancelar</button>
                      <button onClick={addSchedule} className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 text-sm font-bold uppercase">Programar</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Failure Analysis Modal */}
            {showFailureAnalysisModal && selectedMachine && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-50">
                <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-2xl font-serif italic leading-none">Análisis de Falla</h3>
                      <p className="text-[10px] font-mono uppercase opacity-50 mt-1">{selectedMachine.name}</p>
                    </div>
                    <button onClick={() => setShowFailureAnalysisModal(false)} className="text-xs font-bold uppercase hover:underline">Cerrar</button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-50">Componente Afectado</label>
                      <select 
                        className="w-full p-3 border border-[#141414] bg-white text-sm"
                        value={newWO.part_id}
                        onChange={e => setNewWO({ ...newWO, part_id: e.target.value })}
                      >
                        <option value="">Seleccionar Componente...</option>
                        {functionalTree.map(node => (
                          <option key={node.id} value={node.id}>{node.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-50">Descripción de la Falla</label>
                      <textarea 
                        className="w-full p-3 border border-[#141414] bg-white text-sm h-24"
                        placeholder="Describa el problema o síntoma..."
                        value={newWO.description}
                        onChange={e => setNewWO({ ...newWO, description: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-50">Análisis de Causa Raíz (Opcional)</label>
                      <textarea 
                        className="w-full p-3 border border-[#141414] bg-white text-sm h-24"
                        placeholder="Describa la causa raíz de la falla..."
                        value={diagnosticRootCause}
                        onChange={e => setDiagnosticRootCause(e.target.value)}
                      />
                    </div>

                    <button 
                      onClick={async () => {
                        if (!newWO.part_id || !newWO.description) {
                          showAlert("Por favor seleccione un componente y describa la falla.");
                          return;
                        }
                        const woData = {
                          machine_id: selectedMachine.id,
                          part_id: parseInt(newWO.part_id),
                          type: 'corrective',
                          description: `ACCIÓN CORRECTIVA: ${newWO.description}`,
                          diagnostic_notes: `Análisis de falla registrado.`,
                          root_cause: diagnosticRootCause || null
                        };
                        await createWorkOrder(woData);
                        setDiagnosticRootCause('');
                        setNewWO({ machine_id: '', part_id: '', type: 'preventive', description: '', personnel_id: '', activities: [] });
                        setShowFailureAnalysisModal(false);
                      }}
                      className="w-full py-4 bg-red-600 text-white font-bold uppercase tracking-widest hover:bg-red-700 transition-all"
                    >
                      Generar Orden Correctiva
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* New Work Order Modal */}
            {showNewWOModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-50">
                <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-2xl font-serif italic mb-6">Nueva Orden de Trabajo</h3>
                  
                  {!showAddPersonnelInNewWO ? (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50">Máquina</label>
                      <select 
                        className="w-full p-2 border border-[#141414] bg-white text-sm"
                        value={newWO.machine_id}
                        onChange={async (e) => {
                          const mId = e.target.value;
                          setNewWO({...newWO, machine_id: mId, part_id: ''});
                          if (mId) {
                            const machine = machines.find(m => m.id === Number(mId));
                            if (machine) {
                              setSelectedMachine(machine);
                              await fetchTree(machine.id);
                            }
                          } else {
                            setSelectedMachine(null);
                            setFunctionalTree([]);
                          }
                        }}
                      >
                        <option value="">Seleccionar Máquina...</option>
                        {machines.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50">Componente / Pieza</label>
                      <select 
                        className="w-full p-2 border border-[#141414] bg-white text-sm"
                        value={newWO.part_id}
                        onChange={e => setNewWO({...newWO, part_id: e.target.value})}
                        disabled={!newWO.machine_id}
                      >
                        <option value="">Toda la máquina</option>
                        {functionalTree.map(node => (
                          <option key={node.id} value={node.id}>{node.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50">Tipo de Trabajo</label>
                      <select 
                        className="w-full p-2 border border-[#141414] bg-white text-sm"
                        value={newWO.type}
                        onChange={e => setNewWO({...newWO, type: e.target.value as any})}
                      >
                        <option value="preventive">Preventivo</option>
                        <option value="corrective">Correctivo</option>
                        <option value="consumable_change">Cambio de Consumible</option>
                        <option value="unplanned_failure">Falla Imprevista</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold uppercase opacity-50">Responsable / Técnico</label>
                        <button 
                          onClick={() => {
                            setNewPersonnelTarget({ type: 'main' });
                            setShowAddPersonnelInNewWO(true);
                          }}
                          className="text-[9px] uppercase font-bold text-blue-600 hover:underline"
                        >
                          + Nuevo Responsable
                        </button>
                      </div>
                      <select 
                        className="w-full p-2 border border-[#141414] bg-white text-sm"
                        value={newWO.personnel_id}
                        onChange={e => setNewWO({...newWO, personnel_id: e.target.value})}
                      >
                        <option value="">Seleccionar Responsable...</option>
                        {personnel.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({companies.find(c => c.id === p.company_id)?.name})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50">Descripción</label>
                      <div className="flex gap-2">
                        <textarea 
                          placeholder="Descripción detallada del trabajo a realizar..." 
                          className="flex-1 p-2 border border-[#141414] bg-white text-sm h-24"
                          value={newWO.description}
                          onChange={e => setNewWO({...newWO, description: e.target.value})}
                        />
                        <button 
                          onClick={() => { setTechnicalNameTarget({ type: 'wo', field: 'description' }); setShowTechnicalNameModal(true); }}
                          className="border border-[#141414] px-2 hover:bg-gray-100 h-24"
                        >
                          <Book className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-50">Actividades (Opcional)</label>
                      {newWO.activities.map((activity, idx) => (
                        <div key={activity.id} className="flex flex-col space-y-1 p-2 border border-[#141414] bg-white">
                          <div className="flex items-center space-x-2">
                            <input 
                              type="text"
                              className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                              placeholder={`Actividad ${idx + 1}`}
                              value={activity.description}
                              onChange={e => {
                                const updated = [...newWO.activities];
                                updated[idx].description = e.target.value;
                                setNewWO({ ...newWO, activities: updated });
                              }}
                            />
                            <button 
                              onClick={() => {
                                const updated = newWO.activities.filter((_, i) => i !== idx);
                                setNewWO({ ...newWO, activities: updated });
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          setNewWO({ ...newWO, activities: [...newWO.activities, { id: Date.now(), description: '', is_completed: false }] });
                        }}
                        className="text-xs font-bold uppercase border border-[#141414] px-3 py-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                      >
                        + Agregar Actividad
                      </button>
                    </div>

                    <div className="flex space-x-2 pt-4">
                      <button onClick={() => {
                        setShowNewWOModal(false);
                        setSelectedMachine(null);
                      }} className="flex-1 border border-[#141414] py-2 text-sm font-bold uppercase">Cancelar</button>
                      <button 
                        onClick={() => createWorkOrder(newWO)} 
                        disabled={!newWO.machine_id || !newWO.description}
                        className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 text-sm font-bold uppercase disabled:opacity-30"
                      >
                        Crear OT
                      </button>
                    </div>
                  </div>
                  ) : (
                    <div className="p-4 border border-[#141414] bg-white space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold uppercase">Nuevo Responsable</h4>
                        <button 
                          onClick={() => setShowAddPersonnelInNewWO(false)}
                          className="text-[9px] uppercase font-bold opacity-50 hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50">Nombre Completo</label>
                        <input 
                          placeholder="Ej: Juan Pérez"
                          className="w-full p-2 border border-[#141414] bg-white text-sm"
                          value={newPersonnelInWO.name}
                          onChange={e => setNewPersonnelInWO({ ...newPersonnelInWO, name: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-bold uppercase opacity-50">Empresa</label>
                          <button 
                            onClick={() => setShowAddCompanyInWO(!showAddCompanyInWO)}
                            className="text-[9px] uppercase font-bold text-blue-600 hover:underline"
                          >
                            + Nueva Empresa
                          </button>
                        </div>
                        
                        {!showAddCompanyInWO ? (
                          <select 
                            className="w-full p-2 border border-[#141414] bg-white text-sm"
                            value={newPersonnelInWO.company_id}
                            onChange={e => setNewPersonnelInWO({ ...newPersonnelInWO, company_id: e.target.value })}
                          >
                            <option value="">Seleccionar Empresa...</option>
                            {companies.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex gap-2">
                            <input 
                              placeholder="Nombre de la empresa"
                              className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                              value={newCompanyInWO.name}
                              onChange={e => setNewCompanyInWO({ name: e.target.value })}
                            />
                            <button 
                              onClick={async () => {
                                if (!newCompanyInWO.name) return;
                                try {
                                  const res = await fetch('/api/companies', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(newCompanyInWO)
                                  });
                                  if (!res.ok) throw new Error('Failed to add company');
                                  const data = await res.json();
                                  await fetchData();
                                  setNewPersonnelInWO({ ...newPersonnelInWO, company_id: String(data.id) });
                                  setShowAddCompanyInWO(false);
                                  setNewCompanyInWO({ name: '' });
                                } catch (err) {
                                  console.error(err);
                                  showAlert("Error al agregar empresa");
                                }
                              }}
                              className="bg-[#141414] text-[#E4E3E0] px-3 text-xs font-bold uppercase"
                            >
                              Guardar
                            </button>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={async () => {
                          if (!newPersonnelInWO.name) return;
                          try {
                            const res = await fetch('/api/personnel', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                name: newPersonnelInWO.name,
                                company_id: newPersonnelInWO.company_id ? Number(newPersonnelInWO.company_id) : null
                              })
                            });
                            if (!res.ok) throw new Error('Failed to add personnel');
                            const data = await res.json();
                            await fetchData();
                            
                            if (newPersonnelTarget?.type === 'main') {
                              setNewWO({...newWO, personnel_id: String(data.id)});
                            }
                            
                            setShowAddPersonnelInNewWO(false);
                            setNewPersonnelInWO({ name: '', company_id: '' });
                            setNewPersonnelTarget(null);
                          } catch (err) {
                            console.error(err);
                            showAlert("Error al agregar responsable");
                          }
                        }}
                        className="w-full bg-[#141414] text-[#E4E3E0] p-2 text-xs font-bold uppercase"
                      >
                        Guardar Responsable
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'work-orders' && (
          <div className="space-y-8">
            <header className="flex justify-between items-end">
              <div>
                <p className="text-xs uppercase tracking-widest opacity-50 font-mono">Gestión Operativa</p>
                <h2 className="text-4xl font-serif italic">Ordenes de Trabajo</h2>
              </div>
            </header>

            <div className="border border-[#141414] bg-white overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest">
                    <th className="p-4 font-medium">ID</th>
                    <th className="p-4 font-medium">Máquina</th>
                    <th className="p-4 font-medium">Descripción</th>
                    <th className="p-4 font-medium">Tipo</th>
                    <th className="p-4 font-medium">Estado</th>
                    <th className="p-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {workOrders.map((wo) => (
                    <tr key={wo.id} className="border-b border-[#141414] hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-mono">#{wo.id}</td>
                      <td className="p-4">
                        <div className="font-bold">{wo.machine_name}</div>
                        {wo.part_name && <div className="text-[10px] opacity-50 uppercase">{wo.part_name}</div>}
                      </td>
                      <td className="p-4">
                        <div>{wo.description}</div>
                        {wo.diagnostic_notes && <div className="text-[10px] text-blue-600 mt-1 italic">Diagnóstico: {wo.diagnostic_notes}</div>}
                        {wo.root_cause && <div className="text-[10px] text-red-600 mt-1 italic font-bold">Causa Raíz: {wo.root_cause}</div>}
                        {wo.activities && wo.activities.length > 0 && (
                          <div className="mt-2">
                            <div className="text-[10px] uppercase font-bold opacity-70 mb-1">
                              Actividades: {wo.activities.filter(a => a.is_completed).length} / {wo.activities.length} completadas
                            </div>
                            <ul className="space-y-1">
                              {wo.activities.map((a: any, idx: number) => (
                                <li key={a.id} className="flex items-center space-x-2 text-xs">
                                  <input 
                                    type="checkbox" 
                                    checked={a.is_completed} 
                                    onChange={(e) => {
                                      if (wo.status === 'in_progress') {
                                        toggleActivityCompletion(wo, idx, e.target.checked);
                                      }
                                    }}
                                    disabled={wo.status !== 'in_progress'}
                                    className="w-3 h-3 accent-[#141414]"
                                  />
                                  <span className={cn(a.is_completed && "line-through opacity-50")}>
                                    {a.description}
                                  </span>
                                  {a.personnel_id && (
                                    <span className="text-[9px] bg-gray-200 px-1 rounded">
                                      {personnel.find(p => p.id === a.personnel_id)?.name}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] uppercase font-bold opacity-50">{wo.type}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          {wo.status === 'open' && <Clock className="w-3 h-3 text-amber-500" />}
                          {wo.status === 'in_progress' && <Play className="w-3 h-3 text-blue-500 animate-pulse" />}
                          {wo.status === 'closed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                          <span className="capitalize">{wo.status.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-4">
                          {wo.status === 'open' && (
                            <button 
                              onClick={() => startWorkOrder(wo.id)}
                              className="flex items-center space-x-1 text-xs font-bold uppercase hover:underline"
                            >
                              <Play className="w-3 h-3" /> <span>Iniciar</span>
                            </button>
                          )}
                          {wo.status === 'in_progress' && (
                            <button 
                              onClick={() => closeWorkOrder(wo.id)}
                              className="flex items-center space-x-1 text-xs font-bold uppercase hover:underline text-red-600"
                            >
                              <Square className="w-3 h-3" /> <span>Finalizar</span>
                            </button>
                          )}
                          {wo.status === 'closed' && (
                            <span className="text-[10px] font-mono opacity-50">{wo.duration_minutes} min</span>
                          )}
                          <button 
                            onClick={() => {
                              setEditingWO(wo);
                              setShowEditWOModal(true);
                            }}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="Editar OT"
                          >
                            <Settings className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => deleteWorkOrder(wo.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Eliminar OT"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-8">
            <header className="flex justify-between items-end">
              <div>
                <p className="text-xs uppercase tracking-widest opacity-50 font-mono">Logística</p>
                <h2 className="text-4xl font-serif italic">Consumibles y Repuestos</h2>
              </div>
              <div className="flex space-x-4">
                <button 
                  onClick={() => setShowPOModal(true)}
                  className="bg-white text-[#141414] border border-[#141414] px-6 py-2 text-sm font-bold uppercase flex items-center shadow-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" /> Orden de Compra
                </button>
                <button 
                  onClick={() => setShowInventoryModal(true)}
                  className="bg-[#141414] text-[#E4E3E0] px-6 py-2 text-sm font-bold uppercase flex items-center shadow-lg hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" /> Gestionar Inventario
                </button>
              </div>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Inventory Table */}
                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-sm font-serif italic mb-4">Stock Actual</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#141414] uppercase text-[10px] opacity-50">
                        <tr>
                          <th className="py-2">Artículo</th>
                          <th className="py-2">Stock</th>
                          <th className="py-2">Mínimo</th>
                          <th className="py-2">Precio Unit.</th>
                          <th className="py-2">Tiempo en Planta</th>
                          <th className="py-2 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {inventory.map(item => (
                          <tr key={item.id} className={cn(item.stock_level <= item.min_stock && "bg-amber-50/50")}>
                            <td className="py-3 font-bold">{item.part_name}</td>
                            <td className="py-3 font-mono">{item.stock_level}</td>
                            <td className="py-3 font-mono opacity-50">{item.min_stock}</td>
                            <td className="py-3 font-mono">{formatCurrency(item.unit_price)}</td>
                            <td className="py-3 text-[10px] opacity-60">
                              {item.entry_date ? formatDistanceToNow(parseLocalDate(item.entry_date), { locale: es, addSuffix: false }) : '-'}
                            </td>
                            <td className="py-3 text-right">
                              <button 
                                onClick={() => deleteInventoryItem(item.id)}
                                className="text-gray-400 hover:text-red-600 p-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Purchase Orders Table */}
                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-sm font-serif italic mb-4">Historial de Ordenes de Compra</h4>
                  <div className="space-y-4">
                    {purchaseOrders.length === 0 ? (
                      <p className="text-xs italic opacity-50">No hay ordenes de compra registradas.</p>
                    ) : (
                      purchaseOrders.map(po => (
                        <div key={po.id} className="border border-[#141414] p-4">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="text-xs font-bold uppercase">OC #{po.id} - {po.supplier_name}</p>
                              {po.description && (
                                <p className="text-xs italic opacity-70 mt-1">{po.description}</p>
                              )}
                              <p className="text-[10px] opacity-50">Creada: {format(new Date(po.created_at), 'dd/MM/yyyy HH:mm')}</p>
                              {po.scheduled_date && (
                                <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">
                                  Programada: {format(parseLocalDate(po.scheduled_date), 'dd/MM/yyyy')}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <div className="flex space-x-2 mb-2">
                                {po.status === 'pending' && (
                                  <>
                                    <button 
                                      onClick={() => {
                                        setEditingPOId(po.id);
                                        setNewPO({
                                          supplier_id: po.supplier_id.toString(),
                                          scheduled_date: po.scheduled_date ? format(parseLocalDate(po.scheduled_date), 'yyyy-MM-dd') : '',
                                          description: po.description || '',
                                          items: po.items.map(i => ({
                                            inventory_id: i.inventory_id,
                                            quantity: i.quantity,
                                            unit_price: i.unit_price,
                                            description: i.description || ''
                                          }))
                                        });
                                        setShowPOModal(true);
                                      }}
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                      title="Editar"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={() => deletePurchaseOrder(po.id)}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                              <span className={cn(
                                "text-[10px] font-bold uppercase px-2 py-0.5 border",
                                po.status === 'received' ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"
                              )}>
                                {po.status === 'received' ? 'Recibido' : 'Pendiente'}
                              </span>
                              <p className="text-xs font-mono mt-1">{formatCurrency(po.total_amount)}</p>
                            </div>
                          </div>
                          <div className="space-y-1 mb-4">
                            {po.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-[10px] opacity-70">
                                <span>{item.part_name} x {item.quantity}</span>
                                <span>{formatCurrency(item.quantity * item.unit_price)}</span>
                              </div>
                            ))}
                          </div>
                          {po.status === 'pending' && (
                            <button 
                              onClick={() => receivePurchaseOrder(po.id)}
                              className="w-full py-2 text-[10px] font-bold uppercase bg-[#141414] text-[#E4E3E0] hover:bg-gray-800 transition-colors"
                            >
                              Confirmar Recepción (Actualizar Stock)
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-sm font-serif italic mb-4">Alertas de Stock</h4>
                  <div className="space-y-4">
                    {inventory.filter(item => item.stock_level <= item.min_stock).length === 0 ? (
                      <p className="text-xs italic opacity-50">No hay alertas de stock en este momento.</p>
                    ) : (
                      inventory.filter(item => item.stock_level <= item.min_stock).map(item => (
                        <div key={item.id} className={cn(
                          "flex items-center justify-between p-3 border group",
                          item.stock_level === 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                        )}>
                          <div className="flex items-center">
                            <AlertTriangle className={cn(
                              "w-4 h-4 mr-2",
                              item.stock_level === 0 ? "text-red-500" : "text-amber-500"
                            )} />
                            <span className="text-xs font-bold">{item.part_name}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-mono">{item.stock_level}/{item.min_stock}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-sm font-serif italic mb-4">Resumen de Inventario</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-xs uppercase font-mono opacity-50">Valor Total</span>
                      <span className="text-2xl font-mono">
                        {formatCurrency(inventory.reduce((sum, item) => sum + (item.stock_level * item.unit_price), 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-xs uppercase font-mono opacity-50">Artículos Críticos</span>
                      <span className="text-2xl font-mono text-red-600">
                        {inventory.filter(item => item.stock_level <= item.min_stock).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kpis' && (
          <div className="space-y-8">
            <header>
              <p className="text-xs uppercase tracking-widest opacity-50 font-mono">Análisis de Rendimiento</p>
              <h2 className="text-4xl font-serif italic">Indicadores Clave (KPI)</h2>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Operaciones */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase border-b border-[#141414] pb-2">Operaciones</h3>
                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-[10px] uppercase opacity-50 mb-4 tracking-widest">MTTR (Mean Time To Repair)</h4>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-5xl font-mono">{kpis?.mttr.toFixed(1) || '0.0'}</span>
                    <span className="text-xs font-serif italic">minutos</span>
                  </div>
                </div>
                
                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-[10px] uppercase opacity-50 mb-4 tracking-widest">Cumplimiento Preventivo</h4>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-5xl font-mono">{Math.round(kpis?.compliance || 0)}</span>
                    <span className="text-xs font-serif italic">%</span>
                  </div>
                  <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#141414]" style={{ width: `${kpis?.compliance || 0}%` }} />
                  </div>
                </div>
              </div>

              {/* Finanzas */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase border-b border-[#141414] pb-2">Finanzas</h3>
                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-[10px] uppercase opacity-50 mb-4 tracking-widest">Costo Total Mantenimiento</h4>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-5xl font-mono">{formatCurrency(kpis?.finance?.totalCost || 0)}</span>
                  </div>
                </div>

                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-[10px] uppercase opacity-50 mb-4 tracking-widest">Valor de Inventario</h4>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-mono">{formatCurrency(inventory.reduce((sum, item) => sum + (item.stock_level * item.unit_price), 0))}</span>
                  </div>
                </div>
                
                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-[10px] uppercase opacity-50 mb-4 tracking-widest">Costo Promedio por OT</h4>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-mono">{formatCurrency(kpis?.finance?.totalCost / (kpis?.totalOrders || 1))}</span>
                  </div>
                </div>
              </div>

              {/* Recursos Humanos */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase border-b border-[#141414] pb-2">Recursos Humanos</h3>
                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-[10px] uppercase opacity-50 mb-4 tracking-widest">Carga de Trabajo (Tareas)</h4>
                  <div className="space-y-3 mt-4">
                    {kpis?.hr?.personnelWorkload.map((p: any) => (
                      <div key={p.name} className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span>{p.name}</span>
                          <span className="font-mono">{p.tasks} tareas</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1">
                          <div 
                            className="bg-[#141414] h-full" 
                            style={{ width: `${(p.tasks / (kpis?.totalOrders || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 border border-[#141414] bg-white">
                  <h4 className="text-[10px] uppercase opacity-50 mb-4 tracking-widest">Eficiencia (Min/Tarea)</h4>
                  <div className="space-y-2 mt-4">
                    {kpis?.hr?.personnelWorkload.map((p: any) => (
                      <div key={p.name} className="flex justify-between text-xs">
                        <span className="opacity-60">{p.name}</span>
                        <span className="font-mono">{p.tasks > 0 ? (p.total_minutes / p.tasks).toFixed(1) : '0'} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico de Costos */}
            <div className="p-8 border border-[#141414] bg-white">
              <h4 className="text-xs uppercase opacity-50 mb-8 tracking-widest">Evolución de Costos Operativos</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[
                    { m: 'Ene', c: 1200 },
                    { m: 'Feb', c: 1500 },
                    { m: 'Mar', c: 1100 },
                    { m: 'Abr', c: 1800 },
                    { m: 'May', c: 1400 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="m" stroke="#141414" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#141414" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="stepAfter" dataKey="c" stroke="#141414" strokeWidth={2} dot={true} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manufacturer-specs' && (
          <div className="space-y-8">
            <header className="flex justify-between items-end">
              <div>
                <p className="text-xs uppercase tracking-widest opacity-50 font-mono">Manuales y Recomendaciones</p>
                <h2 className="text-4xl font-serif italic">Especificaciones del Fabricante</h2>
              </div>
              <button 
                onClick={() => setShowAddRecommendationModal(true)}
                className="bg-[#141414] text-[#E4E3E0] px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" /> Añadir Especificación
              </button>
            </header>

            <div className="grid grid-cols-1 gap-8">
              {machines.map(machine => {
                const machineRecs = manufacturerRecommendations.filter(r => r.machine_id === machine.id);
                if (machineRecs.length === 0) return null;

                return (
                  <div key={machine.id} className="bg-white border border-[#141414] p-8">
                    <div className="flex justify-between items-start mb-8 border-b border-[#141414] pb-4">
                      <div>
                        <h3 className="text-2xl font-serif italic">{machine.name}</h3>
                        <p className="text-[10px] font-mono uppercase opacity-50 mt-1">{machine.type}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                      {['maintenance', 'spare_part', 'lubricant', 'consumable'].map(type => {
                        const typeRecs = machineRecs.filter(r => r.type === type);
                        const labels: any = {
                          maintenance: 'Mantenimiento',
                          spare_part: 'Repuestos',
                          lubricant: 'Lubricantes',
                          consumable: 'Consumibles'
                        };

                        return (
                          <div key={type} className="space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center">
                              <span className="w-2 h-2 bg-[#141414] mr-2" />
                              {labels[type]}
                            </h4>
                            <div className="space-y-3">
                              {typeRecs.length === 0 ? (
                                <p className="text-[10px] italic opacity-30">Sin recomendaciones</p>
                              ) : (
                                typeRecs.map(rec => (
                                  <div key={rec.id} className="group relative p-3 bg-gray-50 border border-transparent hover:border-[#141414] transition-all">
                                    <div className="flex justify-between items-start">
                                      <p className="text-xs font-bold uppercase leading-tight">{rec.item_name}</p>
                                      <button 
                                        onClick={() => deleteManufacturerRecommendation(rec.id)}
                                        className="opacity-0 group-hover:opacity-100 text-red-600 transition-opacity"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    {rec.specification && <p className="text-[10px] opacity-60 mt-1">{rec.specification}</p>}
                                    {rec.part_number && <p className="text-[9px] font-mono mt-1 bg-white px-1 inline-block border border-gray-200">PN: {rec.part_number}</p>}
                                    {(rec.frequency_hours || rec.frequency_days) && (
                                      <div className="flex items-center mt-2 text-[9px] font-bold uppercase text-emerald-700">
                                        <Clock className="w-3 h-3 mr-1" />
                                        Cada {rec.frequency_hours ? `${rec.frequency_hours}h` : `${rec.frequency_days}d`}
                                      </div>
                                    )}
                                    {rec.description && <p className="text-[9px] italic mt-2 border-t border-gray-200 pt-1 opacity-50">{rec.description}</p>}
                                    <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                                      {rec.document_url ? (
                                        <a 
                                          href={rec.document_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-[9px] font-bold uppercase text-blue-600 hover:underline flex items-center"
                                        >
                                          <Book className="w-3 h-3 mr-1" /> Ver Doc
                                        </a>
                                      ) : (
                                        <span className="text-[9px] italic opacity-40">Sin doc.</span>
                                      )}
                                      <label className="cursor-pointer text-[9px] font-bold uppercase border border-[#141414] px-2 py-1 hover:bg-gray-100">
                                        Subir
                                        <input 
                                          type="file" 
                                          accept=".pdf,.doc,.docx,image/*"
                                          className="hidden" 
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              if (file.size > MAX_FILE_SIZE) {
                                                showAlert("El archivo es demasiado grande. El tamaño máximo permitido es 10MB.");
                                                return;
                                              }
                                              const reader = new FileReader();
                                              reader.onloadend = async () => {
                                                const base64String = reader.result as string;
                                                try {
                                                  const res = await fetch(`/api/manufacturer-recommendations/${rec.id}`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ document_url: base64String })
                                                  });
                                                  if (!res.ok) {
                                                    if (res.status === 413) {
                                                      throw new Error("El archivo es demasiado grande para ser procesado por el servidor.");
                                                    }
                                                    throw new Error(`Error HTTP: ${res.status}`);
                                                  }
                                                  fetchData();
                                                } catch (err: any) {
                                                  console.error(err);
                                                  showAlert(`Error al subir el documento: ${err.message}`);
                                                }
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }} 
                                        />
                                      </label>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {machines.filter(m => !manufacturerRecommendations.some(r => r.machine_id === m.id)).length > 0 && (
                <div className="p-12 border border-dashed border-[#141414]/30 text-center">
                  <p className="text-sm italic opacity-50">Otras máquinas sin especificaciones cargadas aún.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Company Modal */}
        {showAddCompanyModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-[70]">
            <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-sm p-6 max-h-[80vh] flex flex-col">
              <h3 className="text-xl font-serif italic mb-4">Gestionar Empresas</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex space-x-2">
                  <input 
                    placeholder="Nueva empresa" 
                    className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                    value={newCompany.name}
                    onChange={e => setNewCompany({ name: e.target.value })}
                  />
                  <button 
                    onClick={addCompany}
                    className="px-4 py-2 text-xs font-bold uppercase bg-[#141414] text-[#E4E3E0]"
                  >
                    Añadir
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border-t border-[#141414] pt-4">
                <p className="text-[10px] font-bold uppercase opacity-50 mb-2">Empresas Registradas</p>
                <div className="space-y-2">
                  {companies.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-white border border-[#141414]/10">
                      <span className="text-sm">{c.name}</span>
                      <button 
                        onClick={() => deleteCompany(c.id)}
                        className="text-red-600 hover:bg-red-50 p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setShowAddCompanyModal(false)}
                className="w-full mt-6 py-2 text-xs font-bold uppercase border border-[#141414]"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Add Personnel Modal */}
        {showAddPersonnelModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-[60]">
            <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-sm p-6 max-h-[80vh] flex flex-col">
              <h3 className="text-xl font-serif italic mb-4">Gestionar Responsables</h3>
              
              <div className="space-y-4 mb-6">
                <input 
                  placeholder="Nombre completo" 
                  className="w-full p-2 border border-[#141414] bg-white text-sm"
                  value={newPersonnel.name}
                  onChange={e => setNewPersonnel({ ...newPersonnel, name: e.target.value })}
                />
                <div className="flex space-x-1">
                  <select 
                    className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                    value={newPersonnel.company_id}
                    onChange={e => setNewPersonnel({ ...newPersonnel, company_id: e.target.value })}
                  >
                    <option value="">Seleccionar Empresa...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => setShowAddCompanyModal(true)}
                    className="p-2 border border-[#141414] bg-white hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={addPersonnel}
                  className="w-full py-2 text-xs font-bold uppercase bg-[#141414] text-[#E4E3E0]"
                >
                  Añadir Responsable
                </button>
              </div>

              <div className="flex-1 overflow-y-auto border-t border-[#141414] pt-4">
                <p className="text-[10px] font-bold uppercase opacity-50 mb-2">Personal Registrado</p>
                <div className="space-y-2">
                  {personnel.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-white border border-[#141414]/10">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-[10px] opacity-50">{p.company_name}</p>
                      </div>
                      <button 
                        onClick={() => deletePersonnel(p.id)}
                        className="text-red-600 hover:bg-red-50 p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setShowAddPersonnelModal(false)}
                className="w-full mt-6 py-2 text-xs font-bold uppercase border border-[#141414]"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Task Details Modal */}
        {showTaskDetailsModal && selectedTask && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-[100]">
            <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-50">{selectedTask.machine_name}</p>
                  <h3 className="text-2xl font-serif italic">{selectedTask.task_name}</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowTaskDetailsModal(false);
                    setIsEditingTask(false);
                  }} 
                  className="text-xs font-bold uppercase hover:underline"
                >
                  Cerrar
                </button>
              </div>
              
              <div className="space-y-6">
                {!isEditingTask ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase opacity-50 mb-1">Responsable</p>
                        <p className="text-sm font-medium">{selectedTask.personnel_name || 'No asignado'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase opacity-50 mb-1">Empresa</p>
                        <p className="text-sm font-medium">{selectedTask.company_name || '-'}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase opacity-50 mb-1">Frecuencia</p>
                      <p className="text-sm">
                        {selectedTask.frequency_hours ? `${selectedTask.frequency_hours} Horas` : `${selectedTask.frequency_days} Días`}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase opacity-50 mb-1">Descripción del Trabajo</p>
                      <p className="text-sm bg-white/50 p-3 border border-[#141414]/10 italic">
                        {selectedTask.description || 'Sin descripción detallada.'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase opacity-50 mb-1">Repuestos / Elementos Requeridos</p>
                      <div className="text-sm bg-white p-3 border border-[#141414]">
                        {selectedTask.required_items ? (
                          <ul className="list-disc list-inside space-y-1">
                            {selectedTask.required_items.split(',').map((item, i) => (
                              <li key={i}>{item.trim()}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="opacity-50 italic">No se especificaron elementos.</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase opacity-50 block mb-1">Nombre de la Tarea</label>
                      <input 
                        className="w-full p-2 border border-[#141414] bg-white text-sm"
                        value={editedTask?.task_name || ''}
                        onChange={e => setEditedTask(prev => prev ? {...prev, task_name: e.target.value} : null)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase opacity-50 block mb-1">Descripción</label>
                      <textarea 
                        className="w-full p-2 border border-[#141414] bg-white text-sm h-24"
                        value={editedTask?.description || ''}
                        onChange={e => setEditedTask(prev => prev ? {...prev, description: e.target.value} : null)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase opacity-50 block mb-1">Repuestos (separados por coma)</label>
                      <input 
                        className="w-full p-2 border border-[#141414] bg-white text-sm"
                        value={editedTask?.required_items || ''}
                        onChange={e => setEditedTask(prev => prev ? {...prev, required_items: e.target.value} : null)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase opacity-50 block mb-1">Frecuencia (Días)</label>
                        <input 
                          type="number"
                          className="w-full p-2 border border-[#141414] bg-white text-sm"
                          value={editedTask?.frequency_days || ''}
                          onChange={e => setEditedTask(prev => prev ? {...prev, frequency_days: e.target.value ? Number(e.target.value) : null, frequency_hours: null} : null)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase opacity-50 block mb-1">Frecuencia (Horas)</label>
                        <input 
                          type="number"
                          className="w-full p-2 border border-[#141414] bg-white text-sm"
                          value={editedTask?.frequency_hours || ''}
                          onChange={e => setEditedTask(prev => prev ? {...prev, frequency_hours: e.target.value ? Number(e.target.value) : null, frequency_days: null} : null)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-50">Actividades</label>
                      {(editedTask?.activities || []).map((activity, idx) => (
                        <div key={activity.id || idx} className="flex items-center space-x-2">
                          <input 
                            type="text"
                            className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                            placeholder={`Actividad ${idx + 1}`}
                            value={activity.description}
                            onChange={e => {
                              if (!editedTask) return;
                              const updated = [...(editedTask.activities || [])];
                              updated[idx].description = e.target.value;
                              setEditedTask({ ...editedTask, activities: updated });
                            }}
                          />
                          <button 
                            onClick={() => {
                              if (!editedTask) return;
                              const updated = (editedTask.activities || []).filter((_, i) => i !== idx);
                              setEditedTask({ ...editedTask, activities: updated });
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          if (!editedTask) return;
                          setEditedTask({ ...editedTask, activities: [...(editedTask.activities || []), { id: Date.now(), description: '', is_completed: false }] });
                        }}
                        className="text-xs font-bold uppercase border border-[#141414] px-3 py-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                      >
                        + Agregar Actividad
                      </button>
                    </div>

                  </div>
                )}

                <div className="flex flex-col space-y-2">
                  {!isEditingTask ? (
                    <button 
                      onClick={() => {
                        setEditedTask(selectedTask);
                        setIsEditingTask(true);
                      }}
                      className="w-full py-2 border border-[#141414] text-xs font-bold uppercase hover:bg-gray-100"
                    >
                      Editar Tarea
                    </button>
                  ) : (
                    <button 
                      onClick={() => editedTask && updateSchedule(editedTask)}
                      className="w-full py-2 bg-emerald-600 text-white text-xs font-bold uppercase hover:bg-emerald-700"
                    >
                      Guardar Cambios
                    </button>
                  )}
                  
                  <div className="flex space-x-2">
                    <button 
                      onClick={async () => {
                        await createWorkOrderDirectly(isEditingTask && editedTask ? editedTask : selectedTask);
                        setShowTaskDetailsModal(false);
                        setIsEditingTask(false);
                      }}
                      className="flex-1 py-3 bg-[#141414] text-[#E4E3E0] text-sm font-bold uppercase shadow-lg"
                    >
                      Generar Orden de Trabajo
                    </button>
                    <button 
                      onClick={() => {
                        deleteSchedule(selectedTask.id);
                        setShowTaskDetailsModal(false);
                        setIsEditingTask(false);
                      }}
                      className="px-4 py-3 border border-red-600 text-red-600 hover:bg-red-50 transition-colors"
                      title="Eliminar Programación"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Start WO Modal */}
        {showStartWOModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-[150]">
            <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-serif italic mb-6">Iniciar Orden de Trabajo</h3>
              <div className="space-y-4">
                {!showAddPersonnelInWO ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold uppercase opacity-50">Asignar Responsable / Técnico</label>
                        <button 
                          onClick={() => {
                            setNewPersonnelTarget({ type: 'main' });
                            setShowAddPersonnelInWO(true);
                          }}
                          className="text-[9px] uppercase font-bold text-blue-600 hover:underline"
                        >
                          + Nuevo Responsable
                        </button>
                      </div>
                      <select 
                        className="w-full p-2 border border-[#141414] bg-white text-sm"
                        value={startWOPersonnelId}
                        onChange={e => setStartWOPersonnelId(e.target.value)}
                      >
                        <option value="">Seleccionar Responsable...</option>
                        {personnel.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({companies.find(c => c.id === p.company_id)?.name || 'Sin Empresa'})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50">Notas de Diagnóstico / Inicio</label>
                      <textarea 
                        className="w-full p-2 border border-[#141414] bg-white text-sm h-24"
                        placeholder="Describa el estado inicial o diagnóstico..."
                        value={startWODiagnostic}
                        onChange={e => setStartWODiagnostic(e.target.value)}
                      />
                    </div>

                    {woToStart && startWOActivities.length > 0 && (
                      <div className="space-y-1 mt-4">
                        <label className="text-[10px] font-bold uppercase opacity-50">Actividades Programadas</label>
                        <div className="space-y-2">
                          {startWOActivities.map((a, idx) => (
                            <div key={a.id} className="flex flex-col space-y-1 p-2 border border-[#141414] bg-white">
                              <div className="flex items-center space-x-2 text-xs">
                                <span className="w-1.5 h-1.5 bg-[#141414] rounded-full"></span>
                                <span>{a.description}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <select
                                  className="flex-1 p-2 border border-[#141414] bg-gray-50 text-xs"
                                  value={a.personnel_id || ''}
                                  onChange={e => {
                                    const updated = [...startWOActivities];
                                    updated[idx].personnel_id = e.target.value ? Number(e.target.value) : null;
                                    setStartWOActivities(updated);
                                  }}
                                >
                                  <option value="">Sin responsable asignado...</option>
                                  {personnel.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                                <button 
                                  onClick={() => {
                                    setNewPersonnelTarget({ type: 'activity', index: idx });
                                    setShowAddPersonnelInWO(true);
                                  }}
                                  className="text-[10px] uppercase font-bold border border-[#141414] px-2 py-2 hover:bg-[#141414] hover:text-white transition-colors whitespace-nowrap"
                                >
                                  + Nuevo
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 border border-[#141414] bg-white space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold uppercase">Nuevo Responsable</h4>
                      <button 
                        onClick={() => setShowAddPersonnelInWO(false)}
                        className="text-[9px] uppercase font-bold opacity-50 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50">Nombre Completo</label>
                      <input 
                        placeholder="Ej: Juan Pérez"
                        className="w-full p-2 border border-[#141414] bg-white text-sm"
                        value={newPersonnelInWO.name}
                        onChange={e => setNewPersonnelInWO({ ...newPersonnelInWO, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold uppercase opacity-50">Empresa</label>
                        <button 
                          onClick={() => setShowAddCompanyInWO(!showAddCompanyInWO)}
                          className="text-[9px] uppercase font-bold text-blue-600 hover:underline"
                        >
                          {showAddCompanyInWO ? '← Seleccionar' : '+ Nueva Empresa'}
                        </button>
                      </div>
                      
                      {showAddCompanyInWO ? (
                        <div className="flex space-x-2">
                          <input 
                            placeholder="Nombre de la empresa"
                            className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                            value={newCompanyInWO.name}
                            onChange={e => setNewCompanyInWO({ name: e.target.value })}
                          />
                        </div>
                      ) : (
                        <select 
                          className="w-full p-2 border border-[#141414] bg-white text-sm"
                          value={newPersonnelInWO.company_id}
                          onChange={e => setNewPersonnelInWO({ ...newPersonnelInWO, company_id: e.target.value })}
                        >
                          <option value="">Seleccionar Empresa...</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <button 
                      onClick={async () => {
                        if (!newPersonnelInWO.name) return;
                        let companyId = newPersonnelInWO.company_id;
                        
                        try {
                          if (showAddCompanyInWO && newCompanyInWO.name) {
                            const cRes = await fetch('/api/companies', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(newCompanyInWO)
                            });
                            if (cRes.ok) {
                              const cData = await cRes.json();
                              companyId = cData.id.toString();
                            }
                          }
                          
                          const pRes = await fetch('/api/personnel', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: newPersonnelInWO.name, company_id: companyId })
                          });
                          
                          if (pRes.ok) {
                            const pData = await pRes.json();
                            await fetchData();
                            
                            if (newPersonnelTarget?.type === 'main') {
                              setStartWOPersonnelId(pData.id.toString());
                            } else if (newPersonnelTarget?.type === 'activity' && newPersonnelTarget.index !== undefined) {
                              const updated = [...startWOActivities];
                              updated[newPersonnelTarget.index].personnel_id = pData.id;
                              setStartWOActivities(updated);
                            }
                            
                            setShowAddPersonnelInWO(false);
                            setNewPersonnelInWO({ name: '', company_id: '' });
                            setShowAddCompanyInWO(false);
                            setNewCompanyInWO({ name: '' });
                            setNewPersonnelTarget(null);
                          }
                        } catch (err) { console.error(err); }
                      }}
                      className="w-full py-2 text-xs font-bold uppercase bg-[#141414] text-[#E4E3E0]"
                    >
                      Guardar y Seleccionar
                    </button>
                  </div>
                )}

                <div className="flex space-x-4 pt-4">
                  <button 
                    onClick={() => setShowStartWOModal(false)}
                    className="flex-1 py-3 border border-[#141414] text-xs font-bold uppercase"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmStartWorkOrder}
                    disabled={!startWOPersonnelId}
                    className="flex-1 py-3 bg-[#141414] text-[#E4E3E0] text-xs font-bold uppercase disabled:opacity-30"
                  >
                    Iniciar Trabajo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Work Order Modal */}
        {showEditWOModal && editingWO && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-[150]">
            <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-serif italic mb-6">Editar Orden de Trabajo</h3>
              <div className="space-y-4">
                {!showAddPersonnelInWO ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-50">Descripción</label>
                  <div className="flex gap-2">
                    <textarea 
                      className="flex-1 p-2 border border-[#141414] bg-white text-sm h-24"
                      value={editingWO.description}
                      onChange={e => setEditingWO({ ...editingWO, description: e.target.value })}
                    />
                    <button 
                      onClick={() => { setTechnicalNameTarget({ type: 'wo', field: 'description' }); setShowTechnicalNameModal(true); }}
                      className="border border-[#141414] px-2 hover:bg-gray-100 h-24"
                    >
                      <Book className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-50">Notas de Diagnóstico</label>
                  <div className="flex gap-2">
                    <textarea 
                      className="flex-1 p-2 border border-[#141414] bg-white text-sm h-24"
                      value={editingWO.diagnostic_notes || ''}
                      onChange={e => setEditingWO({ ...editingWO, diagnostic_notes: e.target.value })}
                    />
                    <button 
                      onClick={() => { setTechnicalNameTarget({ type: 'wo', field: 'diagnostic_notes' }); setShowTechnicalNameModal(true); }}
                      className="border border-[#141414] px-2 hover:bg-gray-100 h-24"
                    >
                      <Book className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-50">Análisis de Causa Raíz</label>
                  <textarea 
                    className="w-full p-2 border border-[#141414] bg-white text-sm h-24"
                    value={editingWO.root_cause || ''}
                    onChange={e => setEditingWO({ ...editingWO, root_cause: e.target.value })}
                  />
                </div>

                {editingWO.activities && editingWO.activities.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Actividades</label>
                    <div className="space-y-2">
                      {editingWO.activities.map((activity: any, idx: number) => (
                        <div key={activity.id || idx} className="flex flex-col space-y-2 p-2 border border-[#141414] bg-white">
                          <div className="flex items-center space-x-3">
                            <input 
                              type="checkbox"
                              checked={activity.is_completed}
                              onChange={e => {
                                const updated = [...editingWO.activities];
                                updated[idx].is_completed = e.target.checked;
                                setEditingWO({ ...editingWO, activities: updated });
                              }}
                              className="w-4 h-4 accent-[#141414]"
                            />
                            <span className={cn("text-sm flex-1", activity.is_completed && "line-through opacity-50")}>
                              {activity.description}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <select
                              className="flex-1 p-2 border border-[#141414] bg-gray-50 text-xs"
                              value={activity.personnel_id || ''}
                              onChange={e => {
                                const updated = [...editingWO.activities];
                                updated[idx].personnel_id = e.target.value ? Number(e.target.value) : null;
                                setEditingWO({ ...editingWO, activities: updated });
                              }}
                            >
                              <option value="">Sin responsable asignado...</option>
                              {personnel.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            <button 
                              onClick={() => {
                                setNewPersonnelTarget({ type: 'activity', index: idx });
                                setShowAddPersonnelInWO(true);
                              }}
                              className="text-[10px] uppercase font-bold border border-[#141414] px-2 py-2 hover:bg-[#141414] hover:text-white transition-colors whitespace-nowrap"
                            >
                              + Nuevo
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-4 pt-4">
                  <button 
                    onClick={() => setShowEditWOModal(false)}
                    className="flex-1 py-3 border border-[#141414] text-xs font-bold uppercase"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => updateWorkOrder(editingWO)}
                    className="flex-1 py-3 bg-emerald-600 text-white text-xs font-bold uppercase"
                  >
                    Guardar Cambios
                  </button>
                </div>
                  </div>
                ) : (
                  <div className="p-4 border border-[#141414] bg-white space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold uppercase">Nuevo Responsable</h4>
                      <button 
                        onClick={() => setShowAddPersonnelInWO(false)}
                        className="text-[9px] uppercase font-bold opacity-50 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50">Nombre Completo</label>
                      <input 
                        placeholder="Ej: Juan Pérez"
                        className="w-full p-2 border border-[#141414] bg-white text-sm"
                        value={newPersonnelInWO.name}
                        onChange={e => setNewPersonnelInWO({ ...newPersonnelInWO, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold uppercase opacity-50">Empresa</label>
                        <button 
                          onClick={() => setShowAddCompanyInWO(!showAddCompanyInWO)}
                          className="text-[9px] uppercase font-bold text-blue-600 hover:underline"
                        >
                          {showAddCompanyInWO ? '← Seleccionar' : '+ Nueva Empresa'}
                        </button>
                      </div>
                      
                      {showAddCompanyInWO ? (
                        <div className="flex space-x-2">
                          <input 
                            placeholder="Nombre de la empresa"
                            className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                            value={newCompanyInWO.name}
                            onChange={e => setNewCompanyInWO({ name: e.target.value })}
                          />
                        </div>
                      ) : (
                        <select 
                          className="w-full p-2 border border-[#141414] bg-white text-sm"
                          value={newPersonnelInWO.company_id}
                          onChange={e => setNewPersonnelInWO({ ...newPersonnelInWO, company_id: e.target.value })}
                        >
                          <option value="">Seleccionar Empresa...</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <button 
                      onClick={async () => {
                        if (!newPersonnelInWO.name) return;
                        let companyId = newPersonnelInWO.company_id;
                        
                        try {
                          if (showAddCompanyInWO && newCompanyInWO.name) {
                            const cRes = await fetch('/api/companies', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(newCompanyInWO)
                            });
                            if (cRes.ok) {
                              const cData = await cRes.json();
                              companyId = cData.id.toString();
                            }
                          }
                          
                          const pRes = await fetch('/api/personnel', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: newPersonnelInWO.name, company_id: companyId })
                          });
                          
                          if (pRes.ok) {
                            const pData = await pRes.json();
                            await fetchData();
                            
                            if (newPersonnelTarget?.type === 'activity' && newPersonnelTarget.index !== undefined) {
                              const updated = [...editingWO.activities];
                              updated[newPersonnelTarget.index].personnel_id = pData.id;
                              setEditingWO({ ...editingWO, activities: updated });
                            }
                            
                            setShowAddPersonnelInWO(false);
                            setNewPersonnelInWO({ name: '', company_id: '' });
                            setShowAddCompanyInWO(false);
                            setNewCompanyInWO({ name: '' });
                            setNewPersonnelTarget(null);
                          }
                        } catch (err) { console.error(err); }
                      }}
                      className="w-full py-2 text-xs font-bold uppercase bg-[#141414] text-[#E4E3E0]"
                    >
                      Guardar y Seleccionar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Inventory Management Modal */}
        {showInventoryModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-[60]">
            <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
              <h3 className="text-2xl font-serif italic mb-6">Gestión de Inventario</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-6 p-4 border border-[#141414]/10 bg-white/50">
                <div className="md:col-span-2">
                  <label className="text-[9px] uppercase opacity-50 block mb-1">Nombre</label>
                  <div className="flex gap-2">
                    <input 
                      placeholder="Nombre del repuesto" 
                      className="flex-1 p-2 border border-[#141414] bg-white text-sm"
                      value={newInventoryItem.part_name}
                      onChange={e => setNewInventoryItem({ ...newInventoryItem, part_name: e.target.value })}
                    />
                    <button 
                      onClick={() => { setTechnicalNameTarget({ type: 'inventory', field: 'part_name' }); setShowTechnicalNameModal(true); }}
                      className="border border-[#141414] px-2 hover:bg-gray-100"
                    >
                      <Book className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] uppercase opacity-50 block mb-1">Stock</label>
                  <input 
                    placeholder="Stock actual" 
                    type="number"
                    className="w-full p-2 border border-[#141414] bg-white text-sm"
                    value={newInventoryItem.stock_level}
                    onChange={e => setNewInventoryItem({ ...newInventoryItem, stock_level: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase opacity-50 block mb-1">Mínimo</label>
                  <input 
                    placeholder="Stock mínimo" 
                    type="number"
                    className="w-full p-2 border border-[#141414] bg-white text-sm"
                    value={newInventoryItem.min_stock}
                    onChange={e => setNewInventoryItem({ ...newInventoryItem, min_stock: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase opacity-50 block mb-1">Precio</label>
                  <input 
                    placeholder="Precio" 
                    type="number"
                    className="w-full p-2 border border-[#141414] bg-white text-sm"
                    value={newInventoryItem.unit_price}
                    onChange={e => setNewInventoryItem({ ...newInventoryItem, unit_price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase opacity-50 block mb-1">Fecha Ingreso</label>
                  <input 
                    type="date"
                    className="w-full p-2 border border-[#141414] bg-white text-sm"
                    value={newInventoryItem.entry_date}
                    onChange={e => setNewInventoryItem({ ...newInventoryItem, entry_date: e.target.value })}
                  />
                </div>
                <div className="md:col-span-6 flex justify-end mt-2 space-x-2">
                  {editingInventoryId && (
                    <button 
                      onClick={() => {
                        setEditingInventoryId(null);
                        setNewInventoryItem({ part_name: '', stock_level: '', min_stock: '', unit_price: '', entry_date: format(new Date(), 'yyyy-MM-dd') });
                      }}
                      className="border border-[#141414] px-8 py-2 text-xs font-bold uppercase hover:bg-gray-100 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    onClick={addInventoryItem}
                    className="bg-[#141414] text-[#E4E3E0] px-8 py-2 text-xs font-bold uppercase hover:bg-gray-800 transition-colors"
                  >
                    {editingInventoryId ? 'Actualizar Artículo' : 'Añadir al Inventario'}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border border-[#141414]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest">
                    <tr>
                      <th className="p-3">Artículo</th>
                      <th className="p-3">Stock</th>
                      <th className="p-3">Precio</th>
                      <th className="p-3">Tiempo</th>
                      <th className="p-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm bg-white">
                    {inventory.map(item => (
                      <tr key={item.id} className="border-b border-[#141414]/10 hover:bg-gray-50">
                        <td className="p-3 font-medium">{item.part_name}</td>
                        <td className="p-3 font-mono">{item.stock_level}</td>
                        <td className="p-3 font-mono">{formatCurrency(item.unit_price)}</td>
                        <td className="p-3 text-[10px] opacity-60">
                          {item.entry_date ? formatDistanceToNow(parseLocalDate(item.entry_date), { locale: es, addSuffix: false }) : '-'}
                        </td>
                        <td className="p-3 flex space-x-1">
                          <button 
                            onClick={() => {
                              setEditingInventoryId(item.id);
                              setNewInventoryItem({
                                part_name: item.part_name,
                                stock_level: item.stock_level.toString(),
                                min_stock: item.min_stock.toString(),
                                unit_price: item.unit_price.toString(),
                                entry_date: item.entry_date ? item.entry_date.split('T')[0] : format(new Date(), 'yyyy-MM-dd')
                              });
                            }}
                            className="text-blue-600 hover:bg-blue-50 p-1"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteInventoryItem(item.id)}
                            className="text-red-600 hover:bg-red-50 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {inventory.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center italic opacity-50">No hay artículos registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button 
                onClick={() => setShowInventoryModal(false)}
                className="w-full mt-6 py-3 text-sm font-bold uppercase border border-[#141414] hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Purchase Order Modal */}
        {showPOModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
            <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-5xl p-8 max-h-[95vh] flex flex-col shadow-2xl relative">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-4xl font-serif italic leading-none">
                    {editingPOId ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
                  </h3>
                  <p className="text-[10px] font-mono uppercase opacity-50 mt-2 tracking-widest">Documento de Adquisición Técnica</p>
                </div>
                <button onClick={() => {
                  setShowPOModal(false);
                  setEditingPOId(null);
                  setShowAddSupplierInline(false);
                  setNewPO({ supplier_id: '', scheduled_date: '', description: '', items: [] });
                  setAddingItem({ inventory_id: '', part_name: '', quantity: 1, unit_price: 0, description: '' });
                }} className="p-2 hover:bg-gray-200 transition-colors">
                  <X className="w-8 h-8" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                <div className="lg:col-span-5">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Proveedor</label>
                    <button 
                      onClick={() => setShowAddSupplierInline(!showAddSupplierInline)}
                      className="text-[9px] uppercase font-bold text-blue-600 hover:underline"
                    >
                      {showAddSupplierInline ? '← Seleccionar Existente' : '+ Nuevo Proveedor'}
                    </button>
                  </div>
                  
                  {showAddSupplierInline ? (
                    <div className="flex space-x-2">
                      <input 
                        placeholder="Nombre de la nueva empresa" 
                        className="flex-1 p-3 border border-[#141414] bg-white text-sm"
                        value={newCompany.name}
                        onChange={e => setNewCompany({ name: e.target.value })}
                      />
                      <button 
                        onClick={async () => {
                          if (!newCompany.name) return;
                          try {
                            const res = await fetch('/api/companies', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(newCompany)
                            });
                            if (!res.ok) throw new Error('Failed');
                            const data = await res.json();
                            await fetchData();
                            setNewPO({ ...newPO, supplier_id: data.id.toString() });
                            setNewCompany({ name: '' });
                            setShowAddSupplierInline(false);
                          } catch (err) { console.error(err); }
                        }}
                        className="px-4 py-2 text-xs font-bold uppercase bg-[#141414] text-[#E4E3E0]"
                      >
                        Crear
                      </button>
                    </div>
                  ) : (
                    <select 
                      className="w-full p-3 border border-[#141414] bg-white text-sm font-medium"
                      value={newPO.supplier_id}
                      onChange={e => setNewPO({ ...newPO, supplier_id: e.target.value })}
                    >
                      <option value="">Seleccionar Proveedor...</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
                
                <div className="lg:col-span-3">
                  <label className="text-[10px] font-bold uppercase opacity-50 block mb-2">Fecha Programada</label>
                  <input 
                    type="date"
                    className="w-full p-3 border border-[#141414] bg-white text-sm"
                    value={newPO.scheduled_date}
                    onChange={e => setNewPO({ ...newPO, scheduled_date: e.target.value })}
                  />
                </div>

                <div className="lg:col-span-4">
                  <label className="text-[10px] font-bold uppercase opacity-50 block mb-2">Notas Generales</label>
                  <div className="flex gap-2">
                    <textarea 
                      className="flex-1 p-3 border border-[#141414] bg-white text-sm min-h-[46px] max-h-[46px]"
                      placeholder="Notas de la orden..."
                      value={newPO.description}
                      onChange={e => setNewPO({ ...newPO, description: e.target.value })}
                    />
                    <button 
                      onClick={() => { setTechnicalNameTarget({ type: 'po_general', field: 'description' }); setShowTechnicalNameModal(true); }}
                      className="border border-[#141414] px-2 hover:bg-gray-100 h-[46px]"
                    >
                      <Book className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col border border-[#141414] bg-white">
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-4 pb-4 border-b border-[#141414] text-[10px] uppercase font-bold opacity-30">
                      <div className="col-span-5">Descripción del Artículo</div>
                      <div className="col-span-2 text-center">Cantidad</div>
                      <div className="col-span-2 text-right">Precio Unit.</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                      <div className="col-span-1"></div>
                    </div>
                    
                    {newPO.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 opacity-20">
                        <Package className="w-12 h-12 mb-2" />
                        <p className="text-xs italic">No hay artículos en esta orden.</p>
                      </div>
                    ) : (
                      newPO.items.map((item, idx) => (
                        <div key={idx} className="group border-b border-gray-100 pb-4 last:border-0 hover:bg-gray-50/50 -mx-2 px-2 transition-colors">
                          <div className="grid grid-cols-12 gap-4 items-center mb-2">
                            <div className="col-span-5">
                              <p className="text-sm font-bold">
                                {item.inventory_id ? inventory.find(i => i.id === item.inventory_id)?.part_name : item.part_name}
                              </p>
                              {item.description && <p className="text-[10px] opacity-50 italic mt-0.5">{item.description}</p>}
                            </div>
                            <div className="col-span-2">
                              <input 
                                type="number"
                                className="w-full p-2 border border-gray-200 text-xs font-mono text-center bg-transparent focus:bg-white"
                                value={item.quantity}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setNewPO({
                                    ...newPO,
                                    items: newPO.items.map((it, i) => i === idx ? { ...it, quantity: val } : it)
                                  });
                                }}
                              />
                            </div>
                            <div className="col-span-2">
                              <input 
                                type="number"
                                className="w-full p-2 border border-gray-200 text-xs font-mono text-right bg-transparent focus:bg-white"
                                value={item.unit_price}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setNewPO({
                                    ...newPO,
                                    items: newPO.items.map((it, i) => i === idx ? { ...it, unit_price: val } : it)
                                  });
                                }}
                              />
                            </div>
                            <div className="col-span-2 text-right font-mono text-xs font-bold">
                              {formatCurrency(item.quantity * item.unit_price)}
                            </div>
                            <div className="col-span-1 text-right">
                              <button 
                                onClick={() => {
                                  setNewPO({ ...newPO, items: newPO.items.filter((_, i) => i !== idx) });
                                }}
                                className="text-red-400 p-1 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Add Item Form - Integrated at bottom of list area */}
                <div className="bg-gray-50 border-t border-[#141414] p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-4">
                      <label className="text-[9px] uppercase opacity-50 block mb-1">Artículo</label>
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 p-2 border border-[#141414] text-xs bg-white"
                          value={addingItem.inventory_id}
                          onChange={e => {
                            const id = e.target.value;
                            if (id === 'custom') {
                              setAddingItem({ ...addingItem, inventory_id: 'custom', part_name: '' });
                            } else {
                              const invItem = inventory.find(i => i.id === Number(id));
                              setAddingItem({ 
                                ...addingItem, 
                                inventory_id: id, 
                                part_name: invItem?.part_name || '',
                                unit_price: invItem?.unit_price || 0
                              });
                            }
                          }}
                        >
                          <option value="">Seleccionar del Inventario...</option>
                          <option value="custom">+ Artículo Nuevo / No en Inventario</option>
                          {inventory.map(i => <option key={i.id} value={i.id}>{i.part_name}</option>)}
                        </select>
                        <button 
                          onClick={() => { setTechnicalNameTarget({ type: 'po', field: 'part_name' }); setShowTechnicalNameModal(true); }}
                          className="border border-[#141414] px-2 hover:bg-gray-100"
                        >
                          <Book className="w-4 h-4" />
                        </button>
                      </div>
                      {addingItem.inventory_id === 'custom' && (
                        <input 
                          placeholder="Nombre del artículo nuevo"
                          className="w-full mt-2 p-2 border border-[#141414] text-xs bg-white"
                          value={addingItem.part_name}
                          onChange={e => setAddingItem({ ...addingItem, part_name: e.target.value })}
                        />
                      )}
                    </div>
                    <div className="lg:col-span-1">
                      <label className="text-[9px] uppercase opacity-50 block mb-1">Cant.</label>
                      <input 
                        type="number"
                        className="w-full p-2 border border-[#141414] text-xs text-center"
                        value={addingItem.quantity}
                        onChange={e => setAddingItem({ ...addingItem, quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="text-[9px] uppercase opacity-50 block mb-1">Precio Unit.</label>
                      <input 
                        type="number"
                        className="w-full p-2 border border-[#141414] text-xs text-right"
                        value={addingItem.unit_price}
                        onChange={e => setAddingItem({ ...addingItem, unit_price: Number(e.target.value) })}
                      />
                    </div>
                    <div className="lg:col-span-4">
                      <label className="text-[9px] uppercase opacity-50 block mb-1">Especificaciones / Notas</label>
                      <div className="flex gap-2">
                        <input 
                          placeholder="Marca, modelo, notas..."
                          className="flex-1 p-2 border border-[#141414] text-xs"
                          value={addingItem.description}
                          onChange={e => setAddingItem({ ...addingItem, description: e.target.value })}
                        />
                        <button 
                          onClick={() => { setTechnicalNameTarget({ type: 'po', field: 'description' }); setShowTechnicalNameModal(true); }}
                          className="border border-[#141414] px-2 hover:bg-gray-100"
                        >
                          <Book className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="lg:col-span-1 flex items-end">
                      <button 
                        onClick={() => {
                          if (!addingItem.part_name && !addingItem.inventory_id) return;
                          const newItem = {
                            inventory_id: addingItem.inventory_id === 'custom' ? undefined : Number(addingItem.inventory_id),
                            part_name: addingItem.inventory_id === 'custom' ? addingItem.part_name : undefined,
                            quantity: addingItem.quantity,
                            unit_price: addingItem.unit_price,
                            description: addingItem.description
                          };
                          setNewPO({ ...newPO, items: [...newPO.items, newItem] });
                          setAddingItem({ inventory_id: '', part_name: '', quantity: 1, unit_price: 0, description: '' });
                        }}
                        disabled={(!addingItem.inventory_id || (addingItem.inventory_id === 'custom' && !addingItem.part_name))}
                        className="w-full bg-[#141414] text-[#E4E3E0] p-2 hover:bg-gray-800 disabled:opacity-30 transition-all"
                      >
                        <Plus className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold opacity-30 tracking-widest">Total de la Orden</span>
                  <span className="text-4xl font-mono font-bold">
                    {formatCurrency(newPO.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0))}
                  </span>
                </div>

                <div className="flex space-x-4 w-full md:w-auto">
                  <button 
                    onClick={() => {
                      setShowPOModal(false);
                      setEditingPOId(null);
                      setShowAddSupplierInline(false);
                      setNewPO({ supplier_id: '', scheduled_date: '', description: '', items: [] });
                      setAddingItem({ inventory_id: '', part_name: '', quantity: 1, unit_price: 0, description: '' });
                    }} 
                    className="flex-1 md:px-12 border border-[#141414] py-4 text-sm font-bold uppercase hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={createPurchaseOrder}
                    disabled={!newPO.supplier_id || newPO.items.length === 0}
                    className="flex-1 md:px-12 bg-[#141414] text-[#E4E3E0] py-4 text-sm font-bold uppercase disabled:opacity-30 hover:bg-gray-800 transition-all shadow-xl"
                  >
                    {editingPOId ? 'Guardar Cambios' : 'Generar Orden de Compra'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {confirmDialog.show && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-serif italic mb-4">Confirmar Acción</h3>
              <p className="text-sm opacity-70 mb-8">{confirmDialog.message}</p>
              <div className="flex space-x-4">
                <button 
                  onClick={() => setConfirmDialog({ ...confirmDialog, show: false })}
                  className="flex-1 border border-[#141414] py-3 text-sm font-bold uppercase"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog({ ...confirmDialog, show: false });
                  }}
                  className="flex-1 bg-red-600 text-white py-3 text-sm font-bold uppercase"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {alertDialog.show && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
            <div className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-serif italic mb-4">Atención</h3>
              <p className="text-sm opacity-70 mb-8">{alertDialog.message}</p>
              <button 
                onClick={() => setAlertDialog({ show: false, message: '' })}
                className="w-full bg-[#141414] text-[#E4E3E0] py-3 text-sm font-bold uppercase"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

        {/* Add Manufacturer Recommendation Modal */}
        {showAddRecommendationModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-[400]">
            <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif italic">Nueva Recomendación del Fabricante</h3>
                <button onClick={() => setShowAddRecommendationModal(false)} className="text-xs font-bold uppercase hover:underline">Cerrar</button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase opacity-50">Máquina</label>
                  <select 
                    className="w-full p-3 border border-[#141414] bg-white text-sm"
                    value={newRecommendation.machine_id}
                    onChange={e => setNewRecommendation({ ...newRecommendation, machine_id: e.target.value })}
                  >
                    <option value="">Seleccionar Máquina...</option>
                    {machines.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Tipo</label>
                    <select 
                      className="w-full p-3 border border-[#141414] bg-white text-sm"
                      value={newRecommendation.type}
                      onChange={e => setNewRecommendation({ ...newRecommendation, type: e.target.value as any })}
                    >
                      <option value="maintenance">Mantenimiento</option>
                      <option value="spare_part">Repuesto</option>
                      <option value="lubricant">Lubricante</option>
                      <option value="consumable">Consumible</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Nombre del Item</label>
                    <input 
                      className="w-full p-3 border border-[#141414] bg-white text-sm"
                      placeholder="Ej: Filtro de Aceite, Cambio de Rodamientos"
                      value={newRecommendation.item_name}
                      onChange={e => setNewRecommendation({ ...newRecommendation, item_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Especificación / Grado</label>
                    <input 
                      className="w-full p-3 border border-[#141414] bg-white text-sm"
                      placeholder="Ej: ISO 46, 10W-40"
                      value={newRecommendation.specification}
                      onChange={e => setNewRecommendation({ ...newRecommendation, specification: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Número de Parte (PN)</label>
                    <input 
                      className="w-full p-3 border border-[#141414] bg-white text-sm"
                      placeholder="Ej: 123-456-789"
                      value={newRecommendation.part_number}
                      onChange={e => setNewRecommendation({ ...newRecommendation, part_number: e.target.value })}
                    />
                  </div>
                </div>

                {newRecommendation.type === 'maintenance' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-50">Frecuencia (Horas)</label>
                      <input 
                        type="number"
                        className="w-full p-3 border border-[#141414] bg-white text-sm"
                        placeholder="Ej: 250"
                        value={newRecommendation.frequency_hours}
                        onChange={e => setNewRecommendation({ ...newRecommendation, frequency_hours: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-50">Frecuencia (Días)</label>
                      <input 
                        type="number"
                        className="w-full p-3 border border-[#141414] bg-white text-sm"
                        placeholder="Ej: 30"
                        value={newRecommendation.frequency_days}
                        onChange={e => setNewRecommendation({ ...newRecommendation, frequency_days: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase opacity-50">Descripción / Notas del Fabricante</label>
                  <textarea 
                    className="w-full p-3 border border-[#141414] bg-white text-sm h-24"
                    placeholder="Instrucciones especiales del manual..."
                    value={newRecommendation.description}
                    onChange={e => setNewRecommendation({ ...newRecommendation, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase opacity-50">Documento Adjunto</label>
                  <div className="flex items-center space-x-4">
                    <label className="cursor-pointer text-xs font-bold uppercase border border-[#141414] px-4 py-2 hover:bg-gray-100">
                      {newRecommendation.document_url ? 'Cambiar Documento' : 'Subir Documento'}
                      <input 
                        type="file" 
                        accept=".pdf,.doc,.docx,image/*"
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > MAX_FILE_SIZE) {
                              showAlert("El archivo es demasiado grande. El tamaño máximo permitido es 10MB.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setNewRecommendation({ ...newRecommendation, document_url: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>
                    {newRecommendation.document_url && (
                      <span className="text-xs text-emerald-600 font-bold flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Documento adjunto
                      </span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={addManufacturerRecommendation}
                  className="w-full py-4 bg-[#141414] text-[#E4E3E0] font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
                >
                  Guardar Recomendación
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Technical Names Library Modal */}
        {showTechnicalNameModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-[300]">
            <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-2xl p-8 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-serif italic">Biblioteca de Nombres Técnicos</h3>
                  <p className="text-[10px] font-mono uppercase opacity-50">Gestionar terminología estandarizada</p>
                </div>
                <button onClick={() => setShowTechnicalNameModal(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase border-b border-[#141414] pb-1">Agregar Nuevo Término</h4>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50">Nombre Técnico</label>
                      <input
                        type="text"
                        value={newTechnicalName.name}
                        onChange={(e) => setNewTechnicalName({ ...newTechnicalName, name: e.target.value })}
                        className="w-full bg-white border border-[#141414] p-2 text-xs"
                        placeholder="Ej: Rodamiento de Bolas"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50">Nombre Coloquial</label>
                      <input
                        type="text"
                        value={newTechnicalName.colloquial_name}
                        onChange={(e) => setNewTechnicalName({ ...newTechnicalName, colloquial_name: e.target.value })}
                        className="w-full bg-white border border-[#141414] p-2 text-xs"
                        placeholder="Ej: Balinera"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50">Descripción / Notas</label>
                      <textarea
                        value={newTechnicalName.description}
                        onChange={(e) => setNewTechnicalName({ ...newTechnicalName, description: e.target.value })}
                        className="w-full bg-white border border-[#141414] p-2 text-xs h-20"
                        placeholder="Uso, especificaciones generales..."
                      />
                    </div>
                    <button
                      onClick={addTechnicalName}
                      className="w-full bg-[#141414] text-[#E4E3E0] py-2 text-xs font-bold uppercase"
                    >
                      Guardar en Biblioteca
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-[#141414] pb-1">
                    <h4 className="text-xs font-bold uppercase">Términos Guardados</h4>
                    <input 
                      type="text"
                      placeholder="Buscar por nombre o coloquial..."
                      className="text-[10px] p-1 border border-[#141414] bg-white w-40"
                      value={technicalNameSearch}
                      onChange={e => setTechnicalNameSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                    {technicalNames.filter(tn => 
                      tn.name.toLowerCase().includes(technicalNameSearch.toLowerCase()) || 
                      (tn.colloquial_name && tn.colloquial_name.toLowerCase().includes(technicalNameSearch.toLowerCase()))
                    ).length === 0 ? (
                      <p className="text-xs italic opacity-50">No se encontraron términos.</p>
                    ) : (
                      technicalNames
                        .filter(tn => 
                          tn.name.toLowerCase().includes(technicalNameSearch.toLowerCase()) || 
                          (tn.colloquial_name && tn.colloquial_name.toLowerCase().includes(technicalNameSearch.toLowerCase()))
                        )
                        .map(tn => (
                        <div key={tn.id} className="p-3 border border-[#141414]/10 bg-white group">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-bold uppercase">{tn.name}</p>
                              {tn.colloquial_name && (
                                <p className="text-[10px] italic text-blue-600 mt-0.5">
                                  Coloquial: {tn.colloquial_name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {technicalNameTarget && (
                                <button 
                                  onClick={() => {
                                    if (technicalNameTarget.type === 'schedule') {
                                      setNewSchedule({ ...newSchedule, [technicalNameTarget.field]: tn.name });
                                    } else if (technicalNameTarget.type === 'po') {
                                      if (technicalNameTarget.field === 'part_name') {
                                        setAddingItem({ ...addingItem, inventory_id: 'custom', part_name: tn.name });
                                      } else {
                                        setAddingItem({ ...addingItem, [technicalNameTarget.field]: tn.name });
                                      }
                                    } else if (technicalNameTarget.type === 'po_general') {
                                      setNewPO({ ...newPO, [technicalNameTarget.field]: tn.name });
                                    } else if (technicalNameTarget.type === 'inventory') {
                                      setNewInventoryItem({ ...newInventoryItem, [technicalNameTarget.field]: tn.name });
                                    } else if (technicalNameTarget.type === 'tree') {
                                      setNewPart({ ...newPart, [technicalNameTarget.field]: tn.name });
                                    } else if (technicalNameTarget.type === 'wo') {
                                      if (showNewWOModal) {
                                        setNewWO({ ...newWO, [technicalNameTarget.field]: tn.name });
                                      } else if (showEditWOModal && editingWO) {
                                        setEditingWO({ ...editingWO, [technicalNameTarget.field]: tn.name });
                                      }
                                    }
                                    setShowTechnicalNameModal(false);
                                  }}
                                  className="text-[10px] font-bold uppercase bg-[#141414] text-[#E4E3E0] px-3 py-1 hover:bg-gray-800 transition-colors"
                                >
                                  Seleccionar
                                </button>
                              )}
                              <button 
                                onClick={() => deleteTechnicalName(tn.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-600 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {tn.description && <p className="text-[10px] opacity-60 mt-1">{tn.description}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Machine Modal */}
        {showAddMachineModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 z-[300]">
            <div className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-serif italic">Nueva Máquina</h3>
                  <p className="text-[10px] font-mono uppercase opacity-50">Agregar equipo al inventario</p>
                </div>
                <button onClick={() => setShowAddMachineModal(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase opacity-50">Nombre del Equipo</label>
                  <input
                    type="text"
                    value={newMachine.name}
                    onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })}
                    className="w-full bg-white border border-[#141414] p-2 text-xs"
                    placeholder="Ej: Torno CNC 01"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase opacity-50">Tipo / Categoría</label>
                  <input
                    type="text"
                    value={newMachine.type}
                    onChange={(e) => setNewMachine({ ...newMachine, type: e.target.value })}
                    className="w-full bg-white border border-[#141414] p-2 text-xs"
                    placeholder="Ej: Metalmecánica"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase opacity-50">Descripción</label>
                  <textarea
                    value={newMachine.description}
                    onChange={(e) => setNewMachine({ ...newMachine, description: e.target.value })}
                    className="w-full bg-white border border-[#141414] p-2 text-xs h-20"
                    placeholder="Detalles técnicos, ubicación, etc."
                  />
                </div>
                <button
                  onClick={addMachine}
                  className="w-full bg-[#141414] text-[#E4E3E0] py-2 text-xs font-bold uppercase"
                >
                  Registrar Máquina
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
