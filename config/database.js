const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: 'localhost',
  username: 'root',
  password: '',
  database: 'clinica',
});


async function testDatabaseConnection() {
  try {
    await sequelize.authenticate();
    log('Conexión a la base de datos establecida correctamente.');
  } catch (error) {
    error('Error al conectar a la base de datos:', error);
  }
}


module.exports = sequelize;
