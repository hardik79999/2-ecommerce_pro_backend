from flask import Blueprint, request, jsonify
from shop.extensions import db, bcrypt
from shop.models import User, Role
from flask_jwt_extended import create_access_token
from datetime import timedelta

# Naya email service import
from shop.utils.email_service import send_verification_email, verify_token

# Auth Blueprint create
auth_bp = Blueprint('auth', __name__)

# ===========================================================================================================================
# 📝 SIGNUP ROUTE
# ===========================================================================================================================
@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    phone = data.get('phone')
    
    # NAYA: Role input lena (Default: 'customer')
    requested_role = data.get('role', 'customer').lower() 

    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are required!"}), 400
        
    if requested_role not in ['customer', 'seller']:
        return jsonify({"error": "Invalid role. Must be 'customer' or 'seller'."}), 400

    existing_user = User.query.filter((User.email == email) | (User.username == username)).first()
    if existing_user:
        return jsonify({"error": "User with this email or username already exists!"}), 409

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    # Assign dynamic role
    user_role = Role.query.filter_by(role_name=requested_role).first()
    if not user_role:
        return jsonify({"error": "System roles not initialized"}), 500

    new_user = User(
        username=username,
        email=email,
        password=hashed_password,
        phone=phone,
        role_id=user_role.id,
        is_active=True,
        is_verified=False # 👈 Default False hona chahiye
    )
    db.session.add(new_user)
    db.session.commit()

    # Email Logic (Active kar diya)
    try:
        # User ko verification mail bhej do
        send_verification_email(new_user.email)
        
        # Agar seller hai, toh (Future scope ke liye print daal diya, tum chaho toh admin ko mail likh sakte ho)
        if requested_role == 'seller':
            print(f"📧 ALERT TO ADMIN: New Seller Registered -> {username} ({email})")
            
        email_status = "Verification email sent!"
    except Exception as e:
        print(f"Email failed to send: {e}")
        email_status = "Account created, but failed to send verification email."

    return jsonify({
        "message": f"{requested_role.capitalize()} registered successfully! Please check your email to verify.", 
        "email_status": email_status
    }), 201

# ===========================================================================================================================
# 🔐 LOGIN ROUTE
# ===========================================================================================================================
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"error": "Invalid email or password"}), 401
    
    # 🛡️ GATEKEEPER 1: Active check
    if not user.is_active:
        return jsonify({"error": "Your account has been deactivated. Contact support."}), 403

    # 🛡️ GATEKEEPER 2: Verification check (YE NAHI THA PEHLE)
    if not user.is_verified:
        return jsonify({"error": "Account not verified. Please check your email for the verification link."}), 403
    
    access_token = create_access_token(
        identity=str(user.uuid), 
        additional_claims={"role": user.role.role_name},
        expires_delta=timedelta(days=1)
    )

    return jsonify({
        "message": "Login successful!",
        "access_token": access_token,
        "user": {
            "uuid": user.uuid,
            "username": user.username,
            "email": user.email,
            "role": user.role.role_name
        }
    }), 200

# ===========================================================================================================================
# ✅ VERIFY EMAIL ROUTE
# ===========================================================================================================================
@auth_bp.route('/verify-email/<token>', methods=['GET'])
def verify_email(token):
    email = verify_token(token)
    
    if not email:
        return jsonify({"error": "The verification link is invalid or has expired."}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found."}), 404
    
    if user.is_verified:
        return jsonify({"message": "Account is already verified. You can login now."}), 200
        
    # User ka verification status update karna
    user.is_verified = True
    db.session.commit()
    
    return jsonify({"message": "Email verified successfully! Your account is now active and you can login."}), 200