from flask import Blueprint, request, jsonify
from shop.models import Category, User, Role
from shop.extensions import db
from flask_jwt_extended import jwt_required, get_jwt_identity

admin_bp = Blueprint('admin_bp',__name__)

# ==============================================================================
# 🛡️ HELPER DECORATOR: Check if user is Admin
# ==============================================================================
def admin_required(fn):
    @jwt_required()
    def wrapper(*args, **kwargs):
        current_user_uuid = get_jwt_identity()
        user = User.query.filter_by(uuid=current_user_uuid, is_active=True).first()
        
        if not user or user.role.role_name != 'admin':
            return jsonify({"error": "Unauthorized access. Admin privileges required."}), 403
            
        return fn(*args, **kwargs)
    
    # endpoint names not mix 
    wrapper.__name__ = fn.__name__
    return wrapper

# ==============================================================================
# 🗂️ CATEGORY APIs (Admin Only)
# ==============================================================================

@admin_bp.route('/category', methods=['POST'])
@admin_required
def create_category():
    data = request.get_json()
    
    # 1. Validation: Check if name is provided
    if not data or not data.get('name'):
        return jsonify({"error": "Category name is required"}), 400
        
    name = data.get('name')
    description = data.get('description', '') # Optional
    
    # 2. Check if category already exists
    existing_category = Category.query.filter_by(name=name).first()
    if existing_category:
        return jsonify({"error": f"Category '{name}' already exists"}), 409
    
    current_user_uuid = get_jwt_identity()
    admin_user = User.query.filter_by(uuid=current_user_uuid).first()
        
    # 3. Create new Category
    try:
        new_category = Category(
            name=name,
            description=description,
            created_by=admin_user.id 
            # is_active default True hai models me
        )
        db.session.add(new_category)
        db.session.commit()
        
        return jsonify({
            "message": "Category created successfully",
            "category": {
                "uuid": new_category.uuid,
                "name": new_category.name,
                "description": new_category.description,
                "is_active": new_category.is_active
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create category", "details": str(e)}), 500



@admin_bp.route('/categories', methods=['GET'])
def get_all_categories():

    categories = Category.query.filter_by(is_active=True).all()
    
    result = []
    for cat in categories:
        result.append({
            "uuid": cat.uuid,
            "name": cat.name,
            "description": cat.description
        })
        
    return jsonify({
        "total": len(result),
        "categories": result
    }), 200


#=======================================================================================================================
#=======================================================================================================================

# 1. Get All Sellers API
@admin_bp.route('/sellers', methods=['GET'])
@admin_required
def get_all_sellers():
    seller_role = Role.query.filter_by(role_name='seller').first()
    sellers = User.query.filter_by(role_id=seller_role.id).all()
    
    result = []
    for seller in sellers:
        result.append({
            "uuid": seller.uuid,
            "username": seller.username,
            "email": seller.email,
            "phone": seller.phone,
            "is_active": seller.is_active,  # Ye dekh kar admin ko pata chalega kon active hai
            "is_verified": seller.is_verified,
            "joined_at": seller.created_at
        })
        
    return jsonify({
        "total_sellers": len(result),
        "sellers": result
    }), 200


# 2. Toggle Seller Status API (Active/Deactive)
@admin_bp.route('/seller/<seller_uuid>/status', methods=['PUT'])
@admin_required
def toggle_seller_status(seller_uuid):
    seller = User.query.filter_by(uuid=seller_uuid).first()
    
    if not seller or seller.role.role_name != 'seller':
        return jsonify({"error": "Seller not found"}), 404
        
    # Toggle the status (True ko False, False ko True kar dega)
    seller.is_active = not seller.is_active
    db.session.commit()
    
    action = "Activated" if seller.is_active else "Deactivated"
    
    return jsonify({
        "message": f"Seller '{seller.username}' has been {action} successfully.",
        "current_status": "Active" if seller.is_active else "Deactive"
    }), 200


#=======================================================================================================================
#=======================================================================================================================


from shop.models import Order, OrderTracking, OrderStatus

@admin_bp.route('/order/<order_uuid>/status', methods=['PUT'])
@admin_required
def update_order_status(order_uuid):
    data = request.get_json()
    new_status_str = data.get('status') # e.g., 'shipped', 'delivered'
    message = data.get('message', '')   # e.g., 'Dispatched via BlueDart AWB: 12345'
    
    if not new_status_str:
        return jsonify({"error": "Status is required"}), 400
        
    # 1. Find Order
    order = Order.query.filter_by(uuid=order_uuid).first()
    if not order:
        return jsonify({"error": "Order not found"}), 404
        
    # 2. Validate Enum Status
    try:
        new_status = OrderStatus[new_status_str.lower()]
    except KeyError:
        valid_statuses = [e.name for e in OrderStatus]
        return jsonify({"error": f"Invalid status. Must be one of: {valid_statuses}"}), 400
        
    # 3. Update Order and Add Tracking Record
    try:
        # Update main order status
        order.status = new_status
        
        # Add tracking history
        tracking_entry = OrderTracking(
            order_id=order.id,
            status=new_status,
            message=message
        )
        db.session.add(tracking_entry)
        db.session.commit()
        
        return jsonify({
            "message": f"Order status updated to {new_status.name}",
            "tracking_message": message
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to update status", "details": str(e)}), 500