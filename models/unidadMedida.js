const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const UnidadMedida = sequelize.define('UnidadMedida', {
    id_UnidadMedida: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombreUnidadMedida: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    tipo: {
      type: DataTypes.ENUM('cuantitativa', 'cualitativa', 'descriptiva'),
      allowNull: false,
      defaultValue: 'cuantitativa'
    }

  }, {
    tableName: "unidadmedida",
    timestamps: false,
  });

  UnidadMedida.associate = function(models) {

    UnidadMedida.hasMany(models.Determinacion, { foreignKey: 'Unidad_Medida', as: 'determinaciones' });
  };

  return UnidadMedida;
};