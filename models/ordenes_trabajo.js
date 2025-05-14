const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Muestra = require("../models/muestra");
const Paciente = require('../models/paciente');
const Resultado = require('../models/resultados');
const OrdenesExamenes = require("../models/ordenes_examen");
const OrdenesTrabajo = sequelize.define(
  "OrdenesTrabajo",
  {
    id_Orden: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Paciente: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dni: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    Fecha_Creacion: {
      type: DataTypes.DATE,
    },
    Fecha_Entrega: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "ordenes_trabajo",
    timestamps: false,
  }
);
OrdenesTrabajo.hasMany(Muestra, { foreignKey: "id_Orden" });
OrdenesTrabajo.hasMany(OrdenesExamenes, { foreignKey: "id_Orden" });
OrdenesTrabajo.belongsTo(Paciente, { foreignKey: "id_Paciente"});
OrdenesTrabajo.hasMany(Resultado, { foreignKey: 'id_orden' });
module.exports = OrdenesTrabajo;
