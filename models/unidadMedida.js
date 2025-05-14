const { DataTypes } = require("sequelize");
const sequelize = require("../config/database"); // Asegúrate de apuntar a la configuración correcta
const TiposMuestra = require("./tipos_muestra"); // Importa el modelo de TiposMuestra

const UnidadMedida = sequelize.define(
  "UnidadMedida",
  {
    id_UnidadMedida: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombreUnidadMedida: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    idTipoMuestra: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: TiposMuestra,
        key: "idTipoMuestra",
      },
    },
  },
  {
    tableName: "unidadmedida", // Asegúrate de que coincida con el nombre de la tabla en tu base de datos
    timestamps: false, // Deshabilita timestamps si no los necesitas
  }
);

// Relación con TiposMuestra
UnidadMedida.belongsTo(TiposMuestra, { foreignKey: "idTipoMuestra", as: "tipoMuestra" });

module.exports = UnidadMedida;
