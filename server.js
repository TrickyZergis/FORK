const cors = require('cors');
require('dotenv').config();
const { PORT, URL_CLIENT } = require('./config');
const loggerHTTP = require('./utils/logger.utils');


const corsOptions = {
 origin: URL_CLIENT,
 credentials: true,
};
