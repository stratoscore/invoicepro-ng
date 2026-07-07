import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '@/utils/analytics';
import { EVENTS } from '@/analytics/events';

const getPageEvent = (pathname: string) => {
  switch (pathname) {
    case '/':
      return EVENTS.HOME_PAGE_VIEWED;
    case '/auth':
      return EVENTS.AUTH_PAGE_VIEWED;
    case '/about':
      return EVENTS.ABOUT_PAGE_VIEWED;
    case '/contact':
      return EVENTS.CONTACT_PAGE_VIEWED;
    case '/feedback':
      return EVENTS.FEEDBACK_PAGE_VIEWED;
    case '/dashboard':
      return EVENTS.DASHBOARD_VIEWED;
    case '/invoices':
      return EVENTS.INVOICES_PAGE_VIEWED;
    case '/create-invoice':
      return EVENTS.CREATE_INVOICE_PAGE_VIEWED;
    case '/customers':
      return EVENTS.CLIENTS_PAGE_VIEWED;
    case '/settings':
      return EVENTS.SETTINGS_PAGE_VIEWED;
    case '/upgrade':
      return EVENTS.UPGRADE_PAGE_VIEWED;
    default:
      return EVENTS.PAGE_VIEWED;
  }
};

export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    const eventName = getPageEvent(location.pathname);

    trackEvent(eventName, {
      path: location.pathname,
      search: location.search,
      full_url: window.location.href,
      title: document.title,
    });
  }, [location.pathname, location.search]);
};