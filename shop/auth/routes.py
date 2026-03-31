from flask import Blueprint, request, jsonify
from shop.extensions import db, bcrypt
from shop.models import User
from flask_jwt_extended import create_access_token
from datetime import timedelta
from shop.models import User, Role

#email
from shop.utils.email_service import send_verification_email, verify_token

# Auth Blueprint create
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    phone = data.get('phone')

    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are required!"}), 400

    existing_user = User.query.filter((User.email == email) | (User.username == username)).first()
    if existing_user:
        return jsonify({"error": "User with this email or username already exists!"}), 409

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    default_role = Role.query.filter_by(role_name='user').first()
    
    if not default_role:
        return jsonify({"error": "System roles not initialized"}), 500

    new_user = User(username=username,
                    email=email,
                    password=hashed_password,
                    phone=phone,
                    role_id=default_role.id
                )
    db.session.add(new_user)
    db.session.commit()


    try:
        send_verification_email(new_user.email)
        email_status = "Verification email sent!"
    except Exception as e:
        print(f"Email failed to send: {e}")
        email_status = "Account created, but failed to send verification email."

    return jsonify({"message": "User registered successfully!", "email_status": email_status}), 201



# ===========================================================================================================================
# ===========================================================================================================================



# --- LOGIN ROUTE ---
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
    
    
    if not user.is_active:
        return jsonify({"error": "Your account has been deactivated. Contact support."}), 403

    
    access_token = create_access_token(
        identity=str(user.public_id), 
        additional_claims={"role": user.role.role_name},
        expires_delta=timedelta(days=1)
    )


    return jsonify({
        "message": "Login successful!",
        "access_token": access_token,
        "user": {
            "public_id": user.public_id,
            "username": user.username,
            "email": user.email,
            "role": user.role.role_name
        }
    }), 200



# ===========================================================================================================================
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
    
    return jsonify({"message": "Email verified successfully! Your account is now active."}), 200