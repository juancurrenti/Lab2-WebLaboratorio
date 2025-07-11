const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Determinacion = require("../models/determinacion");
const OrdenesTrabajo = require("../models/ordenes_trabajo");

const Resultado = sequelize.define(
  "Resultado",
  {
    id_Resultado: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Orden: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "ordenes_trabajo",
        key: "id_Orden",
      },
    },
    id_Determinacion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "determinaciones",
        key: "id_Determinacion",
      },
    },
    Valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    Unidad: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Estado: {
      type: DataTypes.STRING,
      defaultValue: "Pendiente",
    },
  },
  {
    timestamps: false,
    tableName: "resultados",
  }
);


module.exports = Resultado;
