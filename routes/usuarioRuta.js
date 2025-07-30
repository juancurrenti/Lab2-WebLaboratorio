const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { Usuario } = require('../models');


router.get('/cambiarContrasena', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  res.render('cambiarContrasena', { pageTitle: 'Cambiar Contraseña' });
});

router.post('/cambiar-contrasena', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }

  const { contrasena_actual, nueva_contrasena, confirmar_contrasena } = req.body;
  const usuarioId = req.session.usuario.id;

  try {
    if (nueva_contrasena !== confirmar_contrasena) {
      req.flash('error', 'Las nuevas contraseñas no coinciden.');
      return res.redirect('/cambiarContrasena');
    }

    const usuario = await Usuario.findByPk(usuarioId);
    const passwordValido = await bcrypt.compare(contrasena_actual, usuario.password);

    if (!passwordValido) {
      req.flash('error', 'La contraseña actual es incorrecta.');
      return res.redirect('/cambiarContrasena');
    }

    usuario.password = await bcrypt.hash(nueva_contrasena, 10);
    await usuario.save();

    req.flash('success', 'Contraseña cambiada con éxito.');
    res.redirect(`/${req.session.usuario.rolEmpleado}`);

  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    req.flash('error', 'Ocurrió un error al cambiar la contraseña.');
    res.redirect('/cambiarContrasena');
  }
});

module.exports = router;