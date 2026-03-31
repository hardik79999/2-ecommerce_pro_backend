from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt

def admin_required():
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            # 1. Pehle check karo ki request me JWT token hai ya nahi
            verify_jwt_in_request()
            
            # 2. Token ke andar se claims (extra data) nikalo
            claims = get_jwt()
            
            # 3. Check karo ki role 'admin' hai ya nahi
            if claims.get("role") != "admin":
                return jsonify({"error": "Admin access required!"}), 403
            
            # Agar admin hai, toh route ko aage chalne do
            return fn(*args, **kwargs)
        return decorator
    return wrapper

def seller_required():
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            
            # Seller route ko admin bhi access kar sake, isliye hum dono ko allow kar rahe hain
            if claims.get("role") not in ["seller", "admin"]:
                return jsonify({"error": "Seller access required!"}), 403
            
            return fn(*args, **kwargs)
        return decorator
    return wrapper