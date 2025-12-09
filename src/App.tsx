import { FormEvent, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'internet-admin-data-v1';
const credentials = { username: 'admin', password: 'admin123' };

type City = {
  id: string;
  name: string;
};

type Customer = {
  id: string;
  cityId: string;
  name: string;
  startDate: string;
  lastPayment: string;
};

type StoredData = {
  cities: City[];
  customers: Customer[];
  selectedCityId: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const loadStoredData = (): StoredData => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { cities: [], customers: [], selectedCityId: null };
  }

  try {
    const parsed = JSON.parse(saved) as Partial<StoredData>;
    return {
      cities: parsed.cities ?? [],
      customers: parsed.customers ?? [],
      selectedCityId: parsed.selectedCityId ?? null,
    };
  } catch (error) {
    console.error('تعذر قراءة البيانات من التخزين المحلي', error);
    return { cities: [], customers: [], selectedCityId: null };
  }
};

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
};

const computeStatus = (customer: Customer) => {
  const expiration = addMonths(new Date(customer.lastPayment), 1);
  const today = new Date();
  const diffDays = Math.floor((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'expired', label: 'منتهي', expirationText: 'انتهى الاشتراك' } as const;
  }

  if (diffDays <= 5) {
    return { status: 'warning', label: 'يحتاج تجديد', expirationText: `متبقي ${diffDays} يوم` } as const;
  }

  return { status: 'active', label: 'نشط', expirationText: `متبقي ${diffDays} يوم` } as const;
};

function App() {
  const [data, setData] = useState<StoredData>(() => loadStoredData());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [serviceStart, setServiceStart] = useState(todayISO());
  const [toastMessage, setToastMessage] = useState('');

  const selectedCity = useMemo(
    () => data.cities.find((city) => city.id === data.selectedCityId) ?? null,
    [data.cities, data.selectedCityId]
  );

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        cities: data.cities,
        customers: data.customers,
        selectedCityId: data.selectedCityId,
      })
    );
  }, [data]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 2200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (username.trim() === credentials.username && password.trim() === credentials.password) {
      setIsAuthenticated(true);
      setToastMessage('تم تسجيل الدخول بنجاح');
    } else {
      setToastMessage('بيانات الدخول غير صحيحة');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
  };

  const addCity = () => {
    const name = prompt('اسم المدينة الجديدة:');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const newCity: City = { id: crypto.randomUUID(), name: trimmed };
    setData((prev) => ({
      ...prev,
      cities: [...prev.cities, newCity],
      selectedCityId: prev.selectedCityId ?? newCity.id,
    }));
    setToastMessage('تمت إضافة المدينة');
  };

  const updateCityName = (city: City) => {
    const name = prompt('تعديل اسم المدينة:', city.name);
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setData((prev) => ({
      ...prev,
      cities: prev.cities.map((item) => (item.id === city.id ? { ...item, name: trimmed } : item)),
    }));
    setToastMessage('تم تحديث اسم المدينة');
  };

  const selectCity = (cityId: string) => {
    setData((prev) => ({ ...prev, selectedCityId: cityId }));
  };

  const addCustomer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data.selectedCityId) {
      setToastMessage('اختر مدينة أولاً لإضافة العملاء');
      return;
    }

    const trimmedName = customerName.trim();
    if (!trimmedName || !serviceStart) return;

    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      cityId: data.selectedCityId,
      name: trimmedName,
      startDate: serviceStart,
      lastPayment: serviceStart,
    };

    setData((prev) => ({ ...prev, customers: [...prev.customers, newCustomer] }));
    setCustomerName('');
    setServiceStart(todayISO());
    setToastMessage('تمت إضافة العميل');
  };

  const markPaid = (customerId: string) => {
    setData((prev) => ({
      ...prev,
      customers: prev.customers.map((customer) =>
        customer.id === customerId
          ? { ...customer, lastPayment: todayISO() }
          : customer
      ),
    }));
    const customer = data.customers.find((item) => item.id === customerId);
    if (customer) {
      setToastMessage(`تم تسجيل سداد للعميل ${customer.name}`);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!data.selectedCityId) return [] as Customer[];
    return [...data.customers]
      .filter((customer) => customer.cityId === data.selectedCityId)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [data.customers, data.selectedCityId]);

  const renderCustomerState = () => {
    if (!data.selectedCityId) {
      return <p className="muted">اختر مدينة لعرض العملاء.</p>;
    }

    if (!filteredCustomers.length) {
      return <p className="muted">لا يوجد عملاء في هذه المدينة حتى الآن.</p>;
    }

    return filteredCustomers.map((customer) => {
      const { status, label, expirationText } = computeStatus(customer);
      return (
        <div className="list-item customer-item" key={customer.id}>
          <div className="customer-main">
            <div>
              <strong className="customer-name">{customer.name}</strong>
              <p className="muted small">بداية الخدمة: <span className="customer-start">{formatDate(customer.startDate)}</span></p>
              <p className="muted small">آخر سداد: <span className="customer-last-payment">{formatDate(customer.lastPayment)}</span></p>
            </div>
            <div className="status">
              <span className={`status-badge ${status}`}>{label}</span>
              <small className="muted expiration">{expirationText}</small>
            </div>
          </div>
          <div className="actions">
            <button className="btn ghost mark-paid" type="button" onClick={() => markPaid(customer.id)}>
              تسجيل سداد
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <>
      <header className="app-header">
        <div className="brand">خدمة الإنترنت - لوحة التحكم</div>
        {isAuthenticated && (
          <div className="user-actions">
            <span className="username">المستخدم: admin</span>
            <button id="logoutBtn" className="btn secondary" type="button" onClick={handleLogout}>
              تسجيل خروج
            </button>
          </div>
        )}
      </header>

      <main className="container">
        {!isAuthenticated ? (
          <section id="loginCard" className="card narrow">
            <h1>تسجيل الدخول</h1>
            <p className="muted">ادخل بيانات الحساب للوصول إلى لوحة التحكم.</p>
            <form id="loginForm" className="form-grid" onSubmit={handleLogin}>
              <label>
                اسم المستخدم
                <input
                  type="text"
                  id="username"
                  required
                  placeholder="مثال: admin"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              <label>
                كلمة المرور
                <input
                  type="password"
                  id="password"
                  required
                  placeholder="مثال: admin123"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button type="submit" className="btn primary full">
                تسجيل الدخول
              </button>
              <p className="muted small">
                البيانات الافتراضية: اسم المستخدم <strong>admin</strong> و كلمة المرور <strong>admin123</strong>
              </p>
            </form>
          </section>
        ) : (
          <section id="dashboard">
            <div className="grid two-cols gap">
              <div className="card">
                <div className="card-header">
                  <div>
                    <p className="eyebrow">إدارة المدن</p>
                    <h2>قوائم المدن</h2>
                  </div>
                  <button id="addCityBtn" className="btn primary" type="button" onClick={addCity}>
                    إضافة مدينة
                  </button>
                </div>
                <div id="cityList" className="list">
                  {!data.cities.length ? (
                    <p className="muted">لا توجد مدن بعد. أضف مدينة للبدء.</p>
                  ) : (
                    data.cities.map((city) => {
                      const customerCount = data.customers.filter((customer) => customer.cityId === city.id).length;
                      const isSelected = data.selectedCityId === city.id;
                      return (
                        <div className="list-item city-item" key={city.id}>
                          <div>
                            <strong className="city-name">{city.name}</strong>
                            <p className="muted small">عدد العملاء: <span className="city-count">{customerCount}</span></p>
                            {isSelected && <p className="muted small">(المدينة الحالية)</p>}
                          </div>
                          <div className="actions">
                            <button className="btn ghost edit-city" type="button" onClick={() => updateCityName(city)}>
                              تعديل الاسم
                            </button>
                            <button className="btn ghost select-city" type="button" onClick={() => selectCity(city.id)}>
                              عرض العملاء
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <p className="eyebrow">العملاء</p>
                    <h2>إدارة المشتركين</h2>
                  </div>
                  <div className="chip" id="selectedCityLabel">
                    {selectedCity ? `المدينة الحالية: ${selectedCity.name}` : 'اختر مدينة لعرض العملاء'}
                  </div>
                </div>
                <form id="customerForm" className="form-grid compact" onSubmit={addCustomer}>
                  <label>
                    اسم العميل
                    <input
                      type="text"
                      id="customerName"
                      required
                      placeholder="مثال: أحمد علي"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                    />
                  </label>
                  <label>
                    تاريخ بداية الخدمة
                    <input
                      type="date"
                      id="serviceStart"
                      required
                      value={serviceStart}
                      onChange={(event) => setServiceStart(event.target.value)}
                    />
                  </label>
                  <button type="submit" className="btn primary full">
                    إضافة عميل
                  </button>
                </form>
                <div id="customerList" className="list">
                  {renderCustomerState()}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {toastMessage && (
        <div id="toast" className="toast show">
          {toastMessage}
        </div>
      )}
    </>
  );
}

export default App;
