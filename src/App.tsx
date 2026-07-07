import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import type { Invoice, Customer, BusinessInfo, View } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useState } from "react";
import { usePageTracking } from '@/hooks/usePageTracking';

import Home from "@/pages/Home";
import Auth from "@/pages/Auth";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Feedback from "@/pages/Feedback";
import Upgrade from '@/pages/Upgrade';

import { Dashboard } from "@/sections/Dashboard";
import { InvoiceList } from "@/sections/InvoiceList";
import { CreateInvoice } from "@/sections/CreateInvoice";
import { CustomerList } from "@/sections/CustomerList";
import { Settings } from "@/sections/Settings";

import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import { usePWAInstall } from "@/hooks/usePWAInstall";

import { trackEvent } from '@/utils/analytics';
import { EVENTS } from '@/analytics/events';

function App() {
  usePageTracking();

  const navigate = useNavigate();
  const location = useLocation();

  const publicPaths = ["/", "/auth", "/about", "/contact", "/feedback"];
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');

  const [invoices, setInvoices] = useLocalStorage<Invoice[]>("invoicepro_invoices", []);
  const [customers, setCustomers] = useLocalStorage<Customer[]>("invoicepro_customers", []);
  const [businessInfo, setBusinessInfo] = useLocalStorage<BusinessInfo>("invoicepro_business", {
    name: "My Business",
    address: "",
    phone: "",
    email: "",
  });

  const isLoggedIn = !!localStorage.getItem("invoicepro_session");
  const { isInstallable, installApp } = usePWAInstall();

  // ================= ACTIONS =================
  const addInvoice = (invoice: Invoice) => {
    setInvoices((prev) => [invoice, ...prev]);
  };

  const deleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  const markAsPaid = (id: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id
          ? { ...inv, status: "paid" as const, paidAt: new Date().toISOString() }
          : inv
      )
    );
  };

  const addCustomer = (customer: Customer) => {
    setCustomers((prev) => [customer, ...prev]);
  };

  const updateCustomer = (updatedCustomer: Customer) => {
    setCustomers((prev) =>
      prev.map((cust) => (cust.id === updatedCustomer.id ? updatedCustomer : cust))
    );
  };

  const deleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((cust) => cust.id !== id));
  };

  const handleLogout = () => {
    trackEvent(EVENTS.USER_LOGGED_OUT, {
      current_path: location.pathname,
      invoices_count: invoices.length,
      customers_count: customers.length,
    });

    localStorage.removeItem("invoicepro_session");
    navigate("/");
  };

  const handleBottomNavNavigate = (view: View) => {
    trackEvent(EVENTS.BOTTOM_NAV_CLICKED, {
      from: location.pathname.replace('/', '') || 'dashboard',
      to: view,
    });

    navigate(`/${view}`);
  };

  const handleInstallApp = () => {
    trackEvent(EVENTS.PWA_INSTALL_CLICKED, {
      current_path: location.pathname,
    });

    installApp();
  };

  // ================= UI =================
  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      {isLoggedIn && !publicPaths.includes(location.pathname) && (
        <Header
          businessName={businessInfo.name}
          onSettings={() => {
            trackEvent(EVENTS.SETTINGS_OPENED_FROM_HEADER, {
              from: location.pathname,
            });
            navigate("/settings");
          }}
          onLogout={handleLogout}
          onUpgrade={() => {
            trackEvent(EVENTS.UPGRADE_OPENED, {
              from: location.pathname,
            });
            navigate('/upgrade');
          }}
        />
      )}

      <main className="pb-20 md:pb-0">
        <Routes>
          {/* Public */}
          <Route
            path="/"
            element={
              <Home
                onGetStarted={() => navigate("/auth?mode=signup")}
                onLogin={() => navigate("/auth")}
                onAbout={() => navigate("/about")}
                onContact={() => navigate("/contact")}
                onFeedback={() => navigate("/feedback")}
              />
            }
          />

          <Route
            path="/auth"
            element={
              <Auth
                onAuthSuccess={() => navigate("/dashboard")}
                onBack={() => navigate("/")}
              />
            }
          />

          <Route
            path="/about"
            element={<About onGetStarted={() => navigate("/auth")} />}
          />

          <Route path="/contact" element={<Contact />} />
          <Route path="/feedback" element={<Feedback />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              isLoggedIn ? (
                <Dashboard
                  invoices={invoices}
                  onCreateInvoice={() => navigate('/create-invoice')}
                  onViewInvoices={() => navigate('/invoices')}
                  onViewCustomers={() => navigate('/customers')}
                  onViewInvoicesByStatus={(status) => {
                    setInvoiceStatusFilter(status);
                    navigate('/invoices');
                  }}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />

          <Route
            path="/invoices"
            element={
              isLoggedIn ? (
                <InvoiceList
                  invoices={invoices}
                  businessInfo={businessInfo}
                  onMarkAsPaid={markAsPaid}
                  onDelete={deleteInvoice}
                  onCreateNew={() => navigate('/create-invoice')}
                  initialStatusFilter={invoiceStatusFilter}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />

          <Route
            path="/create-invoice"
            element={
              isLoggedIn ? (
                <CreateInvoice
                  customers={customers}
                  businessInfo={businessInfo}
                  onSave={(inv) => {
                    addInvoice(inv);
                    navigate("/invoices");
                  }}
                  onAddCustomer={addCustomer}
                  onCancel={() => navigate("/invoices")}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />

          <Route
            path="/customers"
            element={
              isLoggedIn ? (
                <CustomerList
                  customers={customers}
                  invoices={invoices}
                  onAdd={addCustomer}
                  onUpdate={updateCustomer}
                  onDelete={deleteCustomer}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />

          <Route
            path="/settings"
            element={
              isLoggedIn ? (
                <Settings
                  businessInfo={businessInfo}
                  onUpdate={setBusinessInfo}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />

          <Route
            path="/upgrade"
            element={
              isLoggedIn ? (
                <Upgrade
                  onBack={() => navigate('/dashboard')}
                  onProceedToPayment={(plan) => {
                    trackEvent(EVENTS.UPGRADE_PAYMENT_STARTED, {
                      plan,
                      from: location.pathname,
                    });

                    console.log('Proceeding to payment:', plan);
                  }}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />
        </Routes>
      </main>

      {/* Install Button */}
      {isInstallable && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={handleInstallApp}
            className="px-4 py-2 bg-green-600 text-white rounded-md shadow-md hover:bg-green-700 transition font-bold text-sm"
          >
            Install InvoicePro NG
          </button>
        </div>
      )}

      {/* Bottom Nav */}
      {isLoggedIn && !publicPaths.includes(location.pathname) && (
        <BottomNav
          currentView={(location.pathname.replace('/', '') as View) || 'dashboard'}
          onNavigate={handleBottomNavNavigate}
        />
      )}

      <Toaster position="top-center" />
    </div>
  );
}

export default App;