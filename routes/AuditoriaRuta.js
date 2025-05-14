const Auditoria = require("../models/auditoria"); // Asegúrate de que esta ruta sea correcta
const { Op } = require("sequelize");
const Usuario = require("../models/User");

const auditoriaController = {
  // Registrar una nueva auditoría
  registrar: async (usuarioId, operacion, detalles) => {
    try {
      await Auditoria.create({
        id_Usuario: usuarioId,
        Fecha_Hora_Operacion: new Date(),
        Operacion_Realizada: operacion,
        Detalles_Adicionales: detalles,
      });
    } catch (error) {
      console.error("Error al registrar auditoría:", error);
      throw error; // Lanza el error para que pueda ser manejado por el controlador de rutas
    }
  },

  // Método para recuperar auditorías con filtros opcionales y paginación
  listarAuditorias: async (filtros) => {
    const { fecha, descripcion, usuario, limit, offset } = filtros;
    const where = {};
  
    // Filtro por fecha exacta
    if (fecha) {
      where.Fecha_Hora_Operacion = {
        [Op.gte]: new Date(fecha),
        [Op.lt]: new Date(new Date(fecha).setDate(new Date(fecha).getDate() + 1)),
      };
    }
  
    // Filtro de descripción
    if (descripcion) {
      where.Operacion_Realizada = {
        [Op.like]: `%${descripcion}%`,
      };
    }
  
    // Filtro de usuario
    if (usuario) {
      const usuarios = await Usuario.findAll({
        where: {
          [Op.or]: [
            { nombre_usuario: { [Op.like]: `%${usuario}%` } },
            { correo_electronico: { [Op.like]: `%${usuario}%` } },
          ],
        },
      });
  
      if (usuarios.length === 0) {
        return { auditorias: [], totalPages: 0 };
      }
  
      where.id_Usuario = {
        [Op.in]: usuarios.map((user) => user.id_Usuario),
      };
    }
  
    try {
      const { count, rows: auditorias } = await Auditoria.findAndCountAll({
        where,
        limit,
        offset,
        order: [['Fecha_Hora_Operacion', 'DESC']], // Ordenar de más reciente a más antigua
        include: [
          {
            model: Usuario,
            as: "Usuario",
            attributes: ["nombre_usuario", "correo_electronico"],
          },
        ],
      });
  
      const totalPages = Math.ceil(count / limit);
  
      return { auditorias, totalPages };
    } catch (error) {
      console.error("Error al obtener auditorías:", error);
      throw error;
    }
  },
  
  

  // Método para buscar auditorías por descripción
  buscarPorDescripcion: async (descripcion) => {
    try {
      const auditorias = await Auditoria.findAll({
        where: {
          Operacion_Realizada: {
            [Op.like]: `%${descripcion}%`,
          },
        },
        include: [
          {
            model: Usuario,
            as: "Usuario",
            attributes: ["nombre_usuario", "correo_electronico"],
          },
        ],
      });

      return auditorias;
    } catch (error) {
      console.error("Error al buscar auditorías por descripción:", error);
      throw error;
    }
  },
};

module.exports = auditoriaController;
