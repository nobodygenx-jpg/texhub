import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  Printer, 
  Clock, 
  Package, 
  Activity, 
  BarChart3,
  Calendar,
  User,
  Building,
  Loader2,
  FileText,
  Target,
  Zap,
  Layers,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  StopCircle,
  RotateCcw,
  Save,
  Download,
  Upload,
  Database,
  Cpu,
  Gauge,
  Timer,
  Thermometer,
  Droplets,
  Wind,
  Scissors,
  Shirt,
  Palette
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AlertDialog } from '../components/AlertDialog';
import { useToast } from '../components/ui/ToastProvider';
import { db } from '../lib/firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import * as Select from '@radix-ui/react-select';

// Production Management Types
export interface ProductionRecord {
  id: string;
  recordNumber: string;
  department: 'knitting' | 'weaving' | 'dyeing' | 'cutting' | 'sewing' | 'finishing' | 'packing' | 'quality';
  productType: string;
  batchNumber: string;
  orderNumber: string;
  customerName: string;
  
  // Production Details
  startTime: string;
  endTime?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'paused' | 'cancelled' | 'quality-hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Quantities
  targetQuantity: number;
  completedQuantity: number;
  rejectedQuantity: number;
  unit: string;
  
  // Machine/Equipment
  machineNumber: string;
  operatorName: string;
  supervisorName: string;
  shift: 'morning' | 'afternoon' | 'night';
  
  // Process Parameters (customizable based on department)
  processParameters: Record<string, any>;
  
  // Quality Data
  qualityChecks: QualityCheckRecord[];
  defects: DefectRecord[];
  
  // Efficiency Metrics
  efficiency: number; // percentage
  downtime: number; // minutes
  setupTime: number; // minutes
  cycleTime: number; // minutes per unit
  
  // Materials
  rawMaterials: MaterialConsumption[];
  
  // Notes and Comments
  notes: string;
  issues: string;
  improvements: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface QualityCheckRecord {
  id: string;
  checkType: string;
  inspector: string;
  checkTime: string;
  result: 'pass' | 'fail' | 'conditional';
  measurements: Record<string, number>;
  notes: string;
}

export interface DefectRecord {
  id: string;
  defectType: string;
  severity: 'minor' | 'major' | 'critical';
  quantity: number;
  location: string;
  cause: string;
  action: string;
  timestamp: string;
}

export interface MaterialConsumption {
  id: string;
  materialName: string;
  plannedQuantity: number;
  actualQuantity: number;
  unit: string;
  wastage: number;
  cost: number;
}

// Department-specific configurations
const DEPARTMENT_CONFIGS = {
  knitting: {
    name: 'Knitting Production',
    icon: Layers,
    color: 'blue',
    processParameters: [
      { key: 'needleGauge', label: 'Needle Gauge', type: 'number', unit: 'GG' },
      { key: 'yarnCount', label: 'Yarn Count', type: 'text', unit: '' },
      { key: 'stitchLength', label: 'Stitch Length', type: 'number', unit: 'mm' },
      { key: 'machineSpeed', label: 'Machine Speed', type: 'number', unit: 'RPM' },
      { key: 'tension', label: 'Yarn Tension', type: 'number', unit: 'g' },
      { key: 'temperature', label: 'Temperature', type: 'number', unit: '°C' },
    ],
    qualityChecks: ['Fabric Weight', 'Stitch Quality', 'Width Measurement', 'Defect Count'],
    defectTypes: ['Dropped Stitch', 'Hole', 'Yarn Break', 'Uneven Tension', 'Color Variation'],
  },
  weaving: {
    name: 'Weaving Production',
    icon: Scissors,
    color: 'green',
    processParameters: [
      { key: 'warpTension', label: 'Warp Tension', type: 'number', unit: 'N' },
      { key: 'weftTension', label: 'Weft Tension', type: 'number', unit: 'N' },
      { key: 'pickRate', label: 'Pick Rate', type: 'number', unit: 'picks/min' },
      { key: 'reedWidth', label: 'Reed Width', type: 'number', unit: 'cm' },
      { key: 'warpCount', label: 'Warp Count', type: 'text', unit: '' },
      { key: 'weftCount', label: 'Weft Count', type: 'text', unit: '' },
    ],
    qualityChecks: ['Fabric Construction', 'Pick Count', 'Warp Count', 'Fabric Hand Feel'],
    defectTypes: ['Warp Break', 'Weft Break', 'Reed Mark', 'Uneven Beat', 'Color Streak'],
  },
  dyeing: {
    name: 'Dyeing Production',
    icon: Palette,
    color: 'purple',
    processParameters: [
      { key: 'temperature', label: 'Temperature', type: 'number', unit: '°C' },
      { key: 'pH', label: 'pH Level', type: 'number', unit: '' },
      { key: 'liquorRatio', label: 'Liquor Ratio', type: 'text', unit: '' },
      { key: 'dyeConcentration', label: 'Dye Concentration', type: 'number', unit: '%' },
      { key: 'processTime', label: 'Process Time', type: 'number', unit: 'min' },
      { key: 'pressure', label: 'Pressure', type: 'number', unit: 'bar' },
    ],
    qualityChecks: ['Color Matching', 'Color Fastness', 'pH Check', 'Uniformity'],
    defectTypes: ['Color Variation', 'Staining', 'Uneven Dyeing', 'Color Bleeding', 'pH Deviation'],
  },
  cutting: {
    name: 'Cutting Production',
    icon: Scissors,
    color: 'orange',
    processParameters: [
      { key: 'fabricWidth', label: 'Fabric Width', type: 'number', unit: 'cm' },
      { key: 'layHeight', label: 'Lay Height', type: 'number', unit: 'layers' },
      { key: 'cuttingSpeed', label: 'Cutting Speed', type: 'number', unit: 'm/min' },
      { key: 'bladeType', label: 'Blade Type', type: 'text', unit: '' },
      { key: 'markerLength', label: 'Marker Length', type: 'number', unit: 'm' },
      { key: 'efficiency', label: 'Fabric Efficiency', type: 'number', unit: '%' },
    ],
    qualityChecks: ['Cut Accuracy', 'Edge Quality', 'Notch Placement', 'Size Consistency'],
    defectTypes: ['Inaccurate Cut', 'Frayed Edge', 'Missing Notch', 'Size Variation', 'Fabric Damage'],
  },
  sewing: {
    name: 'Sewing Production',
    icon: Shirt,
    color: 'red',
    processParameters: [
      { key: 'stitchType', label: 'Stitch Type', type: 'text', unit: '' },
      { key: 'stitchesPerInch', label: 'Stitches Per Inch', type: 'number', unit: 'SPI' },
      { key: 'threadTension', label: 'Thread Tension', type: 'number', unit: '' },
      { key: 'needleSize', label: 'Needle Size', type: 'text', unit: '' },
      { key: 'sewingSpeed', label: 'Sewing Speed', type: 'number', unit: 'RPM' },
      { key: 'seamAllowance', label: 'Seam Allowance', type: 'number', unit: 'mm' },
    ],
    qualityChecks: ['Seam Strength', 'Stitch Quality', 'Alignment', 'Thread Tension'],
    defectTypes: ['Broken Stitch', 'Skipped Stitch', 'Puckering', 'Misalignment', 'Thread Break'],
  },
  finishing: {
    name: 'Finishing Production',
    icon: Droplets,
    color: 'teal',
    processParameters: [
      { key: 'temperature', label: 'Temperature', type: 'number', unit: '°C' },
      { key: 'pressure', label: 'Pressure', type: 'number', unit: 'bar' },
      { key: 'speed', label: 'Line Speed', type: 'number', unit: 'm/min' },
      { key: 'chemicalConc', label: 'Chemical Concentration', type: 'number', unit: '%' },
      { key: 'dwellTime', label: 'Dwell Time', type: 'number', unit: 'min' },
      { key: 'moisture', label: 'Moisture Content', type: 'number', unit: '%' },
    ],
    qualityChecks: ['Hand Feel', 'Shrinkage', 'Color Fastness', 'Chemical Residue'],
    defectTypes: ['Over Processing', 'Under Processing', 'Chemical Stain', 'Uneven Finish', 'Shrinkage'],
  },
  packing: {
    name: 'Packing Production',
    icon: Package,
    color: 'indigo',
    processParameters: [
      { key: 'packingType', label: 'Packing Type', type: 'text', unit: '' },
      { key: 'unitsPerPack', label: 'Units Per Pack', type: 'number', unit: 'pcs' },
      { key: 'packingSpeed', label: 'Packing Speed', type: 'number', unit: 'pcs/hr' },
      { key: 'labelType', label: 'Label Type', type: 'text', unit: '' },
      { key: 'packingMaterial', label: 'Packing Material', type: 'text', unit: '' },
      { key: 'weight', label: 'Package Weight', type: 'number', unit: 'kg' },
    ],
    qualityChecks: ['Label Accuracy', 'Package Integrity', 'Count Verification', 'Barcode Scan'],
    defectTypes: ['Wrong Label', 'Damaged Package', 'Count Mismatch', 'Missing Items', 'Poor Presentation'],
  },
  quality: {
    name: 'Quality Control',
    icon: CheckCircle,
    color: 'green',
    processParameters: [
      { key: 'testType', label: 'Test Type', type: 'text', unit: '' },
      { key: 'sampleSize', label: 'Sample Size', type: 'number', unit: 'pcs' },
      { key: 'testStandard', label: 'Test Standard', type: 'text', unit: '' },
      { key: 'testConditions', label: 'Test Conditions', type: 'text', unit: '' },
      { key: 'acceptanceLevel', label: 'Acceptance Level', type: 'number', unit: '%' },
      { key: 'testDuration', label: 'Test Duration', type: 'number', unit: 'min' },
    ],
    qualityChecks: ['Dimensional Stability', 'Color Fastness', 'Strength Test', 'Appearance'],
    defectTypes: ['Dimensional Variation', 'Color Deviation', 'Strength Failure', 'Surface Defect', 'Construction Fault'],
  },
};

const SHIFTS = ['morning', 'afternoon', 'night'] as const;
const UNITS = ['pcs', 'kg', 'm', 'yards', 'rolls', 'sets'] as const;

interface ProductionManagementProps {
  user: any;
}

export function ProductionManagement({ user }: ProductionManagementProps) {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'create' | 'analytics'>('dashboard');
  const [selectedDepartment, setSelectedDepartment] = useState<keyof typeof DEPARTMENT_CONFIGS>('knitting');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<ProductionRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { showToast } = useToast();

  // Current production record
  const [currentRecord, setCurrentRecord] = useState<Partial<ProductionRecord>>({
    recordNumber: generateRecordNumber(),
    department: 'knitting',
    productType: '',
    batchNumber: '',
    orderNumber: '',
    customerName: '',
    startTime: new Date().toISOString(),
    status: 'pending',
    priority: 'medium',
    targetQuantity: 0,
    completedQuantity: 0,
    rejectedQuantity: 0,
    unit: 'pcs',
    machineNumber: '',
    operatorName: '',
    supervisorName: '',
    shift: 'morning',
    processParameters: {},
    qualityChecks: [],
    defects: [],
    efficiency: 0,
    downtime: 0,
    setupTime: 0,
    cycleTime: 0,
    rawMaterials: [],
    notes: '',
    issues: '',
    improvements: '',
  });

  function generateRecordNumber(): string {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const day = new Date().getDate().toString().padStart(2, '0');
    const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PR${year}${month}${day}${randomId}`;
  }

  // Fetch production records from Firebase
  useEffect(() => {
    if (!user) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const recordsRef = collection(db, "users", user.uid, "productionRecords");
    const q = query(recordsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRecords: ProductionRecord[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProductionRecord[];
      setRecords(fetchedRecords);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching production records:", error);
      showToast({
        message: "Error fetching production records. Please try again.",
        type: 'error',
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, showToast]);

  // Filter records
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.recordNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.operatorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || record.department === departmentFilter;
    
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  // Calculate statistics
  const stats = {
    totalRecords: records.length,
    activeProduction: records.filter(r => r.status === 'in-progress').length,
    completedToday: records.filter(r => {
      const today = new Date().toDateString();
      return r.status === 'completed' && new Date(r.updatedAt).toDateString() === today;
    }).length,
    averageEfficiency: records.length > 0 ? 
      records.reduce((sum, r) => sum + r.efficiency, 0) / records.length : 0,
  };

  const handleSaveRecord = async () => {
    if (!user) {
      showToast({ message: "Please log in to save production records.", type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const recordData = {
        ...currentRecord,
        updatedAt: new Date().toISOString(),
        userId: user.uid,
        createdAt: editingRecord ? editingRecord.createdAt : new Date().toISOString(),
      };

      if (editingRecord) {
        await updateDoc(doc(db, "users", user.uid, "productionRecords", editingRecord.id), recordData);
        showToast({ message: "Production record updated successfully!", type: 'success' });
        setEditingRecord(null);
      } else {
        delete (recordData as any).id;
        await addDoc(collection(db, "users", user.uid, "productionRecords"), recordData);
        showToast({ message: "Production record created successfully!", type: 'success' });
      }

      // Reset form
      setCurrentRecord({
        recordNumber: generateRecordNumber(),
        department: 'knitting',
        productType: '',
        batchNumber: '',
        orderNumber: '',
        customerName: '',
        startTime: new Date().toISOString(),
        status: 'pending',
        priority: 'medium',
        targetQuantity: 0,
        completedQuantity: 0,
        rejectedQuantity: 0,
        unit: 'pcs',
        machineNumber: '',
        operatorName: '',
        supervisorName: '',
        shift: 'morning',
        processParameters: {},
        qualityChecks: [],
        defects: [],
        efficiency: 0,
        downtime: 0,
        setupTime: 0,
        cycleTime: 0,
        rawMaterials: [],
        notes: '',
        issues: '',
        improvements: '',
      });
      setActiveTab('records');
    } catch (error) {
      console.error("Error saving production record:", error);
      showToast({ message: "Error saving production record. Please try again.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRecord = (record: ProductionRecord) => {
    setCurrentRecord(record);
    setEditingRecord(record);
    setSelectedDepartment(record.department);
    setActiveTab('create');
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!user) {
      showToast({ message: "Please log in to delete records.", type: 'error' });
      return;
    }

    try {
      await deleteDoc(doc(db, "users", user.uid, "productionRecords", recordId));
      showToast({ message: "Production record deleted successfully!", type: 'success' });
    } catch (error) {
      console.error("Error deleting record:", error);
      showToast({ message: "Error deleting record. Please try again.", type: 'error' });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleParameterChange = (key: string, value: any) => {
    setCurrentRecord(prev => ({
      ...prev,
      processParameters: {
        ...prev.processParameters,
        [key]: value
      }
    }));
  };

  const addQualityCheck = () => {
    const newCheck: QualityCheckRecord = {
      id: Date.now().toString(),
      checkType: '',
      inspector: '',
      checkTime: new Date().toISOString(),
      result: 'pass',
      measurements: {},
      notes: '',
    };
    
    setCurrentRecord(prev => ({
      ...prev,
      qualityChecks: [...(prev.qualityChecks || []), newCheck]
    }));
  };

  const updateQualityCheck = (index: number, field: keyof QualityCheckRecord, value: any) => {
    setCurrentRecord(prev => ({
      ...prev,
      qualityChecks: prev.qualityChecks?.map((check, i) => 
        i === index ? { ...check, [field]: value } : check
      ) || []
    }));
  };

  const removeQualityCheck = (index: number) => {
    setCurrentRecord(prev => ({
      ...prev,
      qualityChecks: prev.qualityChecks?.filter((_, i) => i !== index) || []
    }));
  };

  const addDefectRecord = () => {
    const newDefect: DefectRecord = {
      id: Date.now().toString(),
      defectType: '',
      severity: 'minor',
      quantity: 0,
      location: '',
      cause: '',
      action: '',
      timestamp: new Date().toISOString(),
    };
    
    setCurrentRecord(prev => ({
      ...prev,
      defects: [...(prev.defects || []), newDefect]
    }));
  };

  const updateDefectRecord = (index: number, field: keyof DefectRecord, value: any) => {
    setCurrentRecord(prev => ({
      ...prev,
      defects: prev.defects?.map((defect, i) => 
        i === index ? { ...defect, [field]: value } : defect
      ) || []
    }));
  };

  const removeDefectRecord = (index: number) => {
    setCurrentRecord(prev => ({
      ...prev,
      defects: prev.defects?.filter((_, i) => i !== index) || []
    }));
  };

  const StatCard = ({ icon: Icon, label, value, color }: { icon: React.ElementType, label: string, value: string | number, color: string }) => (
    <motion.div
      className="bg-card p-6 rounded-xl border border-border shadow-sm"
      whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </motion.div>
  );

  const inputClasses = "w-full rounded-lg border border-border shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-foreground py-2 px-3";
  const labelClasses = "block text-sm font-medium text-foreground mb-2";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card text-card-foreground border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Production Management</h1>
              <p className="text-muted-foreground mt-1">Comprehensive production tracking for all textile departments</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  setCurrentRecord({
                    recordNumber: generateRecordNumber(),
                    department: selectedDepartment,
                    productType: '',
                    batchNumber: '',
                    orderNumber: '',
                    customerName: '',
                    startTime: new Date().toISOString(),
                    status: 'pending',
                    priority: 'medium',
                    targetQuantity: 0,
                    completedQuantity: 0,
                    rejectedQuantity: 0,
                    unit: 'pcs',
                    machineNumber: '',
                    operatorName: '',
                    supervisorName: '',
                    shift: 'morning',
                    processParameters: {},
                    qualityChecks: [],
                    defects: [],
                    efficiency: 0,
                    downtime: 0,
                    setupTime: 0,
                    cycleTime: 0,
                    rawMaterials: [],
                    notes: '',
                    issues: '',
                    improvements: '',
                  });
                  setEditingRecord(null);
                  setActiveTab('create');
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Record
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit mt-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'dashboard'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'records'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="h-4 w-4" />
              Records ({records.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'create'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Plus className="h-4 w-4" />
              {editingRecord ? 'Edit Record' : 'Create Record'}
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'analytics'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Activity className="h-4 w-4" />
              Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                  icon={FileText}
                  label="Total Records"
                  value={stats.totalRecords}
                  color="bg-blue-500"
                />
                <StatCard
                  icon={Activity}
                  label="Active Production"
                  value={stats.activeProduction}
                  color="bg-orange-500"
                />
                <StatCard
                  icon={CheckCircle}
                  label="Completed Today"
                  value={stats.completedToday}
                  color="bg-green-500"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Avg Efficiency"
                  value={`${stats.averageEfficiency.toFixed(1)}%`}
                  color="bg-purple-500"
                />
              </div>

              {/* Department Overview */}
              <div className="bg-card p-8 rounded-2xl border border-border shadow-lg">
                <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center">
                  <Building className="h-6 w-6 mr-3 text-primary" />
                  Department Overview
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {Object.entries(DEPARTMENT_CONFIGS).map(([key, config]) => {
                    const Icon = config.icon;
                    const departmentRecords = records.filter(r => r.department === key);
                    const activeCount = departmentRecords.filter(r => r.status === 'in-progress').length;
                    
                    return (
                      <motion.div
                        key={key}
                        className="bg-gradient-to-br from-card to-muted/30 p-6 rounded-xl border border-border hover:shadow-lg transition-all duration-300 cursor-pointer"
                        whileHover={{ scale: 1.02, y: -2 }}
                        onClick={() => {
                          setSelectedDepartment(key as keyof typeof DEPARTMENT_CONFIGS);
                          setDepartmentFilter(key);
                          setActiveTab('records');
                        }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className={`p-3 rounded-xl bg-${config.color}-500`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-foreground">{departmentRecords.length}</div>
                            <div className="text-xs text-muted-foreground">Total Records</div>
                          </div>
                        </div>
                        <h4 className="font-semibold text-foreground mb-2">{config.name}</h4>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Active:</span>
                          <span className="font-medium text-foreground">{activeCount}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-card p-8 rounded-2xl border border-border shadow-lg">
                <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center">
                  <Clock className="h-6 w-6 mr-3 text-primary" />
                  Recent Production Activity
                </h3>
                
                {records.slice(0, 5).length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {records.slice(0, 5).map((record) => {
                      const config = DEPARTMENT_CONFIGS[record.department];
                      const Icon = config.icon;
                      
                      return (
                        <div key={record.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg bg-${config.color}-500`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{record.recordNumber}</p>
                              <p className="text-sm text-muted-foreground">
                                {config.name} • {record.batchNumber} • {record.operatorName}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              record.status === 'completed' ? 'bg-green-100 text-green-800' :
                              record.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                              record.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {record.status.replace('-', ' ').toUpperCase()}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(record.updatedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'records' && (
            <motion.div
              key="records"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Filters */}
              <div className="bg-card p-6 rounded-lg border border-border">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Search by record number, batch, order, customer, or operator..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select.Root value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <Select.Trigger className="flex items-center justify-between w-48 rounded-md border border-border shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-foreground py-2 px-3">
                      <Select.Value placeholder="All Departments" />
                      <Select.Icon>
                        <Filter className="h-4 w-4" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="overflow-hidden rounded-lg bg-card border border-border shadow-lg z-50">
                        <Select.Viewport className="p-1">
                          <Select.Item value="all" className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                            <Select.ItemText>All Departments</Select.ItemText>
                          </Select.Item>
                          {Object.entries(DEPARTMENT_CONFIGS).map(([key, config]) => (
                            <Select.Item key={key} value={key} className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                              <Select.ItemText>{config.name}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>

                  <Select.Root value={statusFilter} onValueChange={setStatusFilter}>
                    <Select.Trigger className="flex items-center justify-between w-48 rounded-md border border-border shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-foreground py-2 px-3">
                      <Select.Value placeholder="All Statuses" />
                      <Select.Icon>
                        <Filter className="h-4 w-4" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="overflow-hidden rounded-lg bg-card border border-border shadow-lg z-50">
                        <Select.Viewport className="p-1">
                          <Select.Item value="all" className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                            <Select.ItemText>All Statuses</Select.ItemText>
                          </Select.Item>
                          {['pending', 'in-progress', 'completed', 'paused', 'cancelled', 'quality-hold'].map(status => (
                            <Select.Item key={status} value={status} className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                              <Select.ItemText>{status.replace('-', ' ').toUpperCase()}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
              </div>

              {/* Records Table */}
              <div className="bg-card rounded-lg border border-border">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-lg font-medium text-foreground">Loading production records...</p>
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground">
                      {searchTerm || statusFilter !== 'all' || departmentFilter !== 'all' ? 'No records found' : 'No production records yet'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {searchTerm || statusFilter !== 'all' || departmentFilter !== 'all' 
                        ? 'Try adjusting your filters' 
                        : 'Create your first production record to get started'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="border border-border px-4 py-3 text-left text-sm font-medium text-foreground">Record #</th>
                          <th className="border border-border px-4 py-3 text-left text-sm font-medium text-foreground">Department</th>
                          <th className="border border-border px-4 py-3 text-left text-sm font-medium text-foreground">Batch #</th>
                          <th className="border border-border px-4 py-3 text-left text-sm font-medium text-foreground">Operator</th>
                          <th className="border border-border px-4 py-3 text-center text-sm font-medium text-foreground">Status</th>
                          <th className="border border-border px-4 py-3 text-right text-sm font-medium text-foreground">Progress</th>
                          <th className="border border-border px-4 py-3 text-right text-sm font-medium text-foreground">Efficiency</th>
                          <th className="border border-border px-4 py-3 text-center text-sm font-medium text-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((record) => {
                          const config = DEPARTMENT_CONFIGS[record.department];
                          const progress = record.targetQuantity > 0 ? (record.completedQuantity / record.targetQuantity) * 100 : 0;
                          
                          return (
                            <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                              <td className="border border-border px-4 py-3 text-sm font-mono text-foreground">
                                {record.recordNumber}
                              </td>
                              <td className="border border-border px-4 py-3 text-sm text-foreground">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1 rounded bg-${config.color}-500`}>
                                    <config.icon className="h-3 w-3 text-white" />
                                  </div>
                                  {config.name}
                                </div>
                              </td>
                              <td className="border border-border px-4 py-3 text-sm text-foreground font-medium">
                                {record.batchNumber}
                              </td>
                              <td className="border border-border px-4 py-3 text-sm text-foreground">
                                {record.operatorName}
                              </td>
                              <td className="border border-border px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  record.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  record.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                  record.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                                  record.status === 'quality-hold' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {record.status.replace('-', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td className="border border-border px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary rounded-full transition-all duration-300"
                                      style={{ width: `${Math.min(progress, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-medium text-foreground">{progress.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="border border-border px-4 py-3 text-right text-sm font-medium text-foreground">
                                {record.efficiency.toFixed(1)}%
                              </td>
                              <td className="border border-border px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditRecord(record)}
                                    className="text-blue-600 hover:text-blue-700"
                                    title="Edit Record"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteConfirm(record.id)}
                                    className="text-red-600 hover:text-red-700"
                                    title="Delete Record"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Department Selection */}
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="text-lg font-semibold text-foreground mb-4">Select Department</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(DEPARTMENT_CONFIGS).map(([key, config]) => {
                    const Icon = config.icon;
                    const isSelected = selectedDepartment === key;
                    
                    return (
                      <motion.button
                        key={key}
                        onClick={() => {
                          setSelectedDepartment(key as keyof typeof DEPARTMENT_CONFIGS);
                          setCurrentRecord(prev => ({ ...prev, department: key as any }));
                        }}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className={`p-3 rounded-xl bg-${config.color}-500`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <span className="text-sm font-medium text-foreground">{config.name}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Production Record Form */}
              <div className="bg-card p-8 rounded-2xl border border-border shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {editingRecord ? 'Edit Production Record' : 'Create Production Record'}
                    </h2>
                    <p className="text-muted-foreground">
                      {DEPARTMENT_CONFIGS[selectedDepartment].name} - Record #{currentRecord.recordNumber}
                    </p>
                  </div>
                  <div className={`p-4 rounded-xl bg-${DEPARTMENT_CONFIGS[selectedDepartment].color}-500`}>
                    <DEPARTMENT_CONFIGS[selectedDepartment].icon className="h-8 w-8 text-white" />
                  </div>
                </div>

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div>
                    <label className={labelClasses}>Product Type</label>
                    <Input
                      value={currentRecord.productType || ''}
                      onChange={(e) => setCurrentRecord(prev => ({ ...prev, productType: e.target.value }))}
                      placeholder="e.g., T-Shirt, Denim Fabric"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Batch Number</label>
                    <Input
                      value={currentRecord.batchNumber || ''}
                      onChange={(e) => setCurrentRecord(prev => ({ ...prev, batchNumber: e.target.value }))}
                      placeholder="Batch Number"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Order Number</label>
                    <Input
                      value={currentRecord.orderNumber || ''}
                      onChange={(e) => setCurrentRecord(prev => ({ ...prev, orderNumber: e.target.value }))}
                      placeholder="Order Number"
                      className={inputClasses}
                    />
                  </div>
                </div>

                {/* Production Details */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div>
                    <label className={labelClasses}>Target Quantity</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={currentRecord.targetQuantity || ''}
                        onChange={(e) => setCurrentRecord(prev => ({ ...prev, targetQuantity: Number(e.target.value) }))}
                        placeholder="0"
                        className={inputClasses}
                      />
                      <Select.Root value={currentRecord.unit || 'pcs'} onValueChange={(value) => setCurrentRecord(prev => ({ ...prev, unit: value }))}>
                        <Select.Trigger className="w-20 rounded-md border border-border bg-background text-foreground py-2 px-3">
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content className="overflow-hidden rounded-lg bg-card border border-border shadow-lg z-50">
                            <Select.Viewport className="p-1">
                              {UNITS.map(unit => (
                                <Select.Item key={unit} value={unit} className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                                  <Select.ItemText>{unit}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    </div>
                  </div>
                  <div>
                    <label className={labelClasses}>Completed Quantity</label>
                    <Input
                      type="number"
                      value={currentRecord.completedQuantity || ''}
                      onChange={(e) => setCurrentRecord(prev => ({ ...prev, completedQuantity: Number(e.target.value) }))}
                      placeholder="0"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Machine Number</label>
                    <Input
                      value={currentRecord.machineNumber || ''}
                      onChange={(e) => setCurrentRecord(prev => ({ ...prev, machineNumber: e.target.value }))}
                      placeholder="Machine #"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Operator Name</label>
                    <Input
                      value={currentRecord.operatorName || ''}
                      onChange={(e) => setCurrentRecord(prev => ({ ...prev, operatorName: e.target.value }))}
                      placeholder="Operator Name"
                      className={inputClasses}
                    />
                  </div>
                </div>

                {/* Process Parameters */}
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Process Parameters - {DEPARTMENT_CONFIGS[selectedDepartment].name}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {DEPARTMENT_CONFIGS[selectedDepartment].processParameters.map((param) => (
                      <div key={param.key}>
                        <label className={labelClasses}>
                          {param.label} {param.unit && `(${param.unit})`}
                        </label>
                        <Input
                          type={param.type}
                          value={currentRecord.processParameters?.[param.key] || ''}
                          onChange={(e) => handleParameterChange(param.key, e.target.value)}
                          placeholder={`Enter ${param.label.toLowerCase()}`}
                          className={inputClasses}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quality Checks */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-foreground flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Quality Checks
                    </h4>
                    <Button onClick={addQualityCheck} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Check
                    </Button>
                  </div>
                  
                  {currentRecord.qualityChecks && currentRecord.qualityChecks.length > 0 ? (
                    <div className="space-y-4">
                      {currentRecord.qualityChecks.map((check, index) => (
                        <div key={check.id} className="bg-muted/30 p-4 rounded-lg border border-border">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">Check Type</label>
                              <Select.Root value={check.checkType} onValueChange={(value) => updateQualityCheck(index, 'checkType', value)}>
                                <Select.Trigger className="w-full rounded-md border border-border bg-background text-foreground py-2 px-3">
                                  <Select.Value placeholder="Select Check" />
                                </Select.Trigger>
                                <Select.Portal>
                                  <Select.Content className="overflow-hidden rounded-lg bg-card border border-border shadow-lg z-50">
                                    <Select.Viewport className="p-1">
                                      {DEPARTMENT_CONFIGS[selectedDepartment].qualityChecks.map(checkType => (
                                        <Select.Item key={checkType} value={checkType} className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                                          <Select.ItemText>{checkType}</Select.ItemText>
                                        </Select.Item>
                                      ))}
                                    </Select.Viewport>
                                  </Select.Content>
                                </Select.Portal>
                              </Select.Root>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">Inspector</label>
                              <Input
                                value={check.inspector}
                                onChange={(e) => updateQualityCheck(index, 'inspector', e.target.value)}
                                placeholder="Inspector Name"
                                className="w-full rounded-md border border-border bg-background text-foreground py-2 px-3"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">Result</label>
                              <Select.Root value={check.result} onValueChange={(value) => updateQualityCheck(index, 'result', value)}>
                                <Select.Trigger className="w-full rounded-md border border-border bg-background text-foreground py-2 px-3">
                                  <Select.Value />
                                </Select.Trigger>
                                <Select.Portal>
                                  <Select.Content className="overflow-hidden rounded-lg bg-card border border-border shadow-lg z-50">
                                    <Select.Viewport className="p-1">
                                      <Select.Item value="pass" className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                                        <Select.ItemText>Pass</Select.ItemText>
                                      </Select.Item>
                                      <Select.Item value="fail" className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                                        <Select.ItemText>Fail</Select.ItemText>
                                      </Select.Item>
                                      <Select.Item value="conditional" className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                                        <Select.ItemText>Conditional</Select.ItemText>
                                      </Select.Item>
                                    </Select.Viewport>
                                  </Select.Content>
                                </Select.Portal>
                              </Select.Root>
                            </div>
                            <div className="flex items-end">
                              <Button
                                onClick={() => removeQualityCheck(index)}
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                            <textarea
                              value={check.notes}
                              onChange={(e) => updateQualityCheck(index, 'notes', e.target.value)}
                              placeholder="Quality check notes..."
                              className="w-full rounded-md border border-border bg-background text-foreground py-2 px-3"
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-muted/20 rounded-lg">
                      <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No quality checks added yet</p>
                    </div>
                  )}
                </div>

                {/* Defect Records */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-foreground flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      Defect Records
                    </h4>
                    <Button onClick={addDefectRecord} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Defect
                    </Button>
                  </div>
                  
                  {currentRecord.defects && currentRecord.defects.length > 0 ? (
                    <div className="space-y-4">
                      {currentRecord.defects.map((defect, index) => (
                        <div key={defect.id} className="bg-red-50 p-4 rounded-lg border border-red-200">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">Defect Type</label>
                              <Select.Root value={defect.defectType} onValueChange={(value) => updateDefectRecord(index, 'defectType', value)}>
                                <Select.Trigger className="w-full rounded-md border border-border bg-background text-foreground py-2 px-3">
                                  <Select.Value placeholder="Select Defect" />
                                </Select.Trigger>
                                <Select.Portal>
                                  <Select.Content className="overflow-hidden rounded-lg bg-card border border-border shadow-lg z-50">
                                    <Select.Viewport className="p-1">
                                      {DEPARTMENT_CONFIGS[selectedDepartment].defectTypes.map(defectType => (
                                        <Select.Item key={defectType} value={defectType} className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                                          <Select.ItemText>{defectType}</Select.ItemText>
                                        </Select.Item>
                                      ))}
                                    </Select.Viewport>
                                  </Select.Content>
                                </Select.Portal>
                              </Select.Root>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">Severity</label>
                              <Select.Root value={defect.severity} onValueChange={(value) => updateDefectRecord(index, 'severity', value)}>
                                <Select.Trigger className="w-full rounded-md border border-border bg-background text-foreground py-2 px-3">
                                  <Select.Value />
                                </Select.Trigger>
                                <Select.Portal>
                                  <Select.Content className="overflow-hidden rounded-lg bg-card border border-border shadow-lg z-50">
                                    <Select.Viewport className="p-1">
                                      <Select.Item value="minor" className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                                        <Select.ItemText>Minor</Select.ItemText>
                                      </Select.Item>
                                      <Select.Item value="major" className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                                        <Select.ItemText>Major</Select.ItemText>
                                      </Select.Item>
                                      <Select.Item value="critical" className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                                        <Select.ItemText>Critical</Select.ItemText>
                                      </Select.Item>
                                    </Select.Viewport>
                                  </Select.Content>
                                </Select.Portal>
                              </Select.Root>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">Quantity</label>
                              <Input
                                type="number"
                                value={defect.quantity}
                                onChange={(e) => updateDefectRecord(index, 'quantity', Number(e.target.value))}
                                placeholder="0"
                                className="w-full rounded-md border border-border bg-background text-foreground py-2 px-3"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">Location</label>
                              <Input
                                value={defect.location}
                                onChange={(e) => updateDefectRecord(index, 'location', e.target.value)}
                                placeholder="Location"
                                className="w-full rounded-md border border-border bg-background text-foreground py-2 px-3"
                              />
                            </div>
                            <div className="flex items-end">
                              <Button
                                onClick={() => removeDefectRecord(index)}
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-muted/20 rounded-lg">
                      <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No defects recorded</p>
                    </div>
                  )}
                </div>

                {/* Additional Information */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                  <div>
                    <label className={labelClasses}>Production Notes</label>
                    <textarea
                      value={currentRecord.notes || ''}
                      onChange={(e) => setCurrentRecord(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="General production notes..."
                      className={`${inputClasses} min-h-[100px]`}
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Issues Encountered</label>
                    <textarea
                      value={currentRecord.issues || ''}
                      onChange={(e) => setCurrentRecord(prev => ({ ...prev, issues: e.target.value }))}
                      placeholder="Any issues or problems..."
                      className={`${inputClasses} min-h-[100px]`}
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Improvement Suggestions</label>
                    <textarea
                      value={currentRecord.improvements || ''}
                      onChange={(e) => setCurrentRecord(prev => ({ ...prev, improvements: e.target.value }))}
                      placeholder="Suggestions for improvement..."
                      className={`${inputClasses} min-h-[100px]`}
                      rows={4}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-6 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('records')}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveRecord}
                    disabled={isSaving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {editingRecord ? 'Update Record' : 'Create Record'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Analytics Dashboard */}
              <div className="bg-card p-8 rounded-2xl border border-border shadow-lg">
                <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center">
                  <BarChart3 className="h-6 w-6 mr-3 text-primary" />
                  Production Analytics
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {Object.entries(DEPARTMENT_CONFIGS).map(([key, config]) => {
                    const departmentRecords = records.filter(r => r.department === key);
                    const avgEfficiency = departmentRecords.length > 0 ? 
                      departmentRecords.reduce((sum, r) => sum + r.efficiency, 0) / departmentRecords.length : 0;
                    
                    return (
                      <div key={key} className="bg-gradient-to-br from-muted/30 to-muted/10 p-6 rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-4">
                          <div className={`p-3 rounded-xl bg-${config.color}-500`}>
                            <config.icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-foreground">{avgEfficiency.toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground">Efficiency</div>
                          </div>
                        </div>
                        <h4 className="font-semibold text-foreground mb-2">{config.name}</h4>
                        <div className="text-sm text-muted-foreground">
                          {departmentRecords.length} records
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Efficiency Trends Placeholder */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-8 border border-border/50">
                  <div className="text-center">
                    <BarChart3 className="h-16 w-16 mx-auto text-primary mb-4" />
                    <h4 className="text-lg font-semibold text-foreground mb-2">Production Analytics Dashboard</h4>
                    <p className="text-muted-foreground mb-6">
                      Detailed charts and analytics for production efficiency, quality trends, and performance metrics would appear here
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-card p-4 rounded-lg border border-border">
                        <div className="text-muted-foreground">Efficiency Trend</div>
                        <div className="text-lg font-bold text-foreground">↗ +5.2%</div>
                      </div>
                      <div className="bg-card p-4 rounded-lg border border-border">
                        <div className="text-muted-foreground">Quality Score</div>
                        <div className="text-lg font-bold text-foreground">94.8%</div>
                      </div>
                      <div className="bg-card p-4 rounded-lg border border-border">
                        <div className="text-muted-foreground">On-Time Delivery</div>
                        <div className="text-lg font-bold text-foreground">87.3%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <AlertDialog
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Production Record"
          message="Are you sure you want to delete this production record? This action cannot be undone."
          type="confirm"
          onConfirm={() => handleDeleteRecord(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
    </div>
  );
}