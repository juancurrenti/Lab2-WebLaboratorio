const { DataTypes } = require("sequelize");
const sequelize = require("../config/database"); // Asegúrate de que este archivo apunta a tu configuración correcta de Sequelize

const TiposMuestra = sequelize.define(
  "TiposMuestra",
  {
    idTipoMuestra: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tipoDeMuestra: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "tipos_muestra", // Nombre exacto de la tabla en la base de datos
    timestamps: false, // Si no usas columnas `createdAt` y `updatedAt`
  }
);





module.exports = TiposMuestra;
