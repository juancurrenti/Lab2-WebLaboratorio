// config/auth.js
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const User = require('../models/User');

// Configuración de Passport.js
passport.use(new LocalStrategy(
    {
        usernameField: 'correo_electronico',
        passwordField: 'password',
    },
    async (username, password, done) => {
        try {
            if (!username || !password) {
                return done(null, false, { message: 'Credenciales incorrectas' });
            }

            const user = await User.findOne({ where: { correo_electronico: username } });

            if (!user) {
                return done(null, false, { message: 'Credenciales incorrectas' });
            }

            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return done(null, false, { message: 'Credenciales incorrectas' });
            }

            return done(null, user);
        } catch (error) {
            error('Error de autenticación:', error);
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id_Usuario); 
});

passport.deserializeUser(async (id_Usuario, done) => {
    try {
        const user = await User.findByPk(id_Usuario);
        if (!user) {
            done(null, false); 
        } else {
            done(null, user);
        }
    } catch (error) {
        done(error);
    }
});

module.exports = passport;
