import { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Download, CheckCircle, Trash2, Eye, FileText, Plus, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Invoice, BusinessInfo, InvoiceStatus } from '@/types';
import { toast } from 'sonner';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/utils/analytics';
import { EVENTS } from '@/analytics/events';

interface InvoiceListProps {
  invoices: Invoice[];
  businessInfo: BusinessInfo;
  onMarkAsPaid: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
  initialStatusFilter?: string;
}

export function InvoiceList({
  invoices,
  businessInfo,
  onMarkAsPaid,
  onDelete,
  onCreateNew,
  initialStatusFilter = 'all',
}: InvoiceListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>(
    initialStatusFilter as InvoiceStatus | 'all'
  );
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    trackEvent(EVENTS.INVOICES_PAGE_VIEWED, {
      invoices_count: invoices.length,
      initial_status_filter: initialStatusFilter,
    });
  }, [invoices.length, initialStatusFilter]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesSearch =
        invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || getDisplayStatus(invoice) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'unpaid':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Always show overdue correctly if due date has passed
  const getDisplayStatus = (invoice: Invoice): InvoiceStatus => {
    if (invoice.status === 'paid') return 'paid';
    if (new Date(invoice.dueDate) < new Date()) return 'overdue';
    return invoice.status;
  };

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewOpen(true);

    trackEvent(EVENTS.INVOICE_VIEWED, {
      invoice_id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      customer_id: invoice.customerId,
      amount: invoice.total,
      status: getDisplayStatus(invoice),
      source: 'invoice_list',
    });
  };

  const handleDownload = async (invoice: Invoice, source: string = 'invoice_list') => {
    try {
      toast.loading('Generating PDF...');

      await generateInvoicePDF(invoice, businessInfo);

      trackEvent(EVENTS.INVOICE_DOWNLOADED_PDF, {
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        customer_id: invoice.customerId,
        amount: invoice.total,
        status: getDisplayStatus(invoice),
        source,
      });

      toast.dismiss();
      toast.success('PDF downloaded successfully!');
    } catch {
      toast.dismiss();
      toast.error('Failed to generate PDF');
    }
  };

  const handleMarkAsPaid = (id: string) => {
    const invoice = invoices.find((inv) => inv.id === id);

    onMarkAsPaid(id);

    if (invoice) {
      trackEvent(EVENTS.INVOICE_MARKED_PAID, {
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        customer_id: invoice.customerId,
        amount: invoice.total,
        previous_status: invoice.status,
      });
    }

    toast.success('Invoice marked as paid!');

    if (selectedInvoice?.id === id) {
      setSelectedInvoice((prev) =>
        prev ? { ...prev, status: 'paid', paidAt: new Date().toISOString() } : null
      );
    }
  };

  const handleDelete = (id: string) => {
    const invoice = invoices.find((inv) => inv.id === id);

    if (confirm('Are you sure you want to delete this invoice?')) {
      onDelete(id);

      if (invoice) {
        trackEvent(EVENTS.INVOICE_DELETED, {
          invoice_id: invoice.id,
          invoice_number: invoice.invoiceNumber,
          customer_id: invoice.customerId,
          amount: invoice.total,
          status: invoice.status,
        });
      }

      toast.success('Invoice deleted');

      if (selectedInvoice?.id === id) {
        setIsViewOpen(false);
        setSelectedInvoice(null);
      }
    }
  };

  const handleSendToClient = async (invoice: Invoice, source: string = 'invoice_list') => {
    if (!invoice.customerEmail) {
      toast.error('No email address on record for this client.');
      return;
    }

    setSendingEmail(true);

    try {
      const subject = encodeURIComponent(
        `Invoice ${invoice.invoiceNumber} from ${businessInfo.name}`
      );

      const body = encodeURIComponent(
        `Hi ${invoice.customerName},\n\nPlease find attached your invoice ${invoice.invoiceNumber} for ${formatCurrency(invoice.total)}.\n\nDue Date: ${formatDate(invoice.dueDate)}\n\nThank you for your business.\n\n${businessInfo.name}`
      );

      window.location.href = `mailto:${invoice.customerEmail}?subject=${subject}&body=${body}`;

      trackEvent(EVENTS.INVOICE_SENT, {
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        customer_id: invoice.customerId,
        customer_email: invoice.customerEmail,
        amount: invoice.total,
        status: getDisplayStatus(invoice),
        source,
        method: 'mailto',
      });

      toast.success('Email client opened with invoice details.');
    } catch {
      toast.error('Failed to open email client.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCreateNew = (source: string) => {
    trackEvent(EVENTS.CREATE_INVOICE_CLICKED, {
      source,
      from_view: 'invoices_page',
    });

    onCreateNew();
  };

  const handleStatusFilterChange = (value: InvoiceStatus | 'all', source: string) => {
    setStatusFilter(value);

    trackEvent(EVENTS.INVOICE_FILTER_CHANGED, {
      filter_type: 'status',
      value,
      source,
    });
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Invoices</h2>
          <p className="text-sm text-gray-500">Manage and track your invoices</p>
        </div>
        <Button
          onClick={() => handleCreateNew('invoices_header_button')}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by invoice number or client..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);

              trackEvent(EVENTS.INVOICE_SEARCH_USED, {
                query_length: e.target.value.length,
                query: e.target.value,
              });
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) =>
            handleStatusFilterChange(v as InvoiceStatus | 'all', 'status_dropdown')
          }
        >
          <SelectTrigger className="w-[140px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 cursor-pointer"
          onClick={() => handleStatusFilterChange('paid', 'status_chip_paid')}
        >
          {invoices.filter((i) => i.status === 'paid').length} Paid
        </Badge>

        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 cursor-pointer"
          onClick={() => handleStatusFilterChange('unpaid', 'status_chip_unpaid')}
        >
          {invoices.filter((i) => getDisplayStatus(i) === 'unpaid').length} Unpaid
        </Badge>

        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 cursor-pointer"
          onClick={() => handleStatusFilterChange('overdue', 'status_chip_overdue')}
        >
          {invoices.filter((i) => getDisplayStatus(i) === 'overdue').length} Overdue
        </Badge>

        <Badge
          variant="outline"
          className="bg-gray-50 text-gray-600 cursor-pointer"
          onClick={() => handleStatusFilterChange('all', 'status_chip_all')}
        >
          All
        </Badge>
      </div>

      {/* Invoice List */}
      {filteredInvoices.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          {searchQuery || statusFilter !== 'all' ? (
            <>
              <p className="text-gray-500 mb-2">No invoices match your search</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  handleStatusFilterChange('all', 'clear_filters');
                }}
                className="text-emerald-600 text-sm font-medium hover:underline"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 mb-4">No invoices yet</p>
              <Button
                onClick={() => handleCreateNew('invoices_empty_state')}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Create Your First Invoice
              </Button>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredInvoices.map((invoice) => {
            const displayStatus = getDisplayStatus(invoice);

            return (
              <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                        <Badge
                          variant="outline"
                          className={cn('text-xs capitalize', getStatusColor(displayStatus))}
                        >
                          {displayStatus}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{invoice.customerName}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>Issued: {formatDate(invoice.issueDate)}</span>
                        <span>Due: {formatDate(invoice.dueDate)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatCurrency(invoice.total)}</p>
                      <p className="text-xs text-gray-500">{invoice.items.length} item(s)</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(invoice)}
                      className="text-gray-600"
                    >
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(invoice, 'invoice_row')}
                      className="text-gray-600"
                    >
                      <Download className="w-4 h-4 mr-1" /> Download PDF
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSendToClient(invoice, 'invoice_row')}
                      className="text-blue-600"
                      disabled={sendingEmail}
                    >
                      <Send className="w-4 h-4 mr-1" /> Send to Client
                    </Button>

                    {displayStatus !== 'paid' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsPaid(invoice.id)}
                        className="text-emerald-600"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Mark Paid
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(invoice.id)}
                      className="text-red-500 ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* View Invoice Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{selectedInvoice.invoiceNumber}</span>
                  <Badge
                    className={cn(
                      'capitalize',
                      getStatusColor(getDisplayStatus(selectedInvoice))
                    )}
                  >
                    {getDisplayStatus(selectedInvoice)}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">From</p>
                    <p className="font-semibold">{businessInfo.name}</p>
                    {businessInfo.address && (
                      <p className="text-sm text-gray-600">{businessInfo.address}</p>
                    )}
                    {businessInfo.phone && (
                      <p className="text-sm text-gray-600">{businessInfo.phone}</p>
                    )}
                    {businessInfo.email && (
                      <p className="text-sm text-gray-600">{businessInfo.email}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-500">Bill To</p>
                    <p className="font-semibold">{selectedInvoice.customerName}</p>
                    {selectedInvoice.customerAddress && (
                      <p className="text-sm text-gray-600">{selectedInvoice.customerAddress}</p>
                    )}
                    {selectedInvoice.customerPhone && (
                      <p className="text-sm text-gray-600">{selectedInvoice.customerPhone}</p>
                    )}
                    {selectedInvoice.customerEmail && (
                      <p className="text-sm text-gray-600">{selectedInvoice.customerEmail}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Issue Date</p>
                    <p>{formatDate(selectedInvoice.issueDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Due Date</p>
                    <p>{formatDate(selectedInvoice.dueDate)}</p>
                  </div>
                  {selectedInvoice.paidAt && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Paid Date</p>
                      <p className="text-emerald-600">{formatDate(selectedInvoice.paidAt)}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3">Description</th>
                          <th className="text-center p-3">Qty</th>
                          <th className="text-right p-3">Unit Price</th>
                          <th className="text-right p-3">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.items.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-3">{item.description}</td>
                            <td className="text-center p-3">{item.quantity}</td>
                            <td className="text-right p-3">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="text-right p-3 font-medium">
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax ({selectedInvoice.taxRate}%)</span>
                    <span>{formatCurrency(selectedInvoice.tax)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg text-emerald-600">
                      {formatCurrency(selectedInvoice.total)}
                    </span>
                  </div>
                </div>

                {selectedInvoice.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Notes</p>
                    <p className="text-sm text-gray-600 mt-1">{selectedInvoice.notes}</p>
                  </div>
                )}

                {selectedInvoice.paymentTerms && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Payment Terms</p>
                    <p className="text-sm text-gray-600 mt-1">{selectedInvoice.paymentTerms}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4 flex-wrap">
                  <Button
                    onClick={() => handleDownload(selectedInvoice, 'invoice_dialog')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Download className="w-4 h-4 mr-2" /> Download PDF
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleSendToClient(selectedInvoice, 'invoice_dialog')}
                    className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                    disabled={sendingEmail}
                  >
                    <Send className="w-4 h-4 mr-2" /> Send to Client
                  </Button>

                  {getDisplayStatus(selectedInvoice) !== 'paid' && (
                    <Button
                      variant="outline"
                      onClick={() => handleMarkAsPaid(selectedInvoice.id)}
                      className="flex-1 border-emerald-600 text-emerald-600"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Mark as Paid
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}