from flask import Flask
from config import Config
from shop.extensions import db, migrate, bcrypt, jwt, mail

def create_app(config_class=Config):
    app = Flask(__name__)
    
    app.config.from_object(config_class)

    # extensions initialize
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)

    from shop import models

    # Blueprints Register
    from shop.auth.routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    from shop.user.routes import user_bp
    app.register_blueprint(user_bp, url_prefix='/api/user')

    from shop.admin.routes import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    @app.route('/')
    def index():
        return {"message": "E-Commerce Backend is Running Successfully!"}, 200

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)