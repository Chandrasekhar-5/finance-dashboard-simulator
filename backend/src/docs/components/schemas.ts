export const schemas = {

    AuthResponse: {

        type: 'object',

        properties: {

            success: {
                type: 'boolean',
                example: true
            },

            data: {
                type: 'object',

                properties: {
                    userId: {
                        type: 'string',
                        example: '64b8c9f1e4b0a2d3c4e5f678'
                    },

                    accessToken: {
                        type: 'string',
                        example: 'jwt-token'
                    }
                }
            }
        }
    },

    User: {

        type: 'object',

        properties: {
            success: {
                type: 'boolean',
                example: true
            },

            data: {
                type: 'object',

                properties: {
                    id: {
                        type: 'string',
                        example: '64b8c9f1e4b0a2d3c4e5f678'
                    },

                    email: {
                        type: 'string',
                        example: 'udayagiriamaresh13@gmail.com'
                    },

                    firstName: {
                        type: 'string',
                        example: 'Amaresh'
                    },

                    lastName: {
                        type: 'string',
                        example: 'Udayagiri'
                    }
                }
            }
        }
    }
}