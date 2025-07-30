const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { sequelize, Usuario, Empleado } = require('../models');
const auditoriaController = require('./AuditoriaRuta');


router.get('/', (req, res) => {
    res.render('admin', { pageTitle: 'Panel de Administración' });
});


router.get('/crear-usuario', (req, res) => {
  res.render('crear-usuario', { pageTitle: 'Crear Nuevo Usuario', mensaje: null, error: null });
});


router.post('/crear-usuario', async (req, res) => {
  const { nombre, correo_electronico, password, rol } = req.body;
  const transaction = await sequelize.transaction();
  
  try {
    const usuarioIdAuditoria = req.session.usuario.id;

    const usuarioExistente = await Usuario.findOne({ where: { correo_electronico }, transaction });
    if (usuarioExistente) {
      await transaction.rollback();
      return res.render('crear-usuario', { pageTitle: 'Crear Nuevo Usuario', error: 'El correo electrónico ya está en uso.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = await Usuario.create({
      nombre_usuario: nombre,
      correo_electronico,
      password: hashedPassword,
    }, { transaction });

    await Empleado.create({
      rol: rol,
      id_usuario_fk: nuevoUsuario.id_Usuario
    }, { transaction });

    await auditoriaController.registrar(
      usuarioIdAuditoria,
      "Creación de Empleado",
      `Nuevo Empleado: ${nombre} (${correo_electronico}) con rol ${rol}`,
      { transaction }
    );

    await transaction.commit();
    res.render('crear-usuario', { pageTitle: 'Crear Nuevo Usuario', mensaje: 'Usuario empleado creado exitosamente.' });

  } catch (error) {
    await transaction.rollback();
    console.error("Error al crear el usuario empleado:", error);
    res.render('crear-usuario', { pageTitle: 'Crear Nuevo Usuario', error: 'Ocurrió un error al crear el usuario.' });
  }
});


router.get('/actualizarUsuarioAdm', async (req, res) => {
  const { nombre } = req.query;
  try {
    if (nombre) {
      const usuarios = await Usuario.findAll({
        where: {
          [Op.or]: [
            { nombre_usuario: { [Op.like]: `%${nombre}%` } },
            { correo_electronico: { [Op.like]: `%${nombre}%` } },
          ],
        },
        include: {
          model: Empleado,
          as: 'empleado',
          attributes: ['rol'],
          required: true
        },
        nest: true,
        raw: true
      });

      const resultadoFinal = usuarios.map(u => ({
          id_Usuario: u.id_Usuario,
          nombre_usuario: u.nombre_usuario,
          correo_electronico: u.correo_electronico,

          rol: u.empleado.rol
      }));

      return res.json({ usuarios: resultadoFinal });
    }
    res.render("actualizarUsuarioAdm", { pageTitle: 'Actualizar Usuario' });
  } catch (error) {
    console.error("Error al buscar usuarios:", error);
    if (nombre) {
        res.status(500).json({ error: "Error en la búsqueda" });
    } else {
        res.status(500).send("Error al cargar la página");
    }
  }
});


router.post('/actualizar-usuario', async (req, res) => {
  const { idUsuario, nombre, correo_electronico, password, rol } = req.body;
  try {
    const usuario = await Usuario.findByPk(idUsuario);
    const empleado = await Empleado.findOne({ where: { id_usuario_fk: idUsuario } });

    if (!usuario || !empleado) {
      req.flash('error', 'Usuario no encontrado.');
      return res.redirect('/admin/actualizarUsuarioAdm');
    }


    usuario.nombre_usuario = nombre;
    usuario.correo_electronico = correo_electronico;
    if (password) {
      usuario.password = await bcrypt.hash(password, 10);
    }
    await usuario.save();

    empleado.rol = rol;
    await empleado.save();
    
    await auditoriaController.registrar(req.session.usuario.id, "Actualización de Empleado", `Se actualizaron los datos del usuario ${nombre} (${correo_electronico})`);

    req.flash('success', 'Usuario actualizado correctamente.');
    res.redirect('/admin/actualizarUsuarioAdm');

  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    req.flash('error', 'Ocurrió un error al actualizar el usuario.');
    res.redirect('/admin/actualizarUsuarioAdm');
  }
});


router.delete('/eliminarUsuarioAdm/:id', async (req, res) => {
  const idUsuario = req.params.id;
  const transaction = await sequelize.transaction();
  try {

    await Empleado.destroy({ where: { id_usuario_fk: idUsuario }, transaction });

    await Usuario.destroy({ where: { id_Usuario: idUsuario }, transaction });

    await transaction.commit();
    res.json({ mensaje: 'Usuario eliminado exitosamente' });
  } catch (error) {
    await transaction.rollback();
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ error: "Error al eliminar el usuario." });
  }
});


router.get('/auditoria', async (req, res) => {
  const { descripcion, usuario, fecha, page = 1 } = req.query;
  const limit = 15;
  const offset = (page - 1) * limit;

  try {
    const filtros = { descripcion, usuario, fecha, limit, offset };
    const { auditorias, totalPages } = await auditoriaController.listarAuditorias(filtros);

    if (req.xhr || req.headers.accept.includes('json')) {
      return res.json({ auditorias, totalPages });
    }
    
    res.render("auditoria", {
      pageTitle: 'Registro de Auditoría',
      auditorias,
      totalPages,
      currentPage: parseInt(page),
      descripcion,
      usuario,
      fecha,
    });
  } catch (error) {
    console.error("Error al obtener auditorías:", error);
    res.status(500).send("Error al obtener auditorías");
  }
});

module.exports = router;