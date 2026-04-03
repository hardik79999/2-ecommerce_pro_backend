(() => {
    const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="320"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0" x2="1" y1="0" y2="1"%3E%3Cstop stop-color="%23dbeafe" /%3E%3Cstop offset="1" stop-color="%23cbd5e1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="100%25" height="100%25" rx="40" fill="url(%23g)" /%3E%3Cpath d="M78 226l68-74 48 52 42-30 70 52H78z" fill="%2394a3b8" /%3E%3Ccircle cx="118" cy="118" r="28" fill="%2393c5fd" /%3E%3C/svg%3E';

    const experienceState = {
        cartPulseItems: new Set(),
        addressEditorUuid: null,
    };

    function escapeMarkup(value) {
        if (typeof window.escapeHtml === 'function') {
            return window.escapeHtml(value);
        }

        return String(value ?? '').replace(/[&<>"']/g, (match) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        })[match]);
    }

    function formatMoney(amount) {
        return `Rs.${Number(amount || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    function applyColorScheme() {
        document.documentElement.style.colorScheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    }

    function getCartTotals(items = AppState?.cart || []) {
        const subtotal = (items || []).reduce((total, item) => total + (Number(item.itemTotal) || 0), 0);
        const itemCount = (items || []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);
        const shipping = subtotal > 500 ? 0 : (subtotal > 0 ? 50 : 0);

        return {
            subtotal,
            shipping,
            total: subtotal + shipping,
            itemCount,
        };
    }

    function getCartItemId(item) {
        return item?.cartItemUuid || item?.productUuid || '';
    }

    function hasCustomerCheckoutAccess() {
        if (typeof isCustomerSession === 'function') {
            return isCustomerSession();
        }

        return Boolean(AppState?.token && AppState?.user?.role === 'customer');
    }

    async function syncCartState() {
        if (typeof syncCustomerCart === 'function') {
            return syncCustomerCart();
        }

        if (typeof window.syncCustomerCart === 'function') {
            return window.syncCustomerCart();
        }

        return null;
    }

    function getItemImage(image) {
        try {
            return typeof window.buildImageUrl === 'function' ? window.buildImageUrl(image) : (image || FALLBACK_IMAGE);
        } catch (error) {
            return image || FALLBACK_IMAGE;
        }
    }

    function queueCartPulse(itemId) {
        if (!itemId) return;

        experienceState.cartPulseItems.add(itemId);
        window.setTimeout(() => {
            experienceState.cartPulseItems.delete(itemId);
            if (window.location.hash === '#cart') {
                ui?.renderCart?.();
            }
        }, 520);
    }

    function renderCartSkeleton() {
        const container = document.getElementById('cart-items');
        if (!container) return;

        container.innerHTML = `
            <div class="cart-loading-shell">
                ${Array.from({ length: 3 }, () => `
                    <div class="cart-loading-card">
                        <div class="cart-loading-media"></div>
                        <div class="space-y-3">
                            <div class="cart-loading-line short"></div>
                            <div class="cart-loading-line medium"></div>
                            <div class="cart-loading-line"></div>
                        </div>
                        <div class="space-y-3">
                            <div class="cart-loading-line short"></div>
                            <div class="cart-loading-line short"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderEmptyCart() {
        return `
            <div class="cart-empty-state">
                <div class="cart-empty-visual" aria-hidden="true">Cart</div>
                <h3>Your cart is empty</h3>
                <p>Add premium products to the cart and your live totals will appear here.</p>
                <button type="button" class="cart-secondary-cta" onclick="navigateTo('#products')" data-ripple>Continue Shopping</button>
            </div>
        `;
    }

    function renderCartItem(item) {
        const itemId = getCartItemId(item);
        const isPending = Boolean(item?.cartItemUuid && AppState.pendingCartItems.has(item.cartItemUuid));
        const isAnimated = experienceState.cartPulseItems.has(itemId);

        return `
            <article class="cart-item-card ${isPending ? 'is-pending' : ''} ${isAnimated ? 'is-animating' : ''}">
                <div class="cart-item-media">
                    <img src="${getItemImage(item.image)}" alt="${escapeMarkup(item.productName || 'Product')}" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
                    <div class="cart-item-fallback" style="display: none;">Item</div>
                </div>

                <div class="cart-item-body">
                    <div>
                        <h3 class="cart-item-title">${escapeMarkup(item.productName || 'Product')}</h3>
                        <p class="cart-item-meta">Unit price ${formatMoney(item.price)}${item.productUuid ? ` - ID ${escapeMarkup(String(item.productUuid).slice(0, 8))}` : ''}</p>
                    </div>

                    <div class="cart-item-controls">
                        <div class="cart-qty-stepper">
                            <button type="button" class="cart-qty-button" data-cart-action="decrease" data-cart-item="${escapeMarkup(itemId)}" ${isPending || !itemId ? 'disabled' : ''}>-</button>
                            <span class="cart-qty-value">${escapeMarkup(String(item.quantity || 0))}</span>
                            <button type="button" class="cart-qty-button" data-cart-action="increase" data-cart-item="${escapeMarkup(itemId)}" ${isPending || !itemId ? 'disabled' : ''}>+</button>
                        </div>
                        <button type="button" class="cart-remove-button" data-cart-action="remove" data-cart-item="${escapeMarkup(itemId)}" ${isPending || !itemId ? 'disabled' : ''}>
                            ${isPending ? 'Updating...' : 'Remove'}
                        </button>
                    </div>
                </div>

                <div class="cart-item-totals">
                    <strong class="cart-line-total">${formatMoney(item.itemTotal)}</strong>
                    <span class="cart-line-caption">${escapeMarkup(String(item.quantity || 0))} item(s)</span>
                </div>
            </article>
        `;
    }

    function renderCheckoutEmptySummary() {
        return `
            <div class="checkout-empty-message">
                <h3>No items yet</h3>
                <p>Add products to your cart before moving through checkout.</p>
            </div>
        `;
    }

    function getAddressByUuid(addressUuid) {
        return (Array.isArray(AppState.selectedAddresses) ? AppState.selectedAddresses : []).find((address) => address.uuid === addressUuid) || null;
    }

    function getAddressFormElements() {
        return {
            form: document.getElementById('address-form'),
            title: document.getElementById('address-form-title'),
            copy: document.getElementById('address-form-copy'),
            submit: document.getElementById('address-form-submit'),
            cancel: document.getElementById('address-form-cancel'),
            section: document.getElementById('add-new-address-section'),
        };
    }

    function fillAddressForm(address = {}) {
        const fieldMap = {
            'addr-name': address.full_name || '',
            'addr-phone': address.phone_number || '',
            'addr-street': address.street || '',
            'addr-city': address.city || '',
            'addr-state': address.state || '',
            'addr-pincode': address.pincode || '',
        };

        Object.entries(fieldMap).forEach(([id, value]) => {
            const field = document.getElementById(id);
            if (field) {
                field.value = value;
            }
        });
    }

    function focusAddressForm() {
        const { section } = getAddressFormElements();
        const nameField = document.getElementById('addr-name');

        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => nameField?.focus(), 180);
    }

    function updateAddressComposerUi() {
        const { title, copy, submit, cancel } = getAddressFormElements();
        const isEditing = Boolean(experienceState.addressEditorUuid);

        if (title) {
            title.textContent = isEditing ? 'Edit Address' : 'Add New Address';
        }

        if (copy) {
            copy.textContent = isEditing
                ? 'Update this saved delivery address and keep checkout in sync.'
                : 'Store another destination for future orders.';
        }

        if (submit) {
            submit.textContent = isEditing ? 'Update Address' : 'Save Address';
        }

        if (cancel) {
            cancel.classList.toggle('hidden', !isEditing);
        }
    }

    function resetAddressComposer(options = {}) {
        experienceState.addressEditorUuid = null;
        fillAddressForm();
        updateAddressComposerUi();

        if (options.focus) {
            focusAddressForm();
        }
    }

    function renderProfileAddressCards(addresses = []) {
        if (!Array.isArray(addresses) || addresses.length === 0) {
            return '<p class="text-gray-500 text-sm text-center">No addresses saved yet</p>';
        }

        return `
            <div class="profile-address-grid">
                ${addresses.map((address) => `
                    <article class="profile-address-card">
                        <strong>${escapeMarkup(address.full_name)}</strong>
                        <p>${escapeMarkup(address.street)}</p>
                        <p>${escapeMarkup(address.city)}, ${escapeMarkup(address.state)} - ${escapeMarkup(address.pincode)}</p>
                        <p>Phone ${escapeMarkup(address.phone_number)}</p>
                    </article>
                `).join('')}
            </div>
        `;
    }

    function renderSavedAddresses() {
        const container = document.getElementById('saved-addresses');
        if (!container) return;

        const addresses = Array.isArray(AppState.selectedAddresses) ? AppState.selectedAddresses : [];

        if (addresses.length === 0) {
            AppState.selectedAddress = null;
            container.innerHTML = `
                <div class="checkout-empty-message">
                    <h3>No saved addresses</h3>
                    <p>Add a shipping address below to unlock the payment step.</p>
                </div>
            `;
            updateAddressComposerUi();
            return;
        }

        if (!AppState.selectedAddress || !addresses.some((address) => address.uuid === AppState.selectedAddress)) {
            AppState.selectedAddress = addresses[0].uuid;
        }

        container.innerHTML = addresses.map((address) => {
            const isSelected = address.uuid === AppState.selectedAddress;
            return `
                <label class="checkout-address-option ${isSelected ? 'is-selected' : ''}">
                    <input type="radio" name="checkout_address_choice" value="${escapeMarkup(address.uuid)}" class="checkout-address-radio" ${isSelected ? 'checked' : ''}>
                    <span class="checkout-address-selection" aria-hidden="true"></span>
                    <div class="checkout-address-body">
                        <div class="checkout-address-topline">
                            <div class="checkout-address-title-stack">
                                <span class="checkout-address-title">${escapeMarkup(address.full_name)}</span>
                                <span class="checkout-address-tag">${isSelected ? 'Selected' : 'Saved'}</span>
                            </div>
                            <div class="checkout-address-actions">
                                <button
                                    type="button"
                                    class="checkout-address-action"
                                    aria-label="Edit address"
                                    title="Edit address"
                                    onclick="event.preventDefault(); event.stopPropagation(); editCheckoutAddress('${escapeMarkup(address.uuid)}')"
                                >
                                    <svg class="checkout-address-action-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 20h4l10-10-4-4L4 16v4z"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l4 4"></path>
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    class="checkout-address-action is-delete"
                                    aria-label="Delete address"
                                    title="Delete address"
                                    onclick="event.preventDefault(); event.stopPropagation(); deleteCheckoutAddress('${escapeMarkup(address.uuid)}')"
                                >
                                    <svg class="checkout-address-action-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.8">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 7h14"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 7V4h6v3"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7l1 12h6l1-12"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="checkout-address-line-group">
                            <p class="checkout-address-line">${escapeMarkup(address.street)}</p>
                            <p class="checkout-address-line">${escapeMarkup(address.city)}, ${escapeMarkup(address.state)} - ${escapeMarkup(address.pincode)}</p>
                        </div>
                        <p class="checkout-address-phone">Phone <span>${escapeMarkup(address.phone_number)}</span></p>
                    </div>
                </label>
            `;
        }).join('');

        updateAddressComposerUi();
    }

    function updateCheckoutSelectionStates() {
        document.querySelectorAll('.checkout-address-option').forEach((option) => {
            const input = option.querySelector('input[name="checkout_address_choice"]');
            option.classList.toggle('is-selected', Boolean(input?.checked));
            const tag = option.querySelector('.checkout-address-tag');
            if (tag) {
                tag.textContent = input?.checked ? 'Selected' : 'Saved';
            }
        });

        const paymentSection = document.getElementById('payment-section');
        if (paymentSection) {
            paymentSection.classList.toggle('hidden', !AppState.selectedAddress);
        }
    }

    function updatePaymentSelectionStates() {
        document.querySelectorAll('.payment-option-card').forEach((option) => {
            const input = option.querySelector('input[name="payment_method"]');
            option.classList.toggle('is-selected', Boolean(input?.checked));
        });

        const selectedMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';
        const noteTitle = document.getElementById('payment-method-note-title');
        const noteCopy = document.getElementById('payment-method-note-copy');

        if (!noteTitle || !noteCopy) {
            return;
        }

        if (selectedMethod === 'cod') {
            noteTitle.textContent = 'Cash on Delivery stays instant';
            noteCopy.textContent = 'COD places the order immediately. Card, UPI, and Netbanking now require a 6-digit email OTP before payment is completed.';
            return;
        }

        noteTitle.textContent = 'Online payments use OTP verification';
        noteCopy.textContent = `Your ${selectedMethod.toUpperCase()} order will pause for a secure email OTP step before payment is marked successful.`;
    }

    function syncGalleryAutoplay(resetManualStop = false) {
        window.setTimeout(() => {
            window.syncDetailGalleryAutoplay?.(resetManualStop);
        }, 140);
    }

    const baseToggleThemeMode = window.toggleThemeMode;
    if (typeof baseToggleThemeMode === 'function') {
        window.toggleThemeMode = function toggleThemeModeWithColorScheme() {
            baseToggleThemeMode();
            applyColorScheme();
        };
    }

    window.syncNavigationState = function syncNavigationState(path = window.location.hash || '#home') {
        const activeHash = String(path || '#home');
        let targetKey = activeHash.replace('#', '').split('/')[0] || 'home';

        if (targetKey === 'product' || targetKey === 'product-detail') {
            targetKey = 'products';
        }

        if (targetKey === 'checkout') {
            targetKey = 'cart';
        }

        if (targetKey === 'order-tracking') {
            targetKey = AppState.user?.role === 'admin' ? 'admin-dash' : 'profile';
        }

        if (targetKey === 'orders') {
            targetKey = 'profile';
        }

        [
            { key: 'products', ids: ['nav-products', 'mobile-nav-products'] },
            { key: 'cart', ids: ['nav-cart', 'mobile-nav-cart'] },
            { key: 'profile', ids: ['nav-profile', 'mobile-nav-profile'] },
            { key: 'seller-dash', ids: ['nav-seller', 'mobile-nav-seller'] },
            { key: 'admin-dash', ids: ['nav-admin', 'mobile-nav-admin'] },
        ].forEach((entry) => {
            entry.ids.forEach((id) => {
                const element = document.getElementById(id);
                if (element) {
                    element.classList.toggle('active', entry.key === targetKey);
                }
            });
        });
    };

    if (typeof ui !== 'undefined') {
        ui.renderCart = function renderCartPremium() {
            const container = document.getElementById('cart-items');
            if (!container) return;

            if (!Array.isArray(AppState.cart) || AppState.cart.length === 0) {
                container.innerHTML = renderEmptyCart();
                ui.renderCartSummary();
                return;
            }

            container.innerHTML = `
                <div class="cart-item-list">
                    ${AppState.cart.map((item) => renderCartItem(item)).join('')}
                </div>
            `;

            ui.renderCartSummary();
        };

        ui.renderCartSummary = function renderCartSummaryPremium() {
            const totals = getCartTotals(AppState.cart);
            const summaryBadge = document.getElementById('cart-summary-badge');
            const itemCount = document.getElementById('cart-item-count');
            const deliveryNote = document.getElementById('cart-delivery-note');
            const subtotal = document.getElementById('cart-subtotal');
            const shipping = document.getElementById('cart-shipping');
            const total = document.getElementById('cart-total');
            const checkoutCta = document.getElementById('cart-checkout-cta');

            if (summaryBadge) {
                summaryBadge.textContent = `${totals.itemCount} item${totals.itemCount === 1 ? '' : 's'}`;
            }
            if (itemCount) {
                itemCount.textContent = String(totals.itemCount);
            }
            if (deliveryNote) {
                deliveryNote.textContent = totals.itemCount === 0
                    ? 'Awaiting items'
                    : (totals.shipping === 0 ? 'Free shipping' : formatMoney(totals.shipping));
            }
            if (subtotal) {
                subtotal.textContent = formatMoney(totals.subtotal);
            }
            if (shipping) {
                shipping.textContent = totals.shipping === 0 ? 'FREE' : formatMoney(totals.shipping);
            }
            if (total) {
                total.textContent = formatMoney(totals.total);
            }
            if (checkoutCta) {
                checkoutCta.disabled = totals.itemCount === 0;
            }
        };

        ui.renderCheckoutSummary = function renderCheckoutSummaryPremium() {
            const container = document.getElementById('checkout-summary');
            const total = document.getElementById('checkout-total');
            if (!container || !total) return;

            if (!Array.isArray(AppState.cart) || AppState.cart.length === 0) {
                container.innerHTML = renderCheckoutEmptySummary();
                total.textContent = formatMoney(0);
                return;
            }

            const totals = getCartTotals(AppState.cart);

            container.innerHTML = `
                ${AppState.cart.map((item) => `
                    <div class="checkout-summary-row">
                        <div>
                            <p class="checkout-summary-item">${escapeMarkup(item.productName || 'Product')}</p>
                            <p class="checkout-summary-copy">Qty ${escapeMarkup(String(item.quantity || 0))} - ${formatMoney(item.price)}</p>
                        </div>
                        <strong class="checkout-summary-value">${formatMoney(item.itemTotal)}</strong>
                    </div>
                `).join('')}
                <div class="checkout-summary-row">
                    <div>
                        <p class="checkout-summary-item">Subtotal</p>
                        <p class="checkout-summary-label">Before shipping</p>
                    </div>
                    <strong class="checkout-summary-value">${formatMoney(totals.subtotal)}</strong>
                </div>
                <div class="checkout-summary-row">
                    <div>
                        <p class="checkout-summary-item">Shipping</p>
                        <p class="checkout-summary-label">${totals.shipping === 0 ? 'Free delivery unlocked' : 'Standard delivery'}</p>
                    </div>
                    <strong class="checkout-summary-value">${totals.shipping === 0 ? 'FREE' : formatMoney(totals.shipping)}</strong>
                </div>
            `;

            total.textContent = formatMoney(totals.total);
        };

        ui.renderAddresses = function renderAddressesPremium(addresses, options = {}) {
            const container = document.getElementById('profile-addresses');
            if (!container) return;

            if (options.message) {
                container.innerHTML = `<p class="text-gray-500 text-sm text-center py-6">${escapeMarkup(options.message)}</p>`;
                return;
            }

            container.innerHTML = renderProfileAddressCards(addresses);
        };
    }

    const baseUpdateCartQuantity = window.updateCartQuantity;
    if (typeof baseUpdateCartQuantity === 'function') {
        window.updateCartQuantity = async function updateCartQuantityWithPulse(cartItemUuid, delta) {
            queueCartPulse(cartItemUuid);
            return baseUpdateCartQuantity(cartItemUuid, delta);
        };
    }

    const baseRemoveFromCart = window.removeFromCart;
    if (typeof baseRemoveFromCart === 'function') {
        window.removeFromCart = async function removeFromCartWithPulse(cartItemUuid) {
            queueCartPulse(cartItemUuid);
            return baseRemoveFromCart(cartItemUuid);
        };
    }

    window.loadCart = async function loadCartPremium() {
        renderCartSkeleton();
        if (hasCustomerCheckoutAccess()) {
            await syncCartState();
        }
        ui?.renderCart?.();
    };

    window.beginAddressCreate = function beginAddressCreate() {
        resetAddressComposer({ focus: true });
    };

    window.editCheckoutAddress = function editCheckoutAddress(addressUuid) {
        const address = getAddressByUuid(addressUuid);
        if (!address) {
            window.showToast?.('Address details could not be found.', 'error');
            return;
        }

        experienceState.addressEditorUuid = addressUuid;
        fillAddressForm(address);
        updateAddressComposerUi();
        focusAddressForm();
    };

    window.deleteCheckoutAddress = async function deleteCheckoutAddress(addressUuid) {
        const address = getAddressByUuid(addressUuid);
        if (!address) {
            window.showToast?.('Address details could not be found.', 'error');
            return;
        }

        const confirmed = window.confirm(`Delete the saved address for ${address.full_name}?`);
        if (!confirmed) {
            return;
        }

        const response = await API.deleteAddress(addressUuid);
        if (!response) {
            return;
        }

        if (experienceState.addressEditorUuid === addressUuid) {
            resetAddressComposer();
        }

        if (AppState.selectedAddress === addressUuid) {
            AppState.selectedAddress = null;
        }

        window.showToast?.(response.message || 'Address deleted successfully!', 'success');
        await window.loadCheckout();
    };

    window.handleAddAddress = async function handleAddAddressPremium(event) {
        event.preventDefault();

        const form = event.target;
        const submitButton = document.getElementById('address-form-submit');
        const addressData = {
            full_name: (document.getElementById('addr-name')?.value || '').trim(),
            phone_number: (document.getElementById('addr-phone')?.value || '').trim(),
            street: (document.getElementById('addr-street')?.value || '').trim(),
            city: (document.getElementById('addr-city')?.value || '').trim(),
            state: (document.getElementById('addr-state')?.value || '').trim(),
            pincode: (document.getElementById('addr-pincode')?.value || '').trim(),
        };

        if (!addressData.full_name || !addressData.phone_number || !addressData.street || !addressData.city || !addressData.state || !addressData.pincode) {
            window.showToast?.('Please fill in all address fields', 'warning');
            return;
        }

        const editingUuid = experienceState.addressEditorUuid;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = editingUuid ? 'Updating...' : 'Saving...';
        }

        try {
            const response = editingUuid
                ? await API.updateAddress(editingUuid, addressData)
                : await API.saveAddress(addressData);

            if (!response) {
                return;
            }

            AppState.selectedAddress = response.address_uuid || editingUuid || AppState.selectedAddress;
            form.reset();
            resetAddressComposer();
            window.showToast?.(editingUuid ? 'Address updated successfully!' : 'Address saved successfully!', 'success');
            await window.loadCheckout();
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
            updateAddressComposerUi();
        }
    };

    window.selectAddress = function selectAddressPremium(addressUuid) {
        AppState.selectedAddress = addressUuid;
        renderSavedAddresses();
        updateCheckoutSelectionStates();
    };

    window.loadCheckout = async function loadCheckoutPremium() {
        if (!hasCustomerCheckoutAccess()) {
            window.showToast?.('Only customers can access checkout', 'error');
            window.navigateTo?.('#login');
            return;
        }

        const pendingPayment = window.loadPendingPaymentVerification?.();
        await syncCartState();
        if ((!Array.isArray(AppState.cart) || AppState.cart.length === 0) && !pendingPayment) {
            window.showToast?.('Your cart is empty', 'warning');
            window.navigateTo?.('#cart');
            return;
        }

        const response = await API.fetchProfile();
        AppState.selectedAddresses = response?.user?.addresses || [];

        if (experienceState.addressEditorUuid) {
            const editingAddress = getAddressByUuid(experienceState.addressEditorUuid);
            if (editingAddress) {
                fillAddressForm(editingAddress);
            } else {
                resetAddressComposer();
            }
        } else {
            updateAddressComposerUi();
        }

        renderSavedAddresses();
        updateCheckoutSelectionStates();
        updatePaymentSelectionStates();
        ui?.renderCheckoutSummary?.();
        window.reopenPendingPaymentOtp?.();
    };

    document.addEventListener('click', (event) => {
        const cartAction = event.target.closest('[data-cart-action]');
        if (cartAction && cartAction.closest('#cart-items')) {
            const itemId = cartAction.dataset.cartItem;
            const action = cartAction.dataset.cartAction;
            if (!itemId || cartAction.disabled) {
                return;
            }

            if (action === 'increase') {
                window.updateCartQuantity?.(itemId, 1);
            } else if (action === 'decrease') {
                window.updateCartQuantity?.(itemId, -1);
            } else if (action === 'remove') {
                window.removeFromCart?.(itemId);
            }
        }

        const detailThumb = event.target.closest('#detail-images-grid .detail-thumb');
        if (detailThumb) {
            window.stopDetailGalleryAutoplay?.();
        }
    });

    document.addEventListener('change', (event) => {
        const addressInput = event.target.closest('input[name="checkout_address_choice"]');
        if (addressInput) {
            window.selectAddress?.(addressInput.value);
        }

        if (event.target.matches('input[name="payment_method"]')) {
            updatePaymentSelectionStates();
        }
    });

    window.addEventListener('hashchange', () => {
        if (!window.location.hash.startsWith('#product/')) {
            window.resetDetailGalleryAutoplay?.();
        } else {
            syncGalleryAutoplay(true);
        }

        if (window.location.hash.startsWith('#checkout')) {
            window.setTimeout(() => {
                window.reopenPendingPaymentOtp?.();
            }, 100);
        } else {
            window.closePaymentOtpModal?.();
        }

        window.syncNavigationState?.();
    });

    document.addEventListener('DOMContentLoaded', () => {
        applyColorScheme();
        new MutationObserver(applyColorScheme).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });

        const galleryGrid = document.getElementById('detail-images-grid');
        if (galleryGrid) {
            new MutationObserver(() => {
                syncGalleryAutoplay(true);
            }).observe(galleryGrid, { childList: true, subtree: true });
        }

        updateAddressComposerUi();
        updatePaymentSelectionStates();
        window.syncNavigationState?.();
    });
})();
