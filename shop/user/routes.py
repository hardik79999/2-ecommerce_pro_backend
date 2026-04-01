from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from shop.models import User
from shop.extensions import db

from shop.models import Product, ProductImage, Category

user_bp = Blueprint('user', __name__)

@user_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():

    uuid = get_jwt_identity()

    
    user = User.query.filter_by(uuid=uuid).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "message": "Welcome to your protected profile!",
        "user_data": {
            "uuid": user.uuid,
            "username": user.username,
            "email": user.email,
            "phone": user.phone,
            "role": user.role.role_name,
            "is_active": user.is_active,
            "is_verified": user.is_verified
        }
    }), 200




@user_bp.route('/products', methods=['GET'])
def get_public_products():
    # MAGIC QUERY: Humne join pehle hi lagaya hua hai seller status check karne ke liye
    products = Product.query.join(User, Product.seller_id == User.id)\
        .filter(Product.is_active == True, User.is_active == True).all()
    
    result = []
    for prod in products:
        # Har product ke specs nikal lo
        specs = [{"key": s.spec_key, "value": s.spec_value} for s in prod.specifications if s.is_active]
        
        primary_image = ProductImage.query.filter_by(product_id=prod.id, is_primary=True).first()
        
        result.append({
            "uuid": prod.uuid,
            "name": prod.name,
            "price": prod.price,
            "category": prod.category.name,
            "seller": prod.seller_user.username, 
            "primary_image": primary_image.image_url if primary_image else None,
            "specifications": specs # 👈 List view me bhi specs add kar diye
        })
        
    return jsonify({
        "total_products": len(result),
        "products": result
    }), 200





#================================================================================================================
#================================================================================================================

from flask import request
from shop.models import CartItem

# Helper decorator to ensure the user is a 'customer'
def customer_required(fn):
    @jwt_required()
    def wrapper(*args, **kwargs):
        current_user_uuid = get_jwt_identity()
        user = User.query.filter_by(uuid=current_user_uuid, is_active=True).first()
        
        if not user or user.role.role_name != 'customer':
            return jsonify({"error": "Unauthorized access. Customer privileges required."}), 403
            
        return fn(current_customer=user, *args, **kwargs)
    
    wrapper.__name__ = fn.__name__
    return wrapper

#================================================================================================================
#================================================================================================================

@user_bp.route('/cart', methods=['POST'])
@customer_required
def add_to_cart(current_customer):
    data = request.get_json()
    product_uuid = data.get('product_uuid')
    quantity = data.get('quantity', 1)
    
    if not product_uuid:
        return jsonify({"error": "Product UUID is required"}), 400
        
    product = Product.query.filter_by(uuid=product_uuid, is_active=True).first()
    if not product:
        return jsonify({"error": "Product not found or inactive"}), 404
        
    if product.stock < quantity:
         return jsonify({"error": f"Only {product.stock} items left in stock"}), 400

    try:
        # Check if item is already in cart AND is active
        existing_cart_item = CartItem.query.filter_by(
            user_id=current_customer.id, 
            product_id=product.id,
            is_active=True  # 👈 Sirf active items check karega
        ).first()
        
        if existing_cart_item:
            new_quantity = existing_cart_item.quantity + quantity
            if new_quantity > product.stock:
                 return jsonify({"error": "Cannot add more. Exceeds available stock."}), 400
            existing_cart_item.quantity = new_quantity
            existing_cart_item.updated_by = current_customer.id # 👈 Audit Trail Update
            message = "Cart item quantity updated"
        else:
            new_cart_item = CartItem(
                user_id=current_customer.id,
                product_id=product.id,
                quantity=quantity,
                created_by=current_customer.id, # 👈 Audit Trail Create
                updated_by=current_customer.id  # 👈 Audit Trail Create
            )
            db.session.add(new_cart_item)
            message = "Product added to cart"
            
        db.session.commit()
        return jsonify({"message": message}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to add to cart", "details": str(e)}), 500


@user_bp.route('/cart', methods=['GET'])
@customer_required
def view_cart(current_customer):
    # 👈 Sirf wo items lao jo is_active=True hain
    cart_items = CartItem.query.filter_by(user_id=current_customer.id, is_active=True).all()
    
    result = []
    cart_total = 0
    
    for item in cart_items:
        primary_image = ProductImage.query.filter_by(product_id=item.product.id, is_primary=True).first()
        img_url = primary_image.image_url if primary_image else None
        
        item_total = item.product.price * item.quantity
        cart_total += item_total
        
        result.append({
            "cart_item_uuid": item.uuid,
            "product_name": item.product.name,
            "product_uuid": item.product.uuid,
            "price": item.product.price,
            "quantity": item.quantity,
            "item_total": item_total,
            "image": img_url
        })
        
    return jsonify({
        "cart_total": cart_total,
        "items": result
    }), 200


#================================================================================================================
#================================================================================================================


from shop.models import Address

@user_bp.route('/address', methods=['POST'])
@customer_required
def add_address(current_customer):
    data = request.get_json()
    
    # Validation (full_name aur phone_number add kiye)
    required = ['full_name', 'phone_number', 'street', 'city', 'state', 'pincode']
    if not all(k in data for k in required):
        return jsonify({"error": "Missing address details. Required: full_name, phone_number, street, city, state, pincode"}), 400
        
    try:
        new_address = Address(
            user_id=current_customer.id,
            full_name=data.get('full_name'),        
            phone_number=data.get('phone_number'), 
            street=data.get('street'),
            city=data.get('city'),
            state=data.get('state'),
            pincode=data.get('pincode'),
            is_default=data.get('is_default', False)
        )
        db.session.add(new_address)
        db.session.commit()
        
        return jsonify({
            "message": "Address saved successfully",
            "address_uuid": new_address.uuid
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


#+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

from shop.models import Order, OrderItem

@user_bp.route('/checkout', methods=['POST'])
@customer_required
def checkout(current_customer):
    data = request.get_json()
    address_uuid = data.get('address_uuid')
    
    address = Address.query.filter_by(uuid=address_uuid, user_id=current_customer.id).first()
    if not address:
        return jsonify({"error": "Invalid delivery address"}), 404
        
    # 👈 Sirf active cart items ko checkout process me lo
    cart_items = CartItem.query.filter_by(user_id=current_customer.id, is_active=True).all()
    if not cart_items:
        return jsonify({"error": "Cart is empty"}), 400
        
    total_amount = 0
    order_items_to_create = []

    try:
        for item in cart_items:
            if item.product.stock < item.quantity:
                return jsonify({"error": f"Product {item.product.name} out of stock!"}), 400
            
            item_total = item.product.price * item.quantity
            total_amount += item_total
            
            order_items_to_create.append({
                "product_id": item.product.id,
                "quantity": item.quantity,
                "price_at_purchase": item.product.price
            })

        new_order = Order(
            user_id=current_customer.id,
            address_id=address.id,
            total_amount=total_amount,
            status='pending',
            created_by=current_customer.id, # 👈 Audit Trail
            updated_by=current_customer.id  # 👈 Audit Trail
        )
        db.session.add(new_order)
        db.session.flush()

        for oi in order_items_to_create:
            order_item = OrderItem(
                order_id=new_order.id,
                product_id=oi['product_id'],
                quantity=oi['quantity'],
                price_at_purchase=oi['price_at_purchase'],
                created_by=current_customer.id, # 👈 Audit Trail
                updated_by=current_customer.id  # 👈 Audit Trail
            )
            db.session.add(order_item)
            
            prod = Product.query.get(oi['product_id'])
            prod.stock -= oi['quantity']

        # 🚀 SOFT DELETE LOGIC (Hard delete hata diya)
        for item in cart_items:
            item.is_active = False # 👈 Soft Delete
            item.updated_by = current_customer.id # Kisne delete kiya
        
        db.session.commit()
        
        return jsonify({
            "message": "Order placed successfully!",
            "order_uuid": new_order.uuid,
            "total_payable": total_amount
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Transaction failed", "details": str(e)}), 500
#+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
import random
import string
from shop.models import Payment, Invoice, Order, OrderTracking, OrderStatus, PaymentStatus, PaymentMethod # 👈 PaymentMethod import karna mat bhulna

@user_bp.route('/payment', methods=['POST'])
@customer_required
def process_payment(current_customer):
    data = request.get_json()
    order_uuid = data.get('order_uuid')
    payment_method_str = data.get('payment_method') # Postman se aayi hui string

    if not order_uuid or not payment_method_str:
        return jsonify({"error": "order_uuid and payment_method are required"}), 400

    # =========================================================================
    # 🛡️ STRICT VALIDATION: Check if payment method is valid
    # =========================================================================
    valid_methods = [m.name for m in PaymentMethod] # Ye list banayega: ['cod', 'card', 'upi', 'netbanking']
    
    # Lowercase me convert karke check kar rahe hain taaki 'UPI', 'Upi', 'upi' sab chal jaye
    if payment_method_str.lower() not in valid_methods:
        return jsonify({
            "error": "Invalid Payment Method",
            "message": f"Aapne '{payment_method_str}' select kiya hai jo ki galat hai. Kripya allowed options me se kuch chunein.",
            "allowed_options": valid_methods # Ye user ko options dikha dega
        }), 400
        
    payment_method_clean = payment_method_str.lower()
    # =========================================================================

    # 1. Order dhundho
    order = Order.query.filter_by(uuid=order_uuid, user_id=current_customer.id).first()
    if not order:
        return jsonify({"error": "Order not found"}), 404

    # =========================================================================
    # 🛡️ DOUBLE PAYMENT PREVENTION LOGIC
    # =========================================================================
    # Check 1: Agar order 'pending' nahi hai (yani processing, shipped ya delivered hai)
    if order.status != OrderStatus.pending:
        return jsonify({
            "error": "Payment Already Completed",
            "message": f"Payment for this order has already been made (Current Status: {order.status.name.capitalize()}). There is no need to make a payment again."
        }), 400

    # Check 2: Database mein directly Payment table check karo (Extra Safety)
    existing_payment = Payment.query.filter_by(order_id=order.id, status=PaymentStatus.completed).first()
    if existing_payment:
        return jsonify({
            "error": "Payment Already Completed",
            "message": f"Is order ka payment system mein already darj hai (TXN ID: {existing_payment.transaction_id})."
        }), 400
    # =========================================================================

    if order.status == OrderStatus.processing:
        return jsonify({"error": "Order is already paid and being processed"}), 400

    try:
        # --- TRANSACTION START ---
        
        # 2. Payment Record Create Karo
        txn_id = "TXN-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=10))
        payment_status = PaymentStatus.completed 
        
        new_payment = Payment(
            order_id=order.id,
            user_id=current_customer.id,
            transaction_id=txn_id if payment_method_clean != 'cod' else None,
            payment_method=payment_method_clean, # 👈 Cleaned string yahan use ki hai
            amount=order.total_amount,
            status=payment_status,
            created_by=current_customer.id, 
            updated_by=current_customer.id,
            is_active=True
        )
        db.session.add(new_payment)

        # 3. Order Table Update 
        order.status = OrderStatus.processing
        order.updated_by = current_customer.id

        # 4. ORDER TRACKING 
        new_tracking = OrderTracking(
            order_id=order.id,
            status=OrderStatus.processing,
            message=f"Payment via {payment_method_clean.upper()} Successful. Your order is now being processed.",
            created_by=current_customer.id,
            updated_by=current_customer.id,
            is_active=True
        )
        db.session.add(new_tracking)

        # 5. Invoice Generate Karo
        inv_number = f"INV-{order.id}-{random.randint(1000, 9999)}"
        new_invoice = Invoice(
            order_id=order.id,
            invoice_number=inv_number,
            created_by=current_customer.id,
            updated_by=current_customer.id,
            is_active=True
        )
        db.session.add(new_invoice)

        db.session.commit()
        # --- TRANSACTION END ---

        return jsonify({
            "message": "Payment Successful! Order tracking is now active.",
            "data": {
                "order_status": order.status.name,
                "transaction_id": txn_id if payment_method_clean != 'cod' else "N/A",
                "invoice_number": inv_number,
                "payment_method": payment_method_clean
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Payment failed", "details": str(e)}), 500

#+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

from shop.models import Order

@user_bp.route('/order/<order_uuid>/track', methods=['GET'])
@customer_required
def track_order(current_customer, order_uuid):
    # 1. Find Order (Ensure ye isi customer ka order hai)
    order = Order.query.filter_by(uuid=order_uuid, user_id=current_customer.id).first()
    
    if not order:
        return jsonify({"error": "Order not found or access denied"}), 404
        
    # 2. Format Tracking History
    tracking_history = []
    
    # Check if order has tracking details
    if order.tracking:
        for track in order.tracking:
            tracking_history.append({
                "status": track.status.name,
                "message": track.message,
                "timestamp": track.updated_at.strftime("%Y-%m-%d %H:%M:%S")
            })
    else:
        # Agar koi tracking update nahi hua, toh default current status dikhao
        tracking_history.append({
            "status": order.status.name,
            "message": "Order placed successfully.",
            "timestamp": order.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
        
    return jsonify({
        "order_uuid": order.uuid,
        "current_status": order.status.name,
        "total_amount": order.total_amount,
        "tracking_history": tracking_history
    }), 200

#+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
