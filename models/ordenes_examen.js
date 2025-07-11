const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Examen = require("../models/examen");
const OrdenesExamenes = sequelize.define(
  "OrdenesExamenes",
  {
    id_OrdenExamen: {
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
    id_examen: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    timestamps: false,
    tableName: "ordenes_examenes",
    autoIncrement: false,
  }
);
OrdenesExamenes.belongsTo(Examen, { foreignKey: "id_examen"});
module.exports = OrdenesExamenes;
