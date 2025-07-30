const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Determinacion = sequelize.define('Determinacion', {
    id_Determinacion: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    Nombre_Determinacion: { type: DataTypes.STRING },
    Unidad_Medida: { type: DataTypes.INTEGER },
    id_examen: { type: DataTypes.INTEGER, allowNull: false },
    estado: { type: DataTypes.BOOLEAN },
  }, {
    timestamps: false,
    tableName: "determinaciones"
  });

  Determinacion.associate = function(models) {
    Determinacion.belongsTo(models.Examen, { foreignKey: 'id_examen', as: 'examen' });
    Determinacion.belongsTo(models.UnidadMedida, { foreignKey: 'Unidad_Medida', as: 'unidadMedida' });
    Determinacion.hasMany(models.ValoresReferencia, { foreignKey: 'id_Determinacion', as: 'valoresReferencia' });
    Determinacion.hasMany(models.Resultado, { foreignKey: 'id_Determinacion', as: 'resultados' });
  };

  return Determinacion;
};