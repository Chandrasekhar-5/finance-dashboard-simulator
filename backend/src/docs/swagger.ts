import swaggerJSDoc from 'swagger-jsdoc';
import { responses } from './components/responses.js';
import { schemas } from './components/schemas.js';

const options: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.0.0',

        info: {
            title: 'Backend API',
            version: '1.0.0',
            description: 'Backend API Documentation'
        },

        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Development server'
            }
        ],

        components: {

            responses,

            schemas,

            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
            
        }
    },

    apis: ['./src/modules/**/*.ts']
}


const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;