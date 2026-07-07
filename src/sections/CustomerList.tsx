import { useState, useMemo, useEffect } from 'react';
import { Search, UserPlus, Phone, Mail, MapPin, Edit2, Trash2, FileText, X, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Customer, Invoice } from '@/types';
import { toast } from 'sonner';
import { trackEvent } from '@/utils/analytics';
import { EVENTS } from '@/analytics/events';

interface CustomerListProps {
  customers: Customer[];
  invoices: Invoice[];
  onAdd: (customer: Customer) => void;
  onUpdate: (customer: Customer) => void;
  onDelete: (id: string) => void;
}

export function CustomerList({ customers, invoices, onAdd, onUpdate, onDelete }: CustomerListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    trackEvent(EVENTS.CLIENTS_PAGE_VIEWED, {
      customers_count: customers.length,
      invoices_count: invoices.length,
    });
  }, [customers.length, invoices.length]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.includes(searchQuery) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [customers, searchQuery]);

  const getCustomerInvoiceCount = (customerId: string) => {
    return invoices.filter(inv => inv.customerId === customerId).length;
  };

  const getCustomerTotalRevenue = (customerId: string) => {
    return invoices
      .filter(inv => inv.customerId === customerId && inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setEditingCustomer(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);

    trackEvent(EVENTS.CLIENT_FORM_OPENED, {
      mode: 'create',
      source: 'customers_page',
    });
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setEmail(customer.email);
    setAddress(customer.address);
    setIsAddOpen(true);

    trackEvent(EVENTS.CLIENT_FORM_OPENED, {
      mode: 'edit',
      source: 'customer_row',
      customer_id: customer.id,
      has_email: !!customer.email,
      has_phone: !!customer.phone,
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    if (editingCustomer) {
      const updated: Customer = {
        ...editingCustomer,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
      };

      onUpdate(updated);

      trackEvent(EVENTS.CLIENT_UPDATED, {
        customer_id: updated.id,
        has_email: !!updated.email,
        has_phone: !!updated.phone,
        has_address: !!updated.address,
        invoice_count: getCustomerInvoiceCount(updated.id),
      });

      toast.success('Customer updated successfully');
    } else {
      const newCustomer: Customer = {
        id: crypto.randomUUID(),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        createdAt: new Date().toISOString(),
      };

      onAdd(newCustomer);

      trackEvent(EVENTS.CLIENT_CREATED, {
        customer_id: newCustomer.id,
        has_email: !!newCustomer.email,
        has_phone: !!newCustomer.phone,
        has_address: !!newCustomer.address,
        source: 'customers_page',
      });

      toast.success('Customer added successfully');
    }

    setIsAddOpen(false);
    resetForm();
  };

  const handleDelete = (customer: Customer) => {
    const invoiceCount = getCustomerInvoiceCount(customer.id);

    if (invoiceCount > 0) {
      if (!confirm(`This customer has ${invoiceCount} invoice(s). Are you sure you want to delete them?`)) {
        return;
      }
    } else {
      if (!confirm('Are you sure you want to delete this customer?')) {
        return;
      }
    }

    onDelete(customer.id);

    trackEvent(EVENTS.CLIENT_DELETED, {
      customer_id: customer.id,
      invoice_count: invoiceCount,
      total_paid_revenue: getCustomerTotalRevenue(customer.id),
      had_email: !!customer.email,
      had_phone: !!customer.phone,
    });

    toast.success('Customer deleted');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500">Manage your customer database</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);

            trackEvent(EVENTS.CLIENT_SEARCH_USED, {
              query_length: e.target.value.length,
            });
          }}
          className="pl-9"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="bg-emerald-50 px-4 py-2 rounded-lg">
          <p className="text-2xl font-bold text-emerald-700">{customers.length}</p>
          <p className="text-xs text-emerald-600">Total Customers</p>
        </div>
      </div>

      {/* Customer List */}
      {filteredCustomers.length === 0 ? (
        <Card className="p-8 text-center">
          <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">
            {searchQuery ? 'No customers match your search' : 'No customers yet'}
          </p>
          {!searchQuery && (
            <Button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700">
              Add Your First Customer
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredCustomers.map((customer) => {
            const invoiceCount = getCustomerInvoiceCount(customer.id);
            const totalRevenue = getCustomerTotalRevenue(customer.id);
            
            return (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{customer.name}</p>
                      <div className="space-y-1 mt-2">
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            <span className="truncate">{customer.email}</span>
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate">{customer.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <FileText className="w-4 h-4" />
                        <span>{invoiceCount} invoice(s)</span>
                      </div>
                      {totalRevenue > 0 && (
                        <p className="text-sm font-medium text-emerald-600">
                          {formatCurrency(totalRevenue)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(customer)}
                      className="text-gray-600"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(customer)}
                      className="text-red-500 ml-auto"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 80X XXX XXXX"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@email.com"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Customer address"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false);
                  resetForm();
                }}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <Save className="w-4 h-4 mr-2" />
                {editingCustomer ? 'Update' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}