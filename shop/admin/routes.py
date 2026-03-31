from flask import Blueprint, request, jsonify
from shop.models import Category, User
from shop.extensions import db
from flask_jwt_extended import jwt_required, get_jwt_identity

admin_bp = Blueprint('admin_bd',__name__)

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
        
    # 3. Create new Category
    try:
        new_category = Category(
            name=name,
            description=description
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
    # Ye public endpoint ho sakta hai, taaki users/sellers categories dekh sakein
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