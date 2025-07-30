const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ValoresReferencia = sequelize.define('ValoresReferencia', {
    id_ValorReferencia: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_Determinacion: { type: DataTypes.INTEGER, allowNull: false },
    Edad_Minima: { type: DataTypes.INTEGER, allowNull: false },
    Edad_Maxima: { type: DataTypes.INTEGER, allowNull: false },
    Sexo: { type: DataTypes.STRING, allowNull: false },
    Valor_Referencia_Minimo: { type: DataTypes.FLOAT, allowNull: false },
    Valor_Referencia_Maximo: { type: DataTypes.FLOAT, allowNull: false },
    Estado: { type: DataTypes.BOOLEAN },
  }, {
    timestamps: false,
    tableName: "valoresreferencia",
  });

  ValoresReferencia.associate = function(models) {
    ValoresReferencia.belongsTo(models.Determinacion, { foreignKey: 'id_Determinacion', as: 'determinacion' });
  };

  return ValoresReferencia;
};