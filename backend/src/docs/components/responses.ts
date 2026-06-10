export const responses = {

    InternalServerError: {

        description: 'Internal server error',
        content: {
            'application/json': {
                schema: {
                    type: 'object',

                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },

                        error: {
                            type: 'string',
                            example: 'Internal server error'
                        }
                    }
                }
            }
        }
    },

    ValidationError: {

        description: 'Validation error',
        content: {
            'application/json': {
                schema: {
                    type: 'object',

                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },

                        error: {
                            type: 'string',
                            example: 'Validation error'
                        }
                    }
                }
            }
        }
    }
}