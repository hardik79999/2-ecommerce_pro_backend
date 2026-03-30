import uuid
import enum  # Enum ke liye naya import
from datetime import datetime
from shop.extensions import db

# ===================================================================================================================
# ENUM (For setting strict options in the database)
# ===================================================================================================================

class OrderStatus(enum.Enum):
    pending = 'pending'
    processing = 'processing'
    shipped = 'shipped'
    delivered = 'delivered'
    cancelled = 'cancelled'

class OTPAction(enum.Enum):
    seller_setup = 'seller_setup'
    order_confirm = 'order_confirm'
    password_reset = 'password_reset'

# ===================================================================================================================
# MODELS
# ===================================================================================================================

class Role(db.Model):
    # Tablename will automatically be 'role'
    id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(db.String(50), nullable=False, unique=True)
    
    # Soft delete
    is_active = db.Column(db.Boolean, default=True) 
    
    #1: A single role can be assigned to multiple users.
    users = db.relationship('User', backref='role', lazy=True)

    def __repr__(self):
        return f"<Role {self.role_name}>"

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    public_id = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(15), unique=True, nullable=True)
    
    # 'Role' is no longer a string; it will now link directly to the 'Role' table.
    role_id = db.Column(db.Integer, db.ForeignKey('role.id'), nullable=False) 
    
    is_active = db.Column(db.Boolean, default=True)
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # RELATIONSHIPS
    products = db.relationship('Product', backref='seller', lazy=True)
    orders = db.relationship('Order', backref='customer', lazy=True)

    def __repr__(self):
        return f"<User {self.username}>"

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    
    # To hide the category
    is_active = db.Column(db.Boolean, default=True)

    products = db.relationship('Product', backref='category', lazy=True)

    def __repr__(self):
        return f"<Category {self.name}>"

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    public_id = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, default=0)
    
    # To hide/unhide the product
    is_active = db.Column(db.Boolean, default=True)

    # FOREIGN KEYS
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Product {self.name} - ₹{self.price}>"

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    public_id = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    
   # Use of enum in status column
    status = db.Column(db.Enum(OrderStatus), default=OrderStatus.pending) 
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Order {self.public_id} - Status: {self.status.value}>"