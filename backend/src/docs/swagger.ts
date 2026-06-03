import swaggerJSDoc from 'swagger-jsdoc';

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
        ]
    },

    apis: ['./src/modules/**/*.ts']
}


const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;