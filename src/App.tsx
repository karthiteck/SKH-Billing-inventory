import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import {
  Paintbrush,
  Layers,
  ShoppingCart,
  History,
  Settings,
  Plus,
  Minus,
  Trash2,
  Search,
  LogOut,
  CheckCircle,
  AlertCircle,
  Printer,
  Download,
  Upload,
  Database,
  TrendingUp,
  DollarSign,
  FileText,
  X,
  Lock,
  Moon,
  Sun,
  RefreshCw,
  Edit2,
  Menu,
  Eye,
  Phone,
  Mail
} from 'lucide-react';
import type {
  Product,
  Invoice,
  InvoiceItem,
  User as DbUser,
  ShopSettings
} from './db/localDb';
import {
  getProducts,
  saveProduct,
  deleteProduct,
  getInvoices,
  saveInvoice,
  updateInvoice,
  deleteInvoice,
  getUsers,
  saveUser,
  deleteUser,
  getCurrentUser,
  login as dbLogin,
  logout as dbLogout,
  getSettings,
  saveSettings,
  exportDatabase,
  importDatabase,
  initDatabase,
  checkServerSync,
  pullCentralDb
} from './db/localDb';

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('skh_billing_theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  // Authentication State
  const [currentUser, setCurrentUser] = useState<DbUser | null>(getCurrentUser());
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Routing State
  const [currentView, setCurrentView] = useState<'dashboard' | 'pos' | 'inventory' | 'reports' | 'settings'>(() => {
    const saved = localStorage.getItem('skh_billing_view');
    return (saved as any) || 'dashboard';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const navigateTo = (view: 'dashboard' | 'pos' | 'inventory' | 'reports' | 'settings') => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  // Sidebar State (Retractable and Expandable)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('skh_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('skh_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Application Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [shopSettings, setShopSettings] = useState<ShopSettings>(getSettings());

  // POS / Cart States
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGst, setCustomerGst] = useState('');
  const [billingBranch, setBillingBranch] = useState<'K R Nagar' | 'Bettadapura'>('K R Nagar');
  const [dashboardBranchFilter, setDashboardBranchFilter] = useState<'All' | 'K R Nagar' | 'Bettadapura'>('All');
  const [reportsBranchFilter, setReportsBranchFilter] = useState<'All' | 'K R Nagar' | 'Bettadapura'>('All');
  const [warehouseBranchFilter, setWarehouseBranchFilter] = useState<'All' | 'K R Nagar' | 'Bettadapura'>('All');
  const [revenueSplitPeriod, setRevenueSplitPeriod] = useState<'today' | 'total'>('today');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI' | 'Credit'>('Cash');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string>('All');
  const [catalogBrandFilter, setCatalogBrandFilter] = useState<string>('All');
  
  // Custom Tinting Dialog State
  const [selectedBaseProduct, setSelectedBaseProduct] = useState<Product | null>(null);
  const [tintCode, setTintCode] = useState('');
  const [tintFee, setTintFee] = useState<number>(0);
  const [tintQty, setTintQty] = useState<number>(1);

  // Settings Tab State
  const [activeSettingsTab, setActiveSettingsTab] = useState<'shop' | 'portability' | 'users'>('shop');
  const [settingsBranch, setSettingsBranch] = useState<'K R Nagar' | 'Bettadapura'>('K R Nagar');
  const [zipBranchFilter, setZipBranchFilter] = useState<'All' | 'K R Nagar' | 'Bettadapura'>('All');

  // Inventory Form State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<Omit<Product, 'id'>>({
    name: '',
    brand: 'Asian Paints',
    category: 'Interior Paints',
    finish: 'N/A',
    volume: '4L',
    price: 0,
    stockKRNagar: 0,
    stockBettadapura: 0,
    minStock: 5,
    isBase: false,
    basePaintType: 'ready_mix',
    barcode: ''
  });

  // User Manager State (Admin Only)
  const [editingUser, setEditingUser] = useState<DbUser | null>(null);
  const [userForm, setUserForm] = useState<Omit<DbUser, 'id'>>({
    username: '',
    password: '',
    role: 'staff',
    name: '',
    branch: 'K R Nagar'
  });

  // Receipt Printer View State
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);

  // View Invoice Dialog State
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Alert/Toast State
  interface Toast {
    id: string;
    message: string;
    type: 'success' | 'danger';
  }
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Barcode Scanning Buffer (USB wedge scanner captures)
  const barcodeBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  // Sync data on load & theme updates
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('skh_billing_theme', theme);
  }, [theme]);

  // Save current view selection on changes
  useEffect(() => {
    localStorage.setItem('skh_billing_view', currentView);
  }, [currentView]);

  const refreshAllData = () => {
    setProducts(getProducts());
    setInvoices(getInvoices());
    setUsers(getUsers());
    setShopSettings(getSettings());
  };

  useEffect(() => {
    if (currentUser) {
      refreshAllData();
      const userBranch = currentUser.branch || 'K R Nagar';
      if (currentUser.role === 'staff') {
        setDashboardBranchFilter(userBranch);
        setReportsBranchFilter(userBranch);
        setWarehouseBranchFilter(userBranch);
        setZipBranchFilter(userBranch);
        setBillingBranch(userBranch);
        setSettingsBranch(userBranch);
      }
    }
  }, [currentUser]);

  // Central database network polling sync (runs every 5 seconds)
  useEffect(() => {
    const runSync = async () => {
      const available = await checkServerSync();
      if (available) {
        const pulled = await pullCentralDb();
        if (pulled) {
          refreshAllData();
        }
      }
    };
    runSync();
    const interval = setInterval(runSync, 5000);
    return () => clearInterval(interval);
  }, []);

  // Barcode scan listener
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Barcode scanners usually send rapid keystrokes followed by "Enter"
      const now = Date.now();
      if (now - lastKeyTime.current > 100) {
        barcodeBuffer.current = ''; // Clear buffer if key speed is slow (human typing)
      }
      
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 5) {
          handleBarcodeScanned(barcodeBuffer.current);
          barcodeBuffer.current = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [products, billingBranch]);

  const handleBarcodeScanned = (code: string) => {
    const foundProduct = products.find(
      (p) => p.barcode === code || p.id === code
    );
    if (foundProduct) {
      if (foundProduct.isBase) {
        // Base paint requires tint formula, open tint dialog
        setSelectedBaseProduct(foundProduct);
        setTintCode('');
        setTintFee(0);
        setTintQty(1);
      } else {
        addToCart(foundProduct, 1, 'N/A', 0);
        showToast(`Added ${foundProduct.name} to cart`, 'success');
      }
    } else {
      showToast(`No product found for barcode: ${code}`, 'danger');
    }
  };

  // Toast Helpers
  const showToast = (message: string, type: 'success' | 'danger' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Authentication Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = dbLogin(authUsername, authPassword);
      setCurrentUser(user);
      setAuthError('');
      setAuthUsername('');
      setAuthPassword('');
      showToast(`Welcome back, ${user.name}!`, 'success');
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    dbLogout();
    setCurrentUser(null);
    setCart([]);
    showToast('Logged out successfully', 'success');
  };

  // Cart operations
  const addToCart = (product: Product, quantity = 1, customTintCode = 'N/A', customTintFee = 0) => {
    const itemPrice = product.price + customTintFee;
    
    // Check available stock limit (accounting for items already in cart)
    const qtyInCart = cart
      .filter((item) => item.productId === product.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    const productStock = billingBranch === 'Bettadapura' ? (product.stockBettadapura || 0) : (product.stockKRNagar || 0);
    if (productStock < qtyInCart + quantity) {
      const remaining = productStock - qtyInCart;
      showToast(remaining > 0 ? `Only ${remaining} items remaining in stock!` : 'Out of stock!', 'danger');
      return;
    }

    setCart((prev) => {
      // Find if matching product AND color tint code already exists in cart
      const existingIndex = prev.findIndex(
        (item) => item.productId === product.id && item.tintCode === customTintCode
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        if (productStock < newQty) {
          showToast(`Cannot add more. Exceeds stock limit (${productStock})!`, 'danger');
          return prev;
        }
        updated[existingIndex].quantity = newQty;
        updated[existingIndex].subtotal = newQty * itemPrice;
        return updated;
      } else {
        const newItem: InvoiceItem = {
          productId: product.id,
          name: product.name,
          brand: product.brand,
          volume: product.volume,
          category: product.category,
          quantity,
          basePrice: product.price,
          tintCode: customTintCode,
          tintFee: customTintFee,
          price: itemPrice,
          subtotal: quantity * itemPrice
        };
        return [...prev, newItem];
      }
    });
  };

  const updateCartQty = (productId: string, tintCode: string, change: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCart((prev) => {
      const index = prev.findIndex(
        (item) => item.productId === productId && item.tintCode === tintCode
      );
      if (index === -1) return prev;

      const item = prev[index];
      const newQty = item.quantity + change;

      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }

      const productStock = billingBranch === 'Bettadapura' ? (product.stockBettadapura || 0) : (product.stockKRNagar || 0);
      if (productStock < newQty) {
        showToast(`Stock limit reached (${productStock})!`, 'danger');
        return prev;
      }

      const updated = [...prev];
      updated[index].quantity = newQty;
      updated[index].subtotal = newQty * item.price;
      return updated;
    });
  };

  const removeFromCart = (productId: string, tintCode: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.productId === productId && item.tintCode === tintCode))
    );
  };

  // Cart Totals calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'flat') {
      return Math.min(discountValue, cartSubtotal);
    } else {
      return (cartSubtotal * Math.min(discountValue, 100)) / 100;
    }
  }, [cartSubtotal, discountType, discountValue]);

  const taxableAmount = useMemo(() => {
    return Math.max(0, cartSubtotal - discountAmount);
  }, [cartSubtotal, discountAmount]);

  const taxAmount = useMemo(() => {
    return (taxableAmount * shopSettings.defaultTaxRate) / 100;
  }, [taxableAmount, shopSettings.defaultTaxRate]);

  const cartGrandTotal = useMemo(() => {
    return taxableAmount + taxAmount;
  }, [taxableAmount, taxAmount]);

  // POS Checkout Handler
  const handleCheckout = () => {
    if (cart.length === 0) {
      showToast('Cart is empty!', 'danger');
      return;
    }

    try {
      let finalInvoice: Invoice;
      if (editingInvoiceId) {
        finalInvoice = updateInvoice(editingInvoiceId, {
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || 'N/A',
          customerGst: customerGst || 'N/A',
          items: cart,
          subtotal: cartSubtotal,
          discount: discountAmount,
          discountType,
          discountValue,
          taxRate: shopSettings.defaultTaxRate,
          taxAmount,
          grandTotal: cartGrandTotal,
          paymentMethod,
          branch: billingBranch
        });
        setEditingInvoiceId(null);
      } else {
        finalInvoice = saveInvoice({
          date: new Date().toISOString(),
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || 'N/A',
          customerGst: customerGst || 'N/A',
          items: cart,
          subtotal: cartSubtotal,
          discount: discountAmount,
          discountType,
          discountValue,
          taxRate: shopSettings.defaultTaxRate,
          taxAmount,
          grandTotal: cartGrandTotal,
          paymentMethod,
          cashierName: currentUser?.name || 'Unknown Cashier',
          cashierId: currentUser?.id || 'N/A',
          branch: billingBranch
        });
      }

      // Show receipt view and clear cart
      setInvoiceToPrint(finalInvoice);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGst('');
      setDiscountValue(0);
      setPaymentMethod('Cash');
      
      // Refresh inventory stock values
      refreshAllData();
      showToast(editingInvoiceId ? 'Invoice updated successfully!' : 'Invoice generated successfully!', 'success');
      
      // Delay opening system print modal slightly to ensure component rendering
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (err: any) {
      showToast(`Checkout Error: ${err.message}`, 'danger');
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    // 1. Map invoice items back into POS cart items
    setCart(invoice.items);
    setCustomerName(invoice.customerName || '');
    setCustomerPhone(invoice.customerPhone === 'N/A' ? '' : invoice.customerPhone);
    setCustomerGst(invoice.customerGst === 'N/A' ? '' : invoice.customerGst);
    setPaymentMethod(invoice.paymentMethod);
    setDiscountType(invoice.discountType || 'flat');
    setDiscountValue(invoice.discountValue || 0);
    setBillingBranch(invoice.branch || 'K R Nagar');
    
    // 2. Set editing ID and redirect to POS view
    setEditingInvoiceId(invoice.id);
    setViewingInvoice(null);
    setCurrentView('pos');
    showToast(`Loaded invoice ${invoice.invoiceNumber} for editing.`, 'success');
  };

  const handleDeleteInvoice = (id: string) => {
    if (confirm('Are you sure you want to delete this invoice? This will restore stock levels for all items.')) {
      try {
        deleteInvoice(id);
        setInvoices(getInvoices());
        setProducts(getProducts());
        showToast('Invoice deleted and stock restored.', 'success');
      } catch (err: any) {
        showToast(err.message, 'danger');
      }
    }
  };

  // Inventory CRUD
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || productForm.price <= 0) {
      showToast('Please fill out Name and Price correctly.', 'danger');
      return;
    }

    const payload: Product = {
      ...productForm,
      id: editingProduct ? editingProduct.id : `p_${Date.now()}`
    };

    saveProduct(payload);
    setProducts(getProducts());
    setEditingProduct(null);
    setProductForm({
      name: '',
      brand: 'Asian Paints',
      category: 'Interior Paints',
      finish: 'N/A',
      volume: '4L',
      price: 0,
      stockKRNagar: 0,
      stockBettadapura: 0,
      minStock: 5,
      isBase: false,
      basePaintType: 'ready_mix',
      barcode: ''
    });
    showToast(`Product ${payload.name} saved successfully`, 'success');
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      brand: prod.brand,
      category: prod.category,
      finish: prod.finish,
      volume: prod.volume,
      price: prod.price,
      stockKRNagar: prod.stockKRNagar || 0,
      stockBettadapura: prod.stockBettadapura || 0,
      minStock: prod.minStock,
      isBase: prod.isBase,
      basePaintType: prod.basePaintType || (prod.isBase ? 'tintable' : 'none'),
      barcode: prod.barcode || ''
    });
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      deleteProduct(id);
      setProducts(getProducts());
      showToast('Product deleted.', 'success');
    }
  };

  // User Management CRUD (Admin Only)
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username || !userForm.name) {
      showToast('Please enter Username and Full Name.', 'danger');
      return;
    }

    // Passwords are required for new users
    if (!editingUser && !userForm.password) {
      showToast('Password is required for new users.', 'danger');
      return;
    }

    const payload: DbUser = {
      ...userForm,
      id: editingUser ? editingUser.id : `u_${Date.now()}`
    };

    try {
      saveUser(payload);
      setUsers(getUsers());
      setEditingUser(null);
      setUserForm({
        username: '',
        password: '',
        role: 'staff',
        name: '',
        branch: 'K R Nagar'
      });
      showToast(`User profile for ${payload.name} saved successfully`, 'success');
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const handleEditUser = (u: DbUser) => {
    setEditingUser(u);
    setUserForm({
      username: u.username,
      password: '', // Blank so it doesn't leak in the input, but db keeps old password if left blank
      role: u.role,
      name: u.name,
      branch: u.branch || 'K R Nagar'
    });
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        deleteUser(id);
        setUsers(getUsers());
        showToast('User profile deleted.', 'success');
      } catch (err: any) {
        showToast(err.message, 'danger');
      }
    }
  };

  // Shop Settings update
  const handleSaveShopSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(shopSettings);
    showToast('Shop settings updated.', 'success');
  };

  // Portability imports
  const handleExportDb = () => {
    try {
      const dataStr = exportDatabase();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const downloadName = `skh_billing_backup_${new Date().toISOString().slice(0,10)}.json`;
      link.download = downloadName;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Database backup downloaded!', 'success');
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'danger');
    }
  };

  const generatePDFBlob = (inv: Invoice, settings: ShopSettings): Blob => {
    // A5 format: 148 x 210 mm
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });

    const xLeft = 8;
    const xWidth = 132;
    const xRight = xLeft + xWidth;
    const xCenter = xLeft + xWidth / 2;

    const printCentered = (text: string, y: number, fontSize: number, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.text(text, xCenter, y, { align: 'center' });
    };

    // Shop Header Box (Bordered Rectangle)
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(xLeft, 8, xWidth, 20);

    // Shop Details
    printCentered(settings.shopName, 12, 10, true);
    
    const branchAddress = inv.branch === 'Bettadapura'
      ? (settings.addressBettadapura || settings.address)
      : settings.address;
    printCentered(branchAddress, 16, 7.5);
    
    printCentered(`Phone: ${settings.phone}  |  Mail: crgowtham2016@gmail.com`, 20, 7.5);
    printCentered(`GSTIN: ${settings.gstin}`, 24, 8.5, true);

    // Invoice divider (grey filled bar)
    doc.setFillColor(220, 225, 230);
    doc.rect(xLeft, 31, xWidth, 7, 'F');
    doc.rect(xLeft, 31, xWidth, 7, 'D');
    printCentered('INVOICE', 36, 10, true);

    // Customer Metadata Table
    doc.rect(xLeft, 47, xWidth, 18);
    doc.line(xLeft, 53, xRight, 53);
    doc.line(xLeft, 59, xRight, 59);
    doc.line(85, 47, 85, 65);

    // Customer Data
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Name:', xLeft + 2, 51);
    doc.setFont('helvetica', 'normal');
    doc.text(inv.customerName === 'Walk-in Customer' ? '' : inv.customerName, xLeft + 18, 51);

    doc.setFont('helvetica', 'bold');
    doc.text('Address:', xLeft + 2, 57);
    doc.setFont('helvetica', 'normal');
    const displayPhone = inv.customerPhone === 'N/A' ? '' : inv.customerPhone;
    doc.text(displayPhone, xLeft + 18, 57);

    doc.setFont('helvetica', 'bold');
    doc.text('GSTIN:', xLeft + 2, 63);
    doc.setFont('helvetica', 'normal');
    doc.text(inv.customerGst, xLeft + 18, 63);

    // Voucher Info
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 87, 51);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(inv.date).toLocaleDateString(), 105, 51);

    doc.setFont('helvetica', 'bold');
    doc.text('Invoice No:', 87, 57);
    doc.setFont('helvetica', 'normal');
    doc.text(inv.invoiceNumber, 105, 57);

    doc.setFont('helvetica', 'bold');
    doc.text('State:', 87, 63);
    doc.setFont('helvetica', 'normal');
    doc.text('KAR (Code: 29)', 105, 63);

    // Items Table Headers
    const colWidths = {
      sl: 10,
      desc: 62,
      hsn: 12,
      qty: 12,
      price: 17,
      amount: 19
    };

    const colX = {
      sl: xLeft,
      desc: xLeft + colWidths.sl,
      hsn: xLeft + colWidths.sl + colWidths.desc,
      qty: xLeft + colWidths.sl + colWidths.desc + colWidths.hsn,
      price: xLeft + colWidths.sl + colWidths.desc + colWidths.hsn + colWidths.qty,
      amount: xLeft + colWidths.sl + colWidths.desc + colWidths.hsn + colWidths.qty + colWidths.price
    };

    doc.line(xLeft, 69, xRight, 69);
    doc.line(xLeft, 75, xRight, 75);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Sl No', colX.sl + colWidths.sl / 2, 73, { align: 'center' });
    doc.text('Item Description', colX.desc + 1, 73);
    doc.text('HSN', colX.hsn + colWidths.hsn / 2, 73, { align: 'center' });
    doc.text('Qty', colX.qty + colWidths.qty / 2, 73, { align: 'center' });
    doc.text('Price', colX.price + colWidths.price - 1, 73, { align: 'right' });
    doc.text('Amount', colX.amount + colWidths.amount - 1, 73, { align: 'right' });

    let yPos = 79;
    inv.items.forEach((item, idx) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      
      doc.text(String(idx + 1), colX.sl + colWidths.sl / 2, yPos, { align: 'center' });
      doc.text(item.name, colX.desc + 1, yPos);
      
      const isPaintCategory = 
        item.category === 'Interior Paints' || 
        item.category === 'Exterior Paints' || 
        item.category === 'Wood & Metal Paints' || 
        item.category === 'Primers' ||
        item.name.toLowerCase().includes('paint') ||
        item.name.toLowerCase().includes('base') ||
        item.name.toLowerCase().includes('primer') ||
        item.name.toLowerCase().includes('royale') ||
        item.name.toLowerCase().includes('apex') ||
        item.name.toLowerCase().includes('easy clean');
      const hsnText = isPaintCategory ? '3209' : '---';
      doc.text(hsnText, colX.hsn + colWidths.hsn / 2, yPos, { align: 'center' });
      
      doc.text(String(item.quantity), colX.qty + colWidths.qty / 2, yPos, { align: 'center' });
      doc.text(item.price.toFixed(2), colX.price + colWidths.price - 1, yPos, { align: 'right' });
      doc.text(item.subtotal.toFixed(2), colX.amount + colWidths.amount - 1, yPos, { align: 'right' });

      if (item.tintCode !== 'N/A') {
        yPos += 3.5;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.text(`* Colour Code: ${item.tintCode} | Tint Fee: Rs. ${item.tintFee.toFixed(2)}`, colX.desc + 1, yPos);
        yPos -= 3.5;
      }

      yPos += item.tintCode !== 'N/A' ? 9.5 : 6;
    });

    // Draw horizontal border below the last item row
    doc.line(xLeft, yPos - 1, xRight, yPos - 1);

    let yTotalSection = yPos + 4;
    // Check if total section & signatures fit on page, otherwise add a new page
    if (yTotalSection + 42 > 200) {
      doc.addPage();
      yTotalSection = 15;
    }

    // Terms and Conditions on the left
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Terms & Conditions:', xLeft + 2, yTotalSection + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('1. Goods once sold cannot be taken back or exchanged.', xLeft + 2, yTotalSection + 5);
    doc.text('2. Subject to local jurisdiction.', xLeft + 2, yTotalSection + 8);
    doc.text('3. Total amount is inclusive of applicable GST rates.', xLeft + 2, yTotalSection + 11);
    
    // Draw border rectangle around Terms
    doc.rect(xLeft, yTotalSection - 2, 62, 16);

    // Totals section on the right
    let yTotal = yTotalSection + 1;
    const drawTotalRow = (label: string, value: string, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.text(label, xRight - 55, yTotal);
      doc.text(value, xRight - 2, yTotal, { align: 'right' });
      yTotal += 4.5;
    };

    drawTotalRow('Subtotal', `Rs. ${inv.subtotal.toFixed(2)}`);
    if (inv.discount > 0) {
      drawTotalRow('Discount', `-Rs. ${inv.discount.toFixed(2)}`);
    }
    drawTotalRow('Taxable Value', `Rs. ${(inv.subtotal - inv.discount).toFixed(2)}`);
    drawTotalRow(`CGST/SGST Tax (${inv.taxRate}%)`, `Rs. ${inv.taxAmount.toFixed(2)}`);
    
    doc.line(xRight - 55, yTotal - 2, xRight, yTotal - 2);
    yTotal += 1;
    drawTotalRow('Grand Total', `Rs. ${inv.grandTotal.toFixed(2)}`, true);
    drawTotalRow('Payment Mode', inv.paymentMethod);

    // Signatures
    const ySig = Math.max(yTotal, yTotalSection + 16) + 12;
    // Customer signature line (left)
    doc.line(xLeft, ySig, xLeft + 45, ySig);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Customer Signature', xLeft + 22.5, ySig + 4, { align: 'center' });

    // Shop signature line (right)
    doc.line(xRight - 55, ySig, xRight, ySig);
    doc.text(`For ${settings.shopName}`, xRight - 27.5, ySig - 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('(Authorized Signatory)', xRight - 27.5, ySig + 4, { align: 'center' });

    return doc.output('blob');
  };

  const handleExportZIP = async () => {
    try {
      const activeBranch = currentUser?.role === 'admin' ? zipBranchFilter : (currentUser?.branch || 'K R Nagar');
      
      const filteredInvoices = invoices.filter((inv) => {
        return activeBranch === 'All' || inv.branch === activeBranch;
      });

      if (filteredInvoices.length === 0) {
        showToast(`No invoices found for branch: ${activeBranch}`, 'danger');
        return;
      }

      showToast(`Generating ZIP for ${filteredInvoices.length} invoices...`, 'success');

      const zip = new JSZip();
      
      filteredInvoices.forEach((inv) => {
        const pdfBlob = generatePDFBlob(inv, shopSettings);
        const filename = `${inv.invoiceNumber}_${inv.customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        zip.file(filename, pdfBlob);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      const branchLabel = activeBranch.replace(/\s+/g, '_');
      link.download = `SKH_Invoices_${branchLabel}_PDFs.zip`;
      link.click();
      URL.revokeObjectURL(url);
      
      showToast('ZIP file downloaded successfully!', 'success');
    } catch (err: any) {
      showToast(`ZIP Export failed: ${err.message}`, 'danger');
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = [
        'Date & Time',
        'Invoice Number',
        'Branch',
        'Customer Name',
        'Customer Phone',
        'Customer GSTIN',
        'Taxable Value (INR)',
        'GST Rate (%)',
        'GST Amount (INR)',
        'Grand Total (INR)',
        'Payment Method',
        'Cashier'
      ];

      const rows = reportsFilteredInvoices.map((inv) => {
        const taxableValue = (inv.subtotal - inv.discount).toFixed(2);
        return [
          new Date(inv.date).toLocaleString(),
          inv.invoiceNumber,
          inv.branch || 'K R Nagar',
          inv.customerName || 'Walk-in',
          inv.customerPhone || 'N/A',
          inv.customerGst || 'N/A',
          taxableValue,
          inv.taxRate,
          inv.taxAmount.toFixed(2),
          inv.grandTotal.toFixed(2),
          inv.paymentMethod,
          inv.cashierName
        ];
      });

      const csvString = [
        headers.join(','),
        ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const branchName = reportsBranchFilter === 'All' ? 'All_Branches' : reportsBranchFilter.replace(/\s+/g, '_');
      link.download = `SKH_Invoices_${branchName}_GST_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('GST invoices exported to CSV successfully!', 'success');
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'danger');
    }
  };

  const handleImportDb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonStr = event.target?.result as string;
        importDatabase(jsonStr);
        showToast('Database imported successfully. Logging out for security...', 'success');
        setTimeout(() => {
          handleLogout();
        }, 1500);
      } catch (err: any) {
        showToast(err.message, 'danger');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  // Reset database completely
  const handleFactoryReset = () => {
    if (confirm('WARNING: This will wipe ALL sales, inventory and custom user data. Revert to default settings?')) {
      initDatabase(true);
      showToast('Database reset to defaults. Logging out...', 'success');
      setTimeout(() => {
        handleLogout();
      }, 1500);
    }
  };

  // Filtered Products Catalog for POS
  const filteredCatalogProducts = useMemo(() => {
    return products.filter((p) => {

      const matchesSearch =
        p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.brand.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (p.barcode && p.barcode.includes(catalogSearch));
      
      const matchesCategory =
        catalogCategory === 'All' || p.category === catalogCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, catalogSearch, catalogCategory, billingBranch]);

  // Product categories list
  const categoriesList = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return ['All', ...Array.from(cats)];
  }, [products]);

  // Filter invoices for Dashboard by active branch selection
  const dashboardFilteredInvoices = useMemo(() => {
    if (dashboardBranchFilter === 'All') return invoices;
    return invoices.filter((inv) => inv.branch === dashboardBranchFilter);
  }, [invoices, dashboardBranchFilter]);

  // Filter invoices for Reports by active branch selection
  const reportsFilteredInvoices = useMemo(() => {
    if (reportsBranchFilter === 'All') return invoices;
    return invoices.filter((inv) => inv.branch === reportsBranchFilter);
  }, [invoices, reportsBranchFilter]);

  // Today's invoices for Dashboard
  const dashboardTodayInvoices = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return dashboardFilteredInvoices.filter((inv) => inv.date.includes(today));
  }, [dashboardFilteredInvoices]);

  // Dashboard Stats Calculations
  const dashboardStats = useMemo(() => {
    const todaySales = dashboardTodayInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalTransactions = dashboardFilteredInvoices.length;
    const activeBranch = currentUser?.role === 'admin' ? dashboardBranchFilter : (currentUser?.branch || 'K R Nagar');
    const lowStockCount = products
      .filter((p) => {
        if (activeBranch === 'All') {
          return (p.stockKRNagar || 0) <= p.minStock || (p.stockBettadapura || 0) <= p.minStock;
        } else if (activeBranch === 'Bettadapura') {
          return (p.stockBettadapura || 0) <= p.minStock;
        } else {
          return (p.stockKRNagar || 0) <= p.minStock;
        }
      }).length;
    
    // Total revenue ever
    const totalRevenue = dashboardFilteredInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

    // Payment splits (All time)
    const paymentSplits = dashboardFilteredInvoices.reduce(
      (acc, inv) => {
        acc[inv.paymentMethod] = (acc[inv.paymentMethod] || 0) + inv.grandTotal;
        return acc;
      },
      { Cash: 0, Card: 0, UPI: 0, Credit: 0 } as Record<string, number>
    );

    // Payment splits (Today)
    const todayPaymentSplits = dashboardTodayInvoices.reduce(
      (acc, inv) => {
        acc[inv.paymentMethod] = (acc[inv.paymentMethod] || 0) + inv.grandTotal;
        return acc;
      },
      { Cash: 0, Card: 0, UPI: 0, Credit: 0 } as Record<string, number>
    );

    return {
      todaySales,
      todayInvoiceCount: dashboardTodayInvoices.length,
      totalTransactions,
      totalRevenue,
      lowStockCount,
      paymentSplits,
      todayPaymentSplits
    };
  }, [dashboardFilteredInvoices, dashboardTodayInvoices, products]);

  // Reports Stats Calculations
  const reportsStats = useMemo(() => {
    const totalTransactions = reportsFilteredInvoices.length;
    const totalRevenue = reportsFilteredInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

    // Payment splits
    const paymentSplits = reportsFilteredInvoices.reduce(
      (acc, inv) => {
        acc[inv.paymentMethod] = (acc[inv.paymentMethod] || 0) + inv.grandTotal;
        return acc;
      },
      { Cash: 0, Card: 0, UPI: 0, Credit: 0 } as Record<string, number>
    );

    return {
      totalTransactions,
      totalRevenue,
      paymentSplits
    };
  }, [reportsFilteredInvoices]);

  // Login view if not authenticated
  if (!currentUser) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card animate-fade-in">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="brand-icon">
                <Paintbrush size={24} />
              </div>
            </div>
            <h1 className="auth-title">SKH Billing Portal</h1>
            <p className="auth-subtitle">Paint & Hardware Retail Management</p>
          </div>

          <form onSubmit={handleLogin}>
            {authError && (
              <div className="info-box" style={{ backgroundColor: 'hsl(350, 80%, 95%)', border: '1px solid hsl(350, 80%, 80%)', color: 'var(--danger)', marginBottom: '20px', padding: '12px' }}>
                <AlertCircle size={18} />
                <span>{authError}</span>
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="username">Username / User ID</label>
              <input
                id="username"
                type="text"
                className="input-field"
                placeholder="e.g. admin or cashier"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
              <Lock size={18} /> Log In to Terminal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 99,
            backdropFilter: 'blur(4px)'
          }}
        />
      )}

      {/* Sidebar Nav */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand" style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '0' : '0 8px' }}>
          <div
            onClick={() => navigateTo('dashboard')}
            title="Go to Dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: sidebarCollapsed ? '0' : '12px',
              cursor: 'pointer',
              width: sidebarCollapsed ? '100%' : 'auto',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
            }}
          >
            <div className="brand-icon" style={{ flexShrink: 0 }}>
              <Paintbrush size={20} />
            </div>
            <div className="brand-details">
              <div className="brand-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{shopSettings.shopName}</div>
              <div className="brand-subtitle">POS V1.0.0</div>
            </div>
          </div>
        </div>

        {/* Retractable Toggle Button (Three Lined Hamburger Menu) */}
        <div className="sidebar-toggle-container no-print" style={{ padding: sidebarCollapsed ? '0' : '0 8px', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={toggleSidebar}
            className="sidebar-toggle-bar-btn"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: sidebarCollapsed ? '0' : '12px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.65)',
              cursor: 'pointer',
              padding: sidebarCollapsed ? '12px' : '12px 16px',
              borderRadius: 'var(--radius-md)',
              transition: 'all var(--transition-fast)'
            }}
          >
            <Menu size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Collapse Menu</span>
          </button>
        </div>

        <nav className="nav-menu">
          <button
            onClick={() => navigateTo('dashboard')}
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            title="Dashboard"
          >
            <Layers size={18} /> <span>Dashboard</span>
          </button>
          <button
            onClick={() => navigateTo('pos')}
            className={`nav-item ${currentView === 'pos' ? 'active' : ''}`}
            title="POS Billing"
          >
            <ShoppingCart size={18} /> <span>POS Billing</span>
          </button>
          <button
            onClick={() => navigateTo('inventory')}
            className={`nav-item ${currentView === 'inventory' ? 'active' : ''}`}
            title="Inventory Stock"
          >
            <Database size={18} /> <span>Inventory Stock</span>
          </button>
          <button
            onClick={() => navigateTo('reports')}
            className={`nav-item ${currentView === 'reports' ? 'active' : ''}`}
            title="Sales & Invoices"
          >
            <History size={18} /> <span>Sales & Invoices</span>
          </button>
          <button
            onClick={() => navigateTo('settings')}
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            title="Settings"
          >
            <Settings size={18} /> <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-badge" style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
            <div className="user-avatar" style={{ flexShrink: 0 }}>
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{currentUser.name}</span>
              <span className="user-role">{currentUser.role}</span>
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center' }}>
            <LogOut size={14} /> <span style={{ marginLeft: '6px' }}>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className={`main-content ${sidebarCollapsed ? 'collapsed' : ''}`}>
        
        {/* Header toolbar */}
        <div className="header-bar no-print">
          {/* Mobile Menu Toggle Button */}
          <button
            className="mobile-menu-toggle btn btn-secondary"
            onClick={() => setMobileMenuOpen(true)}
            style={{
              display: 'none',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              alignItems: 'center',
              justifyContent: 'center',
              height: '40px',
              width: '40px',
              borderColor: 'var(--border-color)',
              color: 'var(--text-color)',
              background: 'transparent',
              flexShrink: 0
            }}
            title="Open Navigation Menu"
          >
            <Menu size={20} />
          </button>

          <div className="header-title-section">
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--warning) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '4px',
                display: 'inline-block'
              }}
            >
              Sri Kalabyraveshwara Hardware & Paints
            </div>
            <h1 className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {currentView === 'dashboard' && 'Dashboard Overview'}
              {currentView === 'pos' && 'Billing POS Terminal'}
              {currentView === 'inventory' && 'Inventory Stock Management'}
              {currentView === 'reports' && 'Sales & Invoice History'}
              {currentView === 'settings' && 'App Configuration'}
            </h1>
            <p className="header-subtitle">
              {currentView === 'dashboard' && 'Daily operations, sales trends and warnings.'}
              {currentView === 'pos' && 'Search products, add tint codes and draft customer invoice.'}
              {currentView === 'inventory' && 'Add paint cans, bases, brushes and adjust warehouse levels.'}
              {currentView === 'reports' && 'Browse, view details or re-print generated invoices.'}
              {currentView === 'settings' && 'Customize invoice rates, users profiles and data portability.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {currentView === 'dashboard' && currentUser?.role === 'admin' && (
              <select
                className="input-field"
                value={dashboardBranchFilter}
                onChange={(e) => setDashboardBranchFilter(e.target.value as any)}
                style={{ width: '160px', height: '40px', padding: '0 12px', fontSize: '0.85rem', cursor: 'pointer' }}
                title="Filter by Store Branch"
              >
                <option value="All">All Branches</option>
                <option value="K R Nagar">K R Nagar</option>
                <option value="Bettadapura">Bettadapura</option>
              </select>
            )}
            {currentView === 'reports' && currentUser?.role === 'admin' && (
              <select
                className="input-field"
                value={reportsBranchFilter}
                onChange={(e) => setReportsBranchFilter(e.target.value as any)}
                style={{ width: '160px', height: '40px', padding: '0 12px', fontSize: '0.85rem', cursor: 'pointer' }}
                title="Filter by Store Branch"
              >
                <option value="All">All Branches</option>
                <option value="K R Nagar">K R Nagar</option>
                <option value="Bettadapura">Bettadapura</option>
              </select>
            )}
            {currentUser?.role !== 'admin' && currentUser?.branch && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', border: '1px dashed var(--border-color)', padding: '8px 12px', borderRadius: 'var(--radius-md)', height: '40px' }}>
                <span>Store: <strong>{currentUser.branch}</strong></span>
              </div>
            )}
            <button
              className="theme-switch"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              title="Toggle Dark/Light Mode"
              style={{ height: '40px', width: '40px' }}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>

        {/* --- VIEW: DASHBOARD --- */}
        {currentView === 'dashboard' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* KPI Metrics */}
            <div className="kpi-grid">
              <div
                className="card kpi-card kpi-card-clickable"
                onClick={() => setCurrentView('pos')}
                title="Open POS Terminal"
                style={{ border: '1px solid var(--primary-light)' }}
              >
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <span className="kpi-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>Quick Action</span>
                  <div className="kpi-value" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-main)' }}>
                    Generate Invoice
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Open billing POS terminal
                  </span>
                </div>
                <div className="kpi-icon" style={{ backgroundColor: 'var(--primary)', flexShrink: 0 }}>
                  <ShoppingCart size={24} />
                </div>
              </div>

              <div className="card kpi-card">
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <span className="kpi-label">Today's Sales</span>
                  <div className="kpi-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shopSettings.currency}{dashboardStats.todaySales.toFixed(2)}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                    Active billing day
                  </span>
                </div>
                <div className="kpi-icon" style={{ backgroundColor: 'var(--primary)', flexShrink: 0 }}>
                  <DollarSign size={24} />
                </div>
              </div>

              <div className="card kpi-card">
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <span className="kpi-label">Today's Bills</span>
                  <div className="kpi-value">{dashboardStats.todayInvoiceCount}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Invoices printed
                  </span>
                </div>
                <div className="kpi-icon" style={{ backgroundColor: 'var(--success)', flexShrink: 0 }}>
                  <FileText size={24} />
                </div>
              </div>

              <div className="card kpi-card">
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <span className="kpi-label">Low Stock items</span>
                  <div className="kpi-value">{dashboardStats.lowStockCount}</div>
                  <span style={{ fontSize: '0.75rem', color: dashboardStats.lowStockCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {dashboardStats.lowStockCount > 0 ? 'Action required soon' : 'All stocks optimal'}
                  </span>
                </div>
                <div className="kpi-icon" style={{ backgroundColor: dashboardStats.lowStockCount > 0 ? 'var(--danger)' : 'var(--text-muted)', flexShrink: 0 }}>
                  <Layers size={24} />
                </div>
              </div>
            </div>

            {/* Main dashboard content */}
            <div className="dashboard-grid">
              
              {/* Recent Invoices list */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Today's Transactions</h3>
                {dashboardTodayInvoices.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No recent transactions
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Bill No.</th>
                          <th>Customer</th>
                          <th>Method</th>
                          <th>Total</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardTodayInvoices.map((inv) => (
                          <tr key={inv.id}>
                            <td style={{ fontWeight: 700 }}>{inv.invoiceNumber}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>{inv.customerName}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inv.customerPhone}</span>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-primary">{inv.paymentMethod}</span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{shopSettings.currency}{inv.grandTotal.toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setViewingInvoice(inv)}
                                  title="View Invoice Details"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Eye size={12} /> View
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setInvoiceToPrint(inv);
                                    setTimeout(() => window.print(), 300);
                                  }}
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Printer size={12} /> Reprint
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteInvoice(inv.id)}
                                  title="Delete Invoice & Restore Stock"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Trash2 size={12} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payment Methods & Quick alerts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Payment split breakdown */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Payment Revenue Splitting</h3>
                    <select
                      className="input-field"
                      value={revenueSplitPeriod}
                      onChange={(e) => setRevenueSplitPeriod(e.target.value as any)}
                      style={{ width: '130px', height: '32px', padding: '0 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      <option value="today">Today's Revenue</option>
                      <option value="total">Total Revenue</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(dashboardStats.paymentSplits).map(([method, val]) => {
                      const displayVal = revenueSplitPeriod === 'today' ? dashboardStats.todayPaymentSplits[method] : val;
                      const totalSum = revenueSplitPeriod === 'today' ? dashboardStats.todaySales : dashboardStats.totalRevenue;
                      return (
                        <div key={method} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600 }}>{method}</span>
                            <span>{shopSettings.currency}{displayVal.toFixed(2)}</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                backgroundColor:
                                  method === 'Cash' ? 'var(--success)' :
                                  method === 'UPI' ? 'var(--primary)' :
                                  method === 'Card' ? 'var(--warning)' : 'var(--danger)',
                                width: `${totalSum > 0 ? (displayVal / totalSum) * 100 : 0}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Low inventory alert notification widget */}
                {dashboardStats.lowStockCount > 0 && (
                  <div className="card" style={{ borderLeft: '4px solid var(--danger)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                      <AlertCircle size={20} />
                      <h4 style={{ fontWeight: 700, fontSize: '0.9rem' }}>Low Stock Alert</h4>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {dashboardStats.lowStockCount} products are below their minimum threshold stock levels.
                    </p>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ marginTop: '8px', width: '100%' }}
                      onClick={() => setCurrentView('inventory')}
                    >
                      Restock Products
                    </button>
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        {/* --- VIEW: POS BILLING TERMINAL --- */}
        {currentView === 'pos' && (
          <div className="pos-layout animate-fade-in no-print">
            {editingInvoiceId && (
              <div
                className="card animate-fade-in"
                style={{
                  gridColumn: '1 / -1',
                  borderLeft: '4px solid var(--warning)',
                  backgroundColor: 'var(--primary-light)',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Edit2 size={24} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      Editing Invoice Mode
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      You are editing invoice: <strong>{invoices.find(inv => inv.id === editingInvoiceId)?.invoiceNumber}</strong>. Saving checkout will update the items and adjust stock levels.
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setEditingInvoiceId(null);
                    setCart([]);
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerGst('');
                    setDiscountValue(0);
                    setPaymentMethod('Cash');
                    showToast('Editing mode cancelled. Cart cleared.', 'success');
                  }}
                >
                  Cancel Edit
                </button>
              </div>
            )}
            
            {/* Catalog Browser */}
            <div className="pos-catalog-section">
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Search & Filter tools */}
                <div className="catalog-search-bar">
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Search paint, brushes, codes, or scan barcode..."
                      style={{ width: '100%', paddingLeft: '38px' }}
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                    />
                    <Search
                      size={18}
                      style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                  </div>
                  <button className="btn btn-secondary" onClick={() => setCatalogSearch('')} title="Reset Search">
                    Clear
                  </button>
                </div>

                {/* Categories badges selection - only show when searching */}
                {catalogSearch.trim() !== '' && (
                  <div className="color-swatch-picker" style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                    {categoriesList.map((cat) => (
                      <button
                        key={cat}
                        className={`btn btn-sm ${catalogCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ borderRadius: '50px' }}
                        onClick={() => setCatalogCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Grid Catalog list or Search Placeholder */}
              {catalogSearch.trim() === '' ? (
                <div className="card animate-fade-in" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <Search size={36} style={{ color: 'var(--primary)', opacity: 0.5 }} />
                  <div>
                    <h4 style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', fontSize: '1.05rem' }}>Search or Scan to Start Billing</h4>
                    <p style={{ fontSize: '0.85rem', maxWidth: '320px', margin: '0 auto', lineHeight: '1.4' }}>Type a paint name, brand, tint code, or scan a product's barcode to find and add it.</p>
                  </div>
                </div>
              ) : filteredCatalogProducts.length === 0 ? (
                <div className="card animate-fade-in" style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No products matched "{catalogSearch}".
                </div>
              ) : (
                <div className="catalog-grid animate-fade-in">
                  {filteredCatalogProducts.map((prod) => {
                    const brandClass =
                      prod.brand === 'Asian Paints' ? 'paint-brand-asian' :
                      prod.brand === 'Berger' ? 'paint-brand-berger' :
                      prod.brand === 'Dulux' ? 'paint-brand-dulux' :
                      prod.brand === 'Birla Opus' ? 'paint-brand-birla' : 'paint-brand-generic';

                    const qtyInCart = cart
                      .filter((item) => item.productId === prod.id)
                      .reduce((sum, item) => sum + item.quantity, 0);
                    const productStock = billingBranch === 'Bettadapura' ? (prod.stockBettadapura || 0) : (prod.stockKRNagar || 0);
                    const availableStock = productStock - qtyInCart;
                    const isOut = availableStock <= 0;

                    return (
                      <div
                        key={prod.id}
                        className={`card product-item-card ${brandClass}`}
                        style={{ opacity: isOut ? 0.6 : 1 }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="product-item-brand">{prod.brand}</span>
                            {prod.isBase && (
                              <span className="badge badge-warning" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                                Tintable Base
                              </span>
                            )}
                          </div>
                          <h4 className="product-item-name">{prod.name}</h4>
                        </div>

                        <div className="product-item-details">
                          <span>Vol: {prod.volume}</span>
                          <span>Stock: {availableStock}</span>
                        </div>

                        <div className="product-item-footer">
                          <span className="product-item-price">
                            {shopSettings.currency}{prod.price}
                          </span>
                          
                          {isOut ? (
                            <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>OUT OF STOCK</span>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                if (prod.isBase) {
                                  setSelectedBaseProduct(prod);
                                  setTintCode('');
                                  setTintFee(0);
                                  setTintQty(1);
                                } else {
                                  addToCart(prod, 1);
                                  showToast(`Added ${prod.name}`, 'success');
                                }
                              }}
                            >
                              <Plus size={14} /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Billing Cart & Details */}
            <div className="pos-cart-section">
              
              {/* Customer credentials */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Customer Information</h3>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Customer Full Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Phone Number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="GSTIN (Optional)"
                    value={customerGst}
                    onChange={(e) => setCustomerGst(e.target.value.toUpperCase())}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                {currentUser?.role === 'admin' ? (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <select
                      className="input-field"
                      value={billingBranch}
                      onChange={(e) => setBillingBranch(e.target.value as any)}
                    >
                      <option value="K R Nagar">Branch: K R Nagar</option>
                      <option value="Bettadapura">Branch: Bettadapura</option>
                    </select>
                  </div>
                ) : (
                  <div style={{ width: '100%', fontSize: '0.85rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', padding: '8px 12px', borderRadius: 'var(--radius-md)', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)', boxSizing: 'border-box' }}>
                    Billing for Branch: <strong>{billingBranch}</strong>
                  </div>
                )}
              </div>

              {/* Active Cart */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Bill Cart</h3>
                  <span className="badge badge-primary">{cart.length} unique items</span>
                </div>

                {cart.length === 0 ? (
                  <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Cart is empty. Tap items in catalog.
                  </div>
                ) : (
                  <div className="cart-items-list">
                    {cart.map((item) => (
                      <div key={`${item.productId}-${item.tintCode}`} className="cart-item">
                        <div className="cart-item-info">
                          <span className="cart-item-title">{item.name}</span>
                          <span className="cart-item-meta">{item.brand} • {item.volume}</span>
                          {item.tintCode !== 'N/A' && (
                            <span className="cart-item-tinting">
                              <Paintbrush size={10} /> Tint: {item.tintCode} (+{shopSettings.currency}{item.tintFee})
                            </span>
                          )}
                        </div>

                        <div className="cart-item-pricing">
                          <button
                            className="btn-close"
                            style={{ alignSelf: 'flex-end', width: '20px', height: '20px' }}
                            onClick={() => removeFromCart(item.productId, item.tintCode)}
                          >
                            <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                          </button>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="cart-qty-ctrl">
                              <button
                                className="cart-qty-btn"
                                onClick={() => updateCartQty(item.productId, item.tintCode, -1)}
                              >
                                <Minus size={10} />
                              </button>
                              <span className="cart-qty-val">{item.quantity}</span>
                              <button
                                className="cart-qty-btn"
                                onClick={() => updateCartQty(item.productId, item.tintCode, 1)}
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                            <span className="cart-item-subtotal">
                              {shopSettings.currency}{item.subtotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subtotal, discount calculations */}
                <div className="cart-totals">
                  <div className="cart-totals-row">
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                    <span>{shopSettings.currency}{cartSubtotal.toFixed(2)}</span>
                  </div>

                  <div className="cart-totals-row" style={{ alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Discount</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select
                        className="input-field"
                        style={{ padding: '2px 4px', fontSize: '0.75rem', borderRadius: '4px' }}
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as 'flat' | 'percent')}
                      >
                        <option value="flat">Value ({shopSettings.currency})</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                      <input
                        type="number"
                        className="input-field"
                        style={{ padding: '2px 6px', width: '50px', fontSize: '0.75rem', borderRadius: '4px', textAlign: 'right' }}
                        value={discountValue}
                        min="0"
                        onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                  </div>

                  {discountAmount > 0 && (
                    <div className="cart-totals-row" style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>
                      <span>Discount Waved</span>
                      <span>-{shopSettings.currency}{discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="cart-totals-row">
                    <span style={{ color: 'var(--text-muted)' }}>GST/Tax ({shopSettings.defaultTaxRate}%)</span>
                    <span>{shopSettings.currency}{taxAmount.toFixed(2)}</span>
                  </div>

                  <div className="cart-totals-row grand-total">
                    <span>Payable Total</span>
                    <span>{shopSettings.currency}{cartGrandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Option Selector */}
                <div className="form-group" style={{ marginTop: '4px' }}>
                  <label>Select Payment Mode</label>
                  <select
                    className="input-field"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                  >
                    <option value="Cash">Cash payment</option>
                    <option value="UPI">UPI / QR Code Scan</option>
                    <option value="Card">Credit/Debit Card POS</option>
                    <option value="Credit">Store Outstanding Credit</option>
                  </select>
                </div>

                {/* Checkout Trigger */}
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                >
                  <Printer size={18} /> Print & Save Invoice
                </button>
              </div>

            </div>
          </div>
        )}

        {/* --- VIEW: INVENTORY MANAGER --- */}
        {currentView === 'inventory' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div className="inventory-layout">
              
              {/* Product Form */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {editingProduct ? 'Edit Paint/Hardware' : 'Add New Product'}
                </h3>
                
                <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label>Product Name</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Royale Emulsion, Brush 2-in"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Brand</label>
                    <select
                      className="input-field"
                      value={productForm.brand}
                      onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                    >
                      <option value="Asian Paints">Asian Paints</option>
                      <option value="Birla Opus">Birla Opus</option>
                      <option value="Accessories">Accessories</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      className="input-field"
                      value={productForm.category}
                      onChange={(e) => {
                        const cat = e.target.value;
                        const nextIsBase = (cat === 'Accessories' || cat === 'Solvents') ? false : productForm.isBase;
                        const nextBaseType = (cat === 'Accessories' || cat === 'Solvents') ? 'none' : (productForm.basePaintType || (nextIsBase ? 'tintable' : 'ready_mix'));
                        setProductForm({ ...productForm, category: cat, isBase: nextIsBase, basePaintType: nextBaseType as any });
                      }}
                    >
                      <option value="Interior Paints">Interior Paints</option>
                      <option value="Exterior Paints">Exterior Paints</option>
                      <option value="Wood & Metal Paints">Wood & Metal</option>
                      <option value="Primers">Primers</option>
                      <option value="Accessories">Brushes & Tools</option>
                      <option value="Solvents">Thinner & Solvents</option>
                    </select>
                  </div>

                  <div className="input-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="form-group">
                      <label>Can Volume</label>
                      <select
                        className="input-field"
                        value={productForm.volume}
                        onChange={(e) => setProductForm({ ...productForm, volume: e.target.value })}
                      >
                        <option value="1L">1L</option>
                        <option value="4L">4L</option>
                        <option value="10L">10L</option>
                        <option value="20L">20L</option>
                        <option value="N/A">N/A</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Selling Price</label>
                      <input
                        type="number"
                        className="input-field"
                        value={productForm.price || ''}
                        min="1"
                        onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                        required
                      />
                    </div>
                  </div>

                  <div className="input-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="form-group">
                      <label>Stock (Krnr)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={productForm.stockKRNagar === 0 ? '' : productForm.stockKRNagar}
                        min="0"
                        placeholder="Krnr Qty"
                        onChange={(e) => setProductForm({ ...productForm, stockKRNagar: Number(e.target.value) })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Stock (Bpura)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={productForm.stockBettadapura === 0 ? '' : productForm.stockBettadapura}
                        min="0"
                        placeholder="Bpura Qty"
                        onChange={(e) => setProductForm({ ...productForm, stockBettadapura: Number(e.target.value) })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Barcode ID (Scan)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Click and Scan barcode"
                      value={productForm.barcode}
                      onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Min Stock alert</label>
                    <input
                      type="number"
                      className="input-field"
                      value={productForm.minStock}
                      min="1"
                      onChange={(e) => setProductForm({ ...productForm, minStock: Number(e.target.value) })}
                    />
                  </div>

                  {/* Is Base Paint selection radio buttons */}
                  {productForm.category !== 'Accessories' && productForm.category !== 'Solvents' && (
                    <div className="form-group" style={{ margin: '8px 0' }}>
                      <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>Product Base Type</label>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="isBaseRadio"
                            checked={productForm.basePaintType === 'ready_mix' || (!productForm.basePaintType && !productForm.isBase)}
                            onChange={() => setProductForm({ ...productForm, isBase: false, basePaintType: 'ready_mix' })}
                          />
                          Ready Mix Paint
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="isBaseRadio"
                            checked={productForm.basePaintType === 'tintable' || (!productForm.basePaintType && productForm.isBase)}
                            onChange={() => setProductForm({ ...productForm, isBase: true, basePaintType: 'tintable' })}
                          />
                          Tintable Base Paint
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="isBaseRadio"
                            checked={productForm.basePaintType === 'none'}
                            onChange={() => setProductForm({ ...productForm, isBase: false, basePaintType: 'none' })}
                          />
                          None
                        </label>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                      {editingProduct ? 'Update Stock' : 'Create Entry'}
                    </button>
                    {editingProduct && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingProduct(null);
                          setProductForm({
                            name: '',
                            brand: 'Asian Paints',
                            category: 'Interior Paints',
                            finish: 'N/A',
                            volume: '4L',
                            price: 0,
                            stockKRNagar: 0,
                            stockBettadapura: 0,
                            minStock: 5,
                            isBase: false,
                            basePaintType: 'ready_mix',
                            barcode: ''
                          });
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Product Catalog List */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Warehouse Stock Listings</h3>
                  
                  {/* Filters Section */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {currentUser?.role === 'admin' ? (
                      <select
                        className="input-field"
                        value={warehouseBranchFilter}
                        onChange={(e) => setWarehouseBranchFilter(e.target.value as any)}
                        style={{ padding: '6px 12px', fontSize: '0.85rem', width: '130px' }}
                      >
                        <option value="All">All Branches</option>
                        <option value="K R Nagar">K R Nagar</option>
                        <option value="Bettadapura">Bettadapura</option>
                      </select>
                    ) : (
                      <span className="badge badge-secondary" style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-color)', fontSize: '0.75rem', border: '1px dashed var(--primary)' }}>
                        Branch: {currentUser?.branch || 'K R Nagar'}
                      </span>
                    )}

                    <select
                      className="input-field"
                      value={catalogBrandFilter}
                      onChange={(e) => setCatalogBrandFilter(e.target.value)}
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      <option value="All">All Brands</option>
                      <option value="Asian Paints">Asian Paints</option>
                      <option value="Birla Opus">Birla Opus</option>
                      <option value="Accessories">Accessories</option>
                    </select>

                    <select
                      className="input-field"
                      value={catalogCategory}
                      onChange={(e) => setCatalogCategory(e.target.value)}
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      {categoriesList.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product Details</th>
                        <th>Category</th>
                        <th>Price</th>
                        {(currentUser?.role === 'admin' ? (warehouseBranchFilter === 'All' || warehouseBranchFilter === 'K R Nagar') : ((currentUser?.branch || 'K R Nagar') === 'K R Nagar')) && <th>Stock (Krnr)</th>}
                        {(currentUser?.role === 'admin' ? (warehouseBranchFilter === 'All' || warehouseBranchFilter === 'Bettadapura') : ((currentUser?.branch || 'K R Nagar') === 'Bettadapura')) && <th>Stock (Bpura)</th>}
                        <th>Alert Threshold</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products
                        .filter((p) => catalogCategory === 'All' || p.category === catalogCategory)
                        .filter((p) => catalogBrandFilter === 'All' || p.brand === catalogBrandFilter)
                        .map((prod) => {
                          const activeBranch = currentUser?.role === 'admin' ? warehouseBranchFilter : (currentUser?.branch || 'K R Nagar');
                          const showKRNagar = activeBranch === 'All' || activeBranch === 'K R Nagar';
                          const showBettadapura = activeBranch === 'All' || activeBranch === 'Bettadapura';
                          
                          const isLowKRNagar = prod.stockKRNagar <= prod.minStock;
                          const isOutKRNagar = prod.stockKRNagar <= 0;
                          const isLowBettadapura = prod.stockBettadapura <= prod.minStock;
                          const isOutBettadapura = prod.stockBettadapura <= 0;

                          return (
                            <tr key={prod.id}>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 700 }}>{prod.name}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {prod.brand} • {prod.volume} {prod.barcode ? `• Barcode: ${prod.barcode}` : ''}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                                  {prod.category}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{shopSettings.currency}{prod.price}</td>
                              {showKRNagar && (
                                <td style={{ fontWeight: 700 }}>
                                  <span style={{ color: isOutKRNagar ? 'var(--danger)' : isLowKRNagar ? 'var(--warning)' : 'inherit' }}>
                                    {prod.stockKRNagar}
                                  </span>
                                </td>
                              )}
                              {showBettadapura && (
                                <td style={{ fontWeight: 700 }}>
                                  <span style={{ color: isOutBettadapura ? 'var(--danger)' : isLowBettadapura ? 'var(--warning)' : 'inherit' }}>
                                    {prod.stockBettadapura}
                                  </span>
                                </td>
                              )}
                              <td>
                                <span style={{ color: 'var(--text-muted)' }}>{prod.minStock} cans</span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleEditProduct(prod)}
                                    style={{ padding: '6px' }}
                                    title="Edit Product"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDeleteProduct(prod.id)}
                                    style={{ padding: '6px' }}
                                    title="Delete Product"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* --- VIEW: SALES & INVOICES REPORTS --- */}
        {currentView === 'reports' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Sales Summary Banner */}
            <div className="reports-kpi-grid">
              <div className="card kpi-card">
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <span className="kpi-label">Gross Revenue</span>
                  <div className="kpi-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shopSettings.currency}{reportsStats.totalRevenue.toFixed(2)}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Combined billing history</span>
                </div>
                <div className="kpi-icon" style={{ backgroundColor: 'var(--primary)', flexShrink: 0 }}>
                  <TrendingUp size={24} />
                </div>
              </div>

              <div className="card kpi-card">
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <span className="kpi-label">Cash Drawer sales</span>
                  <div className="kpi-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shopSettings.currency}{reportsStats.paymentSplits.Cash.toFixed(2)}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Physical cash collections</span>
                </div>
                <div className="kpi-icon" style={{ backgroundColor: 'var(--success)', flexShrink: 0 }}>
                  <DollarSign size={24} />
                </div>
              </div>

              <div className="card kpi-card">
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <span className="kpi-label">UPI payments</span>
                  <div className="kpi-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shopSettings.currency}{reportsStats.paymentSplits.UPI.toFixed(2)}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Instant digital transfers</span>
                </div>
                <div className="kpi-icon" style={{ backgroundColor: 'hsl(142, 70%, 45%)', flexShrink: 0 }}>
                  <RefreshCw size={24} />
                </div>
              </div>

              <div className="card kpi-card">
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <span className="kpi-label">Card & Credit Sales</span>
                  <div className="kpi-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shopSettings.currency}{(reportsStats.paymentSplits.Card + reportsStats.paymentSplits.Credit).toFixed(2)}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Card swipes & credit logs</span>
                </div>
                <div className="kpi-icon" style={{ backgroundColor: 'var(--warning)', flexShrink: 0 }}>
                  <FileText size={24} />
                </div>
              </div>

              <div className="card kpi-card">
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <span className="kpi-label">Total Transactions</span>
                  <div className="kpi-value">{reportsStats.totalTransactions}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    All-time saved bills
                  </span>
                </div>
                <div className="kpi-icon" style={{ backgroundColor: 'var(--warning)', flexShrink: 0 }}>
                  <TrendingUp size={24} />
                </div>
              </div>
            </div>

            {/* Invoices list and filters */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Invoices Archive</h3>
                {reportsFilteredInvoices.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={14} /> Export to GST CSV
                  </button>
                )}
              </div>
              
              {reportsFilteredInvoices.length === 0 ? (
                <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No transaction records found for this branch.
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Bill No.</th>
                        <th>Customer Contact</th>
                        <th>Taxable Amt</th>
                        <th>Tax / GST</th>
                        <th>Grand Total</th>
                        <th>Pay Method</th>
                        <th>Branch</th>
                        <th>Issued By</th>
                        <th style={{ textAlign: 'right' }}>Voucher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsFilteredInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ fontSize: '0.85rem' }}>
                            {new Date(inv.date).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 700 }}>{inv.invoiceNumber}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600 }}>{inv.customerName}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phone: {inv.customerPhone}</span>
                              {inv.customerGst !== 'N/A' && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>GSTIN: {inv.customerGst}</span>
                              )}
                            </div>
                          </td>
                          <td>{shopSettings.currency}{inv.subtotal - inv.discount}</td>
                          <td>{shopSettings.currency}{inv.taxAmount.toFixed(2)}</td>
                          <td style={{ fontWeight: 700 }}>{shopSettings.currency}{inv.grandTotal.toFixed(2)}</td>
                          <td>
                            <span className="badge badge-primary">{inv.paymentMethod}</span>
                          </td>
                          <td>
                            <span className="badge badge-secondary" style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-color)', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                              {inv.branch || 'K R Nagar'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.85rem' }}>{inv.cashierName}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setViewingInvoice(inv)}
                                title="View Invoice Details"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Eye size={12} /> View
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setInvoiceToPrint(inv);
                                  setTimeout(() => window.print(), 300);
                                }}
                                style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Printer size={12} /> Reprint
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteInvoice(inv.id)}
                                title="Delete Invoice & Restore Stock"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* --- VIEW: SETTINGS --- */}
        {currentView === 'settings' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Tabs for different settings sections */}
            <div className="tab-nav">
              <button
                className={`tab-btn ${activeSettingsTab === 'shop' ? 'active' : ''}`}
                onClick={() => setActiveSettingsTab('shop')}
              >
                Shop Profile & Taxes
              </button>
              <button
                className={`tab-btn ${activeSettingsTab === 'portability' ? 'active' : ''}`}
                onClick={() => setActiveSettingsTab('portability')}
              >
                Backup & Portability
              </button>
              
              {/* CRITICAL FEATURE: USER MANAGEMENT - Admin Only Access */}
              {currentUser.role === 'admin' && (
                <button
                  className={`tab-btn ${activeSettingsTab === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveSettingsTab('users')}
                >
                  User Accounts (Admin Panel)
                </button>
              )}
            </div>

            {/* TAB: SHOP SETTINGS */}
            {activeSettingsTab === 'shop' && (
              <div className="card" style={{ maxWidth: '600px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Shop Profile Details</h3>
                
                <form onSubmit={handleSaveShopSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label>Registered Shop Name</label>
                    <input
                      type="text"
                      className="input-field"
                      value={shopSettings.shopName}
                      onChange={(e) => setShopSettings({ ...shopSettings, shopName: e.target.value })}
                      required
                    />
                  </div>

                  {currentUser?.role === 'admin' ? (
                    <div className="form-group">
                      <label>Select Branch to Configure Details</label>
                      <select
                        className="input-field"
                        value={settingsBranch}
                        onChange={(e) => setSettingsBranch(e.target.value as any)}
                      >
                        <option value="K R Nagar">K R Nagar Branch</option>
                        <option value="Bettadapura">Bettadapura Branch</option>
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Active Configuration Branch</label>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                        Locked to branch: <strong>{currentUser?.branch || 'K R Nagar'}</strong>
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Store Address ({settingsBranch})</label>
                    <textarea
                      rows={3}
                      className="input-field"
                      value={settingsBranch === 'Bettadapura' ? (shopSettings.addressBettadapura || '') : (shopSettings.address || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (settingsBranch === 'Bettadapura') {
                          setShopSettings({ ...shopSettings, addressBettadapura: val });
                        } else {
                          setShopSettings({ ...shopSettings, address: val });
                        }
                      }}
                      style={{ resize: 'none' }}
                      required
                    ></textarea>
                  </div>

                  <div className="input-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="form-group">
                      <label>Store Phone Contact</label>
                      <input
                        type="text"
                        className="input-field"
                        value={shopSettings.phone}
                        onChange={(e) => setShopSettings({ ...shopSettings, phone: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>GSTIN Tax Number</label>
                      <input
                        type="text"
                        className="input-field"
                        value={shopSettings.gstin}
                        onChange={(e) => setShopSettings({ ...shopSettings, gstin: e.target.value.toUpperCase() })}
                        style={{ textTransform: 'uppercase' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="input-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="form-group">
                      <label>Currency Symbol</label>
                      <input
                        type="text"
                        className="input-field"
                        value={shopSettings.currency}
                        onChange={(e) => setShopSettings({ ...shopSettings, currency: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Default GST/Tax Rate (%)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={shopSettings.defaultTaxRate}
                        min="0"
                        onChange={(e) => setShopSettings({ ...shopSettings, defaultTaxRate: Number(e.target.value) })}
                        required
                      />
                    </div>
                  </div>

                  <div className="input-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '12px' }}>
                    <div className="form-group">
                      <label>Invoice Prefix ({settingsBranch})</label>
                      <input
                        type="text"
                        className="input-field"
                        value={settingsBranch === 'Bettadapura' ? (shopSettings.invoicePrefixBettadapura || '') : (shopSettings.invoicePrefix || '')}
                        placeholder={settingsBranch === 'Bettadapura' ? "e.g. SKH" : "e.g. SRI"}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          if (settingsBranch === 'Bettadapura') {
                            setShopSettings({ ...shopSettings, invoicePrefixBettadapura: val });
                          } else {
                            setShopSettings({ ...shopSettings, invoicePrefix: val });
                          }
                        }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Next Sequence ({settingsBranch})</label>
                      <input
                        type="number"
                        className="input-field"
                        value={settingsBranch === 'Bettadapura' ? (shopSettings.nextInvoiceSeqBettadapura || 1) : (shopSettings.nextInvoiceSeq || 1)}
                        min="1"
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (settingsBranch === 'Bettadapura') {
                            setShopSettings({ ...shopSettings, nextInvoiceSeqBettadapura: val });
                          } else {
                            setShopSettings({ ...shopSettings, nextInvoiceSeq: val });
                          }
                        }}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '16px' }}>
                    Save Shop Configuration
                  </button>
                </form>
              </div>
            )}

            {/* TAB: BACKUP & RESTORE */}
            {activeSettingsTab === 'portability' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                
                {/* Export / Sync card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--primary)' }}>
                    <Download size={24} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Export Store Backup</h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Download the entire store database (products, invoices, users, settings) as a single JSON file. You can load this backup onto any other tablet or PC to sync data instantly without any networking or IP configurations.
                  </p>
                  
                  <button onClick={handleExportDb} className="btn btn-primary" style={{ marginTop: 'auto' }}>
                    <Download size={18} /> Export Database File
                  </button>
                </div>

                {/* Import card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--success)' }}>
                    <Upload size={24} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Import Database</h3>
                  </div>
                  
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Upload a previously exported `.json` database file. <strong>Warning:</strong> This will completely overwrite all existing database records on this device and log you out.
                  </p>

                  <div style={{ marginTop: 'auto' }}>
                    <input
                      type="file"
                      id="db-import-file"
                      accept=".json"
                      onChange={handleImportDb}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="db-import-file"
                      className="btn btn-secondary"
                      style={{ width: '100%', cursor: 'pointer' }}
                    >
                      <Upload size={18} /> Choose Backup File
                    </label>
                  </div>
                </div>

                {/* Database cleanup factory reset */}
                <div className="card" style={{ borderLeft: '4px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger)' }}>
                    <Database size={24} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Factory Reset</h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Reset all settings, erase the transaction logs, clear customized paint catalogs, and restore default admin login credentials.
                  </p>
                  
                  <button onClick={handleFactoryReset} className="btn btn-danger" style={{ marginTop: 'auto' }}>
                    Clear Local Database
                  </button>
                </div>

                {/* Export Invoices ZIP / PDF card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--primary)' }}>
                    <Download size={24} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Export Invoices (ZIP / PDF)</h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Download all invoices for a selected branch as individual PDF documents packaged inside a compressed ZIP archive.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
                    {currentUser?.role === 'admin' ? (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Select Branch</label>
                        <select
                          className="input-field"
                          value={zipBranchFilter}
                          onChange={(e) => setZipBranchFilter(e.target.value as any)}
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                        >
                          <option value="All">All Branches</option>
                          <option value="K R Nagar">K R Nagar</option>
                          <option value="Bettadapura">Bettadapura</option>
                        </select>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', padding: '6px 10px', borderRadius: 'var(--radius-md)' }}>
                        Locked to branch: <strong>{currentUser?.branch || 'K R Nagar'}</strong>
                      </div>
                    )}

                    <button onClick={handleExportZIP} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Download size={18} /> Export Invoices ZIP
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB: USER MANAGEMENT - STRICTLY PROTECTED ADMIN PANEL */}
            {activeSettingsTab === 'users' && currentUser.role === 'admin' && (
              <div className="settings-users-layout">
                
                {/* User Entry Form */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                    {editingUser ? 'Update Credentials' : 'Create Staff Member'}
                  </h3>

                  <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group">
                      <label>Full Employee Name</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Ramesh Kumar"
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Username / User ID</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. ramesh12"
                        value={userForm.username}
                        onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Role Privilege</label>
                      <select
                        className="input-field"
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                      >
                        <option value="staff">Cashier (POS & billing only)</option>
                        <option value="admin">System Admin (Full Settings Control)</option>
                      </select>
                    </div>

                    {userForm.role === 'staff' && (
                      <div className="form-group">
                        <label>Assigned Branch / Store Location</label>
                        <select
                          className="input-field"
                          value={userForm.branch || 'K R Nagar'}
                          onChange={(e) => setUserForm({ ...userForm, branch: e.target.value as any })}
                        >
                          <option value="K R Nagar">K R Nagar</option>
                          <option value="Bettadapura">Bettadapura</option>
                        </select>
                      </div>
                    )}

                    <div className="form-group">
                      <label>
                        {editingUser ? 'Reset Password (Leave blank to keep current)' : 'Password'}
                      </label>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="••••••••"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        required={!editingUser}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                        {editingUser ? 'Apply Edits' : 'Register Staff'}
                      </button>
                      {editingUser && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditingUser(null);
                            setUserForm({
                              username: '',
                              password: '',
                              role: 'staff',
                              name: ''
                            });
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Active user accounts overview */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Authorized Staff Directory</h3>
                  
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee Name</th>
                          <th>Username / ID</th>
                          <th>Privilege Role</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="user-avatar" style={{ backgroundColor: 'var(--primary)', color: 'white', width: '30px', height: '30px', fontSize: '0.8rem' }}>
                                  {u.name.slice(0,2).toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 700 }}>{u.name}</span>
                                  {u.role === 'staff' && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Branch: {u.branch || 'K R Nagar'}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <code style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600 }}>{u.username}</code>
                            </td>
                            <td>
                              <span className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-primary'}`}>
                                {u.role === 'admin' ? 'Administrator' : 'Cashier'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleEditUser(u)}
                                >
                                  <Edit2 size={12} /> Edit
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteUser(u.id)}
                                  disabled={u.id === currentUser.id} // Don't delete logged-in session profile
                                >
                                  <Trash2 size={12} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* --- MODAL: CUSTOM TINT CALCULATOR DIALOG --- */}
      {selectedBaseProduct && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            
            <div className="modal-header">
              <h3 className="modal-title">Custom Color Tint Mixer</h3>
              <button className="btn-close" onClick={() => setSelectedBaseProduct(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="info-box">
                <Paintbrush size={20} style={{ color: 'var(--primary)', marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontWeight: 700 }}>{selectedBaseProduct.name}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Brand: {selectedBaseProduct.brand} • Volume: {selectedBaseProduct.volume} • Base Price: {shopSettings.currency}{selectedBaseProduct.price}
                  </p>
                </div>
              </div>

              <div className="form-group">
                <label>Color Tint Code / Custom Color Name (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Cherry Red 2405, Sky Blue"
                  value={tintCode}
                  onChange={(e) => setTintCode(e.target.value)}
                />
              </div>

              <div className="input-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                  <label>Tinting Charge / Colorant Fee ({shopSettings.currency}) (Optional)</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 150"
                    value={tintFee || ''}
                    min="0"
                    onChange={(e) => setTintFee(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                <div className="form-group">
                  <label>Quantity (Cans)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={tintQty}
                    min="1"
                    max={billingBranch === 'Bettadapura' ? (selectedBaseProduct.stockBettadapura || 0) : (selectedBaseProduct.stockKRNagar || 0)}
                    onChange={(e) => {
                      const productStock = billingBranch === 'Bettadapura' ? (selectedBaseProduct.stockBettadapura || 0) : (selectedBaseProduct.stockKRNagar || 0);
                      setTintQty(Math.min(productStock, Math.max(1, Number(e.target.value))));
                    }}
                  />
                </div>
              </div>
              
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                Effective Price per Can: <strong>{shopSettings.currency}{(selectedBaseProduct.price + tintFee).toFixed(2)}</strong>
                <br />
                Subtotal ({tintQty} cans): <strong>{shopSettings.currency}{((selectedBaseProduct.price + tintFee) * tintQty).toFixed(2)}</strong>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedBaseProduct(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const finalTintCode = tintCode.trim() || 'N/A';
                  const finalTintFee = tintFee || 0;
                  addToCart(selectedBaseProduct, tintQty, finalTintCode, finalTintFee);
                  showToast(`Added ${selectedBaseProduct.name} to invoice`, 'success');
                  setSelectedBaseProduct(null);
                }}
              >
                Mix & Add to Invoice
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL: VIEW INVOICE DETAILS --- */}
      {viewingInvoice && (
        <div className="modal-overlay" onClick={() => setViewingInvoice(null)}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Invoice Details: {viewingInvoice.invoiceNumber}</h3>
              <button className="btn-close" onClick={() => setViewingInvoice(null)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.85rem', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Customer Details</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '4px' }}>{viewingInvoice.customerName}</div>
                  <div>Phone: {viewingInvoice.customerPhone}</div>
                  {viewingInvoice.customerGst !== 'N/A' && <div>GSTIN: {viewingInvoice.customerGst}</div>}
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', textAlign: 'right' }}>Transaction Info</div>
                  <div style={{ textAlign: 'right', marginTop: '4px' }}>Date: <strong>{new Date(viewingInvoice.date).toLocaleString()}</strong></div>
                  <div style={{ textAlign: 'right' }}>Cashier: <strong>{viewingInvoice.cashierName}</strong></div>
                  <div style={{ textAlign: 'right' }}>Payment Mode: <strong className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{viewingInvoice.paymentMethod}</strong></div>
                </div>
              </div>

              <div className="table-container">
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Item Description</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingInvoice.items.map((item, idx) => (
                      <React.Fragment key={idx}>
                        <tr>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.brand} • {item.volume}</span>
                            {item.tintCode !== 'N/A' && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                <Paintbrush size={10} /> Tint Code: {item.tintCode} (+{shopSettings.currency}{item.tintFee})
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{shopSettings.currency}{item.price.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{shopSettings.currency}{item.subtotal.toFixed(2)}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'flex-end', width: '250px', fontSize: '0.9rem', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                  <span>{shopSettings.currency}{viewingInvoice.subtotal.toFixed(2)}</span>
                </div>
                {viewingInvoice.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                    <span>Discount:</span>
                    <span>-{shopSettings.currency}{viewingInvoice.discount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>GST/Tax ({viewingInvoice.taxRate}%):</span>
                  <span>{shopSettings.currency}{viewingInvoice.taxAmount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                  <span>Grand Total:</span>
                  <span>{shopSettings.currency}{viewingInvoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleEditInvoice(viewingInvoice)}
                style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit2 size={16} /> Edit Invoice
              </button>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setViewingInvoice(null);
                    setInvoiceToPrint(viewingInvoice);
                    setTimeout(() => window.print(), 300);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} /> Print Receipt
                </button>
                <button className="btn btn-primary" onClick={() => setViewingInvoice(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- RECEIPT TEMPLATE - ONLY VISIBLE ON PRINT ACTION --- */}
      {invoiceToPrint && (
        <div className="print-area print-only">
          <div className="print-header" style={{ border: '1px solid black', padding: '6px 10px', textAlign: 'center', backgroundColor: '#f1f5f9', lineHeight: '1.2' }}>
            {/* Row 1: Shop Name in one line */}
            <h2 style={{ fontSize: '16px', fontWeight: 900, margin: '0 0 2px 0', textTransform: 'uppercase', color: 'black', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {shopSettings.shopName}
            </h2>
            {/* Row 2: Store Address */}
            <p style={{ margin: '1px 0', fontSize: '13px', color: 'black' }}>
              {invoiceToPrint.branch === 'Bettadapura'
                ? (shopSettings.addressBettadapura || shopSettings.address)
                : shopSettings.address}
            </p>
            {/* Row 3: Mobile and Email with logos */}
            <p style={{ margin: '1px 0', fontSize: '13px', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={12} style={{ color: 'black' }} />
                <span>{shopSettings.phone}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Mail size={12} style={{ color: 'black' }} />
                <span>crgowtham2016@gmail.com</span>
              </span>
            </p>
            {/* Row 4: GST number */}
            <div style={{ fontWeight: 700, fontSize: '13px', margin: '1px 0', color: 'black' }}>
              GSTIN: {shopSettings.gstin}
            </div>
          </div>

          <div style={{ backgroundColor: '#e2e8f0', border: '1px solid black', marginTop: '10px', padding: '5px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', color: 'black', letterSpacing: '1px' }}>
            Invoice
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '10px', marginTop: '8px' }}>
            <tbody>
              <tr>
                <td style={{ width: '12%', fontWeight: 'bold', border: '1px solid black', padding: '4px 6px', color: 'black' }}>Name:</td>
                <td style={{ width: '48%', border: '1px solid black', padding: '4px 6px', color: 'black' }}>{invoiceToPrint.customerName === 'Walk-in Customer' ? '' : invoiceToPrint.customerName}</td>
                <td style={{ width: '15%', fontWeight: 'bold', border: '1px solid black', padding: '4px 6px', color: 'black' }}>Date:</td>
                <td style={{ width: '25%', border: '1px solid black', padding: '4px 6px', color: 'black' }}>{new Date(invoiceToPrint.date).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px 6px', color: 'black' }}>Address:</td>
                <td style={{ border: '1px solid black', padding: '4px 6px', color: 'black' }}>{invoiceToPrint.customerPhone === 'N/A' ? '' : invoiceToPrint.customerPhone}</td>
                <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px 6px', color: 'black' }}>Invoice No:</td>
                <td style={{ border: '1px solid black', padding: '4px 6px', fontWeight: 'bold', color: 'black' }}>{invoiceToPrint.invoiceNumber}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px 6px', color: 'black' }}>GSTIN:</td>
                <td style={{ border: '1px solid black', padding: '4px 6px', color: 'black' }}>{invoiceToPrint.customerGst === 'N/A' ? '' : invoiceToPrint.customerGst}</td>
                <td style={{ fontWeight: 'bold', border: '1px solid black', padding: '4px 6px', color: 'black' }}>State: KAR</td>
                <td style={{ border: '1px solid black', padding: '4px 6px', color: 'black' }}>Code: 29</td>
              </tr>
            </tbody>
          </table>

          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>Sl No</th>
                <th style={{ textAlign: 'left' }}>Item Description</th>
                <th style={{ width: '60px', textAlign: 'center' }}>HSN</th>
                <th style={{ width: '55px', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '85px', textAlign: 'right', paddingRight: '6px' }}>Price</th>
                <th style={{ width: '95px', textAlign: 'right', paddingRight: '6px' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoiceToPrint.items.map((item, idx) => {
                const category = item.category || products.find((p) => p.id === item.productId)?.category || '';
                const isPaint = category ? (
                  category.includes('Paint') || category.includes('Primer')
                ) : (
                  item.name.toLowerCase().includes('paint') ||
                  item.name.toLowerCase().includes('emulsion') ||
                  item.name.toLowerCase().includes('primer') ||
                  item.name.toLowerCase().includes('base')
                );
                const hsn = isPaint ? '3209' : '---';

                return (
                  <React.Fragment key={idx}>
                    <tr>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                        {item.tintCode !== 'N/A' && (
                          <div style={{ fontSize: '8px', fontStyle: 'italic', marginTop: '2px', color: '#4b5563' }}>
                            * Colour Code: {item.tintCode} | Tint Fee: {shopSettings.currency}{item.tintFee.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{hsn}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', paddingRight: '6px' }}>{item.price.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', paddingRight: '6px' }}>{item.subtotal.toFixed(2)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          <div className="print-summary-section">
            <div className="print-payment-box">
              <strong>Terms & Conditions:</strong>
              <div style={{ fontSize: '8px', color: '#4b5563', marginTop: '4px', lineHeight: '1.4' }}>
                1. Goods once sold cannot be taken back or exchanged.
                <br />
                2. Subject to local jurisdiction.
                <br />
                3. Total amount is inclusive of applicable GST rates.
              </div>
            </div>

            <div className="print-totals-box">
              <table className="print-totals-table">
                <tbody>
                  <tr>
                    <td style={{ color: '#4b5563' }}>Subtotal:</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{shopSettings.currency}{invoiceToPrint.subtotal.toFixed(2)}</td>
                  </tr>
                  {invoiceToPrint.discount > 0 && (
                    <tr>
                      <td style={{ color: 'red' }}>Discount (-):</td>
                      <td style={{ textAlign: 'right', color: 'red' }}>-{shopSettings.currency}{invoiceToPrint.discount.toFixed(2)}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ color: '#4b5563' }}>Taxable Value:</td>
                    <td style={{ textAlign: 'right' }}>{shopSettings.currency}{(invoiceToPrint.subtotal - invoiceToPrint.discount).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#4b5563' }}>CGST/SGST Tax ({invoiceToPrint.taxRate}%):</td>
                    <td style={{ textAlign: 'right' }}>{shopSettings.currency}{invoiceToPrint.taxAmount.toFixed(2)}</td>
                  </tr>
                  <tr className="grand-total">
                    <td style={{ textTransform: 'uppercase' }}>Grand Total:</td>
                    <td style={{ textAlign: 'right' }}>{shopSettings.currency}{invoiceToPrint.grandTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="print-signatures">
            <div className="print-sig-box">
              Customer Signature
            </div>
            <div className="print-sig-box">
              For {shopSettings.shopName}
              <div style={{ marginTop: '24px', fontSize: '9px', color: '#6b7280' }}>(Authorized Signatory)</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
