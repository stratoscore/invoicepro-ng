import { useState, useMemo, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Save, UserPlus, CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Invoice, InvoiceItem, Customer, BusinessInfo } from '@/types';
import { toast } from 'sonner';
import { trackEvent } from '@/utils/analytics';
import { EVENTS } from '@/analytics/events';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

interface CreateInvoiceProps {
  customers: Customer[];
  businessInfo: BusinessInfo;
  onSave: (invoice: Invoice) => void;
  onAddCustomer: (customer: Customer) => void;
  onCancel: () => void;
}

const PAYMENT_TERM_OPTIONS = [
  { label: 'Due in 7 days', days: 7 },
  { label: 'Due in 14 days', days: 14 },
  { label: 'Due in 30 days', days: 30 },
  { label: 'Due in 60 days', days: 60 },
  { label: 'Custom date', days: -1 },
];

export function CreateInvoice({ customers, onSave, onAddCustomer, onCancel }: CreateInvoiceProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('14');
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  });
  const [showCustomDate, setShowCustomDate] = useState(false);

  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // Track invoice form start only once per visit to this page
  const hasTrackedFormStart = useRef(false);

  const trackFormStart = () => {
    if (hasTrackedFormStart.current) return;

    hasTrackedFormStart.current = true;

    trackEvent(EVENTS.INVOICE_FORM_STARTED, {
      source: 'create_invoice_page',
    });
  };

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);
  const total = subtotal;

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}-${random}`;
  };

  const handleTermChange = (value: string) => {
    trackFormStart();

    setSelectedTerm(value);
    if (value === '-1') {
      setShowCustomDate(true);
    } else {
      setShowCustomDate(false);
      const date = new Date();
      date.setDate(date.getDate() + Number(value));
      setDueDate(date.toISOString().split('T')[0]);
    }
  };

  const handleAddItem = () => {
    trackFormStart();

    setItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    trackFormStart();

    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') updated.total = updated.quantity * updated.unitPrice;
        return updated;
      })
    );
  };

  const handleAddCustomer = () => {
    if (!newCustomerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      name: newCustomerName,
      phone: newCustomerPhone,
      email: newCustomerEmail,
      address: newCustomerAddress,
      createdAt: new Date().toISOString(),
    };

    onAddCustomer(newCustomer);

    trackEvent(EVENTS.CLIENT_CREATED, {
      customer_id: newCustomer.id,
      has_phone: Boolean(newCustomer.phone?.trim()),
      has_email: Boolean(newCustomer.email?.trim()),
      has_address: Boolean(newCustomer.address?.trim()),
      source: 'create_invoice_modal',
    });

    setSelectedCustomerId(newCustomer.id);
    setIsAddCustomerOpen(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerEmail('');
    setNewCustomerAddress('');
    toast.success('Customer added successfully');
  };

  const handleSave = () => {
    if (!selectedCustomer) {
      trackEvent(EVENTS.INVOICE_CREATION_FAILED, {
        reason: 'missing_customer',
      });

      toast.error('Please select a customer');
      return;
    }

    const validItems = items.filter(item => item.description.trim() && item.quantity > 0);

    if (validItems.length === 0) {
      trackEvent(EVENTS.INVOICE_CREATION_FAILED, {
        reason: 'no_valid_items',
      });

      toast.error('Please add at least one valid item');
      return;
    }

    const paymentTermsLabel =
      PAYMENT_TERM_OPTIONS.find(o => String(o.days) === selectedTerm)?.label ?? `Due by ${dueDate}`;

    const invoice: Invoice = {
      id: crypto.randomUUID(),
      invoiceNumber: generateInvoiceNumber(),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      customerEmail: selectedCustomer.email,
      customerAddress: selectedCustomer.address,
      items: validItems,
      subtotal,
      tax: 0,
      taxRate: 0,
      total,
      notes,
      paymentTerms: paymentTermsLabel,
      issueDate: new Date().toISOString(),
      dueDate,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
    };

    try {
      onSave(invoice);

      // PostHog event
      trackEvent(EVENTS.INVOICE_CREATED, {
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        customer_id: invoice.customerId,
        items_count: invoice.items.length,
        amount: invoice.total,
        currency: 'NGN',
        status: invoice.status,
        payment_terms: invoice.paymentTerms,
      });

      // Keep GA event too
      if (window.gtag) {
        window.gtag('event', 'invoice_created', {
          value: total,
          currency: 'NGN',
        });
      }

      toast.success('Invoice created successfully!');
      onCancel();
    } catch (error) {
      trackEvent(EVENTS.INVOICE_CREATION_FAILED, {
        reason: 'save_error',
        message: error instanceof Error ? error.message : 'unknown_error',
      });

      toast.error('Failed to create invoice');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Create Invoice</h2>
          <p className="text-sm text-gray-500">Fill in the details below to generate a professional invoice</p>
        </div>
      </div>

      {/* Customer Selection */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-gray-800 mb-4">Customer</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="mb-1 block text-sm text-gray-600">Select an existing customer</Label>
              <Select
                value={selectedCustomerId}
                onValueChange={(value) => {
                  trackFormStart();
                  setSelectedCustomerId(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <UserPlus className="w-4 h-4 mr-2" /> New Customer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Customer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 mt-2">
                    <div>
                      <Label className="mb-1 block">Full Name *</Label>
                      <Input
                        placeholder="e.g. John Doe"
                        value={newCustomerName}
                        onChange={e => setNewCustomerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block">Phone Number</Label>
                      <Input
                        placeholder="e.g. 08012345678"
                        value={newCustomerPhone}
                        onChange={e => setNewCustomerPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block">Email Address</Label>
                      <Input
                        placeholder="e.g. john@email.com"
                        value={newCustomerEmail}
                        onChange={e => setNewCustomerEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block">Address</Label>
                      <Textarea
                        placeholder="e.g. 12 Lagos Street, Abuja"
                        value={newCustomerAddress}
                        onChange={e => setNewCustomerAddress(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleAddCustomer} className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-white">
                      Save Customer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Items */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-gray-800 mb-4">Invoice Items</h3>

          {/* Column Labels */}
          <div className="hidden sm:grid grid-cols-12 gap-2 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide px-1">
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-center">Unit Price (₦)</div>
            <div className="col-span-2 text-center">Total</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="sm:grid sm:grid-cols-12 gap-2 flex flex-col border sm:border-0 rounded-lg sm:rounded-none p-3 sm:p-0">
                {/* Mobile label */}
                <p className="text-xs font-medium text-gray-400 sm:hidden">Item {index + 1}</p>

                <div className="sm:col-span-5">
                  <Label className="sm:hidden text-xs text-gray-500 mb-1 block">Description</Label>
                  <Input
                    placeholder="What did you provide?"
                    value={item.description}
                    onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="sm:hidden text-xs text-gray-500 mb-1 block">Quantity</Label>
                  <Input
                    type="number"
                    placeholder="1"
                    min={1}
                    value={item.quantity}
                    onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="sm:hidden text-xs text-gray-500 mb-1 block">Unit Price (₦)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    min={0}
                    value={item.unitPrice}
                    onChange={e => handleItemChange(item.id, 'unitPrice', Number(e.target.value))}
                  />
                </div>

                <div className="sm:col-span-2 flex items-center">
                  <div className="w-full">
                    <Label className="sm:hidden text-xs text-gray-500 mb-1 block">Total</Label>
                    <div className="bg-gray-50 border rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                      {formatCurrency(item.total)}
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-1 flex items-center justify-end sm:justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={items.length === 1}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={handleAddItem} className="mt-4 border-dashed">
            <Plus className="w-4 h-4 mr-1" /> Add Another Item
          </Button>
        </CardContent>
      </Card>

      {/* Payment Due Date */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-gray-800">Payment Due Date</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">When do you expect the client to pay by?</p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="mb-1 block text-sm text-gray-600">Select a payment window</Label>
              <Select value={selectedTerm} onValueChange={handleTermChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose when payment is due..." />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERM_OPTIONS.map(opt => (
                    <SelectItem key={opt.days} value={String(opt.days)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showCustomDate && (
              <div className="flex-1">
                <Label className="mb-1 block text-sm text-gray-600">Pick a specific date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => {
                    trackFormStart();
                    setDueDate(e.target.value);
                  }}
                />
              </div>
            )}
          </div>

          {!showCustomDate && dueDate && (
            <p className="text-xs text-emerald-600 mt-2 font-medium">
              Payment expected by: {new Date(dueDate).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-gray-800 mb-1">Additional Notes <span className="text-gray-400 font-normal text-sm">(optional)</span></h3>
          <p className="text-sm text-gray-500 mb-3">Add any extra information for your client e.g. bank details, thank you message.</p>
          <Textarea
            placeholder="e.g. Please transfer payment to GTBank 0123456789 (My Business Ltd). Thank you for your business!"
            value={notes}
            onChange={e => {
              trackFormStart();
              setNotes(e.target.value);
            }}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col items-end gap-2 text-sm">
            <div className="flex justify-between w-full sm:w-64">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between w-full sm:w-64 border-t pt-2 text-base font-bold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6">
          <Save className="w-4 h-4 mr-2" /> Save Invoice
        </Button>
      </div>

    </div>
  );
}