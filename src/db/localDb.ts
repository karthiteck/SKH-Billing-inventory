// Local Database Service for Paint Shop Billing Application
// Operates on localStorage to run client-side on any device with zero configuration.

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  finish: string; // Matte, Gloss, Satin, N/A, etc.
  volume: string; // 1L, 4L, 10L, 20L, N/A, etc.
  price: number; // Base selling price
  stockKRNagar: number;
  stockBettadapura: number;
  minStock: number; // For low stock alerts
  isBase: boolean; // True if it can be custom-tinted
  basePaintType?: 'ready_mix' | 'tintable' | 'none';
  barcode?: string;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  brand: string;
  volume: string;
  category?: string;
  quantity: number;
  price: number; // Total unit price (basePrice + tintFee)
  basePrice: number;
  tintCode: string; // e.g. "Crimson Red 4021" or "N/A"
  tintFee: number; // Custom charge for adding colorant
  subtotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string; // ISO String
  customerName: string;
  customerPhone: string;
  customerGst: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number; // Final calculated discount amount
  discountType: 'flat' | 'percent';
  discountValue: number; // User input value
  taxRate: number; // default: 18% (GST)
  taxAmount: number;
  grandTotal: number;
  paymentMethod: 'Cash' | 'Card' | 'UPI' | 'Credit';
  cashierName: string;
  cashierId: string;
  branch?: 'K R Nagar' | 'Bettadapura';
}

export interface User {
  id: string;
  username: string;
  password?: string; // Stored in plain text for simplicity and offline password recovery
  role: 'admin' | 'staff';
  name: string;
  branch?: 'K R Nagar' | 'Bettadapura';
}

export interface ShopSettings {
  shopName: string;
  address: string;
  phone: string;
  gstin: string;
  currency: string;
  defaultTaxRate: number;
  invoicePrefix?: string;
  nextInvoiceSeq?: number;
  addressBettadapura?: string;
  invoicePrefixBettadapura?: string;
  nextInvoiceSeqBettadapura?: number;
}

// Key names for localStorage
const KEYS = {
  PRODUCTS: 'skh_billing_products',
  INVOICES: 'skh_billing_invoices',
  USERS: 'skh_billing_users',
  SETTINGS: 'skh_billing_settings',
  SESSION: 'skh_billing_session',
};

// Local write timestamp tracking to prevent background sync race conditions
let lastLocalWrite = 0;
let isSyncPulling = false;

export const isWritePending = () => {
  return Date.now() - lastLocalWrite < 3000; // 3 seconds write lock
};

const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = (key: string, value: string) => {
  if (!isSyncPulling && key !== KEYS.SESSION && key !== 'skh_sidebar_collapsed' && key !== 'skh_billing_theme' && key !== 'skh_billing_view') {
    lastLocalWrite = Date.now();
  }
  originalSetItem(key, value);
};

// Initial Seed Data
const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'SRI KALABYRAVESHWARA HARDWARE AND PAINTS',
  address: 'Vidya Nagar, 16th ward, Opp Raj prakash school, K R Nagar 571602',
  phone: '7022341173',
  gstin: '29DGPPG9800L1ZQ',
  currency: '₹',
  defaultTaxRate: 18,
  invoicePrefix: 'SRI',
  nextInvoiceSeq: 1,
  addressBettadapura: 'Bettadapura Road, Opp Bus Stand, Bettadapura 571102',
  invoicePrefixBettadapura: 'SKH',
  nextInvoiceSeqBettadapura: 1,
};

const DEFAULT_USERS: User[] = [
  { id: 'u1', username: 'admin', password: 'admin123', role: 'admin', name: 'Admin' },
  { id: 'u2', username: 'cashier', password: 'cashier123', role: 'staff', name: 'Cashier Staff', branch: 'K R Nagar' },
];

const DEFAULT_PRODUCTS: Product[] = [
  // Base Paints (for tinting)
  { id: 'p1', name: 'Royale Luxury Emulsion - Base A', brand: 'Asian Paints', category: 'Interior Paints', finish: 'Satin', volume: '1L', price: 420, stockKRNagar: 45, stockBettadapura: 25, minStock: 10, isBase: true },
  { id: 'p2', name: 'Royale Luxury Emulsion - Base A', brand: 'Asian Paints', category: 'Interior Paints', finish: 'Satin', volume: '4L', price: 1600, stockKRNagar: 20, stockBettadapura: 10, minStock: 5, isBase: true },
  { id: 'p3', name: 'Royale Luxury Emulsion - Base A', brand: 'Asian Paints', category: 'Interior Paints', finish: 'Satin', volume: '10L', price: 3800, stockKRNagar: 8, stockBettadapura: 4, minStock: 3, isBase: true },
  { id: 'p4', name: 'Royale Luxury Emulsion - Base A', brand: 'Asian Paints', category: 'Interior Paints', finish: 'Satin', volume: '20L', price: 7200, stockKRNagar: 5, stockBettadapura: 2, minStock: 2, isBase: true },
  
  { id: 'p5', name: 'Apex Ultima Exterior - Base White', brand: 'Asian Paints', category: 'Exterior Paints', finish: 'Semi-Gloss', volume: '4L', price: 1450, stockKRNagar: 15, stockBettadapura: 8, minStock: 5, isBase: true },
  { id: 'p6', name: 'Apex Ultima Exterior - Base White', brand: 'Asian Paints', category: 'Exterior Paints', finish: 'Semi-Gloss', volume: '20L', price: 6800, stockKRNagar: 6, stockBettadapura: 3, minStock: 2, isBase: true },
  
  { id: 'p7', name: 'Easy Clean Fresh - Base White', brand: 'Berger', category: 'Interior Paints', finish: 'Matte', volume: '4L', price: 980, stockKRNagar: 12, stockBettadapura: 6, minStock: 4, isBase: true },
  { id: 'p8', name: 'Easy Clean Fresh - Base White', brand: 'Berger', category: 'Interior Paints', finish: 'Matte', volume: '10L', price: 2350, stockKRNagar: 4, stockBettadapura: 2, minStock: 2, isBase: true },
  
  // Ready-made paints
  { id: 'p9', name: 'Premium Gloss Emamel - Gloss White', brand: 'Berger', category: 'Wood & Metal Paints', finish: 'Gloss', volume: '1L', price: 290, stockKRNagar: 30, stockBettadapura: 15, minStock: 8, isBase: false, barcode: '8901234560012' },
  { id: 'p10', name: 'Premium Gloss Enamel - Gloss Black', brand: 'Berger', category: 'Wood & Metal Paints', finish: 'Gloss', volume: '1L', price: 290, stockKRNagar: 25, stockBettadapura: 12, minStock: 8, isBase: false, barcode: '8901234560029' },
  { id: 'p11', name: 'Aqualite Water-Based Wood Finish', brand: 'Dulux', category: 'Wood & Metal Paints', finish: 'Satin', volume: '1L', price: 480, stockKRNagar: 10, stockBettadapura: 5, minStock: 3, isBase: false },

  // Primers & Undercoats
  { id: 'p12', name: 'Decoprime Wall Primer (Water Undercoat)', brand: 'Asian Paints', category: 'Primers', finish: 'Matte', volume: '4L', price: 520, stockKRNagar: 18, stockBettadapura: 9, minStock: 5, isBase: false },
  { id: 'p13', name: 'Decoprime Wall Primer (Water Undercoat)', brand: 'Asian Paints', category: 'Primers', finish: 'Matte', volume: '10L', price: 1150, stockKRNagar: 10, stockBettadapura: 5, minStock: 3, isBase: false },
  { id: 'p14', name: 'Red Oxide Metal Primer', brand: 'Berger', category: 'Primers', finish: 'Matte', volume: '1L', price: 180, stockKRNagar: 22, stockBettadapura: 11, minStock: 5, isBase: false },

  // Tools & Brushes
  { id: 'p15', name: 'Paint Brush - 2 Inch Premium', brand: 'Generic', category: 'Accessories', finish: 'N/A', volume: 'N/A', price: 65, stockKRNagar: 50, stockBettadapura: 30, minStock: 10, isBase: false, barcode: '8901234560159' },
  { id: 'p16', name: 'Paint Brush - 4 Inch Premium', brand: 'Generic', category: 'Accessories', finish: 'N/A', volume: 'N/A', price: 110, stockKRNagar: 40, stockBettadapura: 20, minStock: 10, isBase: false, barcode: '8901234560166' },
  { id: 'p17', name: 'Roller & Tray Set - 9 Inch', brand: 'Generic', category: 'Accessories', finish: 'N/A', volume: 'N/A', price: 240, stockKRNagar: 15, stockBettadapura: 8, minStock: 5, isBase: false, barcode: '8901234560173' },
  { id: 'p18', name: 'Mineral Turpentine Thinner', brand: 'Generic', category: 'Solvents', finish: 'N/A', volume: '1L', price: 140, stockKRNagar: 35, stockBettadapura: 18, minStock: 8, isBase: false }
];

// Helper to check and initialize database
export const initDatabase = (force = false) => {
  if (force || !localStorage.getItem(KEYS.PRODUCTS)) {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
  }
  if (force || !localStorage.getItem(KEYS.USERS)) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(DEFAULT_USERS));
  }
  
  // Overwrite if old placeholders exist
  const existingSettings = localStorage.getItem(KEYS.SETTINGS);
  if (force || !existingSettings) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  } else {
    try {
      const parsed = JSON.parse(existingSettings);
      if (parsed.shopName === 'SKH Paints & Hardware' || parsed.gstin === '29AAAAA0000A1Z5') {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch (e) {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
  }
  
  if (force || !localStorage.getItem(KEYS.INVOICES)) {
    localStorage.setItem(KEYS.INVOICES, JSON.stringify([]));
  }
};

// Execute initialization
initDatabase();

// --- PRODUCT SERVICE ---
export const getProducts = (): Product[] => {
  const products: any[] = JSON.parse(localStorage.getItem(KEYS.PRODUCTS) || '[]');
  let migrated = false;
  
  // 1. First pass: migrate single branch stock to stockKRNagar / stockBettadapura properties
  let migratedProducts = products.map((p) => {
    let changed = false;
    const newProduct = { ...p };
    
    if (newProduct.stockKRNagar === undefined) {
      if (newProduct.branch === 'Bettadapura') {
        newProduct.stockBettadapura = newProduct.stock !== undefined ? newProduct.stock : 0;
        newProduct.stockKRNagar = 0;
      } else {
        newProduct.stockKRNagar = newProduct.stock !== undefined ? newProduct.stock : 0;
        newProduct.stockBettadapura = 0;
      }
      changed = true;
    }
    
    if (newProduct.stockBettadapura === undefined) {
      newProduct.stockBettadapura = 0;
      changed = true;
    }
    
    // Remove legacy properties
    if (newProduct.branch !== undefined) {
      delete newProduct.branch;
      changed = true;
    }
    if (newProduct.stock !== undefined) {
      delete newProduct.stock;
      changed = true;
    }
    
    if (changed) {
      migrated = true;
    }
    return newProduct;
  });

  // 2. Second pass: merge duplicate product definitions across branches
  const uniqueProducts: Product[] = [];
  migratedProducts.forEach((p) => {
    const existing = uniqueProducts.find(
      (u) =>
        u.name.trim().toLowerCase() === p.name.trim().toLowerCase() &&
        u.brand.trim().toLowerCase() === p.brand.trim().toLowerCase() &&
        u.category === p.category &&
        u.volume === p.volume &&
        u.finish === p.finish &&
        u.isBase === p.isBase &&
        (u.basePaintType || 'none') === (p.basePaintType || 'none')
    );
    
    if (existing) {
      // Merge stocks
      existing.stockKRNagar = (existing.stockKRNagar || 0) + (p.stockKRNagar || 0);
      existing.stockBettadapura = (existing.stockBettadapura || 0) + (p.stockBettadapura || 0);
      if (!existing.barcode && p.barcode) {
        existing.barcode = p.barcode;
      }
      migrated = true;
    } else {
      uniqueProducts.push(p);
    }
  });

  if (migrated) {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(uniqueProducts));
  }
  return uniqueProducts;
};

export const saveProduct = (product: Product): Product[] => {
  const products = getProducts();
  const index = products.findIndex((p) => p.id === product.id);
  if (index >= 0) {
    products[index] = product;
  } else {
    products.push(product);
  }
  localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  pushCentralDb();
  return products;
};

export const deleteProduct = (id: string): Product[] => {
  const products = getProducts();
  const filtered = products.filter((p) => p.id !== id);
  localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(filtered));
  pushCentralDb();
  return filtered;
};

// --- INVOICE SERVICE ---
export const getInvoices = (): Invoice[] => {
  const invoices: Invoice[] = JSON.parse(localStorage.getItem(KEYS.INVOICES) || '[]');
  let migrated = false;
  const migratedInvoices = invoices.map((inv) => {
    if (!inv.branch) {
      migrated = true;
      return { ...inv, branch: 'K R Nagar' as const };
    }
    return inv;
  });
  if (migrated) {
    localStorage.setItem(KEYS.INVOICES, JSON.stringify(migratedInvoices));
  }
  return migratedInvoices;
};

export const saveInvoice = (invoice: Omit<Invoice, 'id' | 'invoiceNumber'>): Invoice => {
  const invoices = getInvoices();
  const settings = getSettings();
  
  const branch = invoice.branch || 'K R Nagar';
  const prefix = branch === 'Bettadapura'
    ? (settings.invoicePrefixBettadapura || 'SKH')
    : (settings.invoicePrefix || 'SRI');
  const nextSeq = branch === 'Bettadapura'
    ? (settings.nextInvoiceSeqBettadapura || 1)
    : (settings.nextInvoiceSeq || 1);
  const invoiceNumber = `${prefix}-${String(nextSeq).padStart(4, '0')}`;
  
  // Increment sequence
  if (branch === 'Bettadapura') {
    settings.nextInvoiceSeqBettadapura = nextSeq + 1;
  } else {
    settings.nextInvoiceSeq = nextSeq + 1;
  }
  saveSettings(settings);
  
  const finalInvoice: Invoice = {
    ...invoice,
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    invoiceNumber,
  };
  
  invoices.unshift(finalInvoice); // Add to beginning (newest first)
  localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));
  
  // Deduct Stock
  const products = getProducts();
  finalInvoice.items.forEach((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      if (branch === 'Bettadapura') {
        product.stockBettadapura = Math.max(0, (product.stockBettadapura || 0) - item.quantity);
      } else {
        product.stockKRNagar = Math.max(0, (product.stockKRNagar || 0) - item.quantity);
      }
      saveProduct(product);
    }
  });
  
  pushCentralDb();
  return finalInvoice;
};

export const updateInvoice = (id: string, updatedFields: Partial<Invoice>): Invoice => {
  const invoices = getInvoices();
  const index = invoices.findIndex((inv) => inv.id === id);
  if (index < 0) {
    throw new Error('Invoice not found');
  }
  
  const oldInvoice = invoices[index];
  
  // Restore stock for old invoice items first
  const products = getProducts();
  oldInvoice.items.forEach((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      const oldBranch = oldInvoice.branch || 'K R Nagar';
      if (oldBranch === 'Bettadapura') {
        product.stockBettadapura = (product.stockBettadapura || 0) + item.quantity;
      } else {
        product.stockKRNagar = (product.stockKRNagar || 0) + item.quantity;
      }
    }
  });
  
  // Construct updated invoice (preserve invoiceNumber, id, and date)
  const finalInvoice: Invoice = {
    ...oldInvoice,
    ...updatedFields,
    id,
    invoiceNumber: oldInvoice.invoiceNumber,
    date: oldInvoice.date
  };
  
  // Deduct stock for new invoice items
  finalInvoice.items.forEach((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      const newBranch = finalInvoice.branch || 'K R Nagar';
      if (newBranch === 'Bettadapura') {
        product.stockBettadapura = Math.max(0, (product.stockBettadapura || 0) - item.quantity);
      } else {
        product.stockKRNagar = Math.max(0, (product.stockKRNagar || 0) - item.quantity);
      }
    }
  });
  
  // Save updated products and invoice
  localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  
  invoices[index] = finalInvoice;
  localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));
  
  pushCentralDb();
  return finalInvoice;
};

export const deleteInvoice = (id: string): Invoice[] => {
  const invoices = getInvoices();
  const invoiceToDelete = invoices.find((inv) => inv.id === id);
  if (!invoiceToDelete) {
    throw new Error("Invoice not found");
  }
  
  // Restore Stock
  const products = getProducts();
  invoiceToDelete.items.forEach((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      const oldBranch = invoiceToDelete.branch || 'K R Nagar';
      if (oldBranch === 'Bettadapura') {
        product.stockBettadapura = (product.stockBettadapura || 0) + item.quantity;
      } else {
        product.stockKRNagar = (product.stockKRNagar || 0) + item.quantity;
      }
      saveProduct(product);
    }
  });
  
  const filtered = invoices.filter((inv) => inv.id !== id);
  localStorage.setItem(KEYS.INVOICES, JSON.stringify(filtered));
  pushCentralDb();
  return filtered;
};

// --- USER SERVICE ---
export const getUsers = (): User[] => {
  const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
  let migrated = false;
  const migratedUsers = users.map((u) => {
    if (u.role === 'staff' && !u.branch) {
      migrated = true;
      return { ...u, branch: 'K R Nagar' as const };
    }
    return u;
  });
  if (migrated) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(migratedUsers));
  }
  return migratedUsers;
};

export const saveUser = (user: User): User[] => {
  const users = getUsers();
  const index = users.findIndex((u) => u.id === user.id);
  if (index >= 0) {
    users[index] = {
      ...user,
      // If password wasn't edited (or not passed), keep the old one
      password: user.password || users[index].password
    };
  } else {
    users.push(user);
  }
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  pushCentralDb();
  return users;
};

export const deleteUser = (id: string): User[] => {
  const users = getUsers();
  // Don't allow deleting the last admin
  const userToDelete = users.find((u) => u.id === id);
  if (userToDelete?.role === 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      throw new Error("Cannot delete the only remaining Admin account!");
    }
  }
  const filtered = users.filter((u) => u.id !== id);
  localStorage.setItem(KEYS.USERS, JSON.stringify(filtered));
  pushCentralDb();
  return filtered;
};

// --- SESSION / AUTH SERVICE ---
export const getCurrentUser = (): User | null => {
  const session = sessionStorage.getItem(KEYS.SESSION);
  return session ? JSON.parse(session) : null;
};

export const login = (username: string, password: string): User => {
  const users = getUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );
  if (!user) {
    throw new Error('Invalid Username or Password');
  }
  // Store session (exclude password for security)
  const sessionUser = { ...user };
  delete sessionUser.password;
  sessionStorage.setItem(KEYS.SESSION, JSON.stringify(sessionUser));
  return sessionUser;
};

export const logout = (): void => {
  sessionStorage.removeItem(KEYS.SESSION);
};

// --- SHOP SETTINGS SERVICE ---
export const getSettings = (): ShopSettings => {
  const settings = localStorage.getItem(KEYS.SETTINGS);
  return settings ? JSON.parse(settings) : DEFAULT_SETTINGS;
};

export const saveSettings = (settings: ShopSettings): ShopSettings => {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  pushCentralDb();
  return settings;
};

// --- PORTABILITY (IMPORT/EXPORT) ---
export const exportDatabase = (): string => {
  const data = {
    products: getProducts(),
    invoices: getInvoices(),
    users: getUsers(),
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
  };
  return JSON.stringify(data, null, 2);
};

export const importDatabase = (jsonStr: string): void => {
  try {
    const data = JSON.parse(jsonStr);
    
    // Simple schema validation
    if (!data.products || !data.users || !data.settings) {
      throw new Error('Invalid file format. Missing core database tables.');
    }
    
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(data.products));
    localStorage.setItem(KEYS.USERS, JSON.stringify(data.users));
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
    
    if (data.invoices) {
      localStorage.setItem(KEYS.INVOICES, JSON.stringify(data.invoices));
    } else {
      localStorage.setItem(KEYS.INVOICES, JSON.stringify([]));
    }
    
    pushCentralDb();
    
    // Clear session for security, forcing re-login
    logout();
  } catch (err: any) {
    throw new Error(`Import failed: ${err.message}`);
  }
};

// --- CENTRAL DEV SERVER API SYNC ---
const API_URL = '/api/db';

export const checkServerSync = async (): Promise<boolean> => {
  try {
    const res = await fetch(API_URL, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      return true;
    }
  } catch (e) {
    // API not running (standalone double-click run)
  }
  return false;
};

export const pullCentralDb = async (): Promise<boolean> => {
  if (isWritePending()) {
    return false;
  }
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        let updated = false;
        isSyncPulling = true;
        Object.entries(data).forEach(([key, val]) => {
          if (key === KEYS.SESSION) return; // Do not sync user sessions to the server!
          if (typeof val === 'string') {
            const current = localStorage.getItem(key);
            if (current !== val) {
              localStorage.setItem(key, val);
              updated = true;
            }
          }
        });
        isSyncPulling = false;
        return updated;
      } else {
        // Central database is empty! Upload our local storage data to seed the server
        await pushCentralDb();
      }
    }
  } catch (e) {
    isSyncPulling = false;
    // Standalone fallback
  }
  return false;
};

export const pushCentralDb = async (): Promise<boolean> => {
  try {
    const payload: Record<string, string> = {};
    Object.values(KEYS).forEach((key) => {
      if (key === KEYS.SESSION) return; // Do not sync user sessions to the server!
      const val = localStorage.getItem(key);
      if (val) {
        payload[key] = val;
      }
    });
    
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      return true;
    }
  } catch (e) {
    // Sync failed
  }
  return false;
};
