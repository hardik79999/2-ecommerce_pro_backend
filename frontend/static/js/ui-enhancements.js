(() => {
    const activityState = {
        count: 0,
    };

    function formatCurrency(amount) {
        return `Rs.${Number(amount || 0).toFixed(2)}`;
    }

    function getReadableRoleLabel(role) {
        switch (role) {
            case 'customer':
                return 'Customer';
            case 'seller':
                return 'Seller';
            case 'admin':
                return 'Admin';
            default:
                return 'Guest';
        }
    }

    function getActivityOverlayContent(endpoint = '', method = 'GET') {
        const normalizedEndpoint = String(endpoint || '').toLowerCase();
        const normalizedMethod = String(method || 'GET').toUpperCase();

        if (normalizedEndpoint.includes('/auth/login')) {
            return {
                title: 'Signing you in',
                message: 'Restoring your session and syncing your latest account data.',
            };
        }

        if (normalizedEndpoint.includes('/auth/signup')) {
            return {
                title: 'Creating your account',
                message: 'Setting up your new profile, securing your workspace, and sending verification email.',
            };
        }

        if (normalizedEndpoint.includes('/user/cart')) {
            return {
                title: normalizedMethod === 'DELETE' ? 'Removing cart item' : 'Updating cart',
                message: 'Syncing your cart with the backend in real time.',
            };
        }

        if (normalizedEndpoint.includes('/user/address')) {
            return {
                title: 'Saving address',
                message: 'Updating your delivery details and preparing checkout.',
            };
        }

        if (normalizedEndpoint.includes('/user/checkout')) {
            return {
                title: 'Creating order',
                message: 'Locking your cart items and generating your order.',
            };
        }

        if (normalizedEndpoint.includes('/user/payment')) {
            return {
                title: 'Processing payment',
                message: 'Finalizing payment, preparing invoice data, and sending confirmation email.',
            };
        }

        if (normalizedEndpoint.includes('/seller/product')) {
            return {
                title: normalizedMethod === 'PUT' ? 'Updating product' : (normalizedMethod === 'DELETE' ? 'Removing product' : 'Publishing product'),
                message: normalizedMethod === 'DELETE'
                    ? 'Removing this listing and syncing seller inventory.'
                    : 'Uploading product data, images, and specifications.',
            };
        }

        if (normalizedEndpoint.includes('/seller/category-request')) {
            return {
                title: 'Submitting request',
                message: 'Sending your category approval request and notifying the admin team by email.',
            };
        }

        if (normalizedEndpoint.includes('/admin/order/') && normalizedEndpoint.includes('/status')) {
            return {
                title: 'Updating order',
                message: 'Publishing a fresh live-tracking update and sending the customer notification email.',
            };
        }

        if (normalizedEndpoint.includes('/admin/seller/')) {
            return {
                title: 'Updating seller',
                message: 'Applying seller account changes and refreshing dashboard data.',
            };
        }

        if (normalizedEndpoint.includes('/admin/category-request/')) {
            return {
                title: 'Updating request',
                message: 'Saving the category request decision and syncing seller access.',
            };
        }

        if (normalizedEndpoint.includes('/admin/category')) {
            return {
                title: 'Creating category',
                message: 'Adding a new category for the seller ecosystem.',
            };
        }

        return {
            title: normalizedMethod === 'DELETE' ? 'Removing item' : 'Processing request',
            message: 'Please wait while we update the latest data.',
        };
    }

    window.showActivityOverlay = function(message, title = 'Working on it') {
        const overlay = document.getElementById('activity-overlay');
        if (!overlay) return;

        const titleEl = document.getElementById('activity-title');
        const messageEl = document.getElementById('activity-message');

        activityState.count += 1;

        if (titleEl) {
            titleEl.textContent = title;
        }

        if (messageEl) {
            messageEl.textContent = message;
        }

        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
    };

    window.hideActivityOverlay = function(force = false) {
        const overlay = document.getElementById('activity-overlay');
        if (!overlay) return;

        if (force) {
            activityState.count = 0;
        } else {
            activityState.count = Math.max(0, activityState.count - 1);
        }

        if (activityState.count === 0) {
            overlay.classList.add('hidden');
            overlay.setAttribute('aria-hidden', 'true');
        }
    };

    const baseApiCall = API.call.bind(API);
    API.call = async function(endpoint, method = 'GET', body = null) {
        const normalizedMethod = String(method || 'GET').toUpperCase();
        const shouldShowOverlay = normalizedMethod !== 'GET';

        if (shouldShowOverlay) {
            const activityCopy = getActivityOverlayContent(endpoint, normalizedMethod);
            window.showActivityOverlay(activityCopy.message, activityCopy.title);
        }

        try {
            return await baseApiCall(endpoint, method, body);
        } finally {
            if (shouldShowOverlay) {
                window.hideActivityOverlay();
            }
        }
    };

    function setNavVisibility(ids, visible) {
        ids.forEach((id) => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = visible ? '' : 'none';
            }
        });
    }

    function updateRoleChips(role) {
        const roleLabel = getReadableRoleLabel(role);
        ['nav-role-chip', 'mobile-role-chip'].forEach((id) => {
            const chip = document.getElementById(id);
            if (!chip) return;

            if (role) {
                chip.textContent = roleLabel;
                chip.classList.remove('hidden');
                chip.style.display = 'inline-flex';
            } else {
                chip.textContent = '';
                chip.classList.add('hidden');
                chip.style.display = 'none';
            }
        });
    }

    function setHomeButton(button, label, path, className) {
        if (!button) return;
        button.textContent = label;
        button.onclick = () => window.navigateTo(path);
        button.className = className;
    }

    function refreshHomeActions() {
        const primaryButton = document.getElementById('home-primary-cta');
        const secondaryButton = document.getElementById('home-secondary-cta');
        const primaryClass = 'px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold';
        const secondaryClass = 'px-8 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-semibold';

        if (!primaryButton || !secondaryButton) return;

        if (!AppState.token) {
            setHomeButton(primaryButton, 'Browse Products', '#products', primaryClass);
            setHomeButton(secondaryButton, 'Get Started', '#login', secondaryClass);
            secondaryButton.style.display = '';
            return;
        }

        const role = AppState.user?.role;

        if (role === 'customer') {
            setHomeButton(primaryButton, 'Browse Products', '#products', primaryClass);
            setHomeButton(secondaryButton, 'Open Profile', '#profile', secondaryClass);
            secondaryButton.style.display = '';
            return;
        }

        if (role === 'seller') {
            setHomeButton(primaryButton, 'Open Seller Dashboard', '#seller-dash', primaryClass);
            setHomeButton(secondaryButton, 'View Profile', '#profile', secondaryClass);
            secondaryButton.style.display = '';
            return;
        }

        if (role === 'admin') {
            setHomeButton(primaryButton, 'Open Admin Dashboard', '#admin-dash', primaryClass);
            setHomeButton(secondaryButton, 'Browse Catalog', '#products', secondaryClass);
            secondaryButton.style.display = '';
        }
    }

    window.reloadAppHome = function() {
        window.closeAppModal?.();
        window.hideActivityOverlay?.(true);
        window.location.hash = '#home';
        window.location.reload();
    };

    window.showInfoModal = function({ title, message, note = '', primaryLabel = 'Go Home', primaryAction = "navigateTo('#home')", secondaryLabel = 'Close', secondaryAction = 'closeAppModal()', iconLabel = 'E' }) {
        window.closeAppModal?.();

        const modal = document.createElement('div');
        modal.className = 'app-modal';
        modal.innerHTML = `
            <div class="app-modal-backdrop" onclick="closeAppModal()"></div>
            <div class="app-modal-card">
                <div class="app-modal-icon">${window.escapeHtml(iconLabel)}</div>
                <h2 class="text-3xl font-bold text-gray-900">${window.escapeHtml(title)}</h2>
                <p class="text-gray-600 mt-3">${window.escapeHtml(message)}</p>
                ${note ? `<div class="app-modal-note">${window.escapeHtml(note)}</div>` : ''}
                <div class="app-modal-actions">
                    <button onclick="${primaryAction}" class="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold">
                        ${window.escapeHtml(primaryLabel)}
                    </button>
                    <button onclick="${secondaryAction}" class="w-full px-4 py-3 bg-gray-200 text-gray-900 rounded-xl hover:bg-gray-300 transition font-semibold">
                        ${window.escapeHtml(secondaryLabel)}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    };

    window.closeMobileMenu = function() {
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) {
            mobileMenu.classList.add('hidden');
        }
    };

    window.toggleMobileMenu = function() {
        const mobileMenu = document.getElementById('mobile-menu');
        if (!mobileMenu) return;
        mobileMenu.classList.toggle('hidden');
    };

    window.syncNavigationState = function(path = window.location.hash || '#home') {
        const activeHash = String(path || '#home');
        let targetKey = activeHash.replace('#', '').split('/')[0] || 'home';

        if (targetKey === 'product') {
            targetKey = 'products';
        }

        if (targetKey === 'order-tracking') {
            targetKey = AppState.user?.role === 'admin' ? 'admin-dash' : 'profile';
        }

        const navTargets = [
            { key: 'products', ids: ['nav-products', 'mobile-nav-products'] },
            { key: 'cart', ids: ['nav-cart', 'mobile-nav-cart'] },
            { key: 'profile', ids: ['nav-profile', 'mobile-nav-profile'] },
            { key: 'seller-dash', ids: ['nav-seller', 'mobile-nav-seller'] },
            { key: 'admin-dash', ids: ['nav-admin', 'mobile-nav-admin'] },
        ];

        navTargets.forEach((target) => {
            target.ids.forEach((id) => {
                const element = document.getElementById(id);
                if (element) {
                    element.classList.toggle('active', target.key === targetKey);
                }
            });
        });
    };

    document.addEventListener('click', (event) => {
        const mobileMenu = document.getElementById('mobile-menu');
        if (!mobileMenu || mobileMenu.classList.contains('hidden')) return;

        if (event.target.closest('.nav-icon-button') || event.target.closest('#mobile-menu')) {
            return;
        }

        window.closeMobileMenu();
    });

    AppState.updateCartBadge = function() {
        const cartCount = window.getCartCount(this.cart);
        const badgeValue = String(cartCount);
        ['cart-badge', 'mobile-cart-badge'].forEach((id) => {
            const badge = document.getElementById(id);
            if (badge) {
                badge.textContent = badgeValue;
                badge.classList.toggle('is-empty', cartCount === 0);
            }
        });

        ['nav-cart', 'mobile-nav-cart'].forEach((id) => {
            const cartButton = document.getElementById(id);
            if (cartButton) {
                cartButton.setAttribute('aria-label', cartCount > 0 ? `Cart with ${badgeValue} items` : 'Cart');
            }
        });
    };

    ui.updateCartBadge = function() {
        AppState.updateCartBadge();
    };

    window.renderNavbar = function(isLoggedIn, role) {
        setNavVisibility(['nav-login', 'mobile-nav-login'], false);
        setNavVisibility(['nav-logout', 'mobile-nav-logout'], false);
        setNavVisibility(['nav-products', 'mobile-nav-products'], false);
        setNavVisibility(['nav-cart', 'mobile-nav-cart'], false);
        setNavVisibility(['nav-profile', 'mobile-nav-profile'], false);
        setNavVisibility(['nav-seller', 'mobile-nav-seller'], false);
        setNavVisibility(['nav-admin', 'mobile-nav-admin'], false);

        if (!isLoggedIn) {
            setNavVisibility(['nav-login', 'mobile-nav-login'], true);
            setNavVisibility(['nav-products', 'mobile-nav-products'], true);
            setNavVisibility(['nav-cart', 'mobile-nav-cart'], true);
            updateRoleChips(null);
            window.syncNavigationState();
            refreshHomeActions();
            return;
        }

        setNavVisibility(['nav-logout', 'mobile-nav-logout'], true);
        setNavVisibility(['nav-profile', 'mobile-nav-profile'], true);
        updateRoleChips(role);

        if (role === 'customer') {
            setNavVisibility(['nav-products', 'mobile-nav-products'], true);
            setNavVisibility(['nav-cart', 'mobile-nav-cart'], true);
        } else if (role === 'seller') {
            setNavVisibility(['nav-seller', 'mobile-nav-seller'], true);
        } else if (role === 'admin') {
            setNavVisibility(['nav-products', 'mobile-nav-products'], true);
            setNavVisibility(['nav-admin', 'mobile-nav-admin'], true);
        }

        window.syncNavigationState();
        refreshHomeActions();
    };

    window.updateUIBasedOnAuth = function() {
        const isLoggedIn = Boolean(AppState.token);
        const role = AppState.user?.role;
        window.renderNavbar(isLoggedIn, role);
        ui.updateCartBadge();
    };

    window.navigateTo = function(path) {
        window.closeMobileMenu();
        window.location.hash = path;
        window.syncNavigationState(path);
    };

    window.showSection = function(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.remove('hidden');
            window.scrollTo(0, 0);
        }
        window.syncNavigationState();
    };

    function setSubmitButtonState(form, isBusy, busyLabel = 'Processing') {
        const submitButton = form?.querySelector('button[type="submit"]');
        if (!submitButton) return;

        if (isBusy) {
            if (!submitButton.dataset.originalHtml) {
                submitButton.dataset.originalHtml = submitButton.innerHTML;
            }

            submitButton.disabled = true;
            submitButton.innerHTML = `
                <span class="inline-flex items-center justify-center gap-2">
                    <span class="inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin"></span>
                    <span>${window.escapeHtml(busyLabel)}</span>
                </span>
            `;
            return;
        }

        if (submitButton.dataset.originalHtml) {
            submitButton.innerHTML = submitButton.dataset.originalHtml;
        }
        submitButton.disabled = false;
    }

    window.handleLogin = async function(event) {
        event.preventDefault();
        setSubmitButtonState(event.target, true, 'Signing in');

        try {
            const email = document.getElementById('login-email')?.value?.trim();
            const password = document.getElementById('login-password')?.value;

            if (!email || !password) {
                window.showToast('Email and password are required', 'warning');
                return;
            }

            const response = await API.login(email, password);
            if (!response) return;

            window.showToast('Login successful!', 'success');
            await window.initApp();
            document.getElementById('login-form')?.reset();
            window.updateUIBasedOnAuth();
            window.navigateTo('#home');
        } catch (error) {
            console.error('[AUTH] Login failed:', error);
            window.showToast('Unable to login right now. Please try again.', 'error');
        } finally {
            setSubmitButtonState(event.target, false);
        }
    };

    window.handleSignup = async function(event) {
        event.preventDefault();
        setSubmitButtonState(event.target, true, 'Creating account');

        try {
            const username = document.getElementById('signup-username')?.value?.trim();
            const email = document.getElementById('signup-email')?.value?.trim();
            const password = document.getElementById('signup-password')?.value;
            const role = document.getElementById('signup-role')?.value;

            if (!username || !email || !password || !role) {
                window.showToast('All fields are required', 'warning');
                return;
            }

            const response = await API.signup(username, email, password, role);
            if (!response) return;

            window.showToast('Account created! Please login.', 'success');
            window.showInfoModal({
                title: 'Verification email queued',
                message: 'Your account is ready. Please verify your email before logging in.',
                note: response.email_status || 'Verification email status is being processed.',
                primaryLabel: 'Open Login',
                primaryAction: "closeAppModal(); switchAuthTab('login')",
                secondaryLabel: 'Stay Here',
                secondaryAction: 'closeAppModal()',
                iconLabel: 'E'
            });
            window.switchAuthTab('login');
            const loginEmailField = document.getElementById('login-email');
            if (loginEmailField) {
                loginEmailField.value = email;
            }
            document.getElementById('signup-form')?.reset();
        } finally {
            setSubmitButtonState(event.target, false);
        }
    };

    window.handleAddAddress = async function(event) {
        event.preventDefault();
        setSubmitButtonState(event.target, true, 'Saving address');

        try {
            const addressData = {
                full_name: document.getElementById('addr-name')?.value || '',
                phone_number: document.getElementById('addr-phone')?.value || '',
                street: document.getElementById('addr-street')?.value || '',
                city: document.getElementById('addr-city')?.value || '',
                state: document.getElementById('addr-state')?.value || '',
                pincode: document.getElementById('addr-pincode')?.value || ''
            };

            if (!addressData.full_name || !addressData.phone_number || !addressData.street || !addressData.city || !addressData.state || !addressData.pincode) {
                window.showToast('Please fill in all address fields', 'warning');
                return;
            }

            const response = await API.saveAddress(addressData);
            if (!response?.address_uuid) return;

            AppState.selectedAddress = response.address_uuid;
            window.showToast('Address saved successfully!', 'success');
            event.target.reset();
            await window.loadCheckout();
        } finally {
            setSubmitButtonState(event.target, false);
        }
    };

    window.handlePayment = async function(event) {
        event.preventDefault();
        setSubmitButtonState(event.target, true, 'Placing order');

        try {
            if (typeof window.handlePaymentWithOtp === 'function') {
                await window.handlePaymentWithOtp(event);
                return;
            }

            window.showToast('Checkout payment handler is unavailable. Please refresh and try again.', 'error');
        } finally {
            setSubmitButtonState(event.target, false);
        }
    };

    window.handleAddProduct = async function(event) {
        event.preventDefault();
        const editingUuid = document.getElementById('product-edit-uuid')?.value?.trim();
        setSubmitButtonState(event.target, true, editingUuid ? 'Updating product' : 'Publishing product');

        try {
            const formData = new FormData();
            formData.append('name', document.getElementById('product-name')?.value || '');
            formData.append('description', document.getElementById('product-description')?.value || '');
            formData.append('price', document.getElementById('product-price')?.value || '');
            formData.append('stock', document.getElementById('product-stock')?.value || '');
            formData.append('category_uuid', document.getElementById('product-category')?.value || '');

            const imageFiles = document.getElementById('product-images')?.files || [];
            for (let i = 0; i < imageFiles.length; i += 1) {
                formData.append('images', imageFiles[i]);
            }

            const specs = [];
            document.querySelectorAll('.spec-row').forEach((row) => {
                const key = row.querySelector('.spec-key')?.value?.trim();
                const value = row.querySelector('.spec-value')?.value?.trim();
                if (key && value) {
                    specs.push({ key, value });
                }
            });

            formData.append('specifications', JSON.stringify(specs));

            const method = editingUuid ? 'PUT' : 'POST';
            const endpoint = editingUuid ? `/seller/product/${editingUuid}` : '/seller/product';

            const response = await API.call(endpoint, method, formData);
            if (!response) return;

            window.showToast(editingUuid ? 'Product updated successfully!' : 'Product added successfully!', 'success');
            window.resetSellerProductForm();
            await window.loadSellerDashboard();
        } finally {
            setSubmitButtonState(event.target, false);
        }
    };

    window.handleCreateCategory = async function(event) {
        event.preventDefault();
        setSubmitButtonState(event.target, true, 'Creating category');

        try {
            const name = document.getElementById('category-name')?.value?.trim();
            const description = document.getElementById('category-description')?.value?.trim();

            if (!name) {
                window.showToast('Category name is required', 'error');
                return;
            }

            const response = await API.call('/admin/category', 'POST', {
                name,
                description,
            });

            if (!response) return;

            window.showToast('Category created successfully!', 'success');
            document.getElementById('category-name').value = '';
            document.getElementById('category-description').value = '';
            await window.loadAdminDashboard();
            window.switchAdminTab('category');
        } finally {
            setSubmitButtonState(event.target, false);
        }
    };

    function setActionControlState(controlEl, isBusy, busyLabel = 'Updating') {
        if (!controlEl) return;

        controlEl.disabled = isBusy;

        if (controlEl.tagName === 'BUTTON') {
            if (isBusy) {
                if (!controlEl.dataset.originalText) {
                    controlEl.dataset.originalText = controlEl.textContent;
                }
                controlEl.textContent = busyLabel;
            } else if (controlEl.dataset.originalText) {
                controlEl.textContent = controlEl.dataset.originalText;
            }
        }
    }

    function buildEmptyPanel(title, description) {
        return `
            <div class="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                <p class="text-lg font-semibold text-gray-900">${window.escapeHtml(title)}</p>
                <p class="mt-2 text-sm text-gray-500">${window.escapeHtml(description)}</p>
            </div>
        `;
    }

    function fillSpecificationRows(specifications = []) {
        const container = document.getElementById('specs-container');
        if (!container) return;

        container.innerHTML = '';
        const rows = specifications.length > 0 ? specifications : [{ key: '', value: '' }];

        rows.forEach((spec) => {
            const row = document.createElement('div');
            row.className = 'spec-row flex gap-2 mb-2';
            row.innerHTML = `
                <input type="text" placeholder="Key (e.g., RAM)" class="flex-1 spec-key px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value="${window.escapeHtml(spec.key || '')}">
                <input type="text" placeholder="Value (e.g., 16GB)" class="flex-1 spec-value px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value="${window.escapeHtml(spec.value || '')}">
                <button type="button" onclick="removeSpec(this)" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">Remove</button>
            `;
            container.appendChild(row);
        });
    }

    window.resetSellerProductForm = function() {
        const form = document.getElementById('seller-product-form');
        if (form) {
            form.reset();
            form.classList.remove('seller-form-editing');
        }

        const editUuid = document.getElementById('product-edit-uuid');
        const title = document.getElementById('seller-product-form-title');
        const status = document.getElementById('seller-product-form-status');
        const cancelButton = document.getElementById('seller-product-cancel-edit');
        const secondaryButton = document.getElementById('seller-product-secondary');
        const submitButton = document.getElementById('seller-product-submit');
        const imageInput = document.getElementById('product-images');
        const imageHelp = document.getElementById('product-images-help');

        if (editUuid) editUuid.value = '';
        if (title) title.textContent = 'Add New Product';
        if (status) status.textContent = 'Create a fresh listing with images, stock, and specifications.';
        if (cancelButton) cancelButton.classList.add('hidden');
        if (secondaryButton) secondaryButton.classList.add('hidden');
        if (submitButton) submitButton.textContent = 'Add Product';
        if (imageInput) imageInput.required = true;
        if (imageHelp) imageHelp.textContent = 'First image will be set as primary';

        fillSpecificationRows();
    };

    window.startEditProduct = function(productUuid) {
        const product = (window.__sellerProductsCache || []).find((item) => item.uuid === productUuid);
        if (!product) {
            window.showToast('Product details not found', 'error');
            return;
        }

        const form = document.getElementById('seller-product-form');
        const editUuid = document.getElementById('product-edit-uuid');
        const title = document.getElementById('seller-product-form-title');
        const status = document.getElementById('seller-product-form-status');
        const cancelButton = document.getElementById('seller-product-cancel-edit');
        const secondaryButton = document.getElementById('seller-product-secondary');
        const submitButton = document.getElementById('seller-product-submit');
        const imageInput = document.getElementById('product-images');
        const imageHelp = document.getElementById('product-images-help');

        if (editUuid) editUuid.value = product.uuid;
        document.getElementById('product-name').value = product.name || '';
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-price').value = product.price ?? '';
        document.getElementById('product-stock').value = product.stock ?? '';
        document.getElementById('product-category').value = product.category_uuid || '';

        if (title) title.textContent = `Edit ${product.name}`;
        if (status) status.textContent = 'Update text, stock, specs, or upload fresh images for this product.';
        if (cancelButton) cancelButton.classList.remove('hidden');
        if (secondaryButton) secondaryButton.classList.remove('hidden');
        if (submitButton) submitButton.textContent = 'Update Product';
        if (imageInput) {
            imageInput.required = false;
            imageInput.value = '';
        }
        if (imageHelp) imageHelp.textContent = 'Leave empty to keep current images. Upload new files to replace them.';
        if (form) form.classList.add('seller-form-editing');

        fillSpecificationRows(product.specifications || []);
        window.scrollTo({ top: form?.offsetTop ? Math.max(form.offsetTop - 120, 0) : 0, behavior: 'smooth' });
    };

    window.deleteSellerProduct = async function(productUuid, triggerEl = null) {
        if (!confirm('Delete this product from the storefront?')) {
            return;
        }

        setActionControlState(triggerEl, true, 'Deleting');

        try {
            const response = await API.call(`/seller/product/${productUuid}`, 'DELETE');
            if (!response) return;

            window.showToast(response.message || 'Product deleted successfully!', 'success');
            if (document.getElementById('product-edit-uuid')?.value === productUuid) {
                window.resetSellerProductForm();
            }
            await window.loadSellerDashboard();
        } finally {
            setActionControlState(triggerEl, false);
        }
    };

    window.requestCategoryApproval = async function(categoryUuid, triggerEl = null) {
        setActionControlState(triggerEl, true, 'Sending');

        try {
            const response = await API.call('/seller/category-request', 'POST', {
                category_uuid: categoryUuid
            });

            if (!response) return;

            window.showToast(response.message || 'Category request submitted successfully!', 'success');
            window.showInfoModal({
                title: 'Request sent to admin',
                message: response.message || 'Your category approval request has been saved.',
                note: response.email_status || 'Admin notification email status is not available.',
                primaryLabel: 'Open Seller Dashboard',
                primaryAction: "closeAppModal(); navigateTo('#seller-dash')",
                secondaryLabel: 'Close',
                secondaryAction: 'closeAppModal()',
                iconLabel: 'E'
            });
            await window.loadSellerDashboard();
        } finally {
            setActionControlState(triggerEl, false);
        }
    };

    window.displayCategoryRequestSection = function(available, pending) {
        let categorySection = document.getElementById('seller-category-requests');
        if (!categorySection) {
            const form = document.getElementById('seller-product-form');
            if (form?.parentElement) {
                categorySection = document.createElement('div');
                categorySection.id = 'seller-category-requests';
                form.parentElement.insertBefore(categorySection, form);
            }
        }

        if (!categorySection) return;

        const pendingHtml = pending.length > 0 ? `
            <div class="rounded-2xl border border-orange-100 bg-orange-50/80 p-5">
                <p class="text-sm font-semibold uppercase tracking-wide text-orange-700">Pending approvals</p>
                <div class="mt-3 flex flex-wrap gap-2">
                    ${pending.map((category) => `
                        <span class="inline-flex rounded-full bg-white px-3 py-2 text-sm font-semibold text-orange-700 border border-orange-200">
                            ${window.escapeHtml(category.name)}
                        </span>
                    `).join('')}
                </div>
            </div>
        ` : '';

        const availableHtml = available.length > 0 ? `
            <div class="grid gap-3">
                ${available.map((category) => `
                    <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p class="text-base font-semibold text-gray-900">${window.escapeHtml(category.name)}</p>
                                <p class="text-sm text-gray-500">Request admin approval before listing products here.</p>
                            </div>
                            <button type="button" onclick="requestCategoryApproval('${category.uuid}', this)" class="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-semibold">
                                Request Access
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : buildEmptyPanel('No more categories to request', 'Admin-created categories will appear here when they become available.');

        categorySection.innerHTML = `
            <div class="surface-card p-6 mb-8">
                <div class="flex flex-col gap-2 mb-5">
                    <p class="text-sm font-semibold uppercase tracking-wide text-blue-600">Seller workflow</p>
                    <h3 class="text-2xl font-bold text-gray-900">Category access</h3>
                    <p class="text-gray-600">Track pending approvals and request new categories from one clean workspace.</p>
                </div>
                <div class="space-y-4">
                    ${pendingHtml}
                    ${availableHtml}
                </div>
            </div>
        `;
    };

    window.loadSellerDashboard = async function() {
        const [categoriesResponse, productsResponse] = await Promise.all([
            API.call('/seller/my-categories'),
            API.call('/seller/products')
        ]);

        const categories = categoriesResponse?.categories || [];
        const products = productsResponse?.products || [];
        const approved = categories.filter((category) => category.status === 'approved');
        const pending = categories.filter((category) => category.status === 'pending');
        const available = categories.filter((category) => category.status === 'available');

        const countTargets = {
            'seller-products-count': products.length,
            'seller-categories-count': categories.length,
            'seller-pending-count': pending.length,
            'seller-approved-count': approved.length,
        };

        Object.entries(countTargets).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = String(value);
            }
        });

        const totalLabel = document.getElementById('seller-products-total-label');
        if (totalLabel) {
            totalLabel.textContent = `${products.length} live listing${products.length === 1 ? '' : 's'}`;
        }

        const select = document.getElementById('product-category');
        if (select) {
            select.innerHTML = '<option value=\"\">Select Category</option>' +
                approved.map((category) => `<option value="${category.uuid}">${window.escapeHtml(category.name)}</option>`).join('');
        }

        window.displayCategoryRequestSection(available, pending);
        window.__sellerProductsCache = products;

        const productsDiv = document.getElementById('seller-products');
        if (!productsDiv) return;

        if (products.length === 0) {
            productsDiv.innerHTML = buildEmptyPanel('No products yet', 'Add your first product to start selling through the storefront.');
            return;
        }

        productsDiv.innerHTML = products.map((product) => {
            const stock = Number(product.stock || 0);
            const hasStock = stock > 0;
            const specs = Array.isArray(product.specifications) ? product.specifications.slice(0, 3) : [];
            const updatedAt = window.formatDateTimeLabel(product.updated_at || product.created_at || '');

            return `
                <article class="seller-product-card">
                    <div class="seller-product-media">
                        <img src="${window.buildImageUrl(product.primary_image)}" alt="${window.escapeHtml(product.name)}" class="seller-product-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                        <div class="seller-product-image-fallback" style="display: none;">Catalog</div>
                        <div class="seller-product-overlay"></div>
                        <div class="seller-product-topline">
                            <span class="seller-product-category">${window.escapeHtml(product.category || 'Catalog')}</span>
                            <span class="seller-product-status ${hasStock ? 'is-live' : 'is-empty'}">${hasStock ? 'Ready to sell' : 'Restock now'}</span>
                        </div>
                        <div class="seller-product-price-tag">${formatCurrency(product.price)}</div>
                    </div>
                    <div class="seller-product-body">
                        <div class="seller-product-heading">
                            <div>
                                <h3 class="seller-product-title">${window.escapeHtml(product.name)}</h3>
                                <p class="seller-product-description">${window.escapeHtml(product.description || 'No description provided.')}</p>
                            </div>
                        </div>
                        <div class="seller-product-stats">
                            <div class="seller-product-stat">
                                <span class="seller-product-stat-label">Stock</span>
                                <strong>${window.escapeHtml(String(stock))}</strong>
                            </div>
                            <div class="seller-product-stat">
                                <span class="seller-product-stat-label">Specs</span>
                                <strong>${window.escapeHtml(String(specs.length || 0))}</strong>
                            </div>
                        </div>
                        <div class="seller-product-specs">
                            ${specs.length > 0
                                ? specs.map((spec) => `
                                    <span class="seller-product-spec-chip">
                                        <strong>${window.escapeHtml(spec.key || 'Spec')}</strong>
                                        <span>${window.escapeHtml(spec.value || '')}</span>
                                    </span>
                                `).join('')
                                : '<span class="seller-product-spec-chip seller-product-spec-chip-muted">Add specs to make this listing look richer.</span>'}
                        </div>
                        <div class="seller-product-footer">
                            <div class="seller-product-updated">
                                <span class="seller-product-updated-label">Updated</span>
                                <strong>${window.escapeHtml(updatedAt || 'Recently')}</strong>
                            </div>
                            <div class="seller-product-actions">
                                <button type="button" onclick="startEditProduct('${product.uuid}')" class="seller-action-button seller-action-primary">
                                    Edit Product
                                </button>
                                <button type="button" onclick="deleteSellerProduct('${product.uuid}', this)" class="seller-action-button seller-action-danger">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    };

    window.approveCategoryRequest = async function(requestUuid, triggerEl = null) {
        setActionControlState(triggerEl, true, 'Approving');

        try {
            const response = await API.call(`/admin/category-request/${requestUuid}/approve`, 'PUT', {});
            if (!response) return;
            window.showToast('Request approved!', 'success');
            await window.loadAdminDashboard();
        } finally {
            setActionControlState(triggerEl, false);
        }
    };

    window.declineCategoryRequest = async function(requestUuid, triggerEl = null) {
        if (!confirm('Are you sure you want to decline this request?')) {
            return;
        }

        setActionControlState(triggerEl, true, 'Declining');

        try {
            const response = await API.call(`/admin/category-request/${requestUuid}/decline`, 'PUT', {});
            if (!response) return;
            window.showToast('Request declined!', 'warning');
            await window.loadAdminDashboard();
        } finally {
            setActionControlState(triggerEl, false);
        }
    };

    window.toggleSellerStatus = async function(sellerUuid, triggerEl = null) {
        setActionControlState(triggerEl, true, 'Updating');

        try {
            const response = await API.call(`/admin/seller/${sellerUuid}/status`, 'PUT', {});
            if (!response) return;
            window.showToast('Seller status updated!', 'success');
            await window.loadAdminDashboard();
        } finally {
            setActionControlState(triggerEl, false);
        }
    };

    window.updateOrderStatus = async function(orderUuid, newStatus, controlEl = null) {
        if (!newStatus) return;

        setActionControlState(controlEl, true);

        try {
            const response = await API.call(`/admin/order/${orderUuid}/status`, 'PUT', {
                status: newStatus,
                message: `Order status updated to ${String(newStatus).toUpperCase()}`
            });

            if (!response) return;

            window.showToast('Order status updated!', 'success');
            if (response.email_status) {
                window.showInfoModal({
                    title: 'Customer update published',
                    message: `Order is now ${String(newStatus).toUpperCase()}.`,
                    note: response.email_status,
                    primaryLabel: 'Stay on Orders',
                    primaryAction: "closeAppModal(); switchAdminTab('orders')",
                    secondaryLabel: 'Close',
                    secondaryAction: 'closeAppModal()',
                    iconLabel: 'E'
                });
            }
            await window.loadAdminDashboard();
            window.switchAdminTab('orders');
        } finally {
            setActionControlState(controlEl, false);
        }
    };

    window.displayCategoryRequests = function(requests) {
        const requestsList = document.getElementById('admin-requests-list');
        if (!requestsList) return;

        if (requests.length === 0) {
            requestsList.innerHTML = buildEmptyPanel('No pending requests', 'New seller approval requests will show up here.');
            return;
        }

        requestsList.innerHTML = requests.map((request) => `
            <div class="admin-request-card border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p class="text-lg font-bold text-gray-900">${window.escapeHtml(request.seller_name || 'Seller')}</p>
                        <p class="text-sm text-gray-500 mt-1">Requested category: ${window.escapeHtml(request.category_name || 'Unknown')}</p>
                        <p class="text-xs uppercase tracking-wide text-gray-400 mt-3">Requested on ${window.escapeHtml(request.requested_at || 'Unknown')}</p>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <button onclick="approveCategoryRequest('${request.request_uuid}', this)" class="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-semibold">
                            Approve
                        </button>
                        <button onclick="declineCategoryRequest('${request.request_uuid}', this)" class="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-semibold">
                            Decline
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    };

    window.displaySellers = function(sellers) {
        const sellersList = document.getElementById('admin-sellers-list');
        if (!sellersList) return;

        if (sellers.length === 0) {
            sellersList.innerHTML = buildEmptyPanel('No sellers found', 'Seller accounts will appear here once they register.');
            return;
        }

        sellersList.innerHTML = sellers.map((seller) => `
            <div class="admin-seller-card border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div class="flex items-center gap-3 flex-wrap">
                            <p class="text-lg font-bold text-gray-900">${window.escapeHtml(seller.username)}</p>
                            <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ${seller.is_active ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                                ${seller.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <p class="text-sm text-gray-500 mt-2">${window.escapeHtml(seller.email)}</p>
                    </div>
                    <button onclick="toggleSellerStatus('${seller.uuid}', this)" class="px-4 py-2 ${seller.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-xl transition font-semibold">
                        ${seller.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            </div>
        `).join('');
    };

    window.displayAdminOrders = function(orders) {
        const ordersList = document.getElementById('admin-orders-list');
        const ordersCount = document.getElementById('admin-orders-count');

        if (ordersCount) {
            ordersCount.textContent = String(orders.length);
        }

        if (!ordersList) return;

        if (orders.length === 0) {
            ordersList.innerHTML = buildEmptyPanel('No orders yet', 'Customer orders will appear here as soon as purchases are placed.');
            return;
        }

        ordersList.innerHTML = orders.map((order) => `
            <div class="admin-order-card border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex flex-col gap-4">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div class="flex items-center gap-3 flex-wrap">
                                <p class="text-lg font-bold text-gray-900">Order #${window.escapeHtml((order.order_uuid || '').slice(0, 8))}</p>
                                <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ${window.getStatusBadgeClasses(order.status)}">
                                    ${window.escapeHtml(String(order.status || 'unknown').toUpperCase())}
                                </span>
                            </div>
                            <p class="text-sm text-gray-500 mt-2">Customer: ${window.escapeHtml(order.customer_username || 'Unknown')}</p>
                            <p class="text-xs uppercase tracking-wide text-gray-400 mt-2">${window.escapeHtml(order.created_at || '')}</p>
                        </div>
                        <div class="text-left lg:text-right">
                            <p class="text-sm text-gray-500">Order total</p>
                            <p class="text-2xl font-bold text-blue-700">${formatCurrency(order.total_amount)}</p>
                            <p class="text-sm text-gray-500 mt-1">${window.escapeHtml(String(order.item_count || 0))} item(s)</p>
                        </div>
                    </div>
                    <div class="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
                        <p class="text-xs uppercase tracking-wide text-gray-500 mb-2">Items</p>
                        <p class="text-sm text-gray-700">${window.escapeHtml((order.items || []).map((item) => `${item.product_name} (x${item.quantity})`).join(', ') || 'No items available')}</p>
                    </div>
                    <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <button onclick="navigateTo('#order-tracking/${order.order_uuid}')" class="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition font-semibold">
                            View Tracking
                        </button>
                        <select onchange="updateOrderStatus('${order.order_uuid}', this.value, this)" class="text-sm px-3 py-2 border rounded-xl bg-white min-w-[220px]">
                            <option value="">Change status...</option>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>
            </div>
        `).join('');
    };

    window.displayAdminProducts = function(products) {
        const productsList = document.getElementById('admin-products-list');
        const countLabel = document.getElementById('admin-products-count-label');

        if (countLabel) {
            countLabel.textContent = `${products.length} product${products.length === 1 ? '' : 's'}`;
        }

        if (!productsList) return;

        if (!products.length) {
            productsList.innerHTML = buildEmptyPanel('No products found', 'Seller listings will appear here for admin review.');
            return;
        }

        productsList.innerHTML = products.map((product) => `
            <div class="admin-product-card border border-gray-200 bg-white p-4 shadow-sm">
                <div class="overflow-hidden rounded-2xl bg-gray-100 mb-4 aspect-[4/3]">
                    <img src="${window.buildImageUrl(product.primary_image)}" alt="${window.escapeHtml(product.name)}" class="w-full h-full object-cover" onerror="this.style.display='none'">
                </div>
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900">${window.escapeHtml(product.name)}</h3>
                        <p class="text-sm text-gray-500 mt-1">${window.escapeHtml(product.description || 'No description provided.')}</p>
                    </div>
                    <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ${Number(product.stock) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                        ${Number(product.stock) > 0 ? 'Live' : 'Low stock'}
                    </span>
                </div>
                <div class="admin-product-meta mt-4 text-sm text-gray-500">
                    <span>Seller: ${window.escapeHtml(product.seller_username || 'Unknown')}</span>
                    <span>Category: ${window.escapeHtml(product.category_name || 'Unknown')}</span>
                </div>
                <div class="mt-4 flex items-center justify-between">
                    <p class="text-xl font-bold text-blue-700">${formatCurrency(product.price)}</p>
                    <p class="text-sm text-gray-500">Stock: ${window.escapeHtml(String(product.stock || 0))}</p>
                </div>
                <div class="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    Admin preview only. Purchasing stays disabled for admin accounts.
                </div>
                <div class="mt-4 flex items-center justify-between gap-3">
                    <p class="text-xs uppercase tracking-wide text-gray-400">
                        Updated ${window.escapeHtml(product.updated_at || product.created_at || 'recently')}
                    </p>
                    <button type="button" onclick="navigateTo('#product/${product.uuid}')" class="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition font-semibold">
                        View Product
                    </button>
                </div>
            </div>
        `).join('');
    };

    window.loadAdminDashboard = async function() {
        const [requestsResponse, sellersResponse, ordersResponse, productsResponse] = await Promise.all([
            API.call('/admin/category-requests'),
            API.call('/admin/sellers'),
            API.call('/admin/orders'),
            API.call('/admin/products')
        ]);

        const requests = requestsResponse?.requests || [];
        const sellers = sellersResponse?.sellers || [];
        const orders = ordersResponse?.orders || [];
        const products = productsResponse?.products || [];

        const pendingRequestsEl = document.getElementById('admin-pending-requests');
        const sellersCountEl = document.getElementById('admin-sellers-count');
        const activeSellersEl = document.getElementById('admin-active-sellers');
        const ordersCountEl = document.getElementById('admin-orders-count');

        if (pendingRequestsEl) pendingRequestsEl.textContent = String(requests.length);
        if (sellersCountEl) sellersCountEl.textContent = String(sellers.length);
        if (activeSellersEl) activeSellersEl.textContent = String(sellers.filter((seller) => seller.is_active).length);
        if (ordersCountEl) ordersCountEl.textContent = String(orders.length);

        window.displayCategoryRequests(requests);
        window.displaySellers(sellers);
        window.displayAdminOrders(orders);
        window.displayAdminProducts(products);

        const hasActiveTab = document.querySelector('.dashboard-tabs button.is-active');
        if (!hasActiveTab) {
            window.switchAdminTab('requests');
        }
    };

    window.switchAdminTab = function(tab) {
        const contentIds = {
            category: 'admin-category-tab-content',
            requests: 'admin-requests-tab-content',
            sellers: 'admin-sellers-tab-content',
            orders: 'admin-orders-tab-content',
            products: 'admin-products-tab-content',
        };

        Object.values(contentIds).forEach((id) => {
            const content = document.getElementById(id);
            if (content) {
                content.classList.add('hidden');
            }
        });

        ['admin-category-tab', 'admin-requests-tab', 'admin-sellers-tab', 'admin-orders-tab', 'admin-products-tab'].forEach((id) => {
            const button = document.getElementById(id);
            if (button) {
                button.classList.remove('is-active');
            }
        });

        const activeContent = document.getElementById(contentIds[tab]);
        const activeButton = document.getElementById(`admin-${tab}-tab`);

        if (activeContent) {
            activeContent.classList.remove('hidden');
        }

        if (activeButton) {
            activeButton.classList.add('is-active');
        }
    };

    window.renderCustomerOrdersDetailed = function(orders) {
        const ordersContainer = document.getElementById('profile-orders');
        if (!ordersContainer) return;

        if (!Array.isArray(orders) || orders.length === 0) {
            ordersContainer.innerHTML = buildEmptyPanel('No orders yet', 'Start shopping to see your latest purchases here.');
            return;
        }

        ordersContainer.innerHTML = orders.map((order) => `
            <div class="order-card border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex flex-col gap-4">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div class="flex items-center gap-3 flex-wrap">
                                <p class="text-lg font-bold text-gray-900">Order #${window.escapeHtml((order.order_uuid || '').slice(0, 8))}</p>
                                <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ${window.getStatusBadgeClasses(order.status)}">
                                    ${window.escapeHtml(String(order.status || 'unknown').toUpperCase())}
                                </span>
                            </div>
                            <p class="text-sm text-gray-500 mt-2">${window.formatDateTimeLabel(order.created_at)}</p>
                        </div>
                        <div class="text-left lg:text-right">
                            <p class="text-sm text-gray-500">Total</p>
                            <p class="text-xl font-bold text-blue-700">${formatCurrency(order.total_amount)}</p>
                            <p class="text-sm text-gray-500 mt-1">${window.escapeHtml(String(order.item_count || 0))} item(s)</p>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <button data-order-toggle="${order.order_uuid}" onclick="toggleOrderDetails('${order.order_uuid}')" class="px-4 py-2 bg-gray-200 text-gray-900 rounded-xl hover:bg-gray-300 transition font-semibold">
                            View Order
                        </button>
                        <button onclick="navigateTo('#order-tracking/${order.order_uuid}')" class="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold">
                            Track Order
                        </button>
                    </div>
                    <div id="order-details-${order.order_uuid}" class="hidden rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p class="text-xs uppercase tracking-wide text-gray-500 mb-3">Items in this order</p>
                        <div class="space-y-3">
                            ${(Array.isArray(order.items) ? order.items : []).map((item) => `
                                <div class="flex items-start justify-between gap-4 rounded-xl bg-white px-4 py-3 border border-gray-200">
                                    <div>
                                        <p class="font-semibold text-gray-900">${window.escapeHtml(item.product_name || 'Product')}</p>
                                        <p class="text-sm text-gray-500 mt-1">Qty: ${window.escapeHtml(String(item.quantity || 0))}</p>
                                    </div>
                                    <p class="font-bold text-gray-900">${formatCurrency(item.line_total ?? ((item.price_at_purchase || 0) * (item.quantity || 0)))}</p>
                                </div>
                            `).join('') || '<p class="text-sm text-gray-500">No item details available.</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    };

    window.toggleOrderDetails = function(orderUuid) {
        const details = document.getElementById(`order-details-${orderUuid}`);
        const toggleButton = document.querySelector(`[data-order-toggle="${orderUuid}"]`);
        if (!details) return;

        const isHidden = details.classList.contains('hidden');
        details.classList.toggle('hidden', !isHidden);

        if (toggleButton) {
            toggleButton.textContent = isHidden ? 'Hide Order' : 'View Order';
        }
    };

    window.closeAppModal = function() {
        document.querySelectorAll('.app-modal').forEach((modal) => modal.remove());
    };

    window.showPaymentSuccessNotification = function(orderUuid, emailStatus = '') {
        window.closeAppModal();

        const modal = document.createElement('div');
        modal.className = 'app-modal';
        modal.innerHTML = `
            <div class="app-modal-backdrop" onclick="closeAppModal()"></div>
            <div class="app-modal-card">
                <div class="app-modal-icon">E</div>
                <h2 class="text-3xl font-bold text-gray-900">Order placed successfully</h2>
                <p class="text-gray-600 mt-3">Your payment is complete and the order is now live in tracking.</p>
                <p class="text-sm text-gray-500 mt-3">Order ID: ${window.escapeHtml(orderUuid)}</p>
                <div class="app-modal-note">${window.escapeHtml(emailStatus || 'Confirmation and tracking updates are now being prepared.')}</div>
                <div class="app-modal-actions">
                    <button onclick="closeAppModal(); navigateTo('#order-tracking/${orderUuid}')" class="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold">
                        Track this order
                    </button>
                    <button onclick="closeAppModal(); navigateTo('#profile')" class="w-full px-4 py-3 bg-gray-200 text-gray-900 rounded-xl hover:bg-gray-300 transition font-semibold">
                        Go to profile
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    };

    window.addEventListener('hashchange', () => {
        window.syncNavigationState();
    });

    window.addEventListener('DOMContentLoaded', () => {
        window.updateUIBasedOnAuth();
        window.syncNavigationState();
    });
})();
