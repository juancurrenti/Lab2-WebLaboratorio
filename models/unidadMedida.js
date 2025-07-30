const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const UnidadMedida = sequelize.define('UnidadMedida', {
    id_UnidadMedida: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombreUnidadMedida: { type: DataTypes.STRING, allowNull: false },
    idTipoMuestra: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    tableName: "unidadmedida",
    timestamps: false,
  });

  UnidadMedida.associate = function(models) {
    UnidadMedida.belongsTo(models.TiposMuestra, { foreignKey: 'idTipoMuestra', as: 'tipoMuestra' });
    UnidadMedida.hasMany(models.Determinacion, { foreignKey: 'Unidad_Medida', as: 'determinaciones' });
  };

  return UnidadMedida;
};