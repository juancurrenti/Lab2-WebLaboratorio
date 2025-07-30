module.exports = {
  checkRole: function(roles) {
    return (req, res, next) => {
      if (!req.isAuthenticated() || !req.session.usuario) {
        req.flash('error', 'Debes iniciar sesión para ver esta página.');
        return res.redirect('/login');
      }

      const esEmpleado = req.session.usuario.esEmpleado;
      const rolEmpleado = req.session.usuario.rolEmpleado;
      const esPaciente = req.session.usuario.esPaciente;

      if (esEmpleado && roles.includes(rolEmpleado)) {
        return next();
      }

      if (esPaciente && roles.includes('paciente')) {
        return next();
      }

      req.flash('error', 'No tienes permisos para acceder a esta página.');
      return res.redirect('/');
    };
  }
};