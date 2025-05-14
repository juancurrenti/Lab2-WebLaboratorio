// config/middlewares.js
module.exports = {
    checkRole: function(roles) {
      return (req, res, next) => {
        if (req.isAuthenticated() && roles.includes(req.user.rol)) {
          return next();
        }
        res.status(403).send("Acceso no autorizado");
      };
    }
  };