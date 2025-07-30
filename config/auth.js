const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const { Usuario, Empleado, Paciente } = require('../models');

passport.use(new LocalStrategy(
  {
    usernameField: 'correo_electronico',
    passwordField: 'password',
  },
  async (email, password, done) => {
    try {
      console.log(`[DEBUG] 1. Buscando usuario con email: ${email}`);
      console.log(`[DEBUG] 1.5. Contraseña recibida: "${password}"`);
      const user = await Usuario.findOne({ where: { correo_electronico: email } });

      

      

      if (!user) {
        console.log('[DEBUG] 2. Resultado: Usuario NO encontrado.');
        return done(null, false, { message: 'Credenciales incorrectas' });
      }
      
      console.log(`[DEBUG] 2. Resultado: Usuario encontrado -> ${user.nombre_usuario}`);

      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log('[DEBUG] 3. ¿La contraseña coincide?:', passwordMatch);
      
      if (!passwordMatch) {
        console.log('[DEBUG] 4. Resultado: La contraseña NO coincide.');
        return done(null, false, { message: 'Credenciales incorrectas' });
      }

      console.log('[DEBUG] 4. Resultado: Autenticación exitosa.');
      return done(null, user);
    } catch (error) {
      console.error('Error grave en la estrategia de Passport:', error);
      return done(error);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id_Usuario); 
});

passport.deserializeUser(async (id_Usuario, done) => {
  try {
    const user = await Usuario.findByPk(id_Usuario, {
      include: [
        { model: Empleado, as: 'empleado' },
        { model: Paciente, as: 'paciente' }
      ]
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});