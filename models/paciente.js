const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const Paciente = sequelize.define('Paciente', {
        id_paciente: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        id_usuario_fk: { type: DataTypes.INTEGER, allowNull: true },
        nombre: { type: DataTypes.STRING, allowNull: false },
        apellido: { type: DataTypes.STRING, allowNull: false },
        dni: { type: DataTypes.STRING, allowNull: false, unique: true },
        email: { type: DataTypes.STRING },
        telefono: { type: DataTypes.STRING },
        direccion: { type: DataTypes.STRING },
        fecha_nacimiento: { type: DataTypes.DATE, allowNull: false },
        genero: { type: DataTypes.STRING, allowNull: false },
        embarazo: { type: DataTypes.TINYINT, allowNull: false },
        fecha_registro: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        estado: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'activo' // Valores posibles: 'activo', 'inactivo'
        }
    }, {
        timestamps: false,
        tableName: "pacientes",
    });

    Paciente.associate = function(models) {
        Paciente.belongsTo(models.Usuario, { foreignKey: 'id_usuario_fk', as: 'usuario' });
        Paciente.hasMany(models.OrdenTrabajo, { foreignKey: 'id_Paciente', as: 'ordenes' });
        Paciente.hasMany(models.Muestra, { foreignKey: 'id_Paciente', as: 'muestras' });
    };

    return Paciente;
};