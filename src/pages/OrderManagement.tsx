import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  Printer, 
  Clock, 
  Package, 
  Truck, 
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Calendar,
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  Loader2,
  FileText,
  Settings,
  Target,
  Activity
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { OrderForm } from '../components/OrderForm';
import { OrderItemsTable } from '../components/OrderItemsTable';
import { OrderStatusTimeline } from '../components/OrderStatusTimeline';
import { ProductionTracker } from '../components/ProductionTracker';
import { ShipmentTracker } from '../components/ShipmentTracker';
import { PrintableOrder } from '../components/PrintableOrder';
import { AlertDialog } from '../components/AlertDialog';
import { useToast } from '../components/ui/ToastProvider';
import { useReactToPrint } from 'react-to-print';
import { Order, OrderItem, ProductionStage, QualityCheck, ShipmentDetails, ORDER_STATUSES, PRIORITY_LEVELS, initialOrderData, generateOrderNumber } from '../types/order';
import { db } from '../lib/firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import * as Select from '@radix-ui/react-select';

interface OrderManagementProps {
  user: any;
}

export function OrderManagement({ user }: OrderManagementProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'create' | 'details'>('orders');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { showToast } = useToast();

  // Current order form data
  const [currentOrder, setCurrentOrder] = useState<Order>({
    ...initialOrderData,
    id: '',
    orderNumber: generateOrderNumber(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: user?.uid || '',
  });

  // Fetch orders from Firebase
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ordersRef = collection(db, "users", user.uid, "orders");
    const q = query(ordersRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      showToast({
        message: "Error fetching orders from cloud. Please try again.",
        type: 'error',
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, showToast]);

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerCompany.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || order.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Calculate statistics
  const stats = {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => ['received', 'confirmed', 'in-production'].includes(o.status)).length,
    completedOrders: orders.filter(o => o.status === 'delivered').length,
    totalValue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
  };

  const handleSaveOrder = async () => {
    if (!user) {
      showToast({ message: "Please log in to save orders.", type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const orderData = {
        ...currentOrder,
        updatedAt: new Date().toISOString(),
        userId: user.uid,
      };

      if (editingOrder) {
        // Update existing order
        await updateDoc(doc(db, "users", user.uid, "orders", editingOrder.id), orderData);
        showToast({ message: "Order updated successfully!", type: 'success' });
        setEditingOrder(null);
      } else {
        // Create new order
        delete (orderData as any).id; // Remove id field for new documents
        await addDoc(collection(db, "users", user.uid, "orders"), orderData);
        showToast({ message: "Order created successfully!", type: 'success' });
      }

      // Reset form
      setCurrentOrder({
        ...initialOrderData,
        id: '',
        orderNumber: generateOrderNumber(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: user.uid,
      });
      setActiveTab('orders');
    } catch (error) {
      console.error("Error saving order:", error);
      showToast({ message: "Error saving order. Please try again.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditOrder = (order: Order) => {
    setCurrentOrder(order);
    setEditingOrder(order);
    setActiveTab('create');
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!user) {
      showToast({ message: "Please log in to delete orders.", type: 'error' });
      return;
    }

    try {
      await deleteDoc(doc(db, "users", user.uid, "orders", orderId));
      showToast({ message: "Order deleted successfully!", type: 'success' });
    } catch (error) {
      console.error("Error deleting order:", error);
      showToast({ message: "Error deleting order. Please try again.", type: 'error' });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setActiveTab('details');
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Order_${selectedOrder?.orderNumber}`,
  });

  const handleItemsChange = (items: OrderItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalAmount = subtotal - currentOrder.discount + currentOrder.tax + currentOrder.shippingCost;
    
    setCurrentOrder(prev => ({
      ...prev,
      items,
      subtotal,
      totalAmount,
    }));
  };

  const handleStagesChange = (stages: ProductionStage[]) => {
    setCurrentOrder(prev => ({ ...prev, productionStages: stages }));
  };

  const handleQualityChecksChange = (checks: QualityCheck[]) => {
    setCurrentOrder(prev => ({ ...prev, qualityChecks: checks }));
  };

  const handleShipmentChange = (details: ShipmentDetails) => {
    setCurrentOrder(prev => ({ ...prev, shipmentDetails: details }));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;

    const items = Array.from(currentOrder.items);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    handleItemsChange(items);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card text-card-foreground border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Order Management</h1>
              <p className="text-muted-foreground mt-1">Complete order lifecycle management from receipt to delivery</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  setCurrentOrder({
                    ...initialOrderData,
                    id: '',
                    orderNumber: generateOrderNumber(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    userId: user?.uid || '',
                  });
                  setEditingOrder(null);
                  setActiveTab('create');
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Order
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit mt-4">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'orders'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              Orders ({orders.length})
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
              {editingOrder ? 'Edit Order' : 'Create Order'}
            </button>
            {selectedOrder && (
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === 'details'
                    ? 'bg-card shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="h-4 w-4" />
                Order Details
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                  icon={ShoppingCart}
                  label="Total Orders"
                  value={stats.totalOrders}
                  color="bg-blue-500"
                />
                <StatCard
                  icon={Clock}
                  label="Pending Orders"
                  value={stats.pendingOrders}
                  color="bg-orange-500"
                />
                <StatCard
                  icon={CheckCircle}
                  label="Completed"
                  value={stats.completedOrders}
                  color="bg-green-500"
                />
                <StatCard
                  icon={BarChart3}
                  label="Total Value"
                  value={`₹${stats.totalValue.toFixed(2)}`}
                  color="bg-purple-500"
                />
              </div>

              {/* Filters */}
              <div className="bg-card p-6 rounded-lg border border-border">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Search by order number, customer, or company..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
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
                          {ORDER_STATUSES.map(status => (
                            <Select.Item key={status.value} value={status.value} className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                              <Select.ItemText>{status.label}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>

                  <Select.Root value={priorityFilter} onValueChange={setPriorityFilter}>
                    <Select.Trigger className="flex items-center justify-between w-48 rounded-md border border-border shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-foreground py-2 px-3">
                      <Select.Value placeholder="All Priorities" />
                      <Select.Icon>
                        <Filter className="h-4 w-4" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="overflow-hidden rounded-lg bg-card border border-border shadow-lg z-50">
                        <Select.Viewport className="p-1">
                          <Select.Item value="all" className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                            <Select.ItemText>All Priorities</Select.ItemText>
                          </Select.Item>
                          {PRIORITY_LEVELS.map(priority => (
                            <Select.Item key={priority.value} value={priority.value} className="relative flex items-center rounded-md py-2 pl-3 pr-9 text-foreground text-sm outline-none data-[highlighted]:bg-primary/20">
                              <Select.ItemText>{priority.label}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
              </div>

              {/* Orders List */}
              <div className="bg-card rounded-lg border border-border">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-lg font-medium text-foreground">Loading orders...</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground">
                      {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' ? 'No orders found' : 'No orders yet'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' 
                        ? 'Try adjusting your filters' 
                        : 'Create your first order to get started'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="border border-border px-4 py-3 text-left text-sm font-medium text-foreground">Order #</th>
                          <th className="border border-border px-4 py-3 text-left text-sm font-medium text-foreground">Customer</th>
                          <th className="border border-border px-4 py-3 text-left text-sm font-medium text-foreground">Company</th>
                          <th className="border border-border px-4 py-3 text-center text-sm font-medium text-foreground">Status</th>
                          <th className="border border-border px-4 py-3 text-center text-sm font-medium text-foreground">Priority</th>
                          <th className="border border-border px-4 py-3 text-right text-sm font-medium text-foreground">Total Amount</th>
                          <th className="border border-border px-4 py-3 text-left text-sm font-medium text-foreground">Order Date</th>
                          <th className="border border-border px-4 py-3 text-center text-sm font-medium text-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => {
                          const statusInfo = ORDER_STATUSES.find(s => s.value === order.status);
                          const priorityInfo = PRIORITY_LEVELS.find(p => p.value === order.priority);
                          
                          return (
                            <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                              <td className="border border-border px-4 py-3 text-sm font-mono text-foreground">
                                {order.orderNumber}
                              </td>
                              <td className="border border-border px-4 py-3 text-sm text-foreground font-medium">
                                {order.customerName}
                              </td>
                              <td className="border border-border px-4 py-3 text-sm text-foreground">
                                {order.customerCompany || 'N/A'}
                              </td>
                              <td className="border border-border px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo?.color || 'bg-gray-100 text-gray-800'}`}>
                                  {statusInfo?.label || order.status}
                                </span>
                              </td>
                              <td className="border border-border px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityInfo?.color || 'bg-gray-100 text-gray-800'}`}>
                                  {priorityInfo?.label || order.priority}
                                </span>
                              </td>
                              <td className="border border-border px-4 py-3 text-sm text-foreground text-right font-medium">
                                ₹{order.totalAmount.toFixed(2)}
                              </td>
                              <td className="border border-border px-4 py-3 text-sm text-foreground">
                                {new Date(order.orderDate).toLocaleDateString()}
                              </td>
                              <td className="border border-border px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewOrder(order)}
                                    className="text-blue-600 hover:text-blue-700"
                                    title="View Details"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditOrder(order)}
                                    className="text-green-600 hover:text-green-700"
                                    title="Edit Order"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedOrder(order);
                                      setTimeout(() => handlePrint(), 100);
                                    }}
                                    className="text-purple-600 hover:text-purple-700"
                                    title="Print Order"
                                  >
                                    <Printer className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteConfirm(order.id)}
                                    className="text-red-600 hover:text-red-700"
                                    title="Delete Order"
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
              <div className="bg-card p-6 rounded-lg border border-border">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {editingOrder ? 'Edit Order' : 'Create New Order'}
                    </h2>
                    <p className="text-muted-foreground">
                      {editingOrder ? 'Update order information and track progress' : 'Enter order details and manage the complete production lifecycle'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Order Number</p>
                    <p className="text-lg font-mono font-bold text-primary">{currentOrder.orderNumber}</p>
                  </div>
                </div>

                <OrderForm data={currentOrder} onChange={setCurrentOrder} />

                <DragDropContext onDragEnd={handleDragEnd}>
                  <OrderItemsTable
                    items={currentOrder.items}
                    onItemsChange={handleItemsChange}
                  />
                </DragDropContext>

                <ProductionTracker
                  stages={currentOrder.productionStages}
                  qualityChecks={currentOrder.qualityChecks}
                  onStagesChange={handleStagesChange}
                  onQualityChecksChange={handleQualityChecksChange}
                />

                <ShipmentTracker
                  shipmentDetails={currentOrder.shipmentDetails}
                  onShipmentChange={handleShipmentChange}
                />

                <div className="flex justify-end gap-3 pt-6 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('orders')}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveOrder}
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
                        <Package className="h-4 w-4 mr-2" />
                        {editingOrder ? 'Update Order' : 'Create Order'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'details' && selectedOrder && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Order Header */}
              <div className="bg-card p-8 rounded-2xl border border-border shadow-lg">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-foreground mb-2">Order #{selectedOrder.orderNumber}</h2>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Created: {new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{selectedOrder.customerName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        <span>{selectedOrder.customerCompany}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => handleEditOrder(selectedOrder)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit Order
                    </Button>
                    <Button
                      onClick={() => {
                        setTimeout(() => handlePrint(), 100);
                      }}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Print Order
                    </Button>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Customer Details
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {selectedOrder.customerName}</p>
                      <p><span className="text-muted-foreground">Company:</span> {selectedOrder.customerCompany || 'N/A'}</p>
                      <p className="flex items-center"><Mail className="h-3 w-3 mr-1 text-muted-foreground" /> {selectedOrder.customerEmail}</p>
                      <p className="flex items-center"><Phone className="h-3 w-3 mr-1 text-muted-foreground" /> {selectedOrder.customerPhone}</p>
                    </div>
                  </div>
                  
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      Delivery Address
                    </h4>
                    <p className="text-sm text-foreground">{selectedOrder.customerAddress}</p>
                  </div>
                  
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Order Summary
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Items:</span> {selectedOrder.items.length}</p>
                      <p><span className="text-muted-foreground">Subtotal:</span> ₹{selectedOrder.subtotal.toFixed(2)}</p>
                      <p><span className="text-muted-foreground">Total:</span> <span className="font-bold">₹{selectedOrder.totalAmount.toFixed(2)}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <OrderStatusTimeline order={selectedOrder} />

              <ProductionTracker
                stages={selectedOrder.productionStages}
                qualityChecks={selectedOrder.qualityChecks}
                onStagesChange={(stages) => {
                  const updatedOrder = { ...selectedOrder, productionStages: stages };
                  setSelectedOrder(updatedOrder);
                  // Auto-save changes
                  if (user) {
                    updateDoc(doc(db, "users", user.uid, "orders", selectedOrder.id), {
                      productionStages: stages,
                      updatedAt: new Date().toISOString()
                    }).catch(console.error);
                  }
                }}
                onQualityChecksChange={(checks) => {
                  const updatedOrder = { ...selectedOrder, qualityChecks: checks };
                  setSelectedOrder(updatedOrder);
                  // Auto-save changes
                  if (user) {
                    updateDoc(doc(db, "users", user.uid, "orders", selectedOrder.id), {
                      qualityChecks: checks,
                      updatedAt: new Date().toISOString()
                    }).catch(console.error);
                  }
                }}
              />

              {selectedOrder.shipmentDetails && (
                <ShipmentTracker
                  shipmentDetails={selectedOrder.shipmentDetails}
                  onShipmentChange={(details) => {
                    const updatedOrder = { ...selectedOrder, shipmentDetails: details };
                    setSelectedOrder(updatedOrder);
                    // Auto-save changes
                    if (user) {
                      updateDoc(doc(db, "users", user.uid, "orders", selectedOrder.id), {
                        shipmentDetails: details,
                        updatedAt: new Date().toISOString()
                      }).catch(console.error);
                    }
                  }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden Print Component */}
      <div style={{ display: 'none' }}>
        {selectedOrder && <PrintableOrder ref={printRef} data={selectedOrder} />}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <AlertDialog
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Order"
          message="Are you sure you want to delete this order? This action cannot be undone."
          type="confirm"
          onConfirm={() => handleDeleteOrder(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
    </div>
  );
}