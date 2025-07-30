const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Examen = sequelize.define('Examen', {
    id_examen: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre_examen: { type: DataTypes.STRING, allowNull: false },
    descripcion: { type: DataTypes.TEXT },
    codigo: { type: DataTypes.STRING, allowNull: false, unique: true },
    estado: { type: DataTypes.BOOLEAN, defaultValue: true },
    idTipoMuestra: { type: DataTypes.INTEGER, allowNull: false },
    tiempoDemora: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  }, {
    timestamps: false,
    tableName: "examen",
  });

  Examen.associate = function(models) {
    Examen.belongsTo(models.TiposMuestra, { foreignKey: 'idTipoMuestra', as: 'tipoMuestra' });
    Examen.hasMany(models.Determinacion, { foreignKey: 'id_examen', as: 'determinaciones' });
    Examen.hasMany(models.OrdenesExamen, { foreignKey: 'id_examen', as: 'ordenesExamenes' });
  };

  return Examen;
};