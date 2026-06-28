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
    },

    SessionsResponse: {

        type: 'object',

        properties: {
            success: {
                type: 'boolean',
                example: true
            },

            data: {
                type: 'array',

                items: {
                    type: 'object',

                    properties: {
                        id: {
                            type: 'string',
                            example: '64b8c9f1e4b0a2d3c4e5f678'
                        },

                        deviceId: {
                            type: 'string',
                            example: 'laptop-001'
                        },

                        deviceName: {
                            type: 'string',
                            example: 'Loq'
                        },

                        ipAddress: {
                            type: 'string',
                            example: '192.168.1.1'
                        },

                        userAgent: {
                            type: 'string',
                            example: 'yaak'
                        },

                        createdAt: {
                            type: 'string',
                            example: '2026-06-07T14:34:40.527Z'
                        },

                        expiresAt: {
                            type: 'string',
                            example: '2026-06-14T14:34:40.499Z'
                        }
                    }
                }
            },
        }
    },

    Response: {

        type: 'object',

        properties: {
            success: {
                type: 'boolean',
                example: true
            },

            message: {
                type: 'string',
                example: 'Success'
            }
        }
    }
    
}