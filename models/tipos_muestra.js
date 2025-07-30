const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TiposMuestra = sequelize.define('TiposMuestra', {
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
  }, {
    tableName: "tipos_muestra",
    timestamps: false,
  });

  TiposMuestra.associate = function(models) {
    TiposMuestra.hasMany(models.Examen, { foreignKey: 'idTipoMuestra', as: 'examenes' });
    TiposMuestra.hasMany(models.UnidadMedida, { foreignKey: 'idTipoMuestra', as: 'unidadesMedida' });
    TiposMuestra.hasMany(models.Muestra, { foreignKey: 'idTipoMuestra', as: 'muestras' });
  };

  return TiposMuestra;
};