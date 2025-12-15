import { FormEvent, useEffect, useMemo, useState } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';

type City = {
  id: string;
  name: string;
};

type AdditionalRouter = {
  userName: string;
  ipNumber: string;
};

type Customer = {
  id: string;
  cityId: string;
  name: string;
  phone?: string;
  startDate?: string;
  subscriptionValue?: number;
  setupFeeTotal?: number;
  setupFeePaid?: number;
  ipNumber?: string;
  userName?: string;
  additionalRouters?: AdditionalRouter[];
  lap?: string;
  site?: string;
  notes?: string;
  paymentStatus?: 'paid' | 'unpaid';
  monthlyPayments?: { [yearMonth: string]: 'paid' | 'partial' | 'pending' };
};

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatDate = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
};

function App() {
  const [cities, setCities] = useState<City[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [subscriptionValue, setSubscriptionValue] = useState('');
  const [setupFeeTotal, setSetupFeeTotal] = useState('');
  const [setupFeePaid, setSetupFeePaid] = useState('');
  const [ipNumber, setIpNumber] = useState('');
  const [userName, setUserName] = useState('');
  const [additionalRouterCount, setAdditionalRouterCount] = useState(0);
  const [additionalRouters, setAdditionalRouters] = useState<AdditionalRouter[]>([]);
  const [lap, setLap] = useState('');
  const [site, setSite] = useState('');
  const [notes, setNotes] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'yearly'>('dashboard');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearlyCityId, setYearlyCityId] = useState<string | null>(null);
  const [invoiceCityId, setInvoiceCityId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [confirmStatusChange, setConfirmStatusChange] = useState<{customer: Customer; newStatus: 'paid' | 'unpaid'} | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'city' | 'customer'; id: string; name: string} | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);
  const [editPasswordModal, setEditPasswordModal] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [pendingEditCustomer, setPendingEditCustomer] = useState<Customer | null>(null);
  const [transferModal, setTransferModal] = useState(false);
  const [transferCustomer, setTransferCustomer] = useState<Customer | null>(null);
  const [transferCityId, setTransferCityId] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const selectedCity = useMemo(
    () => cities.find((city) => city.id === selectedCityId) ?? null,
    [cities, selectedCityId]
  );

  const filteredCustomers = useMemo(
    () =>
      selectedCityId
        ? customers.filter((c) => c.cityId === selectedCityId)
        : [],
    [customers, selectedCityId]
  );

  const invoiceFilteredCustomers = useMemo(
    () =>
      invoiceCityId
        ? customers.filter((c) => c.cityId === invoiceCityId)
        : [],
    [customers, invoiceCityId]
  );

  // Listen for auth state changes (persist login on refresh)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load data from Firestore on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    setLoading(true);

    // Listen to cities collection
    const unsubscribeCities = onSnapshot(collection(db, 'cities'), (snapshot) => {
      const citiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as City));
      setCities(citiesData);
    });

    // Listen to customers collection
    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(customersData);
      setLoading(false);
    });

    return () => {
      unsubscribeCities();
      unsubscribeCustomers();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 2200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Handle additional router count change
  const handleAdditionalRouterCountChange = (count: number) => {
    setAdditionalRouterCount(count);
    const newRouters: AdditionalRouter[] = [];
    for (let i = 0; i < count; i++) {
      newRouters.push(additionalRouters[i] || { userName: '', ipNumber: '' });
    }
    setAdditionalRouters(newRouters);
  };

  const updateAdditionalRouter = (index: number, field: 'userName' | 'ipNumber', value: string) => {
    const updated = [...additionalRouters];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalRouters(updated);
  };

  const handleAddCity = async (e: FormEvent) => {
    e.preventDefault();
    const cityName = (e.target as HTMLFormElement).elements.namedItem('cityName') as HTMLInputElement;
    if (!cityName.value.trim()) {
      setToastMessage('أدخل اسم المدينة');
      return;
    }

    const newCity: City = { id: Math.random().toString(36).slice(2), name: cityName.value };
    
    try {
      await setDoc(doc(db, 'cities', newCity.id), { name: newCity.name });
      setToastMessage(`تم إضافة المدينة: ${cityName.value}`);
      cityName.value = '';
    } catch (error) {
      setToastMessage('خطأ في إضافة المدينة');
      console.error(error);
    }
  };

  const handleDeleteCity = (cityId: string) => {
    const city = cities.find(c => c.id === cityId);
    setDeleteConfirm({ type: 'city', id: cityId, name: city?.name || '' });
  };

  const executeDeleteCity = async (cityId: string) => {
    try {
      // Delete city
      await deleteDoc(doc(db, 'cities', cityId));
      
      // Delete all customers in this city
      const cityCustomers = customers.filter(c => c.cityId === cityId);
      for (const customer of cityCustomers) {
        await deleteDoc(doc(db, 'customers', customer.id));
      }
      
      if (selectedCityId === cityId) {
        setSelectedCityId(null);
      }
      
      setToastMessage('تم حذف المدينة');
    } catch (error) {
      setToastMessage('خطأ في حذف المدينة');
      console.error(error);
    }
  };

  const handleAddCustomer = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCityId) {
      setToastMessage('اختر مدينة أولاً');
      return;
    }

    if (!customerName.trim()) {
      setToastMessage('أدخل اسم العميل');
      return;
    }

    const customerId = Math.random().toString(36).slice(2);
    
    // Build customer data without undefined values (Firestore doesn't accept undefined)
    const customerData: Record<string, unknown> = {
      cityId: selectedCityId,
      name: customerName,
      paymentStatus: 'unpaid',
    };
    
    if (customerPhone) customerData.phone = customerPhone;
    if (startDate) customerData.startDate = startDate;
    if (subscriptionValue) customerData.subscriptionValue = parseFloat(subscriptionValue);
    if (setupFeeTotal) customerData.setupFeeTotal = parseFloat(setupFeeTotal);
    if (setupFeePaid) customerData.setupFeePaid = parseFloat(setupFeePaid);
    if (ipNumber) customerData.ipNumber = ipNumber;
    if (userName) customerData.userName = userName;
    if (additionalRouters.length > 0) customerData.additionalRouters = additionalRouters;
    if (lap) customerData.lap = lap;
    if (site) customerData.site = site;
    if (notes) customerData.notes = notes;

    try {
      await setDoc(doc(db, 'customers', customerId), customerData);
      setToastMessage(`تم إضافة العميل: ${customerName}`);
      
      setCustomerName('');
      setCustomerPhone('');
      setStartDate('');
      setSubscriptionValue('');
      setSetupFeeTotal('');
      setSetupFeePaid('');
      setIpNumber('');
      setUserName('');
      setAdditionalRouterCount(0);
      setAdditionalRouters([]);
      setLap('');
      setSite('');
      setNotes('');
    } catch (error) {
      setToastMessage('خطأ في إضافة العميل');
      console.error(error);
    }
  };

  const handleDeleteCustomer = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setDeleteConfirm({ type: 'customer', id: customerId, name: customer?.name || '' });
  };

  const executeDeleteCustomer = async (customerId: string) => {
    try {
      await deleteDoc(doc(db, 'customers', customerId));
      setToastMessage('تم حذف العميل');
    } catch (error) {
      setToastMessage('خطأ في حذف العميل');
      console.error(error);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || !deletePassword.trim()) {
      setToastMessage('أدخل كلمة المرور');
      return;
    }

    setDeleteLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        setToastMessage('خطأ في المصادقة');
        return;
      }

      // التحقق من كلمة المرور
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);

      // تنفيذ الحذف
      if (deleteConfirm.type === 'city') {
        await executeDeleteCity(deleteConfirm.id);
      } else {
        await executeDeleteCustomer(deleteConfirm.id);
      }

      setDeleteConfirm(null);
      setDeletePassword('');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setToastMessage('كلمة المرور غير صحيحة');
      } else {
        setToastMessage('خطأ في التحقق');
        console.error(error);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleTogglePaymentStatus = (customer: Customer, newStatus: 'paid' | 'unpaid') => {
    setConfirmStatusChange({ customer, newStatus });
  };

  const confirmPaymentStatusChange = async () => {
    if (!confirmStatusChange) return;
    
    try {
      await setDoc(doc(db, 'customers', confirmStatusChange.customer.id), {
        ...confirmStatusChange.customer,
        paymentStatus: confirmStatusChange.newStatus,
      });
      
      const statusText = confirmStatusChange.newStatus === 'paid' ? 'مدفوع' : 'غير مسدد';
      setToastMessage(`تم تغيير حالة ${confirmStatusChange.customer.name} إلى ${statusText}`);
      setConfirmStatusChange(null);
    } catch (error) {
      setToastMessage('خطأ في تغيير الحالة');
      console.error(error);
    }
  };

  const openCustomerDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowCustomerModal(true);
  };

  const openEditCustomer = (customer: Customer) => {
    setPendingEditCustomer(customer);
    setEditPasswordModal(true);
    setEditPassword('');
  };

  const openTransferCustomer = (customer: Customer) => {
    setTransferCustomer(customer);
    setTransferCityId('');
    setTransferPassword('');
    setTransferModal(true);
  };

  const confirmTransferCustomer = async () => {
    if (!transferCustomer || !transferCityId || !transferPassword.trim()) {
      setToastMessage('يرجى اختيار المدينة وإدخال كلمة المرور');
      return;
    }

    if (transferCityId === transferCustomer.cityId) {
      setToastMessage('العميل موجود بالفعل في هذه المدينة');
      return;
    }

    setTransferLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        setToastMessage('خطأ في المصادقة');
        return;
      }

      // التحقق من كلمة المرور
      const credential = EmailAuthProvider.credential(user.email, transferPassword);
      await reauthenticateWithCredential(user, credential);

      // نقل العميل للمدينة الجديدة
      await setDoc(doc(db, 'customers', transferCustomer.id), {
        ...transferCustomer,
        cityId: transferCityId,
      });

      const newCity = cities.find(c => c.id === transferCityId);
      setToastMessage(`تم نقل ${transferCustomer.name} إلى ${newCity?.name}`);
      setTransferModal(false);
      setTransferCustomer(null);
      setTransferCityId('');
      setTransferPassword('');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setToastMessage('كلمة المرور غير صحيحة');
      } else {
        setToastMessage('خطأ في نقل العميل');
        console.error(error);
      }
    } finally {
      setTransferLoading(false);
    }
  };

  const confirmEditPassword = async () => {
    if (!pendingEditCustomer || !editPassword.trim()) {
      setToastMessage('أدخل كلمة المرور');
      return;
    }

    setEditLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        setToastMessage('خطأ في المصادقة');
        return;
      }

      const credential = EmailAuthProvider.credential(user.email, editPassword);
      await reauthenticateWithCredential(user, credential);

      // فتح نافذة التعديل
      setEditingCustomer({ ...pendingEditCustomer, additionalRouters: pendingEditCustomer.additionalRouters ? [...pendingEditCustomer.additionalRouters] : [] });
      setShowEditModal(true);
      setEditPasswordModal(false);
      setPendingEditCustomer(null);
      setEditPassword('');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setToastMessage('كلمة المرور غير صحيحة');
      } else {
        setToastMessage('خطأ في التحقق');
        console.error(error);
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditCustomer = (field: keyof Customer, value: string | number) => {
    if (!editingCustomer) return;
    setEditingCustomer({ ...editingCustomer, [field]: value });
  };

  const handleEditAdditionalRouterCount = (count: number) => {
    if (!editingCustomer) return;
    const newRouters: AdditionalRouter[] = [];
    for (let i = 0; i < count; i++) {
      newRouters.push(editingCustomer.additionalRouters?.[i] || { userName: '', ipNumber: '' });
    }
    setEditingCustomer({ ...editingCustomer, additionalRouters: newRouters });
  };

  const updateEditAdditionalRouter = (index: number, field: 'userName' | 'ipNumber', value: string) => {
    if (!editingCustomer || !editingCustomer.additionalRouters) return;
    const updated = [...editingCustomer.additionalRouters];
    updated[index] = { ...updated[index], [field]: value };
    setEditingCustomer({ ...editingCustomer, additionalRouters: updated });
  };

  const saveEditedCustomer = async () => {
    if (!editingCustomer) return;
    
    try {
      const { id, ...customerData } = editingCustomer;
      // Remove undefined values for Firestore
      const cleanData: Record<string, unknown> = {};
      Object.entries(customerData).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          cleanData[key] = val;
        }
      });
      await setDoc(doc(db, 'customers', id), cleanData);
      
      setToastMessage(`تم تحديث بيانات ${editingCustomer.name}`);
      setShowEditModal(false);
      setEditingCustomer(null);
    } catch (error) {
      setToastMessage('خطأ في تحديث البيانات');
      console.error(error);
    }
  };

  // فاتورة التأسيس - تظهر رسوم التأسيس والمدفوع والمتبقي
  const generateSetupInvoicePDF = async (customer: Customer) => {
    const html2pdf = (await import('html2pdf.js')).default;
    const city = cities.find((c) => c.id === customer.cityId);
    const setupRemaining = (customer.setupFeeTotal ?? 0) - (customer.setupFeePaid ?? 0);

    const invoiceHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', Arial, sans-serif; }
          body { color: #1a1a1a; line-height: 1.6; direction: rtl; font-size: 14px; padding: 20px; }
          .header { border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
          .header table { width: 100%; }
          .company { font-size: 28px; font-weight: 700; color: #1e40af; }
          .invoice-type { font-size: 16px; color: #f59e0b; font-weight: 600; }
          .invoice-info { font-size: 12px; text-align: left; }
          .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
          .section-title { font-size: 14px; font-weight: 700; color: white; background: #1e40af; padding: 10px 15px; }
          .data-table { width: 100%; border-collapse: collapse; }
          .data-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .data-table tr:last-child td { border-bottom: none; }
          .data-table .label { color: #64748b; width: 40%; }
          .data-table .value { font-weight: 600; color: #1e293b; }
          .financial-table { width: 100%; border-collapse: collapse; }
          .financial-table th { background: #1e40af; color: white; padding: 12px 15px; text-align: right; font-size: 13px; }
          .financial-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .financial-table .highlight { background: #fef3c7; font-weight: 700; }
          .footer { text-align: center; padding-top: 20px; margin-top: 30px; border-top: 2px solid #e2e8f0; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <table>
            <tr>
              <td style="vertical-align: middle;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <svg width="40" height="28" viewBox="0 0 56 28" fill="none">
                    <polygon points="4,4 4,24 18,14" fill="#1e40af" />
                    <polygon points="20,4 20,24 34,14" fill="#60a5fa" />
                  </svg>
                  <div>
                    <div class="company">DATA HUB</div>
                    <div class="invoice-type">فاتورة تأسيس</div>
                  </div>
                </div>
              </td>
              <td class="invoice-info" style="vertical-align: top;">
                <div><strong>رقم الفاتورة:</strong> SET-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}</div>
                <div><strong>التاريخ:</strong> ${formatDate(todayISO())}</div>
              </td>
          <table class="financial-table">
            <thead>
              <tr><th>البيان</th><th>المبلغ (﷼)</th></tr>
            </thead>
            <tbody>
              <tr><td>إجمالي رسوم التأسيس</td><td>${customer.setupFeeTotal ?? 0}</td></tr>
              <tr><td>المبلغ المدفوع</td><td>${customer.setupFeePaid ?? 0}</td></tr>
              <tr class="highlight"><td><strong>المتبقي</strong></td><td><strong>${setupRemaining}</strong></td></tr>
            </tbody>
          </table>
        </div>
        
        ${customer.notes ? `
        <div class="section">
          <div class="section-title">ملاحظات</div>
          <div style="padding: 15px; font-size: 13px; color: #374151;">${customer.notes}</div>
        </div>
        ` : ''}
        
        <div class="footer">
          <p>شكراً لتعاملكم معنا | © 2025 DATA HUB</p>
        </div>
      </body>
      </html>
    `;

    const options = {
      margin: 10,
      filename: `فاتورة_تأسيس_${customer.name}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait' as const, unit: 'mm' as const, format: 'a4' as const }
    };
    html2pdf().set(options).from(invoiceHTML).save();
    setToastMessage(`تم إصدار فاتورة التأسيس لـ ${customer.name}`);
  };

  // فاتورة الاشتراك - تظهر قيمة الاشتراك وحالة الدفع
  const generateSubscriptionInvoicePDF = async (customer: Customer) => {
    const html2pdf = (await import('html2pdf.js')).default;
    const city = cities.find((c) => c.id === customer.cityId);
    const isPaid = customer.paymentStatus === 'paid';

    const invoiceHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', Arial, sans-serif; }
          body { color: #1a1a1a; line-height: 1.6; direction: rtl; font-size: 14px; padding: 20px; }
          .header { border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
          .header table { width: 100%; }
          .company { font-size: 28px; font-weight: 700; color: #1e40af; }
          .invoice-type { font-size: 16px; color: #06b6d4; font-weight: 600; }
          .invoice-info { font-size: 12px; text-align: left; }
          .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
          .section-title { font-size: 14px; font-weight: 700; color: white; background: #1e40af; padding: 10px 15px; }
          .data-table { width: 100%; border-collapse: collapse; }
          .data-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .data-table tr:last-child td { border-bottom: none; }
          .data-table .label { color: #64748b; width: 40%; }
          .data-table .value { font-weight: 600; color: #1e293b; }
          .subscription-box { background: #e0f2fe; border: 2px solid #0ea5e9; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
          .subscription-label { font-size: 14px; color: #64748b; margin-bottom: 10px; }
          .subscription-value { font-size: 32px; font-weight: 700; color: #1e40af; }
          .status-box { border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
          .status-paid { background: #dcfce7; border: 2px solid #22c55e; }
          .status-unpaid { background: #fee2e2; border: 2px solid #ef4444; }
          .status-label { font-size: 14px; color: #64748b; margin-bottom: 10px; }
          .status-value { font-size: 24px; font-weight: 700; }
          .status-paid .status-value { color: #16a34a; }
          .status-unpaid .status-value { color: #dc2626; }
          .footer { text-align: center; padding-top: 20px; margin-top: 30px; border-top: 2px solid #e2e8f0; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <table>
            <tr>
              <td style="vertical-align: middle;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <svg width="40" height="28" viewBox="0 0 56 28" fill="none">
                    <polygon points="4,4 4,24 18,14" fill="#1e40af" />
                    <polygon points="20,4 20,24 34,14" fill="#60a5fa" />
                  </svg>
                  <div>
                    <div class="company">DATA HUB</div>
                    <div class="invoice-type">فاتورة اشتراك شهري</div>
                  </div>
                </div>
              </td>
              <td class="invoice-info" style="vertical-align: top;">
                <div><strong>رقم الفاتورة:</strong> SUB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}</div>
                <div><strong>التاريخ:</strong> ${formatDate(todayISO())}</div>
              </td>
            </tr>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">بيانات العميل</div>
          <table class="data-table">
            <tr><td class="label">اسم العميل</td><td class="value">${customer.name}</td></tr>
            <tr><td class="label">رقم الجوال</td><td class="value">${customer.phone || '-'}</td></tr>
            <tr><td class="label">المدينة</td><td class="value">${city?.name || '-'}</td></tr>
            <tr><td class="label">الموقع</td><td class="value">${customer.site || '-'}</td></tr>
            <tr><td class="label">تاريخ بدء الاشتراك</td><td class="value">${customer.startDate ? formatDate(customer.startDate) : '-'}</td></tr>
          </table>
        </div>
        
        <div class="subscription-box">
          <div class="subscription-label">قيمة الاشتراك الشهري</div>
          <div class="subscription-value">${customer.subscriptionValue ?? 0} ﷼</div>
        </div>
        
        <div class="status-box ${isPaid ? 'status-paid' : 'status-unpaid'}">
          <div class="status-label">حالة السداد</div>
          <div class="status-value">${isPaid ? '✓ مدفوع' : '✗ غير مسدد'}</div>
        </div>
        
        ${customer.notes ? `
        <div class="section">
          <div class="section-title">ملاحظات</div>
          <div style="padding: 15px; font-size: 13px; color: #374151;">${customer.notes}</div>
        </div>
        ` : ''}
        
        <div class="footer">
          <p>شكراً لتعاملكم معنا | © 2025 DATA HUB</p>
        </div>
      </body>
      </html>
    `;

    const options = {
      margin: 10,
      filename: `فاتورة_اشتراك_${customer.name}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait' as const, unit: 'mm' as const, format: 'a4' as const }
    };
    html2pdf().set(options).from(invoiceHTML).save();
    setToastMessage(`تم إصدار فاتورة الاشتراك لـ ${customer.name}`);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setToastMessage('أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, username, password);
      setUsername('');
      setPassword('');
      setToastMessage('تم التحقق بنجاح');
    } catch (error: any) {
      const errorMessage = 
        error.code === 'auth/user-not-found' ? 'المستخدم غير موجود' :
        error.code === 'auth/wrong-password' ? 'كلمة المرور غير صحيحة' :
        error.code === 'auth/invalid-email' ? 'البريد الإلكتروني غير صحيح' :
        error.code === 'auth/user-disabled' ? 'المستخدم معطّل' :
        'فشل الدخول - حاول مرة أخرى';
      setToastMessage(errorMessage);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setToastMessage('تم تسجيل الخروج بنجاح');
    } catch (error) {
      setToastMessage('خطأ في تسجيل الخروج');
    }
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <svg width="50" height="35" viewBox="0 0 56 28" fill="none">
              <polygon points="4,4 4,24 18,14" fill="#1e40af" />
              <polygon points="20,4 20,24 34,14" fill="#60a5fa" />
            </svg>
            <h1>DATA HUB</h1>
          </div>
          <p style={{ textAlign: 'center', color: '#6b7280' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <svg width="50" height="35" viewBox="0 0 56 28" fill="none">
              <polygon points="4,4 4,24 18,14" fill="#1e40af" />
              <polygon points="20,4 20,24 34,14" fill="#60a5fa" />
            </svg>
            <h1>DATA HUB</h1>
          </div>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="البريد الإلكتروني" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit">دخول</button>
          </form>
        </div>
        {toastMessage && <div className="toast">{toastMessage}</div>}
      </div>
    );
  }

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <svg width="40" height="28" viewBox="0 0 56 28" fill="none">
            <polygon points="4,4 4,24 18,14" fill="#1e40af" />
            <polygon points="20,4 20,24 34,14" fill="#60a5fa" />
          </svg>
          <div className="brand-text">DATA HUB</div>
        </div>
        <button onClick={handleLogout} className="btn secondary">تسجيل خروج</button>
      </header>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>لوحة التحكم</button>
        <button className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>الفواتير</button>
        <button className={`tab-btn ${activeTab === 'yearly' ? 'active' : ''}`} onClick={() => setActiveTab('yearly')}>متابعة الاشتراكات</button>
      </div>

      {loading ? (
        <div className="loading">جاري التحميل...</div>
      ) : (
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <>
            <div className="section">
              <div className="section-header">
                <h2>المدن</h2>
                <button type="button" className="btn-add" onClick={() => {
                  const name = prompt('أدخل اسم المدينة:');
                  if (name && name.trim()) {
                    const id = crypto.randomUUID();
                    setDoc(doc(db, 'cities', id), { id, name: name.trim() });
                    setToastMessage('تمت إضافة المدينة');
                  }
                }}>+</button>
              </div>
              <div className="city-list">
                {cities.map((city) => (
                  <div key={city.id} className={`city-card ${selectedCityId === city.id ? 'active' : ''}`} onClick={() => setSelectedCityId(city.id)}>
                    <span>{city.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCity(city.id); }} className="btn danger">حذف</button>
                  </div>
                ))}
              </div>
            </div>

            {selectedCity && (
              <div className="section">
                <div className="section-header">
                  <h2>عملاء {selectedCity.name}</h2>
                  <button type="button" className="btn-add" onClick={() => setShowAddCustomerForm(!showAddCustomerForm)}>
                    {showAddCustomerForm ? '×' : '+'}
                  </button>
                </div>
                {showAddCustomerForm && (
                <form onSubmit={handleAddCustomer} className="form-group customer-form-collapsible">
                  <input type="text" placeholder="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                  <input type="text" placeholder="رقم العميل (الجوال)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  <div className="date-field">
                    <label>تاريخ بدء الاشتراك</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <input type="number" placeholder="قيمة الاشتراك" value={subscriptionValue} onChange={(e) => setSubscriptionValue(e.target.value)} />
                  <input type="number" placeholder="رسوم التأسيس" value={setupFeeTotal} onChange={(e) => setSetupFeeTotal(e.target.value)} />
                  <input type="number" placeholder="المدفوع" value={setupFeePaid} onChange={(e) => setSetupFeePaid(e.target.value)} />
                  <div className="calculated-field">
                    <span>المتبقي: </span>
                    <strong>{(parseFloat(setupFeeTotal) || 0) - (parseFloat(setupFeePaid) || 0)} ﷼</strong>
                  </div>
                  <input type="text" placeholder="IP Number (الراوتر الأساسي)" value={ipNumber} onChange={(e) => setIpNumber(e.target.value)} />
                  <input type="text" placeholder="User Name (الراوتر الأساسي)" value={userName} onChange={(e) => setUserName(e.target.value)} />
                  
                  <div className="router-section">
                    <label>عدد الراوترات الإضافية:</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="10"
                      value={additionalRouterCount} 
                      onChange={(e) => handleAdditionalRouterCountChange(parseInt(e.target.value) || 0)} 
                    />
                  </div>
                  
                  {additionalRouters.map((router, index) => (
                    <div key={index} className="additional-router-fields">
                      <div className="router-label">راوتر إضافي {index + 1}</div>
                      <input 
                        type="text" 
                        placeholder={`User Name - راوتر ${index + 1}`}
                        value={router.userName} 
                        onChange={(e) => updateAdditionalRouter(index, 'userName', e.target.value)} 
                      />
                      <input 
                        type="text" 
                        placeholder={`IP Number - راوتر ${index + 1}`}
                        value={router.ipNumber} 
                        onChange={(e) => updateAdditionalRouter(index, 'ipNumber', e.target.value)} 
                      />
                    </div>
                  ))}
                  
                  <input type="text" placeholder="LAP" value={lap} onChange={(e) => setLap(e.target.value)} />
                  <input type="text" placeholder="الموقع" value={site} onChange={(e) => setSite(e.target.value)} />
                  <textarea placeholder="ملاحظات إضافية" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <button type="submit" className="btn primary">إضافة عميل</button>
                </form>
                )}

                <div className="customer-list">
                  {filteredCustomers.map((customer) => {
                    const remaining = (customer.setupFeeTotal ?? 0) - (customer.setupFeePaid ?? 0);
                    const isPaid = customer.paymentStatus === 'paid';
                    return (
                    <div key={customer.id} className="customer-card">
                      <div className="customer-header">
                        <strong>{customer.name}</strong>
                        <div className="customer-actions-top">
                          <button onClick={() => openCustomerDetails(customer)} className="btn info btn-sm">معلومات</button>
                          <button onClick={() => openEditCustomer(customer)} className="btn edit btn-sm">تعديل</button>
                          <button onClick={() => openTransferCustomer(customer)} className="btn primary btn-sm">نقل</button>
                          <button 
                            onClick={() => handleTogglePaymentStatus(customer, isPaid ? 'unpaid' : 'paid')} 
                            className={`btn btn-sm ${isPaid ? 'success' : 'warning'}`}
                          >
                            {isPaid ? '✓ مدفوع' : '✗ غير مسدد'}
                          </button>
                        </div>
                      </div>
                      <div className="small">{customer.phone || '-'} • {customer.ipNumber || '-'}</div>
                      <div className="small">المتبقي: {remaining} ﷼</div>
                      <div className="actions">
                        <button onClick={() => generateSetupInvoicePDF(customer)} className="btn warning">تأسيس</button>
                        <button onClick={() => generateSubscriptionInvoicePDF(customer)} className="btn secondary">اشتراك</button>
                        <button onClick={() => handleDeleteCustomer(customer.id)} className="btn danger">حذف</button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'invoices' && (
          <div className="section">
            <h2>الفواتير</h2>
            <select value={invoiceCityId || ''} onChange={(e) => setInvoiceCityId(e.target.value || null)} className="input">
              <option value="">اختر مدينة</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>

            <div className="invoice-list">
              {invoiceFilteredCustomers.map((customer) => {
                const remaining = (customer.setupFeeTotal ?? 0) - (customer.setupFeePaid ?? 0);
                return (
                <div key={customer.id} className="invoice-card">
                  <div><strong>{customer.name}</strong></div>
                  <div className="small">المتبقي: {remaining} ﷼</div>
                  <div className="actions">
                    <button onClick={() => generateSetupInvoicePDF(customer)} className="btn warning">فاتورة التأسيس</button>
                    <button onClick={() => generateSubscriptionInvoicePDF(customer)} className="btn primary">فاتورة الاشتراك</button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'yearly' && (
          <div className="section yearly-section">
            <div className="yearly-header">
              <h2>متابعة الاشتراكات السنوية</h2>
              <div className="yearly-controls">
                <select 
                  value={yearlyCityId || ''} 
                  onChange={(e) => setYearlyCityId(e.target.value || null)} 
                  className="input"
                >
                  <option value="">جميع المدن</option>
                  {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                </select>
                <div className="year-selector">
                  <button className="btn-year" onClick={() => setSelectedYear(y => y - 1)}>◀</button>
                  <span className="year-display">{selectedYear}</span>
                  <button className="btn-year" onClick={() => setSelectedYear(y => y + 1)}>▶</button>
                </div>
              </div>
            </div>

            <div className="yearly-table-container">
              <table className="yearly-table">
                <thead>
                  <tr>
                    <th className="sticky-col customer-col">العميل</th>
                    <th className="sticky-col city-col">المدينة</th>
                    <th className="sticky-col subscription-col">الاشتراك</th>
                    {MONTHS_AR.map((month, idx) => (
                      <th key={idx} className="month-col">{month}</th>
                    ))}
                    <th className="total-col">المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .filter(c => !yearlyCityId || c.cityId === yearlyCityId)
                    .map((customer) => {
                      const city = cities.find(c => c.id === customer.cityId);
                      let paidCount = 0;
                      
                      return (
                        <tr key={customer.id}>
                          <td className="sticky-col customer-col">{customer.name}</td>
                          <td className="sticky-col city-col">{city?.name || '-'}</td>
                          <td className="sticky-col subscription-col">{customer.subscriptionValue ?? 0} ﷼</td>
                          {MONTHS_AR.map((_, monthIdx) => {
                            const yearMonth = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}`;
                            const status = customer.monthlyPayments?.[yearMonth] || 'pending';
                            if (status === 'paid') paidCount++;
                            if (status === 'partial') paidCount += 0.5;
                            
                            const statusLabels = {
                              paid: 'مدفوع',
                              partial: 'جزئي',
                              pending: 'انتظار'
                            };
                            
                            return (
                              <td key={monthIdx} className="month-cell">
                                <button
                                  className={`status-btn ${status}`}
                                  onClick={async () => {
                                    const nextStatus = status === 'pending' ? 'partial' : status === 'partial' ? 'paid' : 'pending';
                                    const updatedPayments = {
                                      ...(customer.monthlyPayments || {}),
                                      [yearMonth]: nextStatus
                                    };
                                    await setDoc(doc(db, 'customers', customer.id), {
                                      ...customer,
                                      monthlyPayments: updatedPayments
                                    });
                                  }}
                                >
                                  {statusLabels[status]}
                                </button>
                              </td>
                            );
                          })}
                          <td className="total-cell">
                            <span className="paid-count">{paidCount}</span>
                            <span className="total-separator">/</span>
                            <span className="total-months">12</span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="yearly-summary">
              <div className="summary-card">
                <div className="summary-label">إجمالي العملاء</div>
                <div className="summary-value">{customers.filter(c => !yearlyCityId || c.cityId === yearlyCityId).length}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">إجمالي الاشتراكات الشهرية</div>
                <div className="summary-value">
                  {customers
                    .filter(c => !yearlyCityId || c.cityId === yearlyCityId)
                    .reduce((sum, c) => sum + (c.subscriptionValue ?? 0), 0)} ﷼
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      )}

      {/* Customer Details Modal */}
      {showCustomerModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowCustomerModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>معلومات العميل</h3>
              <button onClick={() => setShowCustomerModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">اسم العميل:</span>
                <span className="detail-value">{selectedCustomer.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">رقم العميل:</span>
                <span className="detail-value">{selectedCustomer.phone || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">تاريخ بدء الاشتراك:</span>
                <span className="detail-value">{selectedCustomer.startDate ? formatDate(selectedCustomer.startDate) : '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">قيمة الاشتراك:</span>
                <span className="detail-value">{selectedCustomer.subscriptionValue ?? 0} ﷼</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">رسوم التأسيس:</span>
                <span className="detail-value">{selectedCustomer.setupFeeTotal ?? 0} ﷼</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">المدفوع:</span>
                <span className="detail-value">{selectedCustomer.setupFeePaid ?? 0} ﷼</span>
              </div>
              <div className="detail-row highlight">
                <span className="detail-label">المتبقي:</span>
                <span className="detail-value">{(selectedCustomer.setupFeeTotal ?? 0) - (selectedCustomer.setupFeePaid ?? 0)} ﷼</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">IP Number (الراوتر الأساسي):</span>
                <span className="detail-value">{selectedCustomer.ipNumber || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">User Name (الراوتر الأساسي):</span>
                <span className="detail-value">{selectedCustomer.userName || '-'}</span>
              </div>
              {selectedCustomer.additionalRouters && selectedCustomer.additionalRouters.length > 0 && (
                <div className="additional-routers-section">
                  <div className="section-title-small">الراوترات الإضافية ({selectedCustomer.additionalRouters.length})</div>
                  {selectedCustomer.additionalRouters.map((router, index) => (
                    <div key={index} className="router-details">
                      <div className="router-number">راوتر {index + 1}</div>
                      <div className="detail-row">
                        <span className="detail-label">User Name:</span>
                        <span className="detail-value">{router.userName || '-'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">IP Number:</span>
                        <span className="detail-value">{router.ipNumber || '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">LAP:</span>
                <span className="detail-value">{selectedCustomer.lap || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">الموقع:</span>
                <span className="detail-value">{selectedCustomer.site || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">حالة الدفع:</span>
                <span className={`detail-value status-badge ${selectedCustomer.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`}>
                  {selectedCustomer.paymentStatus === 'paid' ? 'مدفوع' : 'غير مسدد'}
                </span>
              </div>
              {selectedCustomer.notes && (
                <div className="detail-row notes">
                  <span className="detail-label">ملاحظات:</span>
                  <span className="detail-value">{selectedCustomer.notes}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCustomerModal(false)} className="btn secondary">إغلاق</button>
              <button onClick={() => { generateSetupInvoicePDF(selectedCustomer); }} className="btn warning">فاتورة التأسيس</button>
              <button onClick={() => { generateSubscriptionInvoicePDF(selectedCustomer); }} className="btn primary">فاتورة الاشتراك</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => { setDeleteConfirm(null); setDeletePassword(''); }}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تأكيد الحذف</h3>
              <button onClick={() => { setDeleteConfirm(null); setDeletePassword(''); }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p className="confirm-text" style={{ marginBottom: '20px' }}>
                هل أنت متأكد من حذف {deleteConfirm.type === 'city' ? 'المدينة' : 'العميل'}{' '}
                <strong className="text-danger">{deleteConfirm.name}</strong>؟
                {deleteConfirm.type === 'city' && (
                  <><br /><small style={{ color: '#ef4444' }}>سيتم حذف جميع العملاء في هذه المدينة</small></>
                )}
              </p>
              <div className="edit-field">
                <label>أدخل كلمة المرور للتأكيد</label>
                <input 
                  type="password" 
                  placeholder="كلمة المرور" 
                  value={deletePassword} 
                  onChange={(e) => setDeletePassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmDelete()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setDeleteConfirm(null); setDeletePassword(''); }} className="btn secondary">إلغاء</button>
              <button onClick={confirmDelete} className="btn danger" disabled={deleteLoading}>
                {deleteLoading ? 'جاري التحقق...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Password Confirmation Modal */}
      {editPasswordModal && pendingEditCustomer && (
        <div className="modal-overlay" onClick={() => { setEditPasswordModal(false); setPendingEditCustomer(null); setEditPassword(''); }}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تأكيد التعديل</h3>
              <button onClick={() => { setEditPasswordModal(false); setPendingEditCustomer(null); setEditPassword(''); }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p className="confirm-text" style={{ marginBottom: '20px' }}>
                لتعديل بيانات العميل <strong>{pendingEditCustomer.name}</strong>، أدخل كلمة المرور
              </p>
              <div className="edit-field">
                <label>كلمة المرور</label>
                <input 
                  type="password" 
                  placeholder="كلمة المرور" 
                  value={editPassword} 
                  onChange={(e) => setEditPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmEditPassword()}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setEditPasswordModal(false); setPendingEditCustomer(null); setEditPassword(''); }} className="btn secondary">إلغاء</button>
              <button onClick={confirmEditPassword} className="btn primary" disabled={editLoading}>
                {editLoading ? 'جاري التحقق...' : 'متابعة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Status Change Modal */}
      {confirmStatusChange && (
        <div className="modal-overlay" onClick={() => setConfirmStatusChange(null)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تأكيد تغيير الحالة</h3>
              <button onClick={() => setConfirmStatusChange(null)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                هل تريد تغيير حالة <strong>{confirmStatusChange.customer.name}</strong> إلى{' '}
                <strong className={confirmStatusChange.newStatus === 'paid' ? 'text-success' : 'text-warning'}>
                  {confirmStatusChange.newStatus === 'paid' ? 'مدفوع' : 'غير مسدد'}
                </strong>؟
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setConfirmStatusChange(null)} className="btn secondary">إلغاء</button>
              <button onClick={confirmPaymentStatusChange} className="btn primary">تأكيد</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && editingCustomer && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تعديل بيانات العميل</h3>
              <button onClick={() => setShowEditModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="edit-form">
                <div className="edit-field">
                  <label>اسم العميل</label>
                  <input type="text" value={editingCustomer.name} onChange={(e) => handleEditCustomer('name', e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>رقم العميل (الجوال)</label>
                  <input type="text" value={editingCustomer.phone || ''} onChange={(e) => handleEditCustomer('phone', e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>تاريخ بدء الاشتراك</label>
                  <input type="date" value={editingCustomer.startDate || ''} onChange={(e) => handleEditCustomer('startDate', e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>قيمة الاشتراك</label>
                  <input type="number" value={editingCustomer.subscriptionValue || ''} onChange={(e) => handleEditCustomer('subscriptionValue', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="edit-field">
                  <label>رسوم التأسيس</label>
                  <input type="number" value={editingCustomer.setupFeeTotal || ''} onChange={(e) => handleEditCustomer('setupFeeTotal', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="edit-field">
                  <label>المدفوع</label>
                  <input type="number" value={editingCustomer.setupFeePaid || ''} onChange={(e) => handleEditCustomer('setupFeePaid', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="edit-field calculated">
                  <label>المتبقي</label>
                  <span className="calculated-value">{(editingCustomer.setupFeeTotal ?? 0) - (editingCustomer.setupFeePaid ?? 0)} ﷼</span>
                </div>
                <div className="edit-field">
                  <label>IP Number</label>
                  <input type="text" value={editingCustomer.ipNumber || ''} onChange={(e) => handleEditCustomer('ipNumber', e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>User Name</label>
                  <input type="text" value={editingCustomer.userName || ''} onChange={(e) => handleEditCustomer('userName', e.target.value)} />
                </div>
                <div className="router-section">
                  <div className="edit-field">
                    <label>عدد الراوترات الإضافية</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={editingCustomer.additionalRouters?.length || 0} 
                      onChange={(e) => handleEditAdditionalRouterCount(parseInt(e.target.value) || 0)} 
                    />
                  </div>
                  {editingCustomer.additionalRouters && editingCustomer.additionalRouters.length > 0 && (
                    <div className="additional-router-fields">
                      {editingCustomer.additionalRouters.map((router, index) => (
                        <div key={index} className="router-item">
                          <div className="router-label">راوتر إضافي {index + 1}</div>
                          <div className="edit-field">
                            <label>User Name</label>
                            <input 
                              type="text" 
                              value={router.userName} 
                              onChange={(e) => updateEditAdditionalRouter(index, 'userName', e.target.value)} 
                            />
                          </div>
                          <div className="edit-field">
                            <label>IP Number</label>
                            <input 
                              type="text" 
                              value={router.ipNumber} 
                              onChange={(e) => updateEditAdditionalRouter(index, 'ipNumber', e.target.value)} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="edit-field">
                  <label>LAP</label>
                  <input type="text" value={editingCustomer.lap || ''} onChange={(e) => handleEditCustomer('lap', e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>الموقع</label>
                  <input type="text" value={editingCustomer.site || ''} onChange={(e) => handleEditCustomer('site', e.target.value)} />
                </div>
                <div className="edit-field full-width">
                  <label>ملاحظات إضافية</label>
                  <textarea value={editingCustomer.notes || ''} onChange={(e) => handleEditCustomer('notes', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowEditModal(false)} className="btn secondary">إلغاء</button>
              <button onClick={saveEditedCustomer} className="btn primary">حفظ التعديلات</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Customer Modal */}
      {transferModal && transferCustomer && (
        <div className="modal-overlay" onClick={() => setTransferModal(false)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>نقل العميل إلى مدينة أخرى</h3>
              <button onClick={() => setTransferModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                نقل العميل <strong>{transferCustomer.name}</strong> إلى مدينة جديدة
              </p>
              <div className="edit-field">
                <label>اختر المدينة الجديدة</label>
                <select 
                  value={transferCityId} 
                  onChange={(e) => setTransferCityId(e.target.value)}
                  className="input"
                >
                  <option value="">-- اختر المدينة --</option>
                  {cities
                    .filter(city => city.id !== transferCustomer.cityId)
                    .map(city => (
                      <option key={city.id} value={city.id}>{city.name}</option>
                    ))}
                </select>
              </div>
              <div className="edit-field">
                <label>كلمة المرور للتأكيد</label>
                <input 
                  type="password" 
                  value={transferPassword}
                  onChange={(e) => setTransferPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setTransferModal(false)} className="btn secondary" disabled={transferLoading}>
                إلغاء
              </button>
              <button onClick={confirmTransferCustomer} className="btn primary" disabled={transferLoading}>
                {transferLoading ? 'جاري النقل...' : 'تأكيد النقل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
}

export default App;
