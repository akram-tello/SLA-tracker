import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { format } from 'date-fns';
import { 
  CreditCard, 
  Truck, 
  Package, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink,
  XCircle,
  Info,
  TrendingUp,
  Shield
} from 'lucide-react';

interface StageAnalysis {
  stage: string;
  status: 'On Time' | 'At Risk' | 'Breached' | 'N/A';
  actual_time: string | null;
  sla_threshold: string;
  risk_threshold: string;
  exceeded_by: string | null;
  description: string;
}

interface OrderDetails {
  order_no: string;
  order_status: string;
  shipping_status: string;
  confirmation_status: string;
  placed_time: string;
  processed_time: string | null;
  shipped_time: string | null;
  delivered_time: string | null;
  processed_tat: string | null;
  shipped_tat: string | null;
  delivered_tat: string | null;
  currency: string;
  invoice_no: string;
  brand_name: string;
  country_code: string;
  payment: {
    card_type: string | null;
    amount: number | null;
    transaction_id: string | null;
    currency: string;
  };
  shipping: {
    shipment_id: string | null;
    shipping_method: string | null;
    carrier: string | null;
    tracking_url: string | null;
  };
  current_stage: string;
  overall_sla_status: string;
  sla_analysis: StageAnalysis[];
  updated_at: string;
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNo: string | null;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  onClose,
  orderNo
}) => {
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'sla' | 'timeline' | 'details'>('overview');

  useEffect(() => {
    if (isOpen && orderNo) {
      fetchOrderDetails();
    }
  }, [isOpen, orderNo]);

  const fetchOrderDetails = async () => {
    if (!orderNo) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH;
      const response = await fetch(`${basePath}/api/v1/orders/${orderNo}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch order details');
      }
      
      setOrderDetails(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm:ss');
    } catch {
      return 'Invalid date';
    }
  };

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': return 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700';
      case 'shipped': return 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700';
      case 'processed': return 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700';
      case 'not processed': return 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600';
      default: return 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600';
    }
  };

  const getSLAStatusColor = (status: string) => {
    switch (status) {
      case 'On Time': return 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700';
      case 'At Risk': return 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700';
      case 'Breached': return 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700';
      case 'N/A': return 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600';
      default: return 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600';
    }
  };

  const getSLAIcon = (status: string) => {
    switch (status) {
      case 'On Time': return <CheckCircle className="w-4 h-4" />;
      case 'At Risk': return <AlertTriangle className="w-4 h-4" />;
      case 'Breached': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getOverallSLAIcon = (status: string) => {
    switch (status) {
      case 'On Time': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'At Risk': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'Breached': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} showHeader={false}>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 dark:border-gray-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300 text-lg">Loading order details...</p>
          </div>
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} showHeader={false}>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 text-lg mb-2">Error loading order details</p>
            <p className="text-gray-600 dark:text-gray-300">{error}</p>
          </div>
        </div>
      </Modal>
    );
  }

  if (!orderDetails) {
    return null;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'sla', label: 'SLA Analysis', icon: TrendingUp },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'details', label: 'Details', icon: Shield }
  ] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} showHeader={false} size="3xl">
      <div className="w-full max-h-[90vh] bg-white dark:bg-zinc-950 rounded-lg shadow-xl overflow-hidden transition-colors duration-200">
        {/* Header */}
        <div className="bg-white dark:bg-zinc-950/50 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Order Details</h2>
              <p className="text-gray-600 dark:text-gray-300 mt-1">{orderDetails.order_no}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-gray-500 dark:text-gray-400 text-sm">SLA Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {getOverallSLAIcon(orderDetails.overall_sla_status)}
                  <span className="font-medium text-gray-900 dark:text-white">{orderDetails.overall_sla_status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-zinc-950/50">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-blue-400 bg-white dark:bg-zinc-950'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-950'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-zinc-950/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
                      <Package className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">Current Stage</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{orderDetails.current_stage === 'Not Processed' ? 'Not Synced to OMS' : orderDetails.current_stage === 'Processed' ? 'OMS Synced' : orderDetails.current_stage}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-zinc-950/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
                      <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">Payment</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(orderDetails.payment.amount, orderDetails.payment.currency)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-zinc-950/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
                      <Truck className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">Carrier</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {orderDetails.shipping.carrier || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              <div className="bg-white dark:bg-zinc-950/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <Info className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  Order Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Brand</p>
                    <p className="font-medium text-gray-900 dark:text-white">{orderDetails.brand_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Country</p>
                    <p className="font-medium text-gray-900 dark:text-white">{orderDetails.country_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Invoice</p>
                    <p className="font-medium text-gray-900 dark:text-white">{orderDetails.invoice_no}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Order Status</p>
                    <span className={`inline-block px-2 py-1 rounded text-sm font-medium border ${getStatusColor(orderDetails.order_status)}`}>
                      {orderDetails.order_status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Shipping Status</p>
                    <span className={`inline-block px-2 py-1 rounded text-sm font-medium border ${getStatusColor(orderDetails.shipping_status)}`}>
                      {orderDetails.shipping_status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Confirmation</p>
                    <span className={`inline-block px-2 py-1 rounded text-sm font-medium border ${getStatusColor(orderDetails.confirmation_status)}`}>
                      {orderDetails.confirmation_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* SLA Summary */}
              <div className="bg-white dark:bg-zinc-950/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  SLA Performance Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {orderDetails.sla_analysis.map((stage, index) => (
                    <div 
                      key={index}
                      className={`p-4 rounded-lg border ${
                        stage.status === 'Breached' 
                          ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30' 
                          : stage.status === 'At Risk' 
                          ? 'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30' 
                          : stage.status === 'On Time'
                          ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/30'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">{stage.stage}</h4>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${getSLAStatusColor(stage.status)}`}>
                          {getSLAIcon(stage.status)}
                          {stage.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{stage.actual_time || 'N/A'}</p>
                      {stage.exceeded_by && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                          +{stage.exceeded_by} over SLA
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sla' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
                  <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  Detailed SLA Analysis by Stage
                </h3>
                <div className="space-y-6">
                  {orderDetails.sla_analysis.map((stage, index) => (
                    <div 
                      key={index} 
                      className={`border rounded-lg p-6 ${
                        stage.status === 'Breached' 
                          ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30' 
                          : stage.status === 'At Risk' 
                          ? 'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30' 
                          : stage.status === 'On Time'
                          ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/30'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xl font-semibold text-gray-900 dark:text-white">{(stage.stage)} Stage</h4>
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded text-sm font-medium border ${getSLAStatusColor(stage.status)}`}>
                          {getSLAIcon(stage.status)}
                          {stage.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white dark:bg-gray-800/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Actual Time</p>
                          <p className="text-xl font-semibold text-gray-900 dark:text-white">{stage.actual_time || 'N/A'}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">SLA Threshold</p>
                          <p className="text-xl font-semibold text-gray-900 dark:text-white">{stage.sla_threshold}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Risk Threshold</p>
                          <p className="text-xl font-semibold text-gray-900 dark:text-white">{stage.risk_threshold}</p>
                        </div>
                      </div>
                      
                      {stage.exceeded_by && (
                        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
                          <div className="flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            <p className="text-red-800 dark:text-red-200 font-medium">
                              Exceeded SLA by: {stage.exceeded_by}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{stage.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="bg-white dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
                <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                Order Timeline
              </h3>
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-gray-600 dark:bg-gray-500 rounded-full flex items-center justify-center mr-6 relative z-10">
                      <Package className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <p className="font-semibold text-gray-900 dark:text-white">Order Placed</p>
                      <p className="text-gray-600 dark:text-gray-300">{formatDateTime(orderDetails.placed_time)}</p>
                    </div>
                  </div>
                  
                  {orderDetails.processed_time && (
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-gray-600 dark:bg-gray-500 rounded-full flex items-center justify-center mr-6 relative z-10">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <p className="font-semibold text-gray-900 dark:text-white">Order Synced to OMS</p>
                        <p className="text-gray-600 dark:text-gray-300">{formatDateTime(orderDetails.processed_time)}</p>
                        {orderDetails.processed_tat && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">TAT: {orderDetails.processed_tat}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {orderDetails.shipped_time && (
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-gray-600 dark:bg-gray-500 rounded-full flex items-center justify-center mr-6 relative z-10">
                        <Truck className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <p className="font-semibold text-gray-900 dark:text-white">Order Shipped</p>
                        <p className="text-gray-600 dark:text-gray-300">{formatDateTime(orderDetails.shipped_time)}</p>
                        {orderDetails.shipped_tat && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">TAT: {orderDetails.shipped_tat}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {orderDetails.delivered_time && (
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-gray-600 dark:bg-gray-500 rounded-full flex items-center justify-center mr-6 relative z-10">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <p className="font-semibold text-gray-900 dark:text-white">Order Delivered</p>
                        <p className="text-gray-600 dark:text-gray-300">{formatDateTime(orderDetails.delivered_time)}</p>
                        {orderDetails.delivered_tat && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">TAT: {orderDetails.delivered_tat}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Payment Information */}
              <div className="bg-white dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  Payment Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Card Type</p>
                    <p className="font-medium text-gray-900 dark:text-white">{orderDetails.payment.card_type || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Amount</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-lg">
                      {formatCurrency(orderDetails.payment.amount, orderDetails.payment.currency)}
                    </p>
                  </div>
                  <div className="md:col-span-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Transaction ID</p>
                    <p className="font-medium text-gray-900 dark:text-white break-all">{orderDetails.payment.transaction_id || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Shipping Information */}
              <div className="bg-white dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <Truck className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  Shipping Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Carrier</p>
                    <p className="font-medium text-gray-900 dark:text-white">{orderDetails.shipping.carrier || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Shipping Method</p>
                    <p className="font-medium text-gray-900 dark:text-white">{orderDetails.shipping.shipping_method || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Shipment ID</p>
                    <p className="font-medium text-gray-900 dark:text-white">{orderDetails.shipping.shipment_id || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Tracking</p>
                    {orderDetails.shipping.tracking_url ? (
                      <a 
                        href={orderDetails.shipping.tracking_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                      >
                        Track Package
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <p className="font-medium text-gray-900 dark:text-white">N/A</p>
                    )}
                  </div>
                </div>
              </div>

              {/* System Information */}
              <div className="bg-white dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  System Information
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Last Updated</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatDate(orderDetails.updated_at)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}; 