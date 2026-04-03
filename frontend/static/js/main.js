// ============================================
// E-Commerce Pro - REFACTORED State Management
// Professional Architecture with Proper Syncing
// ============================================

const CONFIG = {
    API_BASE_URL: 'http://127.0.0.1:5000/api',
    TOKEN_KEY: 'authToken',
    USER_KEY: 'user',
    CART_KEY: 'cart',
    PAYMENT_OTP_KEY: 'pendingPaymentVerification',
    DEBOUNCE_DELAY: 300,
};

// ============================================
// ✅ GLOBAL STATE OBJECT - Single Source of Truth
// ============================================
const AppState = {
    user: null,
    token: null,
    cart: [],
    selectedAddress: null,
    selectedAddresses: [],
    currentProduct: null,
    currentOrder: null,
    isLoading: false,
    isPendingCart: false,
    isInitialized: false,
    pendingCartProducts: new Set(),
    pendingCartItems: new Set(),
    isHydratingLocalCart: false,
    
    // ✅ Methods for safe state updates
    setUser(user, token) {
        this.user = user || null;
        this.token = token ?? this.token;
        this.persist();
        console.log('[STATE] User set:', user?.username || 'anonymous');
    },
    
    setCart(cartItems) {
        this.cart = Array.isArray(cartItems) ? cartItems.map(normalizeCartItem) : [];
        this.persist();
        this.updateCartBadge();
        console.log('[STATE] Cart synced:', this.cart.length, 'items');
    },
    
    updateCartBadge() {
        const badge = document.getElementById('cart-badge');
        if (badge) {
            badge.textContent = String(getCartCount(this.cart));
        }
    },
    
    persist() {
        try {
            if (this.token) {
                localStorage.setItem(CONFIG.TOKEN_KEY, this.token);
            } else {
                localStorage.removeItem(CONFIG.TOKEN_KEY);
            }

            if (this.user) {
                localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(this.user));
            } else {
                localStorage.removeItem(CONFIG.USER_KEY);
            }

            localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(this.cart));
        } catch (e) {
            console.error('[STATE] Persist failed:', e);
        }
    },
    
    clear() {
        const preservedCart = Array.isArray(this.cart) ? this.cart.map(normalizeCartItem) : [];
        this.user = null;
        this.token = null;
        this.cart = preservedCart;
        this.selectedAddress = null;
        this.selectedAddresses = [];
        this.currentProduct = null;
        this.currentOrder = null;
        this.isHydratingLocalCart = false;
        this.pendingCartProducts.clear();
        this.pendingCartItems.clear();
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        localStorage.removeItem(CONFIG.PAYMENT_OTP_KEY);
        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(this.cart));
        this.updateCartBadge();
        console.log('[STATE] Cleared');
    },
};

function safeJsonParse(rawValue, fallbackValue) {
    try {
        return rawValue ? JSON.parse(rawValue) : fallbackValue;
    } catch (error) {
        console.error('[STATE] JSON parse failed:', error);
        return fallbackValue;
    }
}

function normalizeCartItem(item = {}) {
    const quantity = Number(item.quantity || 0) || 0;
    const price = Number(item.price ?? item.product_price ?? 0) || 0;
    const itemTotal = Number(item.item_total ?? item.itemTotal ?? (price * quantity)) || 0;

    return {
        cartItemUuid: item.cartItemUuid || item.cart_item_uuid || null,
        productName: item.productName || item.product_name || 'Product',
        productUuid: item.productUuid || item.product_uuid || null,
        price,
        quantity,
        itemTotal,
        image: item.image || item.product_image || item.primary_image || null,
    };
}

function cloneCartItems(items = AppState.cart) {
    return Array.isArray(items) ? items.map((item) => normalizeCartItem(item)) : [];
}

function createLocalCartItem(product = {}, quantity = 1) {
    const normalizedQuantity = Math.max(1, Number(quantity) || 1);
    const price = Number(product.price ?? product.product_price ?? 0) || 0;

    return normalizeCartItem({
        cartItemUuid: null,
        productName: product.name || product.productName || product.product_name || 'Product',
        productUuid: product.uuid || product.productUuid || product.product_uuid || null,
        price,
        quantity: normalizedQuantity,
        itemTotal: price * normalizedQuantity,
        image: product.primary_image || product.image || product.product_image || null,
    });
}

function getCartItemIdentifier(item = {}) {
    return item.cartItemUuid || item.productUuid || null;
}

function findCartItemIndex(identifier, items = AppState.cart) {
    return (items || []).findIndex((item) => getCartItemIdentifier(item) === identifier);
}

function getCartProductQuantity(productUuid, items = AppState.cart) {
    return (items || []).reduce((total, item) => {
        if (item.productUuid !== productUuid) {
            return total;
        }

        return total + (Number(item.quantity) || 0);
    }, 0);
}

function setLocalCartQuantity(identifier, quantity) {
    const normalizedQuantity = Number(quantity) || 0;
    const nextCart = cloneCartItems();
    const itemIndex = findCartItemIndex(identifier, nextCart);

    if (itemIndex === -1) {
        return nextCart;
    }

    if (normalizedQuantity < 1) {
        nextCart.splice(itemIndex, 1);
    } else {
        nextCart[itemIndex].quantity = normalizedQuantity;
        nextCart[itemIndex].itemTotal = nextCart[itemIndex].price * normalizedQuantity;
    }

    AppState.setCart(nextCart);
    return nextCart;
}

function addProductToLocalCart(product, quantity = 1) {
    const nextCart = cloneCartItems();
    const cartItem = createLocalCartItem(product, quantity);

    if (!cartItem.productUuid) {
        return nextCart;
    }

    const existingIndex = nextCart.findIndex((item) => item.productUuid === cartItem.productUuid);

    if (existingIndex >= 0) {
        const nextQuantity = (Number(nextCart[existingIndex].quantity) || 0) + cartItem.quantity;
        nextCart[existingIndex].quantity = nextQuantity;
        nextCart[existingIndex].itemTotal = nextCart[existingIndex].price * nextQuantity;
        nextCart[existingIndex].image = nextCart[existingIndex].image || cartItem.image;
        nextCart[existingIndex].productName = nextCart[existingIndex].productName || cartItem.productName;
    } else {
        nextCart.push(cartItem);
    }

    AppState.setCart(nextCart);
    return nextCart;
}

function restoreCartSnapshot(cartItems) {
    AppState.setCart(cartItems);
}

function getCartCount(items = AppState.cart) {
    return (items || []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);
}

function isCustomerSession() {
    return Boolean(AppState.token && AppState.user?.role === 'customer');
}

// ============================================
// ✅ INITIALIZATION - Run on page load
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[INIT] Starting application...');
    
    // Load persisted state
    loadStateFromStorage();
    
    // Set up event listeners
    window.addEventListener('hashchange', router);
    
    // Update UI based on auth state
    updateUIBasedOnAuth();
    AppState.updateCartBadge();
    
    // CRITICAL: Initialize app (fetch fresh data if authenticated)
    await initApp();
    
    // Route to current hash
    router();
});

// ============================================
// ✅ APP INITIALIZATION - Sync with backend
// ============================================
async function initApp() {
    console.log('[INIT] initApp() called, token:', !!AppState.token);
    AppState.isInitialized = false;

    if (!AppState.token) {
        AppState.setCart(AppState.cart);
        AppState.isInitialized = true;
        updateUIBasedOnAuth();
        return false;
    }

    try {
        const userProfile = await API.fetchProfile();
        if (!userProfile?.user) {
            return false;
        }

        if (userProfile.user.role === 'customer') {
            await syncCustomerCart();
        }

        updateUIBasedOnAuth();
        return true;
    } catch (error) {
        console.error('[INIT] Failed to initialize app:', error);
        return false;
    } finally {
        AppState.isInitialized = true;
        console.log('[INIT] App initialized:', {
            user: AppState.user?.email || null,
            role: AppState.user?.role || null,
            cartCount: getCartCount(),
        });
    }
}

function loadPendingPaymentVerification() {
    try {
        const rawValue = localStorage.getItem(CONFIG.PAYMENT_OTP_KEY);
        const parsed = rawValue ? JSON.parse(rawValue) : null;
        if (!parsed?.orderUuid || !parsed?.paymentMethod) {
            return null;
        }
        if (parsed.userUuid && AppState.user?.uuid && parsed.userUuid !== AppState.user.uuid) {
            localStorage.removeItem(CONFIG.PAYMENT_OTP_KEY);
            return null;
        }
        return parsed;
    } catch (error) {
        console.error('[PAYMENT OTP] Failed to load pending state:', error);
        return null;
    }
}

function savePendingPaymentVerification(orderUuid, paymentMethod, options = {}) {
    const pendingState = {
        orderUuid,
        paymentMethod,
        userUuid: AppState.user?.uuid || '',
        email: AppState.user?.email || '',
        emailStatus: options.emailStatus || 'sent',
        expiresInMinutes: Number(options.expiresInMinutes || 10) || 10,
        createdAt: Date.now(),
    };

    localStorage.setItem(CONFIG.PAYMENT_OTP_KEY, JSON.stringify(pendingState));
    return pendingState;
}

function clearPendingPaymentVerification() {
    localStorage.removeItem(CONFIG.PAYMENT_OTP_KEY);
}

function maskEmailAddress(email) {
    const normalized = String(email || '').trim();
    if (!normalized || !normalized.includes('@')) {
        return 'your registered email';
    }

    const [localPart, domain] = normalized.split('@');
    if (!localPart || !domain) {
        return normalized;
    }

    if (localPart.length <= 2) {
        return `${localPart[0] || '*'}*@${domain}`;
    }

    return `${localPart.slice(0, 2)}${'*'.repeat(Math.max(2, localPart.length - 2))}@${domain}`;
}

function getPaymentMethodLabel(method) {
    const labels = {
        cod: 'Cash on Delivery',
        card: 'Card Payment',
        upi: 'UPI',
        netbanking: 'Netbanking',
    };

    return labels[method] || 'Online Payment';
}

function setPaymentOtpLoading(isLoading, label = 'Verify Payment') {
    const verifyButton = document.getElementById('payment-otp-verify-button');
    const resendButton = document.getElementById('payment-otp-resend');
    const input = document.getElementById('payment-otp-input');

    if (verifyButton) {
        verifyButton.disabled = Boolean(isLoading);
        verifyButton.textContent = isLoading ? 'Verifying...' : label;
    }

    if (resendButton) {
        resendButton.disabled = Boolean(isLoading);
    }

    if (input) {
        input.disabled = Boolean(isLoading);
    }
}

function closePaymentOtpModal() {
    const modal = document.getElementById('otp-modal') || document.getElementById('payment-otp-modal');
    const input = document.getElementById('payment-otp-input');

    if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }

    if (input) {
        input.value = '';
    }

    setPaymentOtpLoading(false);
}

function showPaymentOtpModal(context = null) {
    const modal = document.getElementById('otp-modal') || document.getElementById('payment-otp-modal');
    const otpInput = document.getElementById('payment-otp-input');
    const pendingState = context?.orderUuid ? context : loadPendingPaymentVerification();

    if (!modal || !pendingState) {
        return;
    }

    const orderEl = document.getElementById('payment-otp-order');
    const methodEl = document.getElementById('payment-otp-method');
    const emailEl = document.getElementById('payment-otp-email');
    const expiryEl = document.getElementById('payment-otp-expiry');
    const statusEl = document.getElementById('payment-otp-status');
    const maskedEmail = maskEmailAddress(pendingState.email || AppState.user?.email || '');
    const emailFailed = pendingState.emailStatus === 'failed';

    if (orderEl) {
        orderEl.textContent = `#${String(pendingState.orderUuid).slice(0, 8)}`;
    }

    if (methodEl) {
        methodEl.textContent = getPaymentMethodLabel(pendingState.paymentMethod);
    }

    if (emailEl) {
        emailEl.textContent = maskedEmail;
    }

    if (expiryEl) {
        expiryEl.textContent = `${pendingState.expiresInMinutes || 10} min expiry`;
    }

    if (statusEl) {
        statusEl.textContent = emailFailed
            ? 'OTP email delivery failed. Use Resend OTP to send a fresh code.'
            : `Enter the 6-digit OTP sent to ${maskedEmail}.`;
        statusEl.classList.toggle('is-warning', emailFailed);
    }

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    setPaymentOtpLoading(false);

    window.setTimeout(() => {
        otpInput?.focus();
    }, 80);
}

async function finalizeCheckoutPaymentSuccess(orderUuid) {
    clearPendingPaymentVerification();
    AppState.currentOrder = orderUuid;
    AppState.selectedAddress = null;

    if (isCustomerSession()) {
        try {
            await syncCustomerCart({ mergeLocal: false });
        } catch (error) {
            console.warn('[PAYMENT] Cart sync after payment failed:', error);
        }
    }

    if (typeof ui?.renderCheckoutSummary === 'function') {
        ui.renderCheckoutSummary();
    }

    showPaymentSuccessNotification(orderUuid);
    window.setTimeout(() => {
        navigateTo('#orders');
    }, 1800);
}

async function resendPaymentOtp() {
    const pendingState = loadPendingPaymentVerification();
    const resendButton = document.getElementById('payment-otp-resend');

    if (!pendingState) {
        showToast('No pending payment verification found.', 'warning');
        return;
    }

    if (resendButton) {
        resendButton.disabled = true;
        resendButton.textContent = 'Sending...';
    }

    try {
        const response = await API.initiateCheckout(null, pendingState.paymentMethod, pendingState.orderUuid);
        if (!response) {
            return;
        }

        if (response.require_otp) {
            const nextState = savePendingPaymentVerification(pendingState.orderUuid, pendingState.paymentMethod, {
                emailStatus: response.email_status,
                expiresInMinutes: response.expires_in_minutes,
            });
            showPaymentOtpModal(nextState);
            showToast(response.message || 'OTP sent again.', response.email_status === 'failed' ? 'warning' : 'success');
            return;
        }

        closePaymentOtpModal();
        await finalizeCheckoutPaymentSuccess(pendingState.orderUuid);
    } finally {
        if (resendButton) {
            resendButton.disabled = false;
            resendButton.textContent = 'Resend OTP';
        }
    }
}

async function verifyPaymentOtp(event) {
    event?.preventDefault();

    const pendingState = loadPendingPaymentVerification();
    const otpInput = document.getElementById('payment-otp-input');
    const otpCode = String(otpInput?.value || '').trim();

    if (!pendingState) {
        showToast('No pending payment verification found.', 'warning');
        return;
    }

    if (!/^\d{6}$/.test(otpCode)) {
        showToast('Please enter a valid 6-digit OTP.', 'warning');
        otpInput?.focus();
        return;
    }

    setPaymentOtpLoading(true);

    try {
        const response = await API.verifyPaymentOtp(pendingState.orderUuid, otpCode);
        if (!response) {
            return;
        }

        closePaymentOtpModal();
        showToast(response.message || 'Payment verified successfully!', 'success');
        await finalizeCheckoutPaymentSuccess(pendingState.orderUuid);
    } finally {
        setPaymentOtpLoading(false);
    }
}

async function handlePaymentWithOtp(event) {
    event?.preventDefault();

    if (!isCustomerSession()) {
        showToast('Only customers can complete payment', 'error');
        return;
    }

    const pendingState = loadPendingPaymentVerification();
    if (pendingState) {
        showPaymentOtpModal(pendingState);
        return;
    }

    if (!AppState.selectedAddress) {
        showToast('Please select or add an address first', 'warning');
        return;
    }

    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value;
    if (!paymentMethod) {
        showToast('Please select a payment method', 'warning');
        return;
    }

    const checkoutResponse = await API.initiateCheckout(AppState.selectedAddress, paymentMethod);
    if (!checkoutResponse?.order_uuid) {
        return;
    }

    const orderUuid = checkoutResponse.order_uuid;
    AppState.currentOrder = orderUuid;

    if (checkoutResponse.require_otp) {
        const nextState = savePendingPaymentVerification(orderUuid, paymentMethod, {
            emailStatus: checkoutResponse.email_status,
            expiresInMinutes: checkoutResponse.expires_in_minutes,
        });

        if (typeof ui?.renderCheckoutSummary === 'function') {
            ui.renderCheckoutSummary();
        }

        showToast(
            checkoutResponse.message || 'OTP sent to your email.',
            checkoutResponse.email_status === 'failed' ? 'warning' : 'success'
        );
        showPaymentOtpModal(nextState);
        return;
    }

    showToast(checkoutResponse.message || 'Payment completed successfully!', 'success');
    await finalizeCheckoutPaymentSuccess(orderUuid);
}

function reopenPendingPaymentOtp() {
    const pendingState = loadPendingPaymentVerification();
    if (!pendingState) {
        return;
    }

    showPaymentOtpModal(pendingState);
}

window.loadPendingPaymentVerification = loadPendingPaymentVerification;
window.clearPendingPaymentVerification = clearPendingPaymentVerification;
window.showPaymentOtpModal = showPaymentOtpModal;
window.closePaymentOtpModal = closePaymentOtpModal;
window.resendPaymentOtp = resendPaymentOtp;
window.verifyPaymentOtp = verifyPaymentOtp;
window.reopenPendingPaymentOtp = reopenPendingPaymentOtp;
window.handlePaymentWithOtp = handlePaymentWithOtp;
window.handlePayment = handlePaymentWithOtp;

async function hydrateLocalCartToBackend() {
    if (!isCustomerSession() || AppState.isHydratingLocalCart) {
        return;
    }

    const localOnlyItems = AppState.cart.filter((item) => !item.cartItemUuid && item.productUuid && Number(item.quantity) > 0);
    if (localOnlyItems.length === 0) {
        return;
    }

    AppState.isHydratingLocalCart = true;

    try {
        for (const item of localOnlyItems) {
            const response = await API.call('/user/cart', 'POST', {
                product_uuid: item.productUuid,
                quantity: item.quantity,
            });

            if (!response) {
                break;
            }
        }
    } finally {
        AppState.isHydratingLocalCart = false;
    }
}

async function syncCustomerCart(options = {}) {
    if (!isCustomerSession()) {
        return { items: AppState.cart };
    }

    if (options.mergeLocal !== false) {
        await hydrateLocalCartToBackend();
    }

    console.log('[CART] Syncing customer cart from backend...');
    const cartData = await API.fetchCart();
    if (cartData) {
        AppState.setCart(cartData.items || []);
    }

    return cartData;
}

function loadStateFromStorage() {
    try {
        const token = localStorage.getItem(CONFIG.TOKEN_KEY);
        const user = safeJsonParse(localStorage.getItem(CONFIG.USER_KEY), null);
        const cart = safeJsonParse(localStorage.getItem(CONFIG.CART_KEY), []);
        
        if (token) AppState.token = token;
        if (user) AppState.user = user;
        if (Array.isArray(cart)) AppState.cart = cart.map(normalizeCartItem);
        
        console.log('[STORAGE] Loaded:', { token: !!token, user: !!user, cart: AppState.cart.length });
    } catch (error) {
        console.error('[STORAGE] Load failed:', error);
        AppState.clear();
    }
}

// ============================================
// ✅ API ABSTRACTION LAYER - Professional HTTP wrapper
// ============================================

const API = {
    /**
     * Base API call with comprehensive error handling
     */
    async call(endpoint, method = 'GET', body = null) {
        try {
            // Prevent loading state from blocking GET requests
            if (AppState.isLoading && method !== 'GET') {
                console.warn('[API] Request blocked: already loading');
                showToast('Please wait, request in progress...', 'warning');
                return null;
            }

            AppState.isLoading = true;
            const url = `${CONFIG.API_BASE_URL}${endpoint}`;
            
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            // Add token if available
            if (AppState.token) {
                options.headers['Authorization'] = `Bearer ${AppState.token}`;
            }

            // Handle FormData (file uploads)
            if (body instanceof FormData) {
                delete options.headers['Content-Type'];
                options.body = body;
            } else if (body) {
                options.body = JSON.stringify(body);
            }

            console.log(`[API] ${method} ${endpoint}`, body || '');

            const response = await fetch(url, options);
            let data;

            try {
                data = await response.json();
            } catch (e) {
                console.error('[API] JSON parse failed:', e);
                showToast('Invalid server response', 'error');
                return null;
            }

            // Handle 401 - Session expired
            if (response.status === 401) {
                console.warn('[API] 401 - Session expired');
                AppState.clear();
                updateUIBasedOnAuth();
                showToast('Session expired. Please login again.', 'warning');
                navigateTo('#login');
                return null;
            }

            // Handle other errors
            if (!response.ok) {
                const msg = data?.error || data?.message || `Error ${response.status}`;
                console.error(`[API] ${response.status}:`, msg);
                showToast(msg, 'error');
                return null;
            }

            console.log('[API] Response:', data);
            return data;

        } catch (error) {
            console.error('[API] Fetch failed:', error);
            showToast('Network error. Please try again.', 'error');
            return null;
        } finally {
            AppState.isLoading = false;
        }
    },

    // ✅ Authentication
    async login(email, password) {
        const response = await this.call('/auth/login', 'POST', { email, password });
        if (response) {
            AppState.setUser(response.user || { email, role: response.role }, response.access_token);
            return response;
        }
        return null;
    },

    async signup(username, email, password, role) {
        return this.call('/auth/signup', 'POST', { username, email, password, role });
    },

    // ✅ Profile & Cart
    async fetchProfile() {
        const response = await this.call('/user/profile', 'GET');
        if (response?.user) {
            AppState.setUser(response.user, AppState.token);
        }
        return response;
    },

    async fetchCart() {
        return this.call('/user/cart', 'GET');
    },

    async addToCart(product_uuid, quantity) {
        if (AppState.pendingCartProducts.has(product_uuid)) {
            console.warn('[API] Add to cart already pending for product:', product_uuid);
            showToast('Cart update already in progress...', 'warning');
            return null;
        }

        AppState.pendingCartProducts.add(product_uuid);
        try {
            const response = await this.call('/user/cart', 'POST', { product_uuid, quantity });
            if (response) {
                await syncCustomerCart({ mergeLocal: false });
            }
            return response;
        } finally {
            AppState.pendingCartProducts.delete(product_uuid);
        }
    },

    async updateCartItem(cartItemUuid, quantity) {
        return this.call(`/user/cart/${cartItemUuid}`, 'PATCH', { quantity });
    },

    async removeCartItem(cartItemUuid) {
        return this.call(`/user/cart/${cartItemUuid}`, 'DELETE');
    },

    // ✅ Products
    async fetchProducts() {
        return this.call('/user/products', 'GET');
    },

    async fetchProductDetail(uuid) {
        return this.call(`/user/product/${uuid}`, 'GET');
    },

    // ✅ Checkout
    async saveAddress(addressData) {
        return this.call('/user/address', 'POST', addressData);
    },

    async updateAddress(addressUuid, addressData) {
        return this.call(`/user/address/${addressUuid}`, 'PATCH', addressData);
    },

    async deleteAddress(addressUuid) {
        return this.call(`/user/address/${addressUuid}`, 'DELETE');
    },

    async initiateCheckout(address_uuid, payment_method, order_uuid = null) {
        return this.call('/user/checkout/initiate', 'POST', { address_uuid, payment_method, order_uuid });
    },

    async checkout(address_uuid) {
        return this.call('/user/checkout', 'POST', { address_uuid });
    },

    async processPayment(order_uuid, payment_method) {
        return this.call('/user/payment', 'POST', { order_uuid, payment_method });
    },

    async verifyPaymentOtp(order_uuid, otp_code) {
        return this.call('/user/checkout/verify', 'POST', { order_uuid, otp_code });
    },

    // ✅ Orders
    async fetchOrders() {
        return this.call('/user/orders', 'GET');
    },

    async trackOrder(order_uuid) {
        return this.call(`/user/order/${order_uuid}/track`, 'GET');
    },
};

// ============================================
// ✅ UI UTILITIES
// ============================================

function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || '●'}</span>
        <span>${escapeHtml(message)}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function escapeHtml(text) {
    if (!text) return '';
    if (typeof text !== 'string') return String(text);
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function navigateTo(path) {
    window.location.hash = path;
}

// ============================================
// ✅ AUTHENTICATION - Using new API layer
// ============================================

function getAddToCartButton() {
    return document.getElementById('add-to-cart-btn');
}

const ui = {
    updateCartBadge() {
        AppState.updateCartBadge();
    },

    setAddToCartLoading(isLoading) {
        const button = getAddToCartButton();
        if (!button) return;

        const label = button.querySelector('[data-add-to-cart-label]');
        const spinner = button.querySelector('[data-add-to-cart-spinner]');

        button.disabled = isLoading;
        button.classList.toggle('opacity-70', isLoading);
        button.classList.toggle('cursor-not-allowed', isLoading);

        if (spinner) {
            spinner.classList.toggle('hidden', !isLoading);
        }

        if (label) {
            label.textContent = isLoading ? 'Adding...' : 'Add to Cart';
        }
    },

    renderProfileInfo(user) {
        const usernameEl = document.getElementById('profile-username');
        const emailEl = document.getElementById('profile-email');
        const roleEl = document.getElementById('profile-role');

        if (usernameEl) usernameEl.textContent = user?.username || user?.email || '';
        if (emailEl) emailEl.textContent = user?.email || '';
        if (roleEl) roleEl.textContent = user?.role || 'Unknown';
    },

    renderOrders(orders) {
        const ordersContainer = document.getElementById('profile-orders');
        if (!ordersContainer) return;

        if (!Array.isArray(orders) || orders.length === 0) {
            ordersContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No orders yet. Start shopping.</p>';
            return;
        }

        ordersContainer.innerHTML = orders.map((order) => `
            <div class="bg-white p-4 rounded-lg border-l-4 border-blue-500 shadow-sm hover:shadow-md transition">
                <div class="flex justify-between items-start mb-2 gap-3">
                    <div class="flex-1">
                        <p class="font-semibold text-gray-900">Order #${escapeHtml((order.order_uuid || '').slice(0, 8))}</p>
                        <p class="text-xs text-gray-500">${escapeHtml(order.created_at || '')}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                    }">
                        ${escapeHtml((order.status || 'unknown').toUpperCase())}
                    </span>
                </div>
                <p class="text-sm text-gray-700 mb-3">Rs.${Number(order.total_amount || 0).toFixed(2)} • ${Number(order.item_count || 0)} item(s)</p>
                <button onclick="navigateTo('#order-tracking/${order.order_uuid}')" class="text-blue-600 hover:text-blue-800 text-sm font-semibold transition">
                    Track Order ->
                </button>
            </div>
        `).join('');
    },

    renderAddresses(addresses, options = {}) {
        const addressesContainer = document.getElementById('profile-addresses');
        if (!addressesContainer) return;

        if (options.message) {
            addressesContainer.innerHTML = `<p class="text-gray-500 text-sm text-center py-6">${escapeHtml(options.message)}</p>`;
            return;
        }

        if (!Array.isArray(addresses) || addresses.length === 0) {
            addressesContainer.innerHTML = '<p class="text-gray-500 text-sm text-center">No addresses saved yet</p>';
            return;
        }

        addressesContainer.innerHTML = addresses.map((addr) => `
            <div class="bg-blue-50 p-3 rounded-lg text-sm border border-blue-200">
                <p class="font-semibold text-gray-900">${escapeHtml(addr.full_name)}</p>
                <p class="text-gray-600 text-xs">${escapeHtml(addr.street)}</p>
                <p class="text-gray-600 text-xs">${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} - ${escapeHtml(addr.pincode)}</p>
                <p class="text-gray-700 text-xs mt-1">Phone: ${escapeHtml(addr.phone_number)}</p>
            </div>
        `).join('');
    },

    renderCart() {
        const cartItemsDiv = document.getElementById('cart-items');
        if (!cartItemsDiv) return;

        if (AppState.cart.length === 0) {
            cartItemsDiv.innerHTML = `
                <div class="p-8 text-center text-gray-500">
                    <p>Your cart is empty</p>
                    <button onclick="navigateTo('#products')" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">Continue Shopping</button>
                </div>
            `;
            this.renderCartSummary();
            return;
        }

        cartItemsDiv.innerHTML = AppState.cart.map((item) => {
            const isPending = item.cartItemUuid && AppState.pendingCartItems.has(item.cartItemUuid);
            return `
                <div class="p-4 border-b border-gray-200 flex gap-4 last:border-b-0 hover:bg-gray-50 transition">
                    <div class="flex-shrink-0">
                        <img src="${buildImageUrl(item.image)}" alt="${escapeHtml(item.productName)}" class="w-24 h-24 object-cover rounded-lg shadow-sm" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                        <div class="w-24 h-24 bg-gray-200 rounded-lg shadow-sm flex items-center justify-center text-3xl" style="display: none;">[]</div>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-semibold text-lg text-gray-900">${escapeHtml(item.productName)}</h3>
                        <p class="text-gray-600 text-sm mb-3">Rs.${item.price.toFixed(2)} each</p>
                        <div class="flex items-center gap-2 flex-wrap">
                            <button onclick="updateCartQuantity('${item.cartItemUuid}', -1)" class="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded-md transition font-semibold disabled:opacity-50" ${isPending ? 'disabled' : ''}>-</button>
                            <span class="px-4 py-1 bg-gray-100 rounded-md font-semibold text-gray-700 min-w-12 text-center">${item.quantity}</span>
                            <button onclick="updateCartQuantity('${item.cartItemUuid}', 1)" class="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded-md transition font-semibold disabled:opacity-50" ${isPending ? 'disabled' : ''}>+</button>
                            <button onclick="removeFromCart('${item.cartItemUuid}')" class="ml-auto px-4 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition text-sm font-semibold disabled:opacity-50" ${isPending ? 'disabled' : ''}>${isPending ? 'Updating...' : 'Remove'}</button>
                        </div>
                    </div>
                    <div class="text-right flex flex-col justify-between">
                        <p class="font-bold text-lg text-gray-900">Rs.${item.itemTotal.toFixed(2)}</p>
                        <p class="text-xs text-gray-500">x ${item.quantity}</p>
                    </div>
                </div>
            `;
        }).join('');

        this.renderCartSummary();
    },

    renderCartSummary() {
        const subtotal = AppState.cart.reduce((total, item) => total + item.itemTotal, 0);
        const shipping = subtotal > 500 ? 0 : (subtotal > 0 ? 50 : 0);
        const total = subtotal + shipping;

        const subtotalEl = document.getElementById('cart-subtotal');
        const shippingEl = document.getElementById('cart-shipping');
        const totalEl = document.getElementById('cart-total');

        if (subtotalEl) subtotalEl.textContent = `Rs.${subtotal.toFixed(2)}`;
        if (shippingEl) shippingEl.textContent = shipping === 0 ? 'FREE' : `Rs.${shipping.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `Rs.${total.toFixed(2)}`;
    },

    renderCheckoutSummary() {
        const summaryEl = document.getElementById('checkout-summary');
        const totalEl = document.getElementById('checkout-total');
        if (!summaryEl || !totalEl) return;

        const subtotal = AppState.cart.reduce((total, item) => total + item.itemTotal, 0);
        const shipping = subtotal > 500 ? 0 : (subtotal > 0 ? 50 : 0);
        const total = subtotal + shipping;

        summaryEl.innerHTML = AppState.cart.map((item) => `
            <div class="flex justify-between text-sm border-b pb-2 mb-2">
                <span class="text-gray-700">${escapeHtml(item.productName)} <span class="text-gray-500">x ${item.quantity}</span></span>
                <span class="font-semibold">Rs.${item.itemTotal.toFixed(2)}</span>
            </div>
        `).join('') + `
            <div class="space-y-1 mt-3 pt-3 border-t">
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">Subtotal</span>
                    <span class="font-semibold">Rs.${subtotal.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">Shipping</span>
                    <span class="font-semibold">${shipping === 0 ? 'FREE' : `Rs.${shipping.toFixed(2)}`}</span>
                </div>
            </div>
        `;

        totalEl.textContent = `Rs.${total.toFixed(2)}`;
    },
};

function renderCustomerOrdersDetailed(orders) {
    const ordersContainer = document.getElementById('profile-orders');
    if (!ordersContainer) return;

    if (!Array.isArray(orders) || orders.length === 0) {
        ordersContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No orders yet. Start shopping.</p>';
        return;
    }

    ordersContainer.innerHTML = orders.map((order) => `
        <div class="bg-white p-4 rounded-lg border-l-4 border-blue-500 shadow-sm hover:shadow-md transition">
            <div class="flex justify-between items-start mb-2 gap-3">
                <div class="flex-1">
                    <p class="font-semibold text-gray-900">Order #${escapeHtml((order.order_uuid || '').slice(0, 8))}</p>
                    <p class="text-xs text-gray-500">${escapeHtml(order.created_at || '')}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                }">
                    ${escapeHtml((order.status || 'unknown').toUpperCase())}
                </span>
            </div>
            <p class="text-sm text-gray-700 mb-3">Rs.${Number(order.total_amount || 0).toFixed(2)} | ${Number(order.item_count || 0)} item(s)</p>
            <div class="flex items-center gap-4 flex-wrap">
                <button onclick="toggleOrderDetails('${order.order_uuid}')" class="text-gray-700 hover:text-gray-900 text-sm font-semibold transition">
                    View Order
                </button>
                <button onclick="navigateTo('#order-tracking/${order.order_uuid}')" class="text-blue-600 hover:text-blue-800 text-sm font-semibold transition">
                    Track Order ->
                </button>
            </div>
            <div id="order-details-${order.order_uuid}" class="hidden mt-4 pt-4 border-t border-gray-100">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Items</p>
                <div class="space-y-2">
                    ${(Array.isArray(order.items) ? order.items : []).map((item) => `
                        <div class="flex items-start justify-between gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                            <div>
                                <p class="font-medium text-gray-900">${escapeHtml(item.product_name || 'Product')}</p>
                                <p class="text-xs text-gray-500">Qty: ${Number(item.quantity || 0)}</p>
                            </div>
                            <p class="font-semibold text-gray-700">Rs.${Number(item.line_total ?? ((item.price_at_purchase || 0) * (item.quantity || 0))).toFixed(2)}</p>
                        </div>
                    `).join('') || '<p class="text-sm text-gray-500">No order items available.</p>'}
                </div>
            </div>
        </div>
    `).join('');
}

function toggleOrderDetails(orderUuid) {
    const details = document.getElementById(`order-details-${orderUuid}`);
    if (!details) return;
    details.classList.toggle('hidden');
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) {
        showToast('Email and password are required', 'warning');
        return;
    }

    // Use new API.login() method
    try {
        const response = await API.login(email, password);
    
    if (response) {
        showToast('Login successful!', 'success');
        
        // ✅ CRITICAL: Initialize app after login to sync backend data
        await initApp();
        
        // Clear form
        document.getElementById('login-form')?.reset();
        
        updateUIBasedOnAuth();
        navigateTo('#home');
        }
    } catch (error) {
        console.error('[AUTH] Login failed:', error);
        showToast('Unable to login right now. Please try again.', 'error');
    }
}

async function handleSignup(event) {
    event.preventDefault();
    
    const username = document.getElementById('signup-username')?.value?.trim();
    const email = document.getElementById('signup-email')?.value?.trim();
    const password = document.getElementById('signup-password')?.value;
    const role = document.getElementById('signup-role')?.value;

    if (!username || !email || !password || !role) {
        showToast('All fields are required', 'warning');
        return;
    }

    // Use new API.signup() method
    const response = await API.signup(username, email, password, role);
    
    if (response) {
        showToast('Account created! Please login.', 'success');
        switchAuthTab('login');
        const loginEmailField = document.getElementById('login-email');
        if (loginEmailField) {
            loginEmailField.value = email;
        }
        document.getElementById('signup-form')?.reset();
    }
}

function logout() {
    AppState.clear();
    updateUIBasedOnAuth();
    
    // Explicitly clear cart DOM
    const cartItemsDiv = document.getElementById('cart-items');
    if (cartItemsDiv) {
        cartItemsDiv.innerHTML = '';
    }
    
    ui.updateCartBadge();
    showToast('Logged out successfully', 'info');
    navigateTo('#home');
}

// ============================================
// ✅ UI UPDATES BASED ON AUTHENTICATION
// ============================================

function updateUIBasedOnAuth() {
    const isLoggedIn = !!AppState.token;
    const role = AppState.user?.role;
    renderNavbar(isLoggedIn, role);
    ui.updateCartBadge();
}

function renderNavbar(isLoggedIn, role) {
    // Get all navbar elements
    const navLogin = document.getElementById('nav-login');
    const navLogout = document.getElementById('nav-logout');
    const navProducts = document.getElementById('nav-products');
    const navCart = document.getElementById('nav-cart');
    const navProfile = document.getElementById('nav-profile');
    const navSeller = document.getElementById('nav-seller');
    const navAdmin = document.getElementById('nav-admin');

    // Reset all to hidden first
    [navLogin, navLogout, navProducts, navCart, navProfile, navSeller, navAdmin].forEach(el => {
        if (el) el.style.display = 'none';
    });

    // Show/hide based on login state
    if (!isLoggedIn) {
        // Unauthenticated: Show login only (Home is always visible)
        if (navLogin) navLogin.style.display = 'block';
    } else {
        // All logged-in users: Show logout and profile
        if (navLogout) navLogout.style.display = 'block';
        if (navProfile) navProfile.style.display = 'block';

        // Role-based navbar
        if (role === 'customer') {
            // Customers: Show cart and products
            if (navCart) navCart.style.display = 'block';
            if (navProducts) navProducts.style.display = 'block';
        } else if (role === 'seller') {
            // Sellers: Show seller dashboard only
            if (navSeller) navSeller.style.display = 'block';
        } else if (role === 'admin') {
            // Admins: Show admin dashboard and read-only product catalog
            if (navAdmin) navAdmin.style.display = 'block';
            if (navProducts) navProducts.style.display = 'block';
        }
    }
}

// ============================================
// ✅ ROUTER - Hash-based navigation
// ============================================

function router() {
    const hash = window.location.hash.slice(1) || 'home';
    const [page, ...params] = hash.split('/');
    const isLoggedIn = !!AppState.token;
    const role = AppState.user?.role;

    // Hide all sections
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.add('hidden');
    });

    // ========== STRICT ROLE-BASED ACCESS CONTROL ==========
    
    // Pages that require login
    const requiresLogin = ['checkout', 'profile', 'seller-dash', 'admin-dash', 'order-tracking', 'orders'];
    if (requiresLogin.includes(page) && !isLoggedIn) {
        showToast('Please login first', 'warning');
        navigateTo('#login');
        return;
    }

    // CUSTOMER-ONLY pages
    if (page === 'checkout') {
        if (role !== 'customer') {
            showToast('Access denied: This page is for customers only', 'error');
            if (role === 'seller') navigateTo('#seller-dash');
            else if (role === 'admin') navigateTo('#admin-dash');
            else navigateTo('#login');
            return;
        }
    }

    if (page === 'cart' && isLoggedIn && !['customer'].includes(role)) {
        showToast('Access denied: This page is for customers only', 'error');
        if (role === 'seller') navigateTo('#seller-dash');
        else if (role === 'admin') navigateTo('#admin-dash');
        else navigateTo('#home');
            return;
    }

    if (page === 'orders') {
        if (role !== 'customer') {
            showToast('Access denied: This page is for customers only', 'error');
            if (role === 'seller') navigateTo('#seller-dash');
            else if (role === 'admin') navigateTo('#admin-dash');
            else navigateTo('#home');
            return;
        }
    }

    if (page === 'order-tracking') {
        if (!['customer', 'admin'].includes(role)) {
            showToast('Access denied: This page is for customers and admins only', 'error');
            if (role === 'seller') navigateTo('#seller-dash');
            else navigateTo('#home');
            return;
        }
    }

    // SELLER-ONLY pages
    if (page === 'seller-dash' && role !== 'seller') {
        showToast('Access denied: Seller dashboard is for sellers only', 'error');
        if (role === 'customer') navigateTo('#home');
        else if (role === 'admin') navigateTo('#admin-dash');
        else navigateTo('#login');
        return;
    }

    // ADMIN-ONLY pages
    if (page === 'admin-dash' && role !== 'admin') {
        showToast('Access denied: Admin dashboard is for admins only', 'error');
        if (role === 'seller') navigateTo('#seller-dash');
        else if (role === 'customer') navigateTo('#home');
        else navigateTo('#login');
        return;
    }

    // Seller-restricted pages
    if (page === 'products' && isLoggedIn && role === 'seller') {
        showToast('Sellers cannot browse storefront products', 'error');
        if (role === 'seller') navigateTo('#seller-dash');
        return;
    }

    // Render pages
    switch (page) {
        case 'home':
            showSection('home');
            break;
        case 'login':
            if (AppState.token) navigateTo('#home');
            else showSection('login');
            break;
        case 'signup':
            if (AppState.token) navigateTo('#home');
            else showSection('signup');
            break;
        case 'products':
            showSection('products');
            loadProducts();
            break;
        case 'product':
            // Product detail page: customers, admins, and unauthenticated users can view
            if (isLoggedIn && role === 'seller') {
                showToast('Sellers cannot browse storefront products', 'error');
                if (role === 'seller') navigateTo('#seller-dash');
                return;
            }
            showSection('product-detail');
            loadProductDetail(params[0]);
            break;
        case 'cart':
            showSection('cart');
            loadCart();
            break;
        case 'checkout':
            showSection('checkout');
            loadCheckout();
            break;
        case 'order-tracking':
            showSection('order-tracking');
            loadOrderTracking(params[0]);
            break;
        case 'orders':
            showSection('profile');
            loadProfile();
            break;
        case 'profile':
            showSection('profile');
            loadProfile();
            break;
        case 'seller-dash':
            showSection('seller-dash');
            loadSellerDashboard();
            break;
        case 'admin-dash':
            showSection('admin-dash');
            loadAdminDashboard();
            break;
        default:
            navigateTo('#home');
    }
}

function showSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
        window.scrollTo(0, 0);
    }
}

function navigateTo(path) {
    window.location.hash = path;
}

// ============================================
// ✅ PRODUCTS PAGE - Using new API layer
// ============================================

async function loadProducts() {
    const response = await API.fetchProducts();
    
    if (!response || !response.products) {
        const grid = document.getElementById('products-grid');
        if (grid) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500">Failed to load products</div>';
        }
        return;
    }

    const products = response.products;
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (products.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500">No products available</div>';
        return;
    }

    grid.innerHTML = products.map(product => {
        const imageUrl = buildImageUrl(product.primary_image);
        
        return `
        <div class="product-card" onclick="navigateTo('#product/${product.uuid}')">
            <div class="product-image-container">
                <img src="${imageUrl}" 
                     alt="${product.name}" 
                     class="product-image" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                     onload="this.classList.remove('skeleton')">
                <div class="product-image-error" style="display: none;">📦</div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${escapeHtml(product.name)}</h3>
                <p class="product-description">${escapeHtml(product.description || '')}</p>
                <p class="product-price">₹${parseFloat(product.price).toFixed(2)}</p>
                <p class="product-stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}">
                    ${product.stock > 0 ? `✓ ${product.stock} in stock` : '✕ Out of stock'}
                </p>
                <div class="product-actions">
                    <button class="bg-blue-600 text-white hover:bg-blue-700 btn-primary" onclick="event.stopPropagation(); navigateTo('#product/${product.uuid}')">View</button>
                </div>
            </div>
        </div>
    `}).join('');
}

function buildImageUrl(imageUrl) {
    // If image URL is already complete, use it
    if (!imageUrl) {
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="260"%3E%3Crect fill="%23e2e8f0" width="300" height="260"/%3E%3Ctext x="50%25" y="50%25" font-size="48" fill="%2364748b" text-anchor="middle" dominant-baseline="middle"%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E';
    }
    
    // Clean up whitespace
    imageUrl = imageUrl.trim();
    
    // If already has protocol, return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }
    
    // If it's a relative path starting with /, prepend just the domain
    if (imageUrl.startsWith('/')) {
        const baseUrl = CONFIG.API_BASE_URL.replace('/api', '');
        return `${baseUrl}${imageUrl}`;
    }
    
    // Otherwise construct it relative to the upload directory
    const baseUrl = CONFIG.API_BASE_URL.replace('/api', '');
    return `${baseUrl}/static/uploads/products/${imageUrl}`;
}

function escapeHtml(text) {
    if (!text) return '';
    if (typeof text !== 'string') return String(text);
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Category filter state
let selectedCategory = 'all';

// Category mapping for product detection
const categoryKeywords = {
    electronics: ['iphone', 'phone', 'mobile', 'laptop', 'computer', 'monitor', 'keyboard', 'mouse', 'headphone', 'charger', 'cable'],
    clothing: ['shirt', 'pant', 'dress', 'kurta', 'top', 'jacket', 'sweater', 'jeans', 'skirt', 'cloth', 'garment', 'apparel'],
    computers: ['laptop', 'desktop', 'computer', 'pc', 'processor', 'cpu', 'gpu', 'ram', 'ssd', 'hdd'],
    fashion: ['kurta', 'ethnic', 'fashion', 'style', 'designer', 'fabric', 'wear', 'collection'],
    gadgets: ['ear', 'pod', 'watch', 'band', 'cast', 'google', 'asus', 'led', 'gadget', 'wireless']
};

/**
 * Determine product category based on name
 */
function detectProductCategory(productName) {
    const nameLower = productName.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => nameLower.includes(keyword))) {
            return category;
        }
    }
    
    return 'all';
}

/**
 * Filter products by category
 */
function filterByCategory(category) {
    selectedCategory = category;
    
    // Update active button
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter products
    const searchTerm = document.getElementById('search-products')?.value.toLowerCase() || '';
    document.querySelectorAll('.product-card').forEach(card => {
        const name = card.querySelector('.product-name')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.product-description')?.textContent.toLowerCase() || '';
        const productName = card.querySelector('.product-name')?.textContent || '';
        const productCategory = detectProductCategory(productName);
        
        // Check if matches search term
        const matchesSearch = name.includes(searchTerm) || desc.includes(searchTerm);
        
        // Check if matches category
        const matchesCategory = category === 'all' || productCategory === category;
        
        card.style.display = (matchesSearch && matchesCategory) ? '' : 'none';
    });
}

function filterProducts() {
    const searchTerm = document.getElementById('search-products')?.value.toLowerCase() || '';
    document.querySelectorAll('.product-card').forEach(card => {
        const name = card.querySelector('.product-name')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.product-description')?.textContent.toLowerCase() || '';
        const productName = card.querySelector('.product-name')?.textContent || '';
        const productCategory = detectProductCategory(productName);
        
        // Check if matches search term
        const matchesSearch = name.includes(searchTerm) || desc.includes(searchTerm);
        
        // Check if matches category
        const matchesCategory = selectedCategory === 'all' || productCategory === selectedCategory;
        
        card.style.display = (matchesSearch && matchesCategory) ? '' : 'none';
    });
}

// Override old filterProducts
const oldFilterProducts = filterProducts;

async function loadProductDetail(uuid) {
    if (!uuid) {
        showToast('Invalid product', 'error');
        navigateTo('#products');
        return;
    }

    const response = await API.fetchProductDetail(uuid);
    
    if (!response) {
        showToast('Failed to load product', 'error');
        navigateTo('#products');
        return;
    }

    const product = response.product || response;
    AppState.currentProduct = product;

    document.getElementById('detail-name').textContent = product.name || 'Product';
    document.getElementById('detail-description').textContent = product.description || '';
    document.getElementById('detail-price').textContent = `₹${parseFloat(product.price || 0).toFixed(2)}`;
    document.getElementById('detail-stock').textContent = product.stock > 0 ? `${product.stock} in stock` : 'Out of stock';

    // Display specifications
    const specsDiv = document.getElementById('detail-specs');
    if (product.specifications && product.specifications.length > 0) {
        specsDiv.innerHTML = '<h4 class="font-semibold mb-2">Specifications</h4>' + 
            product.specifications.map(spec => 
                `<div class="flex justify-between text-sm mb-1">
                    <span class="text-gray-600">${escapeHtml(spec.key)}:</span>
                    <span class="font-semibold">${escapeHtml(spec.value)}</span>
                </div>`
            ).join('');
    } else {
        specsDiv.innerHTML = '';
    }

    // Display images - primary image
    const primaryImage = document.getElementById('detail-primary-image');
    const primaryImageUrl = buildImageUrl(product.primary_image);
    primaryImage.src = primaryImageUrl;
    primaryImage.onerror = function() {
        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="500" height="400"%3E%3Crect fill="%23e2e8f0" width="500" height="400"/%3E%3Ctext x="50%25" y="50%25" font-size="48" fill="%2364748b" text-anchor="middle" dominant-baseline="middle"%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E';
    };

    // Apply dynamic theme color based on product image
    applyDynamicTheme(primaryImageUrl);

    // Display all images in proper grid
    const imagesGrid = document.getElementById('detail-images-grid');
    if (product.images && product.images.length > 0) {
        imagesGrid.innerHTML = product.images.map((img, idx) => `
            <img src="${buildImageUrl(img)}" alt="Image ${idx + 1}" class="image-thumbnail cursor-pointer hover:opacity-80 transition" onclick="swapImages(this)" 
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23e2e8f0%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2224%22 fill=%22%2364748b%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E'">
        `).join('');
    }
    
    // ========== STRICT ROLE CHECK: Only customers can see Add to Cart ==========
    const addToCartBtn = getAddToCartButton();
    if (addToCartBtn) {
        const role = AppState.user?.role;
        const isCustomer = !AppState.user || role === 'customer';
        addToCartBtn.style.display = isCustomer ? 'flex' : 'none';
        addToCartBtn.disabled = product.stock <= 0;
        addToCartBtn.classList.toggle('opacity-70', product.stock <= 0);
    }
}

function swapImages(imageElement) {
    const primaryImage = document.getElementById('detail-primary-image');
    const temp = primaryImage.src;
    primaryImage.src = imageElement.src;
    imageElement.src = temp;
}

async function addToCart() {
    if (!AppState.user || AppState.user.role !== 'customer') {
        showToast('Only customers can purchase products', 'error');
        return;
    }
    
    if (!AppState.currentProduct) {
        showToast('Product not found', 'error');
        return;
    }

    const quantity = parseInt(document.getElementById('detail-quantity')?.value || 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
        showToast('Please choose a valid quantity', 'warning');
        return;
    }

    ui.setAddToCartLoading(true);
    try {
        const response = await API.addToCart(AppState.currentProduct.uuid, quantity);

        if (response) {
            showToast('Added to cart!', 'success');
            if (window.location.hash === '#cart') {
                ui.renderCart();
            }
        }
    } finally {
        ui.setAddToCartLoading(false);
    }
}

function updateCartBadge() {
    ui.updateCartBadge();
}

// ============================================
// Cart Management
// ============================================

function loadCart() {
    const cartItemsDiv = document.getElementById('cart-items');
    
    if (AppState.cart.length === 0) {
        cartItemsDiv.innerHTML = `
            <div class="p-8 text-center text-gray-500">
                <p>Your cart is empty</p>
                <button onclick="navigateTo('#products')" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">Continue Shopping</button>
            </div>
        `;
        updateCartSummary();
        return;
    }

    cartItemsDiv.innerHTML = AppState.cart.map((item, idx) => {
        const price = parseFloat(item.product_price) || 0;
        const total = price * (item.quantity || 1);
        return `
        <div class="p-4 border-b border-gray-200 flex gap-4 last:border-b-0 hover:bg-gray-50 transition">
            <div class="flex-shrink-0">
                <img src="${buildImageUrl(item.product_image)}" alt="${item.product_name}" class="w-24 h-24 object-cover rounded-lg shadow-sm" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                <div class="w-24 h-24 bg-gray-200 rounded-lg shadow-sm flex items-center justify-center text-3xl" style="display: none;">📦</div>
            </div>
            <div class="flex-1">
                <h3 class="font-semibold text-lg text-gray-900">${escapeHtml(item.product_name)}</h3>
                <p class="text-gray-600 text-sm mb-3">₹${price.toFixed(2)} each</p>
                <div class="flex items-center gap-2">
                    <button onclick="updateCartQuantity(${idx}, -1)" class="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded-md transition font-semibold">−</button>
                    <span class="px-4 py-1 bg-gray-100 rounded-md font-semibold text-gray-700 min-w-12 text-center">${item.quantity}</span>
                    <button onclick="updateCartQuantity(${idx}, 1)" class="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded-md transition font-semibold">+</button>
                    <button onclick="removeFromCart(${idx})" class="ml-auto px-4 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition text-sm font-semibold">Remove</button>
                </div>
            </div>
            <div class="text-right flex flex-col justify-between">
                <p class="font-bold text-lg text-gray-900">₹${total.toFixed(2)}</p>
                <p class="text-xs text-gray-500">x ${item.quantity}</p>
            </div>
        </div>
    `}).join('');

    updateCartSummary();
}

function updateCartQuantity(index, delta) {
    AppState.cart[index].quantity += delta;
    if (AppState.cart[index].quantity < 1) {
        AppState.cart.splice(index, 1);
    }
    AppState.persist();
    AppState.updateCartBadge();
    loadCart();
}

function removeFromCart(index) {
    // ========== STRICT ROLE CHECK: Only customers can manage cart ==========
    if (!AppState.user || AppState.user.role !== 'customer') {
        showToast('Only customers can manage cart', 'error');
        return;
    }

    AppState.cart.splice(index, 1);
    AppState.persist();
    AppState.updateCartBadge();
    loadCart();
}

function updateCartSummary() {
    const subtotal = AppState.cart.reduce((total, item) => {
        const price = parseFloat(item.product_price) || 0;
        return total + (price * (item.quantity || 1));
    }, 0);
    const shipping = subtotal > 500 ? 0 : 50;
    const total = subtotal + shipping;

    document.getElementById('cart-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('cart-shipping').textContent = shipping === 0 ? 'FREE' : `₹${shipping.toFixed(2)}`;
    document.getElementById('cart-total').textContent = `₹${total.toFixed(2)}`;
}

function proceedToCheckout() {
    // ========== STRICT ROLE CHECK: Only customers can checkout ==========
    if (!AppState.user || AppState.user.role !== 'customer') {
        showToast('Only customers can access checkout', 'error');
        return;
    }

    if (AppState.cart.length === 0) {
        showToast('Your cart is empty', 'warning');
        return;
    }
    navigateTo('#checkout');
}

// ============================================
// Checkout & Orders
// ============================================

async function loadCheckout() {
    // Load saved addresses
    const response = await API.fetchProfile();
    if (response && response.user) {
        AppState.selectedAddresses = response.user.addresses || [];
    }

    // Render section based on addresses available
    const addressesDiv = document.getElementById('saved-addresses');
    const addNewAddressDiv = document.getElementById('add-new-address-section');
    
    if (AppState.selectedAddresses.length > 0) {
        // Show saved addresses
        addressesDiv.innerHTML = `
            <h4 class="font-semibold text-gray-900 mb-4 text-lg">📍 Select Shipping Address</h4>
            <div class="space-y-3">
                ${AppState.selectedAddresses.map(addr => `
                    <label class="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition" onclick="selectAddress('${addr.uuid}')">
                        <input type="radio" name="address" value="${addr.uuid}" class="mt-1 cursor-pointer">
                        <div class="flex-1 ml-3">
                            <div class="font-semibold text-gray-900">${escapeHtml(addr.full_name)}</div>
                            <div class="text-sm text-gray-600 mt-1">${escapeHtml(addr.street)}</div>
                            <div class="text-sm text-gray-600">${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} - ${escapeHtml(addr.pincode)}</div>
                            <div class="text-sm text-gray-600 mt-1">📞 ${escapeHtml(addr.phone_number)}</div>
                        </div>
                    </label>
                `).join('')}
            </div>
        `;
        
        // Hide add new address form
        if (addNewAddressDiv) {
            addNewAddressDiv.style.display = 'none';
        }
    } else {
        // Hide saved addresses section, show add new form
        addressesDiv.innerHTML = '';
        if (addNewAddressDiv) {
            addNewAddressDiv.style.display = 'block';
        }
    }

    updateCheckoutSummary();
}

function selectAddress(addressUuid) {
    AppState.selectedAddress = addressUuid;
}

async function handleAddAddress(event) {
    event.preventDefault();

    const addressData = {
        full_name: document.getElementById('addr-name')?.value || '',
        phone_number: document.getElementById('addr-phone')?.value || '',
        street: document.getElementById('addr-street')?.value || '',
        city: document.getElementById('addr-city')?.value || '',
        state: document.getElementById('addr-state')?.value || '',
        pincode: document.getElementById('addr-pincode')?.value || ''
    };

    // Validate
    if (!addressData.full_name || !addressData.phone_number || !addressData.street || !addressData.city || !addressData.state || !addressData.pincode) {
        showToast('Please fill in all address fields', 'warning');
        return;
    }

    const response = await API.saveAddress(addressData);

    if (response && response.address_uuid) {
        showToast('Address saved successfully!', 'success');
        AppState.selectedAddress = response.address_uuid;
        document.getElementById('payment-section').classList.remove('hidden');
        // Clear form
        event.target.reset();
    }
}

function updateCheckoutSummary() {
    const subtotal = AppState.cart.reduce((total, item) => total + (item.product_price * item.quantity), 0);
    const shipping = subtotal > 500 ? 0 : 50;
    const total = subtotal + shipping;

    document.getElementById('checkout-summary').innerHTML = `
        ${AppState.cart.map(item => `
            <div class="flex justify-between text-sm border-b pb-2 mb-2">
                <span class="text-gray-700">${escapeHtml(item.product_name)} <span class="text-gray-500">x ${item.quantity}</span></span>
                <span class="font-semibold">₹${(item.product_price * item.quantity).toFixed(2)}</span>
            </div>
        `).join('')}
        <div class="space-y-1 mt-3 pt-3 border-t">
            <div class="flex justify-between text-sm">
                <span class="text-gray-600">Subtotal</span>
                <span class="font-semibold">₹${subtotal.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-sm">
                <span class="text-gray-600">Shipping</span>
                <span class="font-semibold">${shipping === 0 ? 'FREE' : '₹' + shipping.toFixed(2)}</span>
            </div>
        </div>
    `;
    document.getElementById('checkout-total').textContent = `₹${total.toFixed(2)}`;
}

async function handlePayment(event) {
    event.preventDefault();

    // CRITICAL FIX: Role check
    if (!AppState.user || AppState.user.role !== 'customer') {
        showToast('Only customers can complete payment', 'error');
        return;
    }

    // CRITICAL FIX: Proper address selection validation
    if (!AppState.selectedAddress) {
        showToast('Please select or add an address first', 'warning');
        return;
    }

    // Create order
    const checkoutResponse = await API.checkout(AppState.selectedAddress);

    if (!checkoutResponse) return;

    const orderUuid = checkoutResponse.order_uuid;
    AppState.currentOrder = orderUuid;

    // Process payment
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value;
    if (!paymentMethod) {
        showToast('Please select a payment method', 'warning');
        return;
    }

    const paymentResponse = await API.processPayment(orderUuid, paymentMethod);

    if (paymentResponse) {
        showPaymentSuccessNotification(orderUuid);
        AppState.cart = [];
        AppState.selectedAddress = null;
        AppState.persist();
        AppState.updateCartBadge();
        setTimeout(() => {
            navigateTo(`#order-tracking/${orderUuid}`);
        }, 2000);
    }
}

async function loadCart() {
    if (isCustomerSession()) {
        await syncCustomerCart();
    }
    ui.renderCart();
}

async function updateCartQuantity(cartItemIdentifier, delta) {
    const cartItem = AppState.cart.find((item) => getCartItemIdentifier(item) === cartItemIdentifier);
    if (!cartItem) {
        showToast('Cart item not found', 'error');
        return;
    }

    const nextQuantity = cartItem.quantity + delta;
    if (nextQuantity < 1) {
        await removeFromCart(cartItemIdentifier);
        return;
    }

    if (!isCustomerSession() || !cartItem.cartItemUuid) {
        setLocalCartQuantity(cartItemIdentifier, nextQuantity);
        showToast('Cart updated!', 'success');
        return;
    }

    AppState.pendingCartItems.add(cartItem.cartItemUuid);
    ui.renderCart();

    try {
        const response = await API.updateCartItem(cartItem.cartItemUuid, nextQuantity);
        if (response) {
            await syncCustomerCart({ mergeLocal: false });
            showToast('Cart updated!', 'success');
        }
    } finally {
        AppState.pendingCartItems.delete(cartItem.cartItemUuid);
        ui.renderCart();
    }
}

async function removeFromCart(cartItemIdentifier) {
    const cartItem = AppState.cart.find((item) => getCartItemIdentifier(item) === cartItemIdentifier);
    if (!cartItem) {
        showToast('Cart item not found', 'error');
        return;
    }

    if (!isCustomerSession() || !cartItem.cartItemUuid) {
        setLocalCartQuantity(cartItemIdentifier, 0);
        showToast('Item removed from cart', 'success');
        return;
    }

    AppState.pendingCartItems.add(cartItem.cartItemUuid);
    ui.renderCart();

    try {
        const response = await API.removeCartItem(cartItem.cartItemUuid);
        if (response) {
            await syncCustomerCart({ mergeLocal: false });
            showToast('Item removed from cart', 'success');
        }
    } finally {
        AppState.pendingCartItems.delete(cartItem.cartItemUuid);
        ui.renderCart();
    }
}

function updateCartSummary() {
    ui.renderCartSummary();
}

async function proceedToCheckout() {
    if (!isCustomerSession()) {
        showToast('Sign in as a customer to continue to checkout.', 'warning');
        navigateTo('#login');
        return;
    }

    await syncCustomerCart();

    if (AppState.cart.length === 0) {
        showToast('Your cart is empty', 'warning');
        return;
    }

    navigateTo('#checkout');
}

async function loadCheckout() {
    if (!isCustomerSession()) {
        showToast('Only customers can access checkout', 'error');
        navigateTo('#login');
        return;
    }

    await syncCustomerCart();
    if (AppState.cart.length === 0) {
        showToast('Your cart is empty', 'warning');
        navigateTo('#cart');
        return;
    }

    const response = await API.fetchProfile();
    if (response?.user) {
        AppState.selectedAddresses = response.user.addresses || [];
    }

    const addressesDiv = document.getElementById('saved-addresses');
    const addNewAddressDiv = document.getElementById('add-new-address-section');
    const paymentSection = document.getElementById('payment-section');

    if (!addressesDiv) {
        ui.renderCheckoutSummary();
        return;
    }

    if (AppState.selectedAddresses.length > 0) {
        addressesDiv.innerHTML = `
            <h4 class="font-semibold text-gray-900 mb-4 text-lg">Select Shipping Address</h4>
            <div class="space-y-3">
                ${AppState.selectedAddresses.map((addr) => `
                    <label class="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition" onclick="selectAddress('${addr.uuid}')">
                        <input type="radio" name="address" value="${addr.uuid}" class="mt-1 cursor-pointer" ${AppState.selectedAddress === addr.uuid ? 'checked' : ''}>
                        <div class="flex-1 ml-3">
                            <div class="font-semibold text-gray-900">${escapeHtml(addr.full_name)}</div>
                            <div class="text-sm text-gray-600 mt-1">${escapeHtml(addr.street)}</div>
                            <div class="text-sm text-gray-600">${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} - ${escapeHtml(addr.pincode)}</div>
                            <div class="text-sm text-gray-600 mt-1">Phone: ${escapeHtml(addr.phone_number)}</div>
                        </div>
                    </label>
                `).join('')}
            </div>
        `;

        if (addNewAddressDiv) {
            addNewAddressDiv.style.display = 'none';
        }
    } else {
        AppState.selectedAddress = null;
        addressesDiv.innerHTML = '';
        if (addNewAddressDiv) {
            addNewAddressDiv.style.display = 'block';
        }
    }

    if (paymentSection) {
        paymentSection.classList.toggle('hidden', !AppState.selectedAddress);
    }

    ui.renderCheckoutSummary();
}

function selectAddress(addressUuid) {
    AppState.selectedAddress = addressUuid;
    const paymentSection = document.getElementById('payment-section');
    if (paymentSection) {
        paymentSection.classList.remove('hidden');
    }
}

async function handleAddAddress(event) {
    event.preventDefault();

    const addressData = {
        full_name: document.getElementById('addr-name')?.value || '',
        phone_number: document.getElementById('addr-phone')?.value || '',
        street: document.getElementById('addr-street')?.value || '',
        city: document.getElementById('addr-city')?.value || '',
        state: document.getElementById('addr-state')?.value || '',
        pincode: document.getElementById('addr-pincode')?.value || ''
    };

    if (!addressData.full_name || !addressData.phone_number || !addressData.street || !addressData.city || !addressData.state || !addressData.pincode) {
        showToast('Please fill in all address fields', 'warning');
        return;
    }

    const response = await API.saveAddress(addressData);
    if (response?.address_uuid) {
        AppState.selectedAddress = response.address_uuid;
        showToast('Address saved successfully!', 'success');
        event.target.reset();
        await loadCheckout();
    }
}

function updateCheckoutSummary() {
    ui.renderCheckoutSummary();
}

async function handlePayment(event) {
    event.preventDefault();

    if (!isCustomerSession()) {
        showToast('Only customers can complete payment', 'error');
        return;
    }

    if (!AppState.selectedAddress) {
        showToast('Please select or add an address first', 'warning');
        return;
    }

    const checkoutResponse = await API.checkout(AppState.selectedAddress);
    if (!checkoutResponse) return;

    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value;
    if (!paymentMethod) {
        showToast('Please select a payment method', 'warning');
        return;
    }

    const orderUuid = checkoutResponse.order_uuid;
    AppState.currentOrder = orderUuid;

    const paymentResponse = await API.processPayment(orderUuid, paymentMethod);
    if (paymentResponse) {
        await syncCustomerCart();
        AppState.selectedAddress = null;
        showPaymentSuccessNotification(orderUuid);
        ui.renderCheckoutSummary();
        setTimeout(() => {
            navigateTo(`#order-tracking/${orderUuid}`);
        }, 2000);
    }
}

async function loadOrderTracking(orderUuid) {
    if (!orderUuid) {
        showToast('Invalid order', 'error');
        navigateTo('#profile');
        return;
    }

    const response = await API.trackOrder(orderUuid);

    if (!response) {
        showToast('Failed to load order tracking', 'error');
        navigateTo('#profile');
        return;
    }

    document.getElementById('tracking-order-id').textContent = `Order #${orderUuid.slice(0, 8)}`;

    const timelineDiv = document.getElementById('tracking-timeline');
    const timeline = response.tracking_history || response.timeline || response.tracking || [];

    if (timeline.length === 0) {
        timelineDiv.innerHTML = '<div class="text-center text-gray-500">No tracking information available</div>';
        return;
    }

    timelineDiv.innerHTML = timeline.map((event, idx) => {
        return `
            <div class="timeline-item">
                <div class="timeline-marker">
                    <div class="timeline-icon ${event.status === 'completed' ? 'completed' : 'pending'}">
                        ${event.status === 'completed' ? '✓' : '●'}
                    </div>
                </div>
                <div class="timeline-content">
                    <h3 class="timeline-title">${escapeHtml(event.status || event.title || '')}</h3>
                    <p class="timeline-description">${escapeHtml(event.message || event.description || '')}</p>
                    <p class="timeline-time">${event.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A'}</p>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// User Profile
// ============================================

async function loadProfile() {
    loadProfileWithFallback();
}

// ============================================
// Seller Dashboard
// ============================================

async function loadSellerDashboard() {
    // Load seller categories
    const categoriesResponse = await API.call('/seller/my-categories');
    if (categoriesResponse) {
        const categories = categoriesResponse.categories || [];
        const approved = categories.filter(c => c.status === 'approved');
        const pending = categories.filter(c => c.status === 'pending');
        const available = categories.filter(c => c.status === 'available');

        document.getElementById('seller-categories-count').textContent = categories.length;
        document.getElementById('seller-pending-count').textContent = pending.length;
        document.getElementById('seller-approved-count').textContent = approved.length;

        // Populate category dropdown with ONLY APPROVED categories for product creation
        const select = document.getElementById('product-category');
        select.innerHTML = '<option value="">Select Category</option>' +
            approved.map(cat => `<option value="${cat.uuid}">${escapeHtml(cat.name)}</option>`).join('');

        // Display category request section
        displayCategoryRequestSection(available, pending);
    }

    // Load seller products
    const productsResponse = await API.call('/seller/products');
    if (productsResponse) {
        const products = productsResponse.products || [];
        document.getElementById('seller-products-count').textContent = products.length;

        const productsDiv = document.getElementById('seller-products');
        productsDiv.innerHTML = products.map(product => `
            <div class="bg-white rounded-lg shadow p-4">
                <div style="width: 100%; height: 180px; overflow: hidden; border-radius: 8px; margin-bottom: 12px; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);">
                    <img src="${buildImageUrl(product.primary_image)}" alt="${product.name}" class="w-full h-full object-cover" onerror="this.style.display='none'">
                </div>
                <h3 class="font-semibold text-lg">${escapeHtml(product.name)}</h3>
                <p class="text-gray-600 text-sm mb-2">${escapeHtml(product.description)}</p>
                <p class="text-blue-600 font-bold text-lg">₹${parseFloat(product.price).toFixed(2)}</p>
                <p class="text-sm text-gray-600">Stock: ${product.stock}</p>
            </div>
        `).join('');
    }
}

function displayCategoryRequestSection(available, pending) {
    // Find or create the category request section
    let categorySection = document.getElementById('seller-category-requests');
    if (!categorySection) {
        const form = document.getElementById('seller-product-form');
        if (form) {
            categorySection = document.createElement('div');
            categorySection.id = 'seller-category-requests';
            form.parentElement.insertBefore(categorySection, form);
        }
    }

    if (categorySection) {
        let html = '<div class="bg-blue-50 rounded-lg p-6 mb-8 border-l-4 border-blue-500">';
        html += '<h3 class="text-lg font-bold text-gray-900 mb-4">📋 Category Management</h3>';

        if (pending.length > 0) {
            html += '<div class="mb-4"><h4 class="font-semibold text-orange-600 mb-2">⏳ Pending Approval:</h4>';
            html += '<div class="flex flex-wrap gap-2">';
            pending.forEach(cat => {
                html += `<span class="px-3 py-1 bg-orange-200 text-orange-800 rounded-full text-sm">${escapeHtml(cat.name)}</span>`;
            });
            html += '</div></div>';
        }

        if (available.length > 0) {
            html += '<div><h4 class="font-semibold text-green-600 mb-2">✨ Available Categories:</h4>';
            html += '<div class="space-y-2">';
            available.forEach(cat => {
                html += `
                    <div class="flex justify-between items-center bg-white p-3 rounded border border-gray-200">
                        <span class="font-medium">${escapeHtml(cat.name)}</span>
                        <button type="button" onclick="requestCategoryApproval('${cat.uuid}', '${cat.name}')" class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">Request Approval</button>
                    </div>
                `;
            });
            html += '</div></div>';
        } else {
            html += '<p class="text-gray-700">No new categories available. Wait for admin to create more categories.</p>';
        }

        html += '</div>';
        categorySection.innerHTML = html;
    }
}

async function requestCategoryApproval(categoryUuid, categoryName) {
    const response = await API.call('/seller/category-request', 'POST', {
        category_uuid: categoryUuid
    });
    
    if (response) {
        showToast(`Request submitted for "${categoryName}"!`, 'success');
        loadSellerDashboard();
    }
}

async function handleAddProduct(event) {
    event.preventDefault();

    const formData = new FormData();
    formData.append('name', document.getElementById('product-name').value);
    formData.append('description', document.getElementById('product-description').value);
    formData.append('price', document.getElementById('product-price').value);
    formData.append('stock', document.getElementById('product-stock').value);
    formData.append('category_uuid', document.getElementById('product-category').value);

    // Handle images
    const imageFiles = document.getElementById('product-images').files;
    for (let i = 0; i < imageFiles.length; i++) {
        formData.append('images', imageFiles[i]);
    }

    // Handle specifications
    const specs = [];
    document.querySelectorAll('.spec-row').forEach(row => {
        const key = row.querySelector('.spec-key').value;
        const value = row.querySelector('.spec-value').value;
        if (key && value) {
            specs.push({ key, value });
        }
    });
    formData.append('specifications', JSON.stringify(specs));

    const response = await API.call('/seller/product', 'POST', formData);

    if (response) {
        showToast('Product added successfully!', 'success');
        document.getElementById('seller-product-form').reset();
        document.querySelectorAll('.spec-row:not(:first-child)').forEach(el => el.remove());
        loadSellerDashboard();
    }
}

function addSpec() {
    const container = document.getElementById('specs-container');
    const newRow = document.createElement('div');
    newRow.className = 'spec-row flex gap-2 mb-2';
    newRow.innerHTML = `
        <input type="text" placeholder="Key (e.g., RAM)" class="flex-1 spec-key px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        <input type="text" placeholder="Value (e.g., 16GB)" class="flex-1 spec-value px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        <button type="button" onclick="removeSpec(this)" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">Remove</button>
    `;
    container.appendChild(newRow);
}

function removeSpec(button) {
    button.parentElement.remove();
}

// ============================================
// Admin Dashboard
// ============================================

async function loadAdminDashboard() {
    // Load category requests
    const requestsResponse = await API.call('/admin/category-requests');
    if (requestsResponse) {
        const requests = requestsResponse.requests || [];
        document.getElementById('admin-pending-requests').textContent = requests.length;
        displayCategoryRequests(requests);
    }

    // Load sellers
    const sellersResponse = await API.call('/admin/sellers');
    if (sellersResponse) {
        const sellers = sellersResponse.sellers || [];
        document.getElementById('admin-sellers-count').textContent = sellers.length;
        document.getElementById('admin-active-sellers').textContent = sellers.filter(s => s.is_active).length;
        displaySellers(sellers);
    }
    
    // Load orders
    const ordersResponse = await API.call('/admin/orders');
    if (ordersResponse) {
        const orders = ordersResponse.orders || [];
        displayAdminOrders(orders);
    }
}

function displayCategoryRequests(requests) {
    const requestsList = document.getElementById('admin-requests-list');
    
    if (requests.length === 0) {
        requestsList.innerHTML = '<p class="text-gray-500">No pending requests</p>';
        return;
    }

    requestsList.innerHTML = requests.map(req => `
        <div class="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
            <div>
                <h3 class="font-semibold">${req.seller_name || 'Seller'}</h3>
                <p class="text-sm text-gray-600">Category: ${req.category_name || 'Unknown'}</p>
                <p class="text-sm text-gray-500">Requested: ${req.requested_at}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="approveCategoryRequest('${req.request_uuid}')" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition font-semibold">✓ Approve</button>
                <button onclick="declineCategoryRequest('${req.request_uuid}')" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition font-semibold">✕ Decline</button>
            </div>
        </div>
    `).join('');
}

async function approveCategoryRequest(requestUuid) {
    const response = await API.call(`/admin/category-request/${requestUuid}/approve`, 'PUT', {});
    if (response) {
        showToast('Request approved!', 'success');
        loadAdminDashboard();
    }
}

async function declineCategoryRequest(requestUuid) {
    if (confirm('Are you sure you want to decline this request?')) {
        const response = await API.call(`/admin/category-request/${requestUuid}/decline`, 'PUT', {});
        if (response) {
            showToast('Request declined!', 'warning');
            loadAdminDashboard();
        }
    }
}

async function handleCreateCategory(event) {
    event.preventDefault();
    
    const name = document.getElementById('category-name').value;
    const description = document.getElementById('category-description').value;
    
    if (!name.trim()) {
        showToast('Category name is required', 'error');
        return;
    }
    
    const response = await API.call('/admin/category', 'POST', {
        name: name.trim(),
        description: description.trim()
    });
    
    if (response) {
        showToast('Category created successfully!', 'success');
        document.getElementById('category-name').value = '';
        document.getElementById('category-description').value = '';
        loadAdminDashboard();
    }
}

function displaySellers(sellers) {
    const sellersList = document.getElementById('admin-sellers-list');

    if (sellers.length === 0) {
        sellersList.innerHTML = '<p class="text-gray-500">No sellers</p>';
        return;
    }

    sellersList.innerHTML = sellers.map(seller => `
        <div class="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
            <div>
                <h3 class="font-semibold">${seller.username}</h3>
                <p class="text-sm text-gray-600">${seller.email}</p>
                <span class="badge ${seller.is_active ? 'badge-success' : 'badge-warning'}">
                    ${seller.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>
            <button onclick="toggleSellerStatus('${seller.uuid}')" class="px-4 py-2 ${seller.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white rounded">
                ${seller.is_active ? 'Deactivate' : 'Activate'}
            </button>
        </div>
    `).join('');
}

async function toggleSellerStatus(sellerUuid) {
    const response = await API.call(`/admin/seller/${sellerUuid}/status`, 'PUT', {});
    if (response) {
        showToast('Seller status updated!', 'success');
        loadAdminDashboard();
    }
}

function displayAdminOrders(orders) {
    const ordersList = document.getElementById('admin-orders-list');
    
    if (!ordersList) return;
    
    document.getElementById('admin-orders-count').textContent = orders.length;
    
    if (orders.length === 0) {
        ordersList.innerHTML = '<p class="text-gray-500">No orders yet</p>';
        return;
    }

    ordersList.innerHTML = orders.map(order => `
        <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <p class="font-semibold text-gray-900">Order #${order.order_uuid.slice(0, 8)}</p>
                    <p class="text-sm text-gray-600">Customer: ${order.customer_username}</p>
                    <p class="text-sm text-gray-600">${order.created_at}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-sm font-semibold ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                }">
                    ${order.status.toUpperCase()}
                </span>
            </div>
            <div class="text-sm text-gray-600 mb-3">
                <p>${order.item_count} item(s) - Total: ₹${order.total_amount}</p>
                <p class="text-xs text-gray-500 mt-1">${order.items.map(item => `${item.product_name} (x${item.quantity})`).join(', ')}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="navigateTo('#order-tracking/${order.order_uuid}')" class="text-blue-500 hover:text-blue-700 text-sm font-semibold">View Tracking</button>
                <select onchange="updateOrderStatus('${order.order_uuid}', this.value)" class="text-sm px-2 py-1 border rounded">
                    <option value="">Change Status...</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                </select>
            </div>
        </div>
    `).join('');
}

async function updateOrderStatus(orderUuid, newStatus) {
    if (!newStatus) return;
    
    const response = await API.call(`/admin/order/${orderUuid}/status`, 'PUT', {
        status: newStatus,
        message: `Order status updated to ${newStatus.toUpperCase()}`
    });
    
    if (response) {
        showToast('Order status updated!', 'success');
        loadAdminDashboard();
    }
}

function switchAdminTab(tab) {
    // Hide all tabs
    document.getElementById('admin-category-tab-content').classList.add('hidden');
    document.getElementById('admin-requests-tab-content').classList.add('hidden');
    document.getElementById('admin-sellers-tab-content').classList.add('hidden');
    document.getElementById('admin-orders-tab-content').classList.add('hidden');

    // Reset button styles
    document.getElementById('admin-category-tab').className = 'px-6 py-2 bg-gray-300 text-gray-900 rounded-lg font-semibold';
    document.getElementById('admin-requests-tab').className = 'px-6 py-2 bg-gray-300 text-gray-900 rounded-lg font-semibold';
    document.getElementById('admin-sellers-tab').className = 'px-6 py-2 bg-gray-300 text-gray-900 rounded-lg font-semibold';
    document.getElementById('admin-orders-tab').className = 'px-6 py-2 bg-gray-300 text-gray-900 rounded-lg font-semibold';

    // Show selected tab
    switch (tab) {
        case 'category':
            document.getElementById('admin-category-tab-content').classList.remove('hidden');
            document.getElementById('admin-category-tab').className = 'px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold';
            break;
        case 'requests':
            document.getElementById('admin-requests-tab-content').classList.remove('hidden');
            document.getElementById('admin-requests-tab').className = 'px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold';
            break;
        case 'sellers':
            document.getElementById('admin-sellers-tab-content').classList.remove('hidden');
            document.getElementById('admin-sellers-tab').className = 'px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold';
            break;
        case 'orders':
            document.getElementById('admin-orders-tab-content').classList.remove('hidden');
            document.getElementById('admin-orders-tab').className = 'px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold';
            break;
    }
}

// ============================================
// Utility Functions
// ============================================

function switchAuthTab(tab) {
    if (tab === 'login') {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('login-tab').className = 'flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg font-semibold';
        document.getElementById('signup-tab').className = 'flex-1 py-2 px-4 bg-gray-200 text-gray-900 rounded-lg font-semibold';
    } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
        document.getElementById('login-tab').className = 'flex-1 py-2 px-4 bg-gray-200 text-gray-900 rounded-lg font-semibold';
        document.getElementById('signup-tab').className = 'flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg font-semibold';
    }
}

function toggleMobileMenu() {
    const navMenu = document.querySelector('nav');
    navMenu.classList.toggle('mobile-open');
}

// ============================================
// IMAGE SLIDER - Product Detail Page
// ============================================

let currentSlideIndex = 0;
let totalSlides = 0;

function initializeImageSlider(images) {
    totalSlides = images.length;
    if (totalSlides === 0) return;
    
    showSlide(0);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') previousSlide();
        if (e.key === 'ArrowRight') nextSlide();
    });
}

function showSlide(index) {
    if (totalSlides === 0) return;
    
    currentSlideIndex = (index + totalSlides) % totalSlides;
    const slider = document.getElementById('product-slider');
    const dots = document.querySelectorAll('.slider-dot');
    
    if (slider) {
        slider.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
    }
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlideIndex);
    });
}

function nextSlide() {
    showSlide(currentSlideIndex + 1);
}

function previousSlide() {
    showSlide(currentSlideIndex - 1);
}

function goToSlide(index) {
    showSlide(index);
}

// ============================================
// DOMINANT COLOR EXTRACTION - Dynamic Theme
// ============================================

async function extractDominantColor(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 1, 1);
            
            const imageData = ctx.getImageData(0, 0, 1, 1);
            const data = imageData.data;
            
            const rgb = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
            const hex = '#' + [data[0], data[1], data[2]].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
            
            resolve(hex);
        };
        img.onerror = () => resolve('#2563eb');
        img.src = imageUrl;
    });
}

async function applyDynamicTheme(imageUrl) {
    try {
        const dominantColor = await extractDominantColor(imageUrl);
        document.documentElement.style.setProperty('--theme-color', dominantColor);
    } catch (e) {
        console.log('Color extraction failed, using default theme');
    }
}

// ============================================
// ORDER NOTIFICATION POPUP
// ============================================

function showOrderNotification(order) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div style="font-size: 48px; margin-bottom: 16px;">
                ${order.status === 'pending' ? '⏳' :
                  order.status === 'processing' ? '📦' :
                  order.status === 'shipped' ? '🚚' :
                  order.status === 'delivered' ? '✅' : '❓'}
            </div>
            <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 12px;">Order ${order.status.toUpperCase()}!</h2>
            <p style="color: #666; margin-bottom: 8px;">Order #${order.order_uuid.slice(0, 8)}</p>
            <p style="color: #666; margin-bottom: 16px; font-size: 14px;">₹${order.total_amount}</p>
            <p style="color: #999; margin-bottom: 24px; font-size: 13px;">${order.item_count} items • ${new Date(order.created_at).toLocaleDateString()}</p>
            <button onclick="this.parentElement.parentElement.remove()" class="btn btn-primary" style="width: 100%;">View Details</button>
        </div>
    `;
    
    modal.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        modal.remove();
    }, 5000);
}

// ============================================
// IMPROVED PROFILE LOADING WITH ERROR HANDLING
// ============================================

async function loadProfileWithFallback() {
    try {
        const role = AppState.user?.role;

        // Load profile info - this endpoint is generic
        const response = await API.fetchProfile();

        if (response && response.user) {
            const user = response.user;
            const usernameEl = document.getElementById('profile-username');
            const emailEl = document.getElementById('profile-email');
            const roleEl = document.getElementById('profile-role');
            
            if (usernameEl) usernameEl.textContent = user.username || user.email;
            if (emailEl) emailEl.textContent = user.email;
            if (roleEl) roleEl.textContent = user.role || 'Unknown';
        }

        // ========== CRITICAL FIX: ROLE-BASED API CALLS ==========
        // Only load customer-specific data if user is a customer
        if (role === 'customer') {
            // Load orders
            const ordersDiv = document.getElementById('profile-orders');
            if (ordersDiv) {
                const ordersResponse = await API.fetchOrders();
                
                if (ordersResponse && ordersResponse.orders && ordersResponse.orders.length > 0) {
                    ordersDiv.innerHTML = ordersResponse.orders.map(order => `
                        <div class="bg-white p-4 rounded-lg border-l-4 border-blue-500 shadow-sm hover:shadow-md transition">
                            <div class="flex justify-between items-start mb-2">
                                <div class="flex-1">
                                    <p class="font-semibold text-gray-900">Order #${order.order_uuid.slice(0, 8)}</p>
                                    <p class="text-xs text-gray-500">${order.created_at}</p>
                                </div>
                                <span class="px-3 py-1 rounded-full text-xs font-semibold ${
                                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                    order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                                }">
                                    ${order.status.toUpperCase()}
                                </span>
                            </div>
                            <p class="text-sm text-gray-700 mb-3">₹${order.total_amount} • ${order.item_count} item(s)</p>
                            <button onclick="navigateTo('#order-tracking/${order.order_uuid}')" class="text-blue-600 hover:text-blue-800 text-sm font-semibold transition">
                                Track Order →
                            </button>
                        </div>
                    `).join('');
                } else {
                    ordersDiv.innerHTML = '<p class="text-gray-500 text-center py-8">📦 No orders yet. Start shopping!</p>';
                }
            }

            // Load addresses
            const addressesDiv = document.getElementById('profile-addresses');
            if (response && response.user && response.user.addresses && addressesDiv) {
                if (response.user.addresses.length > 0) {
                    addressesDiv.innerHTML = response.user.addresses.map(addr => `
                        <div class="bg-blue-50 p-3 rounded-lg text-sm border border-blue-200">
                            <p class="font-semibold text-gray-900">${escapeHtml(addr.full_name)}</p>
                            <p class="text-gray-600 text-xs">${escapeHtml(addr.street)}</p>
                            <p class="text-gray-600 text-xs">${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} - ${escapeHtml(addr.pincode)}</p>
                            <p class="text-gray-700 text-xs mt-1">📞 ${escapeHtml(addr.phone_number)}</p>
                        </div>
                    `).join('');
                } else {
                    addressesDiv.innerHTML = '<p class="text-gray-500 text-sm text-center">No addresses saved yet</p>';
                }
            }
        } else if (role === 'seller' || role === 'admin') {
            // For non-customers, hide the customer-specific sections
            const ordersDiv = document.getElementById('profile-orders');
            const addressesDiv = document.getElementById('profile-addresses');
            
            if (ordersDiv) ordersDiv.style.display = 'none';
            if (addressesDiv) addressesDiv.style.display = 'none';
        }
    } catch (error) {
        console.error('Profile loading error:', error);
        showToast('Unable to load profile. Please refresh.', 'error');
    }
}

async function loadProfile() {
    await loadProfileWithFallback();
}

async function loadProfileWithFallback() {
    try {
        const response = await API.fetchProfile();
        const user = response?.user;

        if (!user) {
            return;
        }

        const role = user.role || AppState.user?.role;
        const ordersDiv = document.getElementById('profile-orders');
        const addressesDiv = document.getElementById('profile-addresses');

        if (ordersDiv) {
            ordersDiv.style.display = '';
        }

        if (addressesDiv) {
            addressesDiv.style.display = '';
        }

        ui.renderProfileInfo(user);

        if (role === 'customer') {
            ui.renderAddresses(user.addresses || []);

            const ordersResponse = await API.fetchOrders();
            console.log('[ORDERS] /api/user/orders response:', ordersResponse);
            const orders = Array.isArray(ordersResponse?.orders) ? ordersResponse.orders : [];
            renderCustomerOrdersDetailed(orders);
            return;
        }

        if (ordersDiv) {
            ordersDiv.innerHTML = '<p class="text-gray-500 text-center py-8">Order history is only available for customer accounts.</p>';
        }

        ui.renderAddresses([], {
            message: 'Saved addresses are only available for customer accounts.'
        });
    } catch (error) {
        console.error('[PROFILE] Loading error:', error);
        showToast('Unable to load profile. Please refresh.', 'error');
    }
}

// ============================================
// PAYMENT SUCCESS NOTIFICATION
// ============================================

function showPaymentSuccessNotification(order) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="text-align: center;">
            <div style="font-size: 64px; margin-bottom: 20px; animation: bounce 0.6s;">✅</div>
            <h2 style="font-size: 28px; font-weight: bold; margin-bottom: 12px; color: #16a34a;">Order Confirmed!</h2>
            <p style="color: #666; margin-bottom: 8px;">Your order has been placed successfully.</p>
            <p style="color: #999; margin-bottom: 20px; font-size: 14px;">OrderID: ${order}</p>
            <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #15803d; font-size: 13px;">✓ Order confirmation sent to your email</p>
            </div>
            <button onclick="navigateTo('#orders'); this.parentElement.parentElement.remove();" class="btn btn-primary" style="width: 100%;">View My Orders</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function formatDateTimeLabel(value) {
    if (!value) return 'Pending';

    try {
        const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
        const date = new Date(normalized);
        if (Number.isNaN(date.getTime())) {
            return escapeHtml(String(value));
        }
        return date.toLocaleString();
    } catch (error) {
        return escapeHtml(String(value));
    }
}

function getStatusBadgeClasses(status) {
    switch (status) {
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'processing':
            return 'bg-blue-100 text-blue-800';
        case 'shipped':
            return 'bg-purple-100 text-purple-800';
        case 'delivered':
            return 'bg-green-100 text-green-800';
        case 'cancelled':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function setProfileSectionVisibility({ showOrders, showAddresses, showRolePanel }) {
    const ordersCard = document.getElementById('profile-orders-card');
    const addressesCard = document.getElementById('profile-addresses-card');
    const rolePanel = document.getElementById('profile-role-panel');

    if (ordersCard) {
        ordersCard.classList.toggle('hidden', !showOrders);
    }

    if (addressesCard) {
        addressesCard.classList.toggle('hidden', !showAddresses);
    }

    if (rolePanel) {
        rolePanel.classList.toggle('hidden', !showRolePanel);
    }
}

function renderRoleOverviewPanel(title, description, stats, actions = []) {
    const titleEl = document.getElementById('profile-role-panel-title');
    const bodyEl = document.getElementById('profile-role-panel-body');

    if (!bodyEl) return;

    if (titleEl) {
        titleEl.textContent = title;
    }

    bodyEl.innerHTML = `
        <p class="text-gray-600">${escapeHtml(description)}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${stats.map((stat) => `
                <div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <p class="text-xs uppercase tracking-wide text-gray-500">${escapeHtml(stat.label)}</p>
                    <p class="mt-1 text-2xl font-bold ${stat.accent || 'text-gray-900'}">${escapeHtml(String(stat.value))}</p>
                </div>
            `).join('')}
        </div>
        <div class="flex flex-wrap gap-3 pt-2">
            ${actions.map((action) => `
                <button onclick="${action.onclick}" class="${action.className || 'px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-semibold'}">
                    ${escapeHtml(action.label)}
                </button>
            `).join('')}
        </div>
    `;
}

async function loadProfile() {
    await loadProfileWithFallback();
}

async function loadProfileWithFallback() {
    try {
        const response = await API.fetchProfile();
        const user = response?.user;
        if (!user) return;

        const subtitleEl = document.getElementById('profile-subtitle');
        const ordersDiv = document.getElementById('profile-orders');
        const addressesDiv = document.getElementById('profile-addresses');
        const role = user.role || AppState.user?.role;

        ui.renderProfileInfo(user);

        if (role === 'customer') {
            if (subtitleEl) {
                subtitleEl.textContent = 'Track your orders, manage addresses, and stay in sync with every purchase.';
            }

            setProfileSectionVisibility({
                showOrders: true,
                showAddresses: true,
                showRolePanel: false
            });

            ui.renderAddresses(user.addresses || []);

            const ordersResponse = await API.fetchOrders();
            console.log('[ORDERS] /api/user/orders response:', ordersResponse);
            const orders = Array.isArray(ordersResponse?.orders) ? ordersResponse.orders : [];
            renderCustomerOrdersDetailed(orders);
            return;
        }

        if (ordersDiv) {
            ordersDiv.innerHTML = '';
        }

        if (addressesDiv) {
            addressesDiv.innerHTML = '';
        }

        setProfileSectionVisibility({
            showOrders: false,
            showAddresses: false,
            showRolePanel: true
        });

        if (role === 'seller') {
            if (subtitleEl) {
                subtitleEl.textContent = 'Seller account overview with product and category approval visibility.';
            }

            const [categoriesResponse, productsResponse] = await Promise.all([
                API.call('/seller/my-categories'),
                API.call('/seller/products')
            ]);

            const categories = categoriesResponse?.categories || [];
            const products = productsResponse?.products || [];
            const approvedCategories = categories.filter((category) => category.status === 'approved').length;
            const pendingCategories = categories.filter((category) => category.status === 'pending').length;

            renderRoleOverviewPanel(
                'Seller Overview',
                'This profile is tailored for selling. Customer-only sections like addresses and personal order history are hidden.',
                [
                    { label: 'Products', value: products.length, accent: 'text-blue-600' },
                    { label: 'Approved Categories', value: approvedCategories, accent: 'text-green-600' },
                    { label: 'Pending Approvals', value: pendingCategories, accent: 'text-orange-600' },
                    { label: 'Member Since', value: user.created_at ? user.created_at.slice(0, 10) : 'N/A', accent: 'text-gray-900' }
                ],
                [
                    {
                        label: 'Open Seller Dashboard',
                        onclick: "navigateTo('#seller-dash')"
                    }
                ]
            );
            return;
        }

        if (role === 'admin') {
            if (subtitleEl) {
                subtitleEl.textContent = 'Administrator account overview with marketplace control and live platform stats.';
            }

            const [requestsResponse, sellersResponse, ordersResponse] = await Promise.all([
                API.call('/admin/category-requests'),
                API.call('/admin/sellers'),
                API.call('/admin/orders')
            ]);

            const requests = requestsResponse?.requests || [];
            const sellers = sellersResponse?.sellers || [];
            const orders = ordersResponse?.orders || [];

            renderRoleOverviewPanel(
                'Admin Overview',
                'Admin profiles focus on platform operations. Customer-only address and order cards are intentionally hidden here.',
                [
                    { label: 'Pending Requests', value: requests.length, accent: 'text-orange-600' },
                    { label: 'Sellers', value: sellers.length, accent: 'text-blue-600' },
                    { label: 'Active Sellers', value: sellers.filter((seller) => seller.is_active).length, accent: 'text-green-600' },
                    { label: 'Orders', value: orders.length, accent: 'text-purple-600' }
                ],
                [
                    {
                        label: 'Open Admin Dashboard',
                        onclick: "navigateTo('#admin-dash')"
                    }
                ]
            );
            return;
        }

        if (subtitleEl) {
            subtitleEl.textContent = 'Manage your account details.';
        }
    } catch (error) {
        console.error('[PROFILE] Loading error:', error);
        showToast('Unable to load profile. Please refresh.', 'error');
    }
}

async function loadOrderTracking(orderUuid) {
    const isAdminViewer = AppState.user?.role === 'admin';
    const trackingBackTarget = isAdminViewer ? '#admin-dash' : '#profile';
    const trackingBackLabel = isAdminViewer ? 'Back to Admin Dashboard' : 'Back to Profile';
    const trackingBackButton = document.getElementById('tracking-back-button');

    if (trackingBackButton) {
        trackingBackButton.textContent = trackingBackLabel;
        trackingBackButton.setAttribute('onclick', `navigateTo('${trackingBackTarget}')`);
    }

    if (!orderUuid) {
        showToast('Invalid order', 'error');
        navigateTo(trackingBackTarget);
        return;
    }

    const trackingResponse = isAdminViewer
        ? await API.call(`/admin/order/${orderUuid}/track`, 'GET')
        : await API.trackOrder(orderUuid);

    if (!trackingResponse) {
        showToast('Failed to load order tracking', 'error');
        navigateTo(trackingBackTarget);
        return;
    }

    const orderIdEl = document.getElementById('tracking-order-id');
    const statusTextEl = document.getElementById('tracking-status-text');
    const summaryEl = document.getElementById('tracking-summary');
    const shippingEl = document.getElementById('tracking-shipping');
    const timelineEl = document.getElementById('tracking-timeline');

    if (orderIdEl) {
        orderIdEl.textContent = `Order #${escapeHtml((trackingResponse.order_uuid || orderUuid).slice(0, 8))}`;
    }

    if (statusTextEl) {
        statusTextEl.textContent = `${trackingResponse.status_label || trackingResponse.current_status || 'Order update'} | Last update: ${formatDateTimeLabel(trackingResponse.latest_update?.timestamp)}`;
    }

    if (summaryEl) {
        const progress = Number(trackingResponse.progress_percent || 0);
        summaryEl.innerHTML = `
            <div class="flex items-start justify-between gap-4 mb-4">
                <div>
                    <p class="text-sm text-gray-500 mb-1">Current Status</p>
                    <span class="inline-flex px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeClasses(trackingResponse.current_status)}">
                        ${escapeHtml(trackingResponse.status_label || trackingResponse.current_status || 'Unknown')}
                    </span>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-500 mb-1">Estimated Delivery</p>
                    <p class="font-semibold text-gray-900">${formatDateTimeLabel(trackingResponse.estimated_delivery)}</p>
                </div>
            </div>
            <div class="mb-4">
                <div class="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Delivery progress</span>
                    <span>${progress}%</span>
                </div>
                <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-600 rounded-full transition-all duration-500" style="width: ${Math.max(0, Math.min(progress, 100))}%"></div>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="rounded-xl bg-white border border-gray-200 px-4 py-3">
                    <p class="text-xs uppercase tracking-wide text-gray-500">Items</p>
                    <p class="mt-1 text-xl font-bold text-gray-900">${escapeHtml(String(trackingResponse.summary?.item_count ?? trackingResponse.items?.length ?? 0))}</p>
                </div>
                <div class="rounded-xl bg-white border border-gray-200 px-4 py-3">
                    <p class="text-xs uppercase tracking-wide text-gray-500">Total</p>
                    <p class="mt-1 text-xl font-bold text-gray-900">Rs.${Number(trackingResponse.summary?.total_amount ?? trackingResponse.total_amount ?? 0).toFixed(2)}</p>
                </div>
                <div class="rounded-xl bg-white border border-gray-200 px-4 py-3">
                    <p class="text-xs uppercase tracking-wide text-gray-500">Payment</p>
                    <p class="mt-1 text-xl font-bold text-gray-900">${escapeHtml((trackingResponse.summary?.payment_method || 'pending').toUpperCase())}</p>
                </div>
            </div>
        `;
    }

    if (shippingEl) {
        const address = trackingResponse.shipping_address;
        shippingEl.innerHTML = address ? `
            <h3 class="text-lg font-bold text-gray-900 mb-3">Shipping Details</h3>
            <div class="space-y-1 text-sm text-gray-700">
                <p class="font-semibold">${escapeHtml(address.full_name)}</p>
                <p>${escapeHtml(address.street)}</p>
                <p>${escapeHtml(address.city)}, ${escapeHtml(address.state)} - ${escapeHtml(address.pincode)}</p>
                <p>Phone: ${escapeHtml(address.phone_number)}</p>
            </div>
            <div class="mt-4 pt-4 border-t border-blue-100">
                <p class="text-xs uppercase tracking-wide text-gray-500 mb-1">Latest Update</p>
                <p class="font-semibold text-gray-900">${escapeHtml(trackingResponse.latest_update?.message || 'Tracking in progress')}</p>
                <p class="text-xs text-gray-500 mt-1">${formatDateTimeLabel(trackingResponse.latest_update?.timestamp)}</p>
            </div>
        ` : `
            <h3 class="text-lg font-bold text-gray-900 mb-3">Shipping Details</h3>
            <p class="text-sm text-gray-600">Shipping address will appear here once it is available.</p>
        `;
    }

    if (timelineEl) {
        const timeline = Array.isArray(trackingResponse.timeline || trackingResponse.tracking_history)
            ? (trackingResponse.timeline || trackingResponse.tracking_history)
            : [];

        timelineEl.innerHTML = timeline.length > 0 ? timeline.map((event, index) => `
            <div class="relative pl-8">
                <div class="absolute left-0 top-2 h-full w-px ${index === timeline.length - 1 ? 'bg-transparent' : 'bg-gray-200'}"></div>
                <div class="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full ${
                    event.current ? 'bg-blue-600 text-white' : event.completed ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }">
                    ${event.current ? '>' : event.completed ? '|' : 'o'}
                </div>
                <div class="rounded-xl border ${event.current ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'} p-4 mb-4">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">${escapeHtml(event.title || event.step_key || 'Update')}</h3>
                            <p class="text-sm text-gray-600 mt-1">${escapeHtml(event.message || '')}</p>
                        </div>
                        <span class="inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                            event.current ? 'bg-blue-100 text-blue-800' : event.completed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }">
                            ${event.current ? 'Current' : event.completed ? 'Completed' : 'Pending'}
                        </span>
                    </div>
                    <p class="text-xs text-gray-500 mt-3">${formatDateTimeLabel(event.timestamp)}</p>
                </div>
            </div>
        `).join('') : '<div class="text-center text-gray-500">No tracking information available</div>';
    }
}

