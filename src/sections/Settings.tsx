import { useState, useEffect } from 'react';
import { Building2, Save, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { BusinessInfo } from '@/types';
import { toast } from 'sonner';
import { trackEvent } from '@/utils/analytics';
import { EVENTS } from '@/analytics/events';

interface SettingsProps {
  businessInfo: BusinessInfo;
  onUpdate: (info: BusinessInfo) => void;
}

export function Settings({ businessInfo, onUpdate }: SettingsProps) {
  const [name, setName] = useState(businessInfo.name);
  const [address, setAddress] = useState(businessInfo.address);
  const [phone, setPhone] = useState(businessInfo.phone);
  const [email, setEmail] = useState(businessInfo.email);

  useEffect(() => {
  trackEvent(EVENTS.SETTINGS_PAGE_VIEWED, {
    has_business_name: !!businessInfo.name,
    has_address: !!businessInfo.address,
    has_phone: !!businessInfo.phone,
    has_email: !!businessInfo.email,
  });
}, );

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Business name is required');
      return;
    }

    const updatedInfo = {
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
    };

    onUpdate(updatedInfo);

    trackEvent(EVENTS.BUSINESS_PROFILE_UPDATED, {
      has_name: !!updatedInfo.name,
      has_address: !!updatedInfo.address,
      has_phone: !!updatedInfo.phone,
      has_email: !!updatedInfo.email,
      changed_fields: [
        name !== businessInfo.name ? 'name' : null,
        address !== businessInfo.address ? 'address' : null,
        phone !== businessInfo.phone ? 'phone' : null,
        email !== businessInfo.email ? 'email' : null,
      ].filter(Boolean),
    });

    toast.success('Business information updated');
  };

  const handleCancel = () => {
    setName(businessInfo.name);
    setAddress(businessInfo.address);
    setPhone(businessInfo.phone);
    setEmail(businessInfo.email);

    trackEvent(EVENTS.SETTINGS_CANCEL_CLICKED, {
      had_unsaved_changes: true,
    });
  };

  const hasChanges = 
    name !== businessInfo.name ||
    address !== businessInfo.address ||
    phone !== businessInfo.phone ||
    email !== businessInfo.email;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
          <Building2 className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Business Settings</h2>
          <p className="text-sm text-gray-500">Manage your business information</p>
        </div>
      </div>

      {/* Business Info Form */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-sm font-medium">Business Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your business name"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Address</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your business address"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Phone Number</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 80X XXX XXXX"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Email Address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="business@email.com"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-gray-500 mb-3">Preview on Invoices</p>
          <div className="bg-white p-4 rounded-lg border">
            <p className="font-bold text-lg">{name || 'My Business'}</p>
            {address && <p className="text-sm text-gray-600 mt-1">{address}</p>}
            {phone && <p className="text-sm text-gray-600">{phone}</p>}
            {email && <p className="text-sm text-gray-600">{email}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {hasChanges && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      )}

      {/* About */}
      <Card className="bg-emerald-50 border-emerald-100">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-emerald-800">About InvoicePro NG</p>
          <p className="text-sm text-emerald-600 mt-1">
            A simple, fast invoice management platform built for Nigerian small businesses. 
            Create professional invoices, track payments, and manage customers all in one place.
          </p>
          <p className="text-xs text-emerald-500 mt-3">
            Version 1.0.0 • Made with ❤️ for Nigerian entrepreneurs
          </p>
        </CardContent>
      </Card>
    </div>
  );
}