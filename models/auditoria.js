const { DataTypes } = require("sequelize");
const sequelize = require("../config/database"); // Asegúrate de que esta ruta sea correcta
const Usuario = require("./User.js"); // Asegúrate de que esta ruta sea correcta

const Auditoria = sequelize.define(
  "Auditoria",
  {
    id_Auditoria: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Usuario: DataTypes.INTEGER,
    Fecha_Hora_Operacion: DataTypes.DATE,
    Operacion_Realizada: DataTypes.STRING,
    Detalles_Adicionales: DataTypes.STRING(200),
  },
  {
    tableName: "auditoria",
    timestamps: false,
  }
);
Auditoria.belongsTo(Usuario, { foreignKey: "id_Usuario" });

module.exports = Auditoria;
