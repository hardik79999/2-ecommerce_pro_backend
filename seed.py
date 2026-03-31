from app import create_app
from shop.extensions import db
from shop.models import Role, User
from flask_bcrypt import Bcrypt

app = create_app()
bcrypt = Bcrypt()

def seed_database():
    with app.app_context():
        print("🌱 Seeding database started...")

        # 1. Sabse pehle teeno Roles banate hain
        roles = ['admin', 'seller', 'customer']
        for role_name in roles:
            existing_role = Role.query.filter_by(role_name=role_name).first()
            if not existing_role:
                new_role = Role(role_name=role_name)
                db.session.add(new_role)
                print(f"✅ Role created: {role_name}")
        
        db.session.commit()

        # 2. Ab default 'Super Admin' account banate hain
        admin_role = Role.query.filter_by(role_name='admin').first()
        existing_admin = User.query.filter_by(email='admin@ecommerce.com').first()

        if not existing_admin:
            hashed_password = bcrypt.generate_password_hash('Admin@123').decode('utf-8')
            super_admin = User(
                username='SuperAdmin',
                email='admin@ecommerce.com',
                password=hashed_password,
                phone='0000000000',
                role_id=admin_role.id,
                is_verified=True # Admin ko OTP verification ki zaroorat nahi
            )
            db.session.add(super_admin)
            db.session.commit()
            print("👑 Super Admin created successfully!")
            print("📧 Email: admin@ecommerce.com")
            print("🔑 Password: Admin@123")
        else:
            print("⚠️ Super Admin already exists.")

        print("🚀 Seeding complete!")

if __name__ == '__main__':
    seed_database()